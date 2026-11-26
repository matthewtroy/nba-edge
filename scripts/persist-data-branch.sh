#!/usr/bin/env bash
# Push public/data to origin/data without checking out data on the current branch (main).
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/public/data"
PERSIST_WARN() {
  echo "::warning::persist data branch: $*"
}

if [[ ! -d "$SRC" ]]; then
  PERSIST_WARN "no public/data directory"
  exit 0
fi

STAGING="$(mktemp -d)"
cp -a "$SRC/." "$STAGING/" || {
  PERSIST_WARN "copy to staging failed"
  rm -rf "$STAGING"
  exit 0
}

git -C "$ROOT" fetch origin 2>/dev/null || {
  PERSIST_WARN "git fetch origin failed"
  rm -rf "$STAGING"
  exit 0
}

WT="$(mktemp -d)"
on_exit() {
  git -C "$ROOT" worktree remove --force "$WT" 2>/dev/null || true
  rm -rf "$STAGING" "$WT"
}
trap on_exit EXIT

if git -C "$ROOT" show-ref --verify --quiet refs/heads/data; then
  if ! git -C "$ROOT" worktree add -B data "$WT" data 2>/dev/null; then
    PERSIST_WARN "worktree add from refs/heads/data failed"
    exit 0
  fi
elif git -C "$ROOT" show-ref --verify --quiet refs/remotes/origin/data; then
  if ! git -C "$ROOT" worktree add -B data "$WT" origin/data 2>/dev/null; then
    PERSIST_WARN "worktree add from origin/data failed"
    exit 0
  fi
else
  if ! git -C "$ROOT" worktree add -b data --orphan "$WT" 2>/dev/null; then
    PERSIST_WARN "orphan worktree add failed"
    exit 0
  fi
fi

mkdir -p "$WT/public/data"
cp -a "$STAGING/." "$WT/public/data/" || {
  PERSIST_WARN "copy into worktree failed"
  exit 0
}

git -C "$WT" add public/data
if git -C "$WT" diff --staged --quiet; then
  echo "persist data branch: no changes"
  exit 0
fi

if ! npx tsx "$ROOT/scripts/persist-guard-check.ts" "$WT/public/data"; then
  echo "::error::persist blocked: see persist data branch guard output above"
  exit 1
fi

git -C "$WT" \
  -c user.name="github-actions[bot]" \
  -c user.email="github-actions[bot]@users.noreply.github.com" \
  commit -m "chore: update pipeline data" || {
  PERSIST_WARN "commit failed"
  exit 0
}

if [[ "${PERSIST_DRY_RUN:-}" = "1" ]]; then
  echo "persist data branch: dry-run (commit ok, skip push)"
  exit 0
fi

if ! git -C "$WT" push origin data; then
  PERSIST_WARN "push to origin/data failed"
  exit 0
fi

echo "persist data branch: pushed origin/data"
exit 0