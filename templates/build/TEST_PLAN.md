# Build v1 Test Plan

## Goal
Validate admin auth, role authorization, Prompt Lab protection, and no-regression on live config behavior. Backend-only — no browser/E2E tests in this build.

## Test Layers
1. Contract tests
   - Role matrix resolver behavior.
   - Sensitive data serialization/redaction (no password_hash in responses).
2. Integration tests
   - Admin login/session lifecycle (success, failure, expiry, rate limiting).
   - 401/403 coverage per route class (admin routes, Prompt Lab routes).
   - Live config mutation permissions (only `admin` can write).
   - Seed script verification.

## Guard Mapping
- G-01: Auth boundary -> integration
- G-02: Role matrix -> contract + integration
- G-03: Prompt Lab route coverage -> integration
- G-04: Live config protection -> integration
- G-06: Main app entitlement safety -> regression integration checks

## Execution Policy
- CI: full vibe check required for build closure.
- Local: manual guard runs on demand.

## Test Data Strategy
- Seed dedicated admin fixtures per role (`admin`, `content`, `finance`).
- Keep fixtures isolated from production data.
- Include one deactivated admin fixture for negative checks.

## Exit Criteria
- All v1 task acceptance checks pass.
- All guards pass in CI full run (vibe check).
- No critical security findings in auth/RBAC paths.
