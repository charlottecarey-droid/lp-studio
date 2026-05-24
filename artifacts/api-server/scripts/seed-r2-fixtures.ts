/**
 * Seed synthetic HTML fixtures into the per-host R2 bucket so the
 * staging worker's read path can be validated WITHOUT a working
 * prerender pipeline in this dev workspace.
 *
 * Task #364 — the worker's read contract is:
 *   key = `<encodeURIComponent(host)>/<encodeURIComponent(slug)>.html`
 *
 * The staging worker accepts a `X-LP-Host` header (gated on
 * `HOST_OVERRIDE_ENABLED=1` in the staging env, absent from prod) so we
 * can probe with synthetic hosts that don't resolve in DNS. The fixtures
 * here use the same synthetic host names the 7-step gate template
 * references.
 *
 * Three fixtures are written, each with a body that uniquely identifies
 * which case it satisfies:
 *
 *   gate-h1.example.com/gate-single.html
 *     → steps 1-5: R2 tier-1 hit on a single-host tenant.
 *
 *   gate-ha.example.com/gate-isolation.html
 *     → step 6 (host A): same slug, different host, MUST return body A.
 *
 *   gate-hb.example.com/gate-isolation.html
 *     → step 6 (host B): same slug, different host, MUST return body B.
 *     If the worker mixes these up the per-host isolation guarantee
 *     (the whole point of task #364) is broken.
 *
 * What we deliberately do NOT seed:
 *   - `gate-h1.example.com/gate-missing.html` — used in step 7 to verify
 *     R2 tier-1 miss → tier-2 fallback. In staging API_ORIGIN is
 *     192.0.2.1 (TEST-NET-1), so tier-2 will timeout via TIER2_TIMEOUT_MS
 *     after 2.5s. That's the success signal: visitor never hangs >2.5s.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx scripts/seed-r2-fixtures.ts
 *   pnpm --filter @workspace/api-server exec tsx scripts/seed-r2-fixtures.ts --cleanup
 *
 * Re-running is idempotent: PutObject overwrites. --cleanup deletes
 * exactly the keys this script writes so the bucket goes back to its
 * pre-seed state.
 */
import {
  isR2Configured,
  uploadPublishedHtmlToR2,
  deletePublishedHtmlFromR2,
} from "../src/lib/r2Storage";

interface Fixture {
  host: string;
  slug: string;
  body: string;
  gateStep: string;
}

const FIXTURES: Fixture[] = [
  {
    host: "gate-h1.example.com",
    slug: "gate-single",
    gateStep: "steps 1-5 (single-host R2 tier-1 hit)",
    body: html("gate-single", "gate-h1.example.com", "SINGLE-HOST-FIXTURE"),
  },
  {
    host: "gate-ha.example.com",
    slug: "gate-isolation",
    gateStep: "step 6 (per-host isolation — host A)",
    body: html("gate-isolation", "gate-ha.example.com", "ISOLATION-A"),
  },
  {
    host: "gate-hb.example.com",
    slug: "gate-isolation",
    gateStep: "step 6 (per-host isolation — host B)",
    body: html("gate-isolation", "gate-hb.example.com", "ISOLATION-B"),
  },
];

// A real page would carry the meta-injected SEO tags. We don't go through
// `injectPageMeta` here because (a) the worker doesn't care about meta —
// it just streams the bytes — and (b) keeping the fixture HTML minimal
// makes it trivial to eyeball whether a `curl` returned the right body.
function html(slug: string, host: string, marker: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>gate fixture: ${slug} @ ${host}</title>
  <meta name="x-lp-gate-marker" content="${marker}" />
</head>
<body>
  <h1>${marker}</h1>
  <p>This is a synthetic R2 fixture for task #364 gate validation.</p>
  <p>Slug: <code>${slug}</code></p>
  <p>Host: <code>${host}</code></p>
  <!-- Marker for curl/grep assertions: ${marker} -->
</body>
</html>
`;
}

async function seed() {
  console.error(`[seed-r2] writing ${FIXTURES.length} fixtures...`);
  for (const f of FIXTURES) {
    const t0 = Date.now();
    await uploadPublishedHtmlToR2(f.host, f.slug, f.body, { tenantId: 0 });
    console.error(
      `[seed-r2]   ✓ ${f.host}/${f.slug}.html (${f.body.length}B, ${Date.now() - t0}ms) — ${f.gateStep}`,
    );
  }
  console.error(`[seed-r2] done. Run list-r2-objects.ts --decoded to verify.`);
}

async function cleanup() {
  console.error(`[seed-r2] cleanup: deleting ${FIXTURES.length} fixtures...`);
  for (const f of FIXTURES) {
    try {
      await deletePublishedHtmlFromR2(f.host, f.slug);
      console.error(`[seed-r2]   ✓ deleted ${f.host}/${f.slug}.html`);
    } catch (err) {
      console.error(
        `[seed-r2]   ✗ delete failed ${f.host}/${f.slug}.html: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  console.error(`[seed-r2] cleanup done.`);
}

async function main() {
  if (!isR2Configured()) {
    console.error(
      "[seed-r2] R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.",
    );
    process.exit(1);
  }
  const mode = process.argv.includes("--cleanup") ? "cleanup" : "seed";
  if (mode === "cleanup") await cleanup();
  else await seed();
}

main().catch((err) => {
  console.error("[seed-r2] fatal:", err);
  process.exit(2);
});
