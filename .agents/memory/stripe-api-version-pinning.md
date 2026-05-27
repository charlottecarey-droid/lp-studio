---
name: Stripe SDK apiVersion pinning
description: Constructor apiVersion must literally match the installed SDK's declared ApiVersion string, or TS fails.
---

The Stripe Node SDK's `apiVersion` constructor option is typed as the
literal string declared in `node_modules/stripe/<esm|cjs>/apiVersion.d.ts`
(e.g. `"2026-04-22.dahlia"` in stripe@22). It is NOT `Stripe.LatestApiVersion`
or `Stripe.StripeConfig["apiVersion"]` — those names don't exist in
current typings. A `as const` literal string that matches the file wins.

**Why:** writing an older API date or omitting the value typechecks at
boot but silently changes webhook payload shapes (e.g. `subscription.current_period_end` moved to `item.current_period_end` between dates), which
is the kind of thing that ships green and breaks billing in prod.

**How to apply:** after every stripe SDK upgrade, open
`node_modules/stripe/esm/apiVersion.d.ts`, copy the literal, and update
both `artifacts/api-server/src/lib/stripeClient.ts` and
`scripts/src/stripeClient.ts`. If you want to keep webhook payload shapes
stable across an SDK bump, you must also update the dispatcher to read
fields from whatever positions the new API version uses.
