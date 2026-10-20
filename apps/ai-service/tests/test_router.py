import pytest

from cricscore_ai.router import classify


@pytest.mark.parametrize("msg,has_match,expected", [
    ("What was the score of the latest match?", False, "match_info"),
    ("Who scored the most runs?", True, "match_info"),
    ("What is the powerplay rule?", False, "rules"),
    ("How does DLS work in this tournament?", False, "rules"),
    ("Who will win this match?", True, "prediction"),
    ("Win probability for Lions", False, "prediction"),
    ("Why did Lions win?", True, "analysis"),
    ("Compare the two teams batting", True, "analysis"),
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
