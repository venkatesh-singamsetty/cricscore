import json
from apps.ml_engine.predict import handler

test_event = {
    'body': json.dumps({
        'team1': 'TEAM B',
        'team2': 'TEAM A',
        'inning': 2,
        'ballsLeft': 1,
        'currentScore': 0,
        'wicketsLost': 0,
        'targetScore': 25
    })
}
print(handler(test_event, None))
