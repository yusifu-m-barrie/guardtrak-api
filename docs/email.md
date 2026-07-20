# Email

Transactional email (password reset OTP, operational alerts) is controlled by `EMAIL_ENABLED` and `EMAIL_PROVIDER`.

## Providers

| Provider | Env | Notes |
|----------|-----|-------|
| `smtp` | `SMTP_*` | Default; Mailpit in Docker on port `1025` |
| `resend` | `EMAIL_RESEND_API_KEY` | Resend HTTP API |
| `ses` | `AWS_SES_REGION` + AWS credentials | Amazon SES |

## SMTP variables

- `SMTP_HOST` — e.g. `localhost` or `mailpit` in Compose
- `SMTP_PORT` — `1025` for Mailpit, `587`/`465` for production SMTP
- `SMTP_USER` / `SMTP_PASS` — optional auth
- `SMTP_FROM` — sender address (e.g. `noreply@yourdomain.com`)

## Development

Start dependencies only:

```bash
docker compose up -d mailpit
```

Open Mailpit UI at http://localhost:8025. Set `EMAIL_ENABLED=true` and `SMTP_HOST=localhost`, `SMTP_PORT=1025`.

## Production

Use a verified domain with Resend, SES, or your provider's SMTP. Disable `AUTH_ALLOW_DEV_OTP_OUTPUT`. See [deployment.md](./deployment.md).
