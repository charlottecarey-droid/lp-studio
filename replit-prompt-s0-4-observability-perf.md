# Replit prompt — S0: pre-launch observability + perf hardening

## What we're solving

Four cross-cutting launch-blocker gaps, all small fixes, all high leverage:

1. **Critical AI routes are invisible to Sentry.** `generate-page.ts`, `brand-import.ts`, `brand-import-from-url.ts`, `brand-import-from-url-stream.ts`, `firecrawl.ts` all wrap their handlers in `try { ... } catch (err) { res.status(500).json({ error: String(err) }) }`. Because the handler responds itself, errors never propagate to `Sentry.setupExpressErrorHandler`. `grep -c "Sentry\." routes/lp/{generate-page,brand-import,brand-import-from-url,brand-import-from-url-stream,firecrawl}.ts` = 0 across all five. On launch day a single bad prompt = silent 500s with no Sentry signal.

2. **Templates list ships the full block JSONB for the count.** `routes/lp/templates.ts:42-50` selects every column including the massive `blocks` payload just to compute `blockCount: blocks.length`. MB-class payload per gallery load. Combined with the missing tenant_id index below, this is the documented Templates-list slowness from the UI audit.

3. **No `lp_pages.tenant_id` index.** Every per-tenant page query (gallery, templates, dashboard) seq-scans. Single biggest perf win in the codebase.

4. **No `response_format: { type: "json_object" }` on the main generate calls.** `generate-page.ts:4411-4419` and `:3941-3949`. The system prompt asks the model not to use markdown/code fences, but at temperature 0.9 the model occasionally adds a prose preamble (`"Here is your page:"`). That makes `JSON.parse` 500 AND burns the user's AI quota (which is decremented up front). `critique-pass.ts:223` already uses `response_format: { type: "json_object" }` — copy that pattern.

---

## Step 1 — Audit

Read end-to-end and put a 5-line summary in the PR:

- `artifacts/api-server/src/routes/lp/generate-page.ts:3663-3679, 3941-3949, 4411-4419` — the three relevant call sites + catch
- `artifacts/api-server/src/routes/lp/brand-import.ts:395-447`
- `artifacts/api-server/src/routes/lp/brand-import-from-url.ts` (find the outer catch)
- `artifacts/api-server/src/routes/lp/brand-import-from-url-stream.ts` (find the outer catch)
- `artifacts/api-server/src/routes/lp/firecrawl.ts` (find the outer catch)
- `artifacts/api-server/src/routes/lp/templates.ts:42-50` — the list query
- `artifacts/api-server/src/lib/sentry.ts:82-117` — PII scrubbing pattern (don't reinvent)
- `artifacts/api-server/src/middleware/requireAuth.ts:115-118` — how tenantId is set on Sentry scope (already done per-request)
- `artifacts/api-server/src/lib/ai-prompts/critique-pass.ts:223` — the canonical `response_format` usage
- `lib/db/migrations/` — last migration number, naming convention

---

## Step 2 — Wrap critical routes in `Sentry.captureException`

For each of the five routes, find the outer catch and add the capture **before** the response. Concrete pattern:

```ts
import * as Sentry from "@sentry/node";

// ... inside handler ...
} catch (err) {
  Sentry.captureException(err, {
    tags: {
      route: "generate-page",         // unique per file
      flow: "freeform",                // freeform | template | brand-import | scrape | etc.
      strictMode: String(strict),      // or whatever flow-relevant tags help triage
    },
    extra: {
      tenantId,                        // already on scope but doesn't hurt
      promptHash: promptText ? hashShort(promptText) : undefined,
      urlInspiration: urlInspiration ?? undefined,
      // explicitly DO NOT include: full prompt text, user PII, scraped HTML
    },
  });
  res.status(500).json({ error: "Internal error generating page" });
}
```

`tenantId` is already on the Sentry scope per-request (`middleware/requireAuth.ts:115-118`), but listing it in `extra` makes the event self-contained for triage.

### Specific call sites

| File | Approximate line | Tag `route` |
|---|---|---|
| `routes/lp/generate-page.ts` | outer catch ~3679 (and any other top-level catches in the route module — there are 2–3) | `"generate-page"` |
| `routes/lp/brand-import.ts` | outer catch ~447 | `"brand-import"` |
| `routes/lp/brand-import-from-url.ts` | outer catch | `"brand-import-from-url"` |
| `routes/lp/brand-import-from-url-stream.ts` | outer catch | `"brand-import-from-url-stream"` |
| `routes/lp/firecrawl.ts` | outer catch ~96 + the multi-page wrapper | `"firecrawl"` |

### Don't capture user-controlled text in `extra`

PII scrubbing in `lib/sentry.ts:82-117` handles request headers/cookies and user fields, but `extra` is yours to manage. Hash long prompt text rather than including it raw. Never include the full scraped HTML.

### Tests

Mock `Sentry.captureException` in a smoke test for each route. Trigger a deliberate error (e.g. inject a model timeout) and assert that the mock was called once with the expected tags.

---

## Step 3 — Project columns in templates list

In `routes/lp/templates.ts:42-50`:

```ts
// BEFORE
const templates = await db
  .select()
  .from(lpPagesTable)
  .where(and(eq(lpPagesTable.isTemplate, true), or(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.isGlobal, true))));

// AFTER — select only what the UI renders
const templates = await db
  .select({
    id: lpPagesTable.id,
    title: lpPagesTable.title,
    slug: lpPagesTable.slug,
    templateLabel: lpPagesTable.templateLabel,
    templateDescription: lpPagesTable.templateDescription,
    status: lpPagesTable.status,
    mode: lpPagesTable.mode,
    ogImage: lpPagesTable.ogImage,
    thumbnailUrl: lpPagesTable.thumbnailUrl,
    isGlobal: lpPagesTable.isGlobal,
    industry: lpPagesTable.industry,
    createdAt: lpPagesTable.createdAt,
    updatedAt: lpPagesTable.updatedAt,
    // Compute blockCount in SQL — don't ship the whole blocks JSONB
    blockCount: sql<number>`jsonb_array_length(${lpPagesTable.blocks})`,
  })
  .from(lpPagesTable)
  .where(and(eq(lpPagesTable.isTemplate, true), or(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.isGlobal, true))));
```

Then drop the `blockCount: blocks.length` JS computation downstream.

### Confirm

- Network tab: response size drops from MB to KB.
- Existing tests still pass (if any test asserts on a non-projected field, you'll need to update — let those failures guide you).
- p95 latency on the gallery load measurably better.

---

## Step 4 — Add the tenant_id index

New migration: `lib/db/migrations/00XX_lp_pages_tenant_id_index.sql` (use the next available number).

```sql
CREATE INDEX IF NOT EXISTS lp_pages_tenant_id_idx ON lp_pages (tenant_id);

-- Composite for the most common filter combos
CREATE INDEX IF NOT EXISTS lp_pages_tenant_template_idx ON lp_pages (tenant_id, is_template);
CREATE INDEX IF NOT EXISTS lp_pages_tenant_status_idx ON lp_pages (tenant_id, status);
```

Don't drop any existing indexes. Don't add a UNIQUE constraint. `IF NOT EXISTS` is required because the migration may be run on environments where someone manually added the index.

Test in a scratch Neon branch first if you're nervous, but Postgres `CREATE INDEX IF NOT EXISTS` is safe — it's a no-op if the index already exists.

### Confirm

- After migration runs, `EXPLAIN ANALYZE SELECT * FROM lp_pages WHERE tenant_id = 'x' AND is_template = true LIMIT 100` shows `Index Scan using lp_pages_tenant_template_idx` not `Seq Scan`.

---

## Step 5 — Add `response_format: { type: "json_object" }` to the main generate calls

Two call sites in `generate-page.ts`:

### 5a. Template path (~line 3941-3949)

```ts
const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages,
  temperature: 0.9,  // (separately, see S1: drop to 0.5 in strict mode)
  max_completion_tokens: ...,
  response_format: { type: "json_object" },  // ADD THIS
});
```

### 5b. Freeform path (~line 4411-4419)

Same addition.

### Defensive: still tolerate a stray code fence

Even with `response_format: json_object`, the OpenAI API guarantees JSON-parseable output but the existing regex strip is harmless:

```ts
const raw = completion.choices[0]?.message?.content?.trim() ?? "";
const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/```$/, "");
const parsed = JSON.parse(cleaned);
```

Keep it. Defensive code that doesn't change behaviour when working correctly is fine.

### Confirm

- Existing generate-page tests still pass.
- Add one test that mocks the OpenAI client to return `"Here is your page:\n{...}"` style prose-preamble output. Before this fix: 500. After this fix: with `response_format` set, the mock can return the prose-preamble string but the regex stripper handles it (the real OpenAI call won't produce this anymore, but the mock proves the strip layer is still there).

---

## Step 6 — Tiny but recommended: also wrap the next-tier AI routes

If you have time, apply the Step 2 Sentry wrapping pattern to:
- `routes/lp/ad-copy.ts`
- `routes/lp/copy-generate.ts`
- `routes/lp/seo-analyze.ts`
- `routes/lp/seo-meta-generate.ts`
- `routes/lp/content-brief.ts`
- `routes/lp/extract-guests.ts`
- `routes/lp/proof-points-import.ts`
- `routes/lp/custom-blocks-generate.ts`

These are not launch blockers (they have lower traffic), but the marginal effort is one-line-per-route and improves the post-launch debugging story.

---

## Acceptance criteria

- [ ] All five critical-route catches call `Sentry.captureException` with route + flow tags
- [ ] No PII in `extra` (prompt text hashed, no raw scraped HTML)
- [ ] Templates list query projects only the columns the UI needs
- [ ] `blockCount` is computed via `jsonb_array_length` in SQL
- [ ] New migration creates `lp_pages_tenant_id_idx`, `lp_pages_tenant_template_idx`, `lp_pages_tenant_status_idx` with `IF NOT EXISTS`
- [ ] `response_format: { type: "json_object" }` set on both generate-page call sites
- [ ] `EXPLAIN ANALYZE` on a representative templates query shows index scan
- [ ] Templates gallery network response is KB not MB
- [ ] At least one Sentry-mock test per critical route asserts capture-on-error
- [ ] Existing tests still pass
- [ ] `pnpm typecheck` clean

## Don't

- Don't refactor the routes. This is additive instrumentation + a query projection + an index + a parameter. No behaviour changes.
- Don't reinvent PII scrubbing. `lib/sentry.ts:82-117` handles it for `request`, `user`, and standard fields. Just be careful what you put in `extra` (which is yours).
- Don't add the index inside the application code (some `ensureIndex` call). Use a migration. The migrations directory is the source of truth.
- Don't drop the regex code-fence stripper. It's defensive against a real edge case that may still happen during model misbehaviours.
- Don't change `temperature` in this PR. That's an S1 item — keep this PR scoped.
- Don't capture full prompt text in Sentry `extra`. Hash if you want a correlation key, but launching with prompts in Sentry is a privacy issue.
- Don't apply the Sentry wrap pattern to routes that already handle Sentry correctly (e.g. background jobs in `lib/triggerPublishedRender.ts`, `lib/assetHealthCheck.ts`). They're already good.
