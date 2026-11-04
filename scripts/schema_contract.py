"""R1 显式迁移的版本/校验和契约；应用启动只校验，不执行 DDL。"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HISTORY_TABLE = "sys_schema_migration"
HEADER = "-- BEGIN GENERATED SCHEMA PREFLIGHT"
FOOTER = "-- BEGIN GENERATED SCHEMA HISTORY"
DDL = """CREATE TABLE IF NOT EXISTS sys_schema_migration (
 version VARCHAR(32) PRIMARY KEY, checksum CHAR(64) NOT NULL,
 installed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"""


def migrations():
    entries = [{"version": path.name.split("__", 1)[0], "file": path.name,
             "sha256": hashlib.sha256(path.read_text("utf-8").encode("utf-8")).hexdigest()}
            for path in sorted((ROOT / "docs/database/migrations").glob("V*.sql"))]
    if not entries or len({entry['version'] for entry in entries}) != len(entries):
        raise ValueError('迁移目录缺失、为空或存在重复版本')
    return entries


def execute_script(cursor, content):
    # 当前版本化迁移不含存储过程、DELIMITER 或字符串内分号。
    # 新增此类语法时应换用完整 SQL 解析器，不能静默错误拆分。
    if "DELIMITER" in content.upper():
        raise ValueError("迁移包含不支持的 DELIMITER")
    sql = "\n".join(line for line in content.splitlines() if not line.lstrip().startswith("--"))
    for statement in sql.split(";"):
        if statement.strip():
            cursor.execute(statement)
            while cursor.nextset():
                pass


def validate_history(cursor, expected=None):
    expected = expected or migrations()
    cursor.execute("SELECT version,checksum FROM sys_schema_migration ORDER BY version")
    actual = dict(cursor.fetchall())
    wanted = {entry["version"]: entry["sha256"] for entry in expected}
    if actual != wanted:
        raise ValueError("数据库迁移版本或校验和不匹配，请运行显式迁移命令后再启动")


def apply_migrations(connection, expected=None):
    expected = expected or migrations()
    with connection.cursor() as cursor:
        cursor.execute("SELECT DATABASE()")
        database = cursor.fetchone()[0]
        cursor.execute("SELECT GET_LOCK(%s,30)", ("campus_schema_" + database,))
        if cursor.fetchone()[0] != 1:
            raise RuntimeError("无法获取数据库迁移锁")
        try:
            cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='iam_user'")
            if cursor.fetchone()[0] != 1:
                raise ValueError("目标库缺少 R1 基线，请先在新空库初始化 schema.sql/data.sql")
            cursor.execute(DDL)
            cursor.execute("SELECT version,checksum FROM sys_schema_migration ORDER BY version")
            actual = dict(cursor.fetchall())
            wanted = {entry["version"]: entry["sha256"] for entry in expected}
            if any(version not in wanted or checksum != wanted[version] for version, checksum in actual.items()):
                raise ValueError("已执行迁移被修改或数据库版本更新，拒绝继续迁移")
            for entry in expected:
                if entry["version"] in actual:
                    continue
                execute_script(cursor, (ROOT / "docs/database/migrations" / entry["file"]).read_text("utf-8"))
                cursor.execute("INSERT INTO sys_schema_migration(version,checksum) VALUES(%s,%s)",
                               (entry["version"], entry["sha256"]))
            validate_history(cursor, expected)
        finally:
            cursor.execute("SELECT RELEASE_LOCK(%s)", ("campus_schema_" + database,))


def generated_files():
    entries = migrations()
    schema_path = ROOT / "campus-shopping-app/src/main/resources/schema.sql"
    schema = schema_path.read_text("utf-8")
    if HEADER in schema:
        schema = schema.split("-- END GENERATED SCHEMA PREFLIGHT\n", 1)[1]
    schema = schema.split(FOOTER, 1)[0].rstrip() + "\n"
    preflight = (HEADER + "\nSET @campus_new_schema := (SELECT COUNT(*)=0 FROM information_schema.tables "
                 "WHERE table_schema=DATABASE() AND table_name='iam_user');\n-- END GENERATED SCHEMA PREFLIGHT\n")
    footer = "\n" + FOOTER + "\n" + DDL + "\n"
    # 只能为空库登记完整基线；在旧库运行 schema.sql 不能伪造已完成升级。
    for entry in entries:
        footer += ("INSERT INTO sys_schema_migration(version,checksum) SELECT '" + entry["version"] + "','" + entry["sha256"]
                   + "' WHERE @campus_new_schema=1 ON DUPLICATE KEY UPDATE version=version;\n")
    final = preflight + schema + footer
    docker = ROOT / "docs/dev-ops/mysql/sql/00_r1_schema.sql"
    prefix = docker.read_text("utf-8").split("-- R1", 1)[0]
    # Docker 历史入口保留 CREATE DATABASE/USE 前缀，完整 DDL 使用同一来源。
    if HEADER in prefix:
        prefix = prefix.split(HEADER, 1)[0]
    return {schema_path: final, docker: prefix + final,
            ROOT / "campus-shopping-app/src/main/resources/database-manifest.json": json.dumps({"schemaVersion": 1, "migrations": entries}, ensure_ascii=False, indent=2) + "\n"}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    for path, content in generated_files().items():
        if args.check:
            if not path.exists() or path.read_text("utf-8") != content:
                raise SystemExit("Schema contract drift: " + str(path.relative_to(ROOT)))
        else:
            path.write_text(content, encoding="utf-8", newline="\n")
    print("Schema version/checksum contract verified" if args.check else "Schema contract generated")
