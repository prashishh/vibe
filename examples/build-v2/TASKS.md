# Build v2 Tasks Tracker

Status key: `pending`, `in_progress`, `blocked`, `done`

| Task | Title | Risk | Status |
|------|-------|------|--------|
| T-01 | Build admin user management APIs | High | done |
| T-02 | Add audit logging schema and implementation | High | done |
| T-03 | Implement admin dashboard UI auth flow | Medium | done |
| T-04 | Add role-based navigation/module visibility in UI | Medium | done |
| T-05 | Admin user management UI | Medium | done |
| T-06 | Full guard and regression tests | High | pending |

## Notes
- Detailed acceptance and rollback criteria are defined in `PLAN.md`.
- This build depends on v1 (auth foundation) being deployed first.
- v1 shipped: session tokens, `requireAdminAuth`, `requireRole`, rate limiter on login only.
- Frontend `AdminGuard.jsx` still uses legacy `x-admin-password` — T-03 replaces it.
- Existing admin pages use `getAdminHeaders()` — T-03 must update this to Bearer token pattern.
