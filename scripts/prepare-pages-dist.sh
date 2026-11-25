#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

preview_only="${PREVIEW_ONLY:-false}"

if [ "$preview_only" = "true" ]; then
  echo "Pages: preview deploy — mirror live site, overlay dist/preview"
  rm -rf dist dist-preview dist-pages
  mkdir -p dist
  mirror_root="dist-pages/mirror"
  if wget -q -mkEpnp -e robots=off -P "$mirror_root" "https://matthewtroy.github.io/nba-edge/"; then
  :
  else
    echo "Pages: mirror failed (first deploy?); preview-only artifact"
  fi
  live="${mirror_root}/matthewtroy.github.io/nba-edge"
  if [ -d "$live" ]; then
    cp -a "$live/." dist/
  fi
  npm run build:preview
  exit 0
fi

echo "Pages: production build"
npm run build