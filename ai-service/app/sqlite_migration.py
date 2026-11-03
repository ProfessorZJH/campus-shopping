"""知识索引 SQLite 的显式结构迁移；服务启动只检查结构，不升级旧库。"""
from __future__ import annotations

import sqlite3
from pathlib import Path


DOC_COLUMNS = {"id", "fingerprint", "model", "updated", "version", "version_known"}
CHUNK_COLUMNS = {"id", "doc_id", "title", "body", "ordinal", "embedding", "model"}


def _columns(db: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in db.execute(f"PRAGMA table_info({table})")}


def create_schema(db: sqlite3.Connection) -> None:
    db.execute(
        "CREATE TABLE IF NOT EXISTS docs(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,model TEXT NOT NULL,updated REAL NOT NULL,version INTEGER NOT NULL,version_known INTEGER NOT NULL DEFAULT 1)"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS chunks(id TEXT PRIMARY KEY,doc_id TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,ordinal INTEGER NOT NULL,embedding TEXT NOT NULL,model TEXT NOT NULL)"
    )
    db.execute("CREATE INDEX IF NOT EXISTS chunks_doc ON chunks(doc_id)")


def migrate(path: str) -> None:
    """一次性升级旧库，并将历史文档标记为需要重新索引。"""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(target)
    try:
        tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "docs" not in tables and "chunks" not in tables:
            create_schema(db)
            db.commit()
            return
        if "docs" not in tables or "chunks" not in tables:
            raise RuntimeError("SQLite 索引结构不完整，请从备份恢复后执行迁移")
        docs = _columns(db, "docs")
        chunks = _columns(db, "chunks")
        missing = DOC_COLUMNS - docs
        if missing - {"version_known"}:
            if "version" not in docs:
                db.execute("ALTER TABLE docs ADD COLUMN version INTEGER")
            missing = DOC_COLUMNS - _columns(db, "docs")
        if "version_known" in missing:
            db.execute("ALTER TABLE docs ADD COLUMN version_known INTEGER NOT NULL DEFAULT 0")
            db.execute("UPDATE docs SET version_known=0")
        if CHUNK_COLUMNS - chunks:
            raise RuntimeError("SQLite chunks 表结构不兼容，请从备份恢复后执行迁移")
        db.execute("CREATE INDEX IF NOT EXISTS chunks_doc ON chunks(doc_id)")
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="迁移校园导购知识索引 SQLite 结构")
    parser.add_argument("path")
    args = parser.parse_args()
    migrate(args.path)
