import json
import os
import joblib
import pandas as pd

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

        # 1. Start of Match / 1st Innings Baseline:
        # At the start of 1st innings when score is 0 and no wickets lost, 
        # both teams have equal baseline chance (50% / 50%).
        if inning == 1 and current_score == 0 and wickets_lost == 0:
            batting_team_prob = 0.50

        bowling_team_prob = 1.0 - batting_team_prob

        # HEURISTIC OVERRIDE: Impossible Chases & Extreme Required Run Rates (RRR)
        # The Logistic Regression model is trained purely on T20 data (average targets ~160).
        # In shortened matches (e.g. 1-over matches), a target of 21 tricks the linear model 
        # into thinking the chase is incredibly easy, leading to a 90%+ probability hallucination.
        # We apply an RRR heuristic to cap the probability based on real cricket difficulty.
        if inning == 2 and target_score > 0:
            runs_needed = target_score - current_score
            max_possible_runs = balls_left * 6
            
            if runs_needed > max_possible_runs:
                # Mathematically impossible to win
                batting_team_prob = 0.0
                bowling_team_prob = 1.0
            elif runs_needed <= 0:
                # Already won
                batting_team_prob = 1.0
                bowling_team_prob = 0.0
            elif balls_left > 0:
                # Calculate RRR
                rrr = (runs_needed / balls_left) * 6
                # Cap the maximum probability the batting team can have based on how steep the RRR is
                if rrr > 18:
                    batting_team_prob = min(batting_team_prob, 0.01)
                elif rrr > 15:
                    batting_team_prob = min(batting_team_prob, 0.05)
                elif rrr > 12:
                    batting_team_prob = min(batting_team_prob, 0.15)
                elif rrr > 10:
                    batting_team_prob = min(batting_team_prob, 0.35)
                
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
