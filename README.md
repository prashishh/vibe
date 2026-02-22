# Vibe

Vibe is an agentic software delivery framework that gives AI coding assistants a structured way to plan, execute, and verify work inside any repository. It currently works with **Claude Code** and **Codex**, with an adapter system built to expand to other AI coding CLIs over time.

> **Alpha:** The core workflow, dashboard, and skill system are functional but expect rough edges.

## Setup

```bash
git clone https://github.com/prashishrajbhandari/vibe.git ~/.vibe
cd ~/.vibe && ./install.sh
```

The installer copies framework files to `~/.vibe`, installs Claude Code skills if detected, and sets up dashboard dependencies. To also get the `vibe` CLI command, link it locally:

```bash
cd ~/.vibe && npm link
```

Then run `/start` inside any project to initialize. It creates `GUARDS.md`, a `builds/` directory, and a `.vibe/` folder with templates and configuration.

## How It Works

Vibe replaces sprints with outcome-driven builds. Every piece of work starts with a defined goal and ends with verified results. The framework provides skills that the AI assistant invokes directly, a planning methodology that scales with complexity, and permanent safety contracts called guards that every build must pass before it can close.

### Three Tiers of Work

| Tier | Tasks | Risk | Documents | When to Use |
|------|-------|------|-----------|-------------|
| `/vibe` | 1 to 3 | Low only | Commit + changelog line | Quick fixes, polish |
| `/lite` | 3 to 8 | Low to Medium | GOAL + TASKS + RECAP | Straightforward features |
| `/full` | 8+ | Any | Full document set | Complex architecture |

### Commands

**Autonomous workflows** (end to end):

| Command | What It Does |
|---------|-------------|
| `/vibe <fix>` | Quick fix: code, check, commit, no approvals. |
| `/lite <feature>` | Feature build: brainstorm, plan, execute, verify, recap. |
| `/full <feature>` | Complex build: full document set with multiple checkpoints. |

**Manual workflows** (step by step):

| Command | What It Does |
|---------|-------------|
| `/plan <feature>` | Create build documents with brainstorming |
| `/execute` | Work on next pending task |
| `/check` | Run all guard tests |
| `/review` | Review before ship (full builds) |
| `/ship` | Deployment checklist |
| `/recap` | Close build with summary |
| `/propose` | Suggest next build from previous seeds |
| `/start` | One time initialization |

### Guards

Guards are append-only safety contracts that define what must never break. They are generated during `/start` based on the project type, and every build must pass all of them before it can close. Examples include authentication boundaries, authorization rules, data integrity, and core user flows.

### Auto Promotion

If a `/vibe` quick fix breaks a guard or grows past three tasks, the framework promotes it to `/lite` or `/full` automatically.

## Dashboard

A visual interface for the full build lifecycle, running locally at `http://localhost:5173`.

```bash
cd ~/.vibe/dashboard/server && node index.js &
cd ~/.vibe/dashboard/app && npm run dev
```

From the dashboard you can create and plan builds, watch task execution stream live, run tasks in parallel, view guard status across builds, browse all build documents, and answer agent questions when it needs input.

## Project Structure After `/start`

```
your-project/
├── GUARDS.md                 Append only safety contracts
├── CHANGELOG.md              Build history
├── builds/
│   └── v1/
│       ├── GOAL.md           What and why
│       ├── TASKS.md          Work breakdown + status
│       └── RECAP.md          What shipped
└── .vibe/
    ├── core/VIBE.md          Framework spec
    └── templates/            Build document templates
```

## Repository Layout

```
core/                         Framework specification and guard templates
templates/build/              Full build templates (9 documents)
templates/lite/               Lite build templates (4 documents)
adapters/claude/commands/     Claude Code skill definitions
adapters/codex/               Codex adapter
dashboard/app/                React frontend (Vite + Tailwind)
dashboard/server/             Node.js backend (Express + WebSocket)
examples/                     Sample build directories
```

## License

MIT
