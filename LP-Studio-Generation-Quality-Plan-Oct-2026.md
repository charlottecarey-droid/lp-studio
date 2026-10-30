# LP Studio — Generation Quality Plan (replaces the "Visual Editor 2.0" spec)

**Date:** 2026-10-28
**Status:** Step 1 shipped (`ce8e52a0c`); Step 1b applied in production 2026-10-29/30 with Charlotte's approval (snapshot + restore script in `docs/runbooks/`); Step 2a shipped (per-path model setting, default unchanged). Steps 2b–5 are planned and need the decisions marked **DECIDE**.
**Why this plan exists:** Charlotte: "I really want pages to look better from the AI. Every time I need a new page I ask you to build it instead of using the LP Studio AI. Other people are stuck with the crappy editor and recipes." The ChatGPT "Visual Editor 2.0" spec answered a different question (a Webflow-style element editor). The review of that spec is kept as Appendix A; the rest of this document is the plan that attacks the stated problem.

---

## 1. Why hand-built pages beat generated ones

Four concrete differences, not taste:

| Difference | What I do in a session | What the generator does today | Fix |
|---|---|---|---|
| **Vocabulary** | Use the newest block families, or write a new one | Picks from the GENERAL prompt's advertised blocks. The ABM, Hub and Kit families built this year were never advertised; the Stack family is, but only through one recipe in a ten-recipe rotation | Step 1 (done), 1b |
| **Model** | Claude, iterating | `GENERATION_MODEL = "gpt-4o"`, hardcoded in `generate-page.ts:105`; the Builder Copilot is also gpt-4o | Step 2 |
| **New components when nothing fits** | Write a block | Cannot. The custom-schema block maker exists but the planner never calls it | Step 4 |
| **Iteration** | Back-and-forth in the browser | One shot, then a Copilot that proposes block-level swaps | Step 3 |

Facts that shape the plan (prod, 2026-10-28):

- Generation volume is small: about 70 logged generations in 90 days, roughly one a day.
- The live freeform recipe pool is **not the code**. Charlotte overrode all five built-in freeform recipes in the Recipe Manager (June–July 2026) and added four custom ones. Overrides replace the code skeletons, so editing those five skeletons in code changes nothing in production. The pool that actually runs: her five overridden built-ins, her four customs, and the code-only "Product stack" recipe (Stack family, picked twice in 90 days).
- Recipes are chosen by least-recently-used rotation per tenant, blind to the brief. Fit is left to the model via the "discard the recipe if it does not fit" clause.
- The weak blocks she dislikes (benefits-grid, feature-photo-cards, value-pillars cards, dandy-columns) are in the override skeletons, not in the code recipes.

---

## 2. Step 1 — ABM family into the generator (implemented)

**Landing pages (`generate-page.ts`)**
- Eleven `abm-*` schema bullets added to the GENERAL vocabulary (`GENERAL_EXTRA_ABM_BLOCKS`), written like the Stack family's: media slots always blank, image slots server-filled, logos / icons / headshots / review logos never set by the model, proof blocks only with real quotes, names and numbers, arrow links blank unless the brief supplies a real URL.
- `abm-split-hero` joins the hero-class list (rule 4), the self-nav hero list (rule 14) and the showcase list (rule 15, with phone showcase, solution tabs and story quote).
- Image pipeline: hero media filled hero-grade, solution-tab screenshots filled product-detail on the tab's own subject, reading tiles filled feature-grade; the phone showcase poster is deliberately never collected or filled (portrait slot with a designed placeholder).
- New built-in recipe **"Enterprise platform"** (`freeform-enterprise-platform`): split hero → phone showcase or feature tabs → solution tabs → integrations or logo strip → story quote → ROI stats or stat band → feature grid or glass bento → reading tiles → ratings close or aurora finale. It has no override row, so it enters the production rotation on deploy.

**Microsites (`generate-microsite.ts`)**
- Curated microsite prop schemas for all eleven blocks (the hero's `companyName` is the target account, like the heartland hero).
- `abm-split-hero` added to the microsite hero set and the dark-by-design set, so the white-hero upgrade pass and the section-rhythm pass leave it alone and the recipe-hero lock recognises it.
- New built-in recipe **"Account platform page"** (`microsite-account-platform`).

**Tests:** recipe-vocab drift test asserts the family and the three rule edits; image tests cover every fill and every never-fill; recipe shape tests widened; 372 generator tests green locally. Full suite and typecheck results are in the commit message.

**Deliberately not done**
- **Kit family**: Dandy's VR kit page; not a general archetype.
- **Hub family**: a resource hub needs real files; the model cannot produce assets. It stays a template.
- **Invite family / glow-form-hero**: already advertised; no recipe because an invitation or demo-booking page is intent-specific and the rotation is blind to intent (see Step 2b).
- **Her override rows**: untouched. See Step 1b.
- **Block Catalog rows** for `abm-*`: none exist in the generic seed, so superadmins cannot toggle them per industry yet. Generation is fail-open without rows. Worth a seed follow-up.

**What Charlotte does after deploy:** pull + redeploy in Replit, run `pnpm --filter @workspace/api-server eval:generation --update-baselines` (baselines will shift), then generate two or three pages with enterprise / platform briefs for a non-Dandy tenant and send screenshots.

---

## 3. Step 1b — Clean the production recipe pool (**DECIDE**)

The ten-recipe rotation means a good recipe is picked one time in ten. Promoting good blocks only helps if the weak recipes stop being picked. The weak slots are in Charlotte's override rows:

| Override | Weak slots | Proposal |
|---|---|---|
| `freeform-conversion-tight` | dandy-vertical-tabs, dandy-side-image-v6, trust-bar | Reset to code (hero → benefits-grid/dso-ai-feature/benefits-icon-grid → testimonial-wall → stepper → pricing/comparison → finale), then swap benefits slot for `abm-feature-grid OR glass-bento-features` |
| `freeform-editorial` | dandy-columns-v2/v3, value-pillars-color-block-cards, case-studies | Reset to code (kinetic/magazine/ai-scan hero → bold-statement → editorial-carousel → split-media-row → quote → case-study-spotlight → cta) |
| `freeform-data-led` | feature-photo-cards, case-studies | Reset to code, keep her hero choice (full-bleed OR aurora) |
| `freeform-showcase-heavy` | pas-section, how-it-works-alternating, gallery-split-feature | Reset to code |
| `freeform-story-led` | dandy-columns-v2, value-pillars-outlined-cards, case-studies | Reset to code |
| `freeform-custom-5271f3f794` "Big Block Page" | feature-photo-cards, features-spotlight-cards, value-pillars-outlined-cards, feature-card-grid | Keep, swap the four card grids for `abm-feature-grid`, `glass-bento-features`, `video-zigzag OR zigzag-features`, `abm-reading-tiles` |
| `freeform-custom-53543a95fe` "Full bleed square statement" | value-pillars-color-block-cards, feature-big-features, feature-photo-cards | Keep (its square-corner note is a real art-direction choice), swap the three card slots for `abm-solution-tabs`, `video-zigzag OR zigzag-features`, `abm-story-quote OR quote-with-image` |
| `freeform-custom-7c02f1d07e` "Copy-heavy Credible" | dandy-vertical-tabs, dandy-columns-v2, feature-photo-cards | Keep the heartland hero + pas opener; replace the middle with `abm-solution-tabs`, `video-zigzag OR zigzag-features`, `abm-story-quote` |
| `freeform-custom-ac946bb33c` "Product Page" | dandy-vertical-tabs, benefits-grid OR feature-card-grid | Retire: "Product stack" (Stack family) is the better product page |

**Applied 2026-10-29 with Charlotte's approval**, then corrected 2026-10-30 after she asked why feature-photo-cards, the value-pillars cards and dandy-vertical-tabs were removed: those three were culled by my heuristic (older card families), not by any quality signal or her preference. They are back as OR alternatives beside the ABM and Stack options in Big Block Page, Full bleed square statement, Copy-heavy Credible and Conversion-tight, and Product Page is re-enabled. Rule going forward: never remove a block from a recipe on inferred taste; ask which blocks are liked first. Snapshot of the pre-change table + one-shot restore: `docs/runbooks/recipe-overrides-{backup,restore}-2026-10-29.{json,sql}`.

The three options that were on the table:
1. I update the rows by SQL once you approve the table above (fastest; it is your authored data, so I will not touch it unasked).
2. You edit them in the Recipe Manager.
3. Delete the five built-in override rows so the code recipes apply, and I edit the four customs by SQL.

Recommendation: option 3 for the built-ins plus option 1 for the customs, in one approved change.

---

## 4. Step 2 — Model and recipe fit

**2a. Model per path (SHIPPED, default unchanged).** `artifacts/api-server/src/lib/generation-model.ts` resolves the model per prompt path: `GENERATION_MODEL_<PATH>` → `GENERATION_MODEL` → `gpt-4o`. Paths: GENERAL, DSO_ENTERPRISE, DSO_PRACTICES, TEMPLATE, PLANNER (two-pass lineup planner), MICROSITE, CRITIQUE (copy-polish pass). Every call site in both generators and the critique pass goes through it, and `samplingParams` omits `temperature` for gpt-5-family and o-series models, which reject a non-default value (the same reason `draft-email.ts` sends gpt-5 no temperature). The generation receipt now carries `model`. Nothing changes until an env variable is set in Replit.

**Recommended first flip (DECIDE):** `GENERATION_MODEL_GENERAL=gpt-5` and `GENERATION_MODEL_MICROSITE=gpt-5`, leaving DSO, TEMPLATE, PLANNER and CRITIQUE on gpt-4o for the first comparison. gpt-5 is already served by the same AI proxy (draft-email uses it), so it is an env change with no code or key work, reverted by unsetting the variable. Measure with the eval harness and the §8 benchmark before flipping the remaining paths. Claude remains an option for a later comparison; it needs an Anthropic key in Replit and an adapter for the response shape, so it is a small code change rather than an env flip, and I will load the API reference before scoping it. The Copilot (`CONVERSATION_MODEL`) is already env-driven and can be flipped separately.

**2b. Recipe fit, not rotation.** Classify the brief into an archetype (platform / product / editorial / data-led / story / conversion / invitation / demo-booking) with the existing `template-intent.ts` keyword matcher plus a tiny model call, then pick among the recipes tagged for that archetype, with LRU inside the archetype so variety survives. This is what lets the Invite and demo-booking families get a recipe without wasting one rotation slot in ten on a wrong fit. Recipes gain an optional `archetypes: string[]`; untagged recipes stay in every pool, so her customs keep working.

---

## 5. Step 3 — Copilot that can do what she asks me to do

Condensed from the editor review (Appendix A, M2): one shared command module used by the builder and the Copilot; the builder posts the selected block; the Copilot mode grounds on that element's full props, siblings and brand tokens; it emits a validated command array (`updateProps`, `replaceText`, `updateSettings`, `insertBlock`, `moveBlock`, `deleteBlock`) with a diff card; scope is enforced server-side (selected block or its descendants only); apply is one undo entry. Runs on the Step 2 model. This is the "second and third turn" a tenant never gets today.

---

## 6. Step 4 — Let generation author a block when the library does not fit

The block maker already turns a brief into a custom-schema block (HTML template + fields) with the art-direction doctrine and brand CSS variables. Allow the planner to request **one** bespoke section per page (hero or a feature section) when no advertised block matches the brief, run the critique pass on it, and fall back to the library on any validation failure. Flag `GENERATION_BESPOKE_BLOCKS`, off by default, Dandy tenants first. This is the productised version of "Claude writes a component", and the riskiest step, so it is last among the generation steps.

---

## 7. Step 5 — Draft/published split and version history

Still a liability independent of quality: a save on a published page re-renders the live page, and nothing can be restored. Condensed from Appendix A, M1: `lp_page_revisions` table, nullable `published_revision_id` on pages (NULL serves `blocks` as today, zero backfill), one helper for every public reader with a parity test, publish creates a snapshot, restore never overwrites, `If-Match` concurrency. Scheduled after the generation steps because nobody is blocked by it today, but before any tenant edits published pages heavily.

---

## 7b. What the first real pages taught us (2026-10-30)

Two gpt-5 pages, traced through the generation log and the saved blocks:

- **Intent routing can bypass everything.** "generate a page for my b2b enterprise platform audiences" matched the seeded *Enterprise Platform* flagship template, so the page was a fixed template with placeholder stats ("Fortune 100", "32 regions", "99.99% SLA"), a photo-strip of stock photos of Netflix/TikTok icons captioned as customers, and no hero image. Six flagships are layouts, not page types; **DECIDE:** stop intent-routing into them (category gate in `template-intent.ts`) and scrub placeholder proof from the flagship seeds.
- **The prompt itself was teaching dental copy.** `copy-principles.ts`, injected into every generation for every tenant, used Dandy facts as its worked examples ("96% first-time fit rate", "5-day crown delivery", "Zero lab drama"). A generic brand's page shipped those bullets verbatim. Fixed: industry-neutral examples by default, the dental set only for Dandy tenants.
- **The server invented stats.** When the model omitted a stats section, the required-roles backfill injected a trust-bar with "10,000+ customers served / 98% on-time / 4.9/5 / 24/7" on every non-strict tenant. Fixed: the stats role is backfilled only from the brand's approved scraped stats (three or more), otherwise left uncovered.
- **Footer year.** The model writes the year it believes it is ("© 2023"). Fixed with a deterministic pass before the normalizer.
- **Fixed 2026-10-30 (three rules, approved):** layout-style categories (saas-launch, services, portfolio) are never intent-routed; the flagship seeds lost their invented trust-bars and brand-icon photo-strips (seed marker v47); a generation with no reference URL never draws on other sites' scraped images. Also from the HVAC page: label-less CTA buttons no longer render on live pages, and the sentence-case normalizer protects months, weekdays and holidays.
- **Lead-form fallback (approved, shipped 2026-10-30):** a tenant with no default CTA URL and no Chili Piper link, generating a page with no form block, now gets a native lead-capture form inserted before the footer (anchor `get-started`) on both page paths, and the dead-link pass anchors every CTA to it instead of hiding the buttons. Logged as an info degradation on the receipt; setting a default CTA URL in Brand Settings turns it off.
- **gpt-5 latency:** the first real gpt-5 eval run took 95–230 s per page at the provider's default reasoning. `GENERATION_REASONING_EFFORT=low` is the recommended Replit secret; `EVAL_GENERATION_TIMEOUT_MS=480000` keeps the harness from timing out.
- **Test tenants are polluted.** The library of the `testa` tenant is Drift and Salesloft screenshots harvested from reference URLs; `lpstudio` holds Zoom scrapes. Any generation on those tenants will reuse them. The reference-image harvest writes other companies' graphics into the tenant library permanently, which is worth revisiting.

## 8. Measurement

- **Benchmark set (needed from Charlotte):** three or four pages I built this year, each with the brief she gave me. The generator is judged against those, same brief, same tenant.
- **Eval harness:** the 21 briefs and 8 scorers already exist (Replit only). Add two enterprise / platform briefs so the new recipe is exercised, and a `vocabularyReach` scorer that fails when a run never picks a block newer than June 2026.
- **Visual scorer:** screenshot each eval page through the existing Playwright capture and score it with a vision model against the brand reference URL. The current scorers check rules, not looks; this is the one that measures what she sees.

---

## Appendix A — Review of the "Visual Editor 2.0" spec (2026-10-28)

The spec assumed a greenfield editor. Nearly everything it asked for already exists in the builder: nested containers (`section`, `columns`, `grid`, `stack` with `children`), single-root dnd-kit drag-and-drop, inline rich text on every text block with Tiptap as a dependency, a layers panel, undo/redo (50 entries, but no Cmd+Z binding), draft-only autosave, a registry with allowed-child rules, and a proposal-only Copilot with seven action types. Production data: of about 350 pages, zero use any container or grid piece. The system was gated to admins, never emitted by the generator, and its primitives are compound tiles rather than elements.

Rejected from the spec: Craft.js (dnd-kit already owns the tree; 290 block components would need wrappers), a normalised node-map schema (breaks A/B variant overrides keyed by block id, the prerender pipeline, the generator and microsites), a separate editor route, a migration adapter, six new tables, Zustand. Kept as ideas: the command engine (Step 3 here), the acceptance tests re-homed onto vitest and the existing Playwright suite, draft/publish and revisions (Step 5 here).

The element editor itself (true heading/text/button/image leaves, per-breakpoint styles, column widths, "explode a block into elements") is parked. It would be a second editing paradigm beside 290 blocks and 203 panels, permanently, and no tenant has asked for it by name. If tenants start saying "I can't put a button there", revisit, starting with six leaf elements and a shared inspector and nothing more.
