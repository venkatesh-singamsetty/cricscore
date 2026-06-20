#!/usr/bin/env bash
set -euo pipefail

# sync-env.sh
# Extracts VITE_ variables from project root .env.local (preferred) or .env and writes frontend/.env
# Usage: from repo root: ./scripts/sync-env.sh

ROOT_ENV_FILE=".env.local"
ALT_ENV_FILE=".env"
FRONTEND_ENV_FILE="frontend/.env"

# prefer .env.local but fall back to .env
if [ -f "${ROOT_ENV_FILE}" ]; then
  SOURCE_ENV="${ROOT_ENV_FILE}"
elif [ -f "${ALT_ENV_FILE}" ]; then
  SOURCE_ENV="${ALT_ENV_FILE}"
else
  echo "No ${ROOT_ENV_FILE} or ${ALT_ENV_FILE} found. Create one at repo root and try again." >&2
  exit 1
fi

mkdir -p "$(dirname "${FRONTEND_ENV_FILE}")"

# Gather VITE_ variables into a temporary file, so we don't create an empty frontend/.env
TMP_FILE=$(mktemp)
grep -E '^VITE_' "${SOURCE_ENV}" > "${TMP_FILE}" || true

if [ ! -s "${TMP_FILE}" ]; then
  echo "No VITE_ variables found in ${SOURCE_ENV}; frontend/.env unchanged." >&2
  rm -f "${TMP_FILE}"
  exit 0
fi

mv "${TMP_FILE}" "${FRONTEND_ENV_FILE}"
echo "Wrote ${FRONTEND_ENV_FILE} from ${SOURCE_ENV} (VITE_ variables only)"
