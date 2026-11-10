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
DDL = """CREATE TABLE IF NOT EXISTS sys_schema_migration (
 version VARCHAR(32) PRIMARY KEY, checksum CHAR(64) NOT NULL,
 installed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"""
AUDIT_DDL = """CREATE TABLE IF NOT EXISTS sys_schema_migration_drift (
 id BIGINT NOT NULL AUTO_INCREMENT,
 database_name VARCHAR(64) NOT NULL,
 event_type VARCHAR(32) NOT NULL,
 release_name VARCHAR(128) NULL,
 target_fingerprint CHAR(64) NULL,
 actual_fingerprint CHAR(64) NULL,
 operator_name VARCHAR(128) NULL,
 reason VARCHAR(1000) NULL,
 detail TEXT NOT NULL,
 detected_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (id),
 KEY ix_schema_drift_database(database_name,detected_at),
 KEY ix_schema_drift_type(event_type,detected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;"""


class SchemaAdmissionError(ValueError):
    """结构不匹配时在任何 DDL 前拒绝升级。"""


class SchemaDriftError(ValueError):
    """迁移完成后结构指纹与发布目标不一致。"""


def _baseline_manifest():
    path = ROOT / "docs/database/baselines/manifest.json"
    if not path.exists():
        return []
    return json.loads(path.read_text("utf-8")).get("baselines", [])


def _target_fingerprint():
    path = ROOT / "campus-shopping-app/src/main/resources/database-manifest.json"
    if not path.exists():
        return None
    return json.loads(path.read_text("utf-8")).get("schemaFingerprint")


def _history(cursor):
    cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='sys_schema_migration'")
    if cursor.fetchone()[0] != 1:
        return {}
    cursor.execute("SELECT version,checksum FROM sys_schema_migration ORDER BY version")
    return dict(cursor.fetchall())


def _table_names(cursor, database):
    cursor.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES "
        "WHERE TABLE_SCHEMA=%s AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME",
        (database,),
    )
    return {row[0] for row in cursor.fetchall()}


def _schema_table_names():
    schema_path = ROOT / "campus-shopping-app/src/main/resources/schema.sql"
    if not schema_path.exists():
        return set()
    return set(re.findall(
        r"CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+`?([A-Za-z0-9_]+)`?",
        schema_path.read_text("utf-8"),
        flags=re.IGNORECASE,
    ))


def _structure_detail(cursor, database, actual_fingerprint, target_fingerprint):
    actual_tables = _table_names(cursor, database)
    expected_tables = _schema_table_names()
    missing = sorted(expected_tables - actual_tables)
    extra = sorted(actual_tables - expected_tables)
    return (
        f"actualFingerprint={actual_fingerprint}, targetFingerprint={target_fingerprint}, "
        f"missingTables={missing}, extraTables={extra}"
    )


def _expected_history(item):
    values = item.get("expectedHistory")
    if values is not None:
        return values
    prefix = item.get("expectedHistoryPrefix", "")
    if not prefix:
        return []
    start, end = prefix.split("..")
    versions = [entry["version"] for entry in migrations()]
    return versions[versions.index(start):versions.index(end) + 1]


def _write_audit(cursor, database, event_type, release_name=None, target=None, actual=None,
                 operator=None, reason=None, detail=""):
    cursor.execute(
        "INSERT INTO sys_schema_migration_drift "
        "(database_name,event_type,release_name,target_fingerprint,actual_fingerprint,operator_name,reason,detail) "
        "VALUES(%s,%s,%s,%s,%s,%s,%s,%s)",
        (database, event_type, release_name, target, actual, operator, reason, detail),
    )


def _valid_history_subset(actual_history, wanted_history):
    return all(version in wanted_history and wanted_history[version] == checksum
               for version, checksum in actual_history.items())


def _register_history(cursor, entries):
    for entry in entries:
        cursor.execute(
            "INSERT INTO sys_schema_migration(version,checksum) VALUES(%s,%s) "
            "ON DUPLICATE KEY UPDATE version=version",
            (entry["version"], entry["sha256"]),
        )


def _normalized_default(value):
    if value is None:
        return "<NULL>"
    return re.sub(r"\s+", " ", str(value).strip())


def _normalized_check(value):
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def schema_fingerprint_rows(cursor, database):
    """读取不含字符集、统计值和自增当前值的结构投影。"""
    queries = [
        ("columns", "SELECT TABLE_NAME,COLUMN_NAME,ORDINAL_POSITION,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA "
                   "FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=%s ORDER BY TABLE_NAME,ORDINAL_POSITION"),
        ("indexes", "SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,COLLATION "
                   "FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=%s ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX"),
        ("constraints", "SELECT TABLE_NAME,CONSTRAINT_NAME,CONSTRAINT_TYPE,ENFORCED "
                        "FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=%s ORDER BY TABLE_NAME,CONSTRAINT_NAME"),
        ("checks", "SELECT CONSTRAINT_NAME,CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS "
                    "WHERE CONSTRAINT_SCHEMA=%s ORDER BY CONSTRAINT_NAME"),
    ]
    result = {}
    for name, query in queries:
        cursor.execute(query, (database,))
        rows = cursor.fetchall()
        if name == "columns":
            rows = [[r[0], r[1], r[2], str(r[3]).lower(), r[4], _normalized_default(r[5]),
                     re.sub(r"\bauto_increment\b", "", str(r[6]).lower()).strip()] for r in rows]
        elif name == "indexes":
            rows = [[r[0], r[1], r[2], r[3], r[4], r[5] or ""] for r in rows]
        elif name == "constraints":
            rows = [[r[0], r[1], r[2], r[3]] for r in rows]
        else:
            rows = [[r[0], _normalized_check(r[1])] for r in rows]
        result[name] = rows
    return result


def schema_fingerprint(cursor, database):
    payload = json.dumps(schema_fingerprint_rows(cursor, database), ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


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


def apply_migrations(connection, expected=None, accept_baseline=None, reason=None, operator=None):
    expected = expected or migrations()
    wanted_history = {entry["version"]: entry["sha256"] for entry in expected}
    with connection.cursor() as cursor:
        cursor.execute("SELECT DATABASE()")
        database = cursor.fetchone()[0]
        cursor.execute("SELECT GET_LOCK(%s,30)", ("campus_schema_" + database,))
        if cursor.fetchone()[0] != 1:
            raise RuntimeError("无法获取数据库迁移锁")
        try:
            target_fingerprint = _target_fingerprint()
            if not target_fingerprint:
                raise ValueError("database-manifest.json 缺少 schemaFingerprint")
            table_names = _table_names(cursor, database)
            if not table_names:
                # 空库只重放当前完整 schema，随后核对目标指纹和完整历史，不走旧库 ALTER 链。
                execute_script(cursor, (ROOT / "campus-shopping-app/src/main/resources/schema.sql").read_text("utf-8"))
                validate_history(cursor, expected)
                actual_fingerprint = schema_fingerprint(cursor, database)
                if actual_fingerprint != target_fingerprint:
                    raise SchemaDriftError(_structure_detail(cursor, database, actual_fingerprint, target_fingerprint))
                return

            actual_fingerprint = schema_fingerprint(cursor, database)
            actual_history = _history(cursor)
            if not _valid_history_subset(actual_history, wanted_history):
                raise ValueError("已登记迁移被修改或数据库版本更新，拒绝继续迁移")

            if actual_fingerprint == target_fingerprint:
                if actual_history == wanted_history:
                    return
                if not actual_history:
                    cursor.execute(DDL)
                    _register_history(cursor, expected)
                    validate_history(cursor, expected)
                    return
                if not accept_baseline:
                    raise SchemaAdmissionError(
                        "目标库结构已是当前发布目标，但迁移历史缺失或不完整，拒绝执行 DDL；"
                        + _structure_detail(cursor, database, actual_fingerprint, target_fingerprint)
                    )
                if accept_baseline != target_fingerprint:
                    raise ValueError("--accept-baseline 必须使用当前目标结构指纹以修复缺失历史")
                if not reason or not reason.strip() or not operator or not operator.strip():
                    raise ValueError("显式基线准入必须提供非空 --reason 和 --operator")
                cursor.execute(AUDIT_DDL)
                _write_audit(cursor, database, "BASELINE_ACCEPTED", release_name=accept_baseline,
                             target=target_fingerprint, actual=actual_fingerprint,
                             operator=operator.strip(), reason=reason.strip(),
                             detail="人工核对后接受当前目标结构并补登记缺失迁移历史")
                cursor.execute(DDL)
                _register_history(cursor, expected)
                validate_history(cursor, expected)
                return

            if actual_history == wanted_history:
                detail = (
                    "数据库已登记完整迁移历史但结构指纹发生漂移；"
                    + _structure_detail(cursor, database, actual_fingerprint, target_fingerprint)
                )
                if "sys_schema_migration_drift" in table_names:
                    _write_audit(cursor, database, "DRIFT", target=target_fingerprint,
                                 actual=actual_fingerprint, detail=detail)
                raise SchemaDriftError(detail)

            baselines = _baseline_manifest()
            matched = next((item for item in baselines if item.get("sourceFingerprint") == actual_fingerprint), None)
            accepted = False
            if matched is None:
                if not accept_baseline:
                    raise SchemaAdmissionError(
                        "目标库结构指纹不匹配任何已发布基线，拒绝执行 DDL；"
                        + _structure_detail(cursor, database, actual_fingerprint, target_fingerprint)
                    )
                known_identifiers = {item.get("release") for item in baselines} | {
                    item.get("sourceFingerprint") for item in baselines
                } | {target_fingerprint, actual_fingerprint}
                if accept_baseline not in known_identifiers:
                    raise ValueError("--accept-baseline 必须是已登记发布名或结构指纹")
                accepted = True
                matched = {"release": accept_baseline, "expectedHistory": list(actual_history)}
            expected_versions = _expected_history(matched)
            expected_history = {entry["version"]: entry["sha256"] for entry in expected if entry["version"] in expected_versions}
            baseline_entries = [entry for entry in expected if entry["version"] in expected_versions]
            if actual_history == {} and expected_history:
                if accept_baseline:
                    if accept_baseline not in {matched.get("release"), matched.get("sourceFingerprint"), actual_fingerprint}:
                        raise ValueError("--accept-baseline 与当前基线不匹配")
                    accepted = True
            elif actual_history != expected_history:
                if not accept_baseline:
                    raise SchemaAdmissionError(
                        f"目标库结构匹配 {matched['release']}，但迁移历史不匹配，拒绝执行 DDL；"
                        f" expectedVersions={sorted(expected_history)}, actualVersions={sorted(actual_history)}; "
                        + _structure_detail(cursor, database, actual_fingerprint, target_fingerprint)
                    )
                if accept_baseline not in {matched.get("release"), matched.get("sourceFingerprint"), actual_fingerprint}:
                    raise ValueError("--accept-baseline 与当前基线不匹配")
                accepted = True
            if accepted:
                if not reason or not reason.strip() or not operator or not operator.strip():
                    raise ValueError("显式基线准入必须提供非空 --reason 和 --operator")
                cursor.execute(AUDIT_DDL)
                _write_audit(cursor, database, "BASELINE_ACCEPTED", release_name=accept_baseline,
                             target=target_fingerprint, actual=actual_fingerprint,
                             operator=operator.strip(), reason=reason.strip(),
                             detail="人工核对后显式接受结构基线，继续执行迁移")
            cursor.execute(DDL)
            if not actual_history and baseline_entries:
                _register_history(cursor, baseline_entries)
            cursor.execute("SELECT version,checksum FROM sys_schema_migration ORDER BY version")
            actual = dict(cursor.fetchall())
            if not _valid_history_subset(actual, wanted_history):
                raise ValueError("已执行迁移被修改或数据库版本更新，拒绝继续迁移")
            for entry in expected:
                if entry["version"] in actual:
                    continue
                execute_script(cursor, (ROOT / "docs/database/migrations" / entry["file"]).read_text("utf-8"))
                cursor.execute("INSERT INTO sys_schema_migration(version,checksum) VALUES(%s,%s)",
                               (entry["version"], entry["sha256"]))
                actual[entry["version"]] = entry["sha256"]
            validate_history(cursor, expected)
            actual_fingerprint = schema_fingerprint(cursor, database)
            if actual_fingerprint != target_fingerprint:
                detail = "迁移完成后结构指纹不一致：" + _structure_detail(
                    cursor, database, actual_fingerprint, target_fingerprint
                )
                cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() "
                               "AND table_name='sys_schema_migration_drift'")
                if cursor.fetchone()[0] == 1:
                    _write_audit(cursor, database, "DRIFT", target=target_fingerprint,
                                 actual=actual_fingerprint, detail=detail)
                raise SchemaDriftError(detail)
        finally:
            cursor.execute("SELECT RELEASE_LOCK(%s)", ("campus_schema_" + database,))


def generated_files():
    entries = migrations()
    baseline_manifest_path = ROOT / "docs/database/baselines/manifest.json"
    baseline_manifest = json.loads(baseline_manifest_path.read_text("utf-8")) if baseline_manifest_path.exists() else {"baselines": []}
    target_fingerprints = [item.get("targetFingerprint") for item in baseline_manifest.get("baselines", []) if item.get("targetFingerprint")]
    schema_fingerprint_value = target_fingerprints[0] if target_fingerprints and len(set(target_fingerprints)) == 1 else None
    schema_path = ROOT / "campus-shopping-app/src/main/resources/schema.sql"
    schema = schema_path.read_text("utf-8")
    if HEADER in schema:
        schema = schema.split("-- END GENERATED SCHEMA PREFLIGHT\n", 1)[1]
    schema = schema.split(FOOTER, 1)[0].rstrip() + "\n"
    preflight = (HEADER + "\nSET @campus_new_schema := (SELECT COUNT(*)=0 FROM information_schema.tables "
                 "WHERE table_schema=DATABASE() AND table_name='iam_user');\n-- END GENERATED SCHEMA PREFLIGHT\n")
    footer = "\n" + FOOTER + "\n" + DDL + "\n" + AUDIT_DDL + "\n"
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
            ROOT / "campus-shopping-app/src/main/resources/database-manifest.json": json.dumps(
                {"schemaVersion": 1, "schemaFingerprint": schema_fingerprint_value, "migrations": entries},
                ensure_ascii=False, indent=2) + "\n"}


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
