#!/usr/bin/env node
/**
 * Marketing-site prerender.
 *
 * Runs after `vite build`. Spins up `vite preview` on a free port, drives
 * it with Playwright (Chromium) to render the marketing routes, captures
 * the hydrated DOM, and writes per-route HTML files into dist/public.
 *
 * The result: real, fully-populated HTML for every route in
 * MARKETING_ROUTES with per-page <title>/<meta>/canonical/OG tags baked
 * in. The page
 * scripts in the snapshot point at the same hashed asset bundles, so
 * React still boots normally on the client and re-renders identical
 * markup — no flash, no hydration mismatch beyond what createRoot
 * already does today.
 *
 * Why Playwright (not Vite SSR): the marketing components depend on
 * `window`-aware libraries (wouter, framer-motion, scroll listeners),
 * are lazy-loaded inside `App.tsx`, and import Tailwind via Vite-only
 * plugins. A Vite SSR build would require a separate entry, multiple
 * shimmed imports, and a parallel client/server module graph. Playwright
 * already ships in devDependencies for our e2e tests, so this is
 * additive — no new deps, no extra CI install time.
 *
 * Routes prerendered are listed in MARKETING_ROUTES below.
 */

import { execSync, spawn } from "node:child_process";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

/**
 * Resolve a system-installed Chromium. The bundled playwright chromium
 * does not run on the NixOS-based Replit container because its dynamic
 * libs (libglib, libnss, libasound, …) are not on the standard library
 * path. Our playwright e2e config does the same dance — keep them in
 * sync.
 */
function detectSystemChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      const out = execSync(`command -v ${name} 2>/dev/null`, { encoding: "utf8" }).trim();
      if (out && existsSync(out)) return out;
    } catch {
      /* keep looking */
    }
  }
  return undefined;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.resolve(ROOT, "dist", "public");

const MARKETING_ROUTES = [
  { path: "/", outFile: "index.html" },
  { path: "/features", outFile: "features/index.html" },
  { path: "/for-marketing", outFile: "for-marketing/index.html" },
  { path: "/for-sales", outFile: "for-sales/index.html" },
  { path: "/compare", outFile: "compare/index.html" },
  { path: "/pricing", outFile: "pricing/index.html" },
  { path: "/privacy", outFile: "privacy/index.html" },
  { path: "/terms", outFile: "terms/index.html" },
  { path: "/docs/integrations", outFile: "docs/integrations/index.html" },
  // Legacy single-purpose Zapier doc. The SPA route redirects it to the hub's
  // #zapier section, so this snapshot captures the hub HTML — old links and OG
  // share cards keep resolving instead of 404ing.
  { path: "/docs/integrations/zapier", outFile: "docs/integrations/zapier/index.html" },
];

/**
 * Best-effort read of the superadmin-editable marketing homepage share card
 * (Open Graph) config so the prerender can bake the operator's edits into the
 * static HTML that non-JS social scrapers fetch. Returns null on any failure
 * (no DB URL, unreachable, table absent) — home.tsx then falls back, field by
 * field, to its built-in defaults, so this NEVER fails the build.
 *
 * Uses `pg` directly (resolvable from lp-studio's node_modules) rather than
 * importing @workspace/db, whose module index eagerly constructs a connection
 * Pool on import.
 */
async function loadHomepageOg() {
  const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    process.stdout.write("[prerender] homepage OG: no DATABASE_URL — using built-in defaults\n");
    return null;
  }
  let client;
  try {
    const pg = (await import("pg")).default;
    client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
    await client.connect();
    const result = await client.query(
      `SELECT og_title, og_description, og_image_url, og_image_width, og_image_height
         FROM marketing_homepage_og
        ORDER BY id ASC
        LIMIT 1`,
    );
    const row = result.rows[0];
    if (!row) return null;
    const toDim = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
    };
    return {
      title: typeof row.og_title === "string" ? row.og_title : "",
      description: typeof row.og_description === "string" ? row.og_description : "",
      imageUrl: typeof row.og_image_url === "string" ? row.og_image_url : "",
      imageWidth: toDim(row.og_image_width),
      imageHeight: toDim(row.og_image_height),
    };
  } catch (err) {
    process.stdout.write(
      `[prerender] homepage OG DB read skipped (${err?.message || err}) — using built-in defaults\n`,
    );
    return null;
  } finally {
    if (client) await client.end().catch(() => {});
  }
}

/**
 * Best-effort read of the superadmin-editable share cards for the secondary
 * marketing routes (`marketing_page_og`, Task #997). Returns a map keyed by
 * page_key (e.g. { features: {...}, pricing: {...} }) so the prerender can bake
 * each route's configured OG tags into the static HTML that non-JS social
 * scrapers fetch. Returns {} on any failure — each marketing page then falls
 * back, field by field, to its built-in defaults, so this NEVER fails the build.
 *
 * Uses `pg` directly (resolvable from lp-studio's node_modules) rather than
 * importing @workspace/db, whose module index eagerly constructs a Pool.
 */
async function loadPageOg() {
  const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) return {};
  let client;
  try {
    const pg = (await import("pg")).default;
    client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
    await client.connect();
    const result = await client.query(
      `SELECT page_key, og_title, og_description, og_image_url
         FROM marketing_page_og`,
    );
    const map = {};
    for (const row of result.rows) {
      if (typeof row.page_key !== "string") continue;
      map[row.page_key] = {
        title: typeof row.og_title === "string" ? row.og_title : "",
        description: typeof row.og_description === "string" ? row.og_description : "",
        imageUrl: typeof row.og_image_url === "string" ? row.og_image_url : "",
      };
    }
    return map;
  } catch (err) {
    process.stdout.write(
      `[prerender] page OG DB read skipped (${err?.message || err}) — using built-in defaults\n`,
    );
    return {};
  } finally {
    if (client) await client.end().catch(() => {});
  }
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") {
        srv.close();
        reject(new Error("Failed to allocate free port"));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 304) return;
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Preview server at ${url} never came up`);
}

async function startPreview(port) {
  // Spawn the local vite binary directly (faster than going through
  // pnpm --filter, which re-resolves the workspace graph on every call).
  const viteBin = path.resolve(ROOT, "node_modules", ".bin", "vite");
  const child = spawn(
    viteBin,
    [
      "preview",
      "--config",
      "vite.config.ts",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let buffer = "";
  child.stdout.on("data", (d) => {
    buffer += d.toString();
  });
  child.stderr.on("data", (d) => {
    buffer += d.toString();
  });
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      process.stderr.write(`[prerender] preview exited with ${code}\n${buffer}\n`);
    }
  });
  return child;
}

function killPreview(child) {
  if (!child || child.killed) return;
  try {
    child.kill("SIGTERM");
  } catch {
    /* ignore */
  }
}

async function snapshotRoute(page, baseUrl, route) {
  // ?preview=marketing forces isMarketingHost() true so MarketingApp mounts
  // even though the dev/preview hostname isn't lpstudio.ai.
  const url = `${baseUrl}${route.path}${route.path.includes("?") ? "&" : "?"}preview=marketing`;
  // `networkidle` can hang because Google Fonts / Sentry keep connections
  // chatty; wait for DOM + explicit hydration signals instead.
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  if (!response || !response.ok()) {
    throw new Error(`Failed to load ${url}: ${response?.status()}`);
  }
  // Wait for React to mount: the #root must contain real children (not
  // just the pre-mount loader), and useEffect-driven head meta must have
  // set the title.
  await page.waitForFunction(
    () => {
      const root = document.getElementById("root");
      if (!root) return false;
      const hasRealChildren = Array.from(root.children).some(
        (c) => c.id !== "pre-mount-loader",
      );
      return hasRealChildren && !!document.title && document.title.length > 0;
    },
    { timeout: 30000 },
  );
  // Short settle for any post-mount effects (font swap, image decode).
  await page.waitForTimeout(500);
  // Mark the snapshot so we can detect at runtime whether the user is
  // looking at a prerendered HTML (useful for diagnostics and future
  // hydration logic).
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-prerendered", "1");
    // Remove the pre-mount spinner from the snapshot — the prerendered
    // content itself is the first paint.
    const loader = document.getElementById("pre-mount-loader");
    if (loader) loader.remove();
  });
  const html = await page.content();
  // Tag the MarketingApp CSS chunk's <link> so the runtime host-detect
  // script in index.html can strip it on non-marketing hosts. Without
  // this, tenant subdomains (max.lpstudio.ai, partners.meetdandy.com,
  // …) all serve this same prerendered index.html, and the marketing
  // CSS — which has globally-scoped rules (body bg, h1-h6 font, * margin
  // reset) plus a second @theme inline block that overrides Tailwind v4
  // color tokens like --color-border — would leak into the SaaS admin
  // chrome and the landing-page viewer.
  const tagged = html.replace(
    /<link([^>]*\srel="stylesheet"[^>]*\shref="[^"]*\/MarketingApp-[^"]*\.css"[^>]*)>/g,
    (m, attrs) => `<link${attrs} data-marketing-only="1">`,
  );
  // Fail loud if tagging didn't match anything — guards against a future
  // Vite/Rollup chunk-naming change silently breaking the runtime strip
  // on tenant subdomains and re-introducing the cross-tenant CSS bleed.
  if (!tagged.includes('data-marketing-only="1"')) {
    throw new Error(
      `[prerender] expected to tag a MarketingApp CSS <link> in the ${route.path} snapshot but found none — has the marketing CSS chunk been renamed? Update the regex in snapshotRoute().`,
    );
  }
  return `<!DOCTYPE html>\n${tagged.replace(/^<!DOCTYPE [^>]+>\s*/i, "")}`;
}

async function writeFileEnsuringDir(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

async function main() {
  // Sanity check: dist must exist (vite build already ran).
  const sourceIndexPath = path.join(DIST, "index.html");
  try {
    await fs.access(sourceIndexPath);
  } catch {
    throw new Error(
      `[prerender] dist/public/index.html missing — run \`vite build\` first.`,
    );
  }

  // Capture Vite's built index.html BEFORE the marketing snapshot writes
  // over it. This pristine shell — source template + Vite-injected hashed
  // <script>/<link> tags + pre-mount loader, no marketing DOM, no
  // MarketingApp CSS — is what the CF worker serves to tenant hosts on
  // SPA HTML routes (vanity links, root redirects, R2-miss 404s) so
  // visitors see the loader spinner instead of a marketing flash before
  // React mounts and routes them.
  //
  // Uploaded to R2 by scripts/upload-assets-to-r2.mjs and consumed by
  // cloudflare/tenant-host-router/worker.js (tier 3.5).
  const tenantShellPath = path.join(DIST, "tenant-shell.html");
  const viteShell = await fs.readFile(sourceIndexPath, "utf8");
  await fs.writeFile(tenantShellPath, viteShell, "utf8");
  process.stdout.write(
    `[prerender] wrote tenant shell → ${path.relative(ROOT, tenantShellPath)} (${viteShell.length} bytes)\n`,
  );

  // Reuse the chromium that ships with @playwright/test (already a devDep
   // for our e2e suite) so we don't pull a separate `playwright` package.
  const { chromium } = await import("@playwright/test");

  // Best-effort: pull the superadmin-configured homepage share card so its
  // values get baked into the static / snapshot for non-JS social scrapers.
  const homepageOg = await loadHomepageOg();
  if (homepageOg) {
    process.stdout.write(
      `[prerender] homepage OG: baking configured share card (title="${homepageOg.title.slice(0, 60)}…")\n`,
    );
  }

  // Best-effort: pull the superadmin-configured share cards for the secondary
  // marketing routes (features/pricing/for-marketing/for-sales/compare) so each
  // route's snapshot bakes the configured OG tags for non-JS social scrapers.
  const pageOg = await loadPageOg();
  const pageOgKeys = Object.keys(pageOg);
  if (pageOgKeys.length) {
    process.stdout.write(
      `[prerender] page OG: baking configured share cards for ${pageOgKeys.join(", ")}\n`,
    );
  }

  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  process.stdout.write(`[prerender] starting vite preview on ${baseUrl}\n`);
  const preview = await startPreview(port);

  let browser = null;
  try {
    await waitForServer(baseUrl);
    const executablePath = detectSystemChromium();
    if (executablePath) {
      process.stdout.write(`[prerender] using system chromium: ${executablePath}\n`);
    }
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    // Inject a flag BEFORE any page script runs so isMarketingHost() in
    // App.tsx returns true on the headless 127.0.0.1 host. Without this the
    // SaaS shell mounts (since the host isn't lpstudio.ai and prod builds
    // ignore ?preview=marketing) and we'd snapshot the wrong app.
    await context.addInitScript(() => {
      window.__LP_STUDIO_PRERENDER__ = true;
    });
    // Inject the superadmin-configured homepage share card BEFORE page scripts
    // run so home.tsx's useState initializer reads it and bakes the configured
    // OG tags into the / snapshot. Only home.tsx reads this global; other
    // marketing routes ignore it.
    if (homepageOg) {
      await context.addInitScript((og) => {
        window.__LP_HOMEPAGE_OG__ = og;
      }, homepageOg);
    }
    // Inject the superadmin-configured share cards for the secondary marketing
    // routes BEFORE page scripts run so each page's useShareCard() initializer
    // reads its row and bakes the configured OG tags into that route's snapshot.
    if (pageOgKeys.length) {
      await context.addInitScript((map) => {
        window.__LP_PAGE_OG__ = map;
      }, pageOg);
    }
    const page = await context.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        process.stdout.write(`[prerender][browser:${msg.type()}] ${msg.text()}\n`);
      }
    });
    page.on("pageerror", (err) => {
      process.stdout.write(`[prerender][pageerror] ${err.message}\n`);
    });
    page.on("requestfailed", (req) => {
      process.stdout.write(`[prerender][reqfail] ${req.url()} ${req.failure()?.errorText}\n`);
    });

    for (const route of MARKETING_ROUTES) {
      process.stdout.write(`[prerender] snapshotting ${route.path}\n`);
      const html = await snapshotRoute(page, baseUrl, route);
      const out = path.join(DIST, route.outFile);
      await writeFileEnsuringDir(out, html);
      process.stdout.write(`[prerender]   → ${path.relative(ROOT, out)} (${html.length} bytes)\n`);
    }

    await context.close();
    process.stdout.write(`[prerender] done — ${MARKETING_ROUTES.length} routes\n`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    killPreview(preview);
  }
}

main().catch((err) => {
  process.stderr.write(`[prerender] FAILED: ${err?.stack || err}\n`);
  process.exit(1);
});
