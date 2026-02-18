# vibe-framework

Agentic software delivery framework for AI-assisted development.

Agent-agnostic — core process lives in neutral docs and templates. Agent-specific command files live in `adapters/`.

## Three-Tier Work System

| Mode | Tasks | Risk | Artifacts | Use When |
|------|-------|------|-----------|----------|
| **Vibe** | 1-3 | Low only | Commit + changelog line | Quick fixes, polish |
| **Lite Build** | 3-8 | Low-Medium | GOAL + TASKS + RECAP | Straightforward features |
| **Full Build** | 8+ | Any | All documents | Complex architecture |

## Quick Start

```bash
# 1. Install (one-time)
git clone https://github.com/yourusername/vibe-framework ~/.vibe
cd ~/.vibe && ./install.sh

# 2. In your project
cd /path/to/your-project
/start          # Interactive setup — creates GUARDS.md, builds/, .vibe/

# 3. Build
/vibe Fix button alignment        # Quick fix (2-5 min)
/lite Add CSV export               # Medium feature (1-4 hours)
/full Implement SSO                # Complex feature (4+ hours)
```

For step-by-step control:

```
/plan Add notifications
/execute                           # Repeat for each task
/check
/review                            # Full builds only
/ship                              # Full builds only
/recap
```

## Commands

| Command | What It Does |
|---------|-------------|
| `/start` | Set up framework in project (one-time) |
| `/vibe <desc>` | Quick fix — autonomous, zero approvals |
| `/lite <feature>` | Lite Build — autonomous, one approval |
| `/full <feature>` | Full Build — autonomous, multiple approvals |
| `/plan <feature>` | Create build (manual mode) |
| `/execute` | Work on next task |
| `/check` | Run all guard tests |
| `/review` | Review before ship (Full builds) |
| `/ship` | Deployment checklist |
| `/recap` | Close build with summary |
| `/propose` | Suggest next build from seeds |

## Folder Layout

```
core/VIBE.md              Framework spec
core/GUARDS.md            Starting guard contracts
core/GUARDS.template.md   Blank guard template
templates/build/          Full build document templates
templates/lite/           Lite build templates (GOAL, TASKS, RECAP)
adapters/                 Agent-specific adapters (Claude, Codex)
dashboard/                React dashboard app
examples/                 Sample build directories
```

## Project Structure After `/start`

```
your-project/
├── GUARDS.md             Core contracts (append-only, never weaken)
├── CHANGELOG.md          History of all builds
├── builds/               Build directories (v1, v2, ...)
│   └── v1/
│       ├── GOAL.md       What and why
│       ├── TASKS.md      Work breakdown + status
│       └── RECAP.md      What shipped
└── .vibe/
    ├── core/VIBE.md      Framework spec (reference)
    └── templates/        Build templates
```

## Docs

- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** — Installation, init, dashboard setup, troubleshooting
- **[COMMANDS_GUIDE.md](COMMANDS_GUIDE.md)** — Complete command reference with examples
- **[CLI_USAGE.md](CLI_USAGE.md)** — Local development and testing of the npm package
- **[CHANGELOG.md](CHANGELOG.md)** — Version history
