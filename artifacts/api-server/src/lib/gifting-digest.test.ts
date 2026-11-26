import { describe, expect, it } from "vitest";
import { buildGiftingDigest, digestDue, parseDigestSettingsPatch, readDigestSettings, runningLowGifts, zonedClock, type DigestInput } from "./gifting-digest";

const base: DigestInput = {
  now: new Date("2026-12-03T15:00:00Z"),
  claimedInWindow: { premium: 7, mid: 4, swag: 1 },
  pagesInWindow: 23,
  exchangeActivity: 0,
  totals: { premium: { claimed: 61, ordered: 150 }, mid: { claimed: 72, ordered: 350 }, swag: { claimed: 15, ordered: 126 } },
  offers: [{ name: "Nick Golden", tier: "mid", remaining: 5 }],
  requests: [{ name: "Taigh Panzer", tier: "premium", remaining: 2 }],
  mostClaimed: [{ name: "Taigh", claimed: 13 }, { name: "Cordelia", claimed: 12 }, { name: "Nick", claimed: 9 }, { name: "X", claimed: 1 }],
  bestRate: [{ name: "Molly", rate: 0.667 }],
  runningLow: [{ name: "Dandy Meta Ray-Bans", left: 6 }],
  appUrl: "https://app.lpstudio.ai/sales/gifting",
};
const textOf = (r: ReturnType<typeof buildGiftingDigest>) => JSON.stringify(r?.blocks);

describe("gifting digest", () => {
  it("builds the summary with every section that has something in it", () => {
    const t = textOf(buildGiftingDigest(base));
    expect(t).toContain("Holiday gifting, Thu, Dec 3");
    expect(t).toContain("12 gifts claimed (7 Premium, 4 Mid-value, 1 Swag)");
    expect(t).toContain("23 new gift pages sent");
    expect(t).toContain("148 of 626 claimed");
    expect(t).toContain("5 Mid-value (Nick Golden)");
    expect(t).toContain("2 Premium (Taigh Panzer)");
    expect(t).toContain("Taigh 13 · Cordelia 12 · Nick 9");
    expect(t).not.toContain("X 1");
    expect(t).toContain("Molly 67%");
    expect(t).toContain("Dandy Meta Ray-Bans (6 left)");
  });
  it("leaves out empty sections", () => {
    const t = textOf(buildGiftingDigest({ ...base, claimedInWindow: { premium: 0, mid: 0, swag: 0 }, offers: [], requests: [], runningLow: [], bestRate: [] }));
    expect(t).not.toContain("claimed (");
    expect(t).not.toContain("Up for grabs");
    expect(t).not.toContain("Reps hunting");
    expect(t).not.toContain("Running low");
    expect(t).toContain("23 new gift pages sent");
  });
  it("skips a day with no activity", () => {
    expect(buildGiftingDigest({ ...base, claimedInWindow: { premium: 0, mid: 0, swag: 0 }, pagesInWindow: 0, exchangeActivity: 0 })).toBeNull();
  });
  it("flags gifts at or under 10% of stock", () => {
    expect(runningLowGifts([{ name: "Meta", ordered: 75, claimed: 69 }, { name: "AirPods", ordered: 75, claimed: 60 }, { name: "Hoodie", ordered: 42, claimed: 42 }]))
      .toEqual([{ name: "Hoodie", left: 0 }, { name: "Meta", left: 6 }]);
  });
  it("is due on weekdays from the configured Chicago hour, once a day", () => {
    const cfg = { enabled: true, channelId: "C1", hour: 9 };
    expect(zonedClock(new Date("2026-12-03T15:00:00Z"))).toEqual({ date: "2026-12-03", hour: 9, weekday: 4 });
    expect(digestDue(new Date("2026-12-03T14:59:00Z"), cfg)).toBe(false);
    expect(digestDue(new Date("2026-12-03T15:00:00Z"), cfg)).toBe(true);
    expect(digestDue(new Date("2026-12-03T15:00:00Z"), { ...cfg, lastSentDate: "2026-12-03" })).toBe(false);
    expect(digestDue(new Date("2026-12-05T15:00:00Z"), cfg)).toBe(false);
    expect(digestDue(new Date("2026-12-03T15:00:00Z"), { ...cfg, enabled: false })).toBe(false);
  });
  it("sends an empty-day summary only when forced (Send now)", () => {
    const quiet = { ...base, claimedInWindow: { premium: 0, mid: 0, swag: 0 }, pagesInWindow: 0, exchangeActivity: 0 };
    expect(textOf(buildGiftingDigest(quiet, { force: true }))).toContain("no new claims or pages");
  });
  it("reads and validates settings", () => {
    expect(readDigestSettings({})).toEqual({ enabled: false, channelId: "", hour: 9, lastSentDate: undefined, lastSentAt: undefined });
    expect(readDigestSettings({ giftingDigest: { enabled: true, channelId: " C0CLWPPUKKP ", hour: 8 } })).toMatchObject({ enabled: true, channelId: "C0CLWPPUKKP", hour: 8 });
    expect(parseDigestSettingsPatch({ enabled: true, channelId: "C0CLWPPUKKP", hour: 9 })).toEqual({ enabled: true, channelId: "C0CLWPPUKKP", hour: 9 });
    expect(parseDigestSettingsPatch({ channelId: "#gifting" })).toHaveProperty("error");
    expect(parseDigestSettingsPatch({ hour: 24 })).toHaveProperty("error");
  });
});
