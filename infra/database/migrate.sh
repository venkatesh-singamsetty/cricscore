#!/bin/bash
set -e

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <database_url> <environment>"
  exit 1
fi

DB_URL=$1
ENV=$2

echo "🗄️ Running database migrations for environment: $ENV"

# 1. Setup schema search path and run base schema.sql
# We include public so extensions like vector are accessible
echo "SET search_path TO $ENV, public;" | cat - schema.sql | psql "$DB_URL"

# 2. Run all migration scripts
for f in migrations/*.sql; do
  if [ -f "$f" ]; then
    echo "Applying migration: $f"
    echo "SET search_path TO $ENV, public;" | cat - "$f" | psql "$DB_URL"
  fi
done

echo "✅ Migrations complete!"
