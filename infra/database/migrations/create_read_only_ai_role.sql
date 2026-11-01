-- Migration: Create dedicated least-privilege read-only role for AI Assistant & RAG
-- Defense-in-depth: Even if prompt injection attempts SQL manipulation, PostgreSQL blocks writes at the engine level.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cricscore_ai_reader') THEN
    CREATE ROLE cricscore_ai_reader WITH LOGIN PASSWORD 'CHANGE_ME_READONLY_PASSWORD';
  END IF;
END
$$;

-- Grant usage on schemas
GRANT USAGE ON SCHEMA dev, prod TO cricscore_ai_reader;

-- Grant SELECT only on tables and views
GRANT SELECT ON ALL TABLES IN SCHEMA dev, prod TO cricscore_ai_reader;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA dev, prod TO cricscore_ai_reader;

-- Enforce default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA dev, prod GRANT SELECT ON TABLES TO cricscore_ai_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA dev, prod GRANT SELECT ON SEQUENCES TO cricscore_ai_reader;

-- Explicitly revoke write & DDL privileges
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA dev, prod FROM cricscore_ai_reader;
