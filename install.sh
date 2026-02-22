#!/bin/bash
# Vibe Installer

set -e

INSTALL_DIR="${HOME}/.vibe"
SKILLS_DIR="${HOME}/.claude/skills"

echo "🚀 Installing Vibe..."
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

echo "✅ Framework files installed to $INSTALL_DIR"
echo ""

# Install Claude Code skills (if Claude detected)
if [ -d "$HOME/.claude" ]; then
  echo "🎯 Detected Claude Code installation"
  echo "📝 Installing Vibe skills..."

  mkdir -p "$SKILLS_DIR"
  cp adapters/claude/commands/*.md "$SKILLS_DIR/"

  echo "✅ Skills installed to $SKILLS_DIR"
  echo ""
  echo "   Available commands:"
  echo "   - /start        Initialize Vibe in a project"
  echo "   - /vibe         Quick fix (1-3 tasks)"
  echo "   - /lite         Feature build (3-8 tasks)"
  echo "   - /full         Complex build (8+ tasks)"
  echo "   - /plan         Create build documents"
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

# Install dashboard dependencies
echo "📦 Installing dashboard dependencies..."
if [ -d "$INSTALL_DIR/dashboard/app" ]; then
  (cd "$INSTALL_DIR/dashboard/app" && npm install --silent 2>/dev/null) && echo "✅ Dashboard app dependencies installed" || echo "⚠️  Could not install dashboard app dependencies (run manually: cd ~/.vibe/dashboard/app && npm install)"
fi
if [ -d "$INSTALL_DIR/dashboard/server" ]; then
  (cd "$INSTALL_DIR/dashboard/server" && npm install --silent 2>/dev/null) && echo "✅ Dashboard server dependencies installed" || echo "⚠️  Could not install dashboard server dependencies (run manually: cd ~/.vibe/dashboard/server && npm install)"
fi
echo ""

echo "📚 Vibe installed successfully!"
echo ""
echo "Next steps:"
echo "  1. cd /path/to/your-project"
echo "  2. Run /start in Claude Code to initialize"
echo ""
echo "Dashboard:"
echo "  cd ~/.vibe/dashboard/server && node index.js &"
echo "  cd ~/.vibe/dashboard/app && npm run dev"
echo ""
echo "Docs:"
echo "  - README:    cat ~/.vibe/README.md"
echo "  - Full spec: cat ~/.vibe/core/VIBE.md"
echo ""
echo "🎉 Ready to use Vibe!"
