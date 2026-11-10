#!/usr/bin/env python3
"""显式升级指定的 R1 旧库。凭据从环境读取，不加载 .env，不在应用启动时执行。"""
import argparse
import json
import os
from pathlib import Path

import pymysql

from schema_contract import apply_migrations, schema_fingerprint, validate_history

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", required=True)
    parser.add_argument("--port", type=int, default=3306)
    parser.add_argument("--database", required=True)
    parser.add_argument("--check", action="store_true", help="只校验版本及校验和")
    parser.add_argument("--accept-baseline", help="人工核对后接受的发布名或结构指纹")
    parser.add_argument("--reason", help="人工准入原因，必须可追溯到工单或评审")
    parser.add_argument("--operator", help="人工准入责任人")
    args = parser.parse_args()
    if args.accept_baseline and (not args.reason or not args.reason.strip() or not args.operator or not args.operator.strip()):
        parser.error("--accept-baseline 必须同时提供非空 --reason 和 --operator")
    if not args.accept_baseline and (args.reason or args.operator):
        parser.error("--reason/--operator 只能与 --accept-baseline 一起使用")
    if not os.getenv("DB_USERNAME") or not os.getenv("DB_PASSWORD"):
        parser.error("需要通过环境设置 DB_USERNAME/DB_PASSWORD")
    connection = pymysql.connect(host=args.host, port=args.port, database=args.database,
                                 user=os.environ["DB_USERNAME"], password=os.environ["DB_PASSWORD"],
                                 charset="utf8mb4", autocommit=True, connect_timeout=10)
    try:
        if args.check:
            manifest = json.loads((ROOT / "campus-shopping-app/src/main/resources/database-manifest.json").read_text("utf-8"))
            target = manifest.get("schemaFingerprint")
            with connection.cursor() as cursor:
                actual = schema_fingerprint(cursor, args.database)
                print(f"schemaFingerprint={actual}")
            if actual != target:
                raise RuntimeError(f"结构指纹不匹配：target={target}, actual={actual}")
            with connection.cursor() as cursor:
                validate_history(cursor)
        else:
            apply_migrations(connection, accept_baseline=args.accept_baseline,
                             reason=args.reason, operator=args.operator)
        print("R1 schema version/checksum validation passed")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
