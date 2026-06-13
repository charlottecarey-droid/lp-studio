# Replit prompt — S0: brand-import critical fixes

## What we're solving

Three independent bugs in the brand-import system that will produce visibly-broken or rate-limit-storming brand imports during Product Hunt traffic:

### Bug 1 — openai-semaphore under-counts and bursts past the concurrency cap

`artifacts/api-server/src/lib/brand-import/openai-semaphore.ts:32-41` — `release()` hands a slot to the next waiter **without** incrementing `inFlight`, and `acquire()` for waiters never increments either. The fast-path `acquire()` at `:25` does increment, but the waiter path doesn't.

Net effect: under enough queueing, `inFlight` drifts low (each release decrements, each waiter dequeue doesn't increment) and the actual concurrency bursts past `MAX_CONCURRENT=3`. That's exactly the proxy 429 storm the file exists to prevent. On Product Hunt traffic, this is the path to "everyone gets brand-import errors at the same time."

### Bug 2 — Logo fallback persists a baked-image social card as the brand logo

`artifacts/api-server/src/lib/brand-import/extractors/logos.ts:181-186, 250-258, 320-328`. When no header/footer/svg-alt/Playwright candidate exists (Stripe/Notion/Vercel-style inline-SVG sites where the Playwright spawn fails), the candidate ranker falls to `og` at rank 40. og:images are commonly 1200×630 hero renders with the headline baked into the image. We persist them as `defaultLogoUrl` with `confidence: "medium"`, and `flattenForProposed` pre-checks medium-confidence — so the headline-baked social card becomes the brand's "logo" on every generated page.

### Bug 3 — Playwright worker path is fragile to cwd

`artifacts/api-server/src/lib/brand-import/extractors/logos.ts:33-37` resolves the worker via `path.resolve(process.cwd(), "scripts", "playwright-logo-worker.ts")`. If the api-server is started from a different cwd in production (systemd, monorepo runner, container with non-default WORKDIR), every Stripe/Anthropic/Vercel-style site falls through to the favicon/og branch above. Bug 3 makes Bug 2 fire more often.

---

## Step 1 — Audit

Read end-to-end and put a 5-line summary in the PR:

- `artifacts/api-server/src/lib/brand-import/openai-semaphore.ts` (full file, ~50 lines) — pay attention to who increments `inFlight`
- `artifacts/api-server/src/lib/brand-import/extractors/logos.ts:33-90` — Playwright worker spawn + cwd resolution
- `artifacts/api-server/src/lib/brand-import/extractors/logos.ts:150-340` — candidate ranking, `og` rank, fallback chain
- `artifacts/api-server/src/lib/brand-import/orchestrator.ts:554-568` — `flattenForProposed` confidence pre-check
- `artifacts/api-server/src/lib/brand-import/types.ts` — `LogoCandidate` shape + confidence levels
- `scripts/playwright-logo-worker.ts` — the worker script being spawned (just to confirm the file path + interface)

---

## Step 2 — Fix openai-semaphore counting

The intent (per the existing comment) is that waiters get their `inFlight` slot reserved when they enter the queue, not when they dequeue. But that's not what the code does — `inFlight` is only incremented in the fast-path `acquire()`. Fix the contract:

### Option A (preferred) — increment on dequeue

Make `release()` increment when handing off, and `acquire()` not increment for the waiter path (because `release()` already did it):

```ts
class OpenAISemaphore {
  private inFlight = 0;
  private waiters: Array<() => void> = [];
  private readonly max: number;

  constructor(max: number) { this.max = max; }

  async acquire(): Promise<void> {
    if (this.inFlight < this.max) {
      this.inFlight++;
      return;
    }
    // Queue and wait. inFlight will be incremented by the releaser on hand-off.
    await new Promise<void>(resolve => this.waiters.push(resolve));
  }

  release(): void {
    const next = this.waiters.shift();
    if (next) {
      // Hand the slot to the waiter. Net inFlight stays the same.
      next();
      return;
    }
    this.inFlight = Math.max(0, this.inFlight - 1);
  }
}
```

Key invariants:
- `inFlight` is incremented exactly once per `acquire()` that returns
- `release()` either decrements `inFlight` OR hands off to a waiter (never both)
- `inFlight` never exceeds `max`

### Option B — increment on enqueue

Increment `inFlight` when the waiter is added to the queue, and don't increment in `release()`. Equivalent invariants, different bookkeeping spot. Pick whichever reads more clearly to you.

### Test (matters — this is a concurrency bug)

Add `openai-semaphore.test.ts`:

```ts
test("never exceeds max concurrency under burst", async () => {
  const sem = new OpenAISemaphore(3);
  let inFlight = 0;
  let peakInFlight = 0;
  const tasks = Array.from({ length: 50 }, async () => {
    await sem.acquire();
    inFlight++;
    peakInFlight = Math.max(peakInFlight, inFlight);
    await sleep(5 + Math.random() * 20);
    inFlight--;
    sem.release();
  });
  await Promise.all(tasks);
  expect(peakInFlight).toBeLessThanOrEqual(3);
});

test("release() drains all waiters", async () => {
  const sem = new OpenAISemaphore(1);
  await sem.acquire();
  const acquired: number[] = [];
  const p1 = sem.acquire().then(() => acquired.push(1));
  const p2 = sem.acquire().then(() => acquired.push(2));
  sem.release();
  await new Promise(r => setTimeout(r, 0));
  expect(acquired).toEqual([1]);
  sem.release();
  await p2;
  expect(acquired).toEqual([1, 2]);
});

test("release with no waiters decrements inFlight", async () => {
  const sem = new OpenAISemaphore(2);
  await sem.acquire();
  await sem.acquire();
  sem.release();
  // Should be able to acquire immediately
  const start = Date.now();
  await sem.acquire();
  expect(Date.now() - start).toBeLessThan(10);
});
```

Run the burst test 100x in CI (or use a `for` loop in the test) to flush out timing-dependent regressions.

---

## Step 3 — Fix logo og fallback ranking

Two changes:

### 3a. Downgrade `og` below `apple-touch-icon` when a favicon exists

In the candidate ranker at `logos.ts:150-340`, when at least one favicon or apple-touch-icon candidate is present, set `og`'s rank below them. The current ranks put `og` at 40 — drop it to 25 in the presence of any icon-shaped candidate.

```ts
function rankCandidates(candidates: LogoCandidate[]): LogoCandidate[] {
  const hasIconCandidate = candidates.some(c =>
    c.source === "favicon" || c.source === "apple-touch-icon"
  );

  return candidates.map(c => {
    if (c.source === "og" && hasIconCandidate) {
      return { ...c, rank: 25, confidence: "low" };  // downgrade
    }
    return c;
  });
}
```

### 3b. Detect headline-baked social cards

og:images that are 1200×630 (or any landscape > 2:1 aspect) almost always contain headline text overlaid on a background. Reject them as logo candidates regardless of rank:

```ts
function isLikelySocialCard(candidate: LogoCandidate): boolean {
  if (candidate.source !== "og") return false;
  const { width, height } = candidate.dimensions ?? {};
  if (!width || !height) return false;
  const aspectRatio = width / height;
  return aspectRatio > 1.6 && width >= 800;  // 1200x630 = 1.9 ratio
}

// In the picker:
const filtered = candidates.filter(c => !isLikelySocialCard(c));
```

If filtering leaves zero candidates, fall back to the unfiltered set BUT mark the chosen logo `confidence: "low"` so `flattenForProposed` (`orchestrator.ts:554-568`) won't pre-check it.

### 3c. Verify `flattenForProposed` behaviour

Confirm `flattenForProposed` at `orchestrator.ts:554-568` only auto-applies logos at `confidence: "medium"` or higher. If it does pre-check `low` confidence, change it to `medium` minimum. (The review noted this is already medium-checked; verify and move on.)

### Tests

In `extractors/logos.test.ts` (or new):
- Candidate set with `[favicon, og]` → favicon picked
- Candidate set with `[og]` only and og is 1200×630 → returns with `confidence: "low"` so it won't auto-apply
- Candidate set with `[og]` only and og is 200×200 (square, likely a logo) → returns at normal rank
- Candidate set with `[header-logo, og]` → header-logo picked (existing behaviour, just confirm)

---

## Step 4 — Fix Playwright worker path resolution

`logos.ts:33-37` — replace `process.cwd()` with `import.meta.url` resolution.

```ts
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
// Walk up from src/lib/brand-import/extractors to the api-server root,
// then into scripts/.
const WORKER_PATH = path.resolve(moduleDir, "..", "..", "..", "..", "scripts", "playwright-logo-worker.ts");
```

Verify the relative path resolves correctly:
- `src/lib/brand-import/extractors/logos.ts` → 4 levels up = `src/` ❌
- The worker is at `scripts/playwright-logo-worker.ts` relative to the api-server root

Likely correct walk:
- From `<api-server>/src/lib/brand-import/extractors/` up 4 levels = `<api-server>/`
- Then down into `scripts/playwright-logo-worker.ts`

```ts
const WORKER_PATH = path.resolve(moduleDir, "../../../../scripts/playwright-logo-worker.ts");
```

### Defensive: if the worker file doesn't exist, fail fast

Add a startup check that the resolved path actually exists, and log a clear error if not:

```ts
import * as fs from "node:fs";

let workerPathChecked = false;
function ensureWorkerExists(): void {
  if (workerPathChecked) return;
  workerPathChecked = true;
  if (!fs.existsSync(WORKER_PATH)) {
    logger.error({ workerPath: WORKER_PATH, cwd: process.cwd() },
      "playwright_worker_missing — inline-SVG logo extraction will be unavailable");
  }
}
```

Call `ensureWorkerExists()` once on the first spawn attempt. Don't throw — falling through to the og/favicon branch is already handled gracefully — but log loudly so ops sees the misconfiguration.

### Tests

- Smoke test: import the module, call the function that uses `WORKER_PATH`, assert no `MODULE_NOT_FOUND` or `ENOENT` error.
- If you can mock `import.meta.url` (Vitest supports this), assert the resolved path is stable across different `process.cwd()` values.

---

## Acceptance criteria

- [ ] `OpenAISemaphore` never exceeds `max` concurrency under burst (50-task burst test passes 100x)
- [ ] `release()` correctly hands off to waiters without double-counting or losing slots
- [ ] `acquire()` increments `inFlight` exactly once per resolved promise
- [ ] og logo candidates are downgraded when any favicon/apple-touch-icon exists
- [ ] og candidates with landscape > 1.6 aspect ratio + width >= 800 are detected as social cards and downgraded to `confidence: "low"`
- [ ] `flattenForProposed` does not auto-apply `low`-confidence logos
- [ ] Playwright worker path resolves via `import.meta.url`, not `process.cwd()`
- [ ] Startup warning emitted if the worker file doesn't exist at the resolved path
- [ ] New tests cover the burst, drain, decrement, social-card detection, and worker-path resolution
- [ ] Existing `extractors/photography.pickimages.test.ts` and `colors.test.ts` still pass
- [ ] `pnpm typecheck` clean

## Don't

- Don't loosen the semaphore's `max` to "fix" the burst. The whole point of `MAX_CONCURRENT=3` is to stay under the AI proxy's rate limit.
- Don't add retry logic to compensate for the semaphore bug. The fix is the counting fix; retries paper over the symptom.
- Don't reject all og logos — square og:image variants (200×200, 400×400) are sometimes legitimate logos. The aspect-ratio + width heuristic is what separates social cards from logos.
- Don't throw if the Playwright worker is missing. Inline-SVG-only sites already fall through gracefully to the og/favicon branch; throw breaks the import entirely.
- Don't move the worker file. Keep it at `scripts/playwright-logo-worker.ts`; just fix the path resolution.
- Don't introduce a new semaphore library. The existing implementation is correct in shape, just buggy in counting. Fix in place.
- Don't change the `MAX_CONCURRENT` value. If you want to tune it post-launch, that's a separate PR with telemetry to back it up.
