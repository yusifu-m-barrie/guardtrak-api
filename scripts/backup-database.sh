#!/usr/bin/env bash
# pg_dump backup for GuardTrak (PostgreSQL 18, custom format -Fc).
# Usage:
#   ./scripts/backup-database.sh
#   ./scripts/backup-database.sh ./backups/guardtrak.dump
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_PATH="${1:-}"

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

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found. Install PostgreSQL 18 client tools." >&2
  exit 1
fi

DB_URL="$(read_database_url)"

if [[ -z "$OUTPUT_PATH" ]]; then
  BACKUP_DIR="$PROJECT_ROOT/backups"
  mkdir -p "$BACKUP_DIR"
  STAMP="$(date +%Y%m%d_%H%M%S)"
  OUTPUT_PATH="$BACKUP_DIR/guardtrak_${STAMP}.dump"
else
  mkdir -p "$(dirname "$OUTPUT_PATH")"
fi

echo "Backing up to $OUTPUT_PATH ..."
pg_dump "$DB_URL" -Fc -f "$OUTPUT_PATH"

SIZE="$(wc -c < "$OUTPUT_PATH" | tr -d ' ')"
if [[ "$SIZE" -le 0 ]]; then
  echo "Backup file is empty" >&2
  exit 1
fi

echo "Backup complete ($SIZE bytes): $OUTPUT_PATH"
