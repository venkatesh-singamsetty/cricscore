#!/bin/bash
set -e

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <database_url> <environment>"
  exit 1
fi

DB_URL=$1
ENV=$2

echo "🗄️ Running database migrations for environment: $ENV"

# Helper: run SQL file with retry to handle transient connection slot exhaustion
run_sql_file() {
  local file=$1
  local max_attempts=5
  local delay=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    if (echo "SET search_path TO $ENV, public;" && cat "$file") | psql "$DB_URL"; then
      return 0
    fi
    echo "⚠️ Connection or migration $file failed on attempt $attempt/$max_attempts. Retrying in ${delay}s..."
    sleep $delay
    attempt=$((attempt + 1))
    delay=$((delay + 2))
  done

  echo "❌ Migration $file failed after $max_attempts attempts." >&2
  return 1
}

# 1. Setup schema search path and run base schema.sql
# We include public so extensions like vector are accessible
run_sql_file schema.sql

# 2. Run all migration scripts
for f in migrations/*.sql; do
  if [ -f "$f" ]; then
    echo "Applying migration: $f"
    run_sql_file "$f"
  fi
done

echo "✅ Migrations complete!"
