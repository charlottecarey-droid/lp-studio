---
name: Workflow tick integration test isolation
description: How to safely integration-test runWorkflowTick (producers+sweep) against the shared prod Neon DB without flakes or real emails.
---

The workflow engine's sweep is GLOBAL and the integration DB is shared (prod Neon),
so naive end-to-end tests of `runWorkflowTick` (produceScheduled + produceAudience +
runWorkflowSweep) are both flaky and unsafe. Three traps:

1. **Per-file dispatch mock can't capture sweep dispatches.** `runWorkflowSweep`
   claims ALL globally-due active rows. A concurrently-running test file's sweep (or
   the live deployment's 60s timer, which sweeps the SAME Neon DB) can claim YOUR
   due enrollments and dispatch them through ITS dispatcher — so your file's
   `vi.mock` never records them and `dispatchedUserIdsFor(...)` assertions fail
   intermittently.
   **Fix:** give the workflow's first step a FAR-FUTURE `delayMs` (e.g. 86_400_000)
   so producers still enroll on the tick but NO sweep ever finds the rows due. Then
   drive ONLY your seeded enrollments yourself via `__test.processClaimedEnrollment`
   (after `claimEnrollment`) — the exact per-step executor the sweep uses.

2. **Real emails to real bucket members.** Audience/scheduled producers enroll the
   ENTIRE global role bucket (superadmin/admin/member), not just your seeded users.
   With a delay-0 sendable step, the live deployment's sweep can send REAL emails to
   those real users before your afterAll cleanup. The far-future delay also closes
   this: not-due rows are never swept; drive only your seeded fake-`@example.com`
   rows. Pick the smallest acceptable bucket to bound the blast radius.

3. **Cross-test bucket-population coupling.** `workflowProducers.integration.test.ts`
   asserts full-set equality (`expect(keys2).toEqual(keys1)`) on the GLOBAL
   superadmin audience. If your test seeds superadmins, its second producer run
   picks them up and that equality breaks. **Fix:** seed into a DIFFERENT bucket
   (use the `admin` bucket — seed `app_users.role='rep'` + a `tenant_roles` row with
   `is_admin=true` + a `tenant_members` link) so you never mutate the superadmin
   population that sibling test depends on.

**Why:** all workflow integration tests run in parallel `vitest` workers against one
shared prod DB; role buckets and the sweep are process-global, so any assertion on a
global count/set or on your own mock capturing the global sweep is inherently racy.

**How to apply:** scope EVERY assertion to your uniquely-suffixed seeded users
(presence/per-user count/status), never global counts; far-future delay + manual
drive for dispatch; CASCADE cleanup via `email_workflows` delete (workflow_id ON
DELETE CASCADE) covers rows minted for non-seeded bucket members too.
