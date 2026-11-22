import { describe, expect, it } from "vitest";
import { giftFor, hubGiftStep, isGiftRequest, setGiftOff } from "./partnerRoomGift";
import { extractRoomTasks } from "./partnerRoom";

const hub = (steps: unknown[], extra: Record<string, unknown> = {}) => [{ type: "room-workspace", props: { partnerName: "MB2", onboarding: { steps, ...extra } } }];
const GIFT = { key: "onboard-gift", title: "Accept your welcome gift", action: "request" };
const on = { giftsEnabled: true, giftOffEmails: [] as string[] };

describe("welcome gifts", () => {
  it("finds the hub's gift step, unless it or the checklist is hidden", () => {
    expect(hubGiftStep(hub([{ key: "logo", title: "Upload your logo" }, GIFT]))).toEqual({ key: "onboard-gift", title: "Accept your welcome gift" });
    expect(hubGiftStep(hub([{ key: "kit", title: "Accept your welcome kit" }]))).toMatchObject({ key: "kit" });
    expect(hubGiftStep(hub([{ ...GIFT, hidden: true }]))).toBeNull();
    expect(hubGiftStep(hub([GIFT], { hidden: true }))).toBeNull();
  });

  it("is each person's own, so it is never a hub-wide task", () => {
    const tasks = extractRoomTasks(hub([GIFT, { key: "logo", title: "Upload your logo", action: "upload" }]));
    expect(tasks.has("onboard-gift")).toBe(false);
    expect(tasks.has("logo")).toBe(true);
  });

  it("is offered to the customer's people unless turned off for the hub or the person; never to the team", () => {
    const ana = { email: "Ana@mb2.com" };
    expect(giftFor(on, ana, true, [])).toEqual({ offered: true, accepted: false });
    expect(giftFor(on, ana, true, ["ana@mb2.com"])).toEqual({ offered: true, accepted: true });
    expect(giftFor({ giftsEnabled: false, giftOffEmails: [] }, ana, true, [])).toEqual({ offered: false, accepted: false });
    expect(giftFor({ giftsEnabled: true, giftOffEmails: ["ana@mb2.com"] }, ana, true, [])).toEqual({ offered: false, accepted: false });
    // Accepted before the switch was turned off: still shows as done.
    expect(giftFor({ giftsEnabled: false, giftOffEmails: [] }, ana, true, ["ana@mb2.com"])).toEqual({ offered: true, accepted: true });
    expect(giftFor(on, { email: "rep@meetdandy.com", team: true }, true, [])).toEqual({ offered: false, accepted: false });
    expect(giftFor(on, null, true, [])).toEqual({ offered: false, accepted: false });
    expect(giftFor(on, ana, false, [])).toEqual({ offered: false, accepted: false });
  });

  it("knows a gift request, including ones sent before requests were marked", () => {
    expect(isGiftRequest({ assetKey: "onboard-gift" })).toBe(true);
    expect(isGiftRequest({ assetKey: "kit-x" })).toBe(false);
    expect(isGiftRequest({ assetKey: null, kind: "marketing", subject: "Accept your welcome gift" })).toBe(true);
    expect(isGiftRequest({ assetKey: null, kind: "other", subject: "Accept your welcome gift" })).toBe(false);
  });

  it("turns one person on and off", () => {
    expect(setGiftOff([], " Ana@MB2.com ", true)).toEqual(["ana@mb2.com"]);
    expect(setGiftOff(["ana@mb2.com", "lee@mb2.com"], "ANA@mb2.com", false)).toEqual(["lee@mb2.com"]);
    expect(setGiftOff(["ana@mb2.com"], "ana@mb2.com", true)).toEqual(["ana@mb2.com"]);
  });
});
