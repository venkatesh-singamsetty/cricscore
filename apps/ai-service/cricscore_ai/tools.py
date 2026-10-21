"""Specialist tools: validated inputs, structured outputs with source refs."""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from .providers import Embedder, Predictor, ProviderError
from .repository import MAX_ROWS, Repository
from .schemas import Source, validate_match_id

RULES_TOP_K = 8
MAX_RULE_CHARS = 1500
DEFAULT_GITHUB_REPO = "venkatesh-singamsetty/cricscore"
_REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
_ALLOWED_ISSUE_CATEGORIES = {"bug", "feature-request", "feedback"}


def _jsonable(row: dict[str, Any]) -> dict[str, Any]:
    return {k: (v.isoformat() if hasattr(v, "isoformat") else str(v) if k == "id" else v) for k, v in row.items()}


def get_match_details(repo: Repository, match_id: str) -> dict[str, Any]:
    """Returns {found, match, sources}. `found=False` is a genuine 'no such match', not an error."""
    match_id = validate_match_id(match_id)
    row = repo.get_match(match_id)
    if row is None:
        return {"found": False, "match": None, "sources": []}
    m = _jsonable(row)
    return {"found": True, "match": m, "sources": [Source(type="match", id=m["id"], label=f"{m['team_a_name']} vs {m['team_b_name']}")]}


def get_match_statistics(repo: Repository, match_id: str) -> dict[str, Any]:
    match_id = validate_match_id(match_id)
    stats = repo.get_match_statistics(match_id)
    clean = {k: [_jsonable(r) for r in rows] for k, rows in stats.items()}
    has_data = any(clean.values())
    return {"found": has_data, "statistics": clean, "sources": [Source(type="match", id=match_id, label="match statistics")] if has_data else []}


def list_recent_matches(repo: Repository, limit: int = 5) -> dict[str, Any]:
    limit = max(1, min(int(limit), MAX_ROWS))
    rows = [_jsonable(r) for r in repo.list_recent_matches(limit)]
    return {
        "found": bool(rows),
        "matches": rows,
        "sources": [Source(type="match", id=r["id"], label=f"{r['team_a_name']} vs {r['team_b_name']}") for r in rows],
    }


def search_tournament_rules(repo: Repository, embedder: Embedder, query: str) -> dict[str, Any]:
    """Retrieved text is untrusted data: truncated, and later wrapped as quoted evidence."""
    q = (query or "").strip()
    if not q:
        raise ValueError("query is required")
    rows = repo.search_rules(embedder.embed(q[:1000]), RULES_TOP_K)
    chunks = [
        {"document": r["document_name"], "text": str(r["chunk_text"])[:MAX_RULE_CHARS], "id": str(r["id"])}
        for r in rows
    ]
    seen: dict[str, Source] = {}
    for c in chunks:
        seen.setdefault(c["document"], Source(type="rulebook", id=c["document"], label=c["document"]))
    return {"found": bool(chunks), "chunks": chunks, "sources": list(seen.values())}


_REQUIRED_PREDICT = ("team1", "team2", "inning", "ballsBowled", "ballsLeft", "currentScore", "wicketsLost")


def validate_prediction_input(raw: dict[str, Any] | None) -> tuple[dict[str, Any] | None, list[str]]:
    """Returns (features, problems). Schema mirrors apps/ml-engine/predict.py."""
    raw = raw or {}
    missing = [k for k in _REQUIRED_PREDICT if raw.get(k) in (None, "")]
    if missing:
        return None, [f"missing: {', '.join(missing)}"]
    problems: list[str] = []
    try:
        f = {
            "team1": str(raw["team1"])[:100],
            "team2": str(raw["team2"])[:100],
            "inning": int(raw["inning"]),
            "ballsBowled": int(raw["ballsBowled"]),
            "ballsLeft": int(raw["ballsLeft"]),
            "currentScore": int(raw["currentScore"]),
            "wicketsLost": int(raw["wicketsLost"]),
            "targetScore": int(raw.get("targetScore", -1) if raw.get("targetScore") is not None else -1),
        }
    except (TypeError, ValueError):
        return None, ["numeric fields must be integers"]
    if f["inning"] not in (1, 2):
        problems.append("inning must be 1 or 2")
    if not 0 <= f["wicketsLost"] <= 10:
        problems.append("wicketsLost must be 0-10")
    if f["ballsBowled"] < 0 or f["ballsLeft"] < 0 or f["currentScore"] < 0:
        problems.append("balls and score must be non-negative")
    if not 1 <= f["ballsBowled"] + f["ballsLeft"] <= 120:
        problems.append("supported formats are 1-20 overs")
    if f["inning"] == 2 and f["targetScore"] <= 0:
        problems.append("targetScore is required for the 2nd innings")
    if not re.search(r"\S", f["team1"]) or not re.search(r"\S", f["team2"]):
        problems.append("team names required")
    return (None, problems) if problems else (f, [])


def predict_match_outcome(predictor: Predictor, raw: dict[str, Any] | None) -> dict[str, Any]:
    features, problems = validate_prediction_input(raw)
    if features is None:
        return {"supported": False, "problems": problems}
    out = predictor.predict(features)
    return {
        "supported": True,
        "prediction": out,
        "modelVersion": out.get("modelVersion"),
        "limitations": "Estimated probability, not an outcome. Based on current innings state; ignores pitch, weather and player quality.",
        "sources": [Source(type="model", id=str(out.get("modelVersion", "unknown")), label="win probability model")],
    }


def create_github_issue(title: str, description: str, category: str = "bug") -> dict[str, Any]:
    """Creates a GitHub issue in the configured CricScore repository via server-side GITHUB_TOKEN."""
    clean_title = (title or "").strip()
    clean_desc = (description or "").strip()
    clean_cat = (category or "bug").strip()
    if clean_cat not in _ALLOWED_ISSUE_CATEGORIES:
        clean_cat = "bug"
    if len(clean_title) < 5:
        raise ValueError("title must be at least 5 characters")
    if len(clean_desc) < 10:
        raise ValueError("description must be at least 10 characters")

    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if not token:
        raise ProviderError("GitHub token is not configured")

    configured_repo = os.environ.get("GITHUB_REPO", DEFAULT_GITHUB_REPO).strip()
    repo = configured_repo if _REPO_RE.match(configured_repo) else DEFAULT_GITHUB_REPO

    payload = json.dumps(
        {
            "title": f"[AI Report] {clean_title[:120]}",
            "body": (
                f"### Reported via CricScore AI Assistant\n"
                f"- **Category:** `{clean_cat}`\n\n"
                f"### Description\n{clean_desc[:2000]}"
            ),
            "labels": ["via-cricscore-ai", clean_cat],
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/issues",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "CricScore-MCP-Issue-Agent",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:  # nosec B310
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError) as exc:
        raise ProviderError("Failed to create GitHub issue") from exc

    issue_num = data.get("number")
    issue_url = data.get("html_url", "")
    return {
        "found": True,
        "created": True,
        "issueNumber": issue_num,
        "url": issue_url,
        "title": data.get("title", clean_title),
        "sources": [Source(type="github_issue", id=str(issue_num), label=issue_url)],
    }


def get_match_weather(location: str, target_date: str = "today", hours_ahead: int = 6) -> dict[str, Any]:
    """Fetches hourly match weather forecast via Open-Meteo (free, no API key required)."""
    clean_loc = (location or "").strip()
    if len(clean_loc) < 2:
        raise ValueError("location must be at least 2 characters")
    clean_date = (target_date or "today").strip().lower()
    hours = max(1, min(24, int(hours_ahead or 6)))

    geo_url = (
        "https://geocoding-api.open-meteo.com/v1/search?name="
        + urllib.parse.quote(clean_loc.split(",")[0].strip())
        + "&count=1&language=en&format=json"
    )
    try:
        with urllib.request.urlopen(geo_url, timeout=8) as resp:  # nosec B310
            geo = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError) as exc:
        raise ProviderError("Failed to geocode location") from exc

    results = geo.get("results") or []
    if not results:
        return {"found": False, "location": clean_loc, "sources": []}
    place = results[0]
    lat, lon = place["latitude"], place["longitude"]
    label = ", ".join(filter(None, [place.get("name"), place.get("admin1"), place.get("country")]))

    fc_url = (
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
        "&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m"
        "&timezone=auto&forecast_days=3"
    )
    try:
        with urllib.request.urlopen(fc_url, timeout=8) as resp:  # nosec B310
            fc = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError) as exc:
        raise ProviderError("Failed to fetch weather forecast") from exc

    hourly = fc.get("hourly") or {}
    times = hourly.get("time") or []
    temps = hourly.get("temperature_2m") or []
    probs = hourly.get("precipitation_probability") or []
    winds = hourly.get("wind_speed_10m") or []

    rows = [
        {
            "time": times[i],
            "tempC": round(temps[i]) if i < len(temps) else 0,
            "rainProbabilityPercent": probs[i] if i < len(probs) else 0,
            "windSpeedKmh": round(winds[i]) if i < len(winds) else 0,
        }
        for i in range(min(len(times), hours))
    ]
    return {
        "found": True,
        "location": label,
        "targetDate": clean_date,
        "hourlyForecast": rows,
        "sources": [Source(type="weather", id=label, label=f"Open-Meteo ({label})")],
    }
