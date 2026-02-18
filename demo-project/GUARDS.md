# Guards

Permanent contracts for core behavior. Builds cannot close if any guard fails.

## G-01: Auth Boundary
- Contract: Protected systems require valid authentication.
- Invariants:
  - Unauthenticated calls return 401.
  - Invalid/expired credentials return 401.
- Layer: Contract + Integration
- Risk if broken: Total

## G-02: Authorization Matrix
- Contract: Authorization is server-enforced by role/policy.
- Invariants:
  - Allowed actions pass.
  - Disallowed actions return 403.
- Layer: Contract + Integration
- Risk if broken: Critical

## G-03: Core Write Protection
- Contract: Only authorized roles can mutate production-impacting config/data.
- Invariants:
  - Unauthorized write attempts produce no state change.
  - Denied writes return 403.
- Layer: Integration + DB behavior
- Risk if broken: Critical

## G-04: Core Flow Integrity
- Contract: Primary user-facing flow remains functional after every build.
- Invariants:
  - Core creation/read/update flows still work.
  - No blocking regressions on primary paths.
- Layer: Integration + Browser
- Risk if broken: Critical

## G-05: Sensitive Data Redaction + Auditability
- Contract: Sensitive data is never exposed; privileged actions are auditable.
- Invariants:
  - Secret fields never appear in API payloads/log payloads.
  - Privileged actions produce audit entries.
- Layer: Contract + Integration
- Risk if broken: Critical
