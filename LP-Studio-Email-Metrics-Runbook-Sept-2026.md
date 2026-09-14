# Email Metrics Fix — Rollout Runbook (September 2026)

Branch: `homepage-product-led` · Commits `34c48a2a3`, `fabff4013`, `4a358dee0`, `0defd6fff`

## What was actually broken

Campaigns > Performance reported `0` opens, `0` clicks and `0.0%` on every
campaign ever sent, including the 7,398-recipient "Launch: Empower Your DSO
with Dandy (copy)". Unsubscribes appeared nowhere in the product. Four
independent breaks, each sufficient on its own to produce a zero:

| # | Break | Effect |
|---|---|---|
| 1 | `injectTrackingPixel()` defined in `campaigns.ts`, never called. No link ever routed through `/track/click`. | `opened_at` / `clicked_at` never set for any recipient. Both endpoints worked — nothing called them. |
| 2 | Resend webhook handled `delivered`/`bounced`/`complained`/`sent` only. `email.opened` and `email.clicked` fell into the "unhandled event type" log line. | No provider-side fallback when Resend's own link rewriting intercepts a click. |
| 3 | Unsubscribe route wrote only `sales_contacts.status = 'unsubscribed'` — no date, no campaign, no event row. | Opt-outs unmeasurable and unattributable. |
| 4 | `PerformanceTab` read `signal.campaignId`; the signals API returns the campaign in `metadata.campaignId`. | Every signal skipped. Guaranteed zero regardless of 1–3. Also capped at 500 signals. |

Signals looked alive the whole time because hotlink tracking (Personalized
Pages) is wired correctly and injects its own pixel — a different code path.

## Phases as committed

1. **`34c48a2a3`** — send-time open pixel + click rewriting. The send row is now
   inserted *before* the Resend call (status `queued`) so the pixel has an id to
   address. Both idempotency filters widened from `status = 'sent'` to
   `NOT IN ('failed','queued')` — without this, a row advancing to `opened`
   would have made a re-send email that contact twice.
2. **`fabff4013`** — `email.opened` / `email.clicked` webhook cases as a
   backstop, deduped in Postgres (`WHERE opened_at IS NULL`) so our pixel and
   the webhook cannot double-count. `isLikelyBot` extracted to
   `lib/emailTrackingHeuristics.ts` and now applied on both paths.
3. **`4a358dee0`** — migration `0140` adds `sales_email_sends.unsubscribed_at`;
   unsubscribe token widened to 5 parts carrying `campaignId` inside the HMAC.
   Legacy 4- and 3-part tokens still verify. No signal row is written.
4. **`0defd6fff`** — `GET /sales/campaigns/performance` (one GROUP BY) replaces
   client-side tallying; Unsubs, Unsub Rate and Bounces columns added.

## Deploy order — do not reorder

Phase 3 writes `unsubscribed_at`; Phase 4 reads it.

```
pnpm --filter @workspace/db build     # schema change in salesEmails.ts
pnpm run migrate                      # applies 0140 (idempotent: IF NOT EXISTS)
pnpm run build && pnpm run start      # api-server
```

## Verification — run these on your Mac

`node_modules` here is built for darwin-arm64, so vitest could not run from the
Linux bridge. `tsc -b` passed on both packages with no new errors (the 6
remaining are pre-existing, all in `webhook-secrets.ts` / its test).

**1. Unit tests — new coverage**

```bash
cd artifacts/api-server
pnpm vitest run src/routes/sales/emailTracking.test.ts src/routes/sales/unsubToken.test.ts
```

Expect 19 passing. Covers link rewriting (both quote styles, `&amp;`
unescaping, unsubscribe exclusion, idempotency) and token round-trip including
tamper and expiry rejection.

**2. Regression — the send path moved, so re-run it**

```bash
pnpm vitest run src/routes/sales/campaignSend.mergeVars.integration.test.ts \
                src/routes/sales/campaignSendConcurrency.integration.test.ts \
                src/routes/sales/resendWebhookSignature.test.ts
```

The concurrency test is the one that matters — the insert now happens before
the Resend call, inside the same advisory-lock claim.

**3. Migration applied**

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'sales_email_sends' AND column_name = 'unsubscribed_at';
```

**4. End-to-end, on staging — STOP HERE before production**

Send a test campaign to yourself, then:

- open the email → `SELECT status, opened_at FROM sales_email_sends ORDER BY id DESC LIMIT 1;`
  → `opened` with a timestamp. Wait >2s after send: opens inside the 2-second
  bot-grace window are suppressed on purpose.
- click a link → `clicked_at` set, redirect lands on the right destination
  (check a link with query params — that is the `&amp;` case).
- click unsubscribe → `unsubscribed_at` set on that send row, contact status
  `unsubscribed`, **and nothing new in the Signals feed**.
- Performance tab → non-zero Opens/Clicks, Unsubs column populated.

**5. Backfill expectations — say this out loud before anyone reads the dashboard**

Historical campaigns will still show `0` opens and `0` clicks. That data was
never recorded and cannot be reconstructed; only sends after this deploy have
tracking. Same for unsubscribes: `sales_contacts` has no opt-out date, so every
prior unsubscribe is undatable and unattributable. The footer under the table
reports the lifetime total and how many predate attribution, so old rows read
as unknown rather than as zero churn.

## Known gaps, not addressed here

- **Opens are a weak metric.** Apple Mail Privacy Protection prefetches pixels
  for a large share of consumer mail; the 2-second grace window catches the
  obvious proxies and nothing else. Treat clicks as the real signal.
- **`/send-email` and `/send-test-email`** (one-off and test sends) still write
  their send row after the Resend call, so they are untracked. They carry no
  campaign and never appear in Performance. Worth doing for Signals accuracy;
  not required for this dashboard.
- **`routes/dso/index.ts`** has its own copy of `injectTrackingPixel`, also
  never called. If the DSO outbound path is live, it has the same bug.
- Bot filtering is time-based only. User-agent filtering would be a real
  improvement.
