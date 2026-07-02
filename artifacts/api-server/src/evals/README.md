# Generation evals — golden briefs for `/lp/generate-page`

A regression harness for AI page generation quality. It has two layers:

1. **Pure scorers** (`scorers.ts`) — deterministic functions over a generation
   result. No DB, no network. Unit-tested hermetically in `scorers.test.ts`.
2. **Live runner** (`run.ts`) — seeds a throwaway tenant per golden brief,
   fires a REAL generation through the in-process express stack (the
   `test-utils/injectRequest` pattern the route tests use), scores the result,
   writes reports, and diffs against baselines.

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
