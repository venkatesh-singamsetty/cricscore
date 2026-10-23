"""Deterministic intent classifier. Cheap, testable, and never calls an LLM."""
from __future__ import annotations

import re

from .schemas import Intent

_ADMIN = re.compile(r"\b(delete|remove|wipe|purge|prune|clear|drop|truncate)\b", re.I)
_GITHUB_ISSUE = re.compile(
    r"\b(github\s+issue|raise\s+(an?\s+)?(github\s+)?issue|report\s+(a\s+)?(bug|issue)|feature\s+request|request\s+a\s+(new\s+)?feature|open\s+(an?\s+)?(github\s+)?issue)\b",
    re.I,
)
_WEATHER = re.compile(
    r"\b(weather(\s+report|\s+forecast)?|forecast|temperature|rain\w*|precipitation|hourly\s+weather|next\s+\d*\s*few?\s*hours)\b",
    re.I,
)
_PREDICT = re.compile(r"\b(predict\w*|win probability|chances?|who (will|is going to) win|likely to win|odds)\b", re.I)
_RULES = re.compile(
    r"\b(rules?|regulations?|powerplay|lbw|dls|duckworth|tiebreak\w*|super over|penalt\w+|eligib\w+|"
    r"free hit|wide|no[- ]ball|leg byes?|policy|reserve day|fielding restrictions?|fielders?|circle)\b",
    re.I,
)
_ANALYSIS = re.compile(r"\b(why|analy[sz]\w*|compare|comparison|turning point|how did|explain|insight|review)\b", re.I)
_MATCH = re.compile(
    r"\b(match(es)?|score\w*|runs?|wickets?|result|won|winner|toss|overs?|latest|recent|last|"
    r"top|best|standings?|innings|batter|bowler|stats?|statistics|target|vs)\b",
    re.I,
)
_CRICKET = re.compile(r"\b(cricket|team|player|bat\w*|bowl\w*|six(es)?|four(s)?|catch|stump\w*)\b", re.I)


def classify(message: str, has_match: bool = False, has_history: bool = False) -> Intent:
    text = (message or "").strip()
    if not text:
        return "clarify"
    if _ADMIN.search(text) and re.search(r"\b(match(es)?|guest|data|records?|rulebooks?)\b", text, re.I):
        # The Python service is read-only; destructive actions are never performed here.
        return "refuse"
    if _GITHUB_ISSUE.search(text):
        return "github_issue"
    if _WEATHER.search(text) and not _RULES.search(text):
        return "weather"
    if _PREDICT.search(text):
        return "prediction"
    if _RULES.search(text):
        return "rules"
    if _ANALYSIS.search(text) and (has_match or _MATCH.search(text) or _CRICKET.search(text)):
        return "analysis"
    if _MATCH.search(text) or (has_match and _CRICKET.search(text)):
        return "match_info"
    if has_history or has_match:
        return "clarify"
    return "refuse" if not _CRICKET.search(text) else "clarify"
