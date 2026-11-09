#!/usr/bin/env python3
"""在全新临时 MySQL 8 实例复验升级脚本与完整 Maven；不连接现有 3306 或读取 .env。

需要本机 mysqld、Maven、JDK17、Python pymysql。仅绑定随机 loopback 端口，结束后关闭并清理。
"""
from __future__ import annotations

import argparse
import hashlib
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
import urllib.error
import urllib.request
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET
import zipfile

import pymysql
from schema_contract import (apply_migrations, validate_history, HEADER, FOOTER, schema_fingerprint,
                             migrations, SchemaAdmissionError, SchemaDriftError)

ROOT = Path(__file__).resolve().parents[1]


def tested_sources(build_root):
    """保存实际编译副本的逐文件摘要，防止共享工作区随后变化时误称已测。"""
    result = {}
    for module in build_root.glob('campus-shopping-*'):
        for path in module.rglob('*'):
            if not path.is_file() or 'target' in path.relative_to(module).parts:
                continue
            if path.name.startswith('.env'):
                continue
            relative = path.relative_to(build_root).as_posix()
            result[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    result['pom.xml'] = hashlib.sha256((build_root/'pom.xml').read_bytes()).hexdigest()
    for path in (ROOT/'ai-service/app').rglob('*.py'):
        result[path.relative_to(ROOT).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result

FLAGS = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0


def execute_script(cursor, content):
    # 这些迁移不含存储过程/DELIMITER/带分号的字符串。
    sql = '\n'.join(line for line in content.splitlines() if not line.lstrip().startswith('--'))
    for statement in sql.split(';'):
        if statement.strip():
            cursor.execute(statement)
            while cursor.nextset():
                pass


def migration_checks(connection, report):
    schema = (ROOT / 'campus-shopping-app/src/main/resources/schema.sql').read_text('utf-8')
    baseline_manifest = json.loads((ROOT / 'docs/database/baselines/manifest.json').read_text('utf-8'))
    baseline_items = baseline_manifest['baselines']
    old = (ROOT / baseline_items[0]['file']).read_text('utf-8')
    old_image = old
    with connection.cursor() as cur:
        database_specs = [('campus_shopping_it', schema), ('campus_shopping_migration_it', old),
                          ('campus_shopping_image_upgrade_it', old_image), ('campus_shopping_schema_replay_it', old)]
        for item in baseline_items[1:]:
            database_specs.append(('campus_shopping_baseline_' + item['release'].replace('-', '_'),
                                   (ROOT / item['file']).read_text('utf-8')))
        for database, contents in database_specs:
            cur.execute(f'CREATE DATABASE IF NOT EXISTS {database} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
            cur.execute(f'USE {database}')
            execute_script(cur, contents)
        target_fingerprint = schema_fingerprint(cur, 'campus_shopping_it')
        empty_db = 'campus_shopping_empty_it'
        cur.execute(f'CREATE DATABASE IF NOT EXISTS {empty_db} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
        cur.execute(f'USE {empty_db}')
        apply_migrations(connection)
        assert schema_fingerprint(cur, empty_db) == target_fingerprint, '空库初始化后结构指纹不一致'
        cur.execute('SELECT COUNT(*) FROM sys_schema_migration')
        assert cur.fetchone()[0] == len(migrations()), '空库初始化未登记完整迁移历史'
        report['checks'].append('empty database initializes the complete baseline and history')

        target_history_db = 'campus_shopping_target_history_repair_it'
        cur.execute(f'CREATE DATABASE IF NOT EXISTS {target_history_db} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
        cur.execute(f'USE {target_history_db}')
        execute_script(cur, schema)
        cur.execute('DELETE FROM sys_schema_migration')
        apply_migrations(connection)
        assert schema_fingerprint(cur, target_history_db) == target_fingerprint, '当前目标结构补历史后指纹不一致'
        cur.execute('SELECT COUNT(*) FROM sys_schema_migration')
        assert cur.fetchone()[0] == len(migrations()), '当前目标结构补历史未登记完整迁移历史'
        report['checks'].append('current target fingerprint repairs missing migration history')

        drift_db = 'campus_shopping_drift_it'
        cur.execute(f'CREATE DATABASE IF NOT EXISTS {drift_db} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
        cur.execute(f'USE {drift_db}')
        execute_script(cur, schema)
        cur.execute('DROP TABLE trd_cart_item')
        try:
            apply_migrations(connection)
        except SchemaDriftError:
            pass
        else:
            raise AssertionError('完整迁移历史下的结构漂移必须失败')
        cur.execute("SELECT COUNT(*) FROM sys_schema_migration_drift WHERE event_type='DRIFT'")
        assert cur.fetchone()[0] == 1, '结构漂移失败必须留下审计记录'
        report['checks'].append('complete history with an out-of-scope table drop is audited as drift')

        baseline_results = []
        for item in baseline_items:
            database = 'campus_shopping_baseline_' + item['release'].replace('-', '_')
            if item is baseline_items[0]:
                database = 'campus_shopping_migration_it'
            cur.execute(f'USE {database}')
            apply_migrations(connection)
            actual = schema_fingerprint(cur, database)
            assert actual == target_fingerprint, f"基线 {item['release']} 升级后结构指纹不一致"
            baseline_results.append({'release': item['release'], 'database': database, 'fingerprint': actual})
        history_repair_db = 'campus_shopping_baseline_history_repair_it'
        history_repair_item = next(item for item in baseline_items if item['release'] == 'pre-redis-7bd21e2')
        cur.execute(f'CREATE DATABASE IF NOT EXISTS {history_repair_db} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
        cur.execute(f'USE {history_repair_db}')
        execute_script(cur, (ROOT / history_repair_item['file']).read_text('utf-8'))
        cur.execute('DELETE FROM sys_schema_migration')
        apply_migrations(connection)
        assert schema_fingerprint(cur, history_repair_db) == target_fingerprint, '已发布基线补历史后结构指纹不一致'
        report['checks'].append('released baseline with missing history is repaired before remaining migrations')
        report['baselineReplays'] = baseline_results
        for name, missing_table in [('campus_shopping_missing_cart_it', 'trd_cart_item'),
                                    ('campus_shopping_missing_pickup_it', 'ful_pickup_task')]:
            cur.execute(f'CREATE DATABASE IF NOT EXISTS {name} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
            cur.execute(f'USE {name}')
            execute_script(cur, old)
            cur.execute(f'DROP TABLE {missing_table}')
            try:
                apply_migrations(connection)
            except SchemaAdmissionError:
                pass
            else:
                raise AssertionError(f'{missing_table} 缺失时必须在任何 DDL 前拒绝')
            cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() "
                        "AND table_name='sys_schema_migration'")
            assert cur.fetchone()[0] == 0, '准入拒绝不得创建迁移历史表'
        accept_db = 'campus_shopping_accept_it'
        cur.execute(f'CREATE DATABASE IF NOT EXISTS {accept_db} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
        cur.execute(f'USE {accept_db}')
        accept_item = next(item for item in baseline_items if item['release'] == 'pre-redis-7bd21e2')
        execute_script(cur, (ROOT / accept_item['file']).read_text('utf-8'))
        cur.execute("DELETE FROM sys_schema_migration WHERE version='V20261030_01'")
        apply_migrations(connection, accept_baseline=accept_item['release'],
                         reason='验证已发布基线的历史登记修复路径', operator='isolated-verifier')
        cur.execute("SELECT event_type,operator_name FROM sys_schema_migration_drift WHERE event_type='BASELINE_ACCEPTED'")
        assert cur.fetchone() == ('BASELINE_ACCEPTED', 'isolated-verifier')
        assert schema_fingerprint(cur, accept_db) == target_fingerprint
        report['checks'].append('incomplete baselines reject before DDL and explicit audited admission completes')
        # 真正缺少多图表的旧库先执行完整版本迁移，再确认主图回填、重放与历史不变。
        cur.execute('USE campus_shopping_image_upgrade_it')
        cur.execute(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() "
            "AND table_name IN ('cat_product_image','cat_product_image_upload')"
        )
        assert cur.fetchone()[0] == 0, '旧库夹具不得预先包含图片表'
        first = '/media/11111111-1111-1111-1111-111111111111.png'
        cur.execute("INSERT INTO cat_product(id,merchant_id,store_id,title,description,image_url,category_code,status,version) "
                    "VALUES('historic-image-product','historic-merchant','historic-store','历史商品','',%s,'stationery','PUBLISHED',0)", (first,))
        cur.execute("INSERT INTO cat_product(id,merchant_id,store_id,title,description,image_url,category_code,status,version) "
                    "VALUES('historic-empty-product','historic-merchant','historic-store','无图商品','','','stationery','PUBLISHED',0)")
        apply_migrations(connection)
        cur.execute("SELECT product_id,url,object_key,sort_order FROM cat_product_image ORDER BY product_id,sort_order")
        assert cur.fetchall() == (('historic-image-product', first, first[len('/media/'):], 0),), '历史主图回填不正确'
        # 归属表必须由本次迁移真实创建，且历史主图有可认领的商户归属行。
        cur.execute(
            "SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() "
            "AND TABLE_NAME='cat_product_image_upload' AND INDEX_NAME='PRIMARY' ORDER BY SEQ_IN_INDEX"
        )
        assert cur.fetchall() == (('object_key',), ('merchant_id',)), '图片归属表主键应为（对象,商户）'
        cur.execute(
            "SELECT COUNT(*) FROM cat_product_image_upload WHERE object_key=%s AND merchant_id='historic-merchant'",
            (first[len('/media/'):],),
        )
        assert cur.fetchone()[0] == 1, '历史主图应回填商户归属行'
        cur.execute('SELECT version,checksum,installed_at FROM sys_schema_migration ORDER BY version')
        history = cur.fetchall()
        apply_migrations(connection)
        cur.execute('SELECT version,checksum,installed_at FROM sys_schema_migration ORDER BY version')
        assert cur.fetchall() == history, '重复升级不得修改迁移历史'
        image_migrations = list((ROOT/'docs/database/migrations').glob('V*__product_images.sql'))
        assert len(image_migrations) == 1, '商品多图迁移必须唯一'
        for _ in range(2):
            execute_script(cur, image_migrations[0].read_text('utf-8'))
        cur.execute('SELECT COUNT(*) FROM cat_product_image')
        assert cur.fetchone()[0] == 1, '重复执行迁移不得重复回填图片'
        assert schema_fingerprint(cur, 'campus_shopping_it') == schema_fingerprint(cur, 'campus_shopping_image_upgrade_it'), '多图升级库应与新库结构一致'
        report['checks'].append('old database without image table upgrades, backfills once, and preserves migration history')
        # 在旧库误跑新 schema 也不能把缺失的 ALTER 标记成已完成。
        cur.execute('USE campus_shopping_schema_replay_it')
        execute_script(cur, schema)
        cur.execute('SELECT COUNT(*) FROM sys_schema_migration')
        assert cur.fetchone()[0] == 0, '旧库不得因重放 schema.sql 伪造迁移记录'
        report['checks'].append('replaying fresh schema on existing tables does not register unapplied upgrades')
        cur.execute('USE campus_shopping_migration_it')
        cur.execute("CREATE DATABASE IF NOT EXISTS campus_shopping_dirty_it CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci")
        cur.execute("USE campus_shopping_dirty_it")
        execute_script(cur, old)
        cur.execute("INSERT INTO trd_order_item(order_id,sku_id,title,spec_key,unit_price_cent,quantity) "
                    "VALUES('invalid-order','historic-sku','历史商品','原规格',1200,0)")
        cur.execute("USE campus_shopping_migration_it")
        cur.execute("INSERT INTO trd_order_item(order_id,sku_id,title,spec_key,unit_price_cent,quantity) "
                    "VALUES('historic-order','historic-sku','历史商品','原规格',1200,2)")
        cur.execute("INSERT INTO ai_document(id,root_id,base_id,version,title,status,index_status,content) "
                    "VALUES('historic-document','historic-root','historic-base',1,'历史知识','PUBLISHED','READY','保留正文')")
        cur.execute("INSERT INTO ai_conversation(id,user_id,title) VALUES('historic-conversation','historic-user','历史会话')")
        cur.execute("INSERT INTO ai_message(id,conversation_id,role,content) "
                    "VALUES('historic-message','historic-conversation','assistant','历史回答')")
        migration_contents = [p.read_text('utf-8') for p in sorted((ROOT/'docs/database/migrations').glob('V*.sql'))]
        cur.execute("USE campus_shopping_dirty_it")
        try:
            apply_migrations(connection)
        except pymysql.MySQLError as error:
            assert error.args[0] == 3819, error
        else:
            raise AssertionError('非法历史金额没有阻止 CHECK 升级')
        cur.execute("SELECT quantity FROM trd_order_item WHERE order_id='invalid-order'")
        assert cur.fetchone() == (0,), '迁移不得自动更改脏数据'
        report['checks'].append('dirty historical quantity stops migration without changing the row')
        cur.execute("USE campus_shopping_migration_it")
        for _ in range(2):
            for migration in migration_contents:
                execute_script(cur, migration)
        cur.execute("SELECT title,unit_price_cent,quantity,image_url FROM trd_order_item WHERE order_id='historic-order'")
        assert cur.fetchone() == ('历史商品', 1200, 2, '')
        cur.execute("SELECT status,index_status,content,index_attempt FROM ai_document WHERE id='historic-document'")
        assert cur.fetchone() == ('PUBLISHED', 'READY', '保留正文', None)
        cur.execute("SELECT user_id,title,turn_token,turn_expires_at FROM ai_conversation WHERE id='historic-conversation'")
        assert cur.fetchone() == ('historic-user', '历史会话', None, None)
        cur.execute("SELECT role,content FROM ai_message WHERE id='historic-message'")
        assert cur.fetchone() == ('assistant', '历史回答')
        assert schema_fingerprint(cur, 'campus_shopping_it') == schema_fingerprint(cur, 'campus_shopping_migration_it'), \
            '升级后字段、索引、CHECK 必须与全新库一致'
        report['checks'].extend(['all migrations replay twice and preserve historical snapshot',
                                 'AI attempt and lease columns added to old schema without changing published knowledge or conversation history',
                                 'fresh and upgraded database columns/indexes/constraints match'])
        validate_history(cur)
        cur.execute("UPDATE sys_schema_migration SET checksum=REPEAT('0',64) WHERE version='V20261028_01'")
        try:
            apply_migrations(connection)
        except ValueError:
            pass
        else:
            raise AssertionError('被修改的历史迁移校验和未阻止升级')
        from schema_contract import migrations as expected_migrations
        first = expected_migrations()[0]
        cur.execute('UPDATE sys_schema_migration SET checksum=%s WHERE version=%s', (first['sha256'], first['version']))
        report['checks'].append('recorded migration checksum mismatch rejected before executing DDL')
        bad_inserts = [
            "INSERT INTO trd_order_item(order_id,sku_id,title,spec_key,unit_price_cent,quantity) VALUES('bad','s','t','s',1,0)",
            "INSERT INTO trd_order_item(order_id,sku_id,title,spec_key,unit_price_cent,quantity) VALUES('bad','s','t','s',0,1)",
            "INSERT INTO trd_order_item(order_id,sku_id,title,spec_key,unit_price_cent,quantity) VALUES('bad','s','t','s',1,100)",
            "INSERT INTO trd_payment(order_id,amount_cent,status) VALUES('bad',0,'PAID')",
            "INSERT INTO trd_refund(order_id,amount_cent) VALUES('bad',-1)",
        ]
        for statement in bad_inserts:
            try:
                cur.execute(statement)
            except pymysql.MySQLError as error:
                assert error.args[0] == 3819, error
            else:
                raise AssertionError('数据库接受了非法金额/数量')
        report['checks'].append('five invalid amount/quantity writes rejected by real MySQL CHECK')
        cur.execute('SELECT VERSION()')
        report['mysqlVersion'] = cur.fetchone()[0]


def test_totals(build_root):
    suites = []
    for file in sorted(build_root.glob('campus-shopping-*/target/surefire-reports/TEST-*.xml')):
        xml = ET.parse(file).getroot()
        suites.append({'name': xml.get('name'), **{k: int(xml.get(k, 0))
                      for k in ('tests', 'failures', 'errors', 'skipped')}})
    return {'suites': suites, **{k: sum(s[k] for s in suites)
                                for k in ('tests', 'failures', 'errors', 'skipped')}}


def free_port():
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        return probe.getsockname()[1]


def wait_http(process, url):
    for _ in range(120):
        if process.poll() is not None:
            raise RuntimeError('临时 HTTP 服务提前退出')
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.5)
    raise TimeoutError('临时 HTTP 服务启动超时')


def http_smoke(args, workspace, build_root, connection, env, report):
    ai_port, java_port = free_port(), free_port()
    service_key = secrets.token_urlsafe(32)
    env = env.copy()
    for name in ('QDRANT_URL', 'QDRANT_API_KEY', 'EMBEDDING_BASE_URL', 'EMBEDDING_API_KEY', 'EMBEDDING_MODEL',
                 'LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL', 'MILVUS_URI', 'MILVUS_TOKEN'):
        env[name] = ''
    env.update(AI_SERVICE_KEY=service_key, AI_DB_PATH=str(workspace/'knowledge.sqlite3'),
               AI_SERVICE_URL=f'http://127.0.0.1:{ai_port}', AI_PRODUCT_VECTOR_SYNC_ENABLED='false',
               DB_URL=env['MYSQL_TEST_URL'].replace('/campus_shopping_it?', '/campus_shopping_http_it?'),
               DB_USERNAME=env['MYSQL_TEST_USERNAME'], DB_PASSWORD=env['MYSQL_TEST_PASSWORD'],
               DB_INIT_MODE='always', PORT=str(java_port), BOOTSTRAP_ADMIN='true',
               ADMIN_USERNAME='audit_admin', ADMIN_PASSWORD=secrets.token_urlsafe(32), SESSION_COOKIE_SECURE='false',
               CAMPUS_JOBS_ENABLED='false', CAMPUS_SECURITY_RATE_LIMIT_ENABLED='false',
               UPLOAD_DIR=str(workspace/'uploads'))
    if env.get('REDIS_TEST_ADDRESS'):
        env.update(REDIS_ENABLED='true',REDIS_SECURITY_ADDRESS=env['REDIS_TEST_ADDRESS'],REDIS_CACHE_ADDRESS=env['REDIS_TEST_CACHE_ADDRESS'],
                   REDIS_SECURITY_PASSWORD=env.get('REDIS_TEST_PASSWORD',''),REDIS_CACHE_PASSWORD=env.get('REDIS_TEST_PASSWORD',''),
                   REDIS_NAMESPACE='cs:test:http:'+secrets.token_hex(12), CAMPUS_SECURITY_RATE_LIMIT_ENABLED='true')
        report['redisNamespace'] = env['REDIS_NAMESPACE']
    with connection.cursor() as cur:
        cur.execute('CREATE DATABASE campus_shopping_http_it CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
    processes, logs = [], []
    try:
        print('Starting isolated real Spring/MySQL/FastAPI HTTP chain (local retrieval, no remote models)', flush=True)
        for command, cwd, url, name in [
            ([sys.executable, '-X', 'utf8', '-m', 'uvicorn', 'app.main:create_app', '--factory', '--host',
              '127.0.0.1', '--port', str(ai_port)], ROOT/'ai-service', f'http://127.0.0.1:{ai_port}/health', 'ai'),
            ([shutil.which('java') or 'java', '-jar', str(build_root/'campus-shopping-app/target/campus-shopping-app.jar'),
              '--spring.profiles.active=dev'], build_root, f'http://127.0.0.1:{java_port}/api/v1/categories', 'java'),
        ]:
            log = (workspace/(name+'-http.log')).open('wb')
            logs.append(log)
            process = subprocess.Popen(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, creationflags=FLAGS)
            processes.append(process)
            wait_http(process, url)
        for _ in range(30):
            with connection.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM campus_shopping_http_it.iam_platform_role")
                if cur.fetchone()[0] == 1:
                    break
            time.sleep(0.2)
        base = f'http://127.0.0.1:{java_port}'
        output = args.output.parent/'full-http.json'
        completed = subprocess.run([sys.executable, '-X', 'utf8', '-B', str(ROOT/'scripts/smoke-full.py'),
                                   '--base-url', base, '--env-file', str(workspace/'absent.env'), '--output', str(output), '--check-contract'],
                                  cwd=ROOT, env=env, creationflags=FLAGS, timeout=240)
        http = json.loads(output.read_text('utf-8'))
        report['http'] = {'status': http['status'], 'checks': len(http['checks']),
                          'externalModel': False, 'retrieval': 'LOCAL_RETRIEVAL_DEMO',
                          'contractValidation': http.get('contractValidation')}
        assert completed.returncode == 0 and http['status'] == 'PASS', '真实 HTTP 验收失败'
        if env.get('REDIS_TEST_ADDRESS'):
            secondary_port = free_port()
            secondary_log = (workspace/'java-secondary-http.log').open('wb')
            logs.append(secondary_log)
            secondary = subprocess.Popen(
                [shutil.which('java') or 'java', '-jar', str(build_root/'campus-shopping-app/target/campus-shopping-app.jar'),
                 '--spring.profiles.active=dev', '--server.port='+str(secondary_port),
                 '--spring.sql.init.mode=never', '--campus.bootstrap.enabled=false'],
                cwd=build_root, env=env, stdout=secondary_log, stderr=subprocess.STDOUT, creationflags=FLAGS)
            processes.append(secondary)
            secondary_base = f'http://127.0.0.1:{secondary_port}'
            wait_http(secondary, secondary_base+'/api/v1/categories')
            shared_output = args.output.parent/'redis-shared-http.json'
            completed = subprocess.run(
                [sys.executable, '-X', 'utf8', '-B', str(ROOT/'scripts/smoke-redis-shared.py'),
                 '--base-url', base, '--secondary-base-url', secondary_base,
                 '--env-file', str(workspace/'absent.env'), '--output', str(shared_output)],
                cwd=ROOT, env=env, creationflags=FLAGS, timeout=180)
            shared = json.loads(shared_output.read_text('utf-8'))
            report['redisSharedHttp'] = {'status': shared['status'], 'checks': len(shared['checks']),
                                        'quotaAttempts': len(shared.get('quotaAttempts', [])), 'database': 'ISOLATED_MYSQL'}
            assert completed.returncode == 0 and shared['status'] == 'PASS', 'Redis 双实例真实 HTTP 验收失败'
        # 将既有浏览器入口复制到无 .env 的临时项目，隔离凭据读取和证据输出目录。
        live = build_root/'frontend/tests/live_ui.py'
        live.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT/'frontend/tests/live_ui.py', live)
        completed = subprocess.run([sys.executable, '-X', 'utf8', '-B', str(live), '--base-url', base],
                                   cwd=build_root, env=env, creationflags=FLAGS, timeout=150)
        source = build_root/'docs/testing/evidence/frontend-live'
        if source.exists():
            shutil.copytree(source, args.output.parent/'frontend-live', dirs_exist_ok=True)
        browser = json.loads((source/'results.json').read_text('utf-8'))
        report['browser'] = {'status': browser['status'], 'checks': len(browser['checks']), 'apiMockUsed': False}
        assert completed.returncode == 0 and browser['status'] == 'PASS', '真实浏览器验收失败'
    finally:
        for process in reversed(processes):
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=10)
        for log in logs:
            log.close()
        # 只保存服务访问/启动日志，日志不含密钥或请求正文，便于保留真实联调失败现场。
        for name in ('ai-http.log', 'java-http.log', 'java-secondary-http.log'):
            source = workspace/name
            if source.exists():
                shutil.copy2(source, args.output.parent/Path(name).with_suffix('.txt'))


def run(args, report):
    server = Path(args.mysql_bin).resolve() / ('mysqld.exe' if os.name == 'nt' else 'mysqld')
    if not server.is_file():
        raise FileNotFoundError('请使用 --mysql-bin 指定 mysqld 所在目录')
    temp_parent = Path(tempfile.gettempdir()).resolve()
    workspace = Path(tempfile.mkdtemp(prefix='campus-audit-mysql-', dir=temp_parent)).resolve()
    assert workspace.parent == temp_parent and workspace.name.startswith('campus-audit-mysql-')
    data = workspace/'data'
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    base = [str(server), '--no-defaults', '--basedir='+str(server.parent.parent), '--datadir='+str(data)]
    process = None
    connection = None
    maven_log = None
    try:
        print('Initializing a new temporary MySQL data directory (existing databases are unused)', flush=True)
        subprocess.run(base + ['--initialize-insecure', '--log-error='+str(workspace/'mysql.log')],
                       check=True, creationflags=FLAGS, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
        process = subprocess.Popen(base + ['--port='+str(port), '--bind-address=127.0.0.1', '--mysqlx=OFF',
                                    '--skip-log-bin', '--log-error='+str(workspace/'mysql.log')],
                                   creationflags=FLAGS, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(90):
            if process.poll() is not None:
                raise RuntimeError('临时 MySQL 启动失败：'+(workspace/'mysql.log').read_text('utf-8', errors='replace')[-1800:])
            try:
                connection = pymysql.connect(host='127.0.0.1', port=port, user='root', password='',
                                             charset='utf8mb4', autocommit=True, connect_timeout=1)
                break
            except pymysql.MySQLError:
                time.sleep(0.5)
        if connection is None:
            raise TimeoutError('临时 MySQL 启动超时')
        password = secrets.token_urlsafe(32)
        with connection.cursor() as cur:
            cur.execute("ALTER USER 'root'@'localhost' IDENTIFIED BY %s", (password,))
        print('Verifying upgrade, replay, dirty-data rejection and schema equivalence', flush=True)
        migration_checks(connection, report)
        if not args.skip_maven:
            # 当前项目可能有正在运行并锁住 JAR 的进程；复制本次源码到临时构建目录。
            # 不停止已有服务、不清理共享 target，也不把 .env 或本地运行数据带入测试。
            build_root = workspace/'build'
            build_root.mkdir()
            shutil.copy2(ROOT/'pom.xml', build_root/'pom.xml')
            for name in ('ai-service', 'frontend', 'scripts', '.mvn'):
                shutil.copytree(ROOT/name, build_root/name,
                                ignore=shutil.ignore_patterns('node_modules', 'dist', '__pycache__', 'target'))
            for name in ('mvnw', 'mvnw.cmd'):
                shutil.copy2(ROOT/name, build_root/name)
            for name in ('database', 'dev-ops/mysql/sql'):
                shutil.copytree(ROOT/'docs'/name, build_root/'docs'/name)
            for module in ET.parse(ROOT/'pom.xml').getroot().findall('{*}modules/{*}module'):
                name = module.text.strip()
                shutil.copytree(ROOT/name, build_root/name,
                                ignore=shutil.ignore_patterns('target', '.git', '.env', 'var', '__pycache__'))
            source_hashes = tested_sources(build_root)
            args.output.parent.mkdir(parents=True, exist_ok=True)
            (args.output.parent/'tested-sources.json').write_text(
                json.dumps(source_hashes, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
            env = os.environ.copy()
            redis_test_address = env.get('REDIS_TEST_ADDRESS', '').strip()
            for name in ('REDIS_ENABLED', 'REDIS_SECURITY_ADDRESS', 'REDIS_SECURITY_PASSWORD',
                         'REDIS_CACHE_ADDRESS', 'REDIS_CACHE_PASSWORD', 'REDIS_NAMESPACE'):
                env.pop(name, None)
            env['REDIS_ENABLED'] = 'false'
            if redis_test_address:
                cache_test_address = env.get('REDIS_TEST_CACHE_ADDRESS', '').strip()
                if not cache_test_address or cache_test_address == redis_test_address:
                    raise ValueError('Redis 验收必须显式配置独立测试实例 REDIS_TEST_CACHE_ADDRESS')
                cache_parsed = urlsplit(cache_test_address)
                if (cache_parsed.scheme not in ('redis', 'rediss') or cache_parsed.hostname not in ('127.0.0.1', 'localhost', '::1')
                        or cache_parsed.username or cache_parsed.password):
                    raise ValueError('REDIS_TEST_CACHE_ADDRESS 必须为本机测试专用 Redis，URI 不得内嵌凭据')
                parsed = urlsplit(redis_test_address)
                if (parsed.scheme not in ('redis', 'rediss') or parsed.hostname not in ('127.0.0.1', 'localhost', '::1')
                        or parsed.username or parsed.password):
                    raise ValueError('REDIS_TEST_ADDRESS 仅允许显式配置本机测试专用 Redis，URI 不得内嵌凭据')
                env.update(REDIS_ENABLED='true', REDIS_SECURITY_ADDRESS=redis_test_address,
                           REDIS_CACHE_ADDRESS=cache_test_address,
                           REDIS_SECURITY_PASSWORD=env.get('REDIS_TEST_PASSWORD', ''),
                           REDIS_CACHE_PASSWORD=env.get('REDIS_TEST_PASSWORD', ''),
                           REDIS_NAMESPACE='cs:test:maven:'+secrets.token_hex(12))
            # 评测只使用冻结合成数据，计划与输出留在本次临时环境/指定证据目录。
            evaluation_input = args.evaluation_input.resolve() if args.evaluation_input else workspace/'shopping-evaluation-input.json'
            if not args.evaluation_input:
                subprocess.run([sys.executable, '-X', 'utf8', str(ROOT/'ai-service/evaluate.py'),
                            '--dataset', 'campus-shopping-v1', '--split', 'smoke', '--profile', 'controlled',
                            '--experiments', 'P-L,P-D,P-H,P-H-R,P-TERMS', '--prepare-java-input', str(evaluation_input)],
                               cwd=ROOT, check=True)
            env.update(EVALUATION_INPUT_PATH=str(evaluation_input),
                       EVALUATION_OUTPUT_PATH=str(args.output.parent.resolve()/'evaluation-java.json'),
                       EVALUATION_SAFETY_OUTPUT=str(args.output.parent.resolve()/'evaluation-safety'))
            env.update(MYSQL_TEST_URL=f'jdbc:mysql://127.0.0.1:{port}/campus_shopping_it?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=utf8',
                       MYSQL_TEST_USERNAME='root', MYSQL_TEST_PASSWORD=password)
            maven = str(build_root/('mvnw.cmd' if os.name == 'nt' else 'mvnw')) if Path(args.maven).name in ('mvnw', 'mvnw.cmd') else args.maven
            command = [maven, '-B', '-ntp'] + (['-o'] if args.offline else []) + ['clean', 'verify']
            print('Running full Maven clean verify with all MySQL integration tests enabled', flush=True)
            with tempfile.NamedTemporaryFile(prefix='campus-audit-maven-', suffix='.log', delete=False) as output:
                maven_log = Path(output.name)
                completed = subprocess.run(command, cwd=build_root, env=env, stdout=output, stderr=subprocess.STDOUT,
                                           creationflags=FLAGS, timeout=600)
            report['mavenExitCode'] = completed.returncode
            report['buildSource'] = 'current source copied to isolated temporary Maven reactor (no .env/target)'
            report['junit'] = test_totals(build_root)
            print(maven_log.read_text('utf-8', errors='replace')[-6500:], flush=True)
            print('Maven log: '+str(maven_log), flush=True)
            assert completed.returncode == 0, 'Maven 构建或测试失败'
            assert report['junit']['tests'] > 70 and report['junit']['skipped'] == 0, 'MySQL 测试不得跳过'
            with zipfile.ZipFile(build_root/'campus-shopping-app/target/campus-shopping-app.jar') as archive:
                ui = build_root/'campus-shopping-app/target/generated-ui'
                for file in ui.rglob('*'):
                    if file.is_file():
                        path = 'BOOT-INF/classes/static/'+file.relative_to(ui).as_posix()
                        assert archive.read(path) == file.read_bytes(), 'JAR 中 UI 与本次构建不一致：'+path
            report['checks'].append('packaged JAR UI files exactly match this source build')
            subprocess.run([sys.executable, '-B', str(build_root/'scripts/generate-release-manifest.py'),
                            '--require-full-tests'], cwd=build_root, env=env, check=True)
            # 保留本轮真正测试过的交付物，不覆盖正在运行的项目 target/JAR。
            delivery = args.artifact_dir.resolve() if args.artifact_dir else ROOT/'var/engineering/verified-build'
            delivery.mkdir(parents=True, exist_ok=True)
            for name in ('campus-shopping-app.jar', 'release-manifest.json', 'build-source.json'):
                source = build_root/'campus-shopping-app/target'/name
                if source.is_file():shutil.copy2(source, delivery/name)
            shutil.copy2(build_root/'campus-shopping-app/target/release-manifest.json', args.output.parent/'tested-release-manifest.json')
            for module in build_root.glob('campus-shopping-*'):
                source = module/'target/surefire-reports'
                if source.is_dir():shutil.copytree(source, delivery/module.name/'surefire-reports', dirs_exist_ok=True)
            report['deliveryArtifacts'] = str(delivery.relative_to(ROOT))+' (isolated tested JAR and generated manifest)'
            if args.http_smoke:
                http_smoke(args, workspace, build_root, connection, env, report)
            changed = [name for name, checksum in source_hashes.items()
                       if not (ROOT/name).is_file() or hashlib.sha256((ROOT/name).read_bytes()).hexdigest() != checksum]
            report['testedSourceSnapshot'] = 'tested-sources.json'
            report['testedSourceFiles'] = len(source_hashes)
            report['testedSourceMatchesCheckout'] = not changed
            report['sourceChangedDuringTest'] = changed
            assert not changed, '验收期间源码改变，需按最终源码复验：'+str(changed)
        else:
            report['maven'] = 'NOT_RUN (--skip-maven)'
        report['status'] = 'PASS'
    finally:
        if connection is not None:
            try:
                with connection.cursor() as cur:
                    cur.execute('SHUTDOWN')
            except pymysql.MySQLError:
                pass
            connection.close()
        if process is not None:
            try:
                process.wait(timeout=20)
            except subprocess.TimeoutExpired:
                process.terminate()
                process.wait(timeout=15)
        # 只删除已核实位于 TEMP 内、本脚本创建的专属目录。
        assert workspace.parent == temp_parent and workspace.name.startswith('campus-audit-mysql-')
        shutil.rmtree(workspace)
        report['temporaryDatabaseCleaned'] = True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mysql-bin', required=True)
    parser.add_argument('--maven', default=shutil.which('mvn') or 'mvn')
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--skip-maven', action='store_true')
    parser.add_argument('--http-smoke', action='store_true', help='额外启动隔离 Java/FastAPI 并执行真实 HTTP 与浏览器验收')
    parser.add_argument('--output', type=Path, default=ROOT/'docs/testing/evidence/audit-20261029/mysql.json')
    parser.add_argument('--artifact-dir', type=Path, help='隔离已测 JAR/清单的保留目录，默认 var/engineering/verified-build')
    parser.add_argument('--evaluation-input', type=Path, help='本次已生成的合成Java评测计划；默认controlled smoke')
    args = parser.parse_args()
    if args.skip_maven and args.http_smoke:
        parser.error('--http-smoke 需要完整 Maven 构建')
    report = {'status': 'FAIL', 'checks': [], 'existingDatabaseUsed': False}
    try:
        run(args, report)
    except Exception as error:
        report['failure'] = str(error)
        raise
    finally:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        print('Evidence: '+str(args.output), flush=True)


if __name__ == '__main__':
    main()
