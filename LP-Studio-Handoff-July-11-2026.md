# LP Studio Handoff — July 11, 2026

Successor to `LP-Studio-Handoff-July-5-2026.md`. Covers where launch prep stands, what shipped this week (July 8–11), what's half-built, and what to verify live. Repo: `charlottecarey-droid/lp-studio`, branch `staging`; deploy = push staging → pull in Replit → Redeploy (migrations auto-apply).

---

## 1. Snapshot

Launch posture is unchanged from the July 8 decision: **current deployment + DB stay Dandy's; the public product gets a second deployment on the same repo with a fresh Neon DB** (slip days, not weeks; soak the bots on the public instance first). The code side of that split is done — what remains is your ops work (Section 3).

This week's theme was **closing the loop on the conversational/analytics layer and fixing field-reported bugs**: chat/booking/support analytics shipped, the support bot files real tickets, the builder got its top-3 UX items, and four field reports (Wistia share links, Title Case leaks, Page CTA dead buttons, Page CTA killing videos) were root-caused and fixed.

Test baseline: **~2,200 api-server + ~800 frontend tests green**; CI covers typecheck + both suites (mockup-sandbox still excluded).

---

## 2. Shipped July 8–11 (needs a live smoke on Replit after next deploy)

**Bots & analytics**
- **Chat bot books meetings** (`9feb7430d`): linked form has a Chili Piper/Calendly config → "Pick a time" scheduler inside the chat after capture. Calendly works in the same config field.
- **Bot owner-instructions + booking confirmation message** (`2bd983f35`): two new chat-block panel fields; instructions can't override safety rules.
- **Qualifying questions disqualify** (`b659aa064`): a ruling-out answer stops the pitch/capture; re-qualification resumes.
- **Booking analytics** (`085ad3f01`): Analytics → Conversions tab "Meetings Booked" panel (source + flow attribution, by page, trend); per-page "Meetings" stat. New bookings are flow-stamped (form/chat/cta/email); older ones show "Untracked".
- **Chat analytics** (`a479e26a5`): new Analytics → **Chat** tab — conversations, capture rate, chat leads/meetings, raw visitor-question feed (click → transcript), **"Analyze with AI"** theme clustering.
- **Support ticketing** (`9b95b4a47`): bot escalations now file real tickets (migration **0117** — already applied to the staging DB, deploy's migrate will no-op). Superadmin → **Support** tab: triage list, inline transcripts, resolve/reopen + notes, cross-tenant "what users ask" AI radar.

**Builder UX (items 1–3 of the ranked list done)**
- **Device preview toggle** (`70e21465f`): desktop/tablet/phone pill above the canvas; phone/tablet render the *saved draft* in a real-viewport iframe (auto-saves pending edits first).
- **Pre-publish check** (`9cc5a7404`): Publish now opens a review dialog — dead CTAs, empty forms, placeholder copy, noindex, missing meta/OG, no-lead-capture. Advisory ("Publish anyway" always available); "Go to block" deep-links. First run caught 5 real `#` links on a generated page.
- **Visible undo/redo + duplicate** (`c0bc09a26`): top-bar undo/redo buttons; Duplicate in the block hover toolbar.

**Field-report fixes**
- **Wistia** (`ef650b63a` + `eb47b2ebb`): split-feature block takes any Wistia link (share `/s/` links resolve via oEmbed); thumbnail + play button; inline or modal playback.
- **Inline-editing consistency** (`3e919ef66`): ~30 text blocks converted to click-to-edit; coverage ratchet test prevents regressions.
- **Published pages ignored Page CTA + style-from-URL** (`b75115d90`): server payloads never carried the fields; all viewer-facing payloads fixed.
- **Title Case leaks closed** (`81f902293` + `e1668da89`): shouting (ALL-CAPS) handling, plus the big one — **the LP page generator never ran the sentence-case normalizer at all** (only microsites did). Both paths run it now; `subhead`/`heroDeck`/multi-line-headline keys covered.
- **Page CTA dead buttons + video kill** (`19a810e4e`): capability-aware Page CTA — chilipiper CTAs route into `ctaUrl` for the dso family; unrenderable actions are gated off (block keeps its own button); Wistia prop renamed `wistiaUrl` off the CTA alias namespace (legacy `videoUrl` still plays; panel self-migrates).

**Live-smoke checklist after deploy** (all verified locally against staging data, but the AI buttons only work on Replit):
1. Analytics → Chat tab → "Analyze with AI" (needs AI env — declines cleanly elsewhere).
2. Superadmin → Support → "Analyze" radar; then escalate something via the ? bubble and watch the ticket appear.
3. A page with a Wistia video + Page CTA on: play button survives, buttons open the scheduler.
4. Generate a fresh page: headings should be sentence case; hit Publish to see the pre-publish dialog.
5. Chat bot: capture then book a meeting; check Conversions tab counts it under "Page chat".

**Caveat when testing published pages**: page JSON is edge-cached (60s browser / 5min CDN / long stale-while-revalidate) — hard-refresh or wait a few minutes before judging a fix live.

---

## 3. Remaining launch items (the critical path — mostly your ops time)

1. **Stand up the public instance** (~1–2 days, `docs/runbooks/public-instance.md`):
   - Second Replit app on the same repo/branch + fresh Neon DB; point lpstudio.ai hosts at it (meetdandy hosts stay).
   - Secrets checklist is in the runbook — hard-required: `DATABASE_URL`, `CSRF_SECRET`; set `STRICT_PROD_GUARDS=1` on the public instance (guards only warn otherwise). `.env.example` documents only ~15 of ~60 real vars — the runbook has the audited list.
   - If pruning a DB copy instead of starting empty: `scripts/prune-tenants.ts` (dry-run default). **Keep-list must include tenant 49151 `__system-templates`** (owns all 104 global templates; the script refuses `--apply` without it). Dandy tenants = 1, 5.
2. **Block-catalog seed marker bump v5 → v6**: seed-row edits (DSO de-Dandy'd rows, insights-video empty-imagery rows) rode the un-deployed v5 marker; the stale `grid-cta-tile`/`id-reservation-pass` catalog rows also need it. Bump the marker + add changed types to `LEAKY_TYPES_TO_REMOVE` before/at public-instance boot.
3. **Global-template seed re-run** on deploy — old real-company attributions still in DB rows.
4. **Soak the bots** on the public instance before announcing (the July 8 launch decision).
5. **Verify `VITE_GENERATION_JOBS=1`** is live in prod (flipped ~July 5; one flag gates pages + microsites).
6. **Run the eval harness on Replit** after this week's generator changes: `pnpm --filter @workspace/api-server eval:generation` — expect the sentence-case normalizer to shift some copy baselines; review + `--update-baselines`. Exit 1 on threshold miss is normal.

---

## 4. Half-built / in-flight (state + next step)

**Builder UX list (items 4–6, in order)**
- **Autosave for canvas edits** — save is still manual (page settings already auto-save; beforeunload warning exists). Now safer to add since undo is visible. *Next up if you say "next".*
- **Styled dialogs for unpublish + template-replace** — still native `confirm()`.
- **Persist generation critique/image-fit flags** — computed every generation, shown once in the live view, then dropped (never stored). Needs a server-side stash so the pre-publish check can surface them.

**Open task chips (one-click spin-offs)**
- **Generator emits dead `#` nav CTAs** — the pre-publish check catches them at publish, but generation shouldn't ship them at all (mega-menu navbars especially).
- mockup-sandbox typecheck broken on clean tree (excluded from CI).
- ~14 ephemeral-Postgres test suites not gated on `pgBinariesAvailable()` (die with `initdb ENOENT` on your Mac).
- 2 dso-case-study test failures (deferred; partial diagnosis: normalizer vs approved-pool proper nouns + an unidentified strict-mode sections stripper).

**Generation quality (post-launch backlog)**
- Stream-latency plan #3 (parallelize account research with context load) and #4 (incremental block streaming) — #1 prewarm + #2 sub-progress shipped July 5.
- LP-side recipe-hero fidelity still advisory-only (port `enforceRecipeHeroFidelity` from microsites if generic-hero collapse shows on LPs).
- Two-pass generation parked behind `GENERATION_TWO_PASS` (A/B showed parity; revisit = recipe-deterministic lineup).
- Brand fidelity step 5 (auto style-from-URL on reference-URL generations — pipeline proven, just not automatic) and step 6 (screenshot-compare eval vs `homepageScreenshotUrl` + nightly self-running evals).
- ~30 launch-audit "mediums" deliberately open (`LP-Studio-Launch-Audit-July-2026.md` has the list).

**Bot roadmap (from the spec, in rough priority)**
- **A/B test the bot** (bot-on vs bot-off via the existing A/B engine) — proves conversion lift; strongest launch stat.
- Post-booking transcript marker (bot doesn't know server-side that a meeting was booked; confirmation is client-only).
- Embeddable off-site chat snippet; multilingual — both deliberately waiting on lift data.

**Other**
- Wistia video in more blocks (`lib/wistia.ts` is shared + tested; split-feature is the only consumer — CTA-split-image and business-case blocks are natural next hosts. **Naming rule: never name a block prop `videoUrl`/`ctaText`/etc. — check `PRIMARY_CTA_KEYS` first**, that collision is what killed the video under Page CTA).
- Property-panel consistency refactor (178 panels, inconsistent prop shapes) — internal debt, do opportunistically.
- Homepage: the 21k-px length trim still needs your editorial input; Phase-3 app polish wants a webview eyeball post-deploy.
- Legacy Wistia pages: blocks saved with the old `videoUrl` prop keep playing and self-migrate on next panel edit — but under an active Page CTA they break until migrated (re-touch the video field once).

---

## 5. Quick reference

- **Local verification loop now works** (new this week): root `.env` + `pnpm build && node dist/index.mjs` in api-server (skip migrate) + `lp-studio-fe` preview → real login, real staging DB. CSRF for authed POST curls: `GET /api/auth/csrf` → `x-csrf-token` header.
- **Tests**: `DATABASE_URL="postgres://dummy:dummy@localhost:5432/dummy" npx vitest run` in each artifact; DB suites self-skip locally.
- **Never** let `grep`/`tail` terminate a verification pipe; `git add` explicit paths only.
- Prod DB: Neon project `withered-river-98350300`. Superadmin desk: `/superadmin#support`.

---

## Addendum — evening session, July 11

Five items from Sections 3–4 shipped (all committed on `staging`, both suites green — now ~2,216 api + 824 FE):

1. **Seed marker v5→v6** (`2d4ebf66d`) — launch item #2 DONE. Stale `grid-cta-tile`/`id-reservation-pass` generic rows purge on next deploy; both blocks' registry defaults neutralized (Dandy keeps branding via dental catalog rows).
2. **Builder autosave** (`20b272f15`) — drafts autosave 2.5s after the last edit; published/in-review stay manual-save. Also fixed a latent markSaved snapshot drift that made every save leave the page "dirty".
3. **Styled unpublish + template-replace dialogs** (`3e742d71f`) — last native confirm()s in the builder gone.
4. **Generation-annotation stash** (`bd76e6129`) — builder UX item 6, the ranked list is now COMPLETE. Migration **0118** (auto-applies on deploy). ⚠️ Until that deploy, a LOCAL api-server against the staging DB errors on page routes (drizzle selects the new column).
5. **Dead `#` links fixed at the generator** (`39e5ce698`) — the open task chip. Nav links anchor to real sections, CTAs resolve to defaultCtaUrl/the form, unresolvable links drop. Expect eval-harness copy baselines to shift (item 6 in Section 3 covers the re-run).

Post-deploy smoke additions: generate a fresh page and check the navbar links scroll to sections (no dead cursors), and publish it to see the new advisory notes ("Image may not match its section" / "Marketing clichés may remain") in the pre-publish dialog.
