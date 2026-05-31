---
name: Tenant email audit is metadata-only
description: Why the tenant test-send audit log must not store recipient address, unlike the platform editor.
---

The tenant email editor's test-send audit log (`email_template_edit_log`, action
`test_send`, target_key `tenant:<id>:<key>`) must record metadata only — never
the recipient email address. Store a non-PII flag (e.g. `{ customRecipient }`)
and set `editor_email` to the actor (tenant admin) only, never a recipient
fallback.

**Why:** the platform (superadmin) editor stores `diff: { sentTo: to }` because
its recipients are operators. The tenant surface is multi-tenant and authored by
tenant admins, so recipient addresses are PII that must not leak into a shared
audit trail. Task #588's audit constraint is explicitly metadata-only.

**How to apply:** when adding/altering any tenant-scoped audit write, keep
recipient/body content out of `diff`; mirror the platform editor's *structure*
but not its PII. The tenant integration test asserts the diff excludes the
recipient address and that `editor_email` is the actor.
