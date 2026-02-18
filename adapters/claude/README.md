# Claude Adapter

This adapter provides command specs for Claude-style command workflows.

## Commands

- `/plan`
- `/execute`
- `/check`
- `/review` (post-verify gate)
- `/ship` (checklist gate)
- `/recap` (closure summary)
- `/propose`

## Ordering

When a build is done coding, use this sequence:

1. `/check`
2. `/review`
3. `/ship`
4. `/recap`

## Install Target

Copy command files into your runtime command folder, then map each slash command to the corresponding markdown file.
