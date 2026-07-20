#!/usr/bin/env bash
# pg_restore GuardTrak database from custom-format (-Fc) dump.
# Usage:
#   ./scripts/restore-database.sh ./backups/guardtrak_20260720.dump
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DUMP_PATH="${1:-}"

if [[ -z "$DUMP_PATH" ]]; then
  echo "Usage: $0 <path-to.dump>" >&2
  exit 1
fi
if [[ ! -f "$DUMP_PATH" ]]; then
  echo "Dump file not found: $DUMP_PATH" >&2
  exit 1
fi
if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore not found. Install PostgreSQL 18 client tools." >&2
  exit 1
fi

read_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "$DATABASE_URL"
    return
  fi
  if [[ -f "$PROJECT_ROOT/.env" ]]; then
    local line
    line="$(grep -E '^\s*DATABASE_URL\s*=' "$PROJECT_ROOT/.env" | tail -n1 || true)"
    if [[ -n "$line" ]]; then
      echo "$line" | sed -E 's/^\s*DATABASE_URL\s*=\s*//' | tr -d '"' | tr -d "'"
      return
    fi
  fi
  echo "DATABASE_URL not set. Export it or add to .env" >&2
  exit 1
}

DB_URL="$(read_database_url)"

echo "WARNING: pg_restore --clean --if-exists will drop/recreate objects on the target DB."
echo "Restoring $DUMP_PATH ..."
set +e
pg_restore -d "$DB_URL" --clean --if-exists --no-owner --no-acl "$DUMP_PATH"
EXIT=$?
set -e
if [[ $EXIT -ne 0 ]]; then
  echo "pg_restore exited with code $EXIT (warnings are common with --clean)." >&2
fi

echo "Restore finished. Run: npx prisma generate && npx prisma migrate deploy"
