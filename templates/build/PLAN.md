# Build v1 Plan

## Task List

### T-01: Create admin auth and role schema
- Outcome: DB supports separate admin accounts with fixed roles.
- Risk: High (schema + access control foundation)
- Acceptance:
  - [ ] `admin_roles` table exists with `id`, `key`, `name`, `created_at`.
  - [ ] `admin_roles` seeded with `admin`, `content`, `finance`.
  - [ ] `admin_users` table exists with email, password_hash, role_id, is_active, deleted_at, deleted_by, created_at, updated_at.
  - [ ] Constraints ensure one role per admin user (FK to admin_roles).
  - [ ] Email has unique constraint (normalized, case-insensitive).
- Rollback: Revert migration and restore prior schema.
- Guards touched: G-01, G-02
- Files (expected): `supabase/migrations/*`

### T-02: Implement admin login/session endpoints
- Outcome: Admin users authenticate via email/password and receive session token.
- Risk: High (auth path)
- Acceptance:
  - [ ] `POST /api/admin/login` validates credentials and returns session token.
  - [ ] Credential verification uses `argon2` password hash checks.
  - [ ] Session token expires at 7 days.
  - [ ] Invalid credentials return 401 without leaking detail.
  - [ ] Login attempts are rate-limited at 10 attempts per 15 minutes per identity/IP.
  - [ ] `POST /api/admin/logout` invalidates the session.
  - [ ] `GET /api/admin/me` returns current admin profile (no password_hash).
- Rollback: Disable new auth endpoints.
- Guards touched: G-01
- Files (expected): `server/routes/admin/*`, `server/middleware/*`, `server/lib/*`

### T-03: Remove legacy single-password admin access path
- Outcome: `ADMIN_PASSWORD` path is fully removed; no bypass remains.
- Risk: Critical (security boundary)
- Acceptance:
  - [ ] Admin verify endpoint no longer accepts environment password-only flow.
  - [ ] Any legacy bypass middleware is removed.
  - [ ] Environment docs no longer reference legacy admin password login.
  - [ ] `.env.example` updated to remove `ADMIN_PASSWORD`.
- Rollback: Re-introduce feature-flagged fallback in development only (not production).
- Guards touched: G-01, G-03
- Files (expected): `server/routes/admin/*`, `server/routes/promptLab/*`, `.env.example`, `docs/*`

### T-04: Add admin auth middleware and role middleware
- Outcome: Admin and Prompt Lab APIs enforce authentication and role-based authorization.
- Risk: Critical (authorization correctness)
- Acceptance:
  - [ ] `requireAdminAuth` middleware returns 401 for missing/invalid/expired session.
  - [ ] `requireRole([...])` middleware returns 403 for disallowed roles.
  - [ ] Route-to-role matrix is centralized and testable.
  - [ ] All existing admin routes use `requireAdminAuth`.
  - [ ] All existing Prompt Lab routes use `requireAdminAuth`.
- Rollback: Revert middleware wiring and route guards.
- Guards touched: G-01, G-02, G-03, G-04
- Files (expected): `server/middleware/*`, `server/routes/admin/*`, `server/routes/promptLab/*`

### T-05: Enforce live-config write protection
- Outcome: Only `admin` role can mutate live prompts/models/categories/tiers.
- Risk: Critical (core app behavior)
- Acceptance:
  - [ ] Non-`admin` write attempts to live config routes return 403.
  - [ ] Read permissions follow approved role matrix (`content` can read Prompt Lab, `finance` cannot).
  - [ ] No unauthorized DB mutation occurs on denied requests.
- Rollback: Revert route guards to previous version and lock writes at DB level temporarily.
- Guards touched: G-02, G-03, G-04, G-06
- Files (expected): `server/routes/promptLab/*`, `server/routes/admin/*`

### T-06: Foundation integration tests
- Outcome: CI verifies admin auth, middleware, and live-config protection.
- Risk: High
- Acceptance:
  - [ ] Integration tests cover login success/failure, session expiry, rate limiting.
  - [ ] Integration tests cover role matrix: 401 (no auth) and 403 (wrong role) for each route class.
  - [ ] Live config mutation tests verify only `admin` can write.
  - [ ] Sensitive data redaction tests verify no password_hash in API responses.
  - [ ] Seed script creates test admin users per role for CI.
- Rollback: Mark flaky tests and block build closure until deterministic replacements exist.
- Guards touched: G-01, G-02, G-03, G-04, G-06
- Files (expected): `tests/integration/*`, CI config

## Execution Notes
- This build is backend-only. The admin dashboard UI will temporarily not work until v2 adds the login flow.
- A seed script must create an initial `admin` user so the API can be used immediately after deploy.
- Non-negotiable: API role checks are the security boundary, not UI visibility.
