# Lite Build Templates

Use these templates for **Lite Builds** (3-8 tasks, medium scope, low-medium risk).

## When to Use Lite Mode

- 3-8 tasks
- Low-Medium risk
- Straightforward implementation (no architecture decisions)
- Touches existing subsystems but doesn't redesign them
- Example: "Add CSV export to admin dashboard"

## Required Documents

1. **GOAL.md** - What and why (simplified)
2. **TASKS.md** - Work breakdown with inline acceptance criteria
3. **RECAP.md** - Closure summary (shorter than full build)

## Optional Documents

Create these only if needed:
- **PLAN.md** - If tasks need detailed acceptance criteria or rollback plans
- **REVIEW.md** - If any task has Medium+ risk
- **SHIP.md** - If deployment involves migrations, config changes, or feature flags

## NOT Included in Lite Mode

These are Full Build only:
- ❌ DESIGN.md (no architecture design needed)
- ❌ TEST_PLAN.md (test strategy is straightforward)
- ❌ DECISIONS.md (no complex trade-offs)

## Promotion to Full Build

If during execution you discover:
- Task count grows beyond 8
- Risk level increases to High/Critical
- Architecture decisions are needed
- Multiple subsystems require coordination

**Promote to Full Build**: Create missing documents (PLAN.md, DESIGN.md, etc.) and follow full ceremony.
