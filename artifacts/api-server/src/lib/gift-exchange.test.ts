import { describe, expect, it } from "vitest";
import { availableToOffer, balancesWithTransfers, parsePostInput, transferForAction } from "./gift-exchange";

const summary = {
  tiers: [
    { tier: "premium" as const, allocated: 10, redeemed: 2, remaining: 8 },
    { tier: "mid" as const, allocated: 6, redeemed: 0, remaining: 6 },
    { tier: "swag" as const, allocated: 0, redeemed: 0, remaining: 0 },
  ],
};
const transfers = [
  { fromEmail: "a@x.com", toEmail: "b@x.com", tier: "premium", qty: 1 },
  { fromEmail: "B@x.com", toEmail: "A@x.com", tier: "swag", qty: 1 },
  { fromEmail: "c@x.com", toEmail: "a@x.com", tier: "premium", qty: 1 },
  { fromEmail: "c@x.com", toEmail: "d@x.com", tier: "mid", qty: 1 },
];

describe("gift exchange", () => {
  it("adds transfers to the sheet balance", () => {
    expect(balancesWithTransfers(summary, transfers, "A@x.com")).toEqual([
      { tier: "premium", allocated: 10, redeemed: 2, received: 1, given: 1, left: 8 },
      { tier: "mid", allocated: 6, redeemed: 0, received: 0, given: 0, left: 6 },
      { tier: "swag", allocated: 0, redeemed: 0, received: 1, given: 0, left: 1 },
    ]);
  });
  it("holds back gifts already promised in open offers", () => {
    const b = balancesWithTransfers(summary, [], "a@x.com");
    const offers = [{ repEmail: "a@x.com", tier: "premium", remaining: 5 }, { repEmail: "z@x.com", tier: "premium", remaining: 9 }];
    expect(availableToOffer(b, offers, "a@x.com", "premium")).toBe(3);
    expect(availableToOffer(b, offers, "a@x.com", "swag")).toBe(0);
  });
  it("validates new posts", () => {
    expect(parsePostInput({ kind: "offer", tier: "mid", qty: 3, note: "  spare  " })).toEqual({ kind: "offer", tier: "mid", qty: 3, note: "spare" });
    expect(parsePostInput({ kind: "gift", tier: "mid", qty: 3 })).toHaveProperty("error");
    expect(parsePostInput({ kind: "offer", tier: "gold", qty: 3 })).toHaveProperty("error");
    expect(parsePostInput({ kind: "request", tier: "swag", qty: 0 })).toHaveProperty("error");
    expect(parsePostInput({ kind: "request", tier: "swag", qty: 1.5 })).toHaveProperty("error");
  });
  it("works out who gives and who gets", () => {
    expect(transferForAction({ kind: "offer", repEmail: "A@x.com" }, "b@x.com")).toEqual({ from: "a@x.com", to: "b@x.com" });
    expect(transferForAction({ kind: "request", repEmail: "a@x.com" }, "B@x.com")).toEqual({ from: "b@x.com", to: "a@x.com" });
    expect(transferForAction({ kind: "offer", repEmail: "a@x.com" }, "A@x.com")).toHaveProperty("error");
  });
});
