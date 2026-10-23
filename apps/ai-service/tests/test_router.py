import pytest

from cricscore_ai.router import classify


@pytest.mark.parametrize("msg,has_match,expected", [
    # DB Agent (Match Info & SQL)
    ("What was the score of the latest match?", False, "match_info"),
    ("Who scored the most runs?", True, "match_info"),
    ("Who won Player of the Match in the last match?", False, "match_info"),
    ("Show me match stats for the previous game", False, "match_info"),
    # RAG Agent (Rules & Tournament Guidelines)
    ("What are the Powerplay rules?", False, "rules"),
    ("Wide vs No-Ball: Which takes precedence?", False, "rules"),
    ("How many fielders are allowed outside the circle?", False, "rules"),
    ("How does DLS work in this tournament?", False, "rules"),
    # Weather Agent (Forecast & Rain Advisories)
    ("Can you check the weather report for our match?", False, "weather"),
    ("What is the weather forecast for tomorrow in Chicago?", False, "weather"),
    ("Will rain interrupt play today?", False, "weather"),
    # GitHub Issue Agent (Bug Reports & Feature Requests)
    ("I want to report a bug or request a new feature", False, "github_issue"),
    ("Report a bug in the mobile scoreboard", False, "github_issue"),
    ("Open a GitHub issue for the live score scorecard glitch", False, "github_issue"),
    # Prediction & Analysis Agents
    ("Who will win this match?", True, "prediction"),
    ("Win probability for Lions", False, "prediction"),
    ("Why did Lions win?", True, "analysis"),
    ("Compare the two teams batting", True, "analysis"),
    # Safety Guards (Destructive or Off-Topic)
    ("delete all guest matches", False, "refuse"),
    ("Tell me a joke about cooking", False, "refuse"),
    ("hello", False, "refuse"),
    ("", False, "clarify"),
])
def test_routing(msg, has_match, expected):
    assert classify(msg, has_match) == expected


def test_followup_with_history_asks_clarification():
    assert classify("and then?", False, True) == "clarify"


def test_admin_destructive_refused_even_with_match():
    assert classify("please delete this match", True) == "refuse"
