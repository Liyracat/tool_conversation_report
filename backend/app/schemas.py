from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


Visibility = Literal["normal", "hidden", "archived"]
SortDir = Literal["asc", "desc"]


class CardListItem(BaseModel):
    card_id: int
    thread_id: str
    message_id: int
    text_id: int
    split_version: int
    speaker_id: int
    speaker_name: Optional[str]
    conversation_at: str
    visibility: Visibility
    card_role_id: Optional[int]
    card_role_name: Optional[str]
    card_role_major_name: Optional[str]
    card_role_confidence: Optional[float]
    contents: str


class CardDetail(BaseModel):
    card_id: int
    thread_id: str
    message_id: int
    text_id: int
    split_version: int
    speaker_id: int
    speaker_name: Optional[str]
    conversation_at: str
    visibility: Visibility
    is_edited: int
    card_role_id: Optional[int]
    card_role_name: Optional[str]
    card_role_major_name: Optional[str]
    card_role_confidence: Optional[float]
    contents: str


class CardUpdate(BaseModel):
    contents: Optional[str] = None
    visibility: Optional[Visibility] = None
    card_role_id: Optional[int] = None


class RoleRecomputeResponse(BaseModel):
    queued: bool


class MergeResponse(BaseModel):
    merged_into_card_id: int
    deleted_card_id: int


class LinkCounts(BaseModel):
    supports: int = 0
    contradicts: int = 0
    refines: int = 0
    derived_from: int = 0
    example_of: int = 0
    depends_on: int = 0


class CardLinkItem(BaseModel):
    link_id: int
    link_kind_name: str
    confidence: Optional[float]
    from_card_id: int
    to_card_id: int
    to_card: dict


class ImportPreviewRequest(BaseModel):
    raw_text: str
    speaker_id: int
    conversation_at: str
    split_version: int = 1


class ImportPreviewResponse(BaseModel):
    thread_id: str
    message_id: int
    split_version: int
    parts: list[dict]


class ImportCommitRequest(BaseModel):
    thread_id: str
    message_id: int
    split_version: int
    speaker_id: int
    conversation_at: str
    parts: list[dict]


class LinkSuggestionGenerateRequest(BaseModel):
    from_card_ids: list[int]
    to_card_ids: list[int]


class LinkSuggestionRunRequest(BaseModel):
    limit: int = 50


class LinkSuggestionListItem(BaseModel):
    suggestion_id: int
    from_card_id: int
    to_card_id: int
    status: str
    suggested_link_kind_id: Optional[int]
    suggested_link_kind_name: Optional[str]
    suggested_confidence: Optional[float]


class LinkSuggestionApproveRequest(BaseModel):
    link_kind_id: Optional[int] = None


class LinkSuggestionRerunResponse(BaseModel):
    queued: bool


class SimpleMessageCard(BaseModel):
    card_id: int
    text_id: int
    contents: str
    card_role_name: Optional[str]


class MessageCardsResponse(BaseModel):
    thread_id: str
    message_id: int
    split_version: int
    cards: list[SimpleMessageCard]


class LinkKindUpdate(BaseModel):
    link_kind_id: int


class CreateSpeaker(BaseModel):
    speaker_name: str
    speaker_role: str
    canonical_role: Literal["human", "ai", "system", "unknown"]


class UpdateSpeaker(BaseModel):
    speaker_name: Optional[str] = None
    speaker_role: Optional[str] = None
    canonical_role: Optional[Literal["human", "ai", "system", "unknown"]] = None


class CreateMajorItem(BaseModel):
    major_name: str


class UpdateMajorItem(BaseModel):
    major_name: Optional[str] = None


class CreateCardRole(BaseModel):
    card_role_major_item_id: int
    minor_name: str


class UpdateCardRole(BaseModel):
    card_role_major_item_id: Optional[int] = None
    minor_name: Optional[str] = None


class CreateLinkKind(BaseModel):
    link_kind_name: str


class UpdateLinkKind(BaseModel):
    link_kind_name: Optional[str] = None


class CreateMeaninglessPhrase(BaseModel):
    card_role_id: int
    phrase: str


class UpdateMeaninglessPhrase(BaseModel):
    card_role_id: Optional[int] = None
    phrase: Optional[str] = None