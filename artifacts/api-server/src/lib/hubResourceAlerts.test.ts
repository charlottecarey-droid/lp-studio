import { describe, expect, it } from "vitest";
import { blockWantsSlackAlert } from "./hubResourceAlertRules";

describe("blockWantsSlackAlert — which block's gate decides", () => {
  const blocks = [
    { id: "hero", type: "hub-hero", props: {} },
    { id: "lib", type: "hub-library", props: { gate: { enabled: true, alertSlack: true } } },
    { id: "feat", type: "hub-featured", props: { gate: { enabled: true, alertSlack: false } } },
  ];
  it("uses the owning block when the beacon names it", () => {
    expect(blockWantsSlackAlert(blocks, "lib")).toBe(true);
    expect(blockWantsSlackAlert(blocks, "feat")).toBe(false);
  });
  it("falls back to any hub block with the alert on when the block id is unknown", () => {
    expect(blockWantsSlackAlert(blocks, null)).toBe(true);
    expect(blockWantsSlackAlert(blocks, "ghost")).toBe(true);
    expect(blockWantsSlackAlert([blocks[0], blocks[2]], null)).toBe(false);
  });
  it("needs the gate ON as well as the alert flag, and tolerates bad shapes", () => {
    expect(blockWantsSlackAlert([{ id: "x", type: "hub-library", props: { gate: { enabled: false, alertSlack: true } } }], "x")).toBe(false);
    expect(blockWantsSlackAlert(null, "x")).toBe(false);
    expect(blockWantsSlackAlert("nope", null)).toBe(false);
  });
});
