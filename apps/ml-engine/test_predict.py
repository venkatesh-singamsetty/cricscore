import json
import os
import pytest
import pandas as pd

import predict
_real_load_artifacts = predict.load_artifacts

@pytest.fixture(autouse=True)
def mock_load_artifacts(monkeypatch):
    """
    Mock the load_artifacts function so we don't need to load the real model during tests.
    We will create a dummy model class to return fixed probabilities.
    """
    class MockModel:
        def predict_proba(self, X):
            # Return fixed probabilities: [prob_loss, prob_win]
            # We'll just return [[0.3, 0.7]] meaning batting team has 70% win probability
            return [[0.3, 0.7]]

    def dummy_load():
        predict.model = MockModel()
        predict.metadata = {"modelVersion": "v2_test"}

    monkeypatch.setattr(predict, "load_artifacts", dummy_load)


def _call(**kwargs):
    payload = {'team1': 'India', 'team2': 'Australia'}
    payload.update(kwargs)
    response = predict.handler({'body': json.dumps(payload)}, None)
    assert response['statusCode'] == 200
    return json.loads(response['body'])


def test_handler_valid_request():
    # Full 20-over match: ML model (mocked 0.7) blended 50/50 with the DP engine.
    body = _call(inning=2, ballsLeft=30, ballsBowled=90, currentScore=150,
                 wicketsLost=3, targetScore=180)
    sim = predict.win_probability(2, 150, 3, 30, 90, 180)
    assert body['team1'] == 'India'
    assert body['team2'] == 'Australia'
    assert body['modelWeight'] == 0.5
    assert body['team1WinProbability'] == pytest.approx(round(0.5 * sim + 0.35, 2), abs=0.011)
    assert body['team1WinProbability'] + body['team2WinProbability'] == pytest.approx(1.0)
    assert body['modelVersion'].startswith('v2_test')


def test_handler_missing_teams():
    event = {
        'body': json.dumps({
            'inning': 1
        })
    }
    
    response = predict.handler(event, None)
    
    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert 'error' in body

def test_handler_invalid_json():
    event = {
        'body': 'invalid json string'
    }
    
    response = predict.handler(event, None)
    
    assert response['statusCode'] == 500
    body = json.loads(response['body'])
    assert 'error' in body


# ---------- Format-agnostic behaviour (any match length up to 20 overs) ----------

def test_short_match_ignores_t20_model():
    # 1-over match: the mocked T20 model (0.7) must not be used at all.
    body = _call(inning=2, ballsLeft=5, ballsBowled=1, currentScore=7,
                 wicketsLost=0, targetScore=25)
    assert body['modelWeight'] == 0.0


def test_one_over_chase_18_off_5_is_unlikely_but_not_zero():
    body = _call(inning=2, ballsLeft=5, ballsBowled=1, currentScore=7,
                 wicketsLost=0, targetScore=25)
    assert 0.01 <= body['team1WinProbability'] <= 0.12
    assert body['predictedWinner'] == 'Australia'


def test_one_over_chase_probability_decreases_with_runs_needed():
    probs = [
        _call(inning=2, ballsLeft=5, ballsBowled=1, currentScore=25 - need,
              wicketsLost=0, targetScore=25)['team1WinProbability']
        for need in (4, 8, 12, 18)
    ]
    assert probs == sorted(probs, reverse=True)
    assert probs[0] > 0.6


def test_decided_outcomes_are_certain():
    won = _call(inning=2, ballsLeft=3, ballsBowled=3, currentScore=20,
                wicketsLost=1, targetScore=20)
    assert won['team1WinProbability'] == 1.0
    impossible = _call(inning=2, ballsLeft=2, ballsBowled=4, currentScore=0,
                       wicketsLost=0, targetScore=20)
    assert impossible['team1WinProbability'] == 0.0
    all_out = _call(inning=2, ballsLeft=10, ballsBowled=50, currentScore=40,
                    wicketsLost=10, targetScore=60)
    assert all_out['team1WinProbability'] == 0.0


def test_live_match_never_shows_hard_zero_or_hundred():
    body = _call(inning=2, ballsLeft=6, ballsBowled=114, currentScore=150,
                 wicketsLost=2, targetScore=180)
    assert 0.0 < body['team1WinProbability'] < 1.0


@pytest.mark.parametrize("overs", [1, 2, 5, 10, 15, 20])
def test_fresh_chase_of_par_target_is_competitive_for_any_length(overs):
    balls = overs * 6
    par_target = int(round(balls * 1.35)) + 1
    p = predict.win_probability(2, 0, 0, balls, 0, par_target)
    assert 0.25 <= p <= 0.75


@pytest.mark.parametrize("overs", [1, 5, 10, 20])
def test_first_innings_starts_near_even_for_any_length(overs):
    from win_probability import first_innings_win_probability
    balls = overs * 6
    p = first_innings_win_probability(0, balls, 0, balls)
    assert 0.4 <= p <= 0.6


def test_first_innings_fast_start_favours_batting_side():
    from win_probability import first_innings_win_probability
    slow = first_innings_win_probability(2, 3, 0, 6)
    fast = first_innings_win_probability(12, 3, 0, 6)
    assert fast > slow


def test_dls_ahead_in_achievable_short_chase_favours_batting_side():
    # 1-over match, target 15 (1st inn 14). At 6/0 off 0.2 overs (need 9 off 4),
    # DLS Par is 4 (ahead by 2 runs) and CRR (18.0) > RRR (13.5) with 10 wickets in hand.
    body = _call(inning=2, ballsLeft=4, ballsBowled=2, currentScore=6,
                 wicketsLost=0, targetScore=15)
    assert body['team1WinProbability'] > 0.5
    assert body['predictedWinner'] == 'India'



# ---------- Model Versioning & Safe Checksum Validation Tests ----------

def test_compute_sha256(tmp_path):
    test_file = tmp_path / "sample.bin"
    test_file.write_bytes(b"cricscore-mlops-test-bytes")
    # sha256 of b"cricscore-mlops-test-bytes"
    expected = "992a91979398e485327a890f9929f477614c3780232c0076b0e1014d899d7870"
    assert predict.compute_sha256(test_file) == expected


def test_load_artifacts_rejects_checksum_mismatch(tmp_path, monkeypatch):
    corrupt_model = tmp_path / "corrupt.joblib"
    corrupt_model.write_bytes(b"tampered-content")
    
    corrupt_manifest = tmp_path / "manifest.json"
    corrupt_manifest.write_text(json.dumps({
        "modelVersion": "v-corrupt",
        "artifact": {"sha256": "0000000000000000000000000000000000000000000000000000000000000000"}
    }))

    monkeypatch.setattr(predict, "LOCAL_MODEL_FILE", corrupt_model)
    monkeypatch.setattr(predict, "LOCAL_MANIFEST_FILE", corrupt_manifest)
    monkeypatch.setattr(predict, "model", None)
    monkeypatch.delenv("MODEL_S3_BUCKET", raising=False)

    _real_load_artifacts()
    # Checksum mismatch caught, model falls back to None (DP simulation)
    assert predict.model is None


def test_load_artifacts_missing_file_falls_back_gracefully(tmp_path, monkeypatch):
    missing_model = tmp_path / "nonexistent.joblib"
    monkeypatch.setattr(predict, "LOCAL_MODEL_FILE", missing_model)
    monkeypatch.setattr(predict, "model", None)
    monkeypatch.delenv("MODEL_S3_BUCKET", raising=False)

    _real_load_artifacts()
    assert predict.model is None
