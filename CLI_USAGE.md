# Vibe CLI - Local Testing Guide

## ✅ Setup Complete!

The vibe framework is now available as an npm package that works locally without publishing to npm.

## Installation (One-Time)

```bash
cd ~/work/vibe-framework
npm install
npm link
```

This makes the `vibe` command available globally on your system.

## Usage in Any Project

### 1. Initialize Framework in a New Project

```bash
cd /path/to/your-project
npx vibe init
```

**Interactive prompts:**
1. **What type of project?**
   - Web application (Next.js app with API + frontend)
   - Backend service only
   - CLI tool
   - Library/package

2. **What are the 3-5 core flows that must never break?**
   - User authentication & authorization
   - Core user workflow/feature
   - Data validation & security
   - API boundaries & rate limiting

3. **How many guards to start with?**
   - 3 (minimal)
   - 5 (recommended)
   - 8 (comprehensive)

4. **Create first build now?**
   - Yes / No

**What it creates:**
```
your-project/
├── GUARDS.md                   # Auto-generated based on your answers
├── CHANGELOG.md                # Initialized
├── README.vibe.md         # Quick reference
├── .vibe/
│   └── dashboard-config.json   # Dashboard configuration
├── builds/                     # Empty, ready for builds
└── .vibe/
    ├── core/
    │   └── VIBE.md       # Framework spec
    └── templates/
        ├── build/              # 9 Full build templates
        └── lite/               # 4 Lite build templates
```

### 2. Start Dashboard

```bash
cd /path/to/your-project
npx vibe dashboard
```

This automatically:
- Installs dashboard dependencies (first time only)
- Configures paths to your project's `builds/` and `GUARDS.md`
- Starts dashboard on `http://localhost:5173`

### 3. Plan New Builds (Placeholder)

```bash
npx vibe plan "Add user profiles"
```

**Note:** Full planning functionality uses Claude Code with `/plan` command.
CLI version is a placeholder for now.

## Testing Across Multiple Projects

```bash
# Project 1
cd ~/work/openmd-ai
npx vibe init
npx vibe dashboard

# Project 2
cd ~/projects/another-app
npx vibe init
npx vibe dashboard

# Each project gets its own configuration!
```

## Claude Code Skills (Dual Support)

The framework maintains **both** CLI commands and Claude Code skills:

### CLI Commands:
- `npx vibe init` - Initialize framework
- `npx vibe dashboard` - Start dashboard
- `npx vibe plan` - Plan builds (placeholder)

### Claude Code Skills (Still Work!):
- `/start` - Initialize framework (same as `vibe init`)
- `/plan` - Create build with brainstorming
- `/execute` - Work on next task
- `/vibe` - Quick fixes (autonomous)
- `/lite` - Lite builds (autonomous)
- `/full` - Full builds (autonomous)
- `/check` - Run all guards
- `/review` - Review findings
- `/ship` - Deployment checklist
- `/recap` - Close build
- `/propose` - Suggest next build

**Both approaches use the same framework files!**

## How It Works

### npm link Magic:
1. `npm link` in framework directory creates a global symlink
2. `npx vibe` in any project uses the linked version
3. No npm registry needed - works locally
4. Changes to framework are immediately available everywhere

### Postinstall Hook:
- Automatically copies Claude Code skills to `~/.claude/skills/`
- Runs when you do `npm install` or `npm link`
- Skills available for `/start`, `/plan`, etc.

### Dashboard Auto-Configuration:
- During `vibe init`, creates `.vibe/dashboard-config.json`
- Stores project paths (builds, guards, changelog)
- `vibe dashboard` reads config and sets environment variables
- Dashboard automatically points to the right project

## File Structure

```
vibe-framework/
├── bin/
│   └── cli.js                  # CLI entry point
├── lib/
│   ├── commands/
│   │   ├── init.js             # Init command
│   │   ├── dashboard.js        # Dashboard command
│   │   └── plan.js             # Plan command (placeholder)
│   ├── generators/
│   │   └── guards.js           # Guard generation logic
│   ├── utils/
│   │   └── files.js            # File operations
│   ├── postinstall.js          # Post-install hook
│   └── index.js                # Main exports
├── adapters/                   # Claude/Codex/etc. commands
├── core/                       # Framework spec
├── templates/                  # Build templates
├── dashboard/                  # React dashboard
└── package.json                # npm configuration
```

## Benefits Over Old Approach

### Before:
```bash
# Clone framework
git clone ... ~/.vibe

# Run installer
cd ~/.vibe && ./install.sh

# Navigate to project
cd /path/to/project

# Try to run /start (doesn't work reliably)
/start

# Manually configure dashboard paths
# Edit plugins/builds-plugin.js
cd ~/.vibe/dashboard/app
npm install
npm run dev
```

### Now:
```bash
# One-time setup
cd ~/work/vibe-framework && npm link

# In any project
cd /path/to/project
npx vibe init          # ✅ Works immediately
npx vibe dashboard      # ✅ Auto-configured
```

**90% less manual work!** 🎉

## Next Steps

1. **Test in openmd-ai:**
   ```bash
   cd ~/work/openmd-ai
   npx vibe init
   npx vibe dashboard
   ```

2. **Test in another project:**
   ```bash
   cd ~/projects/your-other-app
   npx vibe init
   ```

3. **Start building:**
   - Use `/vibe`, `/lite`, `/full` for autonomous workflows
   - Or use `/plan`, `/execute` for manual control

## Future Publishing

When ready to publish to npm:

1. Update `package.json` repository URL
2. Create GitHub repo (if not exists)
3. Test: `npm publish --dry-run`
4. Publish: `npm publish`
5. Users install: `npm install -g vibe-framework` or `npx vibe init`

Same commands, now available worldwide! 🚀
