"""Optional LangSmith tracing. Off unless explicitly enabled; inputs/outputs hidden."""
from __future__ import annotations

import os


def tracing_config() -> dict:
    """Returns a LangGraph `config` dict. Tracing needs LANGSMITH_TRACING=true AND a key.
    Payloads are hidden by default so match data / user text is not sent externally."""
    enabled = os.environ.get("LANGSMITH_TRACING", "").lower() == "true" and bool(os.environ.get("LANGSMITH_API_KEY"))
    if not enabled:
        os.environ["LANGSMITH_TRACING"] = "false"
        return {}
    os.environ.setdefault("LANGSMITH_HIDE_INPUTS", "true")
    os.environ.setdefault("LANGSMITH_HIDE_OUTPUTS", "true")
    return {"tags": ["cricscore-ai"], "metadata": {"service": "ai-service"}}
