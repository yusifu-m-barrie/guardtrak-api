# Security Notes (Auth)

- No plaintext passwords, OTPs, or refresh tokens in PostgreSQL
- No secrets committed; production rejects placeholder JWT secrets and `AUTH_ALLOW_DEV_OTP_OUTPUT`
- No role/user ID from client headers
- Failed login lockout after configurable attempts
- Refresh reuse detection revokes token families
- Password change and reset revoke all sessions
- MFA is not implemented
