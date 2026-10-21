import asyncio
import json

from cricscore_ai.graph import Deps
from cricscore_ai.mcp_server import create_server, get_model_metadata_info
from tests.conftest import FakeEmbedder, FakePredictor, FakeRepo, MID
from tests.test_tools import GOOD

APPROVED = {"get_match_details", "get_match_statistics", "list_recent_matches",
            "search_tournament_rules", "get_model_metadata", "predict_match_outcome",
            "create_github_issue", "get_match_weather"}


def call(server, name, args=None):
    res = asyncio.run(server.call_tool(name, args or {}))
    if isinstance(res, tuple):  # (content, structured)
        res = res[1] if res[1] else json.loads(res[0][0].text)
    elif hasattr(res, "structuredContent") and res.structuredContent:
        res = res.structuredContent
    elif hasattr(res, "content"):
        res = json.loads(res.content[0].text)
    return res.get("result", res) if isinstance(res, dict) and set(res) == {"result"} else res


def deps(**kw):
    return Deps(repo=kw.get("repo", FakeRepo()), embedder=FakeEmbedder(), predictor=FakePredictor())


def test_only_approved_read_tools_exposed():
    names = {t.name for t in asyncio.run(create_server(deps()).list_tools())}
    assert names == APPROVED
    assert not any(w in n for n in names for w in ("delete", "update", "write", "sql", "admin"))


def test_valid_match_request():
    out = call(create_server(deps()), "get_match_details", {"match_id": MID})
    assert out["found"] is True and out["sources"][0]["type"] == "match"


def test_missing_match_is_not_error():
    out = call(create_server(deps(repo=FakeRepo(match=False))), "get_match_details", {"match_id": MID})
    assert out["found"] is False and "error" not in out


def test_invalid_identifier_rejected_before_db():
    repo = FakeRepo()
    out = call(create_server(deps(repo=repo)), "get_match_details", {"match_id": "1' OR '1'='1"})
    assert out["error"].startswith("invalid input") and repo.calls == []


def test_database_error_is_safe():
    out = call(create_server(deps(repo=FakeRepo(fail=True))), "list_recent_matches", {"limit": 3})
    assert out == {"error": "data source unavailable"}


def test_unconfigured_dependency_reports_clearly():
    out = call(create_server(Deps()), "get_match_statistics", {"match_id": MID})
    assert "not configured" in out["error"]


def test_prediction_valid_and_unsupported():
    srv = create_server(deps())
    ok = call(srv, "predict_match_outcome", {k: GOOD[k] for k in GOOD})
    assert ok["supported"] and ok["modelVersion"] == "v1.0.0+dp-sim"
    bad = call(srv, "predict_match_outcome", {**GOOD, "inning": 5})
    assert bad["supported"] is False


def test_rules_search_blank_query_rejected():
    out = call(create_server(deps()), "search_tournament_rules", {"query": "  "})
    assert out["error"].startswith("invalid input")


def test_model_metadata_ok_and_missing(tmp_path):
    f = tmp_path / "m.json"
    f.write_text(json.dumps({"modelVersion": "v9", "metrics": {"a": 1}, "secret": "x"}))
    assert get_model_metadata_info(f) == {"modelVersion": "v9", "metrics": {"a": 1}}
    assert "error" in get_model_metadata_info(tmp_path / "none.json")
