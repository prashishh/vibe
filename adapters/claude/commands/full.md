---
description: Run a complete Full Build autonomously from start to finish.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

Run autonomous Full Build for: $ARGUMENTS

## Overview

This command runs the ENTIRE Full Build workflow without stopping:
1. Create GOAL.md, PLAN.md, TASKS.md, DESIGN.md
2. Execute all tasks (T-01 through T-{N})
3. Run check
4. Run review (create REVIEW.md)
5. Run ship (create SHIP.md)
6. Create RECAP.md
7. Update .vibe/CHANGELOG.md

You don't need to run separate commands for each step.

## Process

### 1. Planning Phase

Read context:
- `core/VIBE.md`
- `.vibe/GUARDS.md`
- Latest `builds/v*/RECAP.md`

Determine next build version (v{N}).

Create from `templates/build/`:
- `builds/v{N}/GOAL.md` (detailed with risks)
- `builds/v{N}/PLAN.md` (tasks with rollback)
- `builds/v{N}/TASKS.md` (tracker)
- `builds/v{N}/DESIGN.md` (if architecture needed)

Ask user to review and approve:
```
Created Full Build v{N}: {Feature Name}

GOAL.md:
- Intent: {detailed description}
- Success Metrics: {6-10 specific outcomes}
- Scope: In/Out with boundaries
- Risks: {table with mitigation}
- Guard Impact: {detailed list}

PLAN.md:
- T-01: {task} (Risk: High, Rollback: {plan})
- T-02: {task} (Risk: Critical, Rollback: {plan})
- T-03 through T-{N}: ...

DESIGN.md:
- Architecture decisions
- Schema changes
- API contracts
- Trade-offs

Estimated: {N} tasks, {X} hours

This is a Full Build (8+ tasks, High risk, or Architecture)

Approve and proceed? (Yes/No/Edit)
```

Options:
- Yes → Continue autonomous execution
- No → Stop, exit
- Edit → Stop, let user edit files, then run `/full` again to resume

### 2. Execution Phase (Autonomous)

For each task (T-01 through T-{N}):

```
Working on T-{X}: {task name}
Risk: {level}
Status: pending → in_progress

[Implement code based on PLAN.md acceptance criteria]
[Write comprehensive tests]
[Verify all acceptance criteria]
[Verify rollback plan works]

Status: in_progress → done
Committed: feat(v{N}/T-{X}): {description}

Progress: {X}/{N} tasks complete
```

**Special handling for High/Critical risk tasks:**
```
⚠️ T-{X} is High/Critical risk

After implementing, running extra verification:
- Security scan
- Performance test
- Rollback simulation

All checks passed ✅
```

If task blocked:
```
⚠️ Task T-{X} blocked
Reason: {blocker}
Status: blocked

Pausing execution.
Options:
1. Mark as known issue, continue with other tasks
2. Stop and wait for resolution
3. Skip this task (mark deferred)

What should I do?
```

### 3. Verification Phase

Once all tasks done:

```
All tasks complete! Running verification...

📋 Running checks...

Contract Layer:
✅ G-01: {Guard} - PASS
✅ G-02: {Guard} - PASS
...

Integration Layer:
✅ {test suite} - PASS

Browser Layer:
✅ {E2E tests} - PASS

Overall: All guards pass ✅
```

If check fails:
```
❌ Check failed

Failed:
- G-{X}: {reason}
- {specific test}: {failure details}

Attempting auto-fix...
[Try to fix]

If fixed → ✅ Continue
If not → ⚠️ Pause, request manual fix
```

### 4. Review Phase (Mandatory for Full Builds)

```
Running code review...

Analyzing:
- {N} files changed
- Security implications
- Performance impact
- Code quality

Creating REVIEW.md...

## Findings

### Critical
{list or "none"}

### High
{list with auto-fix attempts}

### Medium/Low
{list with disposition}

## Status: {PASS or BLOCKED}
```

If BLOCKED:
```
❌ Review BLOCKED

Critical findings must be resolved:
1. {finding with location}
2. {finding with location}

Attempting auto-fix...
[Fix critical issues]

If all fixed:
  ✅ Review status changed to PASS
  Continuing to SHIP

If not all fixed:
  ⚠️ Manual intervention required
  After fixing, run /check and /review
  Then resume with /full
```

If PASS:
```
✅ Review PASS

All critical/high findings resolved.
Continuing to SHIP...
```

### 5. Ship Phase (Mandatory for Full Builds)

```
Creating SHIP.md deployment checklist...

## Pre-Deployment
- Database backups
- Migration validation
- Rollback plan ready

## Deployment Steps
{Auto-generated from PLAN.md and DESIGN.md}

## Post-Deployment
- Smoke tests
- Guard verification
- Monitoring

## Rollback
{From each task's rollback plan}

Checklist created. Please complete deployment steps.

⏸️ Pausing for deployment
Mark items [x] in SHIP.md as you complete them.

When ready, either:
1. Run /full (no args) to resume and create RECAP
2. Wait, I'll detect when checklist is complete
```

**Auto-detection:**
```
[Watching SHIP.md for changes...]

✅ 3/8 items complete
✅ 6/8 items complete
✅ 8/8 items complete!

All deployment steps complete.
Continuing to RECAP...
```

### 6. Closure Phase

```
Creating RECAP.md...

## What Shipped
{Task-by-task summary from PLAN.md}

## Guard Results
{Table with all guard status}

## Metrics
- Lead time: {total time}
- Rework rate: {percentage}
- Verification ratio: {time}
- Spec-to-code drift: {assessment}

## Architecture Decisions
{From DESIGN.md and inline comments}

## Issues / Follow-ups
{Extracted from blocked tasks, review findings}

## Next Build Seeds
{From TODOs, deferred items, future improvements}

Updating .vibe/CHANGELOG.md...

Build v{N} complete! 🎉

Summary:
- {N} tasks completed
- {X} hours total time
- All guards pass ✅
- Review status: PASS
- Shipped to production

Next: Run /propose or /full <next feature>
```

## Progress Tracking

Throughout execution, show progress bar:

```
🚀 Full Build v{N}: {Feature Name}

Progress: ████████████░░░░░░░░ 60%

✅ Planning
✅ T-01: Create schema
✅ T-02: Add API endpoints
✅ T-03: Implement auth
⏳ T-04: Add tests (in progress)
⏸️  T-05: Write docs (pending)
⏸️  T-06: Deploy (pending)

Current: Implementing T-04 tests
Elapsed: 3.2 hours
Estimated remaining: 2.1 hours
```

## Checkpoints (User Approval Required)

1. **After planning** - Approve GOAL/PLAN/DESIGN
2. **If any task blocked** - Decide how to proceed
3. **If review BLOCKED** - Fix critical issues
4. **Before RECAP** - Complete SHIP.md checklist

Between checkpoints: **fully autonomous**

## Resume from Interruption

```
You: /full (no arguments)

Claude: Found incomplete Full Build v{N}

Current state:
- Phase: Execution
- Tasks: 6/12 complete
- Last: T-06 done
- Next: T-07 pending
- Blocked: T-04 (database migration approval)

Resume autonomous execution? (Yes/No)

If Yes:
  Continuing from T-07...
  [runs autonomously]

If No:
  Use manual commands:
  - /execute for next task
  - /check when ready
  - /review, /ship, /recap
```

## Error Recovery

**Build fails:**
```
❌ Build failed at T-{X}

Reason: {error details}

Recovery options:
1. Rollback T-{X} (uses rollback plan from PLAN.md)
2. Fix and retry T-{X}
3. Mark T-{X} as deferred, continue with others
4. Abandon build v{N}

What should I do?
```

**Critical security issue found:**
```
🚨 CRITICAL: Security vulnerability detected

Issue: {description}
Location: {file:line}
Severity: Critical
CVSS: {score}

⏸️ PAUSING BUILD IMMEDIATELY

This must be fixed before continuing.
Attempted auto-fix: {result}

After fixing:
- Run /check to verify
- Run /full to resume
```

## Output Summary

```
🚀 Full Build v{N} started

Phase 1: Planning ✅ (2 min)
Phase 2: Execution ✅ (4.5 hours)
  - 12 tasks completed
  - 2 tasks had blockers (resolved)
Phase 3: Verification ✅ (15 min)
  - All guards pass
Phase 4: Review ✅ (10 min)
  - 3 findings (all resolved)
  - Status: PASS
Phase 5: Ship ✅ (30 min)
  - Deployed to production
  - Smoke tests pass
Phase 6: Recap ✅ (5 min)

Total time: 5.8 hours
Build v{N} complete! 🎉
```

## When to Use Full vs Manual

**Use /full when:**
- Complex feature requiring full ceremony
- You can review code after completion
- Time-intensive build (overnight/background)
- Trust AI to handle standard patterns

**Use manual workflow when:**
- Learning the framework
- Extremely high-risk changes
- Need human review at each step
- Unusual/novel implementation

**Use /lite when:**
- Simpler feature (3-8 tasks)
- Lower ceremony needed

## Time Savings

Typical Full Build:
- Manual: 15+ commands, ~20+ interruptions
- Autonomous: 1 command, 3-5 approvals

**Time saved: ~90% of context switching**

You can start `/full`, approve the plan, then go to lunch. Come back and it's done (pending SHIP checklist).
