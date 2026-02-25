# Build v1 Design

## Objective
Introduce multi-account admin authentication and role-based authorization at the API layer without changing user-facing app entitlement behavior or admin UI.

## Architecture Summary
- Auth domain is separate from app user domain.
- Admin identity and role data is persisted in DB tables.
- Admin APIs and Prompt Lab APIs use shared auth + role middleware.
- No UI changes in this build — backend-only security foundation.

## Proposed Data Model
1. `admin_roles`
   - `id` (uuid, PK)
   - `key` (`admin`, `content`, `finance`)
   - `name` (display name)
   - `created_at`
2. `admin_users`
   - `id` (uuid, PK)
   - `email` (unique, normalized, case-insensitive)
   - `password_hash` (argon2)
   - `role_id` (FK -> `admin_roles.id`)
   - `is_active` (boolean)
   - `deleted_at` (timestamp, nullable — soft delete)
   - `deleted_by` (uuid, nullable)
   - `created_at`
   - `updated_at`

## Auth + Session
- Login: email/password via `POST /api/admin/login`.
- Hashing: `argon2`.
- Session: JWT or opaque token with 7-day expiry.
- Rate limit: 10 attempts / 15 minutes per email/IP.
- Legacy `ADMIN_PASSWORD` access path fully removed.
- Logout: `POST /api/admin/logout` invalidates session.
- Profile: `GET /api/admin/me` returns admin info (never password_hash).

## Authorization Matrix
1. `admin`
   - Full admin dashboard access.
   - Can mutate live prompts/models/categories/tiers.
   - Can manage admin users and roles (v2).
2. `content`
   - Prompt Lab read/write (non-live-protected actions only).
   - Generation logs access.
   - No live prompt/model/category/tier mutations.
3. `finance`
   - Promo/package finance modules only.
   - No Prompt Lab write access unless explicitly granted later.

## API Protection Pattern
- `requireAdminAuth` middleware:
  - Valid token -> attach admin user to `req.admin` -> continue
  - Missing/invalid/expired -> 401
- `requireRole([...])` middleware:
  - `req.admin.role.key` in allowed list -> continue
  - Unauthorized -> 403

## Security Constraints
- Never return `password_hash` in any API response.
- UI hiding is convenience only (v2); all write paths require role checks server-side.
- Seed script creates initial admin user for first-time setup.

## Non-Goals (this build)
- Admin user management CRUD API (v2).
- Dashboard UI login flow (v2).
- Audit logging (v2).
- Password reset flows.
- MFA/2FA.
- IP allowlist.
- Multi-role accounts.
