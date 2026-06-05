---
name: GitHub mirror & homepage-revamp pulls
description: How to pull "homepage/marketing revamp" updates from the charlottecarey-droid/lp-studio GitHub mirror without a destructive full-staging merge.
---

The repo `charlottecarey-droid/lp-studio` (GitHub, github connection) is a PARALLEL MIRROR of this Replit workspace, not its upstream. The workspace has no `github` git remote (only Replit `subrepl-*` remotes).

**Key relationship:** GitHub `staging` is hundreds of commits ahead of GitHub `master` (master is a stale snapshot). Most of those commits are the same task work already merged into the workspace but via DIFFERENT commit SHAs — so a literal `git pull`/merge of staging produces massive FALSE conflicts and can revert/duplicate workspace work. NEVER full-pull staging.

**The "claude homepage updates" / marketing revamp** lands on GitHub `staging` as a contiguous block of commits authored by **"Charlotte Carey <charlotte.carey@meetdandy.com>"** (note: capitalized real-name + meetdandy email, distinct from the `charlottecarey <...@users.noreply.replit.com>` and `Replit Agent <agent@replit.com>` mirror commits). That block sits DIRECTLY on top of the workspace's latest `Published your App` HEAD, so it has zero real divergence from the workspace.

**How to apply (clean, no destructive git):**
1. Find workspace HEAD sha; confirm GitHub staging has that exact sha with the Charlotte-Carey block immediately above it.
2. `GET /repos/{repo}/compare/{workspaceHEAD}...{stagingTip}` → the homepage block's net file list (was 24 commits / 57 files, all under `artifacts/lp-studio/`, no renames/deletes).
3. For each changed file, fetch raw content at the staging tip (`/contents/{path}?ref={tip}`, Accept `application/vnd.github.raw`) and write it into the working tree via node fs in code_execution. Let the platform auto-commit. No `git merge`/`cherry-pick`/`apply` needed because base == workspace HEAD.

**Why this works:** base == workspace HEAD means the tip content IS the desired final content for every changed file. Token stays inside code_execution (never printed / never in a git remote URL).

**Gotchas:**
- GitHub compare API omits the `patch` for very large files (e.g. AssembleSceneV2.tsx ~2590 lines) and may show 0/0 — don't trust per-file additions; fetch raw content regardless.
- The block legitimately includes added-but-unreferenced scaffolding components (orphans). They're harmless (tree-shaken) — keep them to stay faithful to staging unless the user asks to prune.
