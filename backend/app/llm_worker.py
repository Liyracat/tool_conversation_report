from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from typing import Any, Optional

from app.db import db_session

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "gpt-oss:20b"


def fetch_one(conn, query: str, params: dict[str, Any]) -> Optional[dict[str, Any]]:
    cur = conn.execute(query, params)
    row = cur.fetchone()
    return dict(row) if row else None


def fetch_all(conn, query: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    cur = conn.execute(query, params)
    return [dict(row) for row in cur.fetchall()]


def seed_llm_jobs(conn, limit: int = 10) -> int:
    cards = fetch_all(
        conn,
        """
        SELECT card_id
        FROM cards
        WHERE card_role_id IS NULL
        ORDER BY created_at ASC
        LIMIT :limit;
        """,
        {"limit": limit},
    )
    links = fetch_all(
        conn,
        """
        SELECT suggestion_id
        FROM link_suggestions
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT :limit;
        """,
        {"limit": limit},
    )

    inserted = 0
    card_index = 0
    link_index = 0
    while inserted < limit and (card_index < len(cards) or link_index < len(links)):
        if card_index < len(cards):
            card_id = cards[card_index]["card_id"]
            card_index += 1
            row = conn.execute(
                """
                INSERT OR IGNORE INTO llm_jobs (
                  job_type,
                  target_table,
                  target_id,
                  status,
                  locked_at,
                  lock_owner,
                  started_at,
                  finished_at,
                  error,
                  result_json,
                  created_at,
                  updated_at,
                  expires_at
                ) VALUES (
                  'card_role',
                  'cards',
                  :target_id,
                  'queued',
                  NULL,
                  NULL,
                  NULL,
                  NULL,
                  NULL,
                  NULL,
                  CURRENT_TIMESTAMP,
                  CURRENT_TIMESTAMP,
                  CURRENT_TIMESTAMP
                );
                """,
                {"target_id": card_id},
            )
            if row.rowcount == 1:
                inserted += 1
            if inserted >= limit:
                break

        if link_index < len(links) and inserted < limit:
            suggestion_id = links[link_index]["suggestion_id"]
            link_index += 1
            row = conn.execute(
                """
                INSERT OR IGNORE INTO llm_jobs (
                  job_type,
                  target_table,
                  target_id,
                  status,
                  locked_at,
                  lock_owner,
                  started_at,
                  finished_at,
                  error,
                  result_json,
                  created_at,
                  updated_at,
                  expires_at
                ) VALUES (
                  'link_suggestion',
                  'link_suggestions',
                  :target_id,
                  'queued',
                  NULL,
                  NULL,
                  NULL,
                  NULL,
                  NULL,
                  NULL,
                  CURRENT_TIMESTAMP,
                  CURRENT_TIMESTAMP,
                  CURRENT_TIMESTAMP
                );
                """,
                {"target_id": suggestion_id},
            )
            if row.rowcount == 1:
                inserted += 1

    return inserted


def build_allowed_terms(conn) -> dict[str, str]:
    card_roles = fetch_all(
        conn,
        "SELECT minor_name FROM card_roles ORDER BY card_role_id ASC;",
        {},
    )
    link_kinds = fetch_all(
        conn,
        "SELECT link_kind_name FROM link_kinds ORDER BY link_kind_id ASC;",
        {},
    )
    return {
        "card_role": "/".join(row["minor_name"] for row in card_roles),
        "link_suggestion": "/".join(row["link_kind_name"] for row in link_kinds),
    }


def extract_best_match(response_text: str, options: list[str]) -> Optional[str]:
    earliest_index = None
    best_match = None
    for option in options:
        index = response_text.find(option)
        if index >= 0 and (earliest_index is None or index < earliest_index):
            earliest_index = index
            best_match = option
    return best_match


def extract_min_confidence(response_text: str) -> Optional[float]:
    matches = re.findall(r"-?\d+(?:\.\d+)?", response_text)
    if not matches:
        return None
    values = [float(value) for value in matches]
    return min(values) if values else None


def call_ollama(prompt: str) -> dict[str, Any]:
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0,
            "num_predict": 12,
            "top_p": 0.8,
            "repeat_penalty": 1.1,
            "stop": ["\n\n"],
        },
    }
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_processing_job(conn) -> Optional[dict[str, Any]]:
    return fetch_one(
        conn,
        """
        SELECT *
        FROM llm_jobs
        WHERE status = 'processing'
        ORDER BY locked_at ASC
        LIMIT 1;
        """,
        {},
    )


def fetch_expired_processing_job(conn) -> Optional[dict[str, Any]]:
    return fetch_one(
        conn,
        """
        SELECT *
        FROM llm_jobs
        WHERE status = 'processing'
          AND (locked_at IS NULL OR locked_at <= datetime('now', '-5 minutes'))
        ORDER BY locked_at ASC
        LIMIT 1;
        """,
        {},
    )


def mark_job_failed(conn, job_id: int, error: str) -> None:
    conn.execute(
        """
        UPDATE llm_jobs
        SET status = 'failed',
            error = :error,
            finished_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE job_id = :job_id;
        """,
        {"job_id": job_id, "error": error},
    )


def mark_job_success(conn, job_id: int) -> None:
    conn.execute(
        """
        UPDATE llm_jobs
        SET status = 'success',
            finished_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE job_id = :job_id;
        """,
        {"job_id": job_id},
    )


def process_card_role_job(conn, job: dict[str, Any], allowed_terms: str) -> None:
    card = fetch_one(
        conn,
        "SELECT card_id, contents FROM cards WHERE card_id = :card_id;",
        {"card_id": job["target_id"]},
    )
    if not card:
        mark_job_failed(conn, job["job_id"], "Card not found")
        return

    prompt = (
        "あなたは分類器です。出力は2行のみ。\n"
        "1行目：許可単語一覧から1つを完全一致で出力。\n"
        "2行目：自信度を0.00〜1.00で出力。\n"
        "他の文章は禁止。\n\n"
        "許可単語一覧：\n"
        f"{allowed_terms}\n\n"
        "contents：\n"
        f"{card['contents']}"
    )

    try:
        response = call_ollama(prompt)
    except urllib.error.URLError as exc:
        mark_job_failed(conn, job["job_id"], f"Ollama request failed: {exc}")
        return

    if response.get("error"):
        mark_job_failed(conn, job["job_id"], str(response["error"]))
        return

    response_text = str(response.get("response", "")).strip()
    roles = fetch_all(
        conn,
        "SELECT card_role_id, minor_name FROM card_roles ORDER BY card_role_id ASC;",
        {},
    )
    role_names = [row["minor_name"] for row in roles]
    matched_name = extract_best_match(response_text, role_names)
    confidence = extract_min_confidence(response_text)
    if matched_name is None or confidence is None:
        mark_job_failed(conn, job["job_id"], "Failed to parse response")
        return

    matched_role_id = next(
        row["card_role_id"] for row in roles if row["minor_name"] == matched_name
    )
    conn.execute(
        """
        UPDATE cards
        SET card_role_id = :card_role_id,
            card_role_confidence = :card_role_confidence,
            updated_at = CURRENT_TIMESTAMP
        WHERE card_id = :card_id;
        """,
        {
            "card_role_id": matched_role_id,
            "card_role_confidence": confidence,
            "card_id": card["card_id"],
        },
    )
    mark_job_success(conn, job["job_id"])


def process_link_suggestion_job(conn, job: dict[str, Any], allowed_terms: str) -> None:
    suggestion = fetch_one(
        conn,
        """
        SELECT
          ls.suggestion_id,
          ls.from_card_id,
          ls.to_card_id,
          c_from.contents AS from_contents,
          c_to.contents AS to_contents
        FROM link_suggestions ls
        LEFT JOIN cards c_from ON c_from.card_id = ls.from_card_id
        LEFT JOIN cards c_to ON c_to.card_id = ls.to_card_id
        WHERE ls.suggestion_id = :suggestion_id;
        """,
        {"suggestion_id": job["target_id"]},
    )
    if not suggestion:
        mark_job_failed(conn, job["job_id"], "Link suggestion not found")
        return

    prompt = (
        "あなたは分類器です。出力は2行のみ。\n"
        "1行目：許可単語一覧から1つを完全一致で出力。関係が無ければ「none」。\n"
        "2行目：自信度を0.00〜1.00で出力。\n"
        "他の文章は禁止。\n\n"
        "許可単語一覧：\n"
        f"{allowed_terms}\n\n"
        "from：\n"
        f"{suggestion['from_contents']}\n\n"
        "to：\n"
        f"{suggestion['to_contents']}"
    )

    try:
        response = call_ollama(prompt)
    except urllib.error.URLError as exc:
        mark_job_failed(conn, job["job_id"], f"Ollama request failed: {exc}")
        return

    if response.get("error"):
        mark_job_failed(conn, job["job_id"], str(response["error"]))
        return

    response_text = str(response.get("response", "")).strip()
    lines = [line.strip() for line in response_text.splitlines() if line.strip()]
    first_line = lines[0].lower() if lines else ""
    confidence = extract_min_confidence(response_text)
    if confidence is None:
        mark_job_failed(conn, job["job_id"], "Failed to parse confidence")
        return

    link_kinds = fetch_all(
        conn,
        "SELECT link_kind_id, link_kind_name FROM link_kinds ORDER BY link_kind_id ASC;",
        {},
    )
    link_kind_names = [row["link_kind_name"] for row in link_kinds]
    matched_name = None if first_line == "none" else extract_best_match(response_text, link_kind_names)
    matched_kind_id = None
    if matched_name:
        matched_kind_id = next(
            row["link_kind_id"] for row in link_kinds if row["link_kind_name"] == matched_name
        )
    elif first_line != "none":
        mark_job_failed(conn, job["job_id"], "Failed to parse link kind")
        return

    conn.execute(
        """
        UPDATE link_suggestions
        SET suggested_link_kind_id = :suggested_link_kind_id,
            suggested_confidence = :suggested_confidence,
            status = 'success',
            updated_at = CURRENT_TIMESTAMP
        WHERE suggestion_id = :suggestion_id;
        """,
        {
            "suggested_link_kind_id": matched_kind_id,
            "suggested_confidence": confidence,
            "suggestion_id": suggestion["suggestion_id"],
        },
    )
    mark_job_success(conn, job["job_id"])


def process_job(conn, job: dict[str, Any], allowed_terms: dict[str, str]) -> None:
    if job["job_type"] == "card_role":
        process_card_role_job(conn, job, allowed_terms["card_role"])
    elif job["job_type"] == "link_suggestion":
        process_link_suggestion_job(conn, job, allowed_terms["link_suggestion"])
    else:
        mark_job_failed(conn, job["job_id"], f"Unknown job_type: {job['job_type']}")


def run_worker() -> None:
    with db_session() as conn:
        seed_llm_jobs(conn, limit=10)

    while True:
        with db_session() as conn:
            if not fetch_one(
                conn,
                """
                SELECT job_id
                FROM llm_jobs
                WHERE status IN ('queued', 'processing')
                LIMIT 1;
                """,
                {},
            ):
                break

            processing_job = fetch_processing_job(conn)
            if processing_job:
                expired_job = fetch_expired_processing_job(conn)
                if expired_job:
                    mark_job_failed(conn, expired_job["job_id"], "Processing timeout")
                    continue
                time.sleep(300)
                continue

            job = fetch_one(
                conn,
                """
                SELECT *
                FROM llm_jobs
                WHERE status = 'queued'
                ORDER BY created_at ASC
                LIMIT 1;
                """,
                {},
            )
            if not job:
                break

            conn.execute(
                """
                UPDATE llm_jobs
                SET status = 'processing',
                    locked_at = CURRENT_TIMESTAMP,
                    started_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE job_id = :job_id;
                """,
                {"job_id": job["job_id"]},
            )

        with db_session() as conn:
            allowed_terms = build_allowed_terms(conn)
            job = fetch_one(
                conn,
                "SELECT * FROM llm_jobs WHERE job_id = :job_id;",
                {"job_id": job["job_id"]},
            )
            if job:
                try:
                    process_job(conn, job, allowed_terms)
                except Exception as exc:
                    mark_job_failed(conn, job["job_id"], f"Unexpected error: {exc}")


if __name__ == "__main__":
    run_worker()