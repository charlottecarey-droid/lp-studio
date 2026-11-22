/**
 * Every partner-room visitor route must be on the public allowlist (LP_PUBLIC),
 * or the global auth gate answers "Not authenticated" on the customer-facing
 * hub, where LP Studio's sign-in doesn't reach — while it still works inside
 * LP Studio, so it slips through by hand. (Nov 2026: the Scorecard's
 * "Select a wave" had been failing on every live hub this way.)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LP_PUBLIC } from "../index";

const source = readFileSync(path.join(__dirname, "rooms.ts"), "utf8");
const visitorRoutes = [...source.matchAll(/router\.(get|post)\(\s*"(\/lp\/room\/[^"]+)"/g)].map((m) => ({ method: m[1].toUpperCase(), path: m[2] }));

describe("partner-room visitor routes are public", () => {
  it("finds the visitor routes", () => {
    expect(visitorRoutes.length).toBeGreaterThan(20);
    expect(visitorRoutes).toContainEqual({ method: "POST", path: "/lp/room/practice-ids" });
    expect(visitorRoutes).toContainEqual({ method: "POST", path: "/lp/room/practices-wave" });
  });

  it.each(visitorRoutes.map((r) => [`${r.method} ${r.path}`, r] as const))("%s is on LP_PUBLIC", (_label, r) => {
    expect(LP_PUBLIC.some((p) => p.method === r.method && p.pattern.test(r.path))).toBe(true);
  });

  it("the team's own routes stay behind sign-in", () => {
    expect(LP_PUBLIC.some((p) => p.pattern.test("/lp/partner-rooms/1/plan"))).toBe(false);
  });
});
