
Run review for a verified build.

## Preconditions

- Task acceptance checks complete.
- Tests for scoped work pass.
- `check` passes.

## Process

1. Read `builds/v{N}/GOAL.md`, `PLAN.md`, `TASKS.md`, `TEST_PLAN.md`.
2. Read changed files and test results.
3. Write or update `builds/v{N}/REVIEW.md` with:
   - Findings (severity and disposition)
   - Risks
   - Suggested fixes
   - Approval status: `PASS` or `BLOCKED`
4. If status is `BLOCKED`, list required fixes and stop build progression.

## Output

Print review status and blocking items (if any).
