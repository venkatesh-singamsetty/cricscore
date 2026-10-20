#!/bin/bash
set -euo pipefail

# Ensure script executes from repository root
cd "$(dirname "$0")/../.."

exec ./infra/scripts/generate_platform_dashboard.sh
