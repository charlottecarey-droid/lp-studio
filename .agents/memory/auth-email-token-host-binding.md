---
name: Email auth token host-binding
description: Every email-token redemption route must re-check targetHost, not just some of them.
---

Email/magic-link/reset tokens are minted with a `targetHost` and are meant to be
host-bound: a link minted on host A must only be redeemable on host A.

**Rule:** every redemption route (`/auth/email/verify`, `/auth/magic-link/verify`,
`/auth/password/reset`, and any future token flow) must, right after a successful
`redeemEmailToken(...)`, reject when `redeemed.targetHost && redeemed.targetHost !== getRequestHost(req)`.

**Why:** the host-bound-link guarantee is only as strong as its weakest callsite.
A password-reset route once redeemed + applied credentials without the host check
while verify/magic-link had it — silently voiding the guarantee for that one flow.
This is the same "must apply at every callsite" failure mode as the modal/theme
and legacy-boolean fallbacks.

**How to apply:** when adding a new email-token purpose, copy the host check
verbatim from an existing verify route; don't rely on `redeemEmailToken` alone —
it enforces single-use + purpose + TTL but NOT host binding.
