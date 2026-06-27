---
name: GitHub mirror & homepage-revamp pulls
description: How to pull "homepage/marketing revamp" updates from the lp-studio GitHub mirror without a destructive full-staging merge.
---

The lp-studio GitHub mirror repo (resolve its slug from the `github` connection via `listConnections`) is a PARALLEL MIRROR of this Replit workspace, not its upstream. The workspace has no `github` git remote (only Replit `subrepl-*` remotes).

**Key relationship:** GitHub `staging` is hundreds of commits ahead of GitHub `master` (master is a stale snapshot). Most of those commits are the same task work already merged into the workspace but via DIFFERENT commit SHAs — so a literal `git pull`/merge of staging produces massive FALSE conflicts and can revert/duplicate workspace work. NEVER full-pull staging.

**The "claude homepage updates" / marketing revamp** lands on GitHub `staging` as a contiguous block of commits authored by a human committer on the company email domain (distinct from the `@users.noreply.replit.com` and `Replit Agent <agent@replit.com>` mirror commits). That block sits DIRECTLY on top of the workspace's latest `Published your App` HEAD, so it has zero real divergence from the workspace.

**How to apply (clean, no destructive git):**
1. Confirm GitHub staging contains the exact current workspace HEAD sha, with the revamp block sitting immediately above it (base == workspace HEAD = zero real divergence).
2. Use `GET /repos/{repo}/compare/{workspaceHEAD}...{stagingTip}` to get the net changed-file list (expect everything under `artifacts/lp-studio/`).
3. For each changed file, fetch raw content at the staging tip (`/contents/{path}?ref={tip}`, Accept `application/vnd.github.raw`) and write it into the working tree via node fs in code_execution. Let the platform auto-commit. No `git merge`/`cherry-pick`/`apply` needed because base == workspace HEAD.

**Why this works:** base == workspace HEAD means the tip content IS the desired final content for every changed file. Keep the GitHub token inside code_execution (never printed / never in a git remote URL).

**Gotchas:**
- The compare API omits `patch` for very large files (may show 0/0 additions) — don't trust per-file diff stats; fetch raw content regardless.
- The block can include added-but-unreferenced scaffolding components (orphans). They're harmless (tree-shaken) — keep them to stay faithful to staging unless the user asks to prune.
