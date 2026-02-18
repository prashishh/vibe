#!/bin/bash
# Vibe Framework Global Installer

set -e

INSTALL_DIR="${HOME}/.vibe"
SKILLS_DIR="${HOME}/.claude/skills"

echo "🚀 Installing Vibe Framework..."
echo ""

# Create install directory
mkdir -p "$INSTALL_DIR"

# Copy framework files
echo "📦 Copying framework files to ~/.vibe..."
cp -r core "$INSTALL_DIR/"
cp -r templates "$INSTALL_DIR/"
cp -r adapters "$INSTALL_DIR/"
cp -r dashboard "$INSTALL_DIR/"
cp README.md "$INSTALL_DIR/"
cp CHANGELOG.md "$INSTALL_DIR/"
cp SETUP_GUIDE.md "$INSTALL_DIR/"
cp COMMANDS_GUIDE.md "$INSTALL_DIR/"
cp CLI_USAGE.md "$INSTALL_DIR/"

echo "✅ Framework files installed to $INSTALL_DIR"
echo ""

# Install Claude Code skills (if Claude detected)
if [ -d "$HOME/.claude" ]; then
  echo "🎯 Detected Claude Code installation"
  echo "📝 Installing vibe skills..."

  mkdir -p "$SKILLS_DIR"
  cp adapters/claude/commands/*.md "$SKILLS_DIR/"

  echo "✅ Skills installed to $SKILLS_DIR"
  echo ""
  echo "   Available commands:"
  echo "   - /start        Initialize framework in a project"
  echo "   - /plan         Create new build"
  echo "   - /execute      Work on next task"
  echo "   - /check        Run all guards"
  echo "   - /review       Review before ship"
  echo "   - /ship         Deployment checklist"
  echo "   - /recap        Close build"
  echo "   - /propose      Suggest next build"
  echo ""
else
  echo "⚠️  Claude Code not detected (no ~/.claude directory)"
  echo "   You can manually install skills later by copying:"
  echo "   $INSTALL_DIR/adapters/claude/commands/*.md"
  echo "   to your AI assistant's skills directory"
  echo ""
fi

# Create quick reference
echo "📚 Framework installed successfully!"
echo ""
echo "Next steps:"
echo "  1. cd /path/to/your-project"
echo "  2. Run: /start (in Claude Code)"
echo "     Or manually: cp -r ~/.vibe/templates builds/"
echo ""
echo "Documentation:"
echo "  - Setup guide:  cat ~/.vibe/SETUP_GUIDE.md"
echo "  - Commands:     cat ~/.vibe/COMMANDS_GUIDE.md"
echo "  - Full spec:    cat ~/.vibe/core/VIBE.md"
echo ""
echo "Dashboard (optional):"
echo "  cd ~/.vibe/dashboard/app"
echo "  npm install && npm run dev"
echo ""
echo "🎉 Ready to use vibe framework!"
