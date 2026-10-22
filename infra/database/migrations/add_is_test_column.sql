-- Add is_test column to matches table to distinguish automated/test/practice matches from real matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_matches_is_test ON matches(is_test);

-- Backfill existing test matches based on known team names or scorer email patterns
UPDATE matches
SET is_test = TRUE
WHERE team_a_name ILIKE '%test%' OR team_b_name ILIKE '%test%'
   OR team_a_name ILIKE '%sync%' OR team_b_name ILIKE '%sync%'
   OR team_a_name ILIKE 'TEAM A%' OR team_b_name ILIKE 'TEAM B%'
   OR scorer_email LIKE 'test-%' OR scorer_email LIKE '%@test.%';
