import { describe, expect, it } from "vitest";
import { decideGiftClaim, fallbackNote, orderStatusForSlug, parseAllocationsTab, pickFallback, swagReserveLeft, parseInventoryTab, parseInventoryTiers, parseOrdersTab, repGiftSummary, soldOutGifts, tierKey } from "./gift-sheet-status";

const inventory = [
  ["Kit", "Gift name on the form (must match)", "Ordered", "Claimed", "Remaining"],
  ["AirPods kit", "Branded AirPods kit", "2", "0", "2"],
  ["Hoodie", "Premium Zip Up Hoodie", "1", "0", "1"],
  ["Total", "", "3", "0", "3"],
];
const orders = [
  ["Timestamp", "Page", "Slug", "Variant", "Gift", "Email", "Ship date"],
  ["t1", "P", "gift-aaa", "", "Branded AirPods kit", "a@x.com", ""],
  ["t2", "P", "gift-bbb", "", "branded airpods kit ", "b@x.com", "12/10/2026"],
  ["t3", "P", "gift-ccc", "", "Premium Zip Up Hoodie", "c@x.com"],
  ["t4", "P", "gift-ddd", "", "", "d@x.com", ""],
];

describe("gift sheet status", () => {
  it("reads ordered quantities by header and skips Total", () => {
    expect([...parseInventoryTab(inventory)]).toEqual([["branded airpods kit", 2], ["premium zip up hoodie", 1]]);
  });
  it("counts claims case- and space-insensitively and ignores blank gifts", () => {
    const { claimed, orders: rows } = parseOrdersTab(orders);
    expect(claimed.get("branded airpods kit")).toBe(2);
    expect(claimed.get("premium zip up hoodie")).toBe(1);
    expect(rows).toHaveLength(3);
  });
  it("marks a gift sold out when claims reach the ordered quantity", () => {
    const stock = parseInventoryTab(inventory);
    const { claimed } = parseOrdersTab(orders);
    expect(soldOutGifts(stock, claimed, ["Branded AirPods kit", "Premium Zip Up Hoodie", "Dandy Meta Ray-Bans"])).toEqual(["Branded AirPods kit", "Premium Zip Up Hoodie"]);
    expect(soldOutGifts(stock, new Map(), ["Branded AirPods kit"])).toEqual([]);
  });
  it("reports a page's order and ship date", () => {
    const { orders: rows } = parseOrdersTab(orders);
    expect(orderStatusForSlug(rows, "gift-bbb")).toEqual({ ordered: true, shipped: true, shipDate: "12/10/2026", gift: "branded airpods kit " .trim() });
    expect(orderStatusForSlug(rows, "gift-aaa")).toMatchObject({ ordered: true, shipped: false });
    expect(orderStatusForSlug(rows, "gift-zzz")).toEqual({ ordered: false, shipped: false, shipDate: "", gift: "" });
  });
  it("tolerates a missing Ship date column", () => {
    const { orders: rows } = parseOrdersTab([["Slug", "Gift"], ["gift-aaa", "Mug"]]);
    expect(orderStatusForSlug(rows, "gift-aaa").shipped).toBe(false);
  });
});

describe("decideGiftClaim", () => {
  const stock = parseInventoryTab(inventory);
  const parsed = parseOrdersTab(orders);
  const data = { stock, claimed: parsed.claimed, orders: parsed.orders };
  it("blocks a second order from the same page", () => {
    expect(decideGiftClaim(data, "gift-aaa", "Dandy Meta Ray-Bans")).toEqual({ code: "already_ordered", gift: "Branded AirPods kit" });
  });
  it("blocks a gift that has sold out", () => {
    expect(decideGiftClaim(data, "gift-new", "Premium Zip Up Hoodie")).toEqual({ code: "gift_sold_out", gift: "Premium Zip Up Hoodie" });
  });
  it("lets an available gift through", () => {
    expect(decideGiftClaim(data, "gift-new", "Dandy Meta Ray-Bans")).toBeNull();
  });
});

describe("rep gift allocations", () => {
  const inv = [
    ["Kit", "Gift name on the form (must match)", "Ordered", "Claimed", "Remaining", "Unit cost", "Total cost (ordered)", "Spent so far (claimed)", "Tier"],
    ["AirPods kit", "Branded AirPods kit", "75", "0", "75", "$300", "", "", "Premium"],
    ["Yeti", "Yeti Mug and Wireless Charger Duo", "200", "0", "200", "$115", "", "", "Mid-value"],
    ["Hoodie", "Premium Zip Up Hoodie", "42", "0", "42", "$75", "", "", "Swag"],
    ["Total", "", "317", "0", "317", "", "", "", ""],
    ["Swag budget (cap)", "$10,000", "", "", "", "", "", "", ""],
  ];
  const alloc = [
    ["Rep email", "Name", "Role", "Premium", "Mid-value", "Swag", "Premium redeemed", "Mid-value redeemed", "Swag redeemed"],
    ["Austin.Donohue@meetdandy.com", "Austin Donohue", "Strategic AE", "10", "6", "3", "1", "0", "0"],
    ["nick.golden@meetdandy.com", "Nick Golden", "Enterprise AE", "4", "", "2", "0", "0", "0"],
    ["Total", "", "", "14", "6", "5", "", "", ""],
    [],
    ["Not yet allocated (reserve)", "", "", "0", "0", "26"],
  ];
  const ord = [
    ["Timestamp", "Page", "Slug", "Variant", "Gift", "Email", "Rep email"],
    ["t1", "P", "a", "", "Branded AirPods kit", "x@x.com", "austin.donohue@meetdandy.com"],
    ["t2", "P", "b", "", "yeti mug and wireless charger duo", "y@x.com", "AUSTIN.DONOHUE@meetdandy.com"],
    ["t3", "P", "c", "", "Mystery gift", "z@x.com", "austin.donohue@meetdandy.com"],
    ["t4", "P", "d", "", "Premium Zip Up Hoodie", "w@x.com", "nick.golden@meetdandy.com"],
  ];
  it("maps tier labels", () => {
    expect([tierKey("Premium"), tierKey(" mid-tier"), tierKey("SWAG"), tierKey("other")]).toEqual(["premium", "mid", "swag", null]);
  });
  it("reads gift tiers from the Inventory tab", () => {
    expect([...parseInventoryTiers(inv)]).toEqual([["branded airpods kit", "premium"], ["yeti mug and wireless charger duo", "mid"], ["premium zip up hoodie", "swag"]]);
    expect(parseInventoryTiers(inventory).size).toBe(0);
  });
  it("reads allocations by email, ignoring formula columns and non-rep rows", () => {
    const a = parseAllocationsTab(alloc);
    expect([...a.keys()]).toEqual(["austin.donohue@meetdandy.com", "nick.golden@meetdandy.com"]);
    expect(a.get("austin.donohue@meetdandy.com")).toEqual({ email: "austin.donohue@meetdandy.com", name: "Austin Donohue", allocated: { premium: 10, mid: 6, swag: 3 } });
    expect(a.get("nick.golden@meetdandy.com")?.allocated).toEqual({ premium: 4, mid: 0, swag: 2 });
    expect(parseAllocationsTab([["Name", "Premium"]]).size).toBe(0);
  });
  it("summarises a rep's allocation against redemptions on their pages", () => {
    const data = { orders: parseOrdersTab(ord).orders, tiers: parseInventoryTiers(inv), allocations: parseAllocationsTab(alloc) };
    expect(repGiftSummary(data, "Austin.Donohue@meetdandy.com")).toEqual({
      allocated: true, name: "Austin Donohue", untiered: 1,
      tiers: [
        { tier: "premium", allocated: 10, redeemed: 1, remaining: 9 },
        { tier: "mid", allocated: 6, redeemed: 1, remaining: 5 },
        { tier: "swag", allocated: 3, redeemed: 0, remaining: 3 },
      ],
    });
    const stranger = repGiftSummary(data, "nobody@meetdandy.com");
    expect(stranger.allocated).toBe(false);
    expect(stranger.tiers.every((t) => t.allocated === 0 && t.redeemed === 0)).toBe(true);
  });
  it("reads an order's rep email when the column exists", () => {
    expect(parseOrdersTab(ord).orders[1].repEmail).toBe("austin.donohue@meetdandy.com");
    expect(parseOrdersTab(orders).orders[0].repEmail).toBe("");
  });
});

describe("fallback gifts", () => {
  const inv = [
    ["Kit", "Gift name on the form (must match)", "Ordered", "Tier"],
    ["", "Dandy Meta Ray-Bans", "2", "Premium"],
    ["", "Branded AirPods kit", "2", "Premium"],
    ["", "Yeti Mug and Wireless Charger Duo", "1", "Mid-value"],
    ["", "Premium Zip Up Hoodie", "5", "Swag"],
    ["", "Dandy Windbreaker", "1", "Swag"],
  ];
  const alloc = [["Rep email", "Premium", "Mid-value", "Swag"], ["a@x.com", "2", "1", "3"]];
  const sources = {
    premium: { options: [{ name: "Dandy Meta Ray-Bans", imageUrl: "m.png" }, { name: "Branded AirPods kit", imageUrl: "a.png" }], sizeOptions: [] },
    mid: { options: [{ name: "Yeti Mug and Wireless Charger Duo" }], sizeOptions: [] },
    swag: { options: [{ name: "Premium Zip Up Hoodie" }, { name: "Dandy Windbreaker" }], sizeOptions: ["S", "M", "L"] },
  };
  const build = (orderRows: string[][]) => {
    const values = [["Timestamp", "Page", "Slug", "Variant", "Gift", "Rep email", "Fallback"], ...orderRows];
    const { claimed, orders } = parseOrdersTab(values);
    return { stock: parseInventoryTab(inv), claimed, orders, tiers: parseInventoryTiers(inv), allocations: parseAllocationsTab(alloc) };
  };
  const o = (gift: string, fallback = "") => ["t", "P", "s", "", gift, "a@x.com", fallback];

  it("offers nothing while any of the page's gifts are in stock", () => {
    expect(pickFallback(build([o("Dandy Meta Ray-Bans")]), ["Dandy Meta Ray-Bans"], sources)).toBeNull();
  });
  it("offers other gifts of the same tier first", () => {
    const fb = pickFallback(build([o("Dandy Meta Ray-Bans"), o("Dandy Meta Ray-Bans")]), ["Dandy Meta Ray-Bans"], sources);
    expect(fb).toMatchObject({ kind: "tier", fromTier: "premium", options: [{ name: "Branded AirPods kit", imageUrl: "a.png" }] });
    expect(fallbackNote(fb!)).toMatch(/first choice/);
  });
  it("falls back to in-stock swag from the reserve when the tier is gone", () => {
    const fb = pickFallback(build([o("Yeti Mug and Wireless Charger Duo"), o("Dandy Windbreaker")]), ["Yeti Mug and Wireless Charger Duo"], sources);
    expect(fb).toMatchObject({ kind: "swag", fromTier: "mid", sizeOptions: ["S", "M", "L"], options: [{ name: "Premium Zip Up Hoodie" }] });
    expect(fallbackNote(fb!)).toBe("Our gifts went fast. Pick some Dandy gear instead.");
  });
  it("stops offering swag when the reserve is used up, and never falls back from swag", () => {
    // 6 swag ordered, 3 allocated → reserve 3; three fallback swag claims use it up.
    const gone = [o("Yeti Mug and Wireless Charger Duo"), o("Premium Zip Up Hoodie", "swag"), o("Premium Zip Up Hoodie", "swag"), o("Premium Zip Up Hoodie", "swag")];
    expect(swagReserveLeft(build(gone))).toBe(0);
    expect(pickFallback(build(gone), ["Yeti Mug and Wireless Charger Duo"], sources)).toBeNull();
    expect(pickFallback(build([o("Dandy Windbreaker")]), ["Dandy Windbreaker"], sources)).toBeNull();
  });
  it("counts fallback swag against the reserve, not the rep", () => {
    const s = repGiftSummary(build([o("Premium Zip Up Hoodie", "swag"), o("Premium Zip Up Hoodie")]), "a@x.com");
    expect(s.tiers.find((t) => t.tier === "swag")).toMatchObject({ redeemed: 1 });
  });
});
