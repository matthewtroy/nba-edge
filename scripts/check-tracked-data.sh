#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
blocked=$(git ls-files 'public/data' 2>/dev/null | grep -v '^public/data/\.gitkeep$' || true)
if [[ -n "$blocked" ]]; then
  echo "Tracked generated data on main (use data branch only):"
  echo "$blocked"
  exit 1
fi
echo "OK: no tracked public/data except .gitkeep"