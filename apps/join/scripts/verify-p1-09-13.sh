#!/usr/bin/env bash
# Runs the P1-09/P1-13 behavior verification against the Gather cloud
# project. See verify-p1-04.sh for the connection convention.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.supabase.local ]; then
  echo "Missing .env.supabase.local; see docs/DEVELOPMENT.md for setup." >&2
  exit 1
fi

set -a
source .env.supabase.local
set +a

DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
PGCONNECT_TIMEOUT=15 PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$DB_URL" -f scripts/verify-p1-09-13-rls.sql
