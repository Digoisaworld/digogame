#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required. Install the PostgreSQL client first." >&2
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MIGRATION="$SCRIPT_DIR/migrations/001_initial_schema.sql"

if [ ! -f "$MIGRATION" ]; then
  echo "Migration file not found: $MIGRATION" >&2
  exit 1
fi

echo "Applying DIGO schema migration 001..."
psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --single-transaction --file "$MIGRATION"
echo "DIGO schema migration 001 completed."
