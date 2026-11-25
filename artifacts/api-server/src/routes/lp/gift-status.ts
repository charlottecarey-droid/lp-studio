// Public, read-only gift status for the Holiday Gift pages, read from the vendor
// order sheet the gift form's linked global form writes to (see
// lib/gift-sheet-status.ts):
//   GET /lp/gifts/availability?formId=   → { soldOut: string[] }
//   GET /lp/gifts/order-status?formId=&pageId= → { ordered, shipped, shipDate, gift }
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
import { decideGiftClaim, orderStatusForSlug, parseInventoryTab, parseOrdersTab, soldOutGifts, type GiftSheetData } from "../../lib/gift-sheet-status";

const router = Router();
const limiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const INVENTORY_TAB = "Inventory";
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; data: GiftSheetData | null }>();

async function tenantFor(req: Parameters<typeof getRequestHost>[0]): Promise<number | null> {
  const authed = (req as { authUser?: { tenantId?: number | null } }).authUser?.tenantId;
  if (typeof authed === "number") return authed;
  const host = getRequestHost(req);
  const match = host ? await findTenantByHost(host) : null;
  return match?.tenantId ?? null;
}

async function loadSheet(tenantId: number, formId: number, fresh = false): Promise<GiftSheetData | null> {
  const key = `${tenantId}:${formId}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.data;
  let data: GiftSheetData | null = null;
  try {
    const [form] = await db
      .select({ sheetsConfig: lpFormsTable.sheetsConfig })
      .from(lpFormsTable)
      .where(and(eq(lpFormsTable.tenantId, tenantId), eq(lpFormsTable.id, formId)));
    const override = form?.sheetsConfig as { enabled?: boolean; sheetId?: string; tabName?: string } | null | undefined;
    const row = await getIntegration("google_sheets", tenantId);
    const base = row?.enabled ? (row.config as SheetsConfig) : null;
    if (override?.enabled !== false && base?.serviceAccountEmail && base.privateKey) {
      const cfg: SheetsConfig = { ...base, sheetId: override?.sheetId?.trim() || base.sheetId, tabName: override?.tabName?.trim() || base.tabName };
      if (cfg.sheetId) {
        const [ordersValues, inventoryValues] = await Promise.all([
          readTabValues(cfg, cfg.tabName || "Leads"),
          readTabValues(cfg, INVENTORY_TAB).catch(() => [] as string[][]),
        ]);
        const { claimed, orders } = parseOrdersTab(ordersValues);
        data = { stock: parseInventoryTab(inventoryValues), claimed, orders };
      }
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
    return data ? decideGiftClaim(data, args.slug, gift) : null;
  } catch (err) {
    console.error("gift-status: claim check failed:", err);
    return null;
  }
}

export default router;
