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
OUTPUT_FILE = DATA_DIR / "live_data.csv"

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
    print("🔍 Parsing ball-by-ball match JSON files...")
    
    json_files = list(RAW_DIR.glob("*.json"))
    
    all_balls = []
    
    # Process files
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
                
            venue = info.get('venue', 'Unknown')
            city = info.get('city', venue)
            gender = info.get('gender', 'male')
            
            if gender != 'male':
                continue
                
            match_type = info.get('match_type', '')
            if match_type != 'T20':
                continue
                
            match_id = file_path.stem
            innings = data.get('innings', [])
            
            # First pass: Get 1st innings total score for target calculation
            target_score = -1
            if len(innings) > 0:
                first_inning = innings[0]
                first_inning_score = 0
                for over in first_inning.get('overs', []):
                    for delivery in over.get('deliveries', []):
                        first_inning_score += delivery.get('runs', {}).get('total', 0)
                target_score = first_inning_score + 1
            
            # Second pass: Extract ball-by-ball features
            for inning_idx, inning in enumerate(innings):
                inning_number = inning_idx + 1
                batting_team = inning.get('team', 'Unknown')
                bowling_team = teams[1] if teams[0] == batting_team else teams[0]
                
                current_score = 0
                wickets_lost = 0
                legal_balls = 0
                
                for over_data in inning.get('overs', []):
                    over_num = over_data.get('over', 0)
                    for delivery in over_data.get('deliveries', []):
                        runs = delivery.get('runs', {}).get('total', 0)
                        is_wicket = len(delivery.get('wickets', [])) > 0
                        
                        # Extra check: Wides and no-balls don't count as legal balls bowled
                        extras = delivery.get('extras', {})
                        if 'wides' not in extras and 'noballs' not in extras:
                            legal_balls += 1
                        
                        current_score += runs
                        if is_wicket:
                            wickets_lost += 1
                            
                        overs_bowled = legal_balls / 6.0
                        balls_left = 120 - legal_balls
                        if balls_left < 0:
                            balls_left = 0
                            
                        row = {
                            'match_id': match_id,
                            'venue': venue,
                            'city': city,
                            'batting_team': batting_team,
                            'bowling_team': bowling_team,
                            'inning': inning_number,
                            'overs_bowled': round(overs_bowled, 2),
                            'balls_left': balls_left,
                            'current_score': current_score,
                            'wickets_lost': wickets_lost,
                            'target_score': target_score if inning_number == 2 else -1,
                            'winner': winner
                        }
                        all_balls.append(row)
        except Exception as e:
            continue

    df = pd.DataFrame(all_balls)
    print(f"✅ Parsed {len(df)} total balls across all matches.")
    
    # Save the dataframe
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"💾 Saved live data dataset to {OUTPUT_FILE}")

if __name__ == "__main__":
    download_and_extract()
    parse_matches()
