# Changelog

## [v0.2.0] - 2026-02-13
- **Added Lite Build mode** — new middle tier between Vibes and Full Builds for 3-8 task features.
- Added three-tier work system documentation to `VIBE.md` with decision matrix.
- Created `templates/lite/` with simplified templates (GOAL, TASKS, RECAP).
- Updated `/plan` command to auto-detect or prompt for Lite vs Full mode.
- Updated README with three-tier comparison table.
- Lite Builds require only 3 documents (GOAL + TASKS + RECAP), making medium-scope work more practical.
- Optional documents (PLAN, REVIEW, SHIP) created only when needed in Lite mode.

## [v0.1.1] - 2026-02-13
- Hardened build closure gates: builds now require tests pass, `check` pass, `REVIEW.md` status `PASS`, and no unchecked required `SHIP.md` items.
- Updated lifecycle ordering to `VERIFY -> REVIEW -> SHIP -> RECAP`.
- Added strict `/review` command contract with `PASS | BLOCKED` gating.
- Hardened `/ship` and `/recap` command specs to enforce checklist completion before recap.
- Added `scripts/check-ship-checklist.sh` to fail when any required `SHIP.md` checkbox remains unchecked.
- Updated SHIP/REVIEW templates to explicitly enforce gate behavior.

## [v0.1.0] - 2026-02-13
- Extracted standalone framework from project-specific workflow.
- Standardized naming around `VIBE_CHECK`, `GUARDS`, and `/recap`.
- Added agent-agnostic adapter structure for Claude/Codex/Kimi/GLM.
