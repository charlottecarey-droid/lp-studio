# Replit prompt — S0: strict-facts pipeline fixes

## What we're solving

Three bugs in the strict-facts wiring that the new review-flow spec (`replit-prompt-strict-facts-review-correct-flow.md`) assumes are working but aren't. Fix these BEFORE shipping the new review flow, otherwise the new flow lands on broken foundations.

### Bug 1 — Edit doesn't promote to library

`routes/lp/fact-flags.ts:142-169` (`/edit` endpoint) writes the new text into the page and updates `normalized_form`, but does NOT insert the new value into `lp_proof_points`.

The new spec contract is explicit: **"Edit always promotes to approved."** Today the UI would have to chain `/edit` then `/save-to-library` to honor that contract, which it almost certainly doesn't. Net effect: user edits a stat, expects it to be saved to brand, it isn't, and next page they generate flags the same number again.

### Bug 2 — matchesApproved substring false-negatives

`lib/factFlags/write.ts:42-43` (and `:51` for claims):
```ts
for (const a of statPool) {
  if (v.includes(a) || a.includes(v)) return true;
}
```

`"5%"` matches `"95%"` as a substring (`"95%".includes("5%") === true`). Real flags silently suppressed because an unrelated approved stat happens to contain the flagged value as a substring. Goes the other way too: `"$1.2M"` "matches" an approved `"$1.2M ARR"` even when the units differ.

### Bug 3 — Telemetry event names don't match the new spec

`lib/factFlags/telemetry.ts:7-18` defines events as `fact_flag_*`. The new spec calls for:
- `strict_facts_review_opened`
- `strict_facts_action`
- `strict_facts_review_dismissed`
- `strict_facts_publish_with_unapproved`

Charlotte's launch dashboards keyed to the new names will be empty. Easy alias.

---

## Step 1 — Audit

Read end-to-end and put a 5-line summary in the PR:

- `artifacts/api-server/src/routes/lp/fact-flags.ts` — all 7 routes (approve, edit, swap, remove, save-to-library, undo, bulk-approve)
- `artifacts/api-server/src/lib/factFlags/write.ts:42-60, 144-205` — matchesApproved + syncFactFlags
- `artifacts/api-server/src/lib/factFlags/telemetry.ts` — existing events
- `artifacts/api-server/src/lib/factFlags/normalize.ts` — to understand what canonicalization is already in play
- `artifacts/api-server/src/routes/lp/factFlags.integration.test.ts` — existing test patterns
- `lib/db/src/schema/lpProofPoints.ts` — proof point shape, required fields
- `lib/db/src/schema/lpPageFactFlags.ts` — flag row shape, triageState enum

---

## Step 2 — Fix `/edit` to promote to library

`routes/lp/fact-flags.ts:142-169`. Today the route:

1. Updates the page block's text at the JSONPath
2. Sets `triageState = 'edited'`, `replacementText = newText`

Add a third action in the same transaction:

3. Insert into `lp_proof_points` with the new text + same `factKind` + same attribution + `addedVia: 'fact_flag_edit'`

```ts
await db.transaction(async (tx) => {
  // 1. Update the block (existing)
  await tx.update(...).where(...);

  // 2. Mark the flag (existing)
  await tx.update(lpPageFactFlagsTable)
    .set({ triageState: 'edited', replacementText: newText, librarySaved: true })
    .where(...);

  // 3. NEW: insert into proof points library
  await tx.insert(lpProofPointsTable).values({
    tenantId,
    factText: newText,
    normalizedForm: normalize(newText),
    factKind: flag.factKind,
    attributionName: flag.attributionName,
    attributionRole: flag.attributionRole,
    attributionCompany: flag.attributionCompany,
    addedVia: 'fact_flag_edit',
    approvedForAi: true,
  });
});
```

Dedupe defensively: if a proof point with the same `normalized_form` + `tenantId` + `factKind` already exists, skip the insert (do NOT throw — the edit should still succeed). Use ON CONFLICT DO NOTHING or a check-then-insert in the transaction.

Emit telemetry event `fact_flag_edit_promoted_to_library` AND the new spec event `strict_facts_action` with `{ action: 'edit', promotedToLibrary: true }`.

### Test

In `factFlags.integration.test.ts`:
- POST `/edit` with a new text value → assert the flag is marked `edited` AND a new row exists in `lp_proof_points` with that text + `addedVia: 'fact_flag_edit'`
- POST `/edit` with a value that already exists in proof points → assert the flag is marked `edited` AND no duplicate row is inserted
- POST `/edit` with bad input (empty string, oversize) → assert it 400s without modifying the block or proof points

---

## Step 3 — Fix `matchesApproved` word-boundary check

`lib/factFlags/write.ts:42-60`. Replace substring matching with normalized-equality matching that uses the existing `normalize.ts` canonicalization.

```ts
function matchesApproved(value: string, pool: Set<string>): boolean {
  const normalizedValue = normalize(value);
  if (pool.has(normalizedValue)) return true;

  // Also check kernel match for percent/plus/k/m/b/x normalization
  const kernel = kernelize(normalizedValue);  // existing helper in normalize.ts
  for (const approved of pool) {
    if (kernelize(normalize(approved)) === kernel) return true;
  }

  return false;
}
```

Where `kernelize` is the existing kernel-extraction from `normalize.ts:23-48` (already canonicalizes "47 percent" / "47%" / "47 %" to the same kernel).

**Important:** the `pool: Set<string>` here should ALREADY contain pre-normalized + pre-kernelized values. Build it once at the top of `syncFactFlags`, not per-fact:

```ts
const statKernelPool = new Set(
  Array.from(rawStatPool).map(s => kernelize(normalize(s)))
);

function matchesApproved(value: string): boolean {
  return statKernelPool.has(kernelize(normalize(value)));
}
```

Apply the same fix to the claims path (`write.ts:51`).

### Test

Add to a new `write.test.ts` (or wherever the existing matchesApproved tests live):
- Approved pool contains `"95%"`, value is `"5%"` → NOT a match (today's bug)
- Approved pool contains `"$1.2M ARR"`, value is `"$1.2M"` → NOT a match (different stat)
- Approved pool contains `"47 percent"`, value is `"47%"` → match (kernel equivalence)
- Approved pool contains `"$1.2M"`, value is `"$1,200,000"` → match if kernelize handles thousand separators; document the behaviour either way
- Approved pool contains `"5"`, value is `"5"` → match (exact)
- Approved pool contains `"95%"`, value is `"95%"` → match (exact)

---

## Step 4 — Add the four new telemetry event aliases

`lib/factFlags/telemetry.ts:7-18` — keep the existing `fact_flag_*` events for backward compat, and ADD the four new ones as aliases. Two emit options:

### Option A — Dual-emit

Wherever `fact_flag_resolved` is emitted today, ALSO emit `strict_facts_action`. Wherever the publish-with-bulk-approve event fires (`pages.ts:771`), ALSO emit `strict_facts_publish_with_unapproved`.

```ts
export function emitFactFlagAction(payload) {
  emit('fact_flag_resolved', payload);  // existing
  emit('strict_facts_action', {          // new alias
    action: payload.triageState,         // approve | edit | swap | remove
    factKind: payload.factKind,
    flagId: payload.id,
    pageId: payload.pageId,
    promotedToLibrary: payload.librarySaved ?? false,
  });
}
```

### Option B — Rename + back-compat

Rename in-place and keep a thin `fact_flag_*` alias for the rollover period. More disruptive, only worth it post-launch.

**For this PR: Option A.**

### New events to wire

| New event | Fires from | Payload |
|---|---|---|
| `strict_facts_review_opened` | Frontend (when the user opens the review modal) | `{ source: "alert" \| "banner" \| "publish_warning", pageId, pendingCount }` |
| `strict_facts_action` | Backend (on /approve, /edit, /swap, /remove) | `{ action, factKind, flagId, pageId, promotedToLibrary }` |
| `strict_facts_review_dismissed` | Frontend (on "Review later") | `{ pageId, pendingCount }` |
| `strict_facts_publish_with_unapproved` | Backend (when publish succeeds with `bulkApproveFactFlags: true`) | `{ pageId, unapprovedCount, flagIds }` |

The two frontend events need their own telemetry call sites — out of scope for this prompt if backend-only. Document them as frontend tasks for the review-flow PR.

### Test

In `telemetry.test.ts` (or wherever telemetry events are asserted):
- Trigger an /edit action → assert BOTH `fact_flag_resolved` AND `strict_facts_action` were emitted with matching IDs
- Trigger publish with bulk-approve → assert BOTH `fact_flag_published_with_bulk_approve` AND `strict_facts_publish_with_unapproved` were emitted

---

## Step 5 — Bonus: rename `bulkApproveFactFlags` bypass key to `acknowledgeUnapprovedFacts`

The new spec wants the publish bypass key renamed. Add the new key as an alias in `routes/lp/pages.ts:957-959`:

```ts
const acknowledged =
  req.body?.acknowledgeUnapprovedFacts === true ||
  req.body?.bulkApproveFactFlags === true;  // back-compat
```

Then update the new spec's review-flow PR to use the new name; back-compat keeps any in-flight client requests working through the rollover.

---

## Acceptance criteria

- [ ] `/edit` route inserts the new value into `lp_proof_points` in the same transaction as the block update
- [ ] Dedupe by `normalized_form` + `tenantId` + `factKind` — no duplicate proof points on edit
- [ ] `matchesApproved` no longer matches `"5%"` against an approved `"95%"`
- [ ] `matchesApproved` uses kernel-based equality from `normalize.ts`
- [ ] Same fix applied to claims path (`write.ts:51`)
- [ ] Approved pool is pre-normalized + pre-kernelized once per `syncFactFlags` call, not per-fact
- [ ] All four `strict_facts_*` telemetry events are emitted (frontend events scoped out; backend events wired)
- [ ] `bulkApproveFactFlags` and `acknowledgeUnapprovedFacts` both work as publish bypass keys
- [ ] New tests cover: edit → library promotion, edit → dedupe, matchesApproved 5%/95% non-match, kernel equality match
- [ ] Existing `factFlags.integration.test.ts` still passes
- [ ] `pnpm typecheck` clean

## Don't

- Don't break the existing `fact_flag_*` events. Dual-emit; don't rename in place.
- Don't change the `triageState` enum values. The new spec uses the same names (`pending` / `approved` / `edited` / `swapped` / `removed`) — leave them alone.
- Don't make `/edit` succeed if the proof-points insert fails. They must be one transaction — either both succeed or both roll back. The edit-without-promotion is the bug.
- Don't introduce a new normalization helper. `normalize.ts:23-48` already does the work — reuse it.
- Don't change `lp_proof_points` schema. Reusing existing columns.
- Don't add the publish bypass rename without back-compat. In-flight client requests with `bulkApproveFactFlags: true` must still work.
- Don't wire the frontend events in this PR. Backend-only — frontend events ride with the review-flow PR.
