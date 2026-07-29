/**
 * The sync ENGINE needs a database, so these cover the two pure pieces that
 * carry the risk: credential handling (a token must never leave the server)
 * and the summary shape the UI reads.
 */
import { describe, expect, it } from "vitest";
import { credsFromConfig, redactRainfocusConfig } from "./rainfocus-config";

describe("credsFromConfig", () => {
  it("builds credentials from a stored connection", () => {
    expect(credsFromConfig({ apiToken: "tok", widgetId: "wid", env: "stg" }))
      .toEqual({ apiToken: "tok", widgetId: "wid", env: "stg" });
  });

  it("defaults env to prod", () => {
    expect(credsFromConfig({ apiToken: "tok", widgetId: "wid" })?.env).toBe("prod");
  });

  it("returns null when either half is missing, so nothing runs half-configured", () => {
    expect(credsFromConfig({ apiToken: "tok" })).toBeNull();
    expect(credsFromConfig({ widgetId: "wid" })).toBeNull();
    expect(credsFromConfig({ apiToken: "  ", widgetId: "wid" })).toBeNull();
    expect(credsFromConfig({})).toBeNull();
    expect(credsFromConfig(null)).toBeNull();
  });
});

describe("redactRainfocusConfig", () => {
  it("NEVER returns the token", () => {
    const out = redactRainfocusConfig({ apiToken: "super-secret", widgetId: "wid", env: "prod" });
    expect(JSON.stringify(out)).not.toContain("super-secret");
    expect("apiToken" in out).toBe(false);
  });

  it("reports connectedness instead, which is what the UI needs", () => {
    expect(redactRainfocusConfig({ apiToken: "t", widgetId: "w" }).connected).toBe(true);
    expect(redactRainfocusConfig({ widgetId: "w" }).connected).toBe(false);
    expect(redactRainfocusConfig({}).connected).toBe(false);
    expect(redactRainfocusConfig(null).connected).toBe(false);
  });

  it("keeps the non-secret state the UI shows", () => {
    const out = redactRainfocusConfig({
      apiToken: "t", widgetId: "w", autoSync: true,
      lastSyncAt: "2026-07-28T00:00:00.000Z", lastSyncStatus: "ok",
      lastSyncSummary: { created: 2, updated: 1, missing: 3, restored: 0, total: 168 },
    });
    expect(out.autoSync).toBe(true);
    expect(out.lastSyncStatus).toBe("ok");
    expect(out.lastSyncSummary?.missing).toBe(3);
    expect(out.widgetId).toBe("w");
  });
});
