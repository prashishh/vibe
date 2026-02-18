# Build v2: Admin Management + Dashboard UI

## Intent
Build on the auth foundation from v1 to add admin user management APIs, audit logging, and the admin dashboard UI auth flow with role-based navigation. After this build, admins can log in via the browser, manage other admin users, and see only the modules their role allows.

## Success Metric
1. `admin` role can create, update, soft delete admin users and assign roles via API.
2. Audit logs capture login events, user CRUD, role changes, and live-config mutations — with no sensitive field leakage.
3. Admin dashboard has email/password login form with session persistence.
4. Dashboard navigation hides unauthorized modules based on role.
5. 401 redirects to login; 403 shows access-denied message.
6. Full guard and regression test suite passes in CI (vibe check).

## Scope
### In
- Admin user management API: create, update (email, role, active status), soft delete.
- `admin_audit_logs` table and audit write function.
- Audit logging for: login success/failure, user CRUD, role changes, live-config mutations.
- Audit query endpoint (admin-only).
- Admin dashboard login form (email/password).
- Session persistence across refresh, logout clears state.
- Role-based navigation: `content` sees Prompt Lab + logs, `finance` sees finance modules, `admin` sees all.
- 401 → redirect to login, 403 → access-denied UI.
- Full guard and regression test suite (contract + integration + browser).

### Out
- Password reset flow.
- Forced password rotation.
- IP allowlisting.
- Multi-role users.
- External identity providers (SSO/OAuth for admin).

## Boundaries
- API contracts affected:
  - Admin user management endpoints (new CRUD/soft delete).
  - Audit log query endpoint (new).
- DB schema changes:
  - `admin_audit_logs` table.
- UI surfaces touched:
  - Admin login flow (new login page/form).
  - Admin dashboard navigation (role-aware filtering).
  - Admin user management screens (list, create, edit).
  - Existing Prompt Lab/admin screens (403 handling).

## Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| UI-only hiding used instead of real auth checks | Security bypass | API role checks already enforced in v1; UI hiding is secondary |
| Sensitive fields leak in audit logs | Security exposure | Explicit redaction in audit write function + tests |
| Soft delete leaves stale sessions | Security gap | Soft delete endpoint revokes active sessions |
| Admin user management opens privilege escalation | Security | Only `admin` role can manage users; test matrix covers this |

## Guard Impact
- G-01 Admin Auth Boundary: YES (UI auth flow)
- G-02 Admin Role Authorization Matrix: YES (user management + navigation)
- G-03 Prompt Lab API Coverage: YES (verifying coverage still holds)
- G-05 Prompt Lab Authoring Integrity: YES (role-based UI access)
- G-07 Sensitive Data Redaction + Auditability: YES (audit logging)

## Done Definition
Build closes only when:
1. All scoped tasks pass acceptance criteria.
2. All guards pass in CI full run (vibe check).
3. Manual smoke confirms: admin login via browser + role navigation + user management + audit log visibility.
