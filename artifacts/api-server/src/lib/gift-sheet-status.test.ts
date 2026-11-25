import { describe, expect, it } from "vitest";
import { orderStatusForSlug, parseInventoryTab, parseOrdersTab, soldOutGifts } from "./gift-sheet-status";

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
