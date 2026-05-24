/**
 * List every object in the dandy-lp-prerendered R2 bucket.
 *
 * Permanent debugging / inventory helper for the per-host prerender
 * pipeline (task #364). The wrangler CLI doesn't have a built-in
 * object-list command in v4.x — only `bucket list` (which lists
 * buckets, not contents) — so this script fills the gap using the
 * existing S3 client in src/lib/r2Storage.ts.
 *
 * Usage:
 *   pnpm tsx artifacts/api-server/scripts/list-r2-objects.ts
 *   pnpm tsx artifacts/api-server/scripts/list-r2-objects.ts --prefix lp.meetdandy.com/
 *   pnpm tsx artifacts/api-server/scripts/list-r2-objects.ts --decoded
 *   pnpm tsx artifacts/api-server/scripts/list-r2-objects.ts --json
 *
 * Default output: one key per line (raw, URL-encoded as stored in R2).
 *   --prefix <p>  Server-side prefix filter. Already-encoded; if you
 *                 want to filter by a literal host, pass
 *                 `$(node -e 'console.log(encodeURIComponent("lp.meetdandy.com"))')/`.
 *   --decoded     Print "<host>\t<slug>\t<size>\t<lastModified>" instead
 *                 of raw keys. Useful for humans; lossy for round-tripping.
 *   --json        One JSON object per line: {key, host, slug, size, lastModified}.
 *                 Useful for piping into jq.
 *
 * Exit codes:
 *   0  listing succeeded (including empty bucket)
 *   1  R2 not configured (missing env vars)
 *   2  unexpected error
 */
import { listR2Objects, isR2Configured } from "../src/lib/r2Storage";

interface Args {
  prefix?: string;
  decoded: boolean;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { decoded: false, json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--prefix") {
      const v = argv[++i];
      if (!v) {
        console.error("--prefix requires a value");
        process.exit(2);
      }
      out.prefix = v;
    } else if (a === "--decoded") {
      out.decoded = true;
    } else if (a === "--json") {
      out.json = true;
    } else if (a === "--help" || a === "-h") {
      console.error(
        "Usage: pnpm tsx artifacts/api-server/scripts/list-r2-objects.ts [--prefix <p>] [--decoded|--json]",
      );
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    }
  }
  if (out.decoded && out.json) {
    console.error("--decoded and --json are mutually exclusive");
    process.exit(2);
  }
  return out;
}

// Keys are `<encodeURIComponent(host)>/<encodeURIComponent(slug)>.html`.
// Split on the FIRST `/` so a stray `/` inside the encoded slug (e.g.
// `%2F`) can't trick the split. `.html` suffix is stripped from the slug.
function splitKey(key: string): { host: string; slug: string } | null {
  const slash = key.indexOf("/");
  if (slash <= 0) return null;
  const encodedHost = key.slice(0, slash);
  const rest = key.slice(slash + 1);
  if (!rest.endsWith(".html")) return null;
  const encodedSlug = rest.slice(0, -".html".length);
  try {
    return {
      host: decodeURIComponent(encodedHost),
      slug: decodeURIComponent(encodedSlug),
    };
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!isR2Configured()) {
    console.error(
      "[list-r2] R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.",
    );
    process.exit(1);
  }
  const items = await listR2Objects(args.prefix);
  if (items === null) {
    // Shouldn't reach: isR2Configured() guarded above, but be paranoid.
    console.error("[list-r2] listR2Objects returned null despite configured env");
    process.exit(2);
  }
  for (const it of items) {
    if (args.json) {
      const parts = splitKey(it.key);
      process.stdout.write(
        JSON.stringify({
          key: it.key,
          host: parts?.host ?? null,
          slug: parts?.slug ?? null,
          size: it.size,
          lastModified: it.lastModified?.toISOString() ?? null,
        }) + "\n",
      );
    } else if (args.decoded) {
      const parts = splitKey(it.key);
      const host = parts?.host ?? "?";
      const slug = parts?.slug ?? "?";
      const ts = it.lastModified?.toISOString() ?? "-";
      process.stdout.write(`${host}\t${slug}\t${it.size}\t${ts}\n`);
    } else {
      process.stdout.write(`${it.key}\n`);
    }
  }
  console.error(`[list-r2] ${items.length} object(s)${args.prefix ? ` under prefix "${args.prefix}"` : ""}`);
}

main().catch((err) => {
  console.error("[list-r2] fatal:", err);
  process.exit(2);
});
