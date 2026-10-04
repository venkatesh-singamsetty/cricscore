import os
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
import joblib
import boto3

# Configuration
DATA_FILE = 'data/matches.csv'
MODEL_FILE = 'win_predictor_model.joblib'
S3_BUCKET = os.environ.get('ML_S3_BUCKET', 'cricscore-ml-models-dev')

def train_model():
    print("🏏 Starting CricScore ML Training Pipeline...")

    # 1. Load Data
    if not os.path.exists(DATA_FILE):
        print(f"❌ Error: {DATA_FILE} not found.")
        print("Please download a Kaggle dataset (e.g. IPL ball-by-ball) and place it in the data/ directory.")
        return
        
    print("📊 Loading dataset...")
    df = pd.read_csv(DATA_FILE)

    # 2. Preprocess Data (Dummy implementation for scaffold)
    # You will extract features like: Runs, Wickets, Target, Balls Remaining
    print("⚙️ Preprocessing features...")
    # X = df[['runs_scored', 'wickets_fallen', 'balls_remaining', 'target']]
    # y = df['win']
    
    # Dummy data for scaffold testing
    X = pd.DataFrame({'runs': [50, 100, 150, 200], 'wickets': [2, 4, 6, 8]})
    y = pd.Series([1, 1, 0, 0])

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 3. Train Model
    print("🧠 Training Logistic Regression model...")
    model = LogisticRegression()
    model.fit(X_train, y_train)

    # 4. Evaluate
    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    print(f"✅ Model trained! Accuracy: {accuracy * 100:.2f}%")

    # 5. Save Model
    joblib.dump(model, MODEL_FILE)
    print(f"💾 Model saved locally to {MODEL_FILE}")

    # 6. Upload to S3 (if running in GitHub Actions)
    if os.environ.get('CI') == 'true':
        print(f"☁️ Uploading model to S3 bucket: {S3_BUCKET}")
        s3 = boto3.client('s3')
        s3.upload_file(MODEL_FILE, S3_BUCKET, MODEL_FILE)
        print("🚀 Successfully uploaded to AWS S3!")

if __name__ == "__main__":
    train_model()
