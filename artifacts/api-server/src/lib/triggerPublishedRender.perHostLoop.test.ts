/**
 * Integration test for task #364's per-host R2 write loop.
 *
 * The dev workspace's prerender pipeline hangs in headless Chromium
 * (separate pre-existing issue — see follow-up filed in PR notes), so
 * we can't validate the full publish path end-to-end here. This test
 * fills that gap by mocking ONLY `prerenderLpPage` and exercising
 * `renderAndStoreNow` against the REAL database + REAL tenantHosts
 * cache. It proves the contract that matters for visitor-facing
 * correctness:
 *
 *   For an N-host tenant, ONE publish triggers exactly N R2 PUTs —
 *   one per host returned by `getActiveHostsForTenant` — and EXACTLY
 *   ONE OS write (keyed by the primary host).
 *
 * What this test does NOT prove (and why that's fine):
 *
 *   - The HTML bytes are actually renderable by a browser. That's
 *     `prerenderLpPage`'s job; we mock it.
 *   - R2 transport works. Round-trip is covered by the dedicated R2
 *     storage test.
 *   - The worker reads what api-server wrote. That's the staging gate.
 *
 * No-candidate behavior: hard-fail with an actionable message. Earlier
 * iterations soft-skipped on empty DBs to keep CI green on fresh
 * bootstraps, but architect flagged that as masking real regressions
 * (an empty DB silently turns the test into a no-op). The contract is
 * now: any environment that runs this test MUST have at least one
 * published page on a ≥2-host tenant, or the test fails loudly. Seed
 * data or skip the file at the runner level if your env can't satisfy
 * that.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { db, lpPagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getActiveHostsForTenant } from "./tenantHosts";

// ── Mocks ────────────────────────────────────────────────────────────
// Must be declared BEFORE importing the SUT — vi.mock is hoisted by
// vitest so the SUT's import of these modules resolves to the mocks.

const SYNTHETIC_HTML =
  '<!DOCTYPE html><html><head><title>fixture</title></head><body><div id="root"><p>fixture</p></div></body></html>';

vi.mock("./prerenderLpPage", () => ({
  prerenderLpPage: vi.fn(async () => SYNTHETIC_HTML),
}));

const r2PutCalls: Array<{ host: string; slug: string; html: string }> = [];
vi.mock("./r2Storage", async (importOriginal) => {
  // Keep `isR2Configured` real-ish (true) so the SUT enters the R2
  // branch, but stub the I/O.
  const actual = await importOriginal<typeof import("./r2Storage")>();
  return {
    ...actual,
    isR2Configured: vi.fn(() => true),
    uploadPublishedHtmlToR2: vi.fn(async (host: string, slug: string, html: string) => {
      r2PutCalls.push({ host, slug, html });
    }),
    deletePublishedHtmlFromR2: vi.fn(async () => {}),
  };
});

const osPutCalls: Array<{ tenantId: number; slug: string; html: string }> = [];
vi.mock("./publishedHtmlStorage", () => ({
  uploadPublishedHtml: vi.fn(async (tenantId: number, slug: string, html: string) => {
    osPutCalls.push({ tenantId, slug, html });
  }),
  deletePublishedHtml: vi.fn(async () => {}),
}));

// Imported AFTER vi.mock so the mocks take effect.
const { renderAndStoreNow } = await import("./triggerPublishedRender");

// ── Fixture discovery ────────────────────────────────────────────────
// Pick a real published page whose tenant has ≥2 active hosts. The
// WILDCARD_BASE_HOSTS default ("lpstudio.ai,app.lpstudio.ai") means any
// active tenant with a non-null slug already has ≥2 hosts via wildcard
// expansion, so qualifying tenants should be abundant in any DB that
// has ever held a published page.

interface Candidate {
  pageId: number;
  tenantId: number;
  slug: string;
  hosts: string[];
}

async function findCandidate(): Promise<Candidate | null> {
  const rows = await db
    .select({ id: lpPagesTable.id, tenantId: lpPagesTable.tenantId, slug: lpPagesTable.slug })
    .from(lpPagesTable)
    .where(eq(lpPagesTable.status, "published"))
    .limit(50);
  for (const r of rows) {
    const hosts = await getActiveHostsForTenant(r.tenantId);
    if (hosts.length >= 2) {
      return { pageId: r.id, tenantId: r.tenantId, slug: r.slug, hosts };
    }
  }
  return null;
}

describe("triggerPublishedRender — per-host write loop (task #364)", () => {
  let candidate: Candidate;

  beforeAll(async () => {
    const found = await findCandidate();
    if (!found) {
      // Loud, actionable failure — see file header comment for rationale.
      throw new Error(
        "[per-host-loop test] no qualifying fixture in DB: need at least one " +
          "published lp_pages row whose tenant has ≥2 active hosts " +
          "(domain/microsite_domain/wildcard expansion via getActiveHostsForTenant). " +
          "Seed one before running this test, or exclude this file in CI configs " +
          "that don't have published-page data.",
      );
    }
    candidate = found;
    console.error(
      `[per-host-loop test] using pageId=${candidate.pageId} tenantId=${candidate.tenantId} ` +
        `slug=${candidate.slug} hosts=${JSON.stringify(candidate.hosts)}`,
    );
  });

  it("writes exactly N R2 PUTs for an N-host tenant + 1 OS PUT keyed by primary host", async () => {
    r2PutCalls.length = 0;
    osPutCalls.length = 0;

    const outcome = await renderAndStoreNow({ pageId: candidate.pageId, requestHost: null });

    // ── Outcome shape ──
    expect(outcome.skipped, `skipped=${outcome.skipped} error=${outcome.error}`).toBeUndefined();
    expect(outcome.r2Ok).toBe(true);
    expect(outcome.osOk).toBe(true);

    // ── R2: one PUT per active host, in priority order ──
    expect(r2PutCalls).toHaveLength(candidate.hosts.length);
    expect(r2PutCalls.map((c) => c.host)).toEqual(candidate.hosts);
    for (const call of r2PutCalls) {
      expect(call.slug).toBe(candidate.slug);
      // Body should at least contain a <title> (injectPageMeta ran) and
      // a host-specific canonical link (per-host meta injection).
      expect(call.html).toContain("<title>");
      expect(call.html).toContain(`https://${call.host}/${candidate.slug}`);
    }
    // Per-host body uniqueness: the canonical URL differs per host, so
    // no two PUTs may have byte-identical bodies. This is the test that
    // would catch a regression where someone "optimized" the loop to
    // upload the same buffer N times.
    const bodies = new Set(r2PutCalls.map((c) => c.html));
    expect(bodies.size).toBe(candidate.hosts.length);

    // ── OS: exactly one write, keyed by tenantId, body matches primary host ──
    expect(osPutCalls).toHaveLength(1);
    expect(osPutCalls[0].tenantId).toBe(candidate.tenantId);
    expect(osPutCalls[0].slug).toBe(candidate.slug);
    expect(osPutCalls[0].html).toBe(r2PutCalls[0].html);
  }, 30_000);

  it("R2 write failure short-circuits the loop and skips OS", async () => {
    // findCandidate enforces ≥2 hosts so this check is defensive only.
    expect(candidate.hosts.length).toBeGreaterThanOrEqual(2);
    r2PutCalls.length = 0;
    osPutCalls.length = 0;

    // Make the SECOND host throw. The first must still write; the third
    // (if any) must NOT be attempted; OS must NOT be written.
    const r2 = await import("./r2Storage");
    const upload = r2.uploadPublishedHtmlToR2 as unknown as ReturnType<typeof vi.fn>;
    upload.mockImplementationOnce(async (host: string, slug: string, html: string) => {
      r2PutCalls.push({ host, slug, html });
    });
    upload.mockImplementationOnce(async () => {
      throw new Error("synthetic R2 outage on host 2");
    });
    // Track every call to upload so we can prove the loop stopped at
    // host 2 (architect feedback: assert second host was attempted +
    // failed, not just that we ended up with 1 successful PUT).
    const totalUploadCallsBefore = upload.mock.calls.length;

    const outcome = await renderAndStoreNow({ pageId: candidate.pageId, requestHost: null });

    expect(outcome.skipped).toBe("r2_write_failed");
    expect(outcome.r2Ok).toBe(false);
    expect(outcome.osOk).toBe(false);
    // First host wrote successfully; loop broke on the second; nothing past it.
    expect(r2PutCalls).toHaveLength(1);
    expect(r2PutCalls[0].host).toBe(candidate.hosts[0]);
    // Loop MUST have attempted exactly 2 uploads (host 1 success, host 2
    // throw). If a regression removed the loop and only host 1 was tried,
    // this catches it. If a regression continued past the failure, the
    // count would exceed 2.
    const newUploadCalls = upload.mock.calls.length - totalUploadCallsBefore;
    expect(newUploadCalls).toBe(2);
    // The second upload call's host arg must equal hosts[1] — proves the
    // loop iterated in priority order (not e.g. skipped a host).
    const secondCall = upload.mock.calls[totalUploadCallsBefore + 1];
    expect(secondCall[0]).toBe(candidate.hosts[1]);
    // OS write must NOT have fired — preserves the "OS never newer than R2" invariant.
    expect(osPutCalls).toHaveLength(0);
    // outcome.error encodes which host failed — operators rely on this
    // for triage. Regression catch: don't strip it from the error format.
    expect(outcome.error).toContain(`host=${candidate.hosts[1]}`);
  }, 30_000);
});
