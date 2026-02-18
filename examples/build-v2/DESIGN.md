# Build v2 Design

## Objective
Add admin user management, audit logging, and dashboard UI auth flow on top of the v1 security foundation.

## Architecture Summary
- v1 provides: schema, auth endpoints, middleware, live-config protection.
- v2 adds: user CRUD API, audit logging, and admin dashboard UI.
- UI auth flow consumes the login/session endpoints from v1.
- Navigation filtering is role-aware but API enforcement (v1) remains authoritative.

## New Data Model
1. `admin_audit_logs`
   - `id` (uuid, PK)
   - `actor_admin_id` (uuid, FK -> admin_users.id)
   - `action` (text — e.g., `login_success`, `user_created`, `role_changed`, `live_config_mutated`)
   - `target_type` (text — e.g., `admin_user`, `prompt`, `model`)
   - `target_id` (text, nullable)
   - `metadata` (jsonb — redacted, never contains password_hash or secrets)
   - `ip_hash` (text, optional — hashed for privacy)
   - `created_at`

## Admin User Management API
- `GET /api/admin/users` — list all admin users (admin-only).
- `POST /api/admin/users` — create admin user (admin-only, enforces password policy).
- `PUT /api/admin/users/:id` — update email, role, active status (admin-only).
- `DELETE /api/admin/users/:id` — soft delete + revoke sessions (admin-only).

## Audit Logging
- Write function: `logAuditEvent(actorId, action, targetType, targetId, metadata)`.
- Events logged: login success/failure, user CRUD, role changes, live-config mutations.
- Redaction: explicit allowlist of fields in metadata — anything not in the allowlist is stripped.
- Query: `GET /api/admin/audit-logs?page=1&limit=50` (admin-only).

## UI Auth Flow
- New admin login page with email/password form.
- Token stored in memory + localStorage for persistence.
- Axios/fetch interceptor adds token to all admin API requests.
- 401 response → redirect to login, clear state.
- 403 response → show access-denied message, stay on page.

## Navigation Matrix
| Module | admin | content | finance |
|--------|-------|---------|---------|
| Prompt Lab | Yes | Yes | No |
| Generation Logs | Yes | Yes | No |
| Finance/Packages | Yes | No | Yes |
| User Management | Yes | No | No |
| Audit Logs | Yes | No | No |
| Dashboard Home | Yes | Yes | Yes |

## Security Constraints
- Password_hash never returned in any API response or audit log.
- Soft delete revokes active sessions immediately.
- UI hiding is secondary to API enforcement (v1).
- Audit metadata uses explicit allowlist — no blanket object spreading.
