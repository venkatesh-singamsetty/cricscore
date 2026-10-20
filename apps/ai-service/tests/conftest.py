import pytest

from cricscore_ai.providers import ProviderError
from cricscore_ai.repository import RepositoryError

MID = "11111111-1111-4111-8111-111111111111"


class FakeRepo:
    def __init__(self, match=True, fail=False, rules=None):
        self.match, self.fail, self.rules = match, fail, rules if rules is not None else []
        self.calls = []

    def _chk(self, name):
        self.calls.append(name)
        if self.fail:
            raise RepositoryError("boom")

    def get_match(self, match_id):
        self._chk("get_match")
        return {"id": MID, "team_a_name": "Lions", "team_b_name": "Tigers", "status": "COMPLETED",
                "team_a_score": 150, "team_b_score": 140, "match_winner": "Lions"} if self.match else None

    def get_match_statistics(self, match_id):
        self._chk("stats")
        return {"innings": [{"inning_number": 1, "total_runs": 150}], "topBatters": [], "topBowlers": []}

    def list_recent_matches(self, limit):
        self._chk("recent")
        return [{"id": MID, "team_a_name": "Lions", "team_b_name": "Tigers", "status": "COMPLETED"}] if self.match else []

    def search_rules(self, embedding, limit):
        self._chk("rules")
        return self.rules


class FakeLLM:
    def __init__(self, fail=False):
        self.fail, self.calls = fail, []

    def complete(self, system, messages):
        self.calls.append((system, messages))
        if self.fail:
            raise ProviderError("down")
        return "LLM ANSWER"


class FakeEmbedder:
    def embed(self, text):
        return [0.0] * 1536


class FakePredictor:
    def __init__(self):
        self.calls = []

    def predict(self, features):
        self.calls.append(features)
        return {"team1": features["team1"], "team2": features["team2"], "team1WinProbability": 0.62,
                "team2WinProbability": 0.38, "modelVersion": "v1.0.0+dp-sim"}


@pytest.fixture
def mid():
    return MID
