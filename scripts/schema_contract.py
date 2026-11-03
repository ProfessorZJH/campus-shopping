"""R1 显式迁移的版本/校验和契约；应用启动只校验，不执行 DDL。"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HISTORY_TABLE = "sys_schema_migration"
HEADER = "-- BEGIN GENERATED SCHEMA PREFLIGHT"
FOOTER = "-- BEGIN GENERATED SCHEMA HISTORY"
CORE_BASELINE_TABLES = (
    "iam_user", "iam_platform_role", "iam_merchant_membership", "iam_invitation", "sys_audit",
    "mer_application", "mer_merchant", "mer_store", "cat_category", "cat_product", "cat_sku",
    "inv_stock_balance", "inv_reservation", "inv_stock_movement", "trd_cart_item", "trd_checkout_request",
    "trd_order", "trd_order_item", "trd_payment", "trd_after_sale", "trd_refund", "ful_pickup_task",
    "ful_pickup_verification", "ai_knowledge_base", "ai_knowledge_quota", "ai_document_root",
    "ai_knowledge_usage", "ai_document", "ai_conversation", "ai_message", "ai_proposal",
    "sys_schema_version", "trd_cart_owner", "iam_merchant_role", "iam_merchant_role_permission",
    "ai_sync_checkpoint",
)
R1_BASELINE_TABLES = CORE_BASELINE_TABLES[:31]
DDL = """CREATE TABLE IF NOT EXISTS sys_schema_migration (
 version VARCHAR(32) PRIMARY KEY, checksum CHAR(64) NOT NULL,
 installed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"""

INDEX_CONTRACTS = {
    # (唯一性, ((列名, 排序方向), ...))；MySQL 的 COLLATION 为 A(升序)/D(降序)。
    ("iam_merchant_membership", "ix_member_role"): (False, (("merchant_id", "A"), ("role", "A"), ("status", "A"))),
    ("mer_application", "ix_app_applicant"): (False, (("applicant_user_id", "A"), ("create_time", "D"), ("application_id", "A"))),
    ("inv_stock_balance", "ix_stock_sku"): (False, (("sku_id", "A"),)),
    ("inv_stock_movement", "ix_movement_merchant"): (False, (("merchant_id", "A"), ("created_at", "D"), ("id", "A"))),
    ("ai_document", "ix_document_base"): (False, (("base_id", "A"), ("created_at", "D"), ("id", "A"))),
    ("ai_message", "ix_message_sequence"): (False, (("conversation_id", "A"), ("seq_no", "A"))),
    ("ai_proposal", "ix_proposal_conversation"): (False, (("user_id", "A"), ("conversation_id", "A"), ("created_at", "D"), ("id", "A"))),
    ("inv_stock_balance", "uk_stock_sku"): (True, (("sku_id", "A"),)),
    ("cat_product", "ix_product_merchant_newest"): (False, (("merchant_id", "A"), ("status", "A"), ("created_at", "D"), ("id", "A"))),
    ("cat_product", "ix_product_public_newest"): (False, (("status", "A"), ("created_at", "D"), ("id", "A"), ("merchant_id", "A"))),
    ("trd_order", "ix_order_buyer_page"): (False, (("buyer_id", "A"), ("status", "A"), ("created_at", "D"), ("id", "A"))),
    ("trd_order", "ix_order_merchant_page"): (False, (("merchant_id", "A"), ("status", "A"), ("created_at", "D"), ("id", "A"))),
    ("trd_after_sale", "ix_after_sale_merchant_page"): (False, (("merchant_id", "A"), ("status", "A"), ("created_at", "D"), ("id", "A"))),
    ("inv_stock_balance", "ix_stock_merchant_sku"): (False, (("merchant_id", "A"), ("sku_id", "A"))),
    ("ai_knowledge_base", "ix_knowledge_base_created"): (False, (("created_at", "D"), ("id", "A"))),
    ("ai_document_root", "ix_document_root_active"): (False, (("active_document_id", "A"),)),
}

CHECK_CONTRACTS = {
    ("trd_order_item", "ck_order_item_values"): "unit_price_cent > 0 AND quantity BETWEEN 1 AND 99",
    ("trd_payment", "ck_payment_amount"): "amount_cent > 0",
    ("trd_refund", "ck_refund_amount"): "amount_cent > 0",
}


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
    validate_structure(cursor)


def validate_structure(cursor):
    for (table, index), (unique, columns) in INDEX_CONTRACTS.items():
        cursor.execute(
            "SELECT NON_UNIQUE,COLUMN_NAME,SEQ_IN_INDEX,COLLATION FROM information_schema.STATISTICS "
            "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s AND INDEX_NAME=%s ORDER BY SEQ_IN_INDEX",
            (table, index),
        )
        rows = cursor.fetchall()
        if not rows or bool(rows[0][0] == 0) != unique or tuple((row[1], row[3] or "A") for row in rows) != columns:
            raise ValueError(f"数据库索引定义不匹配：{table}.{index}")
    for (table, name), wanted in CHECK_CONTRACTS.items():
        cursor.execute(
            "SELECT cc.CHECK_CLAUSE,tc.ENFORCED FROM information_schema.CHECK_CONSTRAINTS cc "
            "JOIN information_schema.TABLE_CONSTRAINTS tc ON tc.CONSTRAINT_SCHEMA=cc.CONSTRAINT_SCHEMA "
            "AND tc.CONSTRAINT_NAME=cc.CONSTRAINT_NAME "
            "WHERE cc.CONSTRAINT_SCHEMA=DATABASE() AND tc.TABLE_NAME=%s AND cc.CONSTRAINT_NAME=%s",
            (table, name),
        )
        row = cursor.fetchone()
        normalize = lambda value: re.sub(r"[\s()`]", "", str(value)).lower()
        actual = normalize(row[0]) if row else ""
        if actual != normalize(wanted) or not row or str(row[1]).upper() != "YES":
            raise ValueError(f"数据库 CHECK 定义不匹配：{table}.{name}")


def validate_existing_structures(cursor):
    """在任何待执行 DDL 前拒绝同名但定义错误的结构，避免留下部分迁移结果。"""
    for (table, index), (unique, columns) in INDEX_CONTRACTS.items():
        cursor.execute(
            "SELECT NON_UNIQUE,COLUMN_NAME,COLLATION FROM information_schema.STATISTICS "
            "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s AND INDEX_NAME=%s ORDER BY SEQ_IN_INDEX",
            (table, index),
        )
        rows = cursor.fetchall()
        if rows and (bool(rows[0][0] == 0) != unique or tuple((row[1], row[2] or "A") for row in rows) != columns):
            raise ValueError(f"数据库索引定义不匹配：{table}.{index}")
    for (table, name), wanted in CHECK_CONTRACTS.items():
        cursor.execute(
            "SELECT cc.CHECK_CLAUSE,tc.ENFORCED FROM information_schema.CHECK_CONSTRAINTS cc "
            "JOIN information_schema.TABLE_CONSTRAINTS tc ON tc.CONSTRAINT_SCHEMA=cc.CONSTRAINT_SCHEMA "
            "AND tc.CONSTRAINT_NAME=cc.CONSTRAINT_NAME "
            "WHERE cc.CONSTRAINT_SCHEMA=DATABASE() AND tc.TABLE_NAME=%s AND cc.CONSTRAINT_NAME=%s",
            (table, name),
        )
        row = cursor.fetchone()
        if row:
            normalize = lambda value: re.sub(r"[\s()`]", "", str(value)).lower()
            if normalize(row[0]) != normalize(wanted) or str(row[1]).upper() != "YES":
                raise ValueError(f"数据库 CHECK 定义不匹配：{table}.{name}")


def apply_migrations(connection, expected=None):
    expected = expected or migrations()
    with connection.cursor() as cursor:
        cursor.execute("SELECT DATABASE()")
        database = cursor.fetchone()[0]
        cursor.execute("SELECT GET_LOCK(%s,30)", ("campus_schema_" + database,))
        if cursor.fetchone()[0] != 1:
            raise RuntimeError("无法获取数据库迁移锁")
        try:
            placeholders = ",".join(["%s"] * len(R1_BASELINE_TABLES))
            cursor.execute(
                "SELECT COUNT(*) FROM information_schema.tables "
                "WHERE table_schema=DATABASE() AND table_name IN (" + placeholders + ")",
                R1_BASELINE_TABLES,
            )
            if cursor.fetchone()[0] != len(R1_BASELINE_TABLES):
                raise ValueError("目标库不是完整 R1 基线，拒绝把部分数据库当作可迁移数据库")
            cursor.execute(DDL)
            cursor.execute("SELECT version,checksum FROM sys_schema_migration ORDER BY version")
            actual = dict(cursor.fetchall())
            wanted = {entry["version"]: entry["sha256"] for entry in expected}
            if any(version not in wanted or checksum != wanted[version] for version, checksum in actual.items()):
                raise ValueError("已执行迁移被修改或数据库版本更新，拒绝继续迁移")
            validate_existing_structures(cursor)
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
                 "WHERE table_schema=DATABASE());\n-- END GENERATED SCHEMA PREFLIGHT\n")
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
