---
name: Email workflow engine hard-fallback
description: The composable workflow layer must fail-safe to code-default sends whenever a matched workflow cannot actually send.
---

The email workflow composer sits ABOVE dispatchNotification. `enqueueWorkflowTrigger`
must run the caller's code-default fallback not just when NO workflow matches the
event, but also when every matched workflow is **non-executable**.

**Rule:** a matched workflow only "owns the send" if it is executable —
`isWorkflowExecutable` = has ≥1 step with a non-empty templateKey that resolves via
`getNotificationTemplate` (code-owned OR DB blank-slate). Empty steps, branch-only
definitions, and unknown/deleted templateKeys all = non-executable. If the executable
subset is empty, run fallback exactly once.

**Why:** otherwise a misconfigured-but-enabled workflow silently swallows
transactional/lifecycle emails (advances enrollment to "completed" without ever
dispatching). This violates the Phase-3 hard constraint that disabling/breaking the
workflow layer can never drop an email. Caught in architect review (FAIL→PASS).

**How to apply:** keep two guards in lockstep — runtime executability gate in the
engine, AND save-time validation (validateWorkflowDefinition rejects no-send-step
definitions; create/patch routes 400 unknown templateKeys via findUnknownTemplateKey).
Executability uses template *existence*, not enabled-state, so operators can
intentionally disable a template without forcing code fallback to re-enable sends.
