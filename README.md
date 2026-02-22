# Vibe

Vibe is an agentic software delivery framework that gives AI coding assistants a structured way to plan, execute, and verify work inside any repository. It currently works with **Claude Code** and **Codex**, with an adapter system built to expand to other AI coding CLIs over time.

> **Alpha:** The core workflow, dashboard, and skill system are functional but expect rough edges.

## Setup

```bash
git clone https://github.com/prashishrajbhandari/vibe.git ~/src/vibe
cd ~/src/vibe
npm install
npm link
```

Then initialize any project with the CLI:

```bash
cd /path/to/your-project
vibe init
```

This runs an interactive setup, installs skills for your chosen AI assistant, and creates a `.vibe/` directory in the project with templates, build tracking, and configuration. Guards are generated separately via `/guards` (written to `.vibe/GUARDS.md`).

Alternatively, if you are inside Claude Code or Codex, you can run the `/start` skill directly from the chat instead of using the CLI.

## How It Works

Vibe replaces sprints with outcome-driven builds. Every piece of work starts with a defined goal and ends with verified results. The framework provides skills that the AI assistant invokes directly, a planning methodology that scales with complexity, and permanent safety contracts called guards that every build must pass before it can close.

### Three Tiers of Work

| Tier | Tasks | Risk | Documents | When to Use |
|------|-------|------|-----------|-------------|
| `/vibe` | 1 to 3 | Low only | Commit + changelog line | Quick fixes, polish |
| `/lite` | 3 to 8 | Low to Medium | GOAL + TASKS + RECAP | Straightforward features |
| `/full` | 8+ | Any | Full document set | Complex architecture |

### How Each Workflow Runs

```
New work arrives
│
├─ 1 to 3 tasks, Low risk, no core changes
│   └─ /vibe  →  implement  →  check  →  commit  →  changelog
│
├─ 3 to 8 tasks, Low or Medium risk
│   └─ /lite  →  brainstorm  →  GOAL + TASKS  →  execute  →  check  →  RECAP
│
└─ 8+ tasks, High risk, or architecture involved
    └─ /full  →  brainstorm  →  GOAL + PLAN + DESIGN + TASKS
                           →  execute  →  check  →  REVIEW gate
                           →  SHIP gate  →  RECAP
```

### Commands

**Autonomous workflows** (end-to-end):

| Command | What It Does |
|---------|-------------|
| `/vibe <fix>` | Quick fix: code, check, commit, no approvals. |
| `/lite <feature>` | Feature build: brainstorm, plan, execute, verify, recap. |
| `/full <feature>` | Complex build: full document set with multiple checkpoints. |

**Manual workflows** (step-by-step):

| Command | What It Does |
|---------|-------------|
| `/plan <feature>` | Create build documents with brainstorming |
| `/execute` | Work on next pending task |
| `/check` | Run all guard tests |
| `/review` | Review before ship (full builds) |
| `/ship` | Deployment checklist |
| `/recap` | Close build with summary |
| `/propose` | Suggest next build from previous seeds |
| `/start` | One-time initialization (skill equivalent of `vibe init`) |

### Example: Quick Fix

```
/vibe fix the broken pagination on the users table
```

The agent writes the fix, runs guard checks, commits with a `vibe:` prefix, and adds a one-line entry to the changelog. No planning docs, no approvals. Done in a few minutes.

### Example: Feature Build

```
/lite add CSV export to the admin dashboard
```

The agent drafts `.vibe/builds/v2/GOAL.md` and `.vibe/builds/v2/TASKS.md`, pauses for approval, executes tasks, then closes with `.vibe/builds/v2/RECAP.md`. If something is genuinely ambiguous, it asks a small number of targeted questions before proceeding.

A `GOAL.md` looks like this:

```markdown
# Build v2: CSV Export

## Intent
Add CSV export to the admin dashboard so admins can download filtered user data.

## Success Metric
1. Admins can export the current filtered view as a CSV file.
2. Export includes all visible columns and respects active filters.
3. Files download within 3 seconds for up to 10,000 rows.

## Scope
### In
- Export button on the users table toolbar
- Server endpoint that streams CSV with current filters applied
- Filename includes date and active filter summary

### Out
- Scheduled or email-based exports (next build)
- Excel or PDF formats
```

### Example: Starting a Complex Build

```
/full implement SSO authentication with Google and GitHub
```

The agent generates the full document set (GOAL, PLAN, DESIGN, TASKS), pauses for approval, executes tasks, then requires a passing REVIEW and completed SHIP checklist before the build can close.

### Guards

Guards are append-only safety contracts that define what must never break. Generate them with `/guards` (writes `.vibe/GUARDS.md`), then use `/check` to verify them against the codebase. Every build must pass guards before it can close.

New guards can be added as the project grows. Existing guards can never be weakened or removed.

### Auto Promotion

If a `/vibe` quick fix breaks a guard or grows past three tasks, the framework promotes it to `/lite` or `/full` automatically.

## Dashboard

A visual interface for the full build lifecycle, running locally at `http://localhost:5173`.

```bash
cd /path/to/your-project
vibe dashboard
```

From the dashboard you can create and plan builds, watch task execution stream live, run tasks in parallel, view guard status across builds, browse all build documents, and answer agent questions when it needs input.

## Project Structure After `vibe init`

```
your-project/
└── .vibe/
    ├── builds/               Build folders (created when you run builds)
    │   └── v1/
    │       ├── GOAL.md        What and why
    │       ├── TASKS.md       Work breakdown + status
    │       └── RECAP.md       What shipped
    ├── core/
    │   └── VIBE.md            Framework spec
    ├── templates/             Build document templates
    ├── CHANGELOG.md           Build history (in .vibe/)
    ├── GUARDS.md              Safety contracts (generate with /guards)
    ├── llm-config.json        LLM profiles
    └── dashboard-config.json  Dashboard wiring
```

## Repository Layout

```
core/                         Framework specification and guard templates
templates/build/              Full build templates (9 documents)
templates/lite/               Lite build templates (3 documents)
adapters/claude/commands/     Claude Code skill definitions (with allowed-tools frontmatter)
adapters/codex/commands/      Codex skill definitions
adapters/generic/commands/    Agent-agnostic skills for Cursor, Windsurf, Copilot, Aider, etc.
dashboard/app/                React frontend (Vite + Tailwind)
dashboard/server/             Node.js backend (Express + WebSocket)
```

## License

MIT
