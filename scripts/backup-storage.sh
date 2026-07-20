#!/usr/bin/env bash
# Zip local object storage (STORAGE_LOCAL_ROOT) for GuardTrak Mode A backups.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT="${1:-${STORAGE_LOCAL_ROOT:-$PROJECT_ROOT/storage}}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="${2:-$PROJECT_ROOT/backups/storage_${STAMP}.tar.gz}"

mkdir -p "$(dirname "$OUT")"
mkdir -p "$ROOT"
tar -czf "$OUT" -C "$(dirname "$ROOT")" "$(basename "$ROOT")"
echo "Storage backup written to $OUT"
