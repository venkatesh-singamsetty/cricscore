"""Request/response contracts. The reply shape stays compatible with the
existing frontend contract (`{reply}`); `sources`/`intent` are additive."""
from __future__ import annotations

import re
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

Intent = Literal["match_info", "rules", "analysis", "prediction", "clarify", "refuse"]


def validate_match_id(value: str) -> str:
    if not isinstance(value, str) or not UUID_RE.match(value):
        raise ValueError("matchId must be a UUID")
    return value.lower()


class HistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    matchId: Optional[str] = None
    history: list[HistoryItem] = Field(default_factory=list, max_length=10)
    # Verified by the trusted Node layer; never derived from user text.
    isAdmin: bool = False
    predictionInput: Optional[dict[str, Any]] = None

    @field_validator("matchId")
    @classmethod
    def _match_id(cls, v):
        return None if v in (None, "") else validate_match_id(v)

    @field_validator("history", mode="before")
    @classmethod
    def _history(cls, v):
        # Keep the most recent turns and drop roles the model must not receive (e.g. system/tool).
        items = [h for h in (v or []) if isinstance(h, dict) and h.get("role") in ("user", "assistant")]
        return items[-10:]


class Source(BaseModel):
    type: Literal["match", "rulebook", "model"]
    id: str
    label: str = ""


class ChatResponse(BaseModel):
    reply: str
    intent: Intent
    sources: list[Source] = Field(default_factory=list)
    modelVersion: Optional[str] = None
