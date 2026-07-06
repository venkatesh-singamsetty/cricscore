-- Delete all existing documents to ensure safe migration
TRUNCATE TABLE tournament_rules;

-- Add document_name column
ALTER TABLE tournament_rules ADD COLUMN document_name VARCHAR(255) NOT NULL;
