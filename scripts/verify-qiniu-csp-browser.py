#!/usr/bin/env python3
"""用真实 Chromium 验证真实 Spring CSP 对七牛稳定引用的放行与拦截。

CSP 与 assetPath 全部取自 MockMvc 真实响应写出的契约文件，不在此另造策略。
本地线程 HTTP 服务只做测试对端：返回带该 CSP 的页面、assetPath 的 302 与 Location。
所有 http(s) 请求都由唯一一条路由兜底：只放行本机 fixture 与两个假下载域名（返回本地固定 PNG），
其余一律 abort，因此不会解析真实 DNS 或访问任何外网。
未列入 CSP 的域名同样会被兜底路由返回 PNG，若策略放行就会加载成功，故“未加载”是有效负例。
输出只含布尔与计数，不含签名地址或凭据。
"""
import argparse
import base64
import json
import struct
import sys
import threading
import time
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONTRACT = ROOT / 'campus-shopping-app/target/qiniu-csp-contract.json'
DEFAULT_OUTPUT = ROOT / 'var/verify/qiniu-phase2-csp-browser.json'
ALLOWED_PREFIX = 'https://images.example.com/'
BLOCKED_PREFIX = 'https://blocked.example.com/'
BLOCKED_URL = BLOCKED_PREFIX + 'probe.png'
PNG_SIZE = 4

# 页面只用 <img> 与外部样式，不含 inline 脚本：CSP 的 script-src 'self' 无需放宽。
PAGE = """<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><title>qiniu csp probe</title></head>
<body>
{images}
</body></html>
"""


def png_bytes():
    """生成确定性的 4x4 PNG，避免依赖 Pillow 或任何外部图片。"""
    raw = b''.join(b'\x00' + bytes([40, 80, 120]) * PNG_SIZE for _ in range(PNG_SIZE))

    def chunk(tag, payload):
        return (struct.pack('>I', len(payload)) + tag + payload
                + struct.pack('>I', zlib.crc32(tag + payload) & 0xffffffff))

    header = struct.pack('>IIBBBBB', PNG_SIZE, PNG_SIZE, 8, 2, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header)
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


class Fixture(BaseHTTPRequestHandler):
    """只服务三类请求：带 CSP 的页面、不带 CSP 的对照页面、assetPath 的 302。"""

    contract = None

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path == '/':
            self._html(self.contract['csp'],
                       f'<img id="allowed" alt="allowed" src="{self.contract["assetPath"]}">\n'
                       f'<img id="blocked" alt="blocked" src="{BLOCKED_URL}">')
        elif path == '/control':
            # 对照页不发 CSP，且只放 blocked 图片：所有请求都由 CDP Fetch 逐条裁决，不会走真实网络。
            self._html(None, f'<img id="blocked" alt="blocked" src="{BLOCKED_URL}">')
        elif path == self.contract['assetPath']:
            self.send_response(302)
            self.send_header('Location', self.contract['location'])
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', '0')
            self.end_headers()
        elif path == '/favicon.ico':
            self.send_response(204)
            self.send_header('Content-Length', '0')
            self.end_headers()
        else:
            self.send_response(404)
            self.send_header('Content-Length', '0')
            self.end_headers()

    def _html(self, csp, images):
        body = PAGE.format(images=images).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        if csp:
            self.send_header('Content-Security-Policy', csp)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # 不输出请求行，避免把 302 的签名地址写进日志。
        return


def load_contract(path):
    contract = json.loads(Path(path).read_text('utf-8'))
    missing = [key for key in ('csp', 'assetPath', 'location') if not contract.get(key)]
    if missing:
        raise SystemExit(f'契约文件缺少字段：{missing}（先运行 Maven 定向测试生成 fixture）')
    csp = contract['csp']
    if "img-src" not in csp or ALLOWED_PREFIX.rstrip('/') not in csp:
        raise SystemExit('契约 CSP 未包含预期的 img-src 下载域名，拒绝用自造策略继续')
    if not contract['assetPath'].startswith('/media/qiniu/') or not contract['assetPath'].endswith('.png'):
        raise SystemExit('契约 assetPath 不是七牛稳定引用')
    if not contract['location'].startswith(ALLOWED_PREFIX):
        raise SystemExit('契约 Location 未指向预期的假下载域名')
    return contract


def run(contract, executable, output, debug=False):
    from playwright.sync_api import sync_playwright

    png = png_bytes()
    Fixture.contract = contract
    server = ThreadingHTTPServer(('127.0.0.1', 0), Fixture)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f'http://127.0.0.1:{server.server_port}'
    served = {'allowed': 0, 'blocked': 0, 'aborted': 0}
    control_served = {'allowed': 0, 'blocked': 0, 'aborted': 0}
    results = {'assetRedirectStatus': None}
    violations = []
    base_origin = f'http://127.0.0.1:{server.server_port}'
    png_b64 = base64.b64encode(png).decode('ascii')

    def attach(page, counters):
        """CDP Fetch 逐请求拦截：redirect 链的每一跳都会暂停，可保留真实 302 与真实 CSP。

        Playwright 的 route 只对 redirect 链首个 URL 调用 handler，无法拦截 302 的目标，
        因此这里改用 CDP；任何非本机 fixture、非两个假域名的请求直接失败，不会出网。
        """
        session = page.context.new_cdp_session(page)

        def on_paused(params):
            request_id = params['requestId']
            url = params['request']['url']
            if debug:
                print('PAUSED', url.split('?', 1)[0], flush=True)
            parts = urlsplit(url)
            if url.startswith(ALLOWED_PREFIX) or url.startswith(BLOCKED_PREFIX):
                counters['allowed' if url.startswith(ALLOWED_PREFIX) else 'blocked'] += 1
                session.send('Fetch.fulfillRequest', {
                    'requestId': request_id,
                    'responseCode': 200,
                    'responseHeaders': [{'name': 'Content-Type', 'value': 'image/png'}],
                    'body': png_b64,
                })
            elif f'{parts.scheme}://{parts.netloc}' == base_origin:
                session.send('Fetch.continueRequest', {'requestId': request_id})
            else:
                counters['aborted'] += 1
                session.send('Fetch.failRequest', {'requestId': request_id, 'errorReason': 'BlockedByClient'})

        session.on('Fetch.requestPaused', on_paused)
        session.send('Fetch.enable', {'patterns': [{'urlPattern': '*'}]})
        return session

    try:
        with sync_playwright() as runtime:
            browser = runtime.chromium.launch(headless=True, executable_path=executable, args=[
                '--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server',
                # 防御性 DNS 锁定：除回环外任何域名解析直接失败，漏拦截也不会出网。
                '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
            ])
            try:
                page = browser.new_page()
                attach(page, served)
                page.on('console', lambda message: violations.append(message.text))
                page.on('requestfailed', lambda request: debug and print(
                    'FAILED', request.url.split('?', 1)[0], request.failure, flush=True))
                page.on('response', lambda response: _record(results, contract, response))
                page.goto(base + '/', wait_until='load')
                results['allowedNaturalWidth'] = _wait_decoded(page, '#allowed')
                # 等一帧再读被拦截元素：CSP 拒绝发生在请求之前，宽度保持 0。
                time.sleep(0.5)
                results['blockedNaturalWidth'] = _width(page, '#blocked')
                # 快照 CSP 页计数，避免与对照页混合。
                results['cspPage'] = dict(served)

                # 有效负例：同一个被拦截域名在不带 CSP 的对照页里必须由同一拦截返回并解码。
                control = browser.new_page()
                attach(control, control_served)
                control.goto(base + '/control', wait_until='load')
                results['controlNaturalWidth'] = _wait_decoded(control, '#blocked')
                results['controlPage'] = dict(control_served)
                control.close()
                page.close()
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

    violation = [text for text in violations if 'Content Security Policy' in text or 'Refused to load' in text]
    if debug:
        for text in violations:
            print('CONSOLE', text, flush=True)
    csp_page = results.get('cspPage', {'allowed': 0, 'blocked': 0, 'aborted': 0})
    control_page = results.get('controlPage', {'allowed': 0, 'blocked': 0, 'aborted': 0})
    checks = {
        'cspTakenFromSpringContract': True,
        'allowedImageDecoded': results.get('allowedNaturalWidth', 0) > 0,
        'allowedHostServedOnCspPage': csp_page['allowed'] > 0,
        'assetRedirectStatusIs302': results['assetRedirectStatus'] == 302,
        'blockedImageNotDecoded': results.get('blockedNaturalWidth', 1) == 0,
        # CSP 在发请求前就拒绝，因此 CSP 页上的拦截函数不应被调用（以路由回调计数为准）。
        'blockedHostBlockedByCsp': csp_page['blocked'] == 0,
        'cspViolationReported': bool(violation),
        # 有效负例：无 CSP 对照页上同一域名确实被路由返回并解码，证明上述 0 次是策略所致。
        'blockedRouteWorksWithoutCsp': control_page['blocked'] > 0 and results.get('controlNaturalWidth', 0) > 0,
        'noUnexpectedExternalRequest': csp_page['aborted'] == 0 and control_page['aborted'] == 0,
    }
    report = {
        'status': 'PASS' if all(checks.values()) else 'FAIL',
        'kind': 'REAL_CHROMIUM_WITH_REAL_SPRING_CSP',
        'note': '真实 Spring CSP + 真实 Chromium；下载域名与 302 后端为本地测试对端，非真实七牛或 CDN。',
        'browser': 'provided' if executable else 'playwright-bundled',
        'checks': checks,
        'counts': {
            'cspPageAllowedHostServed': csp_page['allowed'],
            'cspPageBlockedHostServed': csp_page['blocked'],
            'controlPageBlockedHostServed': control_page['blocked'],
            'abortedRequests': csp_page['aborted'] + control_page['aborted'],
            'cspViolations': len(violation),
            'allowedNaturalWidth': results.get('allowedNaturalWidth', 0),
            'blockedNaturalWidth': results.get('blockedNaturalWidth', 0),
            'controlNaturalWidth': results.get('controlNaturalWidth', 0),
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    failed = [name for name, ok in checks.items() if not ok]
    print(f"{report['status']} qiniu csp browser checks={len(checks)} failed={failed}")
    return 0 if not failed else 1


def _width(page, selector):
    return page.locator(selector).evaluate('element => element.naturalWidth')


def _wait_decoded(page, selector, timeout=15):
    """轮询解码宽度；不用 wait_for_function，因为它以 eval 构造谓词，会被真实 CSP 的 script-src 拒绝。"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        width = _width(page, selector)
        if width > 0:
            return width
        time.sleep(0.1)
    return _width(page, selector)


def _record(results, contract, response):
    if response.url.split('?', 1)[0].endswith(contract['assetPath']) and response.status == 302:
        results['assetRedirectStatus'] = 302


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--contract', type=Path, default=DEFAULT_CONTRACT)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--browser-executable', default=None,
                        help='本机 Chromium 路径；CI 省略即用 Playwright 自带浏览器')
    parser.add_argument('--debug', action='store_true', help='打印路由与失败请求（已去 query，不含签名）')
    args = parser.parse_args()
    contract = load_contract(args.contract)
    return run(contract, args.browser_executable, args.output, args.debug)


if __name__ == '__main__':
    sys.exit(main())
