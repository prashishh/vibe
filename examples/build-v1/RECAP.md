# Build v1 Recap

## What Shipped

- **T-01** `admin_roles`, `admin_users`, `admin_sessions` tables (migration 006). Seed script to create initial admin user with argon2-hashed password.
- **T-02** Admin login (`POST /login`), logout (`POST /logout`), and profile (`GET /me`) endpoints with opaque session tokens (SHA-256 hashed, 7-day expiry).
- **T-03/T-04** Legacy `ADMIN_PASSWORD` env var fully removed. `requireAdminAuth` + `requireRole([])` middleware replaces all password-based access. Prompt Lab auth chain redesigned: admin session → Supabase JWT → dev bypass.
- **T-05** Write routes on live-prompt-config, model-config, tiers, and categories gated behind `requireRole(['admin'])`.
- **T-06** 16 integration tests (node:test + fetch) covering login lifecycle, route protection (401), live-config access, and sensitive data redaction.
- **Bug fix** Login rate limiter scoped to `POST /login` only (was incorrectly applied to all `/api/admin/auth/*` routes including `/me` and `/logout`).
- **Bug fix** Seed script now loads `.env.local` for Supabase credentials (matching server env loading pattern).

## Guard Results

| Guard | Status | Notes |
|-------|--------|-------|
| G-01 Admin Auth Boundary | ✅ Pass | All admin routes return 401 without valid session token |
| G-02 Admin Role Authorization Matrix | ✅ Pass | `requireRole(['admin'])` on all write routes; content/finance blocked from live-config mutations |
| G-03 Prompt Lab API Coverage | ✅ Pass | Prompt Lab routes use new admin session → JWT → dev bypass chain |
| G-04 Live Config Protection | ✅ Pass | Templates, options, model-config, tiers, categories all require admin role for writes |
| G-06 Main App Entitlement Safety | ✅ Pass | Public read endpoints unaffected; no changes to user-facing story/quota paths |

## Metrics

- **Lead time:** ~33 minutes (13:13 → 13:46, 2026-02-13)
- **Rework rate:** 1 fix (rate limiter scope too broad — caught by integration tests)
- **Verification ratio:** 16 tests / 6 tasks = 2.7 tests per task
- **Spec-to-code drift:** None. All GOAL.md success metrics met.
- **Regression escape rate:** 0 (no regressions in existing flows)

## Architecture Decisions

1. **Opaque session tokens over JWT** — tokens stored as SHA-256 hashes in `admin_sessions` table. Enables instant revocation (logout, deactivation) without JWT blacklist complexity. Trade-off: every request hits DB, mitigated by Supabase connection pooling.
2. **T-03/T-04 atomic commit** — removing legacy auth and adding new auth had to ship together; one without the other would break all admin routes.
3. **Rate limiter on POST /login only** — initially applied to all auth routes, but `/me` and `/logout` should not count against the brute-force window.
4. **Prompt Lab auth chain preserved** — admin session is checked first, then falls back to Supabase JWT + email allowlist, then dev bypass. This maintains backward compatibility for app users accessing Prompt Lab via their Supabase auth.

## Issues / Follow-ups

- **Frontend AdminGuard.jsx** still references old `x-admin-password` + `sessionStorage` pattern. Admin dashboard UI won't work until v2 replaces this with token-based auth.
- **`ADMIN_PASSWORD` env var** must be removed from production environment variables manually.
- **Rate limiter is in-memory** — not suitable for multi-instance deploys. Consider Redis-backed rate limiting if scaling horizontally.

## Next Build Seeds

- Admin user management APIs (CRUD, deactivation, role assignment) — v2
- Admin dashboard UI auth flow (login form, token storage, route guards) — v2
- Audit logging table and endpoints — v2
- Password reset flow — future
