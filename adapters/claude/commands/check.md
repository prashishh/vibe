---
description: Verify all guards against the codebase and report pass/fail status.
allowed-tools: Bash, Read, Grep, Glob
---

Run guard verification for this project: verify every guard in .vibe/GUARDS.md against the actual codebase.

## Overview

This is an **AI-driven guard check**. Instead of just running tests, you actively analyze the codebase against each guard's contract and invariants, run any available tests, and produce a detailed pass/fail report.

This command is called automatically at the end of `/vibe`, `/lite`, and `/full` builds, but can also be run standalone at any time.

## Precondition

`.vibe/GUARDS.md` must exist. If it doesn't:

```
❌ No .vibe/GUARDS.md found

Guards define what must never break in your project.
Run /guards to analyze your codebase and create them.
```

Stop here. Do not proceed without guards.

## Process

### 1. Parse Guards

Read `.vibe/GUARDS.md` and extract every guard:

```
📋 Loading guards...

Found {N} guards:
  G-01: {name}
  G-02: {name}
  ...

Running verification...
```

For each guard, extract:
- Guard ID (G-01, G-02, etc.)
- Name
- Contract (the one-sentence guarantee)
- Invariants (the specific conditions)
- Layer (Contract, Integration, E2E)
- Risk level (Critical, High, Medium)

### 2. Verify Each Guard

For **each guard**, perform three layers of verification:

#### Layer A: Code Analysis

Read the source files related to this guard's flow. Check whether the code actually implements what the invariants require.

**What to look for:**
- Does the code handling this flow exist?
- Are the invariants reflected in the implementation?
  - e.g., "Unauthenticated access is rejected" → Is there auth middleware on protected routes?
  - e.g., "No charge without user confirmation" → Is there a confirmation step before payment?
  - e.g., "Invalid tokens return 401" → Does the token validation return 401?
- Are there obvious gaps where an invariant has no corresponding code?

**Verdict:** PASS if all invariants have corresponding code. FAIL if any invariant has no implementation or has an obvious gap.

#### Layer B: Test Coverage

Search for tests related to this guard:
- Grep for test files matching the flow name (e.g., guard about auth → `auth.test.*`, `login.spec.*`)
- Grep test files for assertions matching invariant keywords
- Check if the tests actually test what the invariants claim

**Verdict:** PASS if relevant tests exist and cover the key invariants. WARN if tests exist but don't cover all invariants. FAIL if no relevant tests found.

#### Layer C: Runtime Verification

If the project has a test runner configured, run the relevant tests:

```bash
# Try to find and run the test command
npm test 2>&1 || npx jest 2>&1 || npx vitest run 2>&1 || echo "No test runner found"
```

If a build step exists:
```bash
npm run build 2>&1 || echo "No build step found"
```

**Verdict:** PASS if tests/build pass. FAIL if tests/build fail. SKIP if no test runner or build configured.

### 3. Report

Produce a guard-by-guard report:

```
📋 Guard Verification Report
═══════════════════════════════

✅ G-01: {Guard Name} — PASS
   Contract: {contract text}
   Code:  ✅ {summary of code found, with file paths}
   Tests: ✅ {N} relevant tests found ({file})
   Build: ✅ Passes

❌ G-02: {Guard Name} — FAIL
   Contract: {contract text}
   Code:  ❌ {what's missing or wrong}
   Tests: ⚠️  {partial coverage or missing}
   Build: ✅ Passes

   Fix targets:
   - {file:line}: {what needs to change}
   - {file}: {what test needs to be added}

⚠️  G-03: {Guard Name} — WARN
   Contract: {contract text}
   Code:  ✅ Implementation looks correct
   Tests: ⚠️  Tests exist but don't cover invariant: "{specific invariant}"
   Build: ✅ Passes

   Suggestion:
   - Add test for: {specific invariant not covered}

═══════════════════════════════

Summary: {pass}/{total} guards pass
         {warn} warnings
         {fail} failures

{If all pass:}
✅ All guards pass. Safe to ship.

{If any fail:}
❌ {N} guard(s) failed. Fix required before shipping.

Failing guards:
  - G-{NN}: {name} — {one line reason}

Fix targets (prioritized by risk):
  1. {file}: {what to fix} (Critical)
  2. {file}: {what to fix} (High)
```

## Verdict Rules

A guard **passes** when:
- Code implementing the flow exists and covers all invariants
- No obvious gaps in error handling or validation
- Tests exist and are relevant (even if not exhaustive)

A guard **fails** when:
- Code for the flow doesn't exist
- An invariant has no corresponding implementation
- Existing tests fail
- Build fails

A guard gets a **warning** when:
- Code looks correct but test coverage is incomplete
- Tests exist but don't cover all invariants
- The guard references files that have been recently changed (potential regression)

## Edge Cases

### Tests take too long

If tests run longer than 60 seconds:
```
⏱️ Tests running longer than expected...
Continuing with code analysis results.
Test results will be marked as TIMEOUT.
```

### Multiple test runners

If the project uses multiple test tools (Jest + Cypress, Vitest + Playwright):
```
Found multiple test runners:
  - Jest (unit tests)
  - Cypress (E2E tests)

Running both...
```

### Guard references deleted files

If a guard mentions files that no longer exist:
```
⚠️  G-{NN}: {name}
   Referenced file no longer exists: {file}
   This guard may need updating.
   Run /guards to refresh.
```

### No tests in the project

If no test runner or test files are found:
```
⚠️  No test files or test runner detected

Code analysis only (no test verification):
  - Guard contracts verified against source code
  - Test coverage: SKIP (no tests found)

Consider adding tests for your guarded flows.
```

## When Called From Other Commands

When `/check` runs as part of `/vibe`, `/lite`, or `/full`:

- Output the same report format
- If all guards pass, the calling command continues
- If any guard fails, the calling command should:
  1. Attempt auto-fix for simple failures
  2. If auto-fix works, re-run `/check`
  3. If auto-fix fails, pause and ask the user

## Output Format (Compact)

For quick inline use (e.g., inside /vibe):

```
Running checks...

✅ G-01: Auth Boundary — PASS
✅ G-02: Payment Integrity — PASS
❌ G-03: Data Validation — FAIL (missing email format check)

2/3 guards pass
```

For standalone `/check` runs, use the full detailed format from section 3.
