#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <target-project-path> [adapter]"
  echo "Example: $0 ~/work/my-app claude"
  exit 1
fi

TARGET="$(cd "$1" && pwd)"
ADAPTER="${2:-claude}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$TARGET/builds/v1"

cp "$ROOT_DIR/core/GUARDS.md" "$TARGET/GUARDS.md"
cp "$ROOT_DIR/templates/build/GOAL.md" "$TARGET/builds/v1/GOAL.md"
cp "$ROOT_DIR/templates/build/PLAN.md" "$TARGET/builds/v1/PLAN.md"
cp "$ROOT_DIR/templates/build/TASKS.md" "$TARGET/builds/v1/TASKS.md"
cp "$ROOT_DIR/templates/build/TEST_PLAN.md" "$TARGET/builds/v1/TEST_PLAN.md"
cp "$ROOT_DIR/templates/build/DESIGN.md" "$TARGET/builds/v1/DESIGN.md"
cp "$ROOT_DIR/templates/build/SHIP.md" "$TARGET/builds/v1/SHIP.md"
cp "$ROOT_DIR/templates/build/RECAP.md" "$TARGET/builds/v1/RECAP.md"
cp "$ROOT_DIR/templates/build/REVIEW.md" "$TARGET/builds/v1/REVIEW.md"
cp "$ROOT_DIR/templates/build/DECISIONS.md" "$TARGET/builds/v1/DECISIONS.md"

if [ "$ADAPTER" = "claude" ]; then
  mkdir -p "$TARGET/.claude/commands"
  cp "$ROOT_DIR/adapters/claude/commands/"*.md "$TARGET/.claude/commands/"
fi

if [ ! -f "$TARGET/CHANGELOG.md" ]; then
  echo "# Changelog" > "$TARGET/CHANGELOG.md"
fi

echo "vibe-framework installed in: $TARGET"
echo "Adapter: $ADAPTER"
