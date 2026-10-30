"""审查探针：只使用新建临时 MySQL 和已验证 JAR；可验证原缺陷或修复结果。"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import traceback

import httpx
import pymysql

ROOT = Path(__file__).resolve().parents[1]
FLAGS = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0


def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


class Api:
    def __init__(self, base):
        self.client = httpx.Client(base_url=base + '/api/v1', timeout=40, trust_env=False)
        self.csrf()

    def csrf(self):
        token = self.client.get('/auth/csrf').json()['data']
        self.client.headers[token['headerName']] = token['token']

    def call(self, method, path, body=None, headers=None):
        response = self.client.request(method, path, json=body, headers=headers)
        return response.status_code, response.json()

    def ok(self, method, path, body=None):
        status, data = self.call(method, path, body)
        assert status == 200 and data['code'] == '0000', (path, status, data.get('code'))
        return data.get('data')

    def register_login(self, username):
        password = secrets.token_urlsafe(20)
        user = self.ok('POST', '/auth/register', {'username': username, 'password': password, 'displayName': '隔离审查账号'})
        self.ok('POST', '/auth/login', {'username': username, 'password': password})
        self.csrf()
        return user['userId']


def python_probes(record, temp, expect_fixed):
    sys.path.insert(0, str(ROOT / 'ai-service'))
    from app.config import Settings
    from app.engine import answer, requested_quantity
    from app.retrieval import KnowledgeStore
    store = KnowledgeStore(Settings(api_key=secrets.token_urlsafe(32), db_path=str(temp / 'probe.sqlite3')))
    try:
        offer = {'skuId': 'water', 'merchantId': 'm', 'title': '矿泉水', 'specKey': '单瓶', 'priceCent': 100, 'available': 99}
        parsed = {q: requested_quantity(q) for q in ('买十二瓶矿泉水', '买二十瓶矿泉水', '买100瓶矿泉水')}
        result = answer(store, '买十二瓶矿泉水', [], [offer], [])
        recommended = result['recommendations'][0]['quantity'] if result['recommendations'] else None
        quantity_ok = parsed['买十二瓶矿泉水'] == 12 and parsed['买二十瓶矿泉水'] == 20 and parsed['买100瓶矿泉水'] is None and recommended == 12
        record('AI_QUANTITY', quantity_ok if expect_fixed else parsed['买十二瓶矿泉水'] == 2, parsed=parsed, recommendedQuantity=recommended)
        store.settings = replace(store.settings, llm_key='fake-provider-no-network')
        store.provider.settings = store.settings
        store.provider.complete = lambda *a, **kw: {'answer': 'x' * 8001, 'recommendations': []}
        result = answer(store, '矿泉水', [], [offer], [])
        fallback_ok = result['mode'] == 'LOCAL_FALLBACK' and len(result['answer']) < 8001 and 'x' * 100 not in result['answer']
        record('AI_FALLBACK', fallback_ok if expect_fixed else result['mode'] == 'LOCAL_FALLBACK' and len(result['answer']) > 8000,
               mode=result['mode'], answerLength=len(result['answer']), externalModelUsed=False)
    finally:
        store.close()


def business_probes(base, db, connect, record, expect_fixed):
    owner, clerk = Api(base), Api(base)
    owner_id, clerk_id = owner.register_login('review_owner'), clerk.register_login('review_clerk')
    merchant, store_id = 'review-merchant', 'review-store'
    with db.cursor() as cur:
        cur.execute("INSERT INTO mer_merchant(id,source_application_id,name,category,status) VALUES(%s,'review-application','审查商户','food','ACTIVE')", (merchant,))
        cur.execute("INSERT INTO mer_store(id,merchant_id,name,location) VALUES(%s,%s,'审查店','临时测试')", (store_id, merchant))
        cur.execute("INSERT INTO iam_merchant_membership(merchant_id,user_id,role,status) VALUES(%s,%s,'OWNER','ACTIVE')", (merchant, owner_id))
        cur.execute("INSERT INTO cat_category(code,name,active) VALUES('review','审查类目',TRUE)")

    first = owner.ok('POST', f'/merchants/{merchant}/invitations', {'username': 'review_clerk'})
    second = owner.ok('POST', f'/merchants/{merchant}/invitations', {'username': 'review_clerk'})
    clerk.ok('POST', f"/invitations/{first['id']}/accept")
    role = owner.ok('POST', f'/merchants/{merchant}/rbac/roles', {'name': '商品只读', 'permissions': ['product.read']})
    owner.ok('PUT', f'/merchants/{merchant}/rbac/members/{clerk_id}/role', {'roleCode': role['code']})
    before = clerk.call('GET', f'/merchants/{merchant}/stocks')[1]['code']
    second_status, second_result = clerk.call('POST', f"/invitations/{second['id']}/accept")
    if not expect_fixed:
        assert second_status == 200 and second_result['code'] == '0000'
    after = clerk.call('GET', f'/merchants/{merchant}/stocks')[1]['code']
    with db.cursor() as cur:
        cur.execute('SELECT role FROM iam_merchant_membership WHERE merchant_id=%s AND user_id=%s', (merchant, clerk_id))
        active_role = cur.fetchone()[0]
    invitation_ok = before == 'A0006' and after == 'A0006' and active_role == role['code'] and second_result['code'] != '0000'
    record('INVITATION_ROLE_OVERRIDE', invitation_ok if expect_fixed else before != '0000' and after == '0000', beforeCode=before, afterCode=after, roleAfter=active_role, secondAcceptCode=second_result['code'])

    def seed_product(product, sku):
        with db.cursor() as cur:
            cur.execute("INSERT INTO cat_product(id,merchant_id,store_id,title,description,image_url,category_code,status,version) VALUES(%s,%s,%s,'审查商品','','','review','PUBLISHED',0)", (product, merchant, store_id))
            cur.execute("INSERT INTO cat_sku(id,product_id,merchant_id,store_id,spec_key,price_cent,status,version) VALUES(%s,%s,%s,%s,'单件',1000,'ACTIVE',0)", (sku, product, merchant, store_id))
            cur.execute('INSERT INTO inv_stock_balance(merchant_id,store_id,sku_id,on_hand,reserved) VALUES(%s,%s,%s,100,0)', (merchant, store_id, sku))

    def race(lock_sql, lock_values, request, mutation, mutation_values):
        blocker = connect(autocommit=False)
        try:
            with blocker.cursor() as cur:
                cur.execute(lock_sql, lock_values)
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(request)
                try:
                    deadline = time.monotonic() + 15
                    while time.monotonic() < deadline:
                        with db.cursor() as cur:
                            cur.execute('SELECT COUNT(*) FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON w.BLOCKING_ENGINE_LOCK_ID=l.ENGINE_LOCK_ID JOIN performance_schema.threads t ON l.THREAD_ID=t.THREAD_ID WHERE t.PROCESSLIST_ID=%s', (blocker.thread_id(),))
                            if cur.fetchone()[0]:
                                break
                        if future.done():
                            status, data = future.result()
                            record('UNEXPECTED_EARLY_RESPONSE', False, httpStatus=status, responseCode=data.get('code'))
                            raise AssertionError('请求未等待预期的测试锁')
                        time.sleep(.05)
                    else:
                        raise AssertionError('没有观察到预期的数据库锁等待')
                    with blocker.cursor() as cur:
                        for sql, values in zip(mutation, mutation_values):
                            cur.execute(sql, values)
                    blocker.commit()
                finally:
                    blocker.rollback()
                return future.result(timeout=30)
        finally:
            blocker.close()

    seed_product('review-product-price', 'review-sku-price')
    response = race('SELECT id FROM cat_product WHERE id=%s FOR UPDATE', ('review-product-price',),
        lambda: owner.call('POST', f'/merchants/{merchant}/products/review-product-price/publish', {'published': False}),
        ['UPDATE cat_sku SET price_cent=2000,version=version+1 WHERE id=%s', 'UPDATE cat_product SET version=version+1 WHERE id=%s'],
        [('review-sku-price',), ('review-product-price',)])
    with db.cursor() as cur:
        cur.execute('SELECT price_cent,version FROM cat_sku WHERE id=%s', ('review-sku-price',))
        price, version = cur.fetchone()
    product_ok = response[1]['code'] == '0000' and price == 2000 and version >= 1
    record('PRODUCT_LOST_UPDATE', product_ok if expect_fixed else response[1]['code'] == '0000' and price == 1000,
           writerCommittedPrice=2000, afterPublishPrice=price, afterPublishSkuVersion=version, responseCode=response[1]['code'])

    for i in range(101):
        seed_product(f'review-cart-product-{i:03}', f'review-cart-sku-{i:03}')
    with db.cursor() as cur:
        cur.execute('INSERT INTO trd_cart_owner(user_id) VALUES(%s)', (owner_id,))
        cur.executemany('INSERT INTO trd_cart_item(user_id,merchant_id,sku_id,quantity) VALUES(%s,%s,%s,1)', [(owner_id, merchant, f'review-cart-sku-{i:03}') for i in range(99)])
    response = race('SELECT user_id FROM trd_cart_owner WHERE user_id=%s FOR UPDATE', (owner_id,),
        lambda: owner.call('PUT', '/cart', {'skuId': 'review-cart-sku-100', 'quantity': 1}),
        ['INSERT INTO trd_cart_item(user_id,merchant_id,sku_id,quantity) VALUES(%s,%s,%s,1)'], [(owner_id, merchant, 'review-cart-sku-099')])
    with db.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM trd_cart_item WHERE user_id=%s', (owner_id,))
        actual = cur.fetchone()[0]
    visible = len(owner.ok('GET', '/cart'))
    cart_ok = response[1]['code'] == 'T0006' and actual == 100 and visible == 100
    record('CART_LINE_LIMIT_RACE', cart_ok if expect_fixed else actual == 101 and visible == 100, actualRows=actual, visibleRows=visible, responseCode=response[1]['code'])

    seed_product('review-product-stock', 'review-sku-stock')
    with db.cursor() as cur:
        cur.execute("INSERT INTO ai_conversation(id,user_id,title) VALUES('review-conversation',%s,'审查')", (clerk_id,))
        item = {'skuId': 'review-sku-stock', 'merchantId': merchant, 'title': '审查商品', 'specKey': '单件', 'priceCent': 1000, 'quoteVersion': 0, 'quantity': 1, 'imageUrl': ''}
        cur.execute("INSERT INTO ai_proposal(id,user_id,conversation_id,status,items_json,expires_at) VALUES('review-proposal',%s,'review-conversation','PENDING',%s,TIMESTAMPADD(MINUTE,10,UTC_TIMESTAMP(3)))", (clerk_id, json.dumps([item], ensure_ascii=False)))
    response = race('SELECT id FROM cat_product WHERE id=%s FOR UPDATE', ('review-product-stock',),
        lambda: clerk.call('POST', '/ai/proposals/review-proposal/confirm', {'selectedSkuIds': ['review-sku-stock']}),
        ['UPDATE inv_stock_balance SET reserved=on_hand,version=version+1 WHERE sku_id=%s'], [('review-sku-stock',)])
    with db.cursor() as cur:
        cur.execute('SELECT on_hand-reserved FROM inv_stock_balance WHERE sku_id=%s', ('review-sku-stock',))
        available = cur.fetchone()[0]
        cur.execute('SELECT COUNT(*) FROM trd_cart_item WHERE user_id=%s AND sku_id=%s', (clerk_id, 'review-sku-stock'))
        proposed_cart_rows = cur.fetchone()[0]
    proposal_ok = response[1]['code'] == 'I0001' and available == 0 and proposed_cart_rows == 0
    record('PROPOSAL_STALE_STOCK', proposal_ok if expect_fixed else response[1]['code'] == '0000' and available == 0, responseCode=response[1]['code'], currentAvailable=available, proposedCartRows=proposed_cart_rows)

    with db.cursor() as cur:
        for i in range(104):
            mid, sid = f'review-m-{i:03}', f'review-s-{i:03}'
            cur.execute("INSERT INTO mer_merchant(id,source_application_id,name,category,status) VALUES(%s,%s,'审查商户','food','ACTIVE')", (mid, mid))
            cur.execute("INSERT INTO mer_store(id,merchant_id,name,location) VALUES(%s,%s,'审查店','临时测试')", (sid, mid))
            cur.execute("INSERT INTO iam_merchant_membership(merchant_id,user_id,role,status) VALUES(%s,%s,'OWNER','ACTIVE')", (mid, owner_id))
    workspace = owner.ok('GET', '/workspace')
    membership_ok = len(workspace['memberships']) == 105 and len(workspace['merchants']) == 105 and len(workspace['merchantPermissions']) == 105
    record('MEMBERSHIP_TRUNCATION', membership_ok if expect_fixed else len(workspace['memberships']) == 100, actualActiveMemberships=105, returnedMemberships=len(workspace['memberships']), returnedMerchants=len(workspace['merchants']), returnedPermissionSets=len(workspace['merchantPermissions']))
    if expect_fixed:
        with db.cursor() as cur:
            users = [(f'review-member-{i:03}', f'review-member-{i:03}', 'unused', '审查成员') for i in range(101)]
            cur.executemany('INSERT INTO iam_user(id,username,password_hash,display_name) VALUES(%s,%s,%s,%s)', users)
            cur.executemany("INSERT INTO iam_merchant_membership(merchant_id,user_id,role,status) VALUES(%s,%s,'CLERK','ACTIVE')", [(merchant, user[0]) for user in users])
        members = owner.ok('GET', f'/merchants/{merchant}/members')
        record('MERCHANT_MEMBER_TRUNCATION', len(members) == 103, actualMembers=103, returnedMembers=len(members))
        clerk_workspace = clerk.ok('GET', '/workspace')
        record('BATCHED_WORKSPACE_PERMISSIONS', clerk_workspace['merchantPermissions'].get(merchant) == ['product.read'] or set(clerk_workspace['merchantPermissions'].get(merchant, [])) == {'product.read'}, customPermissions=clerk_workspace['merchantPermissions'].get(merchant))

    anonymous = Api(base)
    body = {'username': 'review_missing', 'password': 'invalid-password'}
    ordinary = [anonymous.call('POST', '/auth/login', body)[0] for _ in range(32)]
    forwarded = [anonymous.call('POST', '/auth/login', body, {'X-Forwarded-For': f'198.51.100.{i}'})[0] for i in range(1, 33)]
    rate_ok = 429 in ordinary and all(s == 429 for s in forwarded)
    record('FORWARDED_RATE_BYPASS', rate_ok if expect_fixed else 429 in ordinary and all(s == 200 for s in forwarded), ordinaryBlocked=ordinary.count(429), forwardedBlocked=forwarded.count(429), forwardedRequests=len(forwarded), profile='prod', boundToLoopback=True)
    for api in (owner, clerk, anonymous):
        api.client.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mysql-bin', required=True)
    parser.add_argument('--jar', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--expect-fixed', action='store_true')
    args = parser.parse_args()
    jar = args.jar.resolve()
    assert jar.is_file()
    temp = Path(tempfile.mkdtemp(prefix='campus-review-probe-')).resolve()
    assert temp.parent == Path(tempfile.gettempdir()).resolve() and temp.name.startswith('campus-review-probe-')
    results, processes, logs = [], [], []
    report = {'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(), 'existingDatabaseUsed': False, 'externalModelUsed': False, 'probes': results}
    target = 'FIXED' if args.expect_fixed else 'REPRODUCED'
    def record(name, expected, **details):
        results.append({'id': name, 'status': target if expected else 'FAILED', **details})
        print(name + ': ' + results[-1]['status'], flush=True)
    connection = None
    try:
        server = Path(args.mysql_bin).resolve() / 'mysqld.exe'
        mysql_port, java_port = port(), port()
        base = [str(server), '--no-defaults', '--basedir=' + str(server.parent.parent), '--datadir=' + str(temp / 'data')]
        subprocess.run(base + ['--initialize-insecure', '--log-error=' + str(temp / 'mysql.log')], check=True, creationflags=FLAGS, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
        processes.append(subprocess.Popen(base + ['--port=' + str(mysql_port), '--bind-address=127.0.0.1', '--mysqlx=OFF', '--skip-log-bin', '--log-error=' + str(temp / 'mysql.log')], creationflags=FLAGS, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        for _ in range(100):
            try:
                connection = pymysql.connect(host='127.0.0.1', port=mysql_port, user='root', password='', autocommit=True, charset='utf8mb4')
                break
            except pymysql.MySQLError:
                time.sleep(.2)
        assert connection is not None
        password = secrets.token_urlsafe(24)
        with connection.cursor() as cur:
            cur.execute("ALTER USER 'root'@'localhost' IDENTIFIED BY %s", (password,))
            cur.execute('CREATE DATABASE campus_shopping_review_it CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
            cur.execute('USE campus_shopping_review_it')
            cur.execute('SELECT @@transaction_isolation')
            report['isolation'] = cur.fetchone()[0]
        def connect(autocommit=True):
            return pymysql.connect(host='127.0.0.1', port=mysql_port, user='root', password=password, database='campus_shopping_review_it', autocommit=autocommit, charset='utf8mb4')
        env = os.environ.copy()
        env.update(DB_URL=f'jdbc:mysql://127.0.0.1:{mysql_port}/campus_shopping_review_it?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true', DB_USERNAME='root', DB_PASSWORD=password, DB_INIT_MODE='always', PORT=str(java_port), SESSION_COOKIE_SECURE='false', AI_SERVICE_KEY=secrets.token_urlsafe(32), AI_PRODUCT_VECTOR_SYNC_ENABLED='false', BOOTSTRAP_ADMIN='false', UPLOAD_DIR=str(temp / 'uploads'))
        log = (temp / 'java.log').open('wb')
        logs.append(log)
        process = subprocess.Popen(['java', '-jar', str(jar), '--spring.profiles.active=prod', '--server.address=127.0.0.1', '--campus.jobs.enabled=false'], cwd=temp, env=env, stdout=log, stderr=subprocess.STDOUT, creationflags=FLAGS)
        processes.append(process)
        base_url = f'http://127.0.0.1:{java_port}'
        with httpx.Client(trust_env=False, timeout=2) as client:
            for _ in range(180):
                if process.poll() is not None:
                    raise RuntimeError('隔离 Java 启动失败；请检查临时日志')
                try:
                    if client.get(base_url + '/api/v1/categories').status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(.2)
            else:
                raise TimeoutError('Java 启动超时')
        business_probes(base_url, connection, connect, record, args.expect_fixed)
        python_probes(record, temp, args.expect_fixed)
        report['status'] = target if all(p['status'] == target for p in results) else 'FAILED'
    except Exception as error:
        report['status'] = 'ERROR'
        report['errorType'] = type(error).__name__
        report['errorFrames'] = [{'file': Path(frame.filename).name, 'line': frame.lineno} for frame in traceback.extract_tb(error.__traceback__)[-3:]]
        # 不输出连接参数、密码、请求正文或下游异常正文。
        print('Probe failed: ' + type(error).__name__, flush=True)
    finally:
        for process in reversed(processes[1:]):
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=10)
        if connection is not None:
            try:
                with connection.cursor() as cur:
                    cur.execute('SHUTDOWN')
            except pymysql.MySQLError:
                pass
            connection.close()
        if processes:
            try:
                processes[0].wait(timeout=20)
            except subprocess.TimeoutExpired:
                processes[0].terminate()
                processes[0].wait(timeout=15)
        for log in logs:
            log.close()
        assert temp.parent == Path(tempfile.gettempdir()).resolve() and temp.name.startswith('campus-review-probe-')
        try:
            shutil.rmtree(temp)
            report['temporaryDatabaseCleaned'] = True
        except OSError as error:
            report['temporaryDatabaseCleaned'] = False
            report['cleanupErrorType'] = type(error).__name__
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print('Evidence: ' + str(args.output), flush=True)
    return 0 if report['status'] == target else 1


if __name__ == '__main__':
    raise SystemExit(main())
