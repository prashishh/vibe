#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-SHIP.md>"
  exit 2
fi

ship_file="$1"
if [ ! -f "$ship_file" ]; then
  echo "SHIP file not found: $ship_file"
  exit 2
fi

unchecked_count=$(rg -n "^- \[ \]" "$ship_file" | wc -l | tr -d ' ')
if [ "$unchecked_count" -gt 0 ]; then
  echo "NOT READY: $unchecked_count unchecked checklist item(s) in $ship_file"
  rg -n "^- \[ \]" "$ship_file"
  exit 1
fi

echo "READY: all checklist items are checked in $ship_file"
