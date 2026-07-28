/**
 * Guard against the bug class that hid TWICE in the Content Library:
 *
 *   • `PATCH /lp/media/images/:id/tags`   — no such route. Every tag save
 *     404'd, while an optimistic local update made it look like it worked.
 *   • `PATCH /lp/library/:type/:id/default` — no such route. The star toggled,
 *     the reload put it back.
 *
 * Both were invisible because the client ignored the response. A typo in a
 * template-literal URL is not something types or the compiler can catch, so
 * this test does: it reads the Content Library's own fetch calls and asserts
 * each one resolves to a route the server actually declares.
 *
 * Scope is deliberately narrow — the media + library endpoints this page owns.
 * A broad crawl of every fetch in the app would be noisy and fragile; this
 * covers the surface that actually broke.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../..");
const CLIENT_FILE = join(REPO_ROOT, "artifacts/lp-studio/src/pages/content-library.tsx");
const SERVER_FILES = [
  join(REPO_ROOT, "artifacts/api-server/src/routes/lp/library.ts"),
  join(REPO_ROOT, "artifacts/api-server/src/routes/lp/logo-library.ts"),
  join(REPO_ROOT, "artifacts/api-server/src/routes/lp/proof-points.ts"),
  join(REPO_ROOT, "artifacts/api-server/src/routes/lp/proof-points-import.ts"),
  join(REPO_ROOT, "artifacts/api-server/src/routes/storage.ts"),
];

/**
 * `/api/lp/media/${id}/tags` → `/lp/media/:p/tags`
 *
 * An interpolation that occupies a WHOLE path segment is a route param; one
 * glued to the end of a segment is a conditional query suffix
 * (`classify-targets${force ? "?force=1" : ""}`) and contributes nothing to
 * the path. Treating the second kind as a param invents routes that don't
 * exist, so the two are handled separately.
 */
function normalizeClientPath(raw: string): string {
  return raw
    .replace(/^\/api/, "")
    .replace(/\/\$\{[^{}]*\}/g, "/:p")
    .replace(/\$\{[^{}]*\}/g, "")
    .replace(/\?.*$/, "")
    .replace(/\/+$/, "");
}

/** `router.patch("/lp/library/:type/:id/default", …)` → `/lp/library/:p/:p/default` */
function normalizeServerPath(raw: string): string {
  return raw.replace(/:[A-Za-z0-9_]+/g, ":p").replace(/\/+$/, "");
}

function serverRoutes(): Set<string> {
  const out = new Set<string>();
  for (const file of SERVER_FILES) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)) {
      out.add(`${m[1].toUpperCase()} ${normalizeServerPath(m[2])}`);
    }
  }
  return out;
}

/** Every `fetch("/api/lp/…")` in the Content Library, with its method. */
function clientCalls(): { method: string; path: string; raw: string }[] {
  const src = readFileSync(CLIENT_FILE, "utf8");
  const calls: { method: string; path: string; raw: string }[] = [];
  // fetch(`…`) or fetch("…"), optionally followed by an options object whose
  // `method` we read; no method means GET.
  // Template literals may contain quotes inside `${…}`, so match the two
  // string forms separately rather than with one character class.
  const pattern = /fetch\(\s*(?:`([^`]*)`|"([^"]*)")([\s\S]{0,200}?)\)/g;
  for (const m of src.matchAll(pattern)) {
    const url = m[1] ?? m[2] ?? "";
    if (!url.includes("/api/lp/")) continue;
    const raw = url;
    const tail = m[3] ?? "";
    const methodMatch = /method:\s*"([A-Z]+)"/.exec(tail);
    calls.push({
      method: methodMatch ? methodMatch[1] : "GET",
      path: normalizeClientPath(raw),
      raw,
    });
  }
  return calls;
}

describe("Content Library → server route parity", () => {
  it("finds calls to check (the scan itself isn't silently matching nothing)", () => {
    expect(clientCalls().length).toBeGreaterThan(5);
    expect(serverRoutes().size).toBeGreaterThan(10);
  });

  it("every /api/lp/... call the Content Library makes hits a real route", () => {
    const routes = serverRoutes();
    const missing = clientCalls()
      .filter((c) => !routes.has(`${c.method} ${c.path}`))
      .map((c) => `${c.method} ${c.raw}  (looked for "${c.method} ${c.path}")`);
    expect(missing).toEqual([]);
  });

  it("the two routes that were missing are now present", () => {
    const routes = serverRoutes();
    expect(routes).toContain("PATCH /lp/media/:p/tags");
    expect(routes).toContain("PATCH /lp/library/:p/:p/default");
  });

  it("would still CATCH the original typo", () => {
    // Sanity-check the matcher itself: the bad path must not resolve.
    expect(serverRoutes().has("PATCH /lp/media/images/:p/tags")).toBe(false);
  });
});
