# Generation evals — golden briefs for `/lp/generate-page` and sales microsites

A regression harness for AI page generation quality. It has two layers:

1. **Pure scorers** (`scorers.ts`) — deterministic functions over a generation
   result. No DB, no network. Unit-tested hermetically in `scorers.test.ts`.
2. **Live runner** (`run.ts`) — seeds a throwaway tenant per golden brief,
   fires a REAL generation, scores the result, writes reports, and diffs
   against baselines. Two brief kinds:
   - **`kind: "page"`** (default) — POSTs `/lp/generate-page` through the
     in-process express stack (the `test-utils/injectRequest` pattern the
     route tests use; full middleware chain runs).
   - **`kind: "microsite"`** — additionally seeds a `sales_accounts` row (plus
     a minimal `sales_briefings` row so the route's slow inline account
     research is skipped) and invokes `generateMicrositeHandler` directly with
     a req/res shim — non-streaming, auth/limiters intentionally bypassed. The
     result's `blocks` are scored with the same scorers.

## Layout

```
src/evals/
  briefs/*.json      # golden briefs: request + brand seed + expectations
  types.ts           # GoldenBrief / EvalReport / scorer types
  scorers.ts         # pure scorers + approvedStatPool helper
  scorers.test.ts    # hermetic scorer unit tests
  briefs.test.ts     # hermetic fixture sanity checks
  run.ts             # live runner (DB + OpenAI proxy required)
  judge.ts           # optional LLM judge (EVAL_LLM_JUDGE=1)
  baselines/         # committed per-brief score baselines (optional)
  reports/           # per-run output (gitignored)
```

## Fast local check (no DB, no OpenAI)

```bash
cd artifacts/api-server
DATABASE_URL="postgres://test:test@localhost:5432/test" npx vitest run src/evals/
```

`DATABASE_URL` only needs to be *set* (module-load requirement of the shared
test env) — nothing connects.

## Full eval run (Replit / deployed env)

Requires `DATABASE_URL`, `AI_INTEGRATIONS_OPENAI_BASE_URL`,
`AI_INTEGRATIONS_OPENAI_API_KEY`. The runner fails fast with a clear message
when any is missing.

```bash
pnpm --filter @workspace/api-server eval:generation                      # all briefs
pnpm --filter @workspace/api-server eval:generation -- --brief=generic-saas,event-page
pnpm --filter @workspace/api-server eval:generation -- --update-baselines
pnpm --filter @workspace/api-server eval:generation -- --keep-tenants   # skip cleanup (debugging)
EVAL_LLM_JUDGE=1 pnpm --filter @workspace/api-server eval:generation    # + soft LLM verdict
```

Each run writes `src/evals/reports/<timestamp>/<briefId>.json` (full report:
scores, violations, block types, degradations, timing) plus `summary.json`.
Exit code is non-zero when any brief fails its thresholds/expectations **or**
any scorer drops more than `EVAL_REGRESSION_TOLERANCE` (default 0.1) below its
committed baseline in `baselines/<briefId>.json`.

Other knobs: `EVAL_GENERATION_TIMEOUT_MS` (default 240000),
`EVAL_LLM_JUDGE_MODEL` (default gpt-4o).

## Scorers

Every scorer returns `{ score, violations }` with `score ∈ [0,1]`; each
violation costs 0.25 (linear, floors at 0), so baseline diffs are monotone in
violation count.

| scorer | what it flags | default threshold |
|---|---|---|
| `fabricatedStat` | stat-like values not in the approved pool (mirrors the route's `scanForUnapprovedStats`/`STAT_LIKE_RX`; shares the production idiom detector) | 1.0 |
| `placeholderLeak` | "Add a quote in brand settings", "replace with", "lorem ipsum", "Customer name", `[Insert …]`, `{{…}}` | 1.0 |
| `emptyImageSlot` | empty image props on image-led blocks (hero/media role tags + per-brief extras) | 0.75 |
| `bannedPhrase` | global clichés + the brand's `avoidPhrases` (delegates to the production `banned-phrase-validator`) | 0.75 |
| `structural` | missing required roles (block-tags taxonomy), duplicate/missing block ids, non-object/null props | 0.75 |
| `subjectLeak` | configurable markers (e.g. "Dandy", "Heartland") bleeding into another brand's page | 1.0 |
| `degradation` | warn-severity entries in the response's `degradations` ledger not allow-listed by the brief | 0.5 |
| `lineupDiversity` | diversity-probe microsite briefs: `distinct skeleton signatures / N` across N per-account generations (signature = ordered block types, nav/footer chrome excluded); violations list which accounts share a skeleton. Briefs without a probe always carry a constant 1, so reports/baselines stay total across brief kinds. | 0.5 |

Briefs override thresholds per scorer (`expectations.thresholds`). Convention
used by the shipped briefs: **non-strict** briefs set `fabricatedStat: 0`
(tracked, not gating — the model is allowed to write numbers when Strict Facts
is off) while **strict-facts** briefs gate it at 1.0 (enforced by
`briefs.test.ts`).

## Adding a brief

Create `briefs/<id>.json` with `id` matching the filename:

```jsonc
{
  "id": "my-brief",
  "description": "What this brief guards.",
  "request": { "prompt": "…" },              // POST /lp/generate-page body
  "brand": {
    "plan": "growth",                         // tenants.plan
    "config": { "brandName": "…" },           // lp_brand_settings.config
    "template": { "title": "…", "blocks": [] } // only with templateId: "$TEMPLATE"
  },
  "expectations": {
    "subjectLeakMarkers": ["Dandy", "Heartland"],  // required by briefs.test.ts
    "requiredRoles": ["hero", "cta", "footer"],
    "minBlocks": 4, "maxBlocks": 30,
    "allowedStats": ["…"],                    // extra approved stats
    "allowedDegradationCodes": ["…"],
    "expectDegradationCodes": ["…"],          // must appear
    "expectUsedReference": false,
    "thresholds": { "fabricatedStat": 0 }
  }
}
```

`request.templateId: "$TEMPLATE"` makes the runner seed `brand.template` as an
`is_template` page and substitute its id. Then run
`npx vitest run src/evals/` — `briefs.test.ts` validates the fixture shape.

## Microsite briefs (`kind: "microsite"`)

```jsonc
{
  "id": "microsite-my-brief",
  "description": "What this brief guards.",
  "kind": "microsite",
  "request": { "segmentId": "dso-enterprise" },   // POST /sales/accounts/:id/generate-microsite body
                                                  // (prompt?, segmentId?, personaId?, objective?,
                                                  //  templateId?, replaceImagery?, referenceUrl(s)?)
  "account": {                                    // the sales_accounts row to seed
    "name": "Evergreen Dental Alliance",
    "domain": "evergreen.example.com",            // optional
    "segment": "DSO",                             // optional (sales_accounts.segment)
    "numLocations": 85                            // optional
  },
  "diversityProbe": { "accounts": 4 },            // optional — see below
  "governance": [                                 // optional tenant_block_governance seeds
    { "blockType": "testimonial", "aiMode": "noai" }
  ],
  "brand": {
    "config": { "brandName": "…" },
    "segments": [                                 // BrandAudienceSegment[]; merged into
      { "id": "dso-enterprise", "name": "…",      // config.segments at seed time (wins)
        "micrositeBlockList": [{ "type": "dso-heartland-hero" }] }
    ]
  },
  "expectations": {
    "subjectLeakMarkers": ["Heartland Dental", "meetdandy"],
    "forbiddenBlockTypes": ["testimonial"],       // optional — any occurrence fails
    "thresholds": { "lineupDiversity": 0.5 }
  }
}
```

Notes:

- A requested `segmentId` must match a seeded segment (by `id`, falling back
  to `name`) — the runner and `briefs.test.ts` both fail fast on a mismatch,
  because the route 400s on unknown segment ids.
- The runner pre-seeds a `sales_briefings` row per account so the handler's
  30-90s inline account research never runs in evals.

### Lineup-diversity probe

`"diversityProbe": { "accounts": N }` (2–8) makes the runner seed N
name-variant accounts (`Acme`, `Acme North`, `Acme South`, …), generate one
microsite per account, and score `lineupDiversity = distinct skeleton
signatures / N`. A skeleton signature is the page's ordered block types with
nav/footer chrome excluded (chrome is injected deterministically and carries
no variety signal). `1.0` = every account got a structurally different page;
violations name the accounts sharing each duplicated skeleton, and the report
meta records every signature (`meta.lineupSignatures`). The content scorers
run over the FIRST generation only. Gate it via
`expectations.thresholds.lineupDiversity` (e.g. `0.5` = at least half
distinct). Briefs without a probe always score a constant 1.
