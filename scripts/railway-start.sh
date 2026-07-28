#!/bin/sh
set -eu

normalize_database_url() {
  url="$1"
  case "$url" in
    *"schema="*) printf '%s' "$url" ;;
    *"?"*) printf '%s&schema=public' "$url" ;;
    *) printf '%s?schema=public' "$url" ;;
  esac
}

ensure_sslmode() {
  url="$1"
  # Prisma CLI is fine with require; for compatibility with newer parsers use
  # libpq-compatible sslmode semantics on public Railway proxies.
  case "$url" in
    *"uselibpqcompat="*) ;;
    *"?"*) url="${url}&uselibpqcompat=true" ;;
    *) url="${url}?uselibpqcompat=true" ;;
  esac
  case "$url" in
    *"sslmode="*) printf '%s' "$url" ;;
    *"?"*) printf '%s&sslmode=require' "$url" ;;
    *) printf '%s?sslmode=require' "$url" ;;
  esac
}

mask_url() {
  printf '%s' "$1" | sed -E 's#://[^@]+@#://***:***@#'
}

echo "Railway boot diagnostics:"
echo "  NODE_ENV=${NODE_ENV:-<unset>}"
echo "  PORT=${PORT:-<unset>}"
echo "  DATABASE_URL set? $([ -n "${DATABASE_URL:-}" ] && echo yes || echo NO)"
echo "  DATABASE_PUBLIC_URL set? $([ -n "${DATABASE_PUBLIC_URL:-}" ] && echo yes || echo NO)"
echo "  USE_DATABASE_PUBLIC_URL=${USE_DATABASE_PUBLIC_URL:-false}"

PRIMARY_URL="${DATABASE_URL:-}"
PUBLIC_URL="${DATABASE_PUBLIC_URL:-}"

if [ -z "$PRIMARY_URL" ] && [ -n "$PUBLIC_URL" ]; then
  PRIMARY_URL="$PUBLIC_URL"
fi

if [ -z "$PRIMARY_URL" ]; then
  echo "" >&2
  echo "FATAL: DATABASE_URL (or DATABASE_PUBLIC_URL) is required" >&2
  echo "On Railway API service → Variables:" >&2
  echo "  1) Add Variable Reference from your Postgres service" >&2
  echo "  2) Select DATABASE_PUBLIC_URL (recommended for first successful deploy)" >&2
  echo "  3) Name it DATABASE_URL on the API service" >&2
  echo "  OR paste the raw Postgres DATABASE_PUBLIC_URL value into DATABASE_URL" >&2
  echo "Do not leave DATABASE_URL empty. Do not use localhost." >&2
  exit 1
fi

# Force public URL when explicitly requested.
if [ "${USE_DATABASE_PUBLIC_URL:-false}" = "true" ] && [ -n "$PUBLIC_URL" ]; then
  echo "USE_DATABASE_PUBLIC_URL=true — using DATABASE_PUBLIC_URL"
  PRIMARY_URL="$PUBLIC_URL"
fi

export DATABASE_URL="$(normalize_database_url "$PRIMARY_URL")"

# Public Railway hosts need TLS for Prisma/pg.
case "$DATABASE_URL" in
  *rlwy.net*|*railway.app*|*proxy.rlwy.net*)
    export DATABASE_URL="$(ensure_sslmode "$DATABASE_URL")"
    ;;
esac

echo "Running prisma migrate deploy against: $(mask_url "$DATABASE_URL")"

attempt=1
max_attempts=12
until npx prisma migrate deploy; do
  echo "Prisma migrate attempt ${attempt}/${max_attempts} failed"

  # After a few private-network failures, automatically switch to public URL if available.
  if [ "$attempt" -eq 3 ] && [ -n "$PUBLIC_URL" ]; then
    case "$DATABASE_URL" in
      *railway.internal*)
        echo "Private DB unreachable — switching to DATABASE_PUBLIC_URL"
        export DATABASE_URL="$(ensure_sslmode "$(normalize_database_url "$PUBLIC_URL")")"
        echo "Now using: $(mask_url "$DATABASE_URL")"
        ;;
    esac
  fi

  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Prisma migrate failed after ${max_attempts} attempts" >&2
    exit 1
  fi

  attempt=$((attempt + 1))
  sleep 5
done

echo "Starting GuardTrak API"
exec node dist/src/main.js
