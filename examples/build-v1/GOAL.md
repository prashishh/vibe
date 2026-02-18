# Build v1: Admin Auth + Role Middleware

## Intent
Replace the single shared `ADMIN_PASSWORD` access with database-backed admin accounts and role-based middleware. This build creates the security foundation — schema, login, session, middleware, and live-config write protection. No UI changes; the admin dashboard UI, user management, and audit logging are deferred to v2.

## Success Metric
1. `admin_users` and `admin_roles` tables exist with seeded roles.
2. Admin login endpoint authenticates via email/password (`argon2`) and returns a 7-day session token.
3. Legacy `ADMIN_PASSWORD` bypass is fully removed.
4. Auth middleware (`requireAdminAuth`) and role middleware (`requireRole`) protect all admin and Prompt Lab API routes.
5. Only `admin` role can mutate live prompts/models/categories/tiers.
6. Integration tests verify 401/403 behavior and role matrix.

## Scope
### In
- `admin_roles` table seeded with `admin`, `content`, `finance`.
- `admin_users` table with email, password_hash, role_id, active flags, soft delete fields.
- Admin login endpoint with `argon2` password verification.
- 7-day session token issuance and validation.
- Login rate limit: 10 attempts per 15 minutes.
- `requireAdminAuth` middleware (401 for missing/invalid session).
- `requireRole([...])` middleware (403 for unauthorized roles).
- Legacy `ADMIN_PASSWORD` access path fully removed.
- Live-config write protection (only `admin` can mutate prompts/models/categories/tiers).
- Integration tests for auth + middleware + live-config protection.
- Seed script to create initial admin user.

### Out
- Admin user management APIs (v2).
- Admin dashboard UI auth flow (v2).
- Role-based navigation visibility in UI (v2).
- Audit logging table and endpoints (v2).
- Password reset flow.
- Forced password rotation.
- IP allowlisting.
- Multi-role users.
- External identity providers (SSO/OAuth for admin).

## Boundaries
- API contracts affected:
  - Admin auth endpoints (new login/session behavior).
  - Existing admin and Prompt Lab endpoints (now require auth + RBAC).
- DB schema changes:
  - `admin_users`
  - `admin_roles`
- UI surfaces touched:
  - None. Admin dashboard will temporarily require API-only access until v2.

## Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Admin dashboard temporarily inaccessible via UI | Operational | Seed a default admin user; document API-only workflow during v1-v2 gap |
| RBAC regression blocks legitimate admin flows | Operational disruption | Role matrix tests and route-by-route verification |
| Live config mutation accidentally opens to wrong role | Core product disruption | Guards on mutation routes and DB write-path verification |
| Rate limit misconfiguration blocks valid usage | Admin lockout | Conservative limit (10/15m) and clear error handling |

## Guard Impact
- G-01 Admin Auth Boundary: YES
- G-02 Admin Role Authorization Matrix: YES
- G-03 Prompt Lab API Coverage: YES
- G-04 Live Config Protection: YES
- G-06 Main App Entitlement Safety: YES

## Done Definition
Build closes only when:
1. All scoped tasks pass acceptance criteria.
2. All guards pass in CI full run (vibe check).
3. Manual smoke confirms admin login via API + role-gated route protection + live-config write block.
