import os
import urllib.request
import zipfile
import json
import pandas as pd
from pathlib import Path

# Config
DATA_URL = "https://cricsheet.org/downloads/t20s_json.zip"
DATA_DIR = Path("data")
RAW_DIR = DATA_DIR / "raw"
OUTPUT_FILE = DATA_DIR / "matches.csv"

def download_and_extract():
    if not DATA_DIR.exists():
        DATA_DIR.mkdir()
    if not RAW_DIR.exists():
        RAW_DIR.mkdir()

    zip_path = DATA_DIR / "t20s_json.zip"
    
    if not zip_path.exists():
        print(f"📥 Downloading dataset from {DATA_URL}...")
        urllib.request.urlretrieve(DATA_URL, zip_path)
        print("✅ Download complete.")
    
    if not list(RAW_DIR.glob("*.json")):
        print("📦 Extracting JSON files...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(RAW_DIR)
        print("✅ Extraction complete.")
    else:
        print("✅ Data already extracted.")

def parse_matches():
    print("🔍 Parsing match JSON files...")
    matches = []
    
    # Process files chronologically if possible to avoid leakage when calculating historical stats later
    # Cricsheet JSON files don't guarantee chronological order by filename, but we can sort by date after extraction
    
    json_files = list(RAW_DIR.glob("*.json"))
    # Cricsheet has a README.txt in the zip, we only want .json
    
    for file_path in json_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            info = data.get('info', {})
            
            # We only want matches with a definitive winner
            outcome = info.get('outcome', {})
            if 'winner' not in outcome:
                continue # Skip ties/no results
                
            winner = outcome['winner']
            teams = info.get('teams', [])
            if len(teams) != 2:
                continue
                
            team1, team2 = teams[0], teams[1]
            venue = info.get('venue', 'Unknown')
            city = info.get('city', venue) # Use city if available, fallback to venue
            toss = info.get('toss', {})
            toss_winner = toss.get('winner', 'Unknown')
            toss_decision = toss.get('decision', 'Unknown')
            dates = info.get('dates', [])
            match_date = dates[0] if dates else '1970-01-01'
            gender = info.get('gender', 'male')
            
            # Only train on Men's T20s for this specific model, or we can include both but add a gender feature.
            # Let's stick to male T20Is to reduce variance for this baseline model
            if gender != 'male':
                continue
                
            match_type = info.get('match_type', '')
            if match_type != 'T20':
                continue
                
            matches.append({
                'date': match_date,
                'team1': team1,
                'team2': team2,
                'venue': venue,
                'city': city,
                'toss_winner': toss_winner,
                'toss_decision': toss_decision,
                'winner': winner
            })
        except Exception as e:
            # Skip malformed files
            continue

    df = pd.DataFrame(matches)
    
    # Sort chronologically to prevent data leakage during time-series validation
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)
    
    print(f"✅ Parsed {len(df)} valid T20 matches.")
    
    # Basic Feature Engineering
    print("⚙️ Engineering features...")
    
    # Ensure team1 is always alphabetically first to prevent duplication (e.g. Ind vs Aus == Aus vs Ind)
    # Wait, the order of team1 vs team2 matters for toss winner. Let's keep it as is, but we will encode features properly.
    
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"💾 Saved clean dataset to {OUTPUT_FILE}")

if __name__ == "__main__":
    download_and_extract()
    parse_matches()
