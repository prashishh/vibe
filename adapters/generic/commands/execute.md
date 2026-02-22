
Execute the next pending task in the active build.

## Process

1. Find latest build in `builds/`.
2. Read `GOAL.md`, `PLAN.md`, `TASKS.md`.
3. Pick first `pending` task.
4. Mark task `in_progress`.
5. Implement task and add/adjust tests.
6. Verify acceptance criteria for that task.
7. Mark task `done` if complete; otherwise `blocked` with reason.

If no pending task remains, stop and suggest:
1. `/check`
2. `/review`
3. `/ship`
4. `/recap`
