/**
 * App-wide guard against calling an endpoint that doesn't exist.
 *
 * This bug class hid THREE times before anyone noticed, always the same shape:
 * a client `fetch` to a path with no matching server route, whose response was
 * never checked, so the UI reported success and the write never happened.
 *
 *   • `PATCH /lp/media/images/:id/tags`     — tag saves 404'd; an optimistic
 *     local update made them look saved until the next reload.
 *   • `PATCH /lp/library/:type/:id/default` — the "default" star toggled, then
 *     the reload put it back.
 *   • `POST /sales/pdf-submissions`         — one-pager download tracking,
 *     pointed at a table behind the deliberately-unmounted /api/dso surface.
 *
 * A typo in a template-literal URL is invisible to the compiler, so this test
 * does the checking: every `fetch("/api/…")` in the client is matched against
 * the routes the server actually declares.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../..");
const SERVER_ROUTES_DIR = join(REPO_ROOT, "artifacts/api-server/src/routes");
const CLIENT_SRC = join(REPO_ROOT, "artifacts/lp-studio/src");

/**
 * Calls we know point at nothing, on purpose. Each needs a reason — this list
 * is for deliberate placeholders, NOT a parking lot for broken things.
 */
const KNOWN_UNBUILT = new Set([
  // Gated behind `USE_LIVE_AI = false` in marketing/components/BuildSection.tsx,
  // with a comment saying to flip it once the endpoint ships.
  "POST /public/ai-suggest",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

interface Route { method: string; segments: string[] }

/**
 * Routers under routes/sales, routes/admin and routes/webhooks are mounted
 * with a prefix in routes/index.ts and declare their paths relative to it.
 */
function mountPrefix(relPath: string): string {
  if (relPath.startsWith("sales/")) return "/sales";
  if (relPath.startsWith("admin")) return "/admin";
  if (relPath.startsWith("webhooks")) return "/webhooks";
  return "";
}

const split = (p: string): string[] => p.split("/").filter(Boolean);

function serverRoutes(): Route[] {
  const routes: Route[] = [];
  for (const file of walk(SERVER_ROUTES_DIR)) {
    const rel = relative(SERVER_ROUTES_DIR, file);
    const prefix = mountPrefix(rel);
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g)) {
      let path = m[2];
      if (prefix && !path.startsWith(prefix)) path = prefix + path;
      routes.push({ method: m[1].toUpperCase(), segments: split(path) });
    }
  }
  return routes;
}

/** A `${…}` filling a whole path segment is a param; `:p` marks it. */
const PARAM = ":p";

/**
 * `/api/lp/media/${id}/tags` → `["lp","media",":p","tags"]`
 *
 * An interpolation glued to the END of a segment is a conditional query
 * suffix (`classify-targets${force ? "?force=1" : ""}`), not a param —
 * treating it as one would invent routes that don't exist.
 */
function clientSegments(raw: string): string[] {
  const path = raw
    .replace(/^\/api/, "")
    .replace(/\/\$\{[^{}]*\}/g, `/${PARAM}`)
    .replace(/\$\{[^{}]*\}/g, "")
    .replace(/\?.*$/, "");
  return split(path);
}

interface ClientCall { method: string; segments: string[]; raw: string; where: string }

function clientCalls(): ClientCall[] {
  const calls: ClientCall[] = [];
  // Template literals can contain quotes inside `${…}`, so the three string
  // forms are matched separately rather than with one character class.
  const pattern = /fetch\(\s*(?:`([^`]*)`|"([^"]*)"|'([^']*)')([\s\S]{0,300}?)\)/g;
  for (const file of walk(CLIENT_SRC)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(pattern)) {
      const url = m[1] ?? m[2] ?? m[3] ?? "";
      if (!url.startsWith("/api/")) continue;
      const tail = m[4] ?? "";
      const method = (/method:\s*["'`]([A-Za-z]+)["'`]/.exec(tail)?.[1] ?? "GET").toUpperCase();
      const line = src.slice(0, m.index).split("\n").length;
      calls.push({
        method,
        segments: clientSegments(url),
        raw: url,
        where: `${relative(REPO_ROOT, file)}:${line}`,
      });
    }
  }
  return calls;
}

/**
 * Express matches a literal against a declared param, so `/lp/library/case_study`
 * legitimately hits `/lp/library/:type`. Compare segment-wise with that rule
 * rather than on a normalised string, which would reject it.
 */
function matches(call: ClientCall, route: Route): boolean {
  if (call.method !== route.method) return false;
  if (call.segments.length !== route.segments.length) return false;
  return route.segments.every((rs, i) => {
    const cs = call.segments[i];
    if (rs.startsWith(":") || rs.startsWith("*")) return true; // server param
    if (cs === PARAM) return true; // client interpolation — can't disprove
    return rs === cs;
  });
}

describe("client → server route parity", () => {
  it("the scan finds both sides (it isn't silently matching nothing)", () => {
    expect(serverRoutes().length).toBeGreaterThan(300);
    expect(clientCalls().length).toBeGreaterThan(100);
  });

  it("every /api/... call in the client hits a route the server declares", () => {
    const routes = serverRoutes();
    const missing = clientCalls()
      .filter((c) => !KNOWN_UNBUILT.has(`${c.method} /${c.segments.join("/")}`))
      .filter((c) => !routes.some((r) => matches(c, r)))
      .map((c) => `${c.method} ${c.raw}\n      at ${c.where}`);
    expect(missing).toEqual([]);
  });

  it("the three routes that were missing are accounted for", () => {
    const routes = serverRoutes();
    const has = (method: string, path: string) =>
      routes.some((r) => matches({ method, segments: split(path), raw: path, where: "" }, r));
    expect(has("PATCH", "/lp/media/1/tags")).toBe(true);
    expect(has("PATCH", "/lp/library/case_study/1/default")).toBe(true);
    // Never rebuilt — the client call was removed instead, so it must stay gone.
    expect(has("POST", "/sales/pdf-submissions")).toBe(false);
  });

  it("still rejects the original typo", () => {
    const routes = serverRoutes();
    const typo = { method: "PATCH", segments: split("/lp/media/images/1/tags"), raw: "", where: "" };
    expect(routes.some((r) => matches(typo, r))).toBe(false);
  });
});
