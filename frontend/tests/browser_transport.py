"""等待契约替身的绑定回调完成后关闭页面，避免测试退出时遗留异步通道任务。"""

import re


def add_campus_styles(page, ui):
    """离线 DOM 注入使用与同源样式入口相同的模块及层叠顺序。"""
    root = (ui / 'src/styles').resolve()
    imports = re.compile(r'(?m)^@import\s+[\'"](\./[\w./-]+\.css)[\'"];[ \t]*$')

    def expand(path, parents=()):
        path = path.resolve()
        if root not in path.parents or path in parents:
            raise ValueError('Invalid or cyclic campus stylesheet import')
        source = path.read_text(encoding='utf-8')
        return imports.sub(lambda match: expand(path.parent / match.group(1), (*parents, path)), source)

    page.add_style_tag(content=expand(root / 'app.css'))


def track_bindings(page):
    page.evaluate('''() => {
      const invoke = window.__contractApi;
      window.__contractBindingsPending = 0;
      window.__contractApi = (...args) => {
        window.__contractBindingsPending++;
        return invoke(...args).finally(() => window.__contractBindingsPending--);
      };
    }''')


def close_page(page):
    if not page.is_closed():
        page.wait_for_function('() => (window.__contractBindingsPending || 0) === 0')
        page.close()


def close_browser(browser):
    for context in browser.contexts:
        for page in context.pages:
            close_page(page)
    browser.close()
