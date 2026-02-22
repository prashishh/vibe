
Run autonomous Lite Build for: $TASK

## Overview

This command runs the ENTIRE Lite Build workflow without stopping:
1. Create GOAL.md, TASKS.md
2. Execute all tasks (T-01, T-02, ...)
3. Run check
4. Create RECAP.md
5. Update .vibe/CHANGELOG.md

You don't need to run /execute, /check, /recap separately.

## Process

### 1. Brainstorming Phase (Interactive)

**IMPORTANT**: Ask clarifying questions BEFORE creating documents.

Read context:
- `core/VIBE.md`
- `.vibe/GUARDS.md`
- Latest `builds/v*/RECAP.md`
- Recent code changes

**Ask questions to understand** (as needed):
- Scope boundaries (what's OUT?)
- Success criteria (how do we know it works?)
- Risk areas (what could go wrong?)
- Architecture approach (if multiple options)
- Data/API design (if unclear)
- Permissions (who has access?)
- Scale (how many users/requests?)

Example brainstorming:
```
Feature: Add CSV export

Let me understand the requirements:

1. What should be exported?
   a) All user data
   b) Visible table columns only
   c) Configurable by admin

2. Expected export size?
   a) < 100 rows (instant download)
   b) 100-10k rows (async job)
   c) 10k+ rows (needs optimization)

3. Who can export?
   a) All admins
   b) Only 'admin' role
   c) New permission

Your answers: {collected responses}
Creating plan based on your input...
```

### 2. Planning Phase

Determine next build version (v{N}).

Create from `templates/lite/` **using brainstorming answers**:
- `builds/v{N}/GOAL.md` (reflects decisions made)
- `builds/v{N}/TASKS.md` (implements chosen approach)

Present final plan for approval:
```
Created Lite Build v{N}: {Feature Name}

GOAL.md:
- Intent: {summary}
- Success Metric: {metrics}
- Scope: {in/out}
- Guard Impact: {guards}

TASKS.md:
- T-01: {task name} (Risk: Low)
- T-02: {task name} (Risk: Medium)
- T-03-T-{N}: ...

Estimated time: {X} hours

Approve and proceed? (Yes/No)
```

If No → Stop, user can edit files
If Yes → Continue

### 2. Execution Phase (Autonomous)

For each task in TASKS.md (T-01, T-02, ...):

```
Working on T-{X}: {task name}
Status: pending → in_progress

[Implement code]
[Write/update tests]
[Verify acceptance criteria]

Status: in_progress → done
Committed: feat(v{N}/T-{X}): {description}

Progress: {X}/{N} tasks complete
```

**Auto-continue** to next task until all done.

If a task gets blocked:
```
⚠️ Task T-{X} blocked
Reason: {blocker description}
Status: pending → blocked

Pausing autonomous execution.
Please resolve blocker, then:
- Update TASKS.md status to "pending"
- Run /lite again to resume
```

### 3. Verification Phase

Once all tasks done:

```
All tasks complete! Running verification...

📋 Running checks...
[Execute guard tests]

✅ G-01: {Guard name} - PASS
✅ G-02: {Guard name} - PASS
...

Overall: All guards pass ✅
```

If check fails:
```
❌ Check failed
Guard G-{X} failed: {reason}

Fix required before closing build.
After fixing:
- Run /check to verify
- Run /recap to close build
```

### 4. Closure Phase

If check passed:

```
Creating RECAP.md...

## What Shipped
- T-01: {summary}
- T-02: {summary}
...

## Guard Results
All {N} guards pass ✅

## Metrics
- Lead time: {time from start to now}
- Task count: {N}
- Rework: {count of blocked/revised tasks}

## Next Build Seeds
{Auto-extracted from task comments/TODOs}

Updating .vibe/CHANGELOG.md...

Build v{N} complete! 🎉

Total time: {X} hours
Next: Run /lite <next feature> or /propose
```

## Error Handling

**If planning fails:**
```
❌ Could not create build plan
Reason: {error}

Please run /plan manually for more control.
```

**If execution stalls:**
```
⚠️ Task T-{X} taking longer than expected
Elapsed: {time}

Options:
1. Continue waiting
2. Mark as blocked and continue
3. Cancel and resume manually

What should I do?
```

**If tests fail during task:**
```
❌ Tests failed for T-{X}
Failures:
- {test name}: {reason}

Auto-fixing attempt...
[Try to fix]

If fixed:
  ✅ Tests now pass, continuing

If not fixed:
  ⚠️ Could not auto-fix
  Marking T-{X} as blocked
  Please fix manually, then resume
```

## Checkpoints (User Approval Points)

The command asks for approval at these points:

1. **After planning** - Review GOAL/TASKS before execution
2. **If task blocked** - What to do about blocker
3. **If tests fail** - Allow manual fix before continuing
4. **If check fails** - Fix guards before closing

Between checkpoints, it runs **autonomously**.

## Resume Capability

If the command is interrupted or blocked:

```
You: /lite (without arguments)

Claude: Found incomplete build v{N}

Status:
- Tasks: {X}/{N} complete
- Last completed: T-{X}
- Blocked: {list of blocked tasks}

Resume execution? (Yes/No)
```

## Output

Print progress updates:
```
🚀 Lite Build v{N} started

✅ Planning complete
✅ T-01 complete (1/5)
✅ T-02 complete (2/5)
✅ T-03 complete (3/5)
✅ T-04 complete (4/5)
✅ T-05 complete (5/5)
✅ Check passed
✅ Recap complete

Build v{N} shipped in {X} hours! 🎉
```

## Comparison to Manual Workflow

**Manual (old way):**
```
/plan Add export
/execute
/execute
/execute
/execute
/execute
/check
/recap
```

**Autonomous (new way):**
```
/lite Add export
[approve plan]
[wait while it runs]
✅ Done!
```

## When to Use Manual vs Autonomous

**Use /lite when:**
- Straightforward feature (3-8 tasks)
- You trust AI to implement independently
- You can review code after completion

**Use manual (/plan + /execute) when:**
- You want to review each task before proceeding
- Complex tasks need human guidance
- Learning the framework
- High-risk changes

## Time Savings

Typical Lite Build:
- Manual: 7 commands, ~10 interruptions
- Autonomous: 1 command, 1-2 approvals

**Time saved: ~80% of context switching**
