#!/usr/bin/env bash
# Install Plantry's git hooks. Idempotent: safe to re-run.
# Invoked automatically by npm's "prepare" lifecycle after `npm install`.

set -e

# Resolve repo root regardless of where this script is invoked from.
repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)

if [ -z "$repo_root" ]; then
  echo "install-hooks: not inside a git repository; nothing to do."
  exit 0
fi

# In a worktree, .git is a file; we want the main repo's hooks dir (worktrees share it).
if [ -f "$repo_root/.git" ]; then
  # Resolve to the common gitdir (main repo).
  common_dir=$(git rev-parse --git-common-dir)
  hooks_dir="$common_dir/hooks"
else
  hooks_dir="$repo_root/.git/hooks"
fi

mkdir -p "$hooks_dir"

src="$repo_root/.githooks/pre-commit"
dst="$hooks_dir/pre-commit"

if [ ! -f "$src" ]; then
  echo "install-hooks: source hook missing at $src"
  exit 1
fi

cp "$src" "$dst"
chmod +x "$dst"

echo "install-hooks: installed $(basename "$src") -> $dst"
