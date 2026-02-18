# Codex Adapter

Use this adapter to map vibe command intents into Codex-compatible workflow prompts.

## Minimum Mapping

- plan -> create build docs
- execute -> run next task
- check -> run guard checks
- ship -> produce deploy checklist
- recap -> produce recap + changelog
- propose -> suggest next build

Use `commands-map.yaml` as the canonical intent map.
