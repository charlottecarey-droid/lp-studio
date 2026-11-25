/**
 * Gift stock + shipping status, read from the vendor order sheet.
 *
 * Two tabs of the spreadsheet a gift form's `sheets_config` points at:
 *  - the orders tab (e.g. "Holiday Gifts"): one row per claim, with `Gift`,
 *    `Slug` (the recipient's page) and, once the vendor ships, `Ship date`;
 *  - "Inventory": `Gift name on the form` + `Ordered` quantity per gift.
 * A gift is sold out when claims reach its Ordered quantity. Columns are found
 * by header name, so reordering the sheet or adding columns is safe. Pure
 * functions only; the route does the reading and caching.
 */

export interface GiftOrderRow { slug: string; gift: string; shipDate: string; repEmail: string }
export type GiftTierKey = "premium" | "mid" | "swag";
export const GIFT_TIER_KEYS: GiftTierKey[] = ["premium", "mid", "swag"];
export interface RepAllocation { email: string; name: string; allocated: Record<GiftTierKey, number> }
export interface GiftSheetData {
  stock: Map<string, number>;
  claimed: Map<string, number>;
  orders: GiftOrderRow[];
  /** Gift name (lowercased) → tier, from the Inventory tab's optional Tier column. */
  tiers?: Map<string, GiftTierKey>;
  /** Rep email (lowercased) → allocation, from the optional Allocations tab. */
  allocations?: Map<string, RepAllocation>;
}

const cell = (row: string[] | undefined, i: number): string => (i >= 0 && row ? String(row[i] ?? "").trim() : "");
export const giftKey = (name: string): string => name.trim().toLowerCase();

/** Gift name (lowercased) → Ordered quantity. Rows without a name or a number are skipped (e.g. Total). */
export function parseInventoryTab(values: string[][]): Map<string, number> {
  const out = new Map<string, number>();
  const headerIdx = values.findIndex((r) => r.some((c) => /^ordered$/i.test(String(c).trim())));
  if (headerIdx < 0) return out;
  const header = values[headerIdx].map((c) => String(c).trim());
  const nameCol = header.findIndex((h) => /^gift name/i.test(h));
  const qtyCol = header.findIndex((h) => /^ordered$/i.test(h));
  if (nameCol < 0 || qtyCol < 0) return out;
  for (const row of values.slice(headerIdx + 1)) {
    const name = cell(row, nameCol);
    const qty = Number(cell(row, qtyCol).replace(/[$,\s]/g, ""));
    if (!name || !Number.isFinite(qty)) continue;
    out.set(giftKey(name), qty);
  }
  return out;
}

/** Orders tab → claim counts per gift and one entry per order row. */
export function parseOrdersTab(values: string[][]): { claimed: Map<string, number>; orders: GiftOrderRow[] } {
  const claimed = new Map<string, number>();
  const orders: GiftOrderRow[] = [];
  const header = (values[0] ?? []).map((c) => String(c).trim());
  const giftCol = header.findIndex((h) => /^gift$/i.test(h));
  const slugCol = header.findIndex((h) => /^slug$/i.test(h));
  const shipCol = header.findIndex((h) => /^ship(ped)?([ _-]?date)?$/i.test(h));
  const repCol = header.findIndex((h) => /^rep[ _-]?email$/i.test(h));
  if (giftCol < 0) return { claimed, orders };
  for (const row of values.slice(1)) {
    const gift = cell(row, giftCol);
    if (!gift) continue;
    claimed.set(giftKey(gift), (claimed.get(giftKey(gift)) ?? 0) + 1);
    orders.push({ slug: cell(row, slugCol), gift, shipDate: cell(row, shipCol), repEmail: cell(row, repCol).toLowerCase() });
  }
  return { claimed, orders };
}

/** Gifts whose claims have reached the ordered quantity. Gifts not on the Inventory tab are never sold out. */
export function soldOutGifts(stock: Map<string, number>, claimed: Map<string, number>, names: Iterable<string>): string[] {
  const out: string[] = [];
  for (const name of names) {
    const ordered = stock.get(giftKey(name));
    if (ordered !== undefined && (claimed.get(giftKey(name)) ?? 0) >= ordered) out.push(name);
  }
  return out;
}

/** The recipient page's order: whether one exists, and whether the vendor has shipped it. */
export function orderStatusForSlug(orders: GiftOrderRow[], slug: string): { ordered: boolean; shipped: boolean; shipDate: string; gift: string } {
  const mine = orders.filter((o) => o.slug === slug);
  if (mine.length === 0) return { ordered: false, shipped: false, shipDate: "", gift: "" };
  const shipped = mine.find((o) => o.shipDate);
  const row = shipped ?? mine[mine.length - 1];
  return { ordered: true, shipped: !!shipped, shipDate: shipped?.shipDate ?? "", gift: row.gift };
}

/**
 * Submit-time guard for a gift claim: a page that already has an order can't
 * place another, and a gift that has sold out since the page loaded can't be
 * claimed. Null when the claim may go ahead.
 */
export function decideGiftClaim(data: GiftSheetData, slug: string, gift: string): { code: "already_ordered" | "gift_sold_out"; gift: string } | null {
  const status = orderStatusForSlug(data.orders, slug);
  if (status.ordered) return { code: "already_ordered", gift: status.gift };
  if (soldOutGifts(data.stock, data.claimed, [gift]).length > 0) return { code: "gift_sold_out", gift };
  return null;
}

/** "Premium" / "Mid-value" / "Mid-tier" / "Swag" (any case) → tier key; anything else → null. */
export function tierKey(raw: string): GiftTierKey | null {
  const s = raw.trim().toLowerCase();
  if (s.startsWith("prem")) return "premium";
  if (s.startsWith("mid")) return "mid";
  if (s.startsWith("swag")) return "swag";
  return null;
}

/** Inventory tab's Tier column: gift name (lowercased) → tier. Empty when the column is missing. */
export function parseInventoryTiers(values: string[][]): Map<string, GiftTierKey> {
  const out = new Map<string, GiftTierKey>();
  const headerIdx = values.findIndex((r) => r.some((c) => /^ordered$/i.test(String(c).trim())));
  if (headerIdx < 0) return out;
  const header = values[headerIdx].map((c) => String(c).trim());
  const nameCol = header.findIndex((h) => /^gift name/i.test(h));
  const tierCol = header.findIndex((h) => /^tier$/i.test(h));
  if (nameCol < 0 || tierCol < 0) return out;
  for (const row of values.slice(headerIdx + 1)) {
    const name = cell(row, nameCol);
    const tier = tierKey(cell(row, tierCol));
    if (name && tier) out.set(giftKey(name), tier);
  }
  return out;
}

/**
 * Allocations tab: one row per rep with `Rep email` and per-tier columns headed
 * exactly `Premium`, `Mid-value` (or Mid-tier / Mid) and `Swag`. Columns such as
 * "Premium redeemed" are the sheet's own formulas and are ignored here. Rows
 * without an email (Total, Inventory, notes) are skipped; blank counts are 0.
 */
export function parseAllocationsTab(values: string[][]): Map<string, RepAllocation> {
  const out = new Map<string, RepAllocation>();
  const header = (values[0] ?? []).map((c) => String(c).trim());
  const emailCol = header.findIndex((h) => /^rep[ _-]?email$/i.test(h));
  const nameCol = header.findIndex((h) => /^(rep[ _-]?)?name$/i.test(h));
  const cols: Record<GiftTierKey, number> = {
    premium: header.findIndex((h) => /^premium$/i.test(h)),
    mid: header.findIndex((h) => /^mid([ _-]?(value|tier))?$/i.test(h)),
    swag: header.findIndex((h) => /^swag$/i.test(h)),
  };
  if (emailCol < 0) return out;
  for (const row of values.slice(1)) {
    const email = cell(row, emailCol).toLowerCase();
    if (!email.includes("@")) continue;
    const allocated = { premium: 0, mid: 0, swag: 0 } as Record<GiftTierKey, number>;
    for (const t of GIFT_TIER_KEYS) {
      const n = Number(cell(row, cols[t]).replace(/[,\s]/g, ""));
      allocated[t] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }
    out.set(email, { email, name: cell(row, nameCol), allocated });
  }
  return out;
}

export interface RepGiftSummary {
  /** False when the rep has no row on the Allocations tab. */
  allocated: boolean;
  name: string;
  tiers: Array<{ tier: GiftTierKey; allocated: number; redeemed: number; remaining: number }>;
  /** Redemptions whose gift isn't on the Inventory tab's Tier column (counted nowhere above). */
  untiered: number;
}

/** A rep's allocation against the claims made on their pages (matched by the order's Rep email). */
export function repGiftSummary(data: Pick<GiftSheetData, "orders" | "tiers" | "allocations">, email: string): RepGiftSummary {
  const key = email.trim().toLowerCase();
  const alloc = data.allocations?.get(key);
  const redeemed: Record<GiftTierKey, number> = { premium: 0, mid: 0, swag: 0 };
  let untiered = 0;
  for (const o of data.orders) {
    if (!key || o.repEmail !== key) continue;
    const tier = data.tiers?.get(giftKey(o.gift));
    if (tier) redeemed[tier] += 1; else untiered += 1;
  }
  return {
    allocated: !!alloc,
    name: alloc?.name ?? "",
    tiers: GIFT_TIER_KEYS.map((tier) => {
      const a = alloc?.allocated[tier] ?? 0;
      return { tier, allocated: a, redeemed: redeemed[tier], remaining: a - redeemed[tier] };
    }),
    untiered,
  };
}
