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
  case "$url" in
    *"sslmode="*) printf '%s' "$url" ;;
    *"?"*) printf '%s&sslmode=require' "$url" ;;
    *) printf '%s?sslmode=require' "$url" ;;
  esac
}

# Prefer private DATABASE_URL, but fall back to DATABASE_PUBLIC_URL when private
# Railway networking cannot resolve postgres.railway.internal.
PRIMARY_URL="${DATABASE_URL:-}"
PUBLIC_URL="${DATABASE_PUBLIC_URL:-}"

if [ -z "$PRIMARY_URL" ] && [ -n "$PUBLIC_URL" ]; then
  PRIMARY_URL="$PUBLIC_URL"
fi

if [ -z "$PRIMARY_URL" ]; then
  echo "DATABASE_URL (or DATABASE_PUBLIC_URL) is required" >&2
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

echo "Running prisma migrate deploy against: $(printf '%s' "$DATABASE_URL" | sed -E 's#://[^@]+@#://***:***@#')"

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
        echo "Now using: $(printf '%s' "$DATABASE_URL" | sed -E 's#://[^@]+@#://***:***@#')"
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
