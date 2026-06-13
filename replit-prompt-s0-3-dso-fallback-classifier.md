# Replit prompt — S0: stop the DSO fallback from shipping fabricated stats + tighten the classifier

## What we're solving

Three bugs in `artifacts/api-server/src/routes/lp/generate-page.ts` combine to ship **hardcoded fabricated stats** on customer-facing pages with no Strict-Facts gate, on a wider set of prompts than intended:

### Bug 1 — DSO fallback substitutes fabricated dental stats

`generate-page.ts:4574-4617` — when the AI omits the cost-items array on a `dso-paradigm-shift` block, the route substitutes hardcoded `fallbackNew` literals: `"96%+"`, `"5-day"`, `"2.3% remake"`. These dental-specific numbers then flow downstream.

`generate-page.ts:4100-4112` notes that Strict Facts no longer scrubs unapproved stats (the new review flow shows them with a yellow pill instead). So the fabricated 96% / 2.3% ships to the user verbatim. For a furniture or law-firm tenant whose prompt classifies as DSO via the over-eager classifier (Bug 3), these dental stats render on their live page.

### Bug 2 — Trusted URL bypasses the case-study guard

`generate-page.ts:4129, 5108` — when `urlSourcedFacts === true`, the route bypasses `enforceDsoSuccessStoriesApproved` entirely **for the whole page**. The intent is to relax the strict-stat scanner because the URL is the source of truth — but the bypass also disables the case-study guard, so the AI can hallucinate customer names + quotes that have no relationship to the scraped page. The guard exists specifically to prevent invented customers; it should NOT depend on `urlSourcedFacts`.

### Bug 3 — DSO classifier over-fires

`generate-page.ts:2511` — `isDsoPracticesPrompt` matches the bare token `"practice"` anywhere in the brief. `generate-page.ts:2530` — `isDsoPrompt` matches the bare token `"dso"`. Both fire on innocuous prompts:
- "build me a chiropractic practice page" → DSO Practices prompt
- "yoga practice" → DSO Practices prompt
- "meditation practice" → DSO Practices prompt
- A brief that happens to contain "dso" as a substring of another word → DSO prompt

When this misfires, the page inherits the dental-specific fallback from Bug 1.

---

## Step 1 — Audit

Read end-to-end and put a 5-line summary in the PR:

- `artifacts/api-server/src/routes/lp/generate-page.ts:2511, 2530` — the two classifier functions
- `artifacts/api-server/src/routes/lp/generate-page.ts:4574-4617` — the `dso-paradigm-shift` fallback substitution
- `artifacts/api-server/src/routes/lp/generate-page.ts:4100-4112` — the comment explaining that Strict Facts no longer scrubs
- `artifacts/api-server/src/routes/lp/generate-page.ts:4129, 5108` — the `urlSourcedFacts` bypass
- `artifacts/api-server/src/routes/lp/generate-page.ts:3078-3177` — `buildDsoSystemPrompt` Dandy-vs-other tenant gating (this part is well-built — don't break it)
- `artifacts/api-server/src/routes/lp/generate-page.dso-branding.test.ts` and `generate-page.dso-case-study-defaults.test.ts` — what's already tested
- `lib/factFlags/detect.ts` — for context on how Strict Facts flags stats (the scrub vs flag-and-show distinction)

---

## Step 2 — Fix the dso-paradigm-shift fallback (line 4574-4617)

Two changes:

### 2a. Gate the fallback behind `!strict`

```ts
if (block.type === "dso-paradigm-shift") {
  const aiCostItems = block.props?.costItems;
  if (!Array.isArray(aiCostItems) || aiCostItems.length === 0) {
    if (strict) {
      // Strict Facts mode: refuse to fabricate stats. Use placeholder.
      block.props.costItems = fallbackNew.map(item => ({
        ...item,
        stat: STAT_PLACEHOLDER,  // "—" or "X"
        // keep label/context but null out the fabricated numbers
      }));
    } else {
      // Non-strict: keep the existing fallback (the historical behaviour)
      block.props.costItems = fallbackNew;
    }
  }
}
```

If `STAT_PLACEHOLDER` is currently `"X"`, change it to `"—"` (em-dash). `"X"` renders to users as the literal letter "X" which is startling.

### 2b. Mark fallback-substituted stats so Strict Facts can flag them

Even in non-strict mode, the fallback substitution is the AI emitting "facts" the AI didn't actually generate. Attach a flag-friendly marker so the strict-facts detection pipeline can mark them as `unapproved` regardless of mode. Add to `factFlags/detect.ts` — anything tagged with `__fabricatedFallback: true` in the block props should be auto-flagged as a stat without needing a separate scan.

If wiring that tag through is too invasive for this PR, at minimum log a warning so we can see it in Sentry:
```ts
Sentry.captureMessage("dso_fallback_substituted", {
  level: "warning",
  tags: { tenantId, blockType: "dso-paradigm-shift", strict: false }
});
```

---

## Step 3 — Stop urlSourcedFacts from bypassing the case-study guard (lines 4129, 5108)

The case-study guard prevents the AI from inventing customer names + quotes. That risk doesn't go away when `urlSourcedFacts === true` — if anything, it's higher (the AI sees real customer-shaped content and is more likely to remix it into fabricated case studies).

### Change

Split the two concerns:

- `urlSourcedFacts === true` → relax the strict-stat *scanner* (existing behaviour), because stats in the brief might come from the URL.
- `urlSourcedFacts === true` → still run `enforceDsoSuccessStoriesApproved` (the case-study guard), unconditionally.

Concretely, at lines 4129 and 5108, the conditional that gates `enforceDsoSuccessStoriesApproved` should drop the `&& !urlSourcedFacts` clause. The case-study guard runs for every DSO-classified page, full stop.

### Test

Add to `generate-page.dso-case-study-defaults.test.ts`:
- Generate with `urlSourcedFacts: true` AND a brief that would cause the AI to hallucinate a customer named "Lakeside Dental" → assert `enforceDsoSuccessStoriesApproved` either rejects the hallucinated customer or replaces it with an approved one. Today this test would silently pass with the hallucination intact.

---

## Step 4 — Tighten the DSO classifiers (lines 2511, 2530)

### 4a. isDsoPrompt (line 2530)

Require word-boundary match on `\bdso\b` AND at least one corroborating signal (multi-tenant industry hint, prompt phrase, or block-type hint). Reject substring matches.

```ts
function isDsoPrompt(brief: string, hints: PromptHints): boolean {
  const text = brief.toLowerCase();

  // Word-boundary check — not substring
  const dsoWordMatch = /\bdso\b/.test(text);
  const dentalSupportPhrase = /\bdental\s+(service|support)\s+organization/.test(text);

  if (!dsoWordMatch && !dentalSupportPhrase) return false;

  // Require a corroborating signal so "discuss DSO with my team" doesn't fire
  const corroborated =
    /\b(dental|dentist|orthodont|endodont|periodont|practice acquisitions?|multi-location)\b/.test(text) ||
    hints.industry === "dental" ||
    hints.tenantIndustryTag === "dental";

  return corroborated;
}
```

### 4b. isDsoPracticesPrompt (line 2511)

Require multi-token signals. "practice" alone is too generic.

```ts
function isDsoPracticesPrompt(brief: string, hints: PromptHints): boolean {
  const text = brief.toLowerCase();

  // Reject single-word "practice" matches
  const dentalPracticeMatch =
    /\b(dental|dentist|ortho)\b.{0,40}\bpractice/.test(text) ||
    /\bpractice\b.{0,40}\b(dental|dentist|ortho)\b/.test(text) ||
    /\bdental\s+practice/.test(text);

  if (!dentalPracticeMatch) return false;

  // Same corroboration as isDsoPrompt
  return isDsoPrompt(brief, hints) ||
    hints.industry === "dental" ||
    hints.tenantIndustryTag === "dental";
}
```

### 4c. Make the classifiers honor the tenant's industry

If the tenant has an explicit `industry` set (e.g. `"furniture"`, `"saas"`, `"legal"`), the DSO classifiers should return `false` regardless of brief content. A furniture tenant typing "build me a page for my chiropractic practice client" should never get the DSO Practices prompt.

```ts
function isDsoPracticesPrompt(brief: string, hints: PromptHints): boolean {
  // Tenant industry override — if explicitly non-dental, refuse to classify as DSO
  if (hints.tenantIndustryTag && hints.tenantIndustryTag !== "dental" && hints.tenantIndustryTag !== "dso") {
    return false;
  }
  // ... rest of the check
}
```

### Tests

Add to a new `generate-page.classifier.test.ts` (or wherever the existing classifier tests live):

**isDsoPracticesPrompt:**
- `"build me a chiropractic practice page"` → `false`
- `"yoga practice landing page"` → `false`
- `"meditation practice studio"` → `false`
- `"dental practice growth"` → `true`
- `"practice growth"` (no dental context) → `false`
- `"DSO practice acquisitions"` → `true`
- Tenant with `industry: "saas"` typing "dental practice growth" → `false` (tenant override)

**isDsoPrompt:**
- `"discuss the DSO model with my team"` → `false` (no corroboration)
- `"DSO acquisitions playbook"` → `true` (acquisitions corroborates)
- `"dso"` as a substring of another word (e.g. `"hudson"`) → `false` (word boundary)
- `"dental service organization growth"` → `true`

---

## Step 5 — Defensive: log every DSO classification

Add a Sentry breadcrumb on every classifier call:

```ts
Sentry.addBreadcrumb({
  category: "generation.classifier",
  message: "dso_classified",
  level: "info",
  data: { brief: brief.slice(0, 200), tenantId, result: isDso, kind: isDsoPractices ? "practices" : "general" }
});
```

This way when a misclassification ships, we have the data to triage.

---

## Acceptance criteria

- [ ] `dso-paradigm-shift` fallback in strict mode replaces fabricated numbers with `"—"` placeholders
- [ ] `dso-paradigm-shift` fallback substitution is logged to Sentry as a warning
- [ ] `enforceDsoSuccessStoriesApproved` runs unconditionally regardless of `urlSourcedFacts`
- [ ] `isDsoPrompt` requires `\bdso\b` (word boundary) AND a corroborating signal
- [ ] `isDsoPracticesPrompt` requires multi-token dental/practice match
- [ ] Both classifiers honor tenant industry override
- [ ] All new test cases pass
- [ ] Existing `dso-branding.test.ts` and `dso-case-study-defaults.test.ts` still pass
- [ ] `STAT_PLACEHOLDER` is `"—"` not `"X"`
- [ ] `pnpm typecheck` clean

## Don't

- Don't ship fabricated dental stats on a non-dental tenant's page. The whole point.
- Don't break the Dandy-tenant DSO flow. `generate-page.ts:3078-3177` (`buildDsoSystemPrompt` tenant gating) is well-built — leave it alone. Only the classifier and the fallback are changing.
- Don't remove the `urlSourcedFacts` relaxation entirely — relaxing the strict-stat scanner is correct, just not the case-study guard.
- Don't loosen the case-study guard to make tests pass. If a test was asserting the guard fired only when `!urlSourcedFacts`, that test was encoding the bug — update the test.
- Don't change `enforceDsoSuccessStoriesApproved` itself. It's the right guard; just stop bypassing it.
- Don't add another classifier signal source without thinking through false positives. The current set (dental, dentist, ortho, endo, perio, acquisitions, multi-location) is conservative on purpose.
