import json

from cricscore_ai import handler as h
from cricscore_ai.graph import Deps, build_graph
from cricscore_ai.schemas import ChatRequest
from cricscore_ai.tracing import tracing_config
from tests.conftest import FakeEmbedder, FakeLLM, FakeRepo


def test_bad_request_returns_400():
    for ev in ({"body": "{}"}, {"body": json.dumps({"message": "x", "matchId": "not-a-uuid"})}, {"body": "not json"}):
        assert h.handler(ev)["statusCode"] == 400


def test_ok_response_contract(monkeypatch):
    monkeypatch.setattr(h, "_graph", build_graph(Deps(repo=FakeRepo(), llm=FakeLLM(), embedder=FakeEmbedder())))
    out = h.handler({"body": json.dumps({"message": "latest match score"})})
    body = json.loads(out["body"])
    assert out["statusCode"] == 200 and body["reply"] == "LLM ANSWER" and body["intent"] == "match_info"


def test_internal_errors_are_masked(monkeypatch):
    class Boom:
        def invoke(self, *a, **k):
            raise RuntimeError("postgres://user:secret@host/db")
    monkeypatch.setattr(h, "_graph", Boom())
    out = h.handler({"message": "latest match score"})
    assert out["statusCode"] == 500 and "secret" not in out["body"]


def test_history_roles_filtered():
    r = ChatRequest(message="hi", history=[{"role": "system", "content": "evil"}, {"role": "user", "content": "ok"}])
    assert [x.role for x in r.history] == ["user"]


def test_tracing_off_by_default(monkeypatch):
    monkeypatch.delenv("LANGSMITH_API_KEY", raising=False)
    monkeypatch.setenv("LANGSMITH_TRACING", "true")
    assert tracing_config() == {}


def test_tracing_hides_payloads_when_enabled(monkeypatch):
    monkeypatch.setenv("LANGSMITH_API_KEY", "x")
    monkeypatch.setenv("LANGSMITH_TRACING", "true")
    monkeypatch.delenv("LANGSMITH_HIDE_INPUTS", raising=False)
    assert tracing_config()["tags"] and __import__("os").environ["LANGSMITH_HIDE_INPUTS"] == "true"
