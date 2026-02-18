# Complete Commands Guide

## Two Ways to Work

### **Autonomous Mode** (Recommended - New!)
Run entire workflows with one command. AI does everything automatically.

### **Manual Mode** (Step-by-Step)
Run each phase manually. More control, more commands.

---

## Autonomous Commands (One-Shot Workflows)

### `/vibe <description>` - Quick Fix (2-5 min)

**What it does:**
Implements small fix → runs check → commits → updates changelog

**Example:**
```
/vibe Fix button alignment on mobile

✅ Done in 2 minutes
- Modified Button.css
- All guards pass
- Committed & logged
```

**Use when:** 1-3 tasks, Low risk, no core changes

---

### `/lite <feature>` - Lite Build (1-4 hours)

**What it does:**
Creates GOAL/TASKS → executes all tasks → check → recap → changelog

**Example:**
```
/lite Add CSV export to admin dashboard

[Approve plan]

✅ Done in 2.5 hours
- 5 tasks completed
- All guards pass
- Build v3 shipped
```

**Use when:** 3-8 tasks, Low-Medium risk, straightforward

---

### `/full <feature>` - Full Build (4+ hours)

**What it does:**
Creates GOAL/PLAN/DESIGN → executes all tasks → check → review → ship → recap → changelog

**Example:**
```
/full Replace authentication with SSO

[Approve plan]
[Wait while it runs]
[Complete SHIP.md checklist]

✅ Done in 6 hours
- 12 tasks completed
- Review PASS
- Build v4 shipped
```

**Use when:** 8+ tasks, High risk, architecture changes

---

## Manual Commands (Step-by-Step)

### `/start` - Initialize Framework

**One-time setup via prompts**

```
/start

What type of project? → Web application
Core flows? → Auth, Dashboard, Payments
Guards? → 5
Create first build? → Yes

✅ Project initialized
```

---

### `/plan <feature>` - Create Build

**Creates planning documents only**

```
/plan Add notifications

✅ Created builds/v2/
   - GOAL.md
   - TASKS.md
   - (PLAN.md if Full)
```

Then manually run `/execute`, `/check`, etc.

---

### `/execute` - Work on Next Task

**Implements one task at a time**

```
/execute

Working on T-01...
✅ T-01 complete (1/5)

/execute

Working on T-02...
✅ T-02 complete (2/5)
```

Repeat until all tasks done.

---

### `/check` - Verify Guards

**Runs all guard tests**

```
/check

✅ G-01: Auth - PASS
✅ G-02: Validation - PASS
...

All guards pass ✅
```

---

### `/review` - Review Before Ship

**Creates review document (Full builds)**

```
/review

✅ REVIEW.md created
Status: PASS

No critical findings
```

---

### `/ship` - Deployment Checklist

**Creates ship checklist**

```
/ship

✅ SHIP.md created

Complete checklist:
[ ] Run migration
[ ] Deploy
[ ] Smoke test
```

---

### `/recap` - Close Build

**Final closure with summary**

```
/recap

✅ RECAP.md created
✅ CHANGELOG.md updated

Build v2 complete! 🎉
```

---

### `/propose` - Suggest Next Build

**AI suggests next feature from RECAP seeds**

```
/propose

Suggested: Build v3: Add Analytics
Should I create it?
```

---

## Command Comparison

| Command | Type | Steps | Time | When to Use |
|---------|------|-------|------|-------------|
| `/vibe <desc>` | **Autonomous** | 1 command | 2-5 min | Quick fixes |
| `/lite <feature>` | **Autonomous** | 1 command + approval | 1-4 hours | Straightforward features |
| `/full <feature>` | **Autonomous** | 1 command + approvals | 4+ hours | Complex features |
| `/plan` + manual | **Manual** | 7+ commands | Same duration | More control needed |

---

## Decision Tree: Which Command?

```
New work arrives
  ↓
1-3 tasks, quick fix?
  Yes → /vibe <description>
  No ↓

3-8 tasks, straightforward?
  Yes → /lite <feature>
  No ↓

8+ tasks or complex?
  Yes → /full <feature>
  No ↓

Want step-by-step control?
  Yes → /plan + /execute + /check + /recap
```

---

## Workflow Examples

### Quick Fix (Vibe)

**Autonomous:**
```bash
/vibe Fix scroll overflow on settings page
# Wait 2 minutes
# ✅ Done
```

**Manual equivalent:**
```bash
# Write code manually
/check
git commit -m "vibe: fix scroll overflow"
echo "## Vibe: date - fix scroll" >> CHANGELOG.md
```

---

### Medium Feature (Lite Build)

**Autonomous:**
```bash
/lite Add user profile editing

# Review and approve plan
# Wait 2 hours
# ✅ Done (auto-executed all tasks)
```

**Manual equivalent:**
```bash
/plan Add user profile editing
/execute  # T-01
/execute  # T-02
/execute  # T-03
/execute  # T-04
/execute  # T-05
/check
/recap
```

---

### Complex Feature (Full Build)

**Autonomous:**
```bash
/full Implement SSO authentication

# Review and approve plan
# Wait ~4 hours (auto-executes)
# Complete SHIP.md checklist when prompted
# ✅ Done
```

**Manual equivalent:**
```bash
/plan Implement SSO authentication
/execute  # T-01
/execute  # T-02
# ... (10 more times)
/check
/review
/ship
# [manually complete checklist]
/recap
```

---

## Checkpoints & Approvals

### `/vibe` - Zero Approvals
Runs completely autonomously. Auto-reverts if guards fail.

### `/lite` - One Approval
1. Approve plan → then fully autonomous

### `/full` - Multiple Approvals
1. Approve plan
2. Resolve any blockers
3. Complete SHIP.md checklist

---

## When Autonomous Commands Pause

All autonomous commands pause and ask for input when:

1. **Task gets blocked** - "What should I do?"
2. **Check fails** - "Guard broken, fix or revert?"
3. **Review blocked** - "Critical issues found"
4. **Ship checklist** - "Complete deployment steps"
5. **Error** - "Unexpected failure, retry or cancel?"

Between pauses: **fully autonomous**

---

## Resume After Interruption

If interrupted:

```bash
/lite  # (no arguments)

# Found incomplete Lite Build v3
# Resume? (Yes/No)
```

Or:

```bash
/full  # (no arguments)

# Found incomplete Full Build v4
# Phase: Execution (6/12 tasks done)
# Resume? (Yes/No)
```

---

## Mixing Modes

You can switch between modes:

```bash
# Start autonomous
/lite Add export feature

# Something goes wrong, switch to manual
# [Interrupt with Ctrl+C]

# Continue manually
/execute  # Pick up where it left off
/check
/recap
```

Or vice versa:

```bash
# Start manual
/plan Add notifications
/execute
/execute

# Get tired of manual, switch to autonomous
/lite  # (detects existing build, resumes autonomously)
```

---

## Best Practices

### Use Autonomous When:
✅ Routine/standard implementations
✅ Time-constrained (want it done while you do other work)
✅ Trust AI to handle independently
✅ Reviewing after is acceptable

### Use Manual When:
✅ Learning the framework
✅ Novel/unusual patterns
✅ Want to review each step before proceeding
✅ Extremely high-risk changes

---

## Time Savings Comparison

| Scenario | Manual | Autonomous | Time Saved |
|----------|--------|------------|------------|
| Quick fix | 5-10 min | 2-5 min | 50% |
| Lite Build | Same work, 7 commands | Same work, 1 command | 80% interruptions |
| Full Build | Same work, 15 commands | Same work, 1 command | 90% interruptions |

**Main benefit:** Reduced context switching, not faster execution.

---

## Summary

### Autonomous (New!)
- `/vibe <desc>` - Quick fix, done in minutes
- `/lite <feature>` - Medium build, approve once
- `/full <feature>` - Complex build, approve + deploy

### Manual (Original)
- `/init` - Setup
- `/plan` - Create build
- `/execute` - One task at a time
- `/check` - Verify guards
- `/review` - Review findings
- `/ship` - Deploy checklist
- `/recap` - Close build
- `/propose` - Suggest next

**Pick your style:**
- **Fast & automated** → Use `/vibe`, `/lite`, `/full`
- **Controlled & step-by-step** → Use `/plan` + manual steps
- **Mix both** → Start manual, switch to autonomous (or vice versa)

All roads lead to the same outcome: **working code with guards verified**. Choose the path that fits your workflow.

---

## 🧠 Brainstorming Phase (New!)

**All planning commands now include collaborative brainstorming.**

Before creating any documents, AI asks clarifying questions:

### Why Brainstorming Matters

**Without questions:**
```
/lite Add CSV export
→ AI guesses requirements
→ Wrong assumptions
→ Rework during implementation ❌
```

**With questions:**
```
/lite Add CSV export

Claude: Let me understand first:
1. Export scope: All fields or visible only?
2. Scale: How many rows?
3. Permissions: Who can export?
4. Audit: Should we log it?

You: Visible only, <100 rows, admins only, yes log

Claude: Perfect! Creating plan based on your answers...
→ Right design upfront
→ No rework needed ✅
```

### What Gets Asked

**Always:**
- Scope boundaries (what's OUT?)
- Success criteria (how do we know it's done?)
- Risk areas (what could go wrong?)
- User impact (who uses this, how?)

**When Unclear:**
- Architecture approach (if multiple options)
- Data model design
- API contracts
- UI/UX behavior
- Testing strategy
- Performance requirements
- Security/permissions

### Brainstorming by Command

| Command | Questions Depth |
|---------|----------------|
| `/vibe` | Quick (1-2 questions) |
| `/plan`, `/lite` | Moderate (3-5 questions) |
| `/full` | Deep (5-10 questions) |

### Example: Lite Build Brainstorming

```
You: /lite Add CSV export

Claude: Let me understand the requirements first:

Q1 - Export Scope: All fields or visible columns only?
Q2 - Scale: How many rows? (<100 sync, 100-10k async, 10k+ streaming)
Q3 - Permissions: All admins, admin role only, or new permission?
Q4 - Audit: Log who exported, when, and what?

You: Visible only, <100, admin only, yes log

Claude: Creating plan:
- Export 4 visible columns, sync download
- Admin role required
- Audit logging included
- 5 tasks, ~3 hours

Approve? (Yes/No)
```

### When to Skip Brainstorming

Only skip when requirements are crystal clear, implementation is completely standard, and there's a single valid approach. Even vibes ask clarifying questions when the target is ambiguous.

**Result**: Better requirements, better code, less rework.

