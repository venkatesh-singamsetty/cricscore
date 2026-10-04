import json
import os
import pytest
import pandas as pd

import predict

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


def test_handler_valid_request():
    event = {
        'body': json.dumps({
            'team1': 'India',
            'team2': 'Australia',
            'inning': 2,
            'ballsLeft': 30,
            'currentScore': 150,
            'wicketsLost': 3,
            'targetScore': 180
        })
    }
    
    response = predict.handler(event, None)
    
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    
    assert body['team1'] == 'India'
    assert body['team2'] == 'Australia'
    assert body['team1WinProbability'] == 0.7
    assert body['team2WinProbability'] == 0.3
    assert body['predictedWinner'] == 'India'
    assert body['modelVersion'] == 'v2_test'

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
