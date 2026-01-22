from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent
DB_PATH = BASE_DIR / "app.db"
SCHEMA_PATH = REPO_ROOT / "SQL_DDL_v1.0.sql"


def resolve_schema_path() -> Path:
    env_path = os.environ.get("CONVERSATION_SCHEMA_PATH")
    candidates = [
        Path(env_path) if env_path else None,
        SCHEMA_PATH,
        BASE_DIR / "SQL_DDL_v1.0.sql",
        Path.cwd() / "SQL_DDL_v1.0.sql",
    ]
    for candidate in candidates:
        if candidate and candidate.exists():
            return candidate
    checked = ", ".join(str(path) for path in candidates if path)
    raise FileNotFoundError(f"Schema file not found. Checked: {checked}")


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


@contextmanager
def db_session() -> Iterator[sqlite3.Connection]:
    conn = get_db()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()