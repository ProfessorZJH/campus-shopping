#!/usr/bin/env python3
"""仅在 CI 专用 MySQL 实例创建两个固定 _it 库，复验旧库升级/重跑/脏数据与校验和。"""
import argparse
import importlib.util
import json
import os
from pathlib import Path

import pymysql


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=3307)
    parser.add_argument('--output', type=Path, default=Path('docs/testing/evidence/engineering/migrations.json'))
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('isolated_verification', Path(__file__).with_name('verify-mysql-isolated.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    report = {'status': 'FAIL', 'checks': [], 'existingDatabaseUsed': False}
    connection = pymysql.connect(host=args.host, port=args.port, user=os.environ['MYSQL_TEST_USERNAME'],
                                 password=os.environ['MYSQL_TEST_PASSWORD'], charset='utf8mb4', autocommit=True)
    try:
        # 此入口只允许空的隔离实例；不覆盖已有 _it 库。
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('campus_shopping_it','campus_shopping_migration_it')")
            if cursor.fetchone()[0]:
                raise ValueError('迁移验证实例必须为空，拒绝覆盖已有表')
        module.migration_checks(connection, report)
        report['status'] = 'PASS'
    finally:
        connection.close()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


if __name__ == '__main__':main()
