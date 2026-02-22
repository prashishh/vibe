---
description: Initialize Vibe in the current project via interactive prompts.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion
---

Initialize Vibe in this project.

## Process

### 1. Detect Project Context

Check if already initialized:
- Does `.vibe/GUARDS.md` exist?
- Does `builds/` exist?
- Does `.vibe/CHANGELOG.md` exist?

If any exist, ask user:
- "Vibe appears partially initialized. Continue anyway?"

### 2. Gather Configuration via Prompts

Ask the user:

**Q1: Project Type**
- "What type of project is this?"
  - Web application (API + frontend)
  - Backend service only
  - CLI tool
  - Library/package
  - Other

**Q2: Core Flows** (based on project type)
- "What are the 3-5 core flows that must never break?"
  Examples:
  - Web app: Auth, Core user flow, Data validation, API boundaries
  - Backend: Auth, Rate limiting, Data persistence, Queue processing
  - CLI: Input validation, Core command execution, Config loading

**Q3: Guard Count**
- "How many guards do you want to start with?"
  - 3 (minimal - for small projects)
  - 5 (recommended - most projects)
  - 8 (comprehensive - complex projects)

**Q4: Initial Build**
- "Create first build now?"
  - Yes - I have a feature ready
  - No - Just initialize the framework

### 3. Create Directory Structure

```bash
mkdir -p builds
mkdir -p .vibe/core
mkdir -p .vibe/templates/build
mkdir -p .vibe/templates/lite
```

### 4. Copy Framework Files

Determine framework location (could be):
- `~/.vibe/` (global install)
- `./node_modules/Vibe/` (npm package)
- Relative path to framework repo

Copy:
```bash
# Core spec
cp {FRAMEWORK_PATH}/core/VIBE.md .vibe/core/

# Templates
cp -r {FRAMEWORK_PATH}/templates/build/* .vibe/templates/build/
cp -r {FRAMEWORK_PATH}/templates/lite/* .vibe/templates/lite/
```

### 5. Generate .vibe/GUARDS.md from Prompts

Based on user's answers to Q2 and Q3, create `.vibe/GUARDS.md`:

```markdown
# Guards

[For each core flow mentioned, create a guard]

## G-01: [Flow Name]
- Contract: [Auto-generated based on flow type]
- Invariants:
  - [Auto-generated checklist]
- Layer: Contract + Integration
- Risk if broken: Critical

[Repeat for each guard]
```

**Guard templates by project type:**

**Web Application:**
```markdown
## G-01: Authentication Boundary
- Contract: Protected routes require valid authentication
- Invariants:
  - Unauthenticated requests to protected routes return 401
  - Invalid/expired tokens are rejected
  - Session management works correctly
- Layer: Contract + Integration
- Risk if broken: Critical

## G-02: Core User Flow
- Contract: Users can [sign up/log in/access dashboard/perform core action]
- Invariants:
  - [Primary user journey works end-to-end]
  - No blocking errors in critical path
- Layer: Browser + Integration
- Risk if broken: Critical

## G-03: Data Validation
- Contract: User input is validated before processing
- Invariants:
  - Invalid input is rejected with clear errors
  - SQL injection attempts fail safely
  - XSS attempts are sanitized
- Layer: Contract + Integration
- Risk if broken: Critical
```

**Backend Service:**
```markdown
## G-01: API Authentication
- Contract: API endpoints require valid credentials
- Invariants:
  - Missing/invalid API keys return 401
  - Rate limiting prevents abuse
- Layer: Contract + Integration
- Risk if broken: Critical

## G-02: Data Persistence
- Contract: Data writes are durable and consistent
- Invariants:
  - Committed transactions are never lost
  - Rollback works on failure
- Layer: Integration
- Risk if broken: Critical
```

**CLI Tool:**
```markdown
## G-01: Input Validation
- Contract: Invalid input produces clear error messages
- Invariants:
  - Required flags are enforced
  - Invalid values are rejected
  - Help text is accurate
- Layer: Contract
- Risk if broken: High

## G-02: Core Command Execution
- Contract: Primary command succeeds with valid input
- Invariants:
  - Command produces expected output
  - Exit codes are correct
- Layer: Contract + Integration
- Risk if broken: Critical
```

### 6. Create .vibe/CHANGELOG.md

```markdown
# Changelog

## [Unreleased]
- Initialized Vibe
- Created [N] guard contracts
- Ready for first build

EOF
```

### 7. Create .gitignore Entry (if .gitignore exists)

Add:
```
# Vibe (optional - you may want to commit these)
# .vibe/
# builds/
```

### 8. Install Skills (if Claude Code detected)

```bash
# Detect if ~/.claude/skills exists
if [ -d ~/.claude/skills ]; then
  cp {FRAMEWORK_PATH}/adapters/claude/commands/*.md ~/.claude/skills/
  echo "✅ Installed vibe skills to ~/.claude/skills/"
fi
```

### 9. Create First Build (if user said Yes to Q4)

Ask:
- "What feature are you building?"

Then run `/plan <feature>` automatically.

### 10. Configuration Summary

Print:

```
✅ Vibe Initialized!

📁 Created:
  - .vibe/core/VIBE.md
  - .vibe/templates/build/ (9 templates)
  - .vibe/templates/lite/ (3 templates)
  - builds/ (empty, ready for builds)
  - .vibe/GUARDS.md ([N] guards)
  - .vibe/CHANGELOG.md

🛡️ Guards:
  - G-01: [Name]
  - G-02: [Name]
  - G-03: [Name]
  [...]

📝 Next Steps:
  1. Review and customize .vibe/GUARDS.md
  2. Run /plan <feature> to create your first build
  3. Run /check to verify guards

💡 Commands Available:
  /plan <feature>  - Create a new build
  /execute         - Work on next task
  /check       - Run all guards
  /review          - Review before ship
  /ship            - Deploy checklist
  /recap           - Close build

📊 Dashboard:
  To view builds visually, see .vibe/SETUP_GUIDE.md (Dashboard section)
```

### 11. Create .vibe/README.md

Create a project-specific quick reference:

```markdown
# Vibe - This Project

## Guards
[Copy guards from .vibe/GUARDS.md]

## Workflow
1. /plan <feature> - Start new build
2. /execute - Work through tasks
3. /check - Verify guards
4. /recap - Close build

## Three Tiers
- **Vibe**: 1-3 tasks, quick fixes → just commit
- **Lite**: 3-8 tasks → GOAL + TASKS + RECAP
- **Full**: 8+ tasks → All documents

See .vibe/core/VIBE.md for full spec.
```

## Error Handling

If framework files not found:
```
❌ Vibe source not found.

Please install framework first:

Option 1 (recommended): Clone framework repo
  git clone https://github.com/yourusername/Vibe ~/.vibe

Option 2: Install as npm package
  npm install -g Vibe

Then run /init again.
```

If already initialized:
```
⚠️ Vibe already initialized in this project.

Found:
  - .vibe/GUARDS.md
  - builds/
  - .vibe/CHANGELOG.md

Options:
  - Run /plan to create new build
  - Run /check to verify guards
  - Delete files above to re-initialize
```

## Output

Print summary showing:
- Files created
- Guards defined
- Next steps
- Available commands
