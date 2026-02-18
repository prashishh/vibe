# Vibe Framework v0.1.0

A development workflow framework designed for AI-assisted software development. Replaces traditional sprints with outcome-driven **builds** and permanent **guards**.

---

## Table of Contents

1. [Why Not Sprints?](#why-not-sprints)
2. [Core Concepts](#core-concepts)
3. [Three-Tier Work System](#three-tier-work-system)
4. [Guards Layer](#guards-layer)
5. [Build Phases](#build-phases)
6. [Tasks](#tasks)
7. [Vibes (Quick Fixes)](#vibes-quick-fixes)
8. [Skills (Commands)](#skills-commands)
9. [Guard Implementation Layers](#guard-implementation-layers)
10. [Metrics](#metrics)
11. [File Structure](#file-structure)
12. [Lifecycle Example](#lifecycle-example)
13. [Changelog](#changelog)
14. [Migration from Sprints](#migration-from-sprints)
15. [Pros and Cons](#pros-and-cons)
16. [Future Improvements](#future-improvements)

---

## Why Not Sprints?

The traditional sprint (2 weeks, planning meeting, standup, retro) was designed for **human coordination overhead** — syncing 5-10 developers who each hold partial context.

With AI-assisted development, the dynamics change fundamentally:

| Sprint Assumption | AI-Assisted Reality |
|-------------------|---------------------|
| 2-week timebox | Features ship in hours, not weeks |
| Planning meeting coordinates the team | One human + AI holds full context |
| Velocity measured in story points | Tasks are atomic and predictable (5-10 min each) |
| Daily standup syncs progress | Unnecessary — AI maintains continuous context |
| Sprint review shows stakeholders | `/review` + `/recap` capture review + closure artifacts |
| Backlog grooming prioritizes work | A conversation: "what should we build next?" |

**The unit of work is no longer the developer-week. It's the intent-to-verification cycle.**

A build closes when the **outcome is validated and live** — not when a calendar says two weeks are up.

---

## Core Concepts

### Two-Layer Architecture

```
+-----------------------------------------------------------+
|                      GUARDS (permanent)                    |
|  Core contracts verified after EVERY build                 |
|  G-01: Auth  G-02: Story Gen  G-03: Story Read  ...      |
+----------------------------+------------------------------+
                             |
                   verified after every build
                             |
+----------------------------v------------------------------+
|                      BUILD (temporary)                     |
|                                                            |
|  GOAL --> PLAN --> BUILD --> VERIFY --> REVIEW --> SHIP --> RECAP      |
|                                                            |
|  Contains: Tasks (T-01, T-02, ...)                         |
|  Closes when: outcome validated + guards pass              |
+-----------------------------------------------------------+
```

**Guards** are the constitution — permanent, append-only, never weakened.
**Builds** are legislation — temporary, goal-specific, close when done.
**Vibes** are amendments — small, low-ceremony fixes that still pass through guards.

### Vocabulary

| Concept | Name | Example |
|---------|------|---------|
| Framework | **Vibe Framework** | "We use Vibe Framework" |
| Planned work (full ceremony) | **Full Build** | Build v1: Admin Auth |
| Medium ceremony work | **Lite Build** | Build v2: Add export feature |
| Small quick work (low ceremony) | **Vibe** | `vibe: fix scroll overflow` |
| Permanent contract | **Guard** | G-01: Auth Round-Trip |
| Work item within a build | **Task** | T-01: Create schema |
| Run all guards | **Vibe check** | "Run vibe check" |
| Documents | GOAL, PLAN, SHIP, RECAP | — |

### Roles

| Role | Responsibility |
|------|----------------|
| **Human** | Decides WHY to build (business/user need), reviews output, approves plans, final sign-off |
| **AI** | Proposes WHAT (goals), plans HOW, executes, tests, documents, tracks guards |

The human's role shifts from **writing code** to **directing intent and reviewing output**.

---

## Three-Tier Work System

Vibe Framework supports three levels of ceremony based on scope, complexity, and risk.

### Decision Matrix

| Dimension | Vibe | Lite Build | Full Build |
|-----------|------|------------|------------|
| **Task count** | 1-3 | 3-8 | 8+ |
| **Complexity** | Low | Medium | High |
| **Risk** | Low only | Low-Medium | Any (Medium-Critical) |
| **Architecture design** | No | No | Yes (DESIGN.md) |
| **Multiple subsystems** | No | Maybe | Yes |
| **Time to close** | Minutes | 1-4 hours | 4+ hours |

### Artifact Requirements

| Document | Vibe | Lite Build | Full Build |
|----------|------|------------|------------|
| **GOAL.md** | ❌ | ✅ Required | ✅ Required |
| **PLAN.md** | ❌ | ⚠️ Optional | ✅ Required |
| **TASKS.md** | ❌ | ✅ Required | ✅ Required |
| **DESIGN.md** | ❌ | ❌ | ⚠️ If complex |
| **TEST_PLAN.md** | ❌ | ❌ | ⚠️ If complex |
| **REVIEW.md** | ❌ | ⚠️ If Medium risk | ✅ Required |
| **SHIP.md** | ❌ | ⚠️ If non-trivial deploy | ✅ Required |
| **RECAP.md** | ❌ | ✅ Required | ✅ Required |
| **DECISIONS.md** | ❌ | ❌ | ⚠️ If trade-offs exist |
| **Commit message** | ✅ | ✅ | ✅ |
| **CHANGELOG entry** | 1 line | 1 section | 1 section |

### Process Flows

**Vibe (Zero Ceremony)**
```
Code → Check → Commit → CHANGELOG line
```

**Lite Build (Minimal Ceremony)**
```
GOAL → TASKS → BUILD → VERIFY → RECAP
         ↓               ↓
   (optional PLAN)  (optional REVIEW/SHIP)
```

**Full Build (Complete Ceremony)**
```
GOAL → PLAN → DESIGN* → BUILD → VERIFY → REVIEW → SHIP → RECAP
                                    ↓
                              (all guards pass)
```

### When to Use Each Tier

**Use Vibe when:**
- 1-3 simple tasks
- Low risk only
- No core behavior changes
- No guard contract changes
- Fix, polish, or minor enhancement
- Example: "Fix button alignment on mobile"

**Use Lite Build when:**
- 3-8 tasks
- Low-Medium risk
- Straightforward implementation (no architecture decisions)
- Touches existing subsystems but doesn't redesign them
- Guard verification needed but outcome is clear
- Example: "Add CSV export to admin dashboard"

**Use Full Build when:**
- 8+ tasks OR high complexity
- Medium-Critical risk
- Requires architecture/design decisions
- Multiple subsystems affected
- Complex deployment or migration
- Trade-offs need documentation
- Example: "Replace auth system with SSO"

**Promotion rule:** If a Vibe or Lite Build grows in scope or fails guards, promote it to the next tier and create missing artifacts.

### Mode Selection Algorithm

```
New work arrives
  ├─ 1-3 tasks + Low risk + No core changes?
  │   └─→ VIBE
  │
  ├─ 3-8 tasks + Low-Medium risk + No architecture?
  │   └─→ LITE BUILD
  │
  └─ Otherwise (8+ tasks OR High risk OR Architecture)
      └─→ FULL BUILD
```

---

## Guards Layer

Guards are **permanent, cross-build contracts** that define what must never break. They live at the project root and are referenced by every build.

### Properties of a Guard

| Property | Description |
|----------|-------------|
| **Contract** | Plain English description of the guarantee |
| **Invariants** | Specific checkable conditions (become test assertions) |
| **Layer** | Where it's verified: Contract (pure logic) / Browser (Playwright) / AI Agent (natural language) |
| **Risk if broken** | Severity: Total / Critical / High |

### Rules

1. **Append-only** — you can add new guards, never remove or weaken existing ones
2. **Human-owned** — AI cannot modify guards without explicit human approval
3. **Build close gate** — a build CANNOT close unless tests pass, all guards pass, REVIEW.md status is PASS, and SHIP.md has no unchecked boxes
4. **Always verified** — run ALL guards after every build, not just the ones marked "touched"
5. **Keep them few** — 6-10 maximum. More than that becomes noise.

### Example Guards

```markdown
## G-01: Auth Round-Trip
- Contract: User signs in via Google -> profile created/loaded ->
  session persists across reload -> logout clears all state
- Invariants:
  - Profile has: id, email, display_name, age_group
  - Session has: access_token
  - Logout clears localStorage completely
- Layer: Contract (logic) + Browser (flow)
- Risk if broken: Total (app unusable)

## G-02: Story Generation (Interactive)
- Contract: Authenticated user with quota -> selects options ->
  confirms -> story generates -> tree has scenes with branching choices
- Invariants:
  - Quota checked BEFORE generation starts
  - Entitlement priority: org -> personal age -> subscription -> pack -> deny
  - New story has no canonical_path (branching enabled)
  - Failed generation releases any reserved credits
- Layer: Contract (quota logic) + Browser (creation flow)
- Risk if broken: Critical (core product)

## G-03: Route Protection
- Contract: Protected routes redirect unauth users;
  admin routes require password; public routes always accessible
- Invariants:
  - /create -> redirects to /login if unauth
  - /admin/* -> shows password form if no admin auth
  - /, /story/:id -> accessible without auth
- Layer: Browser
- Risk if broken: High (security/UX)
```

### When to Add a New Guard

Add a guard when:
- A new **core flow** is introduced (e.g., editorial stories get their own guard once they're core to the product)
- A **regression occurred** that should never happen again
- A **security boundary** is established (data isolation, auth gates)

Do NOT add guards for:
- Feature-specific behavior (that's a test, not a guard)
- UI details (button colors, spacing, copy)
- Admin-only flows (unless they affect user-facing data)

---

## Build Phases

These phases apply to **Full Builds**. For **Lite Builds**, PLAN/DESIGN/TEST_PLAN/REVIEW/SHIP are optional and created only when needed.

### Phase 1: GOAL

**File:** `builds/v{N}/GOAL.md`
**Skill:** `/plan <feature>` or `/plan-lite <feature>`
**Owner:** Human provides intent, AI drafts, human approves
**Required for:** Lite Build, Full Build

```markdown
# Build v10: [Feature Name]

## Intent
What problem are we solving and for whom?

## Success Metric
How do we know the outcome is achieved? (specific, measurable)

## Scope
- What's IN
- What's explicitly OUT (non-goals)

## Boundaries
- API contracts affected
- DB schema changes
- UI surfaces touched

## Risks
| Risk | Impact | Mitigation |
|------|--------|------------|

## Guard Impact
Which guards could this build affect?
- G-02: Story Generation — YES (touching quota logic)
- G-06: Entitlement Priority — NO (not touching)
```

The **Guard Impact** section forces upfront thinking about what core flows could break.

### Phase 2: PLAN

**File:** `builds/v{N}/PLAN.md`
**Skill:** Part of `/plan`
**Required for:** Full Build
**Optional for:** Lite Build (if tasks need detailed acceptance criteria)

Contains **Tasks** — the atomic work items. See [Tasks](#tasks) section.

For complex builds (Full Build only), also create:
- `DESIGN.md` — technical design with schema, API contracts, component architecture
- `TEST_PLAN.md` — comprehensive test strategy
- `DECISIONS.md` — architectural trade-offs and rationale

### Phase 3: BUILD

**Skill:** `/execute`

Pick next task, implement, test, commit. Repeat until all tasks are done.

Commit convention:
```
feat(v10/T-03): add scheduled publishing to editorial stories
fix(v10/T-03): handle timezone edge case in publish scheduler
```

The build + task number in every commit makes tracing trivial.

### Phase 4: VERIFY

Two sub-steps:

**4a: Task verification**
- Each task's acceptance criteria checked
- New tests written for new behavior
- Code builds successfully

**4b: Vibe check (guard verification)**
- Run ALL guards — not just the ones marked "touched" in the GOAL
- This is the safety net: even if GOAL said "G-02 not affected," we verify anyway
- Guards marked "touched" get extra scrutiny

```bash
npm run check          # runs all contract + browser guards
npm run check:quick    # runs only contract-layer (seconds)
```

**If a guard fails:** Build does NOT close. Fix the regression first, then re-verify.

### Phase 5: REVIEW

**File:** `builds/v{N}/REVIEW.md`
**Skill:** `/review`
**Required for:** Full Build
**Optional for:** Lite Build (if any task has Medium+ risk)

Review happens only after VERIFY is complete.

Minimum gate for REVIEW:
- tests pass for scoped changes
- `check` passes
- findings documented with severity and disposition
- review status set to `PASS` or `BLOCKED`

If review status is `BLOCKED`, build cannot move to SHIP.

**Lite Build shortcut:** If all tasks are Low risk and check passes, REVIEW.md can be skipped entirely.

### Phase 6: SHIP

**File:** `builds/v{N}/SHIP.md`
**Skill:** `/ship`
**Required for:** Full Build
**Optional for:** Lite Build (if deployment is non-trivial)

`SHIP.md` is a live checklist and must be updated during execution:
- mark completed items as `[x]` immediately after completion
- leave only incomplete items as `[ ]`
- include blocker note next to any unchecked item

Build cannot proceed to RECAP until all required SHIP checklist items are `[x]`.

**Lite Build shortcut:** If deployment is just `git push` or `npm publish` with no migrations/config/flags, SHIP.md can be skipped.

```markdown
## Ship Checklist
- [x] Migration applied: 006_scheduled_publishing.sql
- [x] Environment variables updated: (none needed)
- [x] Feature flags: SCHEDULED_PUBLISHING=true
- [x] Rollback plan validated
- [x] Deployment completed
- [x] Production smoke test passed
```

This phase closes the gap between "code works locally" and "it's live for users."

### Phase 7: RECAP

**File:** `builds/v{N}/RECAP.md`
**Skill:** `/recap`
**Required for:** Lite Build, Full Build

```markdown
## Recap

### What shipped
- 3 tasks completed, all acceptance criteria met
- 2 new integration tests, 1 new E2E test

### Architecture decisions
- Chose cron-based scheduling over event-driven (simpler, sufficient)

### Guard results
- All 7 guards PASS
- G-02 (Story Gen): No regression despite touching stories.js

### Metrics
- Lead time: 2 hours (goal to verified)
- Rework: 0 (no task needed revision)
- Spec-to-code drift: None

### Next build seeds
- Analytics dashboard for editorial engagement
- Scheduled publishing could extend to AI-generated featured stories
- G-08 candidate: "Scheduled content goes live/offline at correct times"
```

The **Next build seeds** section feeds back into the next build's GOAL. The loop closes.

---

## Tasks

A task is the atomic work item within a build. Each task describes what changes and what happens if it goes wrong.

### Structure

```markdown
### T-03: Add audience gating to editorial API
- Outcome: Premium-only stories hidden from free users
- Risk: Medium (touches auth flow)
- Acceptance:
  - [ ] Integration test matrix covers all tier x audience combinations
  - [ ] Guest users see only freemium + all content
  - [ ] Premium users see premium + all content
- Rollback: Remove audience filter, return all live stories
- Guards touched: G-02 (quota resolution used for tier check)
- Files: server/routes/editorialStories.js, tests/integration/editorial-stories.test.js
```

### Properties

| Property | Purpose |
|----------|---------|
| **Outcome** | What's true after this task is done (not what was coded — what changed) |
| **Risk** | Low / Medium / High — drives review depth |
| **Acceptance** | Checkable conditions that become test assertions |
| **Rollback** | How to undo if it breaks something — forces thinking about reversibility |
| **Guards touched** | Which guards need re-verification after this task |
| **Files** | What's changing — for traceability |

---

## Vibes (Quick Fixes)

A **vibe** is a small, standalone unit of work that doesn't need full build ceremony.

### Rule
Under 3 tasks, doesn't introduce new core behavior, doesn't change a guard contract.

### Process

1. **Do the work** — just code it
2. **Run vibe check** — `npm run check`
3. **Commit** — `vibe: fix scroll overflow on settings page`
4. **Log it** — one line in `CHANGELOG.md`

No GOAL, no PLAN, no RECAP.

### When to promote a vibe to a build
- A guard fails after the change
- Scope creeps past 3 tasks
- You realize it touches core behavior
- It needs a rollback plan

### Decision flow
```
New work arrives
  → Is it under 3 tasks?
  → Does it touch a guard contract?
  → Does it change core behavior?

  All yes to first, no to others → Vibe
  Otherwise → Build
```

---

## Skills (Commands)

| Skill | Phase | Input | Output |
|-------|-------|-------|--------|
| `/plan <feature>` | Goal + Plan | Feature description | `GOAL.md` + `PLAN.md` with tasks |
| `/execute` | Build | Next pending task | Implementation + commit + acceptance checked |
| `/review` | Post-Verify | Verified build | `REVIEW.md` with findings, risks, and approval status |
| `/ship` | Ship | Review PASS | `SHIP.md` with checklist updated in-place (`[x]` for completed) |
| `/recap` | Recap | Shipped build with checklist complete | `RECAP.md` with metrics, decisions, guard results, seeds |
| `/propose` | Between builds | Previous RECAP.md seeds | Suggested next build goal |
| `/check` | Verify | — | Runs all guard tests, reports pass/fail |

---

## Guard Implementation Layers

### Layer 1: Contract Tests (Pure Logic)

Test exported functions with mock data. No server, no browser, no DB. Run in under 1 second.

```
tests/guards/contracts/
  g02-story-gen.test.js       # quota priority, reservation logic
  g04-replay-lock.test.js     # canonical path validation, lock decisions
  g06-entitlement.test.js     # source priority, 7-day window, age filtering
```

**Strengths:** Fast, deterministic, no infrastructure needed.
**Weaknesses:** Can't verify UI flows, auth redirects, or browser behavior.

### Layer 2: Browser Tests (Playwright)

Test actual flows in a browser. Requires running app.

```
tests/guards/flows/
  g01-auth-flow.spec.js       # OAuth mock -> profile visible -> logout clears
  g03-story-new.spec.js       # Create -> choices visible -> no replay lock
  g05-routes.spec.js          # Unauth redirect, admin password gate
  g07-data-isolation.spec.js  # Login -> data exists -> logout -> data gone
```

**Strengths:** Tests real user journeys, catches integration issues.
**Weaknesses:** Slower, needs infrastructure, selectors can break on UI changes.

### Layer 3: AI Agent Verification (Future)

Describe the guard in natural language. An AI agent navigates the app and validates.

**Strengths:** No selectors to maintain, resilient to UI changes, the description IS the test.
**Weaknesses:** Non-deterministic, slower, depends on AI capability, harder to debug failures.

### Recommended Approach

Start with **Layer 1 for logic guards** and **Layer 2 for flow guards**. Add Layer 3 when the product stabilizes.

---

## Metrics

Five metrics tracked in each build's RECAP.md.

| Metric | What It Measures | Healthy | Warning |
|--------|-----------------|---------|---------|
| **Lead time** | GOAL to VERIFY | Hours | Days |
| **Regression escape rate** | Guard failures per build | 0 | > 0 |
| **Spec-to-code drift** | PLAN vs actual | None | Significant |
| **Verification ratio** | Verify vs build time | < 20% | > 50% |
| **Rework rate** | Tasks revised | 0-1 | > 30% |

---

## File Structure

```
project-root/
|-- GUARDS.md                        # Core contracts (append-only, human-owned)
|-- CHANGELOG.md                     # All builds + vibes in chronological order
|-- builds/                      # All builds
|   |-- v10/
|   |   |-- GOAL.md                  # What and why + guard impact
|   |   |-- PLAN.md                  # Tasks with risk/rollback
|   |   |-- DESIGN.md                # Technical design (complex builds only)
|   |   |-- SHIP.md                  # Deployment checklist + rollback plan
|   |   |-- RECAP.md                 # What happened + metrics + next seeds
|   |   +-- REVIEW.md                # Optional architectural review
|   +-- ...
|-- tests/
|   |-- guards/                      # Guard-specific tests
|   |   |-- contracts/               # Layer 1: pure logic
|   |   +-- flows/                   # Layer 2: browser (Playwright)
|   |-- integration/
|   +-- e2e/
+-- .vibe/
    +-- adapters/
        |-- claude/commands/         # Adapter-specific command files
        |-- codex/                   # Codex adapter docs/scripts
        |-- kimi/                    # Kimi adapter docs/scripts
        +-- glm/                     # GLM adapter docs/scripts
```

---

## Changelog

The `CHANGELOG.md` is the single source of truth for everything that shipped.

```markdown
# Changelog

## [v2] Admin Management + Dashboard UI
- Admin user CRUD API (create, update, soft delete)
- Audit logging for all privileged actions
- Dashboard login with email/password
- Role-based navigation (admin/content/finance)
- Guards: All pass

## Vibe: 2025-02-15 — Fix scroll overflow on desktop pages
- Guards: All pass

## [v1] Admin Auth + Role Middleware
- admin_users and admin_roles schema
- Login/session endpoints with argon2
- Legacy ADMIN_PASSWORD removed
- Auth + role middleware on all admin/Prompt Lab routes
- Guards: All pass
```

**Builds** get a bullet summary. **Vibes** get one line.

---

## Migration from Sprints

1. **Create GUARDS.md** — define 6-8 core guards at the project root
2. **Write contract-layer guard tests** — fast to write, immediate value
3. **Rename sprints/ to builds/** — historical dirs stay as-is
4. **Update adapter files** — add guard awareness to each command
5. **First build uses new format** — GOAL.md, PLAN.md, RECAP.md with metrics
6. **Add browser guards incrementally** — start with route protection

---

## Key Insight

> Guards are the constitution. Builds are the legislation. Vibes are the amendments.

The constitution (guards) defines what must always be true. The legislation (builds) creates features within those boundaries. The amendments (vibes) make small fixes quickly — but still pass through constitutional review.

Move fast on features (builds ship in hours), maintain confidence in core stability (guards never break), and keep small stuff unblocked (vibes ship in minutes).
