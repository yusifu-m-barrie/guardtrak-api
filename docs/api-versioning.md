# API Versioning

## Current Approach

GuardTrak uses **URI path versioning**:

```text
/api/v1/...
```

Configured via `API_PREFIX` (default `api/v1`).

## Phase 9 response headers

Every response includes:

| Header | Example | Purpose |
|--------|---------|---------|
| `X-API-Version` | `v1` | Active contract version |
| `X-API-Deprecation` | `false` | Set `true` when a path is sunsetting |
| `X-API-Supported-Versions` | `v1` | Comma-separated supported URI versions |

Clients should prefer URI versioning; headers prepare non-breaking discovery for future `/api/v2`.

## Introducing `/api/v2` Later

When breaking changes are required:

1. Keep `/api/v1` stable for existing mobile clients.
2. Introduce `/api/v2` as a parallel route namespace (Nest versioning or a second global prefix module).
3. Share domain services between versions where possible.
4. Deprecate v1 with `X-API-Deprecation: true` and a documented sunset window.
5. Avoid silent behaviour changes under the same path.

Header-based version negotiation may be considered later for specific clients, but URI versioning remains the primary public contract.
