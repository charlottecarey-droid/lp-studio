# LP Studio — Handoff (July 5, 2026)

State: everything through `524440223` is on origin/staging. Flag `VITE_GENERATION_JOBS=1` is flipped. RESEND_FROM_EMAIL fixed. Launch target: ~1.5 weeks.

## 1. Fix the two microsite smoke regressions (NEXT, pre-launch)
`generate-microsite.smoke.integration.test.ts` now runs (180s timeouts fixed it) and exposes two real bugs previously masked by the 5s-timeout era:
- **Sentence-case normalizer rewrites AUTHORED template copy** ("Event Details" → "Event details"). It must skip preserved/authored block props and only normalize AI-generated text. 6 failures.
- **Empty-block pruner thins the NEUTRAL fallback layout** (8 → 6 blocks), breaking the full-scaffold contract. Either exempt the neutral fallback from pruning or deliberately re-pin the tests. 4 failures.

## 2. Verify the just-shipped work in the Replit webview (after next deploy)
- Briefing prewarm: fresh account → open microsite modal → wait ~1 min → Generate → research stage should complete instantly (`8dbabadf2`).
- Job-mode generation: kill the tab mid-generation, reopen, confirm re-attach.
- Funnel restyle (`c67deb366`): auth screens indigo/cream; dark email-capture modal on a Dandy cinematic page should look unchanged (colors now derive from brand).

## 3. Launch-plan UI items remaining
- Marketing sub-page rhythm pass: /for-marketing, /for-sales, /features, /compare (spacing/type-scale to match homepage).
- App shell polish: app-layout sidebar/topbar + TrialStatusBar amber hardcodes; dashboard cards.
- Full funnel walkthrough in webview: signup → onboarding → brand import → first page → publish.
- Prod verification after deploy: prerendered homepage, OG cards, bundle hash.

## 4. Ops (Charlotte)
- Global-template seed re-run on a deploy (old real-company attributions in DB rows).
- Superadmin → One-Pagers: re-save each built-in's global defaults once (clears stale Dandy-era content from the editor view; tenants already can't see it — reads strip content).

## 5. Stream-latency options not yet done (#1 prewarm shipped)
- #2 Sub-progress events inside the research stage ("Scanning their site…") — small, good pre-launch.
- #3 Parallelize research with context/references load — medium.
- #4 Incremental block streaming in the model phase — post-launch.

## 6. Explicitly post-launch
One-pager Phases 3/4 (fork-a-built-in → custom template; drag-on-preview mapped to offset knobs); ~28 audit mediums; nightly evals + brand-fidelity scorer; `/api/public/ai-suggest` for the live homepage demo; mockup-sandbox typecheck (excluded from CI).

Context for any agent picking this up: memory files under `~/.claude/projects/-Users-charlotte-carey-lp-studio-staging/memory/` (project-state, one-pagers, homepage-redesign) carry the full history and gotchas.
