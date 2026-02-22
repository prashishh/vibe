
Plan a new build for: $TASK

## Mode Selection

First, determine the appropriate build mode:

**Decision criteria:**
- 1-3 tasks + Low risk + No core changes → **VIBE** (not this command, just code it)
- 3-8 tasks + Low-Medium risk + No architecture → **LITE BUILD** (use lite templates)
- 8+ tasks OR High risk OR Architecture needed → **FULL BUILD** (use build templates)

Ask the user which mode to use, or auto-detect based on:
- Estimated task count
- Complexity/risk assessment
- Whether architecture design is needed

## Process

### Phase 1: Context Gathering

Read:
- `core/VIBE.md`
- `.vibe/GUARDS.md`
- Latest `builds/v*/RECAP.md` (if available)
- Recent code changes (`git log --oneline -10`)
- Existing codebase patterns (relevant files)

### Phase 2: Collaborative Brainstorming (IMPORTANT)

**Before creating any documents**, ask clarifying questions to understand requirements deeply.

#### Always Ask About

1. **Scope Boundaries**
   - "What's explicitly OUT of scope for this feature?"
   - Helps prevent scope creep

2. **Success Criteria**
   - "How will we know this is done and working correctly?"
   - Defines measurable outcomes

3. **Risk Areas**
   - "What could go wrong? What are you most worried about?"
   - Identifies potential blockers early

4. **User Impact**
   - "Who will use this? How will it change their workflow?"
   - Ensures user-centric design

#### Ask When Unclear

**Architecture** (if multiple valid approaches):
```
Which approach should we use for {feature}?

a) {Approach A}: {pros/cons}
b) {Approach B}: {pros/cons}
c) {Approach C}: {pros/cons}

Trade-offs: {comparison}
Recommendation: {A} because {reason}

Which would you prefer?
```

**Data Model** (if structure ambiguous):
```
How should {entity} be structured?

Option 1: {schema design}
  - Pros: {benefits}
  - Cons: {drawbacks}

Option 2: {schema design}
  - Pros: {benefits}
  - Cons: {drawbacks}

Which fits your needs better?
```

**API Design** (if contracts unclear):
```
What should the API look like?

Proposal:
  POST /api/{resource}
  GET /api/{resource}/:id

Should we also include:
- Bulk operations (POST /api/{resource}/bulk)?
- Filtering (GET /api/{resource}?filter=...)?
- Pagination (GET /api/{resource}?page=1)?

What's needed vs nice-to-have?
```

**UI/UX** (if behavior unspecified):
```
How should {feature} behave in the UI?

a) Modal dialog (blocks interaction)
b) Slide-out panel (non-blocking)
c) Inline form (in-place editing)

Expected user flow: {describe}
Does this match your vision?
```

**Testing Strategy** (if quality bar unclear):
```
What level of testing is needed?

a) Unit tests only (fast, focused)
b) Unit + Integration (moderate coverage)
c) Unit + Integration + E2E (comprehensive)

Given this is {risk level}, I recommend {option}.
Sound good?
```

**Performance** (if scale unclear):
```
What scale should this handle?

- Expected usage: {X} requests/day?
- Data volume: {Y} records?
- Response time: < {Z}ms acceptable?

This determines if we need caching/optimization upfront.
```

**Security** (if permissions unclear):
```
Who should have access to {feature}?

a) All authenticated users
b) Specific roles: {list}
c) New permission: {name}

Should we log access for audit?
```

#### Example Brainstorming Session

```
You: /plan Add CSV export to admin dashboard

Claude: Let me understand this better before planning:

**Question 1: Scope Boundaries**
What should CSV export include?

a) All user fields (including sensitive data)
b) Visible table columns only (recommended)
c) Configurable - admin selects columns

**Question 2: Scale & Performance**
How many users might be exported at once?

a) < 100 (sync export, instant download)
b) 100-10k (async job, email when ready)
c) 10k+ (needs pagination/streaming)

**Question 3: Permissions**
Who can use export feature?

a) All admins
b) Only 'admin' role
c) New permission 'can_export_users'

**Question 4: Audit Trail**
Should we log export activity?

a) Yes - track who exported what/when
b) No - read-only, no logging needed

Your answers help me create the right plan.
```

User answers → Better GOAL/PLAN documents

### Phase 3: Mode Detection

Based on brainstorming, determine mode:
```
Analysis:
- Tasks: {estimated count}
- Complexity: {Low/Medium/High}
- Risk: {Low/Medium/High/Critical}
- Architecture needed: {Yes/No}

Recommended mode: {Vibe/Lite/Full}
Reason: {justification}

Proceed with {mode}? Or prefer different mode?
```

### Phase 4: Determine Build Version

Find next version under `builds/`.

### For Lite Build

3. Create (using `templates/lite/`):
   - `builds/v{N}/GOAL.md` (simplified)
   - `builds/v{N}/TASKS.md` (with inline acceptance)

4. Each task needs:
   - Outcome
   - Risk (Low or Medium only)
   - Acceptance criteria
   - Files affected
   - (Rollback optional, add if needed)

### For Full Build

3. Create (using `templates/build/`):
   - `builds/v{N}/GOAL.md` (detailed)
   - `builds/v{N}/PLAN.md` (with tasks)
   - `builds/v{N}/TASKS.md` (summary/tracker)

4. Each task needs:
   - Outcome
   - Risk
   - Acceptance
   - Rollback
   - Guards touched
   - Files impacted

5. Optional for complex work:
   - `builds/v{N}/DESIGN.md` (architecture)
   - `builds/v{N}/TEST_PLAN.md` (test strategy)
   - `builds/v{N}/DECISIONS.md` (trade-offs)

## Output

Print:
- Build mode (Lite or Full)
- Build ID (v{N})
- Guard impact summary
- Task count estimate
- Created files
