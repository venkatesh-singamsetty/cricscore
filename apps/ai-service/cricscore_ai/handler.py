"""Lambda entry point. Invoked only by the Node chat-api adapter (IAM `lambda:InvokeFunction`);
there is no public URL / API Gateway route. The adapter authenticates the user and
supplies the verified `isAdmin` flag."""
from __future__ import annotations

import json
import os
from typing import Any

from pydantic import ValidationError

from .graph import Deps, build_graph, run_chat
from .providers import LambdaPredictor, OpenAICompatEmbedder, OpenAICompatLLM, ProviderError
from .repository import PostgresRepository, RepositoryError
from .schemas import ChatRequest
from .tracing import tracing_config

_graph = None
SAFE_ERROR = "The AI assistant is temporarily unavailable. Please try again shortly."


def _optional(factory):
    try:
        return factory()
    except (ProviderError, RepositoryError):
        return None


def _get_graph():
    """Built once per warm container; DB connection is cached inside the repository."""
    global _graph
    if _graph is None:
        _graph = build_graph(
            Deps(
                repo=_optional(PostgresRepository),
                llm=_optional(OpenAICompatLLM),
                embedder=_optional(OpenAICompatEmbedder),
                predictor=_optional(LambdaPredictor),
            )
        )
    return _graph


def handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    try:
        payload = event.get("body", event) if isinstance(event, dict) else {}
        if isinstance(payload, str):
            payload = json.loads(payload)
        request = ChatRequest.model_validate(payload)
    except (ValidationError, ValueError, TypeError):
        return {"statusCode": 400, "body": json.dumps({"error": "Invalid request"})}
    try:
        resp = run_chat(_get_graph(), request, tracing_config())
        return {"statusCode": 200, "body": resp.model_dump_json()}
    except Exception:  # never leak internals; details go to logs without payloads
        print("ai-service error")
        return {"statusCode": 500, "body": json.dumps({"error": SAFE_ERROR})}
