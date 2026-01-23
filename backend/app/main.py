from __future__ import annotations

import uuid
import sqlite3
from typing import Any, Dict, Iterable, Optional

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from app.db import db_session, init_db
from app.schemas import (
    CardDetail,
    CardListItem,
    CardUpdate,
    ContextSaveRequest,
    CreateCardRole,
    CreateLinkKind,
    CreateMajorItem,
    CreateMeaninglessPhrase,
    CreateSpeaker,
    ImportCommitRequest,
    ImportPreviewRequest,
    ImportPreviewResponse,
    LinkKindUpdate,
    LinkSuggestionApproveRequest,
    LinkSuggestionGenerateRequest,
    LinkSuggestionListItem,
    LinkSuggestionRunRequest,
    MergeResponse,
    MessageCardsResponse,
    SimpleMessageCard,
    UpdateCardRole,
    UpdateLinkKind,
    UpdateMajorItem,
    UpdateMeaninglessPhrase,
    UpdateSpeaker,
)

app = FastAPI(title="Conversation Cards API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] ,
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"] ,
)


@app.on_event("startup")
async def startup() -> None:
    init_db()


def fetch_one(conn, query: str, params: dict) -> Optional[dict]:
    cur = conn.execute(query, params)
    row = cur.fetchone()
    return dict(row) if row else None


def fetch_all(conn, query: str, params: dict) -> list[dict]:
    cur = conn.execute(query, params)
    return [dict(row) for row in cur.fetchall()]


@app.get("/cards")
async def list_cards(
    q: Optional[str] = None,
    visibility: str = "normal",
    speaker_id: Optional[int] = None,
    role_major_id: Optional[int] = None,
    role_id: Optional[int] = None,
    role_unset: Optional[bool] = None,
    thread_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: str = "conversation_at",
    sort_dir: str = "asc",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict:
    sort_whitelist = {
        "conversation_at": "c.conversation_at",
        "created_at": "c.created_at",
        "card_role_confidence": "c.card_role_confidence",
        "updated_at": "c.updated_at",
    }
    if sort_by not in sort_whitelist:
        raise HTTPException(status_code=400, detail="Invalid sort_by")
    if sort_dir.lower() not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="Invalid sort_dir")

    with db_session() as conn:
        total_query = """
            SELECT COUNT(1)
            FROM cards c
            LEFT JOIN speakers s ON s.speaker_id = c.speaker_id
            LEFT JOIN card_roles cr ON cr.card_role_id = c.card_role_id
            LEFT JOIN card_role_major_items m ON m.card_role_major_item_id = cr.card_role_major_item_id
            WHERE 1=1
              AND c.visibility = :visibility
              AND (:speaker_id IS NULL OR c.speaker_id = :speaker_id)
              AND (:role_major_id IS NULL OR m.card_role_major_item_id = :role_major_id)
              AND (:role_id IS NULL OR c.card_role_id = :role_id)
              AND (:role_unset IS NULL OR (:role_unset = 1 AND c.card_role_id IS NULL))
              AND (:thread_id IS NULL OR c.thread_id = :thread_id)
              AND (:date_from IS NULL OR c.conversation_at >= :date_from)
              AND (:date_to IS NULL OR c.conversation_at <= :date_to)
              AND (:q IS NULL OR c.contents LIKE '%' || :q || '%');
        """
        params = {
            "visibility": visibility,
            "speaker_id": speaker_id,
            "role_major_id": role_major_id,
            "role_id": role_id,
            "role_unset": 1 if role_unset else None,
            "thread_id": thread_id,
            "date_from": date_from,
            "date_to": date_to,
            "q": q,
        }
        total = conn.execute(total_query, params).fetchone()[0]

        items_query = f"""
            SELECT
              c.card_id, c.thread_id, c.message_id, c.text_id, c.split_version,
              c.speaker_id, s.speaker_name, c.conversation_at,
              c.visibility, c.card_role_id,
              m.major_name AS card_role_major_name,
              cr.minor_name AS card_role_name,
              c.card_role_confidence,
              c.contents
            FROM cards c
            LEFT JOIN speakers s ON s.speaker_id = c.speaker_id
            LEFT JOIN card_roles cr ON cr.card_role_id = c.card_role_id
            LEFT JOIN card_role_major_items m ON m.card_role_major_item_id = cr.card_role_major_item_id
            WHERE 1=1
              AND c.visibility = :visibility
              AND (:speaker_id IS NULL OR c.speaker_id = :speaker_id)
              AND (:role_major_id IS NULL OR m.card_role_major_item_id = :role_major_id)
              AND (:role_id IS NULL OR c.card_role_id = :role_id)
              AND (:role_unset IS NULL OR (:role_unset = 1 AND c.card_role_id IS NULL))
              AND (:thread_id IS NULL OR c.thread_id = :thread_id)
              AND (:date_from IS NULL OR c.conversation_at >= :date_from)
              AND (:date_to IS NULL OR c.conversation_at <= :date_to)
              AND (:q IS NULL OR c.contents LIKE '%' || :q || '%')
            ORDER BY {sort_whitelist[sort_by]} {sort_dir.upper()}
            LIMIT :limit OFFSET :offset;
        """
        params.update({"limit": limit, "offset": offset})
        items = fetch_all(conn, items_query, params)

    return {"total": total, "items": items}


@app.get("/cards/{card_id}")
async def get_card(card_id: int, context_prev_messages: int = 2, context_next_messages: int = 3) -> dict:
    with db_session() as conn:
        card_query = """
            SELECT
              c.*, s.speaker_name,
              m.major_name AS card_role_major_name,
              cr.minor_name AS card_role_name
            FROM cards c
            LEFT JOIN speakers s ON s.speaker_id = c.speaker_id
            LEFT JOIN card_roles cr ON cr.card_role_id = c.card_role_id
            LEFT JOIN card_role_major_items m ON m.card_role_major_item_id = cr.card_role_major_item_id
            WHERE c.card_id = :card_id;
        """
        card = fetch_one(conn, card_query, {"card_id": card_id})
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
        key_query = """
            SELECT thread_id, message_id, split_version, text_id
            FROM cards
            WHERE card_id = :card_id;
        """
        key = fetch_one(conn, key_query, {"card_id": card_id})
        message_id = key["message_id"]
        context_query = """
            SELECT
              c.card_id,
              c.message_id,
              c.text_id,
              c.split_key,
              c.contents,
              c.speaker_id,
              s.speaker_name,
              cr.minor_name AS card_role_name
            FROM cards c
            LEFT JOIN speakers s ON s.speaker_id = c.speaker_id
            LEFT JOIN card_roles cr ON cr.card_role_id = c.card_role_id
            WHERE c.thread_id = :thread_id
              AND c.split_version = :split_version
              AND c.message_id IN (:prev_message_id, :message_id, :next_message_id)
            ORDER BY c.message_id ASC, c.split_key ASC;
        """
        context_items = fetch_all(
            conn,
            context_query,
            {
                "thread_id": key["thread_id"],
                "split_version": key["split_version"],
                "prev_message_id": message_id - 1,
                "message_id": message_id,
                "next_message_id": message_id + 1,
            },
        )

    return {
        "card": card,
        "context_messages": {"items": context_items},
    }


@app.patch("/cards/{card_id}")
async def update_card(card_id: int, payload: CardUpdate) -> dict:
    with db_session() as conn:
        existing = fetch_one(conn, "SELECT card_id FROM cards WHERE card_id = :card_id", {"card_id": card_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Card not found")
        conn.execute(
            """
            UPDATE cards
            SET
              thread_id = COALESCE(:thread_id, thread_id),
              message_id = COALESCE(:message_id, message_id),
              text_id = COALESCE(:text_id, text_id),
              split_key = COALESCE(:split_key, split_key),
              split_version = COALESCE(:split_version, split_version),
              speaker_id = COALESCE(:speaker_id, speaker_id),
              conversation_at = COALESCE(:conversation_at, conversation_at),
              contents = COALESCE(:contents, contents),
              is_edited = CASE
                WHEN :is_edited IS NOT NULL THEN :is_edited
                WHEN :contents IS NOT NULL THEN 1
                ELSE is_edited
              END,
              visibility = COALESCE(:visibility, visibility),
              card_role_id = COALESCE(:card_role_id, card_role_id),
              card_role_confidence = CASE
                WHEN :card_role_confidence IS NOT NULL THEN :card_role_confidence
                WHEN :card_role_id IS NOT NULL THEN NULL
                ELSE card_role_confidence
              END,
              created_at = COALESCE(:created_at, created_at),
              updated_at = COALESCE(:updated_at, CURRENT_TIMESTAMP)
            WHERE card_id = :card_id;
            """,
            {
                "thread_id": payload.thread_id,
                "message_id": payload.message_id,
                "text_id": payload.text_id,
                "split_key": payload.split_key,
                "split_version": payload.split_version,
                "speaker_id": payload.speaker_id,
                "conversation_at": payload.conversation_at,
                "contents": payload.contents,
                "is_edited": payload.is_edited,
                "visibility": payload.visibility,
                "card_role_id": payload.card_role_id,
                "card_role_confidence": payload.card_role_confidence,
                "created_at": payload.created_at,
                "updated_at": payload.updated_at,
                "card_id": card_id,
            },
        )

    return {"card_id": card_id}


def _normalize_split_key(split_key: str) -> tuple[str, int, int]:
    head, _, tail = split_key.partition(".")
    tail = (tail + "00")[:2]
    return head, int(tail[0]), int(tail[1])


def _format_split_key(head: str, first_digit: int, second_digit: int) -> str:
    return f"{head}.{first_digit}{second_digit}"


def _generate_split_key(conn: sqlite3.Connection, source_row: dict) -> str:
    head, first_digit, second_digit = _normalize_split_key(source_row["split_key"])
    prefix = f"{head}."
    existing_keys = []
    for row in fetch_all(
        conn,
        """
        SELECT split_key
        FROM cards
        WHERE thread_id = :thread_id
          AND message_id = :message_id
          AND split_key LIKE :prefix;
        """,
        {
            "thread_id": source_row["thread_id"],
            "message_id": source_row["message_id"],
            "prefix": f"{prefix}%",
        },
    ):
        existing_keys.append(row["split_key"])
    existing_key_set = set(existing_keys)
    existing_tuples = sorted(
        (_normalize_split_key(key)[1:], key) for key in existing_keys if key.startswith(prefix)
    )
    current_tuple = (first_digit, second_digit)
    next_tuple = next((digits for digits, _ in existing_tuples if digits > current_tuple), None)

    def candidate_ok(candidate_tuple: tuple[int, int], candidate_key: str) -> bool:
        if candidate_key in existing_key_set:
            return False
        if next_tuple is not None and candidate_tuple >= next_tuple:
            return False
        return True

    for first in range(first_digit, 10):
        start_second = second_digit + 1 if first == first_digit else 0
        for second in range(start_second, 10):
            candidate_tuple = (first, second)
            if next_tuple is not None and candidate_tuple >= next_tuple:
                raise HTTPException(status_code=400, detail="分割可能回数を超えました")
            candidate = _format_split_key(head, first, second)
            if candidate_ok(candidate_tuple, candidate):
                return candidate

    raise HTTPException(status_code=400, detail="分割可能回数を超えました")


@app.post("/cards/context:save")
async def save_context_edits(payload: ContextSaveRequest) -> dict:
    edited_map = {item.card_id: item.contents for item in payload.items}
    split_sources = {split.source_card_id for split in payload.splits}
    with db_session() as conn:
        for card_id, contents in edited_map.items():
            conn.execute(
                """
                UPDATE cards
                SET contents = :contents,
                    is_edited = 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE card_id = :card_id;
                """,
                {"card_id": card_id, "contents": contents},
            )

        for merge in payload.merges:
            target_contents = edited_map.get(merge.target_card_id)
            if target_contents is None:
                target = fetch_one(
                    conn,
                    "SELECT contents FROM cards WHERE card_id = :card_id;",
                    {"card_id": merge.target_card_id},
                )
                source = fetch_one(
                    conn,
                    "SELECT contents FROM cards WHERE card_id = :card_id;",
                    {"card_id": merge.source_card_id},
                )
                if not target or not source:
                    raise HTTPException(status_code=404, detail="Card not found")
                target_contents = f"{target['contents']}\n{source['contents']}"
            conn.execute(
                """
                UPDATE cards
                SET contents = :contents,
                    is_edited = 1,
                    card_role_id = NULL,
                    card_role_confidence = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE card_id = :card_id;
                """,
                {"card_id": merge.target_card_id, "contents": target_contents},
            )
            conn.execute(
                "DELETE FROM cards WHERE card_id = :card_id",
                {"card_id": merge.source_card_id},
            )

        for source_card_id in split_sources:
            contents_override = edited_map.get(source_card_id)
            if contents_override is None:
                conn.execute(
                    """
                    UPDATE cards
                    SET is_edited = 1,
                        card_role_id = NULL,
                        card_role_confidence = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE card_id = :card_id;
                    """,
                    {"card_id": source_card_id},
                )
            else:
                conn.execute(
                    """
                    UPDATE cards
                    SET contents = :contents,
                        is_edited = 1,
                        card_role_id = NULL,
                        card_role_confidence = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE card_id = :card_id;
                    """,
                    {"card_id": source_card_id, "contents": contents_override},
                )

        for split in payload.splits:
            source_row = fetch_one(
                conn,
                "SELECT * FROM cards WHERE card_id = :card_id;",
                {"card_id": split.source_card_id},
            )
            if not source_row:
                raise HTTPException(status_code=404, detail="Card not found")
            new_text_id = (
                fetch_one(
                    conn,
                    """
                    SELECT COALESCE(MAX(text_id), 0) AS max_text_id
                    FROM cards
                    WHERE thread_id = :thread_id
                      AND message_id = :message_id;
                    """,
                    {"thread_id": source_row["thread_id"], "message_id": source_row["message_id"]},
                )["max_text_id"]
                + 1
            )
            new_split_key = _generate_split_key(conn, source_row)
            conn.execute(
                """
                INSERT INTO cards (
                  thread_id,
                  message_id,
                  text_id,
                  split_key,
                  split_version,
                  speaker_id,
                  conversation_at,
                  contents,
                  is_edited,
                  card_role_id,
                  card_role_confidence,
                  visibility,
                  created_at,
                  updated_at
                )
                VALUES (
                  :thread_id,
                  :message_id,
                  :text_id,
                  :split_key,
                  :split_version,
                  :speaker_id,
                  :conversation_at,
                  :contents,
                  1,
                  NULL,
                  NULL,
                  :visibility,
                  CURRENT_TIMESTAMP,
                  CURRENT_TIMESTAMP
                );
                """,
                {
                    "thread_id": source_row["thread_id"],
                    "message_id": source_row["message_id"],
                    "text_id": new_text_id,
                    "split_key": new_split_key,
                    "split_version": source_row["split_version"],
                    "speaker_id": source_row["speaker_id"],
                    "conversation_at": source_row["conversation_at"],
                    "contents": split.contents,
                    "visibility": source_row["visibility"],
                },
            )

    return {"saved": True}


@app.post("/cards/{card_id}/role:recompute", status_code=202)
async def recompute_role(card_id: int) -> dict:
    with db_session() as conn:
        updated = conn.execute(
            """
            UPDATE cards
            SET card_role_id = NULL,
                card_role_confidence = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE card_id = :card_id;
            """,
            {"card_id": card_id},
        ).rowcount
    if updated == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"queued": True}


@app.post("/cards/roles:backfill", status_code=202)
async def backfill_roles(body: dict) -> dict:
    thread_id = body.get("thread_id")
    visibility = body.get("visibility")
    limit = body.get("limit", 200)
    with db_session() as conn:
        query = """
            SELECT card_id
            FROM cards
            WHERE card_role_id IS NULL
              AND (:thread_id IS NULL OR thread_id = :thread_id)
              AND (:visibility IS NULL OR visibility = :visibility)
            LIMIT :limit;
        """
        cards = fetch_all(conn, query, {"thread_id": thread_id, "visibility": visibility, "limit": limit})
    return {"queued_count": len(cards)}


@app.get("/cards/roles:status")
async def role_status(thread_id: Optional[str] = None, visibility: Optional[str] = None) -> dict:
    with db_session() as conn:
        pending = conn.execute(
            """
            SELECT COUNT(1) AS pending
            FROM cards
            WHERE (:thread_id IS NULL OR thread_id = :thread_id)
              AND (:visibility IS NULL OR visibility = :visibility)
              AND card_role_id IS NULL;
            """,
            {"thread_id": thread_id, "visibility": visibility},
        ).fetchone()[0]
        last = conn.execute("SELECT MAX(updated_at) FROM cards").fetchone()[0]
    return {"pending": pending, "failed": 0, "last_updated_at": last}


@app.get("/threads/{thread_id}/messages/{message_id}")
async def get_message_cards(thread_id: str, message_id: int, split_version: int = 1) -> dict:
    with db_session() as conn:
        rows = fetch_all(
            conn,
            """
            SELECT c.card_id, c.text_id, c.contents, cr.minor_name AS card_role_name
            FROM cards c
            LEFT JOIN card_roles cr ON cr.card_role_id = c.card_role_id
            WHERE c.thread_id = :thread_id
              AND c.message_id = :message_id
              AND c.split_version = :split_version
            ORDER BY c.text_id ASC;
            """,
            {"thread_id": thread_id, "message_id": message_id, "split_version": split_version},
        )
    return {
        "thread_id": thread_id,
        "message_id": message_id,
        "split_version": split_version,
        "cards": rows,
    }


@app.post("/cards/{card_id}/merge-into-previous")
async def merge_into_previous(card_id: int) -> dict:
    with db_session() as conn:
        base = fetch_one(
            conn,
            """
            SELECT card_id, thread_id, message_id, split_version, text_id, contents
            FROM cards
            WHERE card_id = :card_id;
            """,
            {"card_id": card_id},
        )
        if not base:
            raise HTTPException(status_code=404, detail="Card not found")
        upper = fetch_one(
            conn,
            """
            SELECT card_id, contents
            FROM cards
            WHERE thread_id = :thread_id
              AND message_id = :message_id
              AND split_version = :split_version
              AND text_id < :text_id
            ORDER BY text_id DESC
            LIMIT 1;
            """,
            {
                "thread_id": base["thread_id"],
                "message_id": base["message_id"],
                "split_version": base["split_version"],
                "text_id": base["text_id"],
            },
        )
        if not upper:
            raise HTTPException(status_code=400, detail="No previous card to merge into")
        merged_contents = f"{upper['contents']}\n{base['contents']}"
        conn.execute(
            """
            UPDATE cards
            SET contents = :contents,
                is_edited = 1,
                card_role_id = NULL,
                card_role_confidence = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE card_id = :card_id;
            """,
            {"contents": merged_contents, "card_id": upper["card_id"]},
        )
        conn.execute("DELETE FROM cards WHERE card_id = :card_id", {"card_id": base["card_id"]})
    return {"merged_into_card_id": upper["card_id"], "deleted_card_id": base["card_id"]}


@app.delete("/cards/{card_id}", status_code=204)
async def delete_card(card_id: int) -> Response:
    with db_session() as conn:
        deleted = conn.execute("DELETE FROM cards WHERE card_id = :card_id", {"card_id": card_id}).rowcount
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    return Response(status_code=204)


@app.get("/cards/{card_id}/links")
async def list_card_links(
    card_id: int,
    kind: Optional[str] = None,
    sort_by: str = "confidence",
    sort_dir: str = "desc",
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict:
    sort_map = {
        "confidence": "cl.confidence",
        "conversation_at": "c2.conversation_at",
    }
    if sort_by not in sort_map:
        raise HTTPException(status_code=400, detail="Invalid sort_by")
    if sort_dir.lower() not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="Invalid sort_dir")
    with db_session() as conn:
        counts = fetch_all(
            conn,
            """
            SELECT lk.link_kind_name, COUNT(1) AS cnt
            FROM card_links cl
            JOIN link_kinds lk ON lk.link_kind_id = cl.link_kind_id
            WHERE cl.from_card_id = :card_id
            GROUP BY lk.link_kind_name;
            """,
            {"card_id": card_id},
        )
        counts_by_kind = {row["link_kind_name"]: row["cnt"] for row in counts}
        items = fetch_all(
            conn,
            f"""
            SELECT
              cl.link_id,
              lk.link_kind_name,
              cl.confidence,
              cl.from_card_id,
              cl.to_card_id,
              c2.card_id AS to_card_id,
              c2.conversation_at AS to_conversation_at,
              c2.contents AS to_contents,
              cr2.minor_name AS to_card_role_name
            FROM card_links cl
            JOIN link_kinds lk ON lk.link_kind_id = cl.link_kind_id
            JOIN cards c2 ON c2.card_id = cl.to_card_id
            LEFT JOIN card_roles cr2 ON cr2.card_role_id = c2.card_role_id
            WHERE cl.from_card_id = :card_id
              AND (:kind IS NULL OR lk.link_kind_name = :kind)
            ORDER BY {sort_map[sort_by]} {sort_dir.upper()}
            LIMIT :limit OFFSET :offset;
            """,
            {"card_id": card_id, "kind": kind, "limit": limit, "offset": offset},
        )
    wrapped = []
    for row in items:
        wrapped.append(
            {
                "link_id": row["link_id"],
                "link_kind_name": row["link_kind_name"],
                "confidence": row["confidence"],
                "from_card_id": row["from_card_id"],
                "to_card_id": row["to_card_id"],
                "to_card": {
                    "card_id": row["to_card_id"],
                    "card_role_name": row["to_card_role_name"],
                    "conversation_at": row["to_conversation_at"],
                    "contents": row["to_contents"],
                },
            }
        )
    return {"counts_by_kind": counts_by_kind, "items": wrapped}


@app.patch("/links/{link_id}")
async def update_link(link_id: int, payload: LinkKindUpdate) -> dict:
    with db_session() as conn:
        updated = conn.execute(
            """
            UPDATE card_links
            SET link_kind_id = :link_kind_id,
                updated_at = CURRENT_TIMESTAMP
            WHERE link_id = :link_id;
            """,
            {"link_kind_id": payload.link_kind_id, "link_id": link_id},
        ).rowcount
    if updated == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    return {"link_id": link_id}


@app.delete("/links/{link_id}", status_code=204)
async def delete_link(link_id: int) -> Response:
    with db_session() as conn:
        deleted = conn.execute("DELETE FROM card_links WHERE link_id = :link_id", {"link_id": link_id}).rowcount
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    return Response(status_code=204)


def split_text(raw_text: str) -> list[str]:
    return [line.strip() for line in raw_text.splitlines() if line.strip()]


def split_import_text(raw_text: str, speaker_map: dict[str, dict]) -> list[dict]:
    parts: list[dict] = []
    current_speaker: Optional[dict] = None
    message_id = 0
    text_id = 0
    for line in split_text(raw_text):
        if line in speaker_map:
            current_speaker = speaker_map[line]
            message_id += 1
            text_id = 0
            continue
        if current_speaker is None:
            raise HTTPException(status_code=400, detail="Speaker definition line is required before content.")
        text_id += 1
        parts.append(
            {
                "message_id": message_id,
                "text_id": text_id,
                "speaker_id": current_speaker["speaker_id"],
                "speaker_name": current_speaker["speaker_name"],
                "contents": line,
            }
        )
    return parts


@app.post("/import/preview")
async def import_preview(payload: ImportPreviewRequest) -> ImportPreviewResponse:
    with db_session() as conn:
        speakers = fetch_all(conn, "SELECT speaker_id, speaker_name, speaker_role FROM speakers ORDER BY speaker_id", {})
    speaker_map = {speaker["speaker_role"]: speaker for speaker in speakers}
    parts = split_import_text(payload.raw_text, speaker_map)
    return ImportPreviewResponse(
        thread_id=str(uuid.uuid4()),
        split_version=1,
        parts=parts,
    )


@app.post("/import/commit", status_code=201)
async def import_commit(payload: ImportCommitRequest) -> dict:
    created_ids: list[int] = []
    with db_session() as conn:
        for part in payload.parts:
            split_key = f"{part['text_id']:05d}.00"
            cur = conn.execute(
                """
                INSERT INTO cards (
                  thread_id, message_id, text_id, split_key, split_version,
                  speaker_id, conversation_at,
                  contents, is_edited, visibility,
                  created_at, updated_at
                ) VALUES (
                  :thread_id, :message_id, :text_id, :split_key, :split_version,
                  :speaker_id, CURRENT_TIMESTAMP,
                  :contents, 0, 'normal',
                  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                );
                """,
                {
                    "thread_id": payload.thread_id,
                    "message_id": part["message_id"],
                    "text_id": part["text_id"],
                    "split_key": split_key,
                    "split_version": 1,
                    "speaker_id": part["speaker_id"],
                    "contents": part["contents"],
                },
            )
            created_ids.append(cur.lastrowid)
    return {"created_card_ids": created_ids, "thread_id": payload.thread_id}


@app.post("/import/{thread_id}/roles:run", status_code=202)
async def import_roles_run(thread_id: str, body: dict) -> dict:
    return {"queued": True}


@app.post("/link-suggestions/generate", status_code=201)
async def generate_link_suggestions(payload: LinkSuggestionGenerateRequest) -> dict:
    created = 0
    skipped = 0
    with db_session() as conn:
        for from_id in payload.from_card_ids:
            for to_id in payload.to_card_ids:
                if from_id == to_id:
                    continue
                row = conn.execute(
                    """
                    INSERT OR IGNORE INTO link_suggestions (
                      from_card_id, to_card_id, status, attempts, created_at, updated_at
                    ) VALUES (
                      :from_card_id, :to_card_id, 'queued', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    );
                    """,
                    {"from_card_id": from_id, "to_card_id": to_id},
                )
                if row.rowcount == 1:
                    created += 1
                else:
                    skipped += 1
    return {"created": created, "skipped": skipped}


@app.post("/link-suggestions/run", status_code=202)
async def run_link_suggestions(payload: LinkSuggestionRunRequest) -> dict:
    return {"queued": True}


@app.get("/link-suggestions")
async def list_link_suggestions(
    status: Optional[str] = None,
    from_card_id: Optional[int] = None,
    to_card_id: Optional[int] = None,
    sort_by: str = "updated_at",
    sort_dir: str = "desc",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict:
    sort_map = {
        "updated_at": "ls.updated_at",
        "created_at": "ls.created_at",
        "suggested_confidence": "ls.suggested_confidence",
    }
    if sort_by not in sort_map:
        raise HTTPException(status_code=400, detail="Invalid sort_by")
    if sort_dir.lower() not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="Invalid sort_dir")
    with db_session() as conn:
        total = conn.execute(
            """
            SELECT COUNT(1)
            FROM link_suggestions ls
            WHERE 1=1
              AND (:status IS NULL OR ls.status = :status)
              AND (:from_card_id IS NULL OR ls.from_card_id = :from_card_id)
              AND (:to_card_id IS NULL OR ls.to_card_id = :to_card_id);
            """,
            {"status": status, "from_card_id": from_card_id, "to_card_id": to_card_id},
        ).fetchone()[0]
        items = fetch_all(
            conn,
            f"""
            SELECT
              ls.suggestion_id, ls.from_card_id, ls.to_card_id, ls.status,
              ls.suggested_link_kind_id,
              lk.link_kind_name AS suggested_link_kind_name,
              ls.suggested_confidence
            FROM link_suggestions ls
            LEFT JOIN link_kinds lk ON lk.link_kind_id = ls.suggested_link_kind_id
            WHERE 1=1
              AND (:status IS NULL OR ls.status = :status)
              AND (:from_card_id IS NULL OR ls.from_card_id = :from_card_id)
              AND (:to_card_id IS NULL OR ls.to_card_id = :to_card_id)
            ORDER BY {sort_map[sort_by]} {sort_dir.upper()}
            LIMIT :limit OFFSET :offset;
            """,
            {
                "status": status,
                "from_card_id": from_card_id,
                "to_card_id": to_card_id,
                "limit": limit,
                "offset": offset,
            },
        )
    return {"total": total, "items": items}


@app.post("/link-suggestions/{suggestion_id}/rerun", status_code=202)
async def rerun_link_suggestion(suggestion_id: int) -> dict:
    with db_session() as conn:
        updated = conn.execute(
            """
            UPDATE link_suggestions
            SET status = 'queued', updated_at = CURRENT_TIMESTAMP
            WHERE suggestion_id = :suggestion_id;
            """,
            {"suggestion_id": suggestion_id},
        ).rowcount
    if updated == 0:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return {"queued": True}


@app.post("/link-suggestions/{suggestion_id}/approve", status_code=201)
async def approve_link_suggestion(suggestion_id: int, payload: LinkSuggestionApproveRequest) -> dict:
    with db_session() as conn:
        suggestion = fetch_one(
            conn,
            """
            SELECT from_card_id, to_card_id, suggested_link_kind_id, suggested_confidence
            FROM link_suggestions
            WHERE suggestion_id = :suggestion_id;
            """,
            {"suggestion_id": suggestion_id},
        )
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        kind_id = payload.link_kind_id or suggestion["suggested_link_kind_id"]
        if kind_id is None:
            raise HTTPException(status_code=400, detail="link_kind_id is required")
        conn.execute(
            """
            INSERT INTO card_links (
              link_kind_id, from_card_id, to_card_id, confidence, created_at, updated_at
            ) VALUES (
              :link_kind_id, :from_card_id, :to_card_id, :confidence, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
            """,
            {
                "link_kind_id": kind_id,
                "from_card_id": suggestion["from_card_id"],
                "to_card_id": suggestion["to_card_id"],
                "confidence": suggestion["suggested_confidence"],
            },
        )
        conn.execute(
            """
            UPDATE link_suggestions
            SET status = 'approved',
                expires_at = datetime('now', '+7 days'),
                updated_at = CURRENT_TIMESTAMP
            WHERE suggestion_id = :suggestion_id;
            """,
            {"suggestion_id": suggestion_id},
        )
    link_id = conn.execute("SELECT last_insert_rowid()")
    return {"link_id": link_id.fetchone()[0]}


@app.post("/link-suggestions/{suggestion_id}/reject")
async def reject_link_suggestion(suggestion_id: int) -> dict:
    with db_session() as conn:
        updated = conn.execute(
            """
            UPDATE link_suggestions
            SET status = 'rejected',
                expires_at = datetime('now', '+7 days'),
                updated_at = CURRENT_TIMESTAMP
            WHERE suggestion_id = :suggestion_id;
            """,
            {"suggestion_id": suggestion_id},
        ).rowcount
    if updated == 0:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return {"rejected": True}


@app.post("/link-suggestions/cleanup")
async def cleanup_link_suggestions() -> dict:
    with db_session() as conn:
        deleted = conn.execute(
            """
            DELETE FROM link_suggestions
            WHERE expires_at IS NOT NULL
              AND expires_at <= CURRENT_TIMESTAMP;
            """,
        ).rowcount
    return {"deleted": deleted}


@app.get("/speakers")
async def list_speakers() -> list[dict]:
    with db_session() as conn:
        return fetch_all(conn, "SELECT * FROM speakers ORDER BY speaker_id", {})


@app.post("/speakers", status_code=201)
async def create_speaker(payload: CreateSpeaker) -> dict:
    with db_session() as conn:
        cur = conn.execute(
            """
            INSERT INTO speakers (speaker_name, speaker_role, canonical_role, created_at, updated_at)
            VALUES (:speaker_name, :speaker_role, :canonical_role, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            """,
            payload.model_dump(),
        )
    return {"speaker_id": cur.lastrowid}


@app.patch("/speakers/{speaker_id}")
async def update_speaker(speaker_id: int, payload: UpdateSpeaker) -> dict:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join(f"{key} = :{key}" for key in data.keys())
    with db_session() as conn:
        updated = conn.execute(
            f"UPDATE speakers SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE speaker_id = :speaker_id",
            {**data, "speaker_id": speaker_id},
        ).rowcount
    if updated == 0:
        raise HTTPException(status_code=404, detail="Speaker not found")
    return {"speaker_id": speaker_id}


@app.delete("/speakers/{speaker_id}", status_code=204)
async def delete_speaker(speaker_id: int) -> Response:
    with db_session() as conn:
        deleted = conn.execute("DELETE FROM speakers WHERE speaker_id = :speaker_id", {"speaker_id": speaker_id}).rowcount
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Speaker not found")
    return Response(status_code=204)


@app.get("/card-role-major-items")
async def list_major_items() -> list[dict]:
    with db_session() as conn:
        return fetch_all(conn, "SELECT * FROM card_role_major_items ORDER BY card_role_major_item_id", {})


@app.post("/card-role-major-items", status_code=201)
async def create_major_item(payload: CreateMajorItem) -> dict:
    with db_session() as conn:
        cur = conn.execute(
            "INSERT INTO card_role_major_items (major_name) VALUES (:major_name);",
            payload.model_dump(),
        )
    return {"card_role_major_item_id": cur.lastrowid}


@app.patch("/card-role-major-items/{major_id}")
async def update_major_item(major_id: int, payload: UpdateMajorItem) -> dict:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join(f"{key} = :{key}" for key in data.keys())
    with db_session() as conn:
        updated = conn.execute(
            f"UPDATE card_role_major_items SET {set_clause} WHERE card_role_major_item_id = :major_id",
            {**data, "major_id": major_id},
        ).rowcount
    if updated == 0:
        raise HTTPException(status_code=404, detail="Major item not found")
    return {"card_role_major_item_id": major_id}


@app.delete("/card-role-major-items/{major_id}", status_code=204)
async def delete_major_item(major_id: int) -> Response:
    with db_session() as conn:
        deleted = conn.execute(
            "DELETE FROM card_role_major_items WHERE card_role_major_item_id = :major_id",
            {"major_id": major_id},
        ).rowcount
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Major item not found")
    return Response(status_code=204)


@app.get("/card-roles")
async def list_card_roles() -> list[dict]:
    with db_session() as conn:
        return fetch_all(conn, "SELECT * FROM card_roles ORDER BY card_role_id", {})


@app.post("/card-roles", status_code=201)
async def create_card_role(payload: CreateCardRole) -> dict:
    with db_session() as conn:
        cur = conn.execute(
            """
            INSERT INTO card_roles (card_role_major_item_id, minor_name, created_at, updated_at)
            VALUES (:card_role_major_item_id, :minor_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            """,
            payload.model_dump(),
        )
    return {"card_role_id": cur.lastrowid}


@app.patch("/card-roles/{role_id}")
async def update_card_role(role_id: int, payload: UpdateCardRole) -> dict:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join(f"{key} = :{key}" for key in data.keys())
    with db_session() as conn:
        updated = conn.execute(
            f"UPDATE card_roles SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE card_role_id = :role_id",
            {**data, "role_id": role_id},
        ).rowcount
    if updated == 0:
        raise HTTPException(status_code=404, detail="Card role not found")
    return {"card_role_id": role_id}


@app.delete("/card-roles/{role_id}", status_code=204)
async def delete_card_role(role_id: int) -> Response:
    with db_session() as conn:
        deleted = conn.execute("DELETE FROM card_roles WHERE card_role_id = :role_id", {"role_id": role_id}).rowcount
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Card role not found")
    return Response(status_code=204)


@app.get("/link-kinds")
async def list_link_kinds() -> list[dict]:
    with db_session() as conn:
        return fetch_all(conn, "SELECT * FROM link_kinds ORDER BY link_kind_id", {})


@app.post("/link-kinds", status_code=201)
async def create_link_kind(payload: CreateLinkKind) -> dict:
    with db_session() as conn:
        cur = conn.execute(
            "INSERT INTO link_kinds (link_kind_name) VALUES (:link_kind_name);",
            payload.model_dump(),
        )
    return {"link_kind_id": cur.lastrowid}


@app.patch("/link-kinds/{link_kind_id}")
async def update_link_kind(link_kind_id: int, payload: UpdateLinkKind) -> dict:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join(f"{key} = :{key}" for key in data.keys())
    with db_session() as conn:
        updated = conn.execute(
            f"UPDATE link_kinds SET {set_clause} WHERE link_kind_id = :link_kind_id",
            {**data, "link_kind_id": link_kind_id},
        ).rowcount
    if updated == 0:
        raise HTTPException(status_code=404, detail="Link kind not found")
    return {"link_kind_id": link_kind_id}


@app.delete("/link-kinds/{link_kind_id}", status_code=204)
async def delete_link_kind(link_kind_id: int) -> Response:
    with db_session() as conn:
        deleted = conn.execute(
            "DELETE FROM link_kinds WHERE link_kind_id = :link_kind_id",
            {"link_kind_id": link_kind_id},
        ).rowcount
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Link kind not found")
    return Response(status_code=204)


@app.get("/meaningless_phrases")
async def list_meaningless_phrases() -> list[dict]:
    with db_session() as conn:
        return fetch_all(conn, "SELECT * FROM meaningless_phrases ORDER BY meaningless_id", {})


@app.post("/meaningless_phrases", status_code=201)
async def create_meaningless_phrase(payload: CreateMeaninglessPhrase) -> dict:
    with db_session() as conn:
        cur = conn.execute(
            """
            INSERT INTO meaningless_phrases (card_role_id, phrase, created_at, updated_at)
            VALUES (:card_role_id, :phrase, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            """,
            payload.model_dump(),
        )
    return {"meaningless_id": cur.lastrowid}


@app.patch("/meaningless_phrases/{meaningless_id}")
async def update_meaningless_phrase(meaningless_id: int, payload: UpdateMeaninglessPhrase) -> dict:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join(f"{key} = :{key}" for key in data.keys())
    with db_session() as conn:
        updated = conn.execute(
            f"UPDATE meaningless_phrases SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE meaningless_id = :meaningless_id",
            {**data, "meaningless_id": meaningless_id},
        ).rowcount
    if updated == 0:
        raise HTTPException(status_code=404, detail="Meaningless phrase not found")
    return {"meaningless_id": meaningless_id}


@app.delete("/meaningless_phrases/{meaningless_id}", status_code=204)
async def delete_meaningless_phrase(meaningless_id: int) -> Response:
    with db_session() as conn:
        deleted = conn.execute(
            "DELETE FROM meaningless_phrases WHERE meaningless_id = :meaningless_id",
            {"meaningless_id": meaningless_id},
        ).rowcount
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Meaningless phrase not found")
    return Response(status_code=204)