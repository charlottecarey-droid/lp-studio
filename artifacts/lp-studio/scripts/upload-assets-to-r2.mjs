#!/usr/bin/env node
/**
 * Build-time R2 asset uploader (task #374).
 *
 * Walks `artifacts/lp-studio/dist/public/assets/*` after `vite build` and
 * uploads each file to the shared R2 bucket (`R2_BUCKET`) under the
 * prefix `_studio-assets/assets/<filename>`.
 *
 * WHY THIS EXISTS — read before touching:
 *
 *   Published landing pages are prerendered once and stored in R2 as
 *   HTML. That HTML hard-codes Vite-hashed asset paths like
 *   `/assets/index-7cf3aa11.js`. When lp-studio is redeployed the hashes
 *   change; the prerendered HTML now references files that no longer
 *   exist on the Replit static origin → browsers receive `index.html`
 *   for those JS requests → page is broken. (Replit's SPA rewrite
 *   `/* → /index.html` returns text/html for any unmatched path.)
 *
 *   This script + the CF worker's /assets handler (worker.js) make assets
 *   immutable: every hashed filename ever published is preserved in R2
 *   forever (until the GC job in `artifacts/api-server/src/lib/assetsGc.ts`
 *   removes >30d-old unreferenced ones). Old prerendered HTML keeps
 *   working across deploys because the Worker serves the old hashed asset
 *   from R2 even when the origin no longer has it.
 *
 * Properties:
 *   - Idempotent: HEAD-before-PUT skips existing keys. Safe to re-run.
 *   - Additive only: never deletes from R2. (Deletion is the GC job's
 *     job and uses cross-referenced retention rules.)
 *   - Silent skip when R2 env vars are missing — local builds, CI without
 *     R2 creds, and the agent's `pnpm build` typecheck path all work.
 *   - Non-fatal on individual upload failure: logs and continues. The
 *     publish-time presence check (T050) is the actual gate.
 *
 * Run via: `pnpm --filter @workspace/lp-studio build` (chained in
 * package.json after `vite build` + `prerender-marketing.mjs`).
 */
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
  NotFound,
} from "@aws-sdk/client-s3";
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = resolve(__dirname, "..", "dist", "public", "assets");
const R2_PREFIX = "_studio-assets/assets/";

// Tiny mime map keyed on the extensions Vite actually emits. Kept inline
// to avoid pulling `mime-types` into lp-studio's dep tree. If Vite starts
// emitting something not listed here, fall back to application/octet-stream
// and log — the Worker also has a matching map and would do the same.
const MIME = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

function mimeFor(filename) {
  const ext = extname(filename).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return { client, bucket };
}

async function existsInR2(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    if (err instanceof NotFound) return false;
    if (err && typeof err === "object" && err.name) {
      const n = err.name;
      if (n === "NotFound" || n === "NoSuchKey") return false;
      // R2 returns 404 with various error shapes depending on SDK version.
      // Treat any 404 as "doesn't exist"; surface anything else.
      if (err.$metadata?.httpStatusCode === 404) return false;
    }
    throw err;
  }
}

async function walk(dir) {
  // Vite outputs flat dist/public/assets/* in default config, but recurse
  // anyway so a future config change (per-route chunks in subdirs) doesn't
  // silently drop files.
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const cfg = getR2Config();
  if (!cfg) {
    console.log("[lp-studio:upload-assets-to-r2] R2 env vars not set — skipping (local/CI build).");
    return;
  }
  if (!existsSync(ASSETS_DIR)) {
    console.log(`[lp-studio:upload-assets-to-r2] no assets dir at ${ASSETS_DIR} — skipping (build did not produce assets).`);
    return;
  }
  const files = await walk(ASSETS_DIR);
  if (files.length === 0) {
    console.log("[lp-studio:upload-assets-to-r2] 0 files in assets dir — nothing to upload.");
    return;
  }

  // Modest concurrency. R2 is fast and tolerant; 8 in-flight uploads keeps
  // bandwidth saturated without overwhelming the build container (which is
  // already running Playwright for the prerender step).
  const CONCURRENCY = 8;
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  const queue = [...files];
  const worker = async () => {
    while (queue.length > 0) {
      const full = queue.shift();
      if (!full) return;
      const rel = full.slice(ASSETS_DIR.length + 1).replace(/\\/g, "/");
      const key = `${R2_PREFIX}${rel}`;
      try {
        if (await existsInR2(cfg.client, cfg.bucket, key)) {
          skipped++;
          continue;
        }
        const body = await readFile(full);
        const st = await stat(full);
        await cfg.client.send(
          new PutObjectCommand({
            Bucket: cfg.bucket,
            Key: key,
            Body: body,
            ContentType: mimeFor(basename(full)),
            // Vite-hashed assets are content-addressed. Immutable + 1 year
            // matches the standard SPA-asset cache policy and lets the
            // Worker / browsers cache aggressively without revalidation.
            CacheControl: "public, max-age=31536000, immutable",
            Metadata: {
              "uploaded-at": new Date().toISOString(),
              "source-size": String(st.size),
            },
          })
        );
        uploaded++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ key, err: msg });
        console.warn(`[lp-studio:upload-assets-to-r2] upload failed: ${key} :: ${msg}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(
    `[lp-studio:upload-assets-to-r2] done. total=${files.length} uploaded=${uploaded} skipped=${skipped} failed=${failed}`
  );
  if (failed > 0) {
    // Non-fatal: the publish-time presence check (T050) is the actual gate.
    // We still log loudly and exit 0 so a transient R2 hiccup doesn't fail
    // the deploy — the next build will retry the skipped files.
    console.warn(`[lp-studio:upload-assets-to-r2] ${failed} uploads failed (non-fatal):`, errors.slice(0, 5));
  }

  // Upload the tenant shell (`dist/public/tenant-shell.html`, produced by
  // scripts/prerender-marketing.mjs) to R2 under
  // `_studio-assets/tenant-shell.html`. The CF tenant-host-router worker
  // serves this on SPA HTML routes for tenant hosts so visitors see the
  // pre-mount loader instead of a marketing flash before React boots.
  //
  // Unlike the hashed assets above, the shell is OVERWRITTEN every deploy
  // (it embeds the current build's hashed asset URLs) and is NOT
  // immutable. Order matters: assets first (so the new hashes exist in
  // R2), then the shell that references them.
  const TENANT_SHELL_PATH = resolve(__dirname, "..", "dist", "public", "tenant-shell.html");
  const TENANT_SHELL_KEY = "_studio-assets/tenant-shell.html";
  if (existsSync(TENANT_SHELL_PATH)) {
    try {
      const body = await readFile(TENANT_SHELL_PATH);
      await cfg.client.send(
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: TENANT_SHELL_KEY,
          Body: body,
          ContentType: "text/html; charset=utf-8",
          // Short TTL — a stale shell would reference deleted asset
          // hashes. The worker also adds a `must-revalidate` Cache-Control
          // when serving, but the upstream cache hint matters for CF's
          // own edge cache.
          CacheControl: "public, max-age=60, must-revalidate",
          Metadata: { "uploaded-at": new Date().toISOString() },
        }),
      );
      console.log(`[lp-studio:upload-assets-to-r2] uploaded tenant shell → ${TENANT_SHELL_KEY} (${body.length} bytes)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[lp-studio:upload-assets-to-r2] tenant shell upload failed (non-fatal): ${msg}`);
    }
  } else {
    console.warn(`[lp-studio:upload-assets-to-r2] no tenant shell at ${TENANT_SHELL_PATH} — skipping (prerender step likely did not run).`);
  }

  // ── Marketing per-route prerendered HTML (multi-page SEO) ───────────
  // prerender-marketing.mjs writes one index.html per marketing route into
  // dist/public (/, /for-marketing, /pricing, /blog/<slug>, …), each with its
  // OWN <title>, meta description and canonical. Replit's static SPA origin
  // rewrites every path to the ROOT index.html, so unless the edge serves
  // these per-route, every marketing page returns the homepage HTML to
  // crawlers (identical title/canonical everywhere). Upload each to
  // `_studio-marketing/<relpath>`; the CF tenant-host-router worker serves
  // them for lpstudio.ai / www on a per-route basis (worker.js Tier 0.5).
  //
  // Unlike the hashed assets above these are OVERWRITTEN every deploy (same
  // path, new content) — so NO existsInR2 skip; always PUT. Runs after the
  // asset upload so the hashed URLs embedded in the HTML already exist in R2.
  const PUBLIC_DIR = resolve(__dirname, "..", "dist", "public");
  const MARKETING_PREFIX = "_studio-marketing/";
  try {
    const publicFiles = await walk(PUBLIC_DIR);
    // Each prerendered route is a directory containing index.html (the home
    // route is dist/public/index.html). tenant-shell.html and the hashed
    // assets are excluded by the basename filter.
    const htmlPages = publicFiles.filter((f) => basename(f) === "index.html");
    let mUploaded = 0;
    let mFailed = 0;
    for (const full of htmlPages) {
      const rel = full.slice(PUBLIC_DIR.length + 1).replace(/\\/g, "/");
      const key = `${MARKETING_PREFIX}${rel}`;
      try {
        const body = await readFile(full);
        await cfg.client.send(
          new PutObjectCommand({
            Bucket: cfg.bucket,
            Key: key,
            Body: body,
            ContentType: "text/html; charset=utf-8",
            // Short TTL — the HTML embeds hashed asset URLs that change every
            // deploy. The worker also sets its own response Cache-Control.
            CacheControl: "public, max-age=60, must-revalidate",
            Metadata: { "uploaded-at": new Date().toISOString() },
          }),
        );
        mUploaded++;
      } catch (err) {
        mFailed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[lp-studio:upload-assets-to-r2] marketing HTML upload failed: ${key} :: ${msg}`);
      }
    }
    console.log(
      `[lp-studio:upload-assets-to-r2] marketing HTML done. pages=${htmlPages.length} uploaded=${mUploaded} failed=${mFailed}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[lp-studio:upload-assets-to-r2] marketing HTML walk failed (non-fatal): ${msg}`);
  }
}

main().catch((err) => {
  // Catastrophic error (R2 client init, etc). Don't fail the build —
  // a deploy without asset upload is no worse than today's behavior
  // (the Worker /assets handler falls through to origin on R2 miss).
  console.warn("[lp-studio:upload-assets-to-r2] fatal (non-fatal to build):", err);
  process.exit(0);
});
