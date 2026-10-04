import json
import os
import joblib
import boto3

# Cold Start Initialization
s3 = boto3.client('s3')
MODEL_FILE = '/tmp/win_predictor_model.joblib'
S3_BUCKET = os.environ.get('ML_S3_BUCKET', 'cricscore-ml-models-dev')
S3_KEY = 'win_predictor_model.joblib'
model = None

def load_model():
    global model
    if model is None:
        print("📥 Downloading model from S3...")
        s3.download_file(S3_BUCKET, S3_KEY, MODEL_FILE)
        print("🧠 Loading model into memory...")
        model = joblib.load(MODEL_FILE)
    return model

def handler(event, context):
    """
    AWS Lambda handler for live win predictions.
    Invoked via API Gateway from the main Node.js backend.
    """
    try:
        body = json.loads(event.get('body', '{}'))
        runs = body.get('runs', 0)
        wickets = body.get('wickets', 0)
        
        # Load model (only hits S3 on cold start)
        clf = load_model()
        
        # Predict Win Probability
        # For a binary classifier, predict_proba returns [prob_loss, prob_win]
        prediction_probs = clf.predict_proba([[runs, wickets]])
        win_prob = prediction_probs[0][1] * 100
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'win_probability': round(win_prob, 2),
                'team_a_prob': round(win_prob, 2),
                'team_b_prob': round(100 - win_prob, 2)
            })
        }
    except Exception as e:
        print(f"Error predicting: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to predict win probability'})
        }
