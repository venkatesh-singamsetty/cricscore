import os
import json
import datetime
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score, log_loss, roc_auc_score, confusion_matrix
import joblib

# Configuration
DATA_FILE = 'data/matches.csv'
MODEL_FILE = 'win_predictor_model.joblib'
METADATA_FILE = 'metadata.json'

def train_model():
    print("🏏 Starting CricScore ML Training Pipeline...")

    if not os.path.exists(DATA_FILE):
        print(f"❌ Error: {DATA_FILE} not found. Please run data_pipeline.py first.")
        return

    print("📊 Loading dataset...")
    df = pd.read_csv(DATA_FILE)
    
    print("⚙️ Engineering features...")
    # Features: team1, team2, venue, toss_winner, toss_decision
    # Target: winner == team1 (1 if team1 wins, 0 if team2 wins)
    
    # We will predict whether 'team1' wins.
    # To avoid bias from the order of team1 and team2, we randomly swap 50% of the matches.
    # Actually, team1 and team2 are arbitrary, but let's just create a binary target
    df['target'] = (df['winner'] == df['team1']).astype(int)
    
    # We don't want rows where winner is neither team1 nor team2 (e.g. ties or no results, though we filtered them out)
    df = df[df['winner'].isin(df['team1']) | df['winner'].isin(df['team2'])]
    
    features = ['team1', 'team2', 'venue', 'toss_winner', 'toss_decision']
    X = df[features]
    y = df['target']
    
    # Time-aware split: Train on first 80% chronologically, test on last 20%
    # This prevents data leakage from future matches.
    split_idx = int(len(df) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    
    print(f"🚂 Training on {len(X_train)} matches, testing on {len(X_test)} matches...")

    # Create Pipeline
    categorical_transformer = OneHotEncoder(handle_unknown='ignore')
    preprocessor = ColumnTransformer(
        transformers=[('cat', categorical_transformer, features)]
    )
    
    # Using Logistic Regression because it's ultra-lightweight (perfect for AWS Lambda 250MB limits)
    # and outputs excellent calibrated probabilities (crucial for win prediction bars).
    clf = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', LogisticRegression(max_iter=1000))
    ])
    
    clf.fit(X_train, y_train)
    
    # Evaluation
    print("📈 Evaluating model...")
    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]
    
    accuracy = accuracy_score(y_test, y_pred)
    loss = log_loss(y_test, y_prob)
    try:
        roc_auc = roc_auc_score(y_test, y_prob)
    except ValueError:
        roc_auc = 0.5
        
    cm = confusion_matrix(y_test, y_pred).tolist()
    
    print(f"✅ Accuracy: {accuracy:.4f}")
    print(f"✅ Log Loss: {loss:.4f} (Crucial for probability calibration)")
    print(f"✅ ROC-AUC: {roc_auc:.4f}")

    # Save Model
    joblib.dump(clf, MODEL_FILE)
    print(f"💾 Model saved locally to {MODEL_FILE}")
    
    # Save Metadata
    metadata = {
        "modelVersion": "v1.0.0",
        "trainingDate": datetime.datetime.now().isoformat(),
        "datasetSource": "Cricsheet T20s",
        "numMatchesTrained": len(X_train),
        "numMatchesTested": len(X_test),
        "features": features,
        "modelType": "LogisticRegression (scikit-learn)",
        "metrics": {
            "accuracy": accuracy,
            "logLoss": loss,
            "rocAuc": roc_auc,
            "confusionMatrix": cm
        }
    }
    
    with open(METADATA_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"💾 Metadata saved to {METADATA_FILE}")
    

if __name__ == "__main__":
    train_model()
