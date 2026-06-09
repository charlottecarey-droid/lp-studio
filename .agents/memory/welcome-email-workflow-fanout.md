---
name: Welcome/event email duplicate fan-out
description: Why a transactional email (e.g. welcome) arrives multiple times with mismatched/blank names, and how to diagnose before touching the template.
---

Duplicate transactional emails (welcome arriving more than once, often a day later, with blank or "random" recipient names) are usually a SYMPTOM of extra operator-created workflows registered on the same event — NOT a template or engine bug.

**Why:** `enqueueWorkflowTrigger` (workflowEngine.ts) loads `getEnabledWorkflowsForEvent(eventKey)` and enrolls the recipient in EVERY enabled, executable workflow for that event. The code-default welcome send is one; any superadmin test/audience/scheduled workflow firing on `welcome` (or matching the user via audience) sends its own additional copy. Audience/scheduled enrollments can carry a blank `recipient_name`, so their copies show no name even though the genuine signup welcome (with a real session name) looks fine. The `/complete-onboarding` `welcome_email_sent_at` claim only gates the code-default path, not other workflows.

**How to apply:** Before editing the welcome template or the dispatcher, list enabled workflows for the event (SuperAdmin → Notifications → Workflows) and check for stray operator-created ones. The operational fix is deleting those workflows, not changing code. Deletion is available via `DELETE /api/admin/email-workflows/:id` (rejects system/locked) and now via a per-row trash button in the Workflows list (plus the editor's Delete button).
