import os
import json
import hashlib
from pathlib import Path
import joblib
import pandas as pd

try:
    import xgboost as _xgb  # Register XGBoost estimators for joblib unpickling
    _ = _xgb.__version__
except ImportError:
    # XGBoost is optional in minimal test fallback environments
    pass

from win_probability import win_probability

ENGINE_DIR = Path(__file__).resolve().parent
LOCAL_MODEL_FILE = ENGINE_DIR / 'live_win_predictor_model.joblib'
LOCAL_METADATA_FILE = ENGINE_DIR / 'live_metadata.json'
LOCAL_MANIFEST_FILE = ENGINE_DIR / 'model_manifest.json'

model = None
metadata = None
current_loaded_version = None


def compute_sha256(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        chunk = f.read(65536)
        while chunk:
            hasher.update(chunk)
            chunk = f.read(65536)
    return hasher.hexdigest()


def load_artifacts():
    """
    Safe loading of versioned model artifacts with checksum verification.
    Supports local bundling or versioned S3 loading (/tmp caching).
    """
    global model, metadata, current_loaded_version
    target_version = os.environ.get('MODEL_VERSION')
    s3_bucket = os.environ.get('MODEL_S3_BUCKET')

    # If already loaded and version matches, reuse
    if model is not None and (target_version is None or current_loaded_version == target_version):
        return

    try:
        model_path = LOCAL_MODEL_FILE
        meta_path = LOCAL_METADATA_FILE
        manifest_path = LOCAL_MANIFEST_FILE

        # S3 Remote Loading Mode
        if s3_bucket and target_version:
            import boto3
            cache_dir = Path('/tmp') / 'models' / target_version
            cache_dir.mkdir(parents=True, exist_ok=True)
            s3_model_path = cache_dir / 'live_win_predictor_model.joblib'
            s3_manifest_path = cache_dir / 'model_manifest.json'

            s3 = boto3.client('s3')
            if not s3_manifest_path.exists():
                s3.download_file(s3_bucket, f'models/{target_version}/model_manifest.json', str(s3_manifest_path))
            if not s3_model_path.exists():
                s3.download_file(s3_bucket, f'models/{target_version}/live_win_predictor_model.joblib', str(s3_model_path))

            model_path = s3_model_path
            manifest_path = s3_manifest_path

        # Read metadata or manifest
        if manifest_path.exists():
            with open(manifest_path, 'r') as f:
                manifest_data = json.load(f)
                expected_sha256 = manifest_data.get('artifact', {}).get('sha256')
                metadata = {
                    'modelVersion': manifest_data.get('modelVersion', target_version or 'v2.1.0'),
                    'algorithm': manifest_data.get('algorithm', 'HistGradientBoosting'),
                    'sha256': expected_sha256,
                }
        elif meta_path.exists():
            with open(meta_path, 'r') as f:
                metadata = json.load(f)
                expected_sha256 = metadata.get('sha256')
        else:
            metadata = {'modelVersion': target_version or 'v2.1.0'}
            expected_sha256 = None

        if not model_path.exists():
            print(f"⚠️ Model artifact {model_path} not found. Operating in DP+DLS simulation fallback mode.")
            model = None
            return

        # Checksum Validation
        if expected_sha256:
            actual_sha256 = compute_sha256(model_path)
            if actual_sha256 != expected_sha256:
                raise ValueError(
                    f"Model checksum verification failed! Expected {expected_sha256}, got {actual_sha256}. "
                    "Rejecting untrusted artifact."
                )

        model = joblib.load(model_path)
        current_loaded_version = metadata.get('modelVersion')
        print(f"✅ Successfully loaded approved model [{current_loaded_version}] from {model_path}")
    except Exception as e:
        print(f"❌ Failed to load model artifact: {e}. Falling back to format-agnostic DP simulation.")
        model = None


def handler(event, context):
    """
    AWS Lambda handler for live win predictions.
    Invoked via API Gateway (POST /match/predict).
    """
    try:
        body = json.loads(event.get('body', '{}'))
        batting_team = body.get('team1')  # Front-end passes batting team as team1
        bowling_team = body.get('team2')  # Front-end passes bowling team as team2

        # Live features
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
        # while the match is still live.
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
                'modelVersion': (metadata.get('modelVersion', 'v2.1.0') if metadata else 'v2.1.0') + '+dp-sim',
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
