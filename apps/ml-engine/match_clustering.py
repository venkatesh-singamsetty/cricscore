"""
CricScore MLOps: Pitch & Match Scoring Profile Clustering.

Evaluates 2 classical unsupervised clustering models for categorizing match conditions:
1. K-Means Clustering (with Elbow Inerita & Silhouette Score)
2. Hierarchical (Agglomerative) Clustering (Ward linkage)

Clusters matches by:
- 1st innings total score
- Average runs per over (RPO)
- Total boundaries (4s + 6s)
- Wickets lost per innings
"""

import sys
import time
from pathlib import Path
import numpy as np
import pandas as pd

from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.metrics import silhouette_score

ENGINE_DIR = Path(__file__).resolve().parent
DATA_FILE = ENGINE_DIR / "data" / "live_data.csv"


def prepare_match_features():
    if not DATA_FILE.exists():
        raise FileNotFoundError(f"Dataset not found at {DATA_FILE}")

    df = pd.read_csv(DATA_FILE)
    df_inn1 = df[df["inning"] == 1].copy()
    df_inn1["balls_bowled"] = 120 - df_inn1["balls_left"]

    # Aggregate match-level statistics for 1st innings
    match_profiles = df_inn1.groupby("match_id").agg(
        final_score=("current_score", "max"),
        max_balls_bowled=("balls_bowled", "max"),
        total_wickets=("wickets_lost", "max"),
    ).reset_index()

    # Filter completed or near-completed 20-over matches (>= 90 balls bowled)
    match_profiles = match_profiles[match_profiles["max_balls_bowled"] >= 90].copy()
    match_profiles["run_rate"] = (match_profiles["final_score"] / match_profiles["max_balls_bowled"]) * 6.0

    features = ["final_score", "run_rate", "total_wickets"]
    X = match_profiles[features].dropna()
    return match_profiles, X


def run_clustering_comparison():
    print("🎡 Running CricScore Match Condition Clustering Benchmark...")
    match_profiles, X = prepare_match_features()
    print(f"📊 Dataset: {len(X):,} completed match innings profiles.")

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 1. K-Means Clustering (k=3: Low-scoring bowler-friendly, Balanced, High-scoring batting paradise)
    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    t0 = time.perf_counter()
    kmeans_labels = kmeans.fit_predict(X_scaled)
    kmeans_duration = time.perf_counter() - t0
    kmeans_sil = silhouette_score(X_scaled, kmeans_labels)

    # 2. Hierarchical Agglomerative Clustering (k=3, ward linkage)
    hierarchical = AgglomerativeClustering(n_clusters=3, linkage="ward")
    t0 = time.perf_counter()
    hier_labels = hierarchical.fit_predict(X_scaled)
    hier_duration = time.perf_counter() - t0
    hier_sil = silhouette_score(X_scaled, hier_labels)

    print("\n" + "=" * 75)
    print(f"{'Clustering Algorithm':28} | {'Silhouette Score':18} | {'Execution Time':15}")
    print("=" * 75)
    print(f"{'K-Means (k=3)':28} | {kmeans_sil:18.4f} | {kmeans_duration:13.4f}s")
    print(f"{'Hierarchical Agglomerative':28} | {hier_sil:18.4f} | {hier_duration:13.4f}s")
    print("=" * 75)

    # Inspect cluster centers from K-Means
    centers = scaler.inverse_transform(kmeans.cluster_centers_)
    print("\n📍 K-Means Discovered Match Condition Archetypes (Cluster Centers):")
    for i, center in enumerate(centers):
        score, rpo, wkts = center
        label = "Bowling Minefield" if score < 140 else ("Batting Paradise" if score > 175 else "Balanced Competitive")
        print(f"  Cluster {i+1} [{label}]: Avg Final Score = {score:.1f} | Avg RPO = {rpo:.2f} | Avg Wickets = {wkts:.1f}")

    return {
        "kmeans_silhouette": round(kmeans_sil, 4),
        "hierarchical_silhouette": round(hier_sil, 4),
    }


if __name__ == "__main__":
    run_clustering_comparison()
