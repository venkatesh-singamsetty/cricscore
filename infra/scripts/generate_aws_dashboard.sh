#!/bin/bash
set -euo pipefail

# Ensure script executes from repository root
cd "$(dirname "$0")/../.."

if [ -f ".env.local" ]; then
  set -a
  . ./.env.local
  set +a
fi

python3 infra/scripts/generate_aws_dashboard.py
