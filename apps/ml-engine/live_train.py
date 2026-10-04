import os
import json
import datetime
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score, log_loss, roc_auc_score
import joblib

DATA_FILE = 'data/live_data.csv'
MODEL_FILE = 'live_win_predictor_model.joblib'
METADATA_FILE = 'live_metadata.json'

def train_model():
    print("🏏 Starting Live ML Training Pipeline...")

    if not os.path.exists(DATA_FILE):
        print(f"❌ Error: {DATA_FILE} not found.")
        return

    print("📊 Loading dataset...")
    df = pd.read_csv(DATA_FILE)
    
    print("⚙️ Engineering features...")
    # Features: batting_team, bowling_team, inning, balls_left, current_score, wickets_lost, target_score
    # Target: winner == batting_team (1 if batting_team wins, 0 if bowling_team wins)
    
    # Filter rows with unknown winners (if any snuck in)
    df = df[df['winner'].isin(df['batting_team']) | df['winner'].isin(df['bowling_team'])].copy()
    
    df['target'] = (df['winner'] == df['batting_team']).astype(int)
    
    # We will sample a fraction of the data to keep training ultra-fast in this environment
    # but still enough to learn the patterns well.
    print(f"Original size: {len(df)} rows")
    if len(df) > 100000:
        df = df.sample(100000, random_state=42)
        print(f"Sampled down to: {len(df)} rows for faster training")
    
    categorical_features = ['batting_team', 'bowling_team', 'inning']
    numeric_features = ['balls_left', 'current_score', 'wickets_lost', 'target_score']
    features = categorical_features + numeric_features
    
    X = df[features]
    y = df['target']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print(f"🚂 Training on {len(X_train)} balls, testing on {len(X_test)} balls...")

    # Create Pipeline
    categorical_transformer = OneHotEncoder(handle_unknown='ignore')
    numeric_transformer = StandardScaler()
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('cat', categorical_transformer, categorical_features),
            ('num', numeric_transformer, numeric_features)
        ]
    )
    
    # Using Logistic Regression because it's ultra-lightweight and calibrated
    clf = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', LogisticRegression(max_iter=1000, n_jobs=1))
    ])
    
    clf.fit(X_train, y_train)
    
    # Evaluation
    print("📈 Evaluating model...")
    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]
    
    accuracy = accuracy_score(y_test, y_pred)
    loss = log_loss(y_test, y_prob)
    roc_auc = roc_auc_score(y_test, y_prob)
    
    print(f"✅ Accuracy: {accuracy:.4f}")
    print(f"✅ Log Loss: {loss:.4f}")
    print(f"✅ ROC-AUC: {roc_auc:.4f}")

    # Save Model
    joblib.dump(clf, MODEL_FILE)
    print(f"💾 Model saved locally to {MODEL_FILE}")
    
    # Save Metadata
    metadata = {
        "modelVersion": "v2.0.0-live",
        "trainingDate": datetime.datetime.now().isoformat(),
        "datasetSource": "Cricsheet T20s Ball-by-Ball",
        "numBallsTrained": len(X_train),
        "numBallsTested": len(X_test),
        "features": features,
        "modelType": "LogisticRegression (scikit-learn)",
        "metrics": {
            "accuracy": accuracy,
            "logLoss": loss,
            "rocAuc": roc_auc
        }
    }
    
    with open(METADATA_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"💾 Metadata saved to {METADATA_FILE}")
    

if __name__ == "__main__":
    train_model()
