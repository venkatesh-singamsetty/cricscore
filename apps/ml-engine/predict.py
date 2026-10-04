import json
import os
import joblib
import pandas as pd

# Cold Start Initialization
# If deployed to AWS Lambda, we can bundle the joblib file or download it from S3.
# To keep this version 100% free and simple (no S3 costs), we package the 1MB model 
# directly in the Lambda deployment package!
MODEL_FILE = os.path.join(os.path.dirname(__file__), 'win_predictor_model.joblib')
METADATA_FILE = os.path.join(os.path.dirname(__file__), 'metadata.json')

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
        team1 = body.get('team1')
        team2 = body.get('team2')
        venue = body.get('venue', 'Unknown')
        toss_winner = body.get('tossWinner', 'Unknown')
        toss_decision = body.get('tossDecision', 'Unknown')

        if not team1 or not team2:
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
            'team1': team1,
            'team2': team2,
            'venue': venue,
            'toss_winner': toss_winner,
            'toss_decision': toss_decision
        }])

        # Predict Win Probability for team1
        # predict_proba returns [prob_loss, prob_win] for the target class
        prediction_probs = model.predict_proba(input_data)
        team1_prob = prediction_probs[0][1]
        team2_prob = 1.0 - team1_prob

        predicted_winner = team1 if team1_prob > 0.5 else team2

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'team1': team1,
                'team2': team2,
                'team1WinProbability': round(team1_prob, 2),
                'team2WinProbability': round(team2_prob, 2),
                'predictedWinner': predicted_winner,
                'modelVersion': metadata.get('modelVersion', 'v1') if metadata else 'v1'
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
            'venue': 'Melbourne',
            'tossWinner': 'India',
            'tossDecision': 'bat'
        })
    }
    print(handler(test_event, None))
