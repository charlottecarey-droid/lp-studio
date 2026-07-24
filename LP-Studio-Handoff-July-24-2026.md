# LP Studio Handoff — July 24, 2026

Successor to `LP-Studio-Handoff-July-11-2026.md`. Focused on **what's next**: what's awaiting a deploy + live verify, the ranked work queue, Charlotte's ops items, and the gotchas a fresh session needs. Repo: `charlottecarey-droid/lp-studio`, branch `staging`; deploy = push staging → Charlotte pulls in Replit → manual Redeploy (migrations auto-apply). Prod = app.lpstudio.ai; prod DB via Neon MCP project `withered-river-98350300` (Dandy tenants: 1, 5; `__system-templates` = 49151).

---

## 1. Snapshot

- **Still ONE instance.** The Dandy-keeps-current / public-gets-fresh split (July 8 decision) is fully code-prepped (prune script, runbook, leak fixes) but the second Replit app + fresh Neon DB **has not been stood up** — never act as if a public instance exists.
- **Settings consolidation: Phases 1 + 1b shipped.** Phase 1 (`ba0df2589`): one Integrations home at `/settings/integrations`. Phase 1b (`f0730ebe5`, today): sender identity + custom-email-domain wizard + branded-subdomain card moved off Brand → Sales Console into **Settings → Email → Sending** (`/settings/email/sending`, new `settings/EmailSendingPage.tsx`; shared Resend-status vocab in `src/lib/email-domain-status.ts`). The new page saves via fresh-fetch merge writing only its six sender fields; the brand page's whole-blob save re-adopts the freshest email-owned fields before PUT so a stale brand tab can't revert a sender edit. Setup-status checklist stayed on the Sales Console tab (QuickCampaignWizard's `/brand#sales-console-setup` deep-link unchanged); its 4 sender rows now link to the new page. Card DOM ids kept (`#sales-console-sender-identity` etc.).
- **Conversation-bot lead plumbing is done**: chat leads submit byte-identically to form leads (`297cf0fef`), CRM allowlist keeps bot-synthetic keys from nuking Marketo syncs, Slack callback auth fixed (`d83a13a29`).
- **Scroll reveals fail open across the whole block library** (`08c64b961` + `dfc188f51`): entrance animations can no longer leave copy invisible in previews/one-pagers/thumbnails; builder canvas renders final frames. NEW BLOCK RULE: any whileInView/mount-fade goes through `lib/reveal-fallback.ts` helpers. The "~25 remaining blocks" chip from July 23 is DONE (`dfc188f51`).
- **Builder UX ranked list: all 6 shipped** (device preview, pre-publish check, undo/redo+duplicate, autosave, styled dialogs, annotation stash). The "mobile preview next" note in older docs is stale.
- **Test baseline**: ~2,050 api-server + 877 lp-studio unit tests green; Playwright suite (~85 tests) runs locally against Neon dev (see §5 recipe). CI = typecheck + both unit suites (mockup-sandbox excluded).

---

## 2. Awaiting ONE Replit pull + redeploy → then verify live

Nothing below has been eyeballed in the deployed webview yet. One republish covers all of it:

1. **Settings → Email → Sending** (`f0730ebe5`): page renders for the tenant's tier (Enterprise = wizard, Growth/Scale = branded-subdomain card, lower = free-text field + DNS pill), save round-trips, Brand → Sales Console checklist rows link there, pointer note shows on the Sales Console tab. Command palette "Email sending" entry works.
2. **Settings → Integrations** (`ba0df2589`): connection cards show correct statuses (SFDC/Marketo/HubSpot/Slack; 402 → plan-lock badge), lead-delivery section below, old URLs redirect.
3. **Slack end-to-end**: Add to Slack flow completes (callback fix `d83a13a29` + Charlotte's secret changes), lead alerts post.
4. **Chat leads**: run a test chat on a page with the linked global form → Google Sheets row lands **aligned** under the form's headers, and the lead reaches Marketo (allowlist). Optional config (Charlotte only): add **"Chat Summary"** to that form's fieldMappings if bot notes should sync to the CRM.
5. **Reveal fail-open**: template library thumbnails + the Turner web one-pager show solid text (no transparent heartland-hero copy, no half-faded stats).
6. **One-pager body-section drag** (`909a6c9f0`): pilot/comparison/new-partner sections drag in the editor preview, offsets persist.

---

## 3. Ranked next work (code, in order)

### 3.1 Marketo unification — settings consolidation Phase 2 (next up)
Marketo is the last integration a tenant can configure **twice**, on two live credential stores:
- `lp_integrations.marketo` (raw-SQL table, no Drizzle model) → form-lead outbound sync via `syncLeadToMarketo`.
- `marketo_connections` (Drizzle) → Sales Console bidirectional sync via marketo-service + poller.

Plan: migrate `lp_integrations.marketo` creds into `marketo_connections`, point `syncLeadToMarketo` at the unified store, retire the `lp_integrations.marketo` provider (data migration needed — check prod for tenants with rows in both stores and reconcile before dropping). Per-form overrides on `lp_forms` (enable + fieldMappings) stay where they are — they reference the connection, per the audit principle: *connections are tenant-level under Settings; usage settings live where used.*

### 3.2 Settings consolidation Phase 3
One **Domains** page unifying the three unrelated "domain" concepts (site custom domain, workspace slug, email sending domain — email domain config itself now lives at Settings → Email → Sending and would be linked, not duplicated); slim the Brand page; reframe the per-form **Notifications** tab as **"Lead routing"** with connection-status links.

### 3.3 Settings consolidation Phase 4 (hygiene)
Real Drizzle model for `lp_integrations`; drop the retired `salesforce` provider from the encryption whitelist; decide whether Slack config moves out of the salesConsole plan gate (its lead alerts already fire for ALL tenants but the config UI is gated).

### 3.4 Other open code threads (unordered backlog)
- **Brand-fidelity remainder**: nightly self-running Replit evals + screenshot-compare vs `homepageScreenshotUrl` (step 6, not built). Step 5 (auto style-from-URL) still owes a Replit smoke: generate with a reference URL → Page Settings shows the match + Remove resets; `AUTO_STYLE_FROM_REFERENCE=0` reverts.
- **LP-side recipe-hero fidelity**: `enforceRecipeHeroFidelity` is microsite-only; port to generate-page if generic-hero collapse shows up on LPs (advisory-only today).
- **Microsite stream-latency #3/#4**: parallelize research with context load; incremental block streaming (post-launch tier).
- **Pre-publish generator bug upstream**: generation ships dead `#` nav CTAs that the pre-publish check now catches — fix at the generator someday.
- **Dead file**: `artifacts/lp-studio/src/pages/sales/sales-web-one-pager.tsx` (route already redirects) — delete in passing.
- **Stale catalog rows chip**: `grid-cta-tile`/`id-reservation-pass` have no generic seed rows — needs seed marker v6 (see §5 seed mechanics).
- **mockup-sandbox typecheck** broken on clean tree (excluded from CI; chip existed).
- **~30 audit "mediums"** in `LP-Studio-Launch-Audit-July-2026.md`, deliberately post-launch.
- **Homepage length trim** (21k px) — parked, needs Charlotte's editorial input.
- **Two-pass generation** parked behind `GENERATION_TWO_PASS` (A/B showed parity; revisit = recipe-deterministic lineup).

---

## 4. Ops items (Charlotte's side)

1. **Pull + Redeploy** in Replit (unlocks everything in §2).
2. **Stand up the public instance** per `docs/runbooks/public-instance.md` (~1–2 days): second Replit app on the same repo, fresh Neon DB, DNS (lpstudio.ai hosts → new instance; meetdandy hosts stay), secrets checklist (hard-required DATABASE_URL + CSRF_SECRET; set `STRICT_PROD_GUARDS=1`), prune keep-list MUST include tenant 49151 `__system-templates`. Launch decision was slip-days-not-weeks and soak the bots on the public instance first.
3. **Google OAuth migration** (pure secret swap, runbook in memory/google-oauth.md): create an lpstudio.ai-owned client, **publish consent screen to "In production"** (the step that bit them before), pin redirect `https://app.lpstudio.ai/api/auth/google/callback`, swap `GOOGLE_CLIENT_ID`+`GOOGLE_CLIENT_SECRET` together, smoke the Google-only Dandy hosts (ent.meetdandy.com / meetdandy-lp.com) after cutover.
4. **Optional**: map "Chat Summary" in the chat-linked form's fieldMappings if bot conversation notes should reach Marketo.
5. After any eval-affecting deploy: run `pnpm --filter @workspace/api-server eval:generation --update-baselines` in Replit and review flags (exit 1 on threshold miss is normal).

---

## 5. Gotchas for the next session

- **Verification discipline**: never let `grep`/`tail` terminate a check pipe (`tsc | tail` and `vitest | grep` have hidden failures three times) — run bare or check `$?`. Never `git add -A` (untracked scratch files in repo root must stay untracked) — add paths explicitly. Commits: descriptive, split by concern, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **staging moves while you work** (Replit agent pushes "Published your App" commits): always `git fetch` + rebase onto origin/staging immediately before pushing.
- **Local Playwright e2e recipe**: export `NEON_DATABASE_URL` from repo-root `.env` — do NOT `source` it (an unquoted `&` in the URL breaks zsh); use `export NEON_DATABASE_URL="$(grep '^NEON_DATABASE_URL=' .env | cut -d= -f2-)"`. Then `pnpm exec playwright test <spec>` in artifacts/lp-studio boots api-server (port 4319, Neon cold start can take 2–3 min) + vite (4318).
- **Local app verification recipe** (from memory/builder-ux.md): build+run api-server on 3001 with `--env-file` flags, `preview_start lp-studio-fe` (proxies /api→3001), login via POST `/api/auth/password` (admin@lpstudio.ai + ADMIN_PASSWORD), set `lp_sid` cookie. Writes hit the staging DB — only touch draft "Copy of" pages.
- **Block-catalog seed mechanics**: generic seed is first-boot-marker-gated (`block_catalog_generic_seed_v5`) + ON CONFLICT DO NOTHING — shipping changed seed rows to an existing DB needs a marker bump AND the types added to LEAKY_TYPES_TO_REMOVE.
- **New migrations** must be registered in `lib/db/migrations/meta/_journal.json` (schemaDrift test guards).
- **`/api/sales/brand-context` is behind the salesConsole plan gate** — the Sending page's DNS pill is best-effort and simply absent for low tiers (pre-existing behavior, preserved deliberately).
- **User-guide corpus** (`api-server/src/lib/conversation/grounding/userGuide.ts`) is a maintained artifact — update the matching section when a feature moves; a freshness test validates every `appPath` against App.tsx routes. It doesn't currently document sender-identity location, so Phase 1b needed no guide edit; Phase 3's Domains page likely will.
- **Memory files** under `~/.claude/projects/-Users-charlotte-carey-lp-studio-staging/memory/` are the deep per-topic context (settings-consolidation, conversation-bots, instance-split, recipe-system, one-pagers, brand-fidelity, builder-ux, google-oauth, quality-infrastructure, working-conventions) — read the relevant one before starting a thread above.
