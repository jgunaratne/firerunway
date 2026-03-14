---
description: Git feature branch workflow — create a branch before changes, merge and clean up after
---

# Git Feature Branch Workflow

Follow this workflow whenever making code changes to the repository.

## Before Making Changes

1. Make sure you are on `main` and it is clean:
// turbo
```bash
git checkout main && git pull origin main
```

2. Create a new feature branch with a descriptive name:
// turbo
```bash
git checkout -b feature/<short-descriptive-name>
```
   - Use kebab-case for the branch name (e.g., `feature/add-login-page`, `feature/fix-sankey-diagram`).
   - Keep it short but descriptive of the change being made.

## Making Changes

3. Make all code changes on the feature branch.

4. Stage and commit changes with a clear commit message:
```bash
git add -A && git commit -m "<descriptive commit message>"
```

## After Changes Are Complete

5. Switch back to `main` and merge the feature branch:
// turbo
```bash
git checkout main
```

6. Merge the feature branch:
```bash
git merge feature/<branch-name>
```

7. Delete the feature branch:
// turbo
```bash
git branch -d feature/<branch-name>
```

## Notes

- If there are uncommitted changes on `main` before starting, stash them first with `git stash`, create the branch, then `git stash pop`.
- If a merge conflict occurs, resolve it before completing the merge.
- Do **not** push to origin unless the user explicitly asks.
