# Setup Guide

## Step 1: Install Framework

```bash
git clone https://github.com/yourusername/vibe-framework ~/.vibe
cd ~/.vibe && ./install.sh
```

This installs:
- Framework files to `~/.vibe/`
- Claude Code skills to `~/.claude/skills/`
- All commands (`/start`, `/plan`, `/execute`, `/check`, etc.)

**No Claude Code?** See [Manual Setup](#manual-setup-no-claude-code) at the bottom.

---

## Step 2: Initialize Your Project

```bash
cd /path/to/your-project
```

In Claude Code:

```
/start
```

### The `/start` command asks 4 questions:

**1. What type of project?**
Web application, Backend service, CLI tool, or Library/package. This determines guard templates.

**2. What are the core flows that must never break?**
Select from: Auth, Core workflow, Data validation, API boundaries. Or describe your own. These become your guards.

**3. How many guards?**
- 3 (minimal) — prototypes, small projects
- 5 (recommended) — most production projects
- 8 (comprehensive) — high-stakes systems

**4. Create first build now?**
Yes creates `builds/v1/` with GOAL + TASKS ready to work on. No just sets up the framework.

### What gets created:

```
your-project/
├── GUARDS.md               Auto-generated from your answers
├── CHANGELOG.md            Initialized
├── builds/                 Ready for builds
│   └── v1/                 (if you said yes to first build)
└── .vibe/
    ├── core/VIBE.md        Framework spec
    └── templates/          Build templates
```

---

## Step 3: Define Your Guards

Review and customize `GUARDS.md`. Guards are append-only contracts — your safety net across builds.

Example guards for a web app:

```markdown
## G-01: Authentication Boundary
- Contract: Protected routes require valid authentication
- Invariants:
  - Unauthenticated requests to /api/* return 401
  - Invalid tokens are rejected
- Layer: Contract + Integration
- Risk if broken: Critical

## G-02: Data Validation
- Contract: User input is validated before processing
- Invariants:
  - Invalid email formats are rejected
  - SQL injection attempts fail safely
- Layer: Contract + Integration
- Risk if broken: Critical
```

Keep it to **5-8 guards max**. Add more as your project grows (never remove or weaken).

---

## Step 4: Start Building

**Autonomous (recommended):**
```
/vibe Fix button alignment        # Quick fix, done in minutes
/lite Add user profiles            # Medium feature, approve once
/full Implement SSO                # Complex feature, approve + deploy
```

**Manual (step-by-step):**
```
/plan Add notifications
/execute                           # Repeat for each task
/check
/review                            # Full builds only
/ship                              # Full builds only
/recap
```

See [COMMANDS_GUIDE.md](COMMANDS_GUIDE.md) for complete command reference.

---

## Step 5: Dashboard (Optional)

The framework includes a React dashboard to visualize builds, guards, and progress.

### Quick Start

```bash
cd ~/.vibe/dashboard/app
npm install
npm run dev
```

Opens at `http://localhost:5173`.

### Point Dashboard at Your Project

The dashboard reads from environment variables. Use the `vibe dashboard` command from your project directory, or set paths manually:

```bash
VITE_BUILDS_PATH=/path/to/project/builds \
VITE_GUARDS_PATH=/path/to/project/GUARDS.md \
VITE_CHANGELOG_PATH=/path/to/project/CHANGELOG.md \
npm run dev
```

Or edit `dashboard/app/plugins/builds-plugin.js` directly to change the default paths.

### Dashboard Pages

| Page | URL | What it shows |
|------|-----|---------------|
| Dashboard | `/` | All builds, status, task progress |
| Build Detail | `/build/v1` | Goal, tasks, docs for a single build |
| Guards | `/guards` | Guard definitions + impact across builds |
| Commands | `/commands` | Command reference with workflow comparison |
| Changelog | `/changelog` | Project history timeline |
| Framework | `/framework` | VIBE.md rendered |

### Hot Reload

The dashboard auto-refreshes when you:
- Create or update builds in `builds/`
- Modify `GUARDS.md` or `CHANGELOG.md`
- Change any `.md` file in the builds directory

No manual refresh needed — just save files and watch the dashboard update.

### Production Build

```bash
npm run build     # Creates static site in dist/
npm run preview   # Preview the production build
```

---

## Troubleshooting

### "Command not found: /start"

Install skills:
```bash
cp ~/.vibe/adapters/claude/commands/*.md ~/.claude/skills/
```

### "Framework files not found"

Run installer:
```bash
cd ~/.vibe && ./install.sh
```

### "GUARDS.md already exists"

Framework already initialized. Just run `/plan <feature>` to create a build.

### Dashboard shows "No builds found"

Check that `builds/` exists with folders named `v1`, `v2`, etc., each containing at least `GOAL.md`.

### Dashboard hot reload not working

Restart the dev server (`Ctrl+C`, then `npm run dev`).

---

## Manual Setup (No Claude Code)

If you don't use Claude Code:

```bash
# Install
git clone https://github.com/yourusername/vibe-framework ~/.vibe

# In your project
cd /path/to/your-project
cp -r ~/.vibe/templates .vibe/
cp ~/.vibe/core/GUARDS.template.md GUARDS.md
mkdir builds
echo "# Changelog" > CHANGELOG.md

# Edit GUARDS.md with your guards
# Create builds manually: mkdir builds/v1 && cp .vibe/templates/lite/* builds/v1/
# Update TASKS.md status as you complete tasks
# Run tests manually: npm run test
```
