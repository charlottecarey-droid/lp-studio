---
name: Resolving git merge conflicts as main agent
description: How the main agent resolves Replit Git-UI pull conflicts without git write access
---

The main agent's bash guardrail FORBIDS any write under `.git/` (no `git add`,
`git commit`, `git merge`, `rm .git/*.lock`). So a Replit Git-UI "Resolve pull
conflicts" flow is a split job:

**Rule:** the agent resolves the *working tree*; the USER finalizes in the Git UI.

**How to apply:**
1. Stale `.git/*.lock` / ref `.lock` files (the persistent "INDEX_LOCKED" UI
   error) — the agent CANNOT delete them. Have the user run in the **Shell** tab
   (not subject to the guardrail): `find .git -name "*.lock" -delete` (only when
   no git process is live).
2. Find conflicts with `rg '^<<<<<<<|^=======$|^>>>>>>>'` (NOT `git diff` — the
   guardrail trips on the index.lock path even for read-ish git commands).
3. Resolve by editing files directly (allowed). To keep ONE side wholesale, run a
   tiny python marker-stripper: keep lines between `<<<<<<< ` and `=======`
   (=HEAD/"ours"), drop through `>>>>>>> `. For an interdependent rewrite (e.g. a
   function whose signature changed on both sides) you MUST pick one side for
   ALL its conflict regions or it won't compile — don't mix hunks.
4. Validate before handing back: run the typecheck + unit-test workflows
   (tc-api / img-test / tc-lp) and confirm the dev server boots.
5. Tell the user to click **Complete pull** in the Git pane — that stages the
   marker-free files and creates the merge commit. Binary conflicts (e.g.
   opengraph.jpg) are resolved in the UI itself (green check), not by the agent.

**Why:** prevents the agent from silently corrupting the index, and keeps the
final commit an explicit user action. Confirmed: editing the working tree then
"Complete pull" finishes cleanly; the merge commit is the user's.
