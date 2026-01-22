from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterator

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent
DB_PATH = BASE_DIR / "app.db"
SCHEMA_PATH = REPO_ROOT / "SQL_DDL_v1.0.sql"


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    if not SCHEMA_PATH.exists():
        raise FileNotFoundError(f"Schema file not found: {SCHEMA_PATH}")
    conn = get_db()
    try:
        schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()


def db_session() -> Iterator[sqlite3.Connection]:
    conn = get_db()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()