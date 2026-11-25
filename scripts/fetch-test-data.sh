#!/usr/bin/env bash
# Pull published slate JSON from the data branch so `npm test` passes on a fresh clone.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -f public/data/index.json ]]; then
  exit 0
fi
git fetch origin data 2>/dev/null || true
REF=""
if git show-ref --quiet refs/remotes/origin/data; then
  REF=origin/data
elif git show-ref --quiet refs/heads/data; then
  REF=data
fi
if [[ -z "$REF" ]]; then
  echo "fetch-test-data: data branch not found" >&2
  exit 1
fi
while IFS= read -r relpath; do
  [[ -z "$relpath" ]] && continue
  [[ "$relpath" == "public/data/.gitkeep" ]] && continue
  out="$ROOT/$relpath"
  mkdir -p "$(dirname "$out")"
  git show "$REF:$relpath" >"$out"
done < <(git ls-tree -r --name-only "$REF" public/data)
if [[ ! -f public/data/index.json ]]; then
  echo "fetch-test-data: missing public/data/index.json after extract" >&2
  exit 1
fi