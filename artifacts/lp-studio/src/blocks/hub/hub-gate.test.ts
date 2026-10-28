// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { clearHubUnlock, gateApplies, readHubUnlock, writeHubUnlock } from "./hub-gate";

/**
 * Resource gate rules: off by default; "first-open" gates everything,
 * "downloads" gates downloads only; never in the builder; an unlock (stored
 * per browser) ends the gating; the unlock survives a reload and carries
 * the lead id the beacons attribute to.
 */
describe("hub-gate", () => {
  afterEach(() => clearHubUnlock());

  it("is off unless enabled, and never gates inside the builder", () => {
    expect(gateApplies(undefined, "open", { unlocked: null })).toBe(false);
    expect(gateApplies({ enabled: false }, "open", { unlocked: null })).toBe(false);
    expect(gateApplies({ enabled: true }, "open", { unlocked: null, isEditor: true })).toBe(false);
  });

  it("first-open gates viewing, opening and downloading; downloads mode gates downloads only", () => {
    expect(gateApplies({ enabled: true, mode: "first-open" }, "open", { unlocked: null })).toBe(true);
    expect(gateApplies({ enabled: true, mode: "first-open" }, "download", { unlocked: null })).toBe(true);
    expect(gateApplies({ enabled: true, mode: "downloads" }, "open", { unlocked: null })).toBe(false);
    expect(gateApplies({ enabled: true, mode: "downloads" }, "download", { unlocked: null })).toBe(true);
  });

  it("an unlock ends the gating and is remembered with the lead id", () => {
    expect(gateApplies({ enabled: true }, "open", { unlocked: { at: Date.now(), leadId: 5 } })).toBe(false);
    writeHubUnlock({ leadId: 42, email: "a@b.co" });
    expect(readHubUnlock()?.leadId).toBe(42);
    expect(gateApplies({ enabled: true }, "download")).toBe(false);
    clearHubUnlock();
    expect(readHubUnlock()).toBeNull();
    expect(gateApplies({ enabled: true }, "download")).toBe(true);
  });
});
