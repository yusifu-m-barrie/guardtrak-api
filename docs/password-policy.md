# Password Policy

- Minimum 10 characters, maximum 128
- At least one uppercase, lowercase, number, and symbol
- No leading/trailing whitespace
- Must differ from current password on change
- Seed password blocked in production
- Hashed with Argon2; never logged or returned
