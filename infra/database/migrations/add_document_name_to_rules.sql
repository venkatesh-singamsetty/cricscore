-- Add document_name column idempotently
ALTER TABLE tournament_rules ADD COLUMN IF NOT EXISTS document_name VARCHAR(255) NOT NULL DEFAULT 'rulebook.pdf';
