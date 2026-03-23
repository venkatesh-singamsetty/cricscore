-- PostgreSQL Schema for CricScore (Aiven)

CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_a_name VARCHAR(100) NOT NULL,
    team_b_name VARCHAR(100) NOT NULL,
    total_overs INT NOT NULL,
    bat_first_team VARCHAR(100),
    status VARCHAR(25) NOT NULL DEFAULT 'SETUP',
    match_winner VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS innings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    inning_number INT NOT NULL,
    batting_team_name VARCHAR(100) NOT NULL,
    bowling_team_name VARCHAR(100) NOT NULL,
    target INT,
    total_runs INT DEFAULT 0,
    total_wickets INT DEFAULT 0,
    overs INT DEFAULT 0,
    balls INT DEFAULT 0,
    striker_name VARCHAR(100),
    non_striker_name VARCHAR(100),
    current_bowler_name VARCHAR(100),
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(match_id, inning_number)
);

CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inning_id UUID REFERENCES innings(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    runs INT DEFAULT 0,
    balls_faced INT DEFAULT 0,
    fours INT DEFAULT 0,
    sixes INT DEFAULT 0,
    is_out BOOLEAN DEFAULT FALSE,
    wicket_by VARCHAR(100),
    wicket_type VARCHAR(50),
    fielder_name VARCHAR(100),
    UNIQUE(inning_id, name)
);

CREATE TABLE IF NOT EXISTS bowlers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inning_id UUID REFERENCES innings(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    overs_completed INT DEFAULT 0,
    balls INT DEFAULT 0,
    maidens INT DEFAULT 0,
    runs_conceded INT DEFAULT 0,
    wickets INT DEFAULT 0,
    UNIQUE(inning_id, name)
);

CREATE TABLE IF NOT EXISTS ball_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inning_id UUID REFERENCES innings(id) ON DELETE CASCADE,
    over_number INT NOT NULL,
    ball_number INT NOT NULL,
    bowler_name VARCHAR(100) NOT NULL,
    batter_name VARCHAR(100) NOT NULL,
    runs INT DEFAULT 0,
    is_extra BOOLEAN DEFAULT FALSE,
    extra_type VARCHAR(20),
    extra_runs INT DEFAULT 0,
    is_wicket BOOLEAN DEFAULT FALSE,
    wicket_type VARCHAR(50),
    fielder_name VARCHAR(100),
    commentary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
