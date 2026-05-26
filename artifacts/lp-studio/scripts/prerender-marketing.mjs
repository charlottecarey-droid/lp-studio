#!/usr/bin/env node
/**
 * Marketing-site prerender.
 *
 * Runs after `vite build`. Spins up `vite preview` on a free port, drives
 * it with Playwright (Chromium) to render the marketing routes, captures
 * the hydrated DOM, and writes per-route HTML files into dist/public.
 *
 * The result: real, fully-populated HTML for `/`, `/privacy`, `/terms`
 * with per-page <title>/<meta>/canonical/OG tags baked in. The page
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
 * Routes prerendered are listed in MARKETING_ROUTES below. The marketing
 * site only has three: home, privacy, terms.
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
  { path: "/privacy", outFile: "privacy/index.html" },
  { path: "/terms", outFile: "terms/index.html" },
];

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
