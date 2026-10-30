#!/usr/bin/env python3
"""显式升级指定的 R1 旧库。凭据从环境读取，不加载 .env，不在应用启动时执行。"""
import argparse
import os

import pymysql

from schema_contract import apply_migrations, validate_history


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", required=True)
    parser.add_argument("--port", type=int, default=3306)
    parser.add_argument("--database", required=True)
    parser.add_argument("--check", action="store_true", help="只校验版本及校验和")
    args = parser.parse_args()
    if not os.getenv("DB_USERNAME") or not os.getenv("DB_PASSWORD"):
        parser.error("需要通过环境设置 DB_USERNAME/DB_PASSWORD")
    connection = pymysql.connect(host=args.host, port=args.port, database=args.database,
                                 user=os.environ["DB_USERNAME"], password=os.environ["DB_PASSWORD"],
                                 charset="utf8mb4", autocommit=True, connect_timeout=10)
    try:
        if args.check:
            with connection.cursor() as cursor:
                validate_history(cursor)
        else:
            apply_migrations(connection)
        print("R1 schema version/checksum validation passed")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
