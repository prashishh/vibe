
Prepare shipping checklist for the active build.

## Preconditions

- `TASKS.md` has no pending/in_progress/blocking tasks.
- `check` passes.
- `REVIEW.md` status is `PASS`.

## Process

1. Read build docs in `builds/v{N}/`.
2. Detect migrations/env/dependency/runtime changes.
3. Update `builds/v{N}/SHIP.md` in-place:
   - Mark completed checklist items as `[x]` immediately.
   - Keep incomplete items as `[ ]`.
   - Add short blocker notes to unchecked required items.
4. Run `scripts/check-ship-checklist.sh builds/v{N}/SHIP.md`.
5. If checklist check fails, report `NOT READY` and stop.
6. If checklist check passes, report `READY FOR RECAP`.

## Closure rule

Build cannot close while any required `SHIP.md` checkbox remains `[ ]`.
