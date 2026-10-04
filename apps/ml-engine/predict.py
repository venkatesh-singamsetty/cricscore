import json
import os
import joblib
import pandas as pd

# Cold Start Initialization
# Using the new live model
MODEL_FILE = os.path.join(os.path.dirname(__file__), 'live_win_predictor_model.joblib')
METADATA_FILE = os.path.join(os.path.dirname(__file__), 'live_metadata.json')

model = None
metadata = None

def load_artifacts():
    global model, metadata
    if model is None:
        try:
            model = joblib.load(MODEL_FILE)
            with open(METADATA_FILE, 'r') as f:
                metadata = json.load(f)
        except Exception as e:
            print(f"Failed to load model: {e}")

def handler(event, context):
    """
    AWS Lambda handler for live win predictions.
    Invoked via API Gateway (POST /match/predict).
    """
    try:
        body = json.loads(event.get('body', '{}'))
        batting_team = body.get('team1') # Front-end passes batting team as team1
        bowling_team = body.get('team2') # Front-end passes bowling team as team2
        
        # New live features
        inning = float(body.get('inning', 1))
        balls_left = float(body.get('ballsLeft', 120))
        current_score = float(body.get('currentScore', 0))
        wickets_lost = float(body.get('wicketsLost', 0))
        target_score = float(body.get('targetScore', -1))

        if not batting_team or not bowling_team:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'team1 and team2 are required'})
            }

        load_artifacts()

        if not model:
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Model not loaded'})
            }

        # Create input DataFrame matching training feature structure
        input_data = pd.DataFrame([{
            'batting_team': batting_team,
            'bowling_team': bowling_team,
            'inning': inning,
            'balls_left': balls_left,
            'current_score': current_score,
            'wickets_lost': wickets_lost,
            'target_score': target_score
        }])

        # Predict Win Probability for batting_team (target class 1)
        # predict_proba returns [prob_loss, prob_win] for the target class
        prediction_probs = model.predict_proba(input_data)
        batting_team_prob = prediction_probs[0][1]
        bowling_team_prob = 1.0 - batting_team_prob

        predicted_winner = batting_team if batting_team_prob > 0.5 else bowling_team

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'team1': batting_team,
                'team2': bowling_team,
                'team1WinProbability': round(batting_team_prob, 2),
                'team2WinProbability': round(bowling_team_prob, 2),
                'predictedWinner': predicted_winner,
                'modelVersion': metadata.get('modelVersion', 'v2') if metadata else 'v2'
            })
        }
    except Exception as e:
        print(f"Error predicting: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

if __name__ == "__main__":
    # Local Testing
    test_event = {
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
    print(handler(test_event, None))
