---
description: Analyze your codebase and generate guards (permanent safety contracts).
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion
---

Analyze this codebase and generate (or update) .vibe/GUARDS.md with meaningful safety contracts.

## Overview

Guards are permanent, append-only contracts that define what must **never break** across builds. This command scans the project, identifies critical flows, and generates guards tailored to the actual codebase.

If `.vibe/GUARDS.md` already exists, this command operates in **update mode**: it finds new flows that aren't covered and suggests additions. It never removes or weakens existing guards.

## Process

### 1. Discovery

Scan the project to understand what it does:

```
🔍 Analyzing your codebase...

Reading project config (package.json, README, etc.)
Scanning source files for critical flows...

Detected project type: {Web app / API / CLI / Library / Monorepo}
```

**What to look for:**

| Pattern | Search terms | Guard type |
|---------|-------------|------------|
| Authentication | login, signin, auth, JWT, session, OAuth, passport, token | Auth boundary |
| Payments | checkout, billing, charge, stripe, payment, subscription, invoice | Payment integrity |
| Data persistence | database, migration, query, ORM, prisma, sequelize, mongoose, model | Data integrity |
| API surface | router, endpoint, controller, middleware, route, handler | API reliability |
| File handling | upload, multer, S3, storage, file, stream, buffer | File safety |
| User data | profile, account, email, password, PII, GDPR, privacy | User data protection |
| Background jobs | queue, worker, cron, job, scheduler, task | Job reliability |

Read: `package.json`, `README.md`, main config files, route definitions, middleware, models, services, and test files.

### 2. Analysis

Present findings to the user:

```
📋 Found {N} critical flows in your codebase:

1. Authentication (src/middleware/auth.js, src/routes/login.js)
   - Login, session management, token validation
   - Risk: Critical

2. Payment Processing (src/services/payment.js, src/routes/checkout.js)
   - Charge creation, refunds, webhook handling
   - Risk: Critical

3. Data Access Layer (src/models/*.js, src/db/migrations/)
   - User CRUD, order storage, query patterns
   - Risk: High

4. API Endpoints (src/routes/*.js, src/middleware/*.js)
   - REST API with auth middleware, rate limiting
   - Risk: High

Which flows should have guards?
1. All of the above (recommended)
2. Let me pick specific ones
3. Add flows I missed
```

Wait for user input before generating.

### 3. Generation

Create `.vibe/GUARDS.md` at the project root:

```
📝 Generating guards...
```

**Guard format (for each selected flow):**

```markdown
## G-{NN}: {Flow Name}
- **Contract**: {One sentence: what this guard guarantees}
- **Invariants**:
  - {Specific, testable condition that must always hold}
  - {Another specific condition}
  - {Another specific condition}
  - {Another specific condition}
- **Layer**: {Contract / Integration / E2E / Contract + Integration}
- **Risk if broken**: {Critical / High / Medium}
- **How to verify**:
  - {Concrete verification step referencing actual project files}
  - {Another verification step}
```

**Guard quality rules:**
- Invariants must be specific and testable, not vague ("handles errors gracefully" is bad; "invalid tokens return 401 within 50ms" is good)
- Reference actual files and patterns found during discovery
- Contracts should be one sentence that a new team member can understand
- "How to verify" should reference real test commands or files in the project

**Use these templates based on detected flow type:**

**Authentication flows:**
- Contract: Protected routes require valid authentication
- Invariants: unauthenticated access rejected, valid credentials work, invalid credentials rejected with clear errors, session/token management correct

**Payment flows:**
- Contract: Transactions are processed accurately and securely
- Invariants: charges match totals, no charge without confirmation, failed transactions handled gracefully, transaction state always consistent

**Data flows:**
- Contract: Data integrity and consistency maintained
- Invariants: writes are durable, reads return correct values, concurrent access handled safely, validation prevents corruption

**API flows:**
- Contract: API responses are consistent and reliable
- Invariants: responses match documented schema, error handling works, request validation prevents invalid input, auth/rate limiting enforced

**File handling flows:**
- Contract: Files handled securely and correctly
- Invariants: type validation works, size limits enforced, malicious files rejected, storage reliable

**Include the evolution footer:**

```markdown
---

## Guard Evolution

Guards are **append-only**. To modify:
- ✅ Add new guards
- ✅ Add invariants to existing guards
- ✅ Make contracts more specific
- ❌ Remove guards
- ❌ Remove invariants
- ❌ Weaken contracts

## Running Guards

To verify all guards against the codebase:
/check
```

### 4. Confirmation

```
✅ .vibe/GUARDS.md created with {N} guards

Guards:
  G-01: {name} (Critical)
  G-02: {name} (Critical)
  G-03: {name} (High)
  ...

Next steps:
  1. Review .vibe/GUARDS.md and adjust invariants to match your project
  2. Run /check to verify guards against your code
  3. Start building with /vibe, /lite, or /full
```

## Update Mode

If `.vibe/GUARDS.md` already exists:

```
📋 Existing guards found ({N} guards)

Scanning for uncovered flows...

Found {M} flows without guards:
1. {flow} (detected in {files})
2. {flow} (detected in {files})

Options:
1. Add guards for all uncovered flows
2. Let me pick which to add
3. No changes needed
```

**Rules for update mode:**
- Never remove existing guards
- Never weaken existing invariants
- New guards get the next available G-{NN} number
- Inform the user if existing guard invariants could be strengthened (but ask first)

## Edge Cases

### Empty or new project (no source files)

```
📋 No source files detected yet

This project appears to be empty or just initialized.
Guards work best when there's existing code to analyze.

Options:
1. Create starter guards based on your planned architecture
   (Tell me what you're building and I'll suggest guards)
2. Skip for now and run /guards later when you have code
```

### Monorepo or complex project structure

```
📋 Multiple packages detected

Found {N} packages:
  - packages/api (Express API)
  - packages/web (React frontend)
  - packages/shared (shared utilities)

Should I:
1. Create one .vibe/GUARDS.md at the root covering all packages
2. Create separate .vibe/GUARDS.md per package
3. Focus on one package (which one?)
```

## Examples

### Example: Express + React app

```
You: /guards

Claude: 🔍 Analyzing your codebase...

Detected: Express API + React frontend
Source: 47 files across src/api/ and src/web/

📋 Found 4 critical flows:

1. Authentication (src/api/middleware/auth.js, src/api/routes/auth.js)
   - JWT validation, login/logout, session refresh
   - Risk: Critical

2. User Data (src/api/models/user.js, src/api/routes/users.js)
   - Profile CRUD, password hashing, email uniqueness
   - Risk: High

3. API Gateway (src/api/routes/*.js, src/api/middleware/rateLimit.js)
   - 12 endpoints, rate limiting, CORS, error formatting
   - Risk: High

4. React State (src/web/store/*.js, src/web/hooks/useAuth.js)
   - Auth state, data fetching, optimistic updates
   - Risk: Medium

Which flows should have guards?

You: All of them

Claude: 📝 Generating guards...

✅ .vibe/GUARDS.md created with 4 guards

  G-01: Authentication Boundary (Critical)
  G-02: User Data Integrity (High)
  G-03: API Reliability (High)
  G-04: Frontend State Consistency (Medium)

Review .vibe/GUARDS.md and run /check to verify.
```

### Example: Update mode

```
You: /guards

Claude: 📋 Existing guards found (3 guards)

Scanning for uncovered flows...

Found 1 new flow without a guard:
  - WebSocket connections (src/ws/handler.js, added recently)
    Real-time notifications, connection management
    Risk: High

Add G-04 for WebSocket reliability? (Yes/No)

You: Yes

Claude: ✅ Added G-04: WebSocket Reliability to .vibe/GUARDS.md
```
