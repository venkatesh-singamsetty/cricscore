import pytest

from cricscore_ai import tools
from tests.conftest import FakeEmbedder, FakePredictor, FakeRepo, MID

GOOD = {"team1": "A", "team2": "B", "inning": 2, "ballsBowled": 60, "ballsLeft": 60,
        "currentScore": 80, "wicketsLost": 2, "targetScore": 150}


def test_match_details_found_and_missing():
    assert tools.get_match_details(FakeRepo(), MID)["found"] is True
    r = tools.get_match_details(FakeRepo(match=False), MID)
    assert r["found"] is False and r["sources"] == []


def test_invalid_match_id_rejected():
    with pytest.raises(ValueError):
        tools.get_match_details(FakeRepo(), "1; DROP TABLE matches")


def test_recent_limit_is_bounded():
    assert tools.list_recent_matches(FakeRepo(), 9999)["found"] is True


def test_rules_truncate_and_cite():
    repo = FakeRepo(rules=[{"id": "x", "document_name": "Rules.pdf", "chunk_text": "a" * 5000}])
    out = tools.search_tournament_rules(repo, FakeEmbedder(), "powerplay")
    assert len(out["chunks"][0]["text"]) == tools.MAX_RULE_CHARS
    assert out["sources"][0].id == "Rules.pdf"


def test_rules_requires_query():
    with pytest.raises(ValueError):
        tools.search_tournament_rules(FakeRepo(), FakeEmbedder(), "  ")


@pytest.mark.parametrize("patch,msg", [
    ({"inning": 3}, "inning"),
    ({"wicketsLost": 11}, "wicketsLost"),
    ({"ballsBowled": 200}, "1-20 overs"),
    ({"targetScore": -1}, "targetScore"),
    ({"currentScore": -5}, "non-negative"),
])
def test_prediction_validation(patch, msg):
    f, problems = tools.validate_prediction_input({**GOOD, **patch})
    assert f is None and any(msg in p for p in problems)


def test_prediction_missing_fields():
    f, problems = tools.validate_prediction_input({"team1": "A"})
    assert f is None and "missing" in problems[0]


def test_prediction_ok_includes_version_and_limits():
    out = tools.predict_match_outcome(FakePredictor(), GOOD)
    assert out["supported"] and out["modelVersion"] == "v1.0.0+dp-sim" and "not an outcome" in out["limitations"]


def test_unsupported_prediction_does_not_call_model():
    p = FakePredictor()
    assert tools.predict_match_outcome(p, {**GOOD, "inning": 9})["supported"] is False
    assert p.calls == []


def test_create_github_issue_validation(monkeypatch):
    with pytest.raises(ValueError, match="title"):
        tools.create_github_issue("abc", "valid description text")
    with pytest.raises(ValueError, match="description"):
        tools.create_github_issue("Valid title", "short")
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    with pytest.raises(tools.ProviderError):
        tools.create_github_issue("Valid title", "Valid detailed description here")


def test_get_match_weather_validation():
    with pytest.raises(ValueError, match="location"):
        tools.get_match_weather("x")
