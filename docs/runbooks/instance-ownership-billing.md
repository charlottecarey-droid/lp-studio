# Instance ownership & billing — moving Dandy's instance onto Dandy's accounts

Companion to [`public-instance.md`](./public-instance.md). That runbook covers
standing up the **public** LP Studio product on a fresh instance. This one covers
the other half of the split: getting **Dandy's** instance — the one their sales
org actually uses — off a personal card and onto accounts Dandy owns and funds.

Written to be taken into the Dandy conversation. Sections marked **[decision]**
are Dandy's / commercial calls, not technical ones.

---

## 1. The situation, plainly

There is currently **one** LP Studio deployment + database, paid for personally.
It is not a scratch/test environment — it holds Dandy's live production sales
data (as of 2026-07-12, tenants 1 + 5):

| Data | Count |
| --- | --- |
| Sales contacts | 7,784 |
| Sales accounts | 333 |
| Leads | 109 |
| Pages | 93 |
| Live integrations (CRM/Slack/etc.) | 6 |

So the instance is Dandy's production tool, funded out of pocket. The goal:
**Dandy owns and pays for the instance its team depends on**; the public product
runs separately on LP Studio's own billing. This is not "Dandy takes the product
and runs with it" — it's Dandy funding software its team uses, the way any
company expenses a tool.

---

## 2. "The bill" is two very different buckets

Splitting the cost matters because the buckets move independently:

**Bucket A — cloud-agnostic SaaS (the bulk of the cost).** For an AI product the
dominant spend is AI API usage + the database, plus email/storage/research APIs.
Every one of these is a third-party service with its own billing that does **not**
care where the app runs:

- Database — Neon (project `withered-river-98350300`)
- AI — the OpenAI/Gemini proxy (`AI_INTEGRATIONS_*`) — usually the single biggest line
- Email — Resend
- Object storage — Cloudflare R2 (or GCS)
- Research/enrichment — Firecrawl, Perplexity, Apollo, PageSpeed
- Billing — Stripe

These can all move to Dandy-owned accounts by transferring ownership or swapping
in Dandy-billed keys. **No re-platforming, no code change, no data migration.**

**Bucket B — compute host (currently Replit).** Only the app process itself is
tied to the host. Dandy is a GCP org (no Replit), so this is the one piece that
needs a decision — see §5.

The practical point: Bucket A is most of the money and moves immediately; Bucket B
is the smaller, stickier piece.

---

## 3. [decision] What Dandy needs to agree to

1. Dandy owns and funds its instance (provisions/pays the Bucket A accounts, and
   covers compute per §5).
2. The commercial + IP arrangement is written down — see §6.

Nothing below happens until this is a yes.

---

## 4. Bucket A — billing transfer (do this first; stops most of the bleed)

Per service, transfer *ownership/payment*, keeping the data in place:

| Service | Mechanism | Data moves? |
| --- | --- | --- |
| **Neon** (DB) | Transfer the project to a Dandy-owned Neon org, or move it onto Dandy's payment method. Neon runs in GCP regions, so it can sit close to Dandy's cloud. | No — the DB stays; only the invoice changes. |
| **AI proxy** (`AI_INTEGRATIONS_OPENAI_*` / Gemini) | Dandy provisions its own proxy key/account; swap the secret. | n/a |
| **Resend** | Dandy's own Resend account + API key + webhook secret. Leave `RESEND_FROM_EMAIL`/`EMAIL_REPLY_TO` unset (per-tenant sender resolution). | n/a |
| **R2 / GCS** | Dandy's own bucket + keys. Existing assets copy over once (small), or keep serving from the current bucket until cutover. | Assets copy (one-time). |
| **Firecrawl / Perplexity / Apollo / PageSpeed** | Dandy-owned keys; swap secrets. | n/a |
| **Stripe** | Only if Dandy runs billing on this instance; else leave off. Code reads `STRIPE_SECRET_KEY` from env (Replit connector is just a fallback), so an env key works anywhere. | n/a |

Because usage can only be attributed per-account, **clean per-party billing
requires each instance to have its own keys** — which is exactly why the
public/Dandy split is the prerequisite, not an optional nicety. You cannot bill
Dandy for "Dandy's share" while one instance serves everyone on shared keys.

---

## 5. Bucket B — the compute host

Dandy has no Replit, so the app process needs a home Dandy can pay for. Two paths:

### B1 — Bridge (fast, zero engineering)
Keep the Dandy instance on the current Replit compute, but Dandy owns all the
Bucket A accounts and reimburses / covers the Replit subscription. Compute is the
small line item; the expensive AI/DB usage is already on Dandy's accounts via §4.
Gets you off the personal bill this week with no migration. Good interim state.

### B2 — Clean (real project, GCP-native)
Re-platform the Dandy instance to **Google Cloud Run** (their native platform,
billed to their GCP project). Feasible — it's a standard Node monorepo + Postgres
+ object storage — but it is **days-to-weeks with testing**, not a same-day task.
What it involves (scoped 2026-07-12):

- Containerize the api-server build (`dist/index.mjs`) + serve/CDN the frontend build.
- **Object storage:** the code has both a Replit-sidecar path (`objectStorage.ts`,
  `PRIVATE_OBJECT_DIR`) and an R2 path (`r2Storage.ts`). Off Replit, route
  everything through R2 (or GCS) — the R2 path already exists, so this is
  configuration + verification, not a rewrite.
- **Stripe:** already works from a plain `STRIPE_SECRET_KEY` env var — no connector needed.
- **Untangle ~50 Replit-specific references** in `artifacts/api-server/src`
  (`REPLIT_CONNECTORS_HOSTNAME`, `REPL_IDENTITY`, `PRIVATE_OBJECT_DIR`,
  `REPLIT_DEV_DOMAIN`, sidecar/connector fallbacks). Many are guards that no-op
  off-Replit; the load-bearing ones are object storage and the dev-domain
  derivation used by OAuth redirect + host resolution.
- Secrets → GCP Secret Manager; migrations run on deploy as today; map Dandy's
  host(s); redo the OAuth redirect URI for the new host (see the `google-oauth`
  memory note — Google allows no wildcards, pin one callback).

**Recommendation:** do B1 now (immediate relief), treat B2 as a follow-up only if
Dandy wants the app fully inside their own cloud. B1 → B2 is a clean later step,
not a redo.

---

## 6. [decision] Commercial / IP questions to settle (not technical)

These are for you + Dandy (and likely written terms); flagged, not answered here:

- Who owns the LP Studio codebase and the Dandy instance's data?
- Is Dandy a customer on a dedicated instance, or is this your product Dandy
  expenses? What happens to the instance if the relationship ends?
- If Dandy ever wants full independence: fork at a handoff commit + transfer the
  Neon project (the split makes this clean, but terms are the prerequisite).

---

## 7. What stays on LP Studio's side

The **public** product is separate and funded by LP Studio (you), per
`public-instance.md`: a fresh, **empty** instance on your billing. Empty = cheap;
it grows with usage/revenue. No Dandy data, no migration.

---

## 8. Recommended sequence

1. **[decision]** Dandy agrees to own + fund its instance (§3) and the terms (§6).
2. **Move Bucket A billing to Dandy** (§4) — stops most of the personal spend immediately, no engineering.
3. **Pick B1 or B2** for compute (§5) — B1 as the bridge now.
4. **Stand up the empty public instance** on your billing (`public-instance.md` §3a).
5. **Launch** the public product.

Launch depends on steps 1–2 (people + billing), so it is not a same-day thing —
but step 2 alone gets the cost off your card quickly, independent of the launch.
