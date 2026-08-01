import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { randomBytes } from "crypto";
import rateLimit from "express-rate-limit";
import { eq, and, or, desc, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesHotlinksTable,
  salesContactsTable,
  salesAccountsTable,
  salesBriefingsTable,
  salesSignalsTable,
  salesEmailSendsTable,
  lpPagesTable,
  lpPageVisitsTable,
} from "@workspace/db";
import { deriveCompanyName, derivePracticeCount } from "../../lib/businessCaseVars";
import { broadcastSignal } from "./signals";
import { sfdcService } from "../../lib/sfdc-service";
import { marketoService } from "../../lib/marketo-service";
import { slackService } from "../../lib/slack-service";
import { logger } from "../../lib/logger";
import { resolveTenantSender } from "../../lib/tenantSender";

const router = Router();

// Bot/prefetch tolerance — mirrors campaigns.ts. Gmail / Apple Mail Privacy
// proxies prefetch links within milliseconds of send; ignore open/click stamps
// inside this window so the feed reflects real recipient activity, not scanners.
const RESOLVE_BOT_GRACE_MS = 2000;
function isLikelyResolveBot(sentAt: Date | null | undefined): boolean {
  if (!sentAt) return false;
  return Date.now() - new Date(sentAt).getTime() < RESOLVE_BOT_GRACE_MS;
}

// ─── Visit alert email ──────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendVisitAlert(
  recipients: string[],
  opts: { tenantId: number; contactName: string; company?: string | null; pageTitle: string; pageSlug: string; visitedAt: string },
): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey || recipients.length === 0) return;
  // Every tenant has a working default sender (Tier 1 shared domain), so this
  // always resolves a usable from — no "is a domain configured?" guard needed.
  const sender = await resolveTenantSender(opts.tenantId, "notifications");
  const fromAddr = sender.from;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,sans-serif;background:#f8fafc;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1)">
  <div style="background:#003A30;padding:24px 32px">
    <h1 style="margin:0;color:#C7E738;font-size:20px">Personalized Link Visited</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:14px">${escapeHtml(opts.pageTitle)}</p>
  </div>
  <div style="padding:24px 32px">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tbody>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#003A30;white-space:nowrap">Contact</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#333">${escapeHtml(opts.contactName)}</td>
        </tr>
        ${opts.company ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#003A30;white-space:nowrap">Company</td><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#333">${escapeHtml(opts.company)}</td></tr>` : ""}
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#003A30;white-space:nowrap">Page</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#333">${escapeHtml(opts.pageSlug)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;font-weight:600;color:#003A30;white-space:nowrap">Visited At</td>
          <td style="padding:8px 12px;color:#333">${new Date(opts.visitedAt).toLocaleString()}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddr,
        ...(sender.replyTo ? { reply_to: sender.replyTo } : {}),
        to: recipients,
        subject: `${opts.contactName} just viewed your page`,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      logger.error({ status: res.status, body, recipients }, "Resend rejected visit alert");
    } else {
      logger.info({ recipients, contactName: opts.contactName }, "Visit alert sent");
    }
  } catch (err) {
    logger.error({ err }, "Failed to send visit alert email (network error)");
  }
}

// ─── GET /microsites/overview — page-centric, hotlinks optional ─────────────
router.get("/microsites/overview", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    // 1. All tenant LP pages (non-template), left-join account
    // Join priority: account_id (integer FK) first, then sfdc_account_id (stable SFDC ID).
    // This means pages survive account delete+re-sync as long as sfdc_account_id is stored.
    const pages = await db
      .select({
        pageId: lpPagesTable.id,
        pageTitle: lpPagesTable.title,
        pageSlug: lpPagesTable.slug,
        pageStatus: lpPagesTable.status,
        pageUpdatedAt: lpPagesTable.updatedAt,
        sfdcAccountId: lpPagesTable.sfdcAccountId,
        accountId: salesAccountsTable.id,
        accountName: salesAccountsTable.name,
        accountOwner: salesAccountsTable.owner,
      })
      .from(lpPagesTable)
      .leftJoin(salesAccountsTable, and(
        eq(salesAccountsTable.tenantId, tenantId),
        or(
          eq(lpPagesTable.accountId, salesAccountsTable.id),
          and(
            isNotNull(lpPagesTable.sfdcAccountId),
            eq(lpPagesTable.sfdcAccountId, salesAccountsTable.salesforceId),
          ),
        ),
      ))
      .where(and(
        eq(lpPagesTable.tenantId, tenantId),
        eq(lpPagesTable.isTemplate, false),
      ))
      .orderBy(salesAccountsTable.name, desc(lpPagesTable.updatedAt));

    if (pages.length === 0) { res.json([]); return; }

    // 2. Hotlinks for these pages — LEFT JOIN so orphaned hotlinks (null contactId after SFDC re-sync) still appear
    const pageIds = [...new Set(pages.map(p => p.pageId))];
    const hotlinks = await db
      .select({
        hotlinkId: salesHotlinksTable.id,
        token: salesHotlinksTable.token,
        pageId: salesHotlinksTable.pageId,
        contactId: salesContactsTable.id,
        contactFirst: salesContactsTable.firstName,
        contactLast: salesContactsTable.lastName,
        sfdcContactId: salesHotlinksTable.sfdcContactId,
      })
      .from(salesHotlinksTable)
      .leftJoin(salesContactsTable, and(
        eq(salesHotlinksTable.contactId, salesContactsTable.id),
        eq(salesContactsTable.tenantId, tenantId),
      ))
      .where(and(
        inArray(salesHotlinksTable.pageId, pageIds),
        eq(salesHotlinksTable.isActive, true),
      ));

    // For orphaned hotlinks (contactId null), try to resolve name via sfdcContactId
    const orphanSfdcIds = hotlinks
      .filter(hl => !hl.contactId && hl.sfdcContactId)
      .map(hl => hl.sfdcContactId!);
    const sfdcNameMap = new Map<string, string>();
    if (orphanSfdcIds.length > 0) {
      const sfdcContacts = await db
        .select({ sfdcId: salesContactsTable.salesforceId, first: salesContactsTable.firstName, last: salesContactsTable.lastName })
        .from(salesContactsTable)
        .where(and(
          eq(salesContactsTable.tenantId, tenantId),
          inArray(salesContactsTable.salesforceId, orphanSfdcIds),
        ));
      for (const c of sfdcContacts) {
        if (c.sfdcId) sfdcNameMap.set(c.sfdcId, [c.first, c.last].filter(Boolean).join(" ").trim());
      }
    }

    // Index hotlinks by pageId, combining first+last into contactName
    type HotlinkMapped = { hotlinkId: number | null; token: string; pageId: number | null; contactId: number; contactName: string };
    const hotlinksByPage = new Map<number, HotlinkMapped[]>();
    for (const hl of hotlinks) {
      if (!hl.pageId) continue;
      if (!hotlinksByPage.has(hl.pageId)) hotlinksByPage.set(hl.pageId, []);
      hotlinksByPage.get(hl.pageId)!.push({
        hotlinkId: hl.hotlinkId,
        token: hl.token,
        pageId: hl.pageId,
        contactId: hl.contactId ?? 0,
        contactName: [hl.contactFirst, hl.contactLast].filter(Boolean).join(" ").trim()
          || (hl.sfdcContactId ? sfdcNameMap.get(hl.sfdcContactId) ?? "" : ""),
      });
    }

    // 3. Group pages by account (null accountId → "unattached" bucket with id=-1)
    type PageEntry = { pageId: number; pageTitle: string; pageSlug: string; pageStatus: string; pageUpdatedAt: Date; hotlinks: HotlinkMapped[] };
    type AccountEntry = { accountId: number; accountName: string; accountOwner: string | null; pages: Map<number, PageEntry> };
    const accountMap = new Map<number, AccountEntry>();

    for (const row of pages) {
      const acctId = row.accountId ?? -1;
      const acctName = row.accountName ?? "General";
      if (!accountMap.has(acctId)) {
        accountMap.set(acctId, { accountId: acctId, accountName: acctName, accountOwner: row.accountOwner ?? null, pages: new Map() });
      }
      const acct = accountMap.get(acctId)!;
      if (!acct.pages.has(row.pageId)) {
        acct.pages.set(row.pageId, {
          pageId: row.pageId,
          pageTitle: row.pageTitle,
          pageSlug: row.pageSlug,
          pageStatus: row.pageStatus,
          pageUpdatedAt: row.pageUpdatedAt,
          hotlinks: hotlinksByPage.get(row.pageId) ?? [],
        });
      }
    }

    const result = Array.from(accountMap.values()).map(acct => ({
      accountId: acct.accountId,
      accountName: acct.accountName,
      accountOwner: acct.accountOwner,
      pages: Array.from(acct.pages.values()),
    }));

    res.json(result);
  } catch (err) {
    logger.error({ err }, "GET /sales/microsites/overview error");
    res.status(500).json({ error: "Failed to load microsites overview" });
  }
});

/**
 * Sales Pages view — flat per-page rows with the analytics a rep scans daily.
 *
 * Unlike /microsites/overview (account-grouped, no analytics), this returns
 * ONE row per non-template page with:
 *   - creator/editor attribution (created_by/updated_by) so the client can
 *     default-sort the rep's own pages first,
 *   - a 30-day stat block from lp_page_visits (views, unique sessions, avg
 *     time-on-page from the dwell beacon — null until data accrues),
 *   - all-time last visit,
 *   - KNOWN viewers: contacts whose hotlink page_view signals hit this page
 *     (top 6 by recency + the distinct total),
 *   - the page's active hotlinks (same shape the microsites view uses).
 *
 * Four batched queries total (pages, visit stats ×2, signals, hotlinks) —
 * never per-page fan-out. All aggregations ride existing composite indexes
 * (lp_page_visits page_id+created_at, sales_signals tenant+created).
 */
router.get("/pages/overview", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const WINDOW_DAYS = 30;
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  try {
    const pages = await db
      .select({
        pageId: lpPagesTable.id,
        pageTitle: lpPagesTable.title,
        pageSlug: lpPagesTable.slug,
        pageStatus: lpPagesTable.status,
        pageUpdatedAt: lpPagesTable.updatedAt,
        pageCreatedAt: lpPagesTable.createdAt,
        createdBy: lpPagesTable.createdBy,
        updatedBy: lpPagesTable.updatedBy,
        accountId: salesAccountsTable.id,
        accountName: salesAccountsTable.name,
        accountOwner: salesAccountsTable.owner,
      })
      .from(lpPagesTable)
      .leftJoin(salesAccountsTable, and(
        eq(salesAccountsTable.tenantId, tenantId),
        or(
          eq(lpPagesTable.accountId, salesAccountsTable.id),
          and(
            isNotNull(lpPagesTable.sfdcAccountId),
            eq(lpPagesTable.sfdcAccountId, salesAccountsTable.salesforceId),
          ),
        ),
      ))
      .where(and(
        eq(lpPagesTable.tenantId, tenantId),
        eq(lpPagesTable.isTemplate, false),
      ))
      .orderBy(desc(lpPagesTable.updatedAt));

    if (pages.length === 0) {
      res.json({ windowDays: WINDOW_DAYS, pages: [] });
      return;
    }
    const pageIds = [...new Set(pages.map((p) => p.pageId))];

    // Windowed visit stats. avg() over dwell_seconds ignores NULLs by SQL
    // semantics, so pre-dwell visits never drag the average down; the sample
    // count lets the client suppress the metric until it means something.
    const windowStats = await db
      .select({
        pageId: lpPageVisitsTable.pageId,
        views: sql<number>`count(*)::int`,
        uniques: sql<number>`count(distinct ${lpPageVisitsTable.sessionId})::int`,
        avgDwellSeconds: sql<number | null>`round(avg(${lpPageVisitsTable.dwellSeconds}))::int`,
        dwellSamples: sql<number>`count(${lpPageVisitsTable.dwellSeconds})::int`,
      })
      .from(lpPageVisitsTable)
      .where(and(inArray(lpPageVisitsTable.pageId, pageIds), gte(lpPageVisitsTable.createdAt, since)))
      .groupBy(lpPageVisitsTable.pageId);

    // All-time last visit (not window-scoped — "last seen 6 weeks ago" is
    // more useful to a rep than a blank).
    const lastVisits = await db
      .select({
        pageId: lpPageVisitsTable.pageId,
        lastVisitAt: sql<string>`max(${lpPageVisitsTable.createdAt})`,
      })
      .from(lpPageVisitsTable)
      .where(inArray(lpPageVisitsTable.pageId, pageIds))
      .groupBy(lpPageVisitsTable.pageId);

    // Known viewers: hotlink page_view signals joined back to the contact.
    const knownRows = await db
      .select({
        pageId: salesHotlinksTable.pageId,
        contactId: salesContactsTable.id,
        firstName: salesContactsTable.firstName,
        lastName: salesContactsTable.lastName,
        views: sql<number>`count(*)::int`,
        lastViewedAt: sql<string>`max(${salesSignalsTable.createdAt})`,
      })
      .from(salesSignalsTable)
      .innerJoin(salesHotlinksTable, eq(salesSignalsTable.hotlinkId, salesHotlinksTable.id))
      .innerJoin(salesContactsTable, eq(salesSignalsTable.contactId, salesContactsTable.id))
      .where(and(
        eq(salesSignalsTable.tenantId, tenantId),
        eq(salesSignalsTable.type, "page_view"),
        inArray(salesHotlinksTable.pageId, pageIds),
      ))
      .groupBy(
        salesHotlinksTable.pageId,
        salesContactsTable.id,
        salesContactsTable.firstName,
        salesContactsTable.lastName,
      );

    const hotlinks = await db
      .select({
        hotlinkId: salesHotlinksTable.id,
        token: salesHotlinksTable.token,
        pageId: salesHotlinksTable.pageId,
        contactId: salesContactsTable.id,
        contactFirst: salesContactsTable.firstName,
        contactLast: salesContactsTable.lastName,
      })
      .from(salesHotlinksTable)
      .leftJoin(salesContactsTable, and(
        eq(salesHotlinksTable.contactId, salesContactsTable.id),
        eq(salesContactsTable.tenantId, tenantId),
      ))
      .where(and(
        inArray(salesHotlinksTable.pageId, pageIds),
        eq(salesHotlinksTable.isActive, true),
      ));

    const statsByPage = new Map(windowStats.map((s) => [s.pageId, s]));
    const lastVisitByPage = new Map(lastVisits.map((s) => [s.pageId, s.lastVisitAt]));

    type KnownViewer = { contactId: number; name: string; views: number; lastViewedAt: string };
    const knownByPage = new Map<number, KnownViewer[]>();
    for (const row of knownRows) {
      if (!row.pageId) continue;
      const list = knownByPage.get(row.pageId) ?? [];
      list.push({
        contactId: row.contactId,
        name: [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || "Unknown contact",
        views: row.views,
        lastViewedAt: row.lastViewedAt,
      });
      knownByPage.set(row.pageId, list);
    }
    for (const list of knownByPage.values()) {
      list.sort((a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime());
    }

    type HotlinkOut = { hotlinkId: number; token: string; contactId: number | null; contactName: string };
    const hotlinksByPage = new Map<number, HotlinkOut[]>();
    for (const hl of hotlinks) {
      if (!hl.pageId) continue;
      const list = hotlinksByPage.get(hl.pageId) ?? [];
      list.push({
        hotlinkId: hl.hotlinkId,
        token: hl.token,
        contactId: hl.contactId ?? null,
        contactName: [hl.contactFirst, hl.contactLast].filter(Boolean).join(" ").trim(),
      });
      hotlinksByPage.set(hl.pageId, list);
    }

    res.json({
      windowDays: WINDOW_DAYS,
      pages: pages.map((p) => {
        const stats = statsByPage.get(p.pageId);
        const known = knownByPage.get(p.pageId) ?? [];
        return {
          pageId: p.pageId,
          pageTitle: p.pageTitle,
          pageSlug: p.pageSlug,
          pageStatus: p.pageStatus,
          pageUpdatedAt: p.pageUpdatedAt,
          pageCreatedAt: p.pageCreatedAt,
          createdBy: p.createdBy,
          updatedBy: p.updatedBy,
          accountId: p.accountId ?? null,
          accountName: p.accountName ?? null,
          views: stats?.views ?? 0,
          uniques: stats?.uniques ?? 0,
          avgDwellSeconds: stats && stats.dwellSamples > 0 ? stats.avgDwellSeconds : null,
          dwellSamples: stats?.dwellSamples ?? 0,
          lastVisitAt: lastVisitByPage.get(p.pageId) ?? null,
          knownViewerCount: known.length,
          knownViewers: known.slice(0, 6),
          hotlinks: hotlinksByPage.get(p.pageId) ?? [],
        };
      }),
    });
  } catch (err) {
    logger.error({ err }, "GET /sales/pages/overview error");
    res.status(500).json({ error: "Failed to load pages overview" });
  }
});

/**
 * Sales Pages drill-down — the engagement slice the marketing analytics
 * endpoints don't cover: per-HOTLINK view counts, the page's full known-viewer
 * list (the overview caps at 6), and the dwell average with a prior-period
 * comparison. The drill-down pairs this with the marketing per-page endpoints
 * (/lp/analytics/pages/:id/summary|traffic-sources|visits), which are equally
 * tenant-scoped and already de-anonymize form-filling visitors.
 */
router.get("/pages/:pageId/engagement", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const pageId = parseInt(String(req.params.pageId), 10);
  if (isNaN(pageId)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  const days = Math.min(365, Math.max(1, parseInt(String(req.query.days ?? "30"), 10) || 30));
  const now = Date.now();
  const curStart = new Date(now - days * 86_400_000);
  const prevStart = new Date(now - 2 * days * 86_400_000);
  try {
    const [page] = await db
      .select({ id: lpPagesTable.id })
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId)));
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    const [linkRows, viewerRows, dwellRows] = await Promise.all([
      // Active hotlinks + all-time view count / last view per link. LEFT JOIN
      // signals so never-clicked links still list with 0 views.
      db
        .select({
          hotlinkId: salesHotlinksTable.id,
          token: salesHotlinksTable.token,
          createdAt: salesHotlinksTable.createdAt,
          contactId: salesContactsTable.id,
          contactFirst: salesContactsTable.firstName,
          contactLast: salesContactsTable.lastName,
          views: sql<number>`count(${salesSignalsTable.id})::int`,
          lastViewedAt: sql<string | null>`max(${salesSignalsTable.createdAt})`,
        })
        .from(salesHotlinksTable)
        .leftJoin(salesContactsTable, and(
          eq(salesHotlinksTable.contactId, salesContactsTable.id),
          eq(salesContactsTable.tenantId, tenantId),
        ))
        .leftJoin(salesSignalsTable, and(
          eq(salesSignalsTable.hotlinkId, salesHotlinksTable.id),
          eq(salesSignalsTable.type, "page_view"),
        ))
        .where(and(eq(salesHotlinksTable.pageId, pageId), eq(salesHotlinksTable.isActive, true)))
        .groupBy(
          salesHotlinksTable.id,
          salesHotlinksTable.token,
          salesHotlinksTable.createdAt,
          salesContactsTable.id,
          salesContactsTable.firstName,
          salesContactsTable.lastName,
        ),
      // Full known-viewer list (uncapped — the overview truncates to 6).
      db
        .select({
          contactId: salesContactsTable.id,
          firstName: salesContactsTable.firstName,
          lastName: salesContactsTable.lastName,
          views: sql<number>`count(*)::int`,
          lastViewedAt: sql<string>`max(${salesSignalsTable.createdAt})`,
        })
        .from(salesSignalsTable)
        .innerJoin(salesHotlinksTable, eq(salesSignalsTable.hotlinkId, salesHotlinksTable.id))
        .innerJoin(salesContactsTable, eq(salesSignalsTable.contactId, salesContactsTable.id))
        .where(and(
          eq(salesSignalsTable.tenantId, tenantId),
          eq(salesSignalsTable.type, "page_view"),
          eq(salesHotlinksTable.pageId, pageId),
        ))
        .groupBy(salesContactsTable.id, salesContactsTable.firstName, salesContactsTable.lastName),
      // Dwell: current window vs the window before it (trend).
      db
        .select({
          period: sql<string>`CASE WHEN ${lpPageVisitsTable.createdAt} >= ${curStart} THEN 'cur' ELSE 'prev' END`,
          avgDwellSeconds: sql<number | null>`round(avg(${lpPageVisitsTable.dwellSeconds}))::int`,
          samples: sql<number>`count(${lpPageVisitsTable.dwellSeconds})::int`,
        })
        .from(lpPageVisitsTable)
        .where(and(eq(lpPageVisitsTable.pageId, pageId), gte(lpPageVisitsTable.createdAt, prevStart)))
        .groupBy(sql`1`),
    ]);

    const cur = dwellRows.find((r) => r.period === "cur");
    const prev = dwellRows.find((r) => r.period === "prev");

    res.json({
      windowDays: days,
      dwell: {
        avgSeconds: cur && cur.samples > 0 ? cur.avgDwellSeconds : null,
        samples: cur?.samples ?? 0,
        prevAvgSeconds: prev && prev.samples > 0 ? prev.avgDwellSeconds : null,
      },
      knownViewers: viewerRows
        .map((v) => ({
          contactId: v.contactId,
          name: [v.firstName, v.lastName].filter(Boolean).join(" ").trim() || "Unknown contact",
          views: v.views,
          lastViewedAt: v.lastViewedAt,
        }))
        .sort((a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime()),
      hotlinks: linkRows
        .map((l) => ({
          hotlinkId: l.hotlinkId,
          token: l.token,
          createdAt: l.createdAt,
          contactId: l.contactId ?? null,
          contactName: [l.contactFirst, l.contactLast].filter(Boolean).join(" ").trim(),
          views: l.views,
          lastViewedAt: l.lastViewedAt,
        }))
        .sort((a, b) => b.views - a.views),
    });
  } catch (err) {
    logger.error({ err }, "GET /sales/pages/:pageId/engagement error");
    res.status(500).json({ error: "Failed to load page engagement" });
  }
});

// ─── Token generation (matches existing LP Studio pattern) ──

function generateToken(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

async function generateUniqueToken(maxAttempts = 5): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const token = generateToken();
    const existing = await db.select({ id: salesHotlinksTable.id })
      .from(salesHotlinksTable)
      .where(eq(salesHotlinksTable.token, token))
      .limit(1);
    if (existing.length === 0) return token;
  }
  throw new Error("Failed to generate unique token after multiple attempts");
}

// ─── CRUD ───────────────────────────────────────────────────

// List hotlinks (optionally filter by contactId, pageId, or accountId)
router.get("/hotlinks", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const { contactId, pageId, accountId } = req.query;
    let hotlinks;
    if (accountId) {
      // All hotlinks for an account — join through contacts, tenant-scoped
      const contacts = await db
        .select({ id: salesContactsTable.id })
        .from(salesContactsTable)
        .where(and(eq(salesContactsTable.accountId, Number(accountId)), eq(salesContactsTable.tenantId, tenantId)));
      if (contacts.length === 0) {
        res.json([]);
        return;
      }
      hotlinks = await db
        .select()
        .from(salesHotlinksTable)
        .where(inArray(salesHotlinksTable.contactId, contacts.map(c => c.id)))
        .orderBy(desc(salesHotlinksTable.createdAt));
    } else if (contactId) {
      // Verify the contact belongs to this tenant before returning its hotlinks —
      // otherwise a guessed contactId could enumerate another tenant's tokens.
      const [owned] = await db.select({ id: salesContactsTable.id })
        .from(salesContactsTable)
        .where(and(eq(salesContactsTable.id, Number(contactId)), eq(salesContactsTable.tenantId, tenantId)))
        .limit(1);
      if (!owned) { res.json([]); return; }
      hotlinks = await db.select().from(salesHotlinksTable)
        .where(eq(salesHotlinksTable.contactId, owned.id))
        .orderBy(desc(salesHotlinksTable.createdAt));
    } else if (pageId) {
      // Verify the page belongs to this tenant before returning its hotlinks.
      const [ownedPage] = await db.select({ id: lpPagesTable.id })
        .from(lpPagesTable)
        .where(and(eq(lpPagesTable.id, Number(pageId)), eq(lpPagesTable.tenantId, tenantId)))
        .limit(1);
      if (!ownedPage) { res.json([]); return; }
      hotlinks = await db.select().from(salesHotlinksTable)
        .where(eq(salesHotlinksTable.pageId, ownedPage.id))
        .orderBy(desc(salesHotlinksTable.createdAt));
    } else {
      // Unfiltered — scope through contacts to enforce tenant isolation
      const tenantContacts = await db.select({ id: salesContactsTable.id })
        .from(salesContactsTable)
        .where(eq(salesContactsTable.tenantId, tenantId))
        .limit(5000);
      if (tenantContacts.length === 0) {
        res.json([]);
        return;
      }
      hotlinks = await db.select().from(salesHotlinksTable)
        .where(inArray(salesHotlinksTable.contactId, tenantContacts.map(c => c.id)))
        .orderBy(desc(salesHotlinksTable.createdAt))
        .limit(1000);
    }

    // Decorate each hotlink with its page status + title so the UI can show
    // when a link points to an unpublished page (reps shouldn't share those).
    if (hotlinks.length > 0) {
      const pageIds = [...new Set(hotlinks.map(h => h.pageId).filter((p): p is number => p != null))];
      if (pageIds.length > 0) {
        const pageRows = await db
          .select({ id: lpPagesTable.id, status: lpPagesTable.status, title: lpPagesTable.title })
          .from(lpPagesTable)
          .where(and(
            inArray(lpPagesTable.id, pageIds),
            eq(lpPagesTable.tenantId, tenantId),
          ));
        const pageById = new Map(pageRows.map(p => [p.id, p]));
        hotlinks = hotlinks.map(h => {
          const pg = h.pageId != null ? pageById.get(h.pageId) : undefined;
          return { ...h, pageStatus: pg?.status ?? null, pageTitle: pg?.title ?? null };
        });
      }
    }

    res.json(hotlinks);
  } catch (err) {
    logger.error({ err }, "GET /sales/hotlinks error");
    res.status(500).json({ error: "Failed to load hotlinks" });
  }
});

// Create hotlink for a contact + page
router.post("/hotlinks", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { contactId, pageId } = req.body;
  if (!contactId || !pageId) {
    res.status(400).json({ error: "contactId and pageId are required" });
    return;
  }

  try {
    // Tenant-scope the contact lookup FIRST so a caller can never read or
    // create a hotlink for another tenant's contact — even via the
    // "existing hotlink" early-return path below.
    const [contactRow] = await db
      .select({ salesforceId: salesContactsTable.salesforceId })
      .from(salesContactsTable)
      .where(and(
        eq(salesContactsTable.id, Number(contactId)),
        eq(salesContactsTable.tenantId, tenantId),
      ))
      .limit(1);
    if (!contactRow) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }

    // Also confirm the page belongs to this tenant — otherwise a caller
    // could cause a hotlink row to be created pointing at another
    // tenant's page.
    const [pageRow] = await db
      .select({ id: lpPagesTable.id })
      .from(lpPagesTable)
      .where(and(
        eq(lpPagesTable.id, Number(pageId)),
        eq(lpPagesTable.tenantId, tenantId),
      ))
      .limit(1);
    if (!pageRow) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    // Now safe to look up existing hotlinks — bound by tenant so we
    // can never return another tenant's row even on ID collision.
    const existing = await db.select().from(salesHotlinksTable)
      .where(and(
        eq(salesHotlinksTable.tenantId, tenantId),
        eq(salesHotlinksTable.contactId, Number(contactId)),
        eq(salesHotlinksTable.pageId, Number(pageId)),
      ))
      .limit(1);

    if (existing.length > 0) {
      res.json(existing[0]);
      return;
    }

    const token = await generateUniqueToken();
    const [hotlink] = await db.insert(salesHotlinksTable).values({
      tenantId,
      token,
      contactId: Number(contactId),
      sfdcContactId: contactRow?.salesforceId ?? null,
      pageId: Number(pageId),
    }).returning();

    res.status(201).json(hotlink);
  } catch (err) {
    logger.error({ err }, "POST /sales/hotlinks error");
    res.status(500).json({ error: "Failed to create hotlink" });
  }
});

// Bulk-delete hotlinks by ID (tenant-scoped via page ownership)
router.delete("/hotlinks", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { ids } = req.body as { ids?: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" });
    return;
  }
  try {
    // Enforce tenant isolation: only delete hotlinks whose page belongs to this tenant
    const ownedPageIds = await db
      .select({ id: lpPagesTable.id })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.tenantId, tenantId));
    const ownedSet = new Set(ownedPageIds.map(p => p.id));

    const safeIds = ids.filter(id => typeof id === "number");
    if (safeIds.length === 0) { res.json({ deleted: 0 }); return; }

    // Only delete hotlinks that belong to this tenant's pages
    const toDelete = await db
      .select({ id: salesHotlinksTable.id, pageId: salesHotlinksTable.pageId })
      .from(salesHotlinksTable)
      .where(inArray(salesHotlinksTable.id, safeIds));

    const authorisedIds = toDelete.filter(h => h.pageId && ownedSet.has(h.pageId)).map(h => h.id);
    if (authorisedIds.length === 0) { res.json({ deleted: 0 }); return; }

    await db.delete(salesHotlinksTable).where(inArray(salesHotlinksTable.id, authorisedIds));
    res.json({ deleted: authorisedIds.length });
  } catch (err) {
    logger.error({ err }, "DELETE /sales/hotlinks error");
    res.status(500).json({ error: "Failed to delete hotlinks" });
  }
});

// Delete ALL hotlinks for a specific page in one query (tenant-scoped)
router.delete("/hotlinks/page/:pageId", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const pageId = Number(req.params["pageId"]);
  if (!pageId || isNaN(pageId)) {
    res.status(400).json({ error: "pageId is required" });
    return;
  }
  try {
    // Verify this page belongs to this tenant
    const pages = await db
      .select({ id: lpPagesTable.id })
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId)));
    if (pages.length === 0) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    const result = await db
      .delete(salesHotlinksTable)
      .where(eq(salesHotlinksTable.pageId, pageId));
    res.json({ deleted: result.rowCount ?? 0 });
  } catch (err) {
    logger.error({ err }, "DELETE /sales/hotlinks/page/:pageId error");
    res.status(500).json({ error: "Failed to delete hotlinks" });
  }
});

// Bulk-create hotlinks for all contacts of an account for a specific page
router.post("/hotlinks/bulk", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { accountId, pageId, contactIds } = req.body;
  if (!accountId || !pageId) {
    res.status(400).json({ error: "accountId and pageId are required" });
    return;
  }

  try {
    // Confirm the target page belongs to this tenant — otherwise the
    // caller could enumerate page IDs and create valid hotlink tokens
    // pointing at another tenant's page.
    const [pageRow] = await db
      .select({ id: lpPagesTable.id })
      .from(lpPagesTable)
      .where(and(
        eq(lpPagesTable.id, Number(pageId)),
        eq(lpPagesTable.tenantId, tenantId),
      ))
      .limit(1);
    if (!pageRow) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    // Tenant-scope the contact lookup so a caller can never bulk-create
    // hotlinks for another tenant's contacts.
    let contacts = await db.select().from(salesContactsTable)
      .where(and(
        eq(salesContactsTable.accountId, Number(accountId)),
        eq(salesContactsTable.tenantId, tenantId),
      ));

    // If specific contactIds provided, filter to only those
    if (Array.isArray(contactIds) && contactIds.length > 0) {
      const idSet = new Set(contactIds.map(Number));
      contacts = contacts.filter(c => idSet.has(c.id));
    }

    if (contacts.length === 0) {
      res.status(201).json([]);
      return;
    }

    // Batch-load all existing hotlinks for this page + these contacts (eliminates N+1).
    // Tenant predicate added for defense in depth — even if an attacker
    // managed to slip a foreign contact in, we'd never surface a foreign row.
    const filteredContactIds = contacts.map(c => c.id);
    const existingHotlinks = await db.select().from(salesHotlinksTable)
      .where(and(
        eq(salesHotlinksTable.tenantId, tenantId),
        inArray(salesHotlinksTable.contactId, filteredContactIds),
        eq(salesHotlinksTable.pageId, Number(pageId)),
      ));
    const existingByContactId = new Map(existingHotlinks.map(h => [h.contactId, h]));

    const created: Array<typeof salesHotlinksTable.$inferSelect> = [];

    for (const contact of contacts) {
      // Skip if hotlink already exists (checked from batch-loaded map)
      const existing = existingByContactId.get(contact.id);
      if (existing) {
        created.push(existing);
        continue;
      }

      const token = await generateUniqueToken();
      const [hotlink] = await db.insert(salesHotlinksTable).values({
        tenantId,
        token,
        contactId: contact.id,
        sfdcContactId: contact.salesforceId ?? null,
        pageId: Number(pageId),
      }).returning();
      created.push(hotlink);
    }

    res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /sales/hotlinks/bulk error");
    res.status(500).json({ error: "Failed to create hotlinks" });
  }
});

// ─── Token resolve (sales-specific) ────────────────────────

const resolveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

router.get("/resolve/:token", resolveLimiter, async (req, res): Promise<void> => {
  try {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const [hotlink] = await db.select().from(salesHotlinksTable)
      .where(eq(salesHotlinksTable.token, token));

    if (!hotlink || !hotlink.isActive) {
      res.status(404).json({ error: "Link not found or inactive" });
      return;
    }

    // Get page info
    const [page] = await db.select({
      id: lpPagesTable.id,
      title: lpPagesTable.title,
      slug: lpPagesTable.slug,
      tenantId: lpPagesTable.tenantId,
    }).from(lpPagesTable)
      .where(eq(lpPagesTable.id, hotlink.pageId));
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    // Get contact info
    let contact: typeof salesContactsTable.$inferSelect | undefined;
    if (hotlink.contactId) {
      const contactResult = await db.select().from(salesContactsTable)
        .where(eq(salesContactsTable.id, hotlink.contactId));
      contact = contactResult[0];
    }

    // Get account info for company/personalization vars. `companyName` and
    // `practiceCount` mirror what generate-microsite bakes into business-case
    // templates ({{company_name}} / {{practice_count}}), so view-time hotlink
    // personalization fills the SAME tokens those pages actually use — not just
    // the {{company}} alias.
    let company = "";
    let companyName = "";
    let practiceCount = "";
    if (contact?.accountId) {
      const [account] = await db.select({
        name: salesAccountsTable.name,
        displayName: salesAccountsTable.displayName,
        numLocations: salesAccountsTable.numLocations,
      })
        .from(salesAccountsTable)
        .where(eq(salesAccountsTable.id, contact.accountId));
      company = account?.name ?? "";
      companyName = deriveCompanyName(account);
      const [briefing] = await db.select({ briefingData: salesBriefingsTable.briefingData })
        .from(salesBriefingsTable)
        .where(and(
          eq(salesBriefingsTable.tenantId, page.tenantId),
          eq(salesBriefingsTable.accountId, contact.accountId),
        ))
        .orderBy(desc(salesBriefingsTable.updatedAt))
        .limit(1);
      practiceCount = derivePracticeCount(
        briefing?.briefingData as Record<string, unknown> | undefined,
        account,
      );
    }

    // Create page_view signal
    const [pvSignal] = await db.insert(salesSignalsTable).values({
      tenantId: page.tenantId,
      accountId: contact?.accountId ?? null,
      contactId: hotlink.contactId,
      hotlinkId: hotlink.id,
      type: "page_view",
      source: page.title,
      metadata: {
        pageSlug: page.slug,
        ip: req.headers["x-forwarded-for"] ?? req.ip ?? "",
      },
    }).returning();
    broadcastSignal(pvSignal);

    // A campaign hotlink resolve IS the recipient clicking their personalized
    // email link. The dedicated /track/click-hotlink + /track/open-hotlink
    // endpoints only fire when the email's CTA/pixel are wrapped through them;
    // campaign emails link straight to /p/<token> (this resolve), and Gmail's
    // image proxy makes pixel-based opens unreliable. So when this hotlink is
    // tied to a campaign send, record the open + click here too. Dedup is done
    // ATOMICALLY: each `UPDATE ... WHERE <stamp> IS NULL RETURNING` lets only
    // the one request that flips the stamp from NULL emit the signal, so
    // concurrent resolves (and the pixel/track-hotlink paths) never double-fire.
    // Mirrors the dual-write in campaigns.ts. Non-blocking.
    try {
      const [send] = await db.select({ sentAt: salesEmailSendsTable.sentAt })
        .from(salesEmailSendsTable)
        .where(eq(salesEmailSendsTable.hotlinkId, hotlink.id))
        .orderBy(desc(salesEmailSendsTable.sentAt))
        .limit(1);

      if (send && !isLikelyResolveBot(send.sentAt)) {
        const baseSignal = {
          tenantId: page.tenantId,
          accountId: contact?.accountId ?? null,
          contactId: hotlink.contactId,
          hotlinkId: hotlink.id,
          source: page.title,
          metadata: { pageId: hotlink.pageId, email: contact?.email ?? undefined },
        };

        // Atomically claim the open stamp across ALL tracking paths (pixel /
        // track-hotlink / this resolve). Only the request that flips openedAt
        // from NULL gets a row back and emits the signal. CASE prevents
        // downgrading a terminal/clicked status.
        const openClaim = await db.update(salesEmailSendsTable)
          .set({
            openedAt: new Date(),
            status: sql`CASE WHEN ${salesEmailSendsTable.status} IN ('bounced','complained','clicked') THEN ${salesEmailSendsTable.status} ELSE 'opened' END`,
          })
          .where(and(
            eq(salesEmailSendsTable.hotlinkId, hotlink.id),
            isNull(salesEmailSendsTable.openedAt),
          ))
          .returning({ id: salesEmailSendsTable.id });
        if (openClaim.length > 0) {
          const [openSig] = await db.insert(salesSignalsTable)
            .values({ ...baseSignal, type: "email_open" }).returning();
          broadcastSignal(openSig);
        }

        // Atomically claim the click stamp the same way. A click implies an
        // open, already handled by the claim above.
        const clickClaim = await db.update(salesEmailSendsTable)
          .set({
            clickedAt: new Date(),
            status: sql`CASE WHEN ${salesEmailSendsTable.status} IN ('bounced','complained') THEN ${salesEmailSendsTable.status} ELSE 'clicked' END`,
          })
          .where(and(
            eq(salesEmailSendsTable.hotlinkId, hotlink.id),
            isNull(salesEmailSendsTable.clickedAt),
          ))
          .returning({ id: salesEmailSendsTable.id });
        if (clickClaim.length > 0) {
          const [clickSig] = await db.insert(salesSignalsTable)
            .values({ ...baseSignal, type: "email_click" }).returning();
          broadcastSignal(clickSig);
        }
      }
    } catch (err) {
      logger.error({ err }, "Hotlink resolve open/click tracking error");
    }

    // Send visit alert email (fire-and-forget)
    setImmediate(async () => {
      try {
        const alertResult = await db.execute(sql`
          SELECT email FROM lp_page_alert_emails WHERE page_id = ${hotlink.pageId}
        `);
        const recipients = (alertResult.rows as { email: string }[]).map(r => r.email).filter(Boolean);
        logger.info({ pageId: hotlink.pageId, recipients }, "[visit-alert] processing visit");
        if (recipients.length > 0) {
          const contactName = contact ? `${contact.firstName} ${contact.lastName}` : "Unknown";
          await sendVisitAlert(recipients, {
            tenantId: page.tenantId,
            contactName,
            company,
            pageTitle: page.title,
            pageSlug: page.slug,
            visitedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        logger.error({ err }, "Failed to process visit alert for hotlink");
      }
    });

    // SFDC write-back: log microsite view as Activity (fire-and-forget)
    if (contact?.salesforceId) {
      sfdcService.getActiveConnection(page.tenantId).then(conn => {
        if (conn) {
          sfdcService.logMicrositeView(conn.id, {
            contactSalesforceId: contact.salesforceId!,
            pageTitle: page.title,
            pageUrl: `/lp/${page.slug}`,
          }).catch(() => {/* non-blocking */});
        }
      }).catch(() => {/* non-blocking */});
    }

    // Marketo write-back (Phase 2): log microsite view as a custom activity
    // (fire-and-forget). Tenant-scoped + gated on the contact having a
    // marketoLeadId and the connection having sync enabled. Idempotent per
    // page_view signal id.
    if (contact?.marketoLeadId) {
      marketoService.getActiveConnection(page.tenantId).then(conn => {
        if (conn) {
          marketoService.logMicrositeView(conn.id, page.tenantId, {
            localEventId: `microsite_view:${pvSignal.id}`,
            marketoLeadId: Number(contact.marketoLeadId),
            pageTitle: page.title,
            pageUrl: `/lp/${page.slug}`,
          }).catch(() => {/* non-blocking */});
        }
      }).catch(() => {/* non-blocking */});
    }

    // Slack notifier (outbound-only): post a Block Kit "Hot visit" message to
    // the tenant's configured channel (fire-and-forget, gated on the per-event
    // toggle). A known contact viewing a microsite is the trigger.
    if (contact) {
      slackService.getActiveConnection(page.tenantId).then(slackConn => {
        if (slackConn && slackConn.eventToggles.hot_visit !== false) {
          const msg = slackService.buildHotVisitBlocks({
            contactName: `${contact.firstName} ${contact.lastName}`.trim(),
            company,
            pageTitle: page.title,
            visitedAt: new Date().toISOString(),
          });
          slackService.postMessage(page.tenantId, msg).catch(() => {/* non-blocking */});
        }
      }).catch(() => {/* non-blocking */});
    }

    res.json({
      pageSlug: page.slug,
      pageTitle: page.title,
      firstName: contact?.firstName ?? "",
      lastName: contact?.lastName ?? "",
      company,
      companyName,
      practiceCount,
      contactName: contact ? `${contact.firstName} ${contact.lastName}` : null,
      token,
      hotlinkId: hotlink.id,
      contactId: hotlink.contactId,
      accountId: contact?.accountId ?? null,
    });
  } catch (err) {
    logger.error({ err }, "GET /sales/resolve/:token error");
    res.status(500).json({ error: "Failed to resolve token" });
  }
});

export default router;
