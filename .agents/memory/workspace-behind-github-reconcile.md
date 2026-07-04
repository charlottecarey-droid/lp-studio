---
name: Replit workspace diverged BEHIND GitHub origin
description: Recover when the Replit workspace's local branch is behind/forked from GitHub origin/<branch> (commits pushed from another env), without losing origin's work
---
The Replit workspace's local branch can fall BEHIND and fork from GitHub `origin/<branch>` when another work stream (a second env, a teammate, the user's Mac) pushed commits GitHub has but this workspace never received. Symptoms: user's `git push` rejected "non-fast-forward"; `git pull` reports "divergent branches"; local branch has only the agent's own recent commit(s) sitting on an OLD base, while origin is many commits ahead on a different line.

Recovery (user runs in the Replit Shell — main agent cannot run git writes):
1. Verify the fixed file's base is UNCHANGED on origin: `git diff --stat <merge-base> origin/<branch> -- <file>` empty ⇒ a cherry-pick of the workspace-only commit will apply CONFLICT-FREE.
2. `git reset --hard origin/<branch>` (working tree must be clean) → workspace adopts GitHub's line.
3. `git cherry-pick <workspace-only-commit-hash>` → re-applies the fix on top (works by hash even though the commit is now dangling after the reset).
4. `git push origin <branch>` → this is a normal FAST-FORWARD (local = origin + 1 commit), NOT a force push.
Then the Mac/other clone `git pull origin <branch>` fast-forwards.

**Why:** origin's commits (15 in the incident) are real work and must be preserved — NEVER force-push the stale workspace line over them. The cherry-pick was clean only because origin had never touched the fixed file, so the fix's diff base still matched.
**How to apply:** any "push rejected / divergent branches" case where GitHub is AHEAD of the workspace. Check the file-base-unchanged precondition first; if origin DID modify the file, re-apply the fix by hand on origin's version instead of cherry-picking.

Stale lock quirk: a months-old `.git/refs/remotes/origin/HEAD.lock` throws `cannot lock ref 'refs/remotes/origin/HEAD'` on `git fetch`, but does NOT block reset/cherry-pick/push that rely on already-fetched refs. User clears it via Shell: `rm -f .git/refs/remotes/origin/HEAD.lock`.
