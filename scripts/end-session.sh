#!/usr/bin/env bash
#
# scripts/end-session.sh [--dry-run]
#
# Run from inside a session worktree at close. Merges the worktree's Claude
# auto-memory dir into the canonical project memory dir, then removes the
# worktree. Claude Code keys its memory directory on the dasherized absolute
# cwd, so a worktree session writes memory to a different directory than the
# main repo; without this merge, session learnings evaporate when the
# worktree is removed.
#
# The EM then moves the stream's row to Shipped in
# coordination/active-streams.md and deletes the branch once it has merged
# (docs/development.md, ship workflow step 7).

set -euo pipefail

DRY_RUN=0
if [ $# -gt 0 ]; then
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    *)
      echo "Usage: $0 [--dry-run]" >&2
      exit 1
      ;;
  esac
fi

WORKTREE_PATH="$(git rev-parse --show-toplevel)"
GIT_COMMON_DIR="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
MAIN_DIR="$(dirname "$GIT_COMMON_DIR")"

if [ "$WORKTREE_PATH" = "$MAIN_DIR" ]; then
  echo "Error: this is the main repo dir, not a session worktree." >&2
  echo "end-session.sh is meant to be run from inside a worktree." >&2
  exit 1
fi

# Memory dirs: Claude Code dasherizes the absolute cwd for the projects path.
dasherize() {
  echo "$1" | sed 's|/|-|g; s| |-|g'
}

SESSION_MEM="$HOME/.claude/projects/$(dasherize "$WORKTREE_PATH")/memory"
MAIN_MEM="$HOME/.claude/projects/$(dasherize "$MAIN_DIR")/memory"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "Ending session:"
echo "  Worktree:     $WORKTREE_PATH"
echo "  Branch:       $BRANCH"
echo "  Session mem:  $SESSION_MEM"
echo "  Canonical:    $MAIN_MEM"
echo ""

# Step 1: merge memory.
if [ -d "$SESSION_MEM" ]; then
  echo "Merging session memory into canonical project memory..."
  if [ "$DRY_RUN" = "1" ]; then
    python3 "$MAIN_DIR/scripts/merge_memory.py" --dry-run "$SESSION_MEM" "$MAIN_MEM"
  else
    python3 "$MAIN_DIR/scripts/merge_memory.py" "$SESSION_MEM" "$MAIN_MEM"
  fi
else
  echo "No session memory dir at $SESSION_MEM; nothing to merge."
fi

if [ "$DRY_RUN" = "1" ]; then
  echo ""
  echo "Dry run complete. Re-run without --dry-run to apply the merge and remove the worktree."
  exit 0
fi

# Step 2: drop into main and remove the worktree.
cd "$MAIN_DIR"
echo "Removing worktree..."
git worktree remove "$WORKTREE_PATH" --force

# Step 3: clean up the session memory dir (post-merge).
if [ -d "$SESSION_MEM" ]; then
  rm -rf "$SESSION_MEM"
  echo "Deleted session memory at $SESSION_MEM."
fi

# Also remove the (now empty) ~/.claude/projects/<dasherized> dir if empty.
SESSION_PROJ_DIR="$(dirname "$SESSION_MEM")"
if [ -d "$SESSION_PROJ_DIR" ] && [ -z "$(ls -A "$SESSION_PROJ_DIR" 2>/dev/null)" ]; then
  rmdir "$SESSION_PROJ_DIR"
  echo "Removed empty $SESSION_PROJ_DIR."
fi

echo ""
echo "Session ended."
echo "Now: move this stream's row to Shipped in $MAIN_DIR/coordination/active-streams.md,"
echo "and delete the branch with 'git branch -D $BRANCH' once it has merged to main."
