// Public, read-only gift status for the Holiday Gift pages, read from the vendor
// order sheet the gift form's linked global form writes to (see
// lib/gift-sheet-status.ts):
//   GET /lp/gifts/availability?formId=   → { soldOut: string[] }
//   GET /lp/gifts/order-status?formId=&pageId= → { ordered, shipped, shipDate, gift }
//   GET /lp/gifts/fallback?formId=&pageId=     → gifts to offer when all of the page's gifts are gone
// Tenant comes from the request host (like the public GET /lp/forms/:id); only
// the sheet configured on that tenant's own form is read, and only booleans,
// gift names and a ship date leave. Cached 60s. Fails OPEN: if the sheet can't
// be read nothing is marked sold out and no order shows as shipped, so a sheet
// hiccup never blocks someone from claiming a gift.
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { and, eq } from "drizzle-orm";
import { db, lpFormsTable, lpPagesTable } from "@workspace/db";
import { getRequestHost } from "../../lib/requestHost";
import { findTenantByHost } from "../../lib/tenantHosts";
import { getIntegration } from "../../lib/lpIntegrationsStore";
import { readTabValues, type SheetsConfig } from "../../lib/google-sheets";
import { decideGiftClaim, fallbackNote, giftKey, orderStatusForSlug, pickFallback, parseAllocationsTab, parseInventoryTab, parseInventoryTiers, parseOrdersTab, soldOutGifts, type GiftSheetData, type GiftTierKey, type GiftTierSource } from "../../lib/gift-sheet-status";

const router = Router();
const limiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const INVENTORY_TAB = "Inventory";
const ALLOCATIONS_TAB = "Allocations";
// The Sales Console gifting wizard's source pages; their gift form names the sheet.
const GIFT_SOURCE_BY_TIER: Record<GiftTierKey, string> = { premium: "holiday-gifts-premium", mid: "holiday-gifts-mid", swag: "holiday-gifts-swag" };
const GIFT_SOURCE_SLUGS = Object.values(GIFT_SOURCE_BY_TIER);
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; data: GiftSheetData | null }>();

async function tenantFor(req: Parameters<typeof getRequestHost>[0]): Promise<number | null> {
  const authed = (req as { authUser?: { tenantId?: number | null } }).authUser?.tenantId;
  if (typeof authed === "number") return authed;
  const host = getRequestHost(req);
  const match = host ? await findTenantByHost(host) : null;
  return match?.tenantId ?? null;
}

/** The sheet a tenant's gift form writes to (the form's override on the tenant's Sheets integration), or null. */
export async function giftSheetConfig(tenantId: number, formId: number): Promise<SheetsConfig | null> {
  const [form] = await db
    .select({ sheetsConfig: lpFormsTable.sheetsConfig })
    .from(lpFormsTable)
    .where(and(eq(lpFormsTable.tenantId, tenantId), eq(lpFormsTable.id, formId)));
  const override = form?.sheetsConfig as { enabled?: boolean; sheetId?: string; tabName?: string } | null | undefined;
  const row = await getIntegration("google_sheets", tenantId);
  const base = row?.enabled ? (row.config as SheetsConfig) : null;
  if (override?.enabled === false || !base?.serviceAccountEmail || !base.privateKey) return null;
  const cfg: SheetsConfig = { ...base, sheetId: override?.sheetId?.trim() || base.sheetId, tabName: override?.tabName?.trim() || base.tabName };
  return cfg.sheetId ? cfg : null;
}

export async function loadSheet(tenantId: number, formId: number, fresh = false): Promise<GiftSheetData | null> {
  const key = `${tenantId}:${formId}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.data;
  let data: GiftSheetData | null = null;
  try {
    const cfg = await giftSheetConfig(tenantId, formId);
    if (cfg) {
      const [ordersValues, inventoryValues, allocationValues] = await Promise.all([
        readTabValues(cfg, cfg.tabName || "Leads"),
        readTabValues(cfg, INVENTORY_TAB).catch(() => [] as string[][]),
        readTabValues(cfg, ALLOCATIONS_TAB).catch(() => [] as string[][]),
      ]);
      const { claimed, orders } = parseOrdersTab(ordersValues);
      data = {
        stock: parseInventoryTab(inventoryValues), claimed, orders,
        tiers: parseInventoryTiers(inventoryValues), allocations: parseAllocationsTab(allocationValues),
      };
    }
  } catch (err) {
    console.error("gift-status: sheet read failed:", err);
  }
  cache.set(key, { at: Date.now(), data });
  return data;
}

function formIdOf(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

router.get("/lp/gifts/availability", limiter, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const formId = formIdOf(req.query.formId);
  const tenantId = formId ? await tenantFor(req) : null;
  const data = formId && tenantId ? await loadSheet(tenantId, formId) : null;
  if (!data) { res.json({ soldOut: [] }); return; }
  // Every gift the Inventory tab lists; the client matches names against its own picker.
  res.json({ soldOut: soldOutGifts(data.stock, data.claimed, [...data.stock.keys()]) });
});

router.get("/lp/gifts/order-status", limiter, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const none = { ordered: false, shipped: false, shipDate: "", gift: "" };
  const formId = formIdOf(req.query.formId);
  const pageId = formIdOf(req.query.pageId);
  const tenantId = formId && pageId ? await tenantFor(req) : null;
  if (!formId || !pageId || !tenantId) { res.json(none); return; }
  const [page] = await db
    .select({ slug: lpPagesTable.slug })
    .from(lpPagesTable)
    .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId)));
  const data = page ? await loadSheet(tenantId, formId) : null;
  res.json(data && page ? orderStatusForSlug(data.orders, page.slug) : none);
});

/** The gift form the wizard's source pages use (first one found), or null. */
export async function giftSourceFormId(tenantId: number): Promise<number | null> {
  for (const slug of GIFT_SOURCE_SLUGS) {
    const [page] = await db
      .select({ blocks: lpPagesTable.blocks })
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.slug, slug)));
    const blocks = Array.isArray(page?.blocks) ? (page.blocks as Array<{ type?: string; props?: { formId?: unknown } }>) : [];
    const id = formIdOf(blocks.find((b) => b?.type === "gift-form")?.props?.formId);
    if (id) return id;
  }
  return null;
}

type BlockLike = { type?: string; props?: Record<string, unknown> };
const blocksOf = (raw: unknown): BlockLike[] => (Array.isArray(raw) ? (raw as BlockLike[]) : []);

/** The gift names a page offers: its picker's options, else its form's. */
function pageGiftNames(rawBlocks: unknown): string[] {
  const blocks = blocksOf(rawBlocks);
  const fromPicker = blocks.find((b) => b?.type === "gift-picker")?.props?.options;
  if (Array.isArray(fromPicker) && fromPicker.length) return fromPicker.map((o) => String((o as { name?: unknown })?.name ?? "").trim()).filter(Boolean);
  const fromForm = blocks.find((b) => b?.type === "gift-form")?.props?.options;
  return Array.isArray(fromForm) ? fromForm.map((o) => String(o ?? "").trim()).filter(Boolean) : [];
}

/** Each tier's full gift set (picker cards + swag sizes) from the wizard's source pages. */
async function giftTierSources(tenantId: number): Promise<Partial<Record<GiftTierKey, GiftTierSource>>> {
  const out: Partial<Record<GiftTierKey, GiftTierSource>> = {};
  for (const [tier, slug] of Object.entries(GIFT_SOURCE_BY_TIER) as Array<[GiftTierKey, string]>) {
    const [page] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.slug, slug)));
    if (!page) continue;
    const blocks = blocksOf(page.blocks);
    const options = blocks.find((b) => b?.type === "gift-picker")?.props?.options;
    const sizes = blocks.find((b) => b?.type === "gift-form")?.props?.sizeOptions;
    out[tier] = {
      options: Array.isArray(options) ? (options as Array<{ name: string }>).filter((o) => typeof o?.name === "string" && o.name.trim()) : [],
      sizeOptions: Array.isArray(sizes) ? sizes.map((x) => String(x).trim()).filter(Boolean) : [],
    };
  }
  return out;
}

router.get("/lp/gifts/fallback", limiter, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const none = { kind: null };
  const formId = formIdOf(req.query.formId);
  const pageId = formIdOf(req.query.pageId);
  const tenantId = formId && pageId ? await tenantFor(req) : null;
  if (!formId || !pageId || !tenantId) { res.json(none); return; }
  try {
    const [page] = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable).where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId)));
    const data = page ? await loadSheet(tenantId, formId) : null;
    const fb = data && page ? pickFallback(data, pageGiftNames(page.blocks), await giftTierSources(tenantId)) : null;
    res.json(fb ? { kind: fb.kind, tier: fb.tier, note: fallbackNote(fb), options: fb.options, sizeOptions: fb.sizeOptions } : none);
  } catch (err) {
    console.error("gift-status: fallback failed:", err);
    res.json(none);
  }
});

/**
 * Called by POST /lp/leads before a gift-form submission is stored: re-reads the
 * sheet (no cache) and refuses a second order from the same page or a gift that
 * has sold out since the page loaded. Null = go ahead; also null whenever the
 * page has no gift form or the sheet can't be read (fail open).
 */
export async function checkGiftClaim(args: { tenantId: number; blocks: unknown; slug: string; fields: Record<string, unknown> }): Promise<{ code: "already_ordered" | "gift_sold_out"; gift: string } | null> {
  try {
    const block = Array.isArray(args.blocks)
      ? (args.blocks as Array<{ type?: string; props?: { formId?: unknown } }>).find((b) => b?.type === "gift-form")
      : undefined;
    const formId = Number(block?.props?.formId);
    const gift = typeof args.fields.Gift === "string" ? args.fields.Gift.trim() : "";
    if (!block || !Number.isInteger(formId) || formId <= 0 || !gift) return null;
    const data = await loadSheet(args.tenantId, formId, true);
    if (!data) return null;
    const issue = decideGiftClaim(data, args.slug, gift);
    if (issue) return issue;
    // A gift the page doesn't offer is only allowed as the page's fallback; the
    // server, not the browser, decides which kind it is (swag comes off the reserve).
    const own = pageGiftNames(args.blocks);
    delete args.fields.Fallback;
    if (own.length && !own.some((g) => giftKey(g) === giftKey(gift))) {
      const fb = pickFallback(data, own, await giftTierSources(args.tenantId));
      if (!fb || !fb.options.some((o) => giftKey(o.name) === giftKey(gift))) return { code: "gift_sold_out", gift };
      args.fields.Fallback = fb.kind;
    }
    return null;
  } catch (err) {
    console.error("gift-status: claim check failed:", err);
    return null;
  }
}

export default router;
