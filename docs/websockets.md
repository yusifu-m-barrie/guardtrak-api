# WebSockets

Real-time updates (incidents, emergencies, notifications) use Socket.IO when `WS_ENABLED=true`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_ENABLED` | `true` | Enable WebSocket gateway |
| `WS_CORS_ORIGINS` | same as `CORS_ORIGINS` | Allowed browser origins for Socket.IO |

## Client connection

- Authenticate with the same JWT access token used for REST (Bearer or auth payload on connect — see mobile contract docs).
- Namespace and event names are documented in operational API guides; clients should reconnect with exponential backoff.

## Scaling

- Single-instance: in-memory adapter is sufficient.
- Multi-instance: enable Redis (`REDIS_ENABLED=true`) for a Redis adapter so events fan out across API replicas behind a load balancer.

## Reverse proxy

Nginx must upgrade connections:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

See [deployment.md](./deployment.md) for Nginx examples.
