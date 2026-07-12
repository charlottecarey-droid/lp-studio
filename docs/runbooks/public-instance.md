# Runbook: standing up the public LP Studio instance

**Plan (July 2026):** the current deployment + database stay Dandy's home.
The public product gets a **new deployment on the same repo/branch** with a
**fresh Neon database** — new signups never share a database with Dandy's
operating data, and nothing about Dandy's daily sales workflow moves. If
Dandy later wants to "take theirs and run with it," their instance is already
a self-contained repo + DB + domains + secrets.

One codebase, two deployments. Ship by pushing `staging` and redeploying
both Replit apps. Do **not** maintain a long-lived divergent branch.

---

## 0. Facts you need (verified 2026-07-08)

- Prod DB (Neon project `withered-river-98350300`) has **15 tenants** and
  **68 tenant-scoped tables** (everything with a `tenant_id` column).
- The **global template library (104 pages) is owned by tenant 49151
  (`__system-templates`)** — a platform tenant. **Every prune keep-list must
  include 49151**, on both instances, or the shared template library
  disappears with its owner (the prune script refuses to run into this).
- Dandy tenants: **1** (`dandy`) and **5** (`dandy-smb`).
- Shared starter media rows have `tenant_id NULL` and are never pruned.

## 1. Create the public database

Preferred: a **fresh Neon project** (cleanest — no pruning at all; the app's
migrate-on-deploy applies the full schema + seeds global templates, starter
media, block catalog, and plan config on first boot).

Alternative (if existing non-Dandy tenants should come along): branch/copy
the prod database in Neon, then prune it to the public tenants:

```bash
# Always dry-run first — prints the per-table impact report, mutates nothing.
DATABASE_URL=<public-copy> pnpm --filter @workspace/api-server exec tsx scripts/prune-tenants.ts \
  --keep <publicTenantIds>,49151

# Then apply.
DATABASE_URL=<public-copy> ... --keep <publicTenantIds>,49151 --apply
```

The same script later prunes a copy the OTHER way for a Dandy handoff
(`--keep 1,5,49151`).

## 2. Create the second Replit app

1. New Replit app importing the same GitHub repo (`staging` branch).
2. Copy the run/deploy configuration from the current app (build + migrate +
   start — `pnpm run dev` / the deployment command are identical).
3. Set secrets (see §3) with **public-instance values** — new
   `DATABASE_URL`, its own Resend key/domain, its own AI proxy key. Never
   reuse Dandy's Resend sender domain (`ent.meetdandy.com`) here.
4. Deploy. Migrate-on-deploy creates the schema; check the deploy log for
   the migration + seed lines.

## 3. Secrets checklist

Code-level inventory audited 2026-07-08. **`.env.example` is incomplete** —
it documents ~15 of the ~60 vars the code reads; use this section as the
checklist. Generate every secret FRESH for the public instance (never share
signing/encryption keys across instances).

**Hard-required at boot** (server refuses/crashes without them):

| Secret | Notes |
| --- | --- |
| `DATABASE_URL` | The NEW public Neon project. Triple-check you didn't paste Dandy's. |
| `CSRF_SECRET` | Fresh value. |

**Prod-guard secrets** — missing values only WARN unless `STRICT_PROD_GUARDS=1`;
**set `STRICT_PROD_GUARDS=1` on the public instance** so a misconfigured
deploy fails loudly instead of launching half-secured:

| Secret | Notes |
| --- | --- |
| `SESSION_SECRET` | Session signing — fresh. |
| `CREDENTIAL_ENCRYPTION_KEY` | Integration credentials at rest — fresh (keep `_PREVIOUS` empty). |
| `UNSUB_SECRET` | Unsubscribe-link signing — fresh. |
| `RESEND_WEBHOOK_SECRET` | From the public instance's own Resend webhook config. |
| `TURNSTILE_SECRET_KEY` / `TURNSTILE_SITE_KEY` | Its own Turnstile site (bot protection on public forms). |
| `GOOGLE_*` / `GITHUB_OAUTH_*` (+ redirect URIs) | New OAuth apps with lpstudio.ai redirect URIs, if social login is on. **Google:** scopes are non-sensitive (email/profile/openid) so NO brand-verification wall — but you MUST publish the consent screen **Testing → In production** (Testing caps at 100 test-users) and register this instance's exact `…/api/auth/google/callback` in the client's Authorized redirect URIs (Google allows no wildcards). Pin `GOOGLE_REDIRECT_URI` to that callback. See the `google-oauth` memory note for the full migration. |

**Feature secrets** (feature silently off / degraded until set):

| Secret | Notes |
| --- | --- |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` / `_API_KEY` | AI proxy — its own key so usage/cost is attributable per instance. All generation + all four bots. |
| `AI_INTEGRATIONS_GEMINI_*` / `GEMINI_API_KEY` | Optional fallback path. |
| `RESEND_API_KEY` | Public instance's own Resend account. Leave `RESEND_FROM_EMAIL` and `EMAIL_REPLY_TO` **unset** — senders resolve per tenant via `resolveTenantSenderSafe` (shared fallback domain `mail.lpstudio.ai`). |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | Published-HTML/media storage. Separate bucket recommended for full isolation (keys are host-scoped, so sharing also works). |
| `FIRECRAWL_API_KEY`, `PERPLEXITY_API_KEY`, `APOLLO_API_KEY`, `PAGESPEED_API_KEY` | Brand import / research / sales enrichment / page-speed. |
| `STRIPE_SECRET_KEY` (+ `STRIPE_WEBHOOK_SECRET`, `STRIPE_ENABLED`) | Billing. NOTE: on Replit the code prefers Replit-connector secrets; the env vars are the portable fallback. |
| `SFDC_*`, `SLACK_*`, `CLOUDFLARE_API_TOKEN`/`_ZONE_ID` | Per-integration; needed once a tenant connects each. |
| `NOTIFICATION_PREFS_SECRET`, `WORKER_HOST_SECRET`, `ROOT_SUPERADMIN_EMAIL`, `ADMIN_PASSWORD` | Pref links / worker auth / superadmin bootstrap. |

**Replit-specific** (auto-present on Replit; matter only if deploying
elsewhere): `REPLIT_CONNECTORS_HOSTNAME`, `REPL_IDENTITY`,
`REPLIT_DEV_DOMAIN`, `PRIVATE_OBJECT_DIR`,
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

**Tuning knobs** (defaults fine at launch): `RATE_LIMIT_*`,
`*_CONCURRENCY`, generation flags (`GENERATION_TWO_PASS` stays off),
`VITE_GENERATION_JOBS=1` (already the FE default posture — confirm it's set
like prod), Sentry DSNs per instance.

## 3a. Launch-day fill-in order (generate → copy → set up)

The §3 table is the full inventory; this is the *do-it* order. Most values are
copied or generated — only ~4 involve standing up a new third-party thing, and
each of those can be reused from the current instance to launch, then isolated
later. Realistic time once the Neon project + DNS exist: well under an hour.

**Step 1 — Generate fresh (unique per instance; NEVER copy from Dandy's).**
Run in your own terminal, paste each line into the new instance's Replit Secrets:
```bash
for k in CSRF_SECRET SESSION_SECRET CREDENTIAL_ENCRYPTION_KEY \
         UNSUB_SECRET NOTIFICATION_PREFS_SECRET WORKER_HOST_SECRET; do
  echo "$k=$(openssl rand -hex 32)"
done
# + ADMIN_PASSWORD=<pick a strong one>   (first-superadmin bootstrap login)
```
`CSRF_SECRET` is also hard-required at boot; the rest are prod-guard secrets.

**Step 2 — Copy verbatim from the current instance** (same third-party accounts
are fine at launch; the runbook's "separate for cost attribution" is a later
optimization, not a blocker):
- [ ] `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`
- [ ] `AI_INTEGRATIONS_GEMINI_*` / `GEMINI_API_KEY` (optional fallback)
- [ ] `FIRECRAWL_API_KEY`, `PERPLEXITY_API_KEY`, `APOLLO_API_KEY`, `PAGESPEED_API_KEY`
- [ ] `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (keys are host-scoped, so sharing works; new bucket only if you want storage isolation)
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ENABLED` (only if billing is on at launch and it's the same Stripe account)
- [ ] *Defer* `SFDC_*` / `SLACK_*` / `CLOUDFLARE_*` — per-integration, needed only when a tenant connects one

**Step 3 — New setup (the only real "creation"; reuse-to-start where noted):**
- [ ] `DATABASE_URL` — the NEW, EMPTY public Neon project. Triple-check it isn't Dandy's.
- [ ] `RESEND_API_KEY` + `RESEND_WEBHOOK_SECRET` — new Resend, or reuse current to launch. Leave `RESEND_FROM_EMAIL` / `EMAIL_REPLY_TO` UNSET (senders resolve per tenant).
- [ ] `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` — new Turnstile site, or reuse.
- [ ] `GOOGLE_*` / `GITHUB_OAUTH_*` — own OAuth client (see the `google-oauth` note: non-sensitive scopes, publish consent screen Testing→In production, register the callback), or point the current client's redirect at the new host to launch.

**Step 4 — Plain config (not secret, but required):**
- [ ] `STRICT_PROD_GUARDS=1` — fail the boot loudly if any prod-guard secret is missing
- [ ] `WILDCARD_TENANT_BASE_HOSTS=lpstudio.ai,app.lpstudio.ai`
- [ ] `GOOGLE_REDIRECT_URI=https://app.lpstudio.ai/api/auth/google/callback` (must match the registered callback)
- [ ] `VITE_GENERATION_JOBS=1`
- [ ] `ROOT_SUPERADMIN_EMAIL=<your email>` (first superadmin bootstrap)

**Step 5 — After it boots:**
- [ ] DNS: `*.lpstudio.ai` + apex/app point at the public deployment (Cloudflare workers per §4); confirm a wildcard subdomain resolves.
- [ ] Migrations auto-apply on the fresh DB; the block-catalog + global-template seeds run first-boot (markers absent on a new DB), so no manual seed step.
- [ ] Run the §5 smoke checklist.

Tally: ~6 generated (one command) + ~10 copied + 4 new-setup items + 5 config lines. Nothing to migrate — Dandy's data stays on the current instance.

## 4. Routing

- Point `app.lpstudio.ai` (and the apex marketing host) at the **public**
  deployment; the Cloudflare `tenant-host-router` / `og-bot-router` workers
  route by host, so update their origin for lpstudio.ai hosts only.
- `partners.meetdandy.com` and any `*.meetdandy.com` hosts keep pointing at
  the **current (Dandy) deployment**. Its `tenant_hosts` rows don't change.
- Tenant custom domains: new public customers' domains get configured on the
  public instance from day one; nothing to migrate.

## 5. Smoke checklist (public instance, before announcing)

1. Sign up a fresh tenant; import a brand from a URL.
2. Generate a page (watch-it-build streams), edit in the builder, run the
   Ask AI copilot (proposes + applies an edit).
3. Publish to the branded subdomain; visit as anonymous; submit the form →
   lead appears; lead alert email arrives from the tenant sender.
4. Add a Lead Capture Chat block, publish, chat as a visitor, hand over an
   email → lead lands with the Chat transcript button.
5. Help widget ("?") answers a how-do-I question.
6. Sales console (on a plan that includes it): assistant builds a microsite
   for a test account end to end.
7. Confirm NOTHING Dandy-flavored appears anywhere (blocks drawer labels,
   templates, starter imagery, sender domains).
8. `GET /api/health` green; check error logs after the smoke pass.

## 6. Day-2

- Deploys: push `staging` → pull + redeploy in BOTH Replit apps. The eval
  harness (`--update-baselines`) runs per instance.
- Migrations auto-apply on each deploy on both instances (journal-guarded).
- Monitoring: watch both deployments' logs during launch week; rate-limit
  env knobs can be tuned per instance without code.
- A future Dandy handoff = fork the repo at the handoff commit + transfer
  the Neon project + their domains/keys (see the prune script for producing
  a Dandy-only DB copy from any shared state). IP/licensing terms are a
  prerequisite conversation, not a technical step.
