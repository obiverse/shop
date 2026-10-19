#!/bin/sh
# Publish the shop: pull the team's edits, rebuild, push the static site to gh-pages.
# GitHub Pages serves the gh-pages branch of obiverse/shop at https://obiverse.github.io/shop/
# No GitHub Actions involved. Run from any machine with Node 22+ (Rust optional).
set -e
cd "$(dirname "$0")/.."
REMOTE=$(git remote get-url origin)

# Edits made in the local admin (pnpm admin) are files on disk: commit them first so main keeps the history.
if [ -n "$(git status --porcelain src/content public/uploads 2>/dev/null)" ]; then
  git add src/content public/uploads 2>/dev/null || git add src/content
  git commit --quiet -m "Content update from the admin ($(date -u +%Y-%m-%d))"
  echo "· committed content changes"
fi
git pull --rebase --quiet || { echo "✗ couldn't merge the latest changes from GitHub; resolve before shipping"; exit 1; }
git push --quiet || { echo "✗ couldn't push main"; exit 1; }

if command -v cargo >/dev/null && command -v wasm-pack >/dev/null; then
  npm run --silent ledger          # tests + rebuilds the WASM ledger
else
  echo "· no Rust toolchain; using the committed src/ledger-pkg"
fi

npx astro build --silent
touch dist/.nojekyll

cd dist
rm -rf .git
git init --quiet -b gh-pages
git add -A
git commit --quiet -m "ship $(date -u +%Y-%m-%dT%H:%MZ) from $(git -C .. rev-parse --short HEAD)"
git push --quiet --force "$REMOTE" gh-pages
rm -rf .git
echo "✓ shipped → https://obiverse.github.io/shop/  (live in ~1 minute)"
