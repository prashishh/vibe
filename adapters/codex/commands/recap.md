
Generate recap for a completed build.

## Preconditions (must all pass)

1. Tests pass for scoped work.
2. `check` passes.
3. `builds/v{N}/REVIEW.md` status is `PASS`.
4. `scripts/check-ship-checklist.sh builds/v{N}/SHIP.md` passes.

If any precondition fails, stop and report what is missing.

## Process

1. Read build docs and relevant commits.
2. Summarize what shipped vs plan.
3. Record guard outcomes.
4. Record metrics (lead time, rework, drift, verification ratio, escapes).
5. Capture next build seeds.
6. Update `.vibe/CHANGELOG.md`.

## Output

Print recap completion summary and remaining follow-ups.
