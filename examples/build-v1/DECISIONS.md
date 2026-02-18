# Build v1 Decisions

This file records confirmed decisions for Build v1.

## Confirmed
- Admin users are separate from app users.
- Admin auth is email + password.
- Roles in v1: `admin`, `content`, `finance`.
- One admin user has exactly one role.
- Session lifetime target: 7 days.
- Login rate limit target: 10 attempts per 15 minutes.
- Full vibe check is CI-only gate.
- Local guard runs are manual/on-demand.
- Keep historical `sprints/` unchanged; use `builds/` for new builds.
- This build is backend-only — admin UI deferred to v2.
- Seed script creates initial admin user for first-time setup.

## Security Defaults
- Password hashing algorithm: `argon2` (recommended baseline).
- Password minimum policy: at least 10 chars, with at least 1 letter and 1 number.
- Sensitive fields (password hashes/secrets) must never appear in API responses.

## RBAC Intent
- `admin`: full access, including live prompt/model/category/tier mutations.
- `content`: Prompt Lab read/write + generation logs; no live config mutations.
- `finance`: promo/package finance areas only.

## Session Strategy
- Opaque tokens (not JWT) stored in `admin_sessions` table.
- Separate from Supabase app-user JWT — cleaner boundary, easy revocation.
- Token stored as SHA-256 hash in DB; raw token returned to client.
- Seed script at `server/scripts/seed-admin.js`.

## Deferred to v2
- Admin user management CRUD API.
- Admin dashboard UI auth flow.
- Role-based navigation visibility.
- Audit logging table and endpoints.
- Soft delete admin users.
