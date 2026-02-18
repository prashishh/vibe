# Dashboard Integration Contract

This framework expects the dashboard to render framework status from markdown artifacts.

## Required Inputs

- `BUILDS_ROOT`: path to `<project>/builds`
- `GUARDS_FILE`: path to `<project>/GUARDS.md`
- Optional: `CHANGELOG_FILE`: path to `<project>/CHANGELOG.md`

## Suggested Views

1. Overview
   - latest build status
   - guard pass/fail status
   - open tasks by build
2. Build Detail
   - GOAL / PLAN / TASKS / TEST_PLAN / SHIP / RECAP
   - progress and risk
3. Guard History
   - guard changes over time
   - failures by build

## Notes

- The dashboard should treat markdown files as the source of truth.
- Avoid hardcoding project-specific paths.
