#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <pr-branch> [<pr-branch> ...]"
  echo "Example: $0 codex-0m20ou codex/create-value-through-accumulation"
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"

cleanup() {
  git switch "$current_branch" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes first."
  exit 1
fi

git fetch origin
git switch main
git pull --ff-only origin main

for branch in "$@"; do
  echo ""
  echo "=== Resolving branch: $branch ==="

  if ! git show-ref --verify --quiet "refs/heads/$branch"; then
    git fetch origin "$branch:$branch"
  fi

  git switch "$branch"

  if git merge --no-ff --no-edit main; then
    echo "Merged main into $branch with no conflicts."
  else
    echo "Conflict detected in $branch."
    git status --short
    echo "Resolve conflicts, then run:"
    echo "  git add <resolved-files>"
    echo "  git commit"
    echo "  git push origin $branch"
    exit 2
  fi

  git push origin "$branch"
done

echo ""
echo "Done. All specified branches were updated from main."
