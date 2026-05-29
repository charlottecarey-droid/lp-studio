---
name: Stripe dunning email ordering
description: Why the dunning email in invoice.payment_failed must run after the downgrade, bounded, and de-duped.
---

In the Stripe `invoice.payment_failed` webhook handler, the dunning email to
workspace admins must be the LAST thing the handler does — after the
final-attempt downgrade-to-`free` runs.

**Why:** The email goes through Resend via `retryFetch`, which has retries but
no per-request timeout. If awaited before the downgrade, a hung/slow provider
delays revoking paid features (the security-relevant action). Stripe also
redelivers events when it doesn't get a fast 2xx, which both re-triggers the
handler (duplicate emails) and is itself caused by a slow handler.

**How to apply:** Run the downgrade first; then send the email best-effort
(try/catch, never throws), wrapped in a `Promise.race` against a ~5s timeout so
a hung send can't stall the 2xx. Guard duplicate sends with an in-process
`Set` of recently-seen `event.id`s (bounded). Persistent cross-process dedupe
would need a schema change — not worth it once the 2xx is kept fast.
