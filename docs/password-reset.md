# Password Reset

Flow:

1. `POST /auth/forgot-password` with `organisationCode` + `employeeId` → always generic message.
2. OTP hashed and stored (`PasswordResetPurpose.OTP`), short TTL.
3. `POST /auth/verify-otp` → single-use short-lived `resetToken` (`RESET_TOKEN`).
4. `POST /auth/reset-password` with `resetToken` + new password → revoke all sessions.

Development: when `AUTH_ALLOW_DEV_OTP_OUTPUT=true` (never in staging/production), response may include `devOtp`.
