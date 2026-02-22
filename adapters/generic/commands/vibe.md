
Execute vibe (quick fix): $ARGUMENTS

## Overview

A **vibe** is a 1-3 task quick fix that doesn't need build ceremony.

This command does EVERYTHING automatically:
1. Implements the fix
2. Runs check (guards)
3. Commits with "vibe:" prefix
4. Adds one-line entry to .vibe/CHANGELOG.md

No build directory. No GOAL/PLAN/RECAP. Just: fix → verify → ship.

## Viability Check

Before starting, verify this qualifies as a vibe:

```
Analyzing: "{fix description}"

Estimated tasks: {count}
Risk level: {Low/Medium/High}
Core behavior change: {Yes/No}
Guard contract change: {Yes/No}

Vibe eligibility:
✅ 1-3 tasks
✅ Low risk
✅ No core behavior change
✅ No guard changes

Proceeding as vibe...
```

If it doesn't qualify:
```
⚠️ This is too complex for a vibe

Reason:
- {why it doesn't qualify}

Recommendation: Use /lite or /full instead

Should I:
1. Convert to Lite Build (/lite)
2. Convert to Full Build (/full)
3. Do it anyway as vibe (not recommended)

What should I do?
```

## Process

### 1. Implementation

```
Implementing: {description}

[Write code]
[Update/add tests if needed]
[Verify basic functionality]

Changes:
- Modified: {files}
- Tests: {added/updated}

Implementation complete ✅
```

### 2. Verification (Check)

```
Running checks...

📋 Contract Layer:
✅ G-01: {Guard name} - PASS
✅ G-02: {Guard name} - PASS
...

All guards pass ✅
```

If check fails:
```
❌ Check failed

Guard G-{X} failed: {reason}

This vibe broke a guard!
Options:
1. Auto-fix and retry check
2. Revert changes
3. Promote to Lite Build (needs proper ceremony)

Attempting auto-fix...
[Try to fix]

If fixed: ✅ Guards now pass, continuing
If not: ⚠️ Reverting changes or promoting to build
```

### 3. Commit

```
Committing changes...

Commit message:
vibe: {short description based on changes}

Co-Authored-By: AI Assistant <noreply@example.com>

Committed: {commit hash}
```

### 4. CHANGELOG Update

```
Updating .vibe/CHANGELOG.md...

Added entry:
## Vibe: {date} — {description}
- Guards: All pass

.vibe/CHANGELOG.md updated ✅
```

### 5. Summary

```
Vibe complete! ✅

What changed:
- {file}: {change description}
- {file}: {change description}

Verification:
- All guards pass ✅
- Tests pass ✅

Committed as: vibe: {description}
Logged in .vibe/CHANGELOG.md

Total time: {X} minutes

Next: Continue coding or /lite for next feature
```

## Examples

### Example 1: CSS Fix

```
You: /vibe Fix button alignment on mobile

Claude: Analyzing...
        ✅ Qualifies as vibe (1 task, Low risk)

        Implementing fix...
        - Modified: src/components/Button.css
        - Added media query for mobile breakpoint

        Running checks...
        ✅ All guards pass

        Committed: vibe: fix button alignment on mobile
        Updated .vibe/CHANGELOG.md

        ✅ Done in 2 minutes
```

### Example 2: Dependency Update

```
You: /vibe Update axios to latest version

Claude: Analyzing...
        ✅ Qualifies as vibe (1 task, Low risk)

        Updating dependency...
        - package.json: axios ^1.6.0 → ^1.7.2
        - Running npm install
        - Running tests

        Running checks...
        ✅ All guards pass

        Committed: vibe: update axios to 1.7.2
        Updated .vibe/CHANGELOG.md

        ✅ Done in 3 minutes
```

### Example 3: Promoted to Build

```
You: /vibe Add user profile validation

Claude: Analyzing...
        ⚠️ Does NOT qualify as vibe

        Reason:
        - Estimated 5 tasks (> 3)
        - Medium risk (touches core user flow)
        - Changes guard contract (G-03: Data Validation)

        Recommendation: Use /lite instead

        Converting to Lite Build...
        [Runs /lite Add user profile validation]
```

## Auto-Promotion Rules

Automatically promote to build if:

**During analysis:**
- More than 3 tasks estimated
- Risk level Medium or High
- Touches core behavior
- Changes guard contract

**During implementation:**
- Check fails (broke a guard)
- Scope creeps beyond initial estimate
- Need rollback plan

**Promotion process:**
```
⚠️ Vibe promoted to Lite Build mid-execution

Reason: {why}

Creating builds/v{N}/
Migrating changes to proper build structure...

Converting to Lite Build:
✅ Created GOAL.md (from vibe description)
✅ Created TASKS.md (from implementation steps)
✅ Work in progress preserved

Continue as Lite Build? (Yes/No)
```

## Edge Cases

### Vibe breaks tests but not guards

```
⚠️ Tests failed

Guard checks pass ✅
But unit tests failed:
- {test name}: {reason}

This is unusual for a vibe.

Options:
1. Fix tests and continue
2. Revert changes
3. Promote to Lite Build for proper review

Auto-fixing tests...
[Attempt fix]
```

### Vibe requires environment changes

```
⚠️ Detected environment dependency

This vibe requires:
- New environment variable: {VAR_NAME}
- Configuration change: {config}

Vibes should not require environment changes.

Recommendation: Promote to Lite Build
- Add proper SHIP.md with environment setup
- Document in GOAL.md

Promote to /lite? (Yes/No)
```

### Multiple related vibes

```
⚠️ Pattern detected

You've run 3 vibes in 15 minutes:
- vibe: fix button color
- vibe: adjust button padding
- vibe: update button hover state

These might be part of a larger change.

Should these be consolidated into a Lite Build:
"Redesign button component"?

Yes → Create Lite Build combining all changes
No → Continue with separate vibes
```

## Limitations

Vibes are NOT suitable for:
- ❌ New features (use /lite or /full)
- ❌ Breaking changes (use /full)
- ❌ Database migrations (use /full)
- ❌ API contract changes (use /lite or /full)
- ❌ Security fixes affecting auth (use /full)
- ❌ Performance refactors (use /lite)

Vibes ARE great for:
- ✅ CSS/styling tweaks
- ✅ Copy/text changes
- ✅ Dependency updates (minor)
- ✅ Bug fixes (isolated, low risk)
- ✅ Documentation updates
- ✅ Linting/formatting fixes

## Decision Flow

```
New work arrives
  ↓
Is it 1-3 tasks?
  No → /lite or /full
  Yes ↓
Is it Low risk only?
  No → /lite or /full
  Yes ↓
Does it change core behavior?
  Yes → /lite or /full
  No ↓
Does it change guard contracts?
  Yes → /lite or /full
  No ↓
✅ Use /vibe
```

## Comparison

**Vibe (/vibe):**
```
/vibe Fix typo in error message
[2 minutes]
✅ Done
```

**Lite Build (/lite):**
```
/lite Add export feature
[approve plan]
[2 hours]
✅ Done
```

**Manual vibe (old way):**
```
[write code]
/check
git commit -m "vibe: fix typo"
echo "## Vibe: date - fix typo" >> .vibe/CHANGELOG.md
```

**Autonomous vibe (new way):**
```
/vibe Fix typo in error message
[automated, 2 minutes]
✅ Done
```

## Time Savings

- Manual vibe: 5-10 minutes (coding + commands)
- Autonomous vibe: 2-5 minutes (just coding, rest automated)

**Time saved: 50% on small fixes**

## Output Format

```
🔧 Vibe: {description}

✅ Implementation (1 min)
✅ Check (30 sec)
✅ Commit (10 sec)
✅ CHANGELOG (10 sec)

Total: {X} minutes
All guards pass ✅

Changes:
- {file}: {summary}

Committed: vibe: {message}
```
