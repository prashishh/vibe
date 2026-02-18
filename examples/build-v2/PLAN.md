# Build v2 Plan

## Task List

### T-01: Build admin user management APIs
- Outcome: `admin` role can create, update, soft delete admin users and assign one role.
- Risk: High (privileged operations)
- Acceptance:
  - [ ] `POST /api/admin/users` creates admin user with enforced password policy (min 10 chars, 1 letter, 1 number).
  - [ ] Password stored as `argon2` hash only.
  - [ ] `PUT /api/admin/users/:id` supports email, active status, and role change.
  - [ ] `DELETE /api/admin/users/:id` soft deletes (sets deleted_at/deleted_by) and revokes active sessions.
  - [ ] `GET /api/admin/users` lists admin users (never returns password_hash).
  - [ ] Only `admin` role can call these endpoints (403 for others).
- Rollback: Disable user-management routes and preserve existing accounts.
- Guards touched: G-02, G-07
- Files (expected): `server/routes/admin/users.js`, `server/lib/*`

### T-02: Add audit logging schema and implementation
- Outcome: Privileged admin actions are auditable without sensitive field leakage.
- Risk: High
- Acceptance:
  - [ ] `admin_audit_logs` table exists with actor_admin_id, action, target_type, target_id, metadata, ip_hash, created_at.
  - [ ] Audit write function logs: login success/failure, user CRUD, role changes, live-config mutations.
  - [ ] Audit metadata explicitly excludes password_hash and secrets.
  - [ ] `GET /api/admin/audit-logs` returns paginated logs (admin-only).
  - [ ] Redaction tests verify no sensitive data in audit payloads.
- Rollback: Disable audit write path while preserving primary operations.
- Guards touched: G-07
- Files (expected): `supabase/migrations/*`, `server/lib/audit.js`, `server/routes/admin/audit.js`

### T-03: Implement admin dashboard UI auth flow
- Outcome: Admin dashboard uses new email/password login and session handling.
- Risk: Medium
- Acceptance:
  - [ ] Login form uses email/password and calls `POST /api/admin/auth/login`.
  - [ ] Session token stored and sent with subsequent requests.
  - [ ] Session persists across page refresh until expiry.
  - [ ] Logout clears admin auth state completely.
  - [ ] 401 responses redirect to login page.
  - [ ] 403 responses show access-denied messaging.
- Rollback: Revert login UI flow.
- Guards touched: G-01, G-05
- Files (expected): `src/pages/admin/*`, `src/store/*`, `src/lib/*`

### T-04: Add role-based navigation/module visibility in UI
- Outcome: Unauthorized modules are hidden from dashboard navigation based on role.
- Risk: Medium
- Acceptance:
  - [ ] `content` role sees Prompt Lab + generation logs only.
  - [ ] `finance` role sees finance modules only.
  - [ ] `admin` role sees all modules.
  - [ ] Hidden UI state does not replace API enforcement (covered by v1 backend tests).
  - [ ] Navigation updates when role changes (no stale state).
- Rollback: Revert navigation filtering and restore default menu.
- Guards touched: G-02, G-05
- Files (expected): `src/components/admin/*`, `src/pages/admin/*`

### T-05: Admin user management UI
- Outcome: Admin users can be managed via the dashboard.
- Risk: Medium
- Acceptance:
  - [ ] Admin user list page shows all admin users with role, status, created date.
  - [ ] Create admin user form with email, password, role selection.
  - [ ] Edit admin user form for email, role, active status.
  - [ ] Soft delete with confirmation dialog.
  - [ ] Password field never displayed in the UI.
  - [ ] Only visible to `admin` role.
- Rollback: Remove user management UI pages.
- Guards touched: G-02, G-05
- Files (expected): `src/pages/admin/users/*`, `src/components/admin/*`

### T-06: Full guard and regression tests
- Outcome: CI validates complete admin auth + RBAC + audit guards.
- Risk: High
- Acceptance:
  - [ ] Integration tests cover user management CRUD + role enforcement.
  - [ ] Audit log tests verify correct events recorded + no sensitive data.
  - [ ] Browser/E2E tests cover admin login UI flow.
  - [ ] Browser/E2E tests cover role-based navigation visibility.
  - [ ] Prompt Lab route coverage test confirms auth middleware on all routes.
  - [ ] CI-only full vibe check command is documented and wired.
- Rollback: Mark flaky tests and block build closure until deterministic replacements exist.
- Guards touched: G-01, G-02, G-03, G-05, G-07
- Files (expected): `tests/integration/*`, `tests/guards/*`, `tests/e2e/*`, CI config

## Execution Notes
- v1 must be deployed first — this build depends on the auth + middleware foundation.
- API role checks (v1) are the security boundary; UI hiding (this build) is convenience only.
- Audit logging should be implemented early (T-02) so subsequent tasks automatically produce audit trails.
