import json
import os
import joblib
import pandas as pd

from win_probability import win_probability

# Cold Start Initialization
# Forces Terraform to rebuild the Docker container via null_resource triggers
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

        balls_bowled = max(0.0, float(body.get('ballsBowled', 0)))
        balls_left = max(0.0, balls_left)
        total_match_balls = balls_bowled + balls_left
        total_overs = total_match_balls / 6.0

        # 1. Format-agnostic ball-by-ball probability (exact DP, valid for 1-20 overs).
        sim_prob = win_probability(
            inning=int(inning),
            current_score=current_score,
            wickets_lost=wickets_lost,
            balls_left=balls_left,
            balls_bowled=balls_bowled,
            target_score=target_score,
        )

        # 2. Blend in the T20-trained ML model only where it is in-distribution.
        #    Weight 0 for <=10 overs, rising linearly to 0.5 for a full 20-over match.
        #    (Re-scaling short matches onto a 120-ball scale made the model output
        #    0%/100% far too early, e.g. "18 off 5" in a 1-over game.)
        model_weight = 0.5 * min(1.0, max(0.0, (total_overs - 10.0) / 10.0))
        model_prob = None
        if model is not None and model_weight > 0:
            scale = 120.0 / total_match_balls if 0 < total_match_balls < 120 else 1.0
            input_data = pd.DataFrame([{
                'batting_team': batting_team,
                'bowling_team': bowling_team,
                'inning': inning,
                'balls_left': balls_left * scale,
                'current_score': current_score * scale,
                'wickets_lost': wickets_lost,
                'target_score': target_score * scale if target_score > 0 else target_score,
            }])
            model_prob = float(model.predict_proba(input_data)[0][1])

        if model_prob is None:
            model_weight = 0.0
            model_prob = sim_prob
        batting_team_prob = (1.0 - model_weight) * sim_prob + model_weight * model_prob

        # Start of match baseline (before ball 0.1 is bowled): 50 / 50.
        if inning == 1 and current_score == 0 and wickets_lost == 0 and balls_bowled == 0:
            batting_team_prob = 0.50

        # Decided outcomes are certain; otherwise never show a hard 0% / 100%
        # while the match is still live (cricket always leaves a sliver of chance).
        decided = False
        if inning == 2 and target_score > 0:
            runs_needed = target_score - current_score
            if runs_needed <= 0:
                batting_team_prob, decided = 1.0, True
            elif wickets_lost >= 10 or balls_left <= 0 or runs_needed > balls_left * 6 + 1:
                batting_team_prob, decided = 0.0, True
        if not decided:
            batting_team_prob = min(0.99, max(0.01, batting_team_prob))

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
                'modelVersion': (metadata.get('modelVersion', 'v2') if metadata else 'v2') + '+dp-sim',
                'modelWeight': round(model_weight, 2)
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
