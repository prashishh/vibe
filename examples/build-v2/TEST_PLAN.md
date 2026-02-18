# Build v2 Test Plan

## Goal
Validate admin user management, audit logging, dashboard UI auth flow, and role-based navigation. Full guard verification (vibe check) across all layers.

## Test Layers
1. Contract tests
   - Audit metadata redaction (no password_hash or secrets).
   - Navigation matrix resolver (role -> visible modules).
2. Integration tests
   - Admin user CRUD (create, update, soft delete, list).
   - Soft delete revokes sessions.
   - Audit log write + query.
   - Password policy enforcement.
3. Browser/E2E tests
   - Admin login UI flow (success, failure, session persistence).
   - Role-based navigation visibility per role.
   - 401 redirect to login.
   - 403 access-denied display.
   - Prompt Lab authoring path for authorized roles.

## Guard Mapping
- G-01: Auth boundary -> integration + browser
- G-02: Role matrix -> contract + integration + browser
- G-03: Prompt Lab route coverage -> integration
- G-05: Prompt Lab authoring integrity -> browser + integration
- G-07: Redaction + auditability -> contract + integration

## Test Data Strategy
- Seed admin fixtures: one per role (`admin`, `content`, `finance`).
- One deactivated/soft-deleted admin for negative checks.
- Isolated from production data.

## Exit Criteria
- All v2 task acceptance checks pass.
- All guards pass in CI full run (vibe check).
- No sensitive data in audit log payloads (verified by contract tests).
- Admin login, navigation, and user management work in browser smoke test.
