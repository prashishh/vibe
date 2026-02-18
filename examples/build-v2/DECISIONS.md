# Build v2 Decisions

This file records confirmed decisions for Build v2.

## Confirmed
- v2 depends on v1 being deployed first.
- Audit metadata uses explicit allowlist — no blanket spreading of objects.
- Soft delete revokes active sessions immediately.
- UI navigation filtering is convenience; API enforcement (v1) is authoritative.
- Admin user management is admin-only (not content, not finance).
- Audit log query is admin-only.

## Navigation Matrix
- `admin`: sees all modules.
- `content`: Prompt Lab + generation logs only.
- `finance`: finance/package modules only.

## Audit Events Logged
- `login_success`, `login_failure`
- `user_created`, `user_updated`, `user_deleted`
- `role_changed`
- `live_config_mutated`
