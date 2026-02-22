
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
