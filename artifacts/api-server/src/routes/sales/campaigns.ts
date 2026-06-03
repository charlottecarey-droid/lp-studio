import { getTenantId, requirePermission } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { db } from "@workspace/db";
import {
  salesEmailCampaignsTable,
  salesEmailSendsTable,
  salesEmailTemplatesTable,
  salesContactsTable,
  salesAccountsTable,
  salesSignalsTable,
  salesHotlinksTable,
} from "@workspace/db";
import { lpPagesTable } from "@workspace/db";
import { broadcastSignal } from "./signals";
import { sfdcService } from "../../lib/sfdc-service";
import { logger } from "../../lib/logger";
import { getTenantOutboundOrigin } from "../../lib/tenantHosts";
import { getSalesBrandContext } from "../../lib/salesBrandContext";
import { resolveTenantSender } from "../../lib/tenantSender";
import { isTransientDbError, withDbRetry } from "../../lib/dbResilience";
import { ensureHotlinkForContact } from "../../lib/ensureHotlink";

const router = Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const SENDER_DOMAIN = process.env.EMAIL_SENDER_DOMAIN ?? "ent.meetdandy.com";
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO ?? "sales@meetdandy.com";

// 1x1 transparent GIF pixel for open tracking
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// How long a campaign may sit in status='sending' before its claim is treated
// as stale (crashed mid-send) and a fresh send is allowed to reclaim it.
const SENDING_STALE_MS = 15 * 60 * 1000;
// While a send loop is actively running we refresh the sendingStartedAt marker
// at this cadence (a heartbeat) so a long but healthy send is never mistaken for
// a crashed one and reclaimed mid-flight. Must be << SENDING_STALE_MS.
const SENDING_HEARTBEAT_MS = 2 * 60 * 1000;

// ─── Unsubscribe token helpers ─────────────────────────────
// SECURITY: no hardcoded fallback secret. In production the server refuses to
// boot without UNSUB_SECRET (see server.ts), so the real, stable secret is
// always present there. In dev/test we mint an ephemeral per-process random
// secret — tokens stay non-forgeable but reset on restart (fine, since dev
// doesn't send durable unsubscribe links). The old `RESEND_API_KEY` /
// `"dandy-unsub-secret"` fallbacks are gone: they let anyone who knew the
// constant forge an unsubscribe for any contact.
const UNSUB_SECRET: string = process.env.UNSUB_SECRET ?? randomBytes(32).toString("hex");
const UNSUB_TOKEN_EXPIRY_DAYS = 30;

// New tokens bind tenantId into the HMAC so a token for tenant A can never be
// replayed to unsubscribe a contact id that belongs to tenant B. The unsubscribe
// route also re-scopes its UPDATE to this tenantId. Format (base64url of):
//   `${tenantId}.${contactId}.${expiresAt}.${mac}`  (4 parts)
// Legacy tokens (3 parts, no tenant) are still honored within a grace window so
// links already in inboxes keep working through the rollout.
function makeUnsubToken(tenantId: number, contactId: number): string {
  const expiresAt = Math.floor(Date.now() / 1000) + (UNSUB_TOKEN_EXPIRY_DAYS * 24 * 60 * 60);
  const mac = createHmac("sha256", UNSUB_SECRET).update(`${tenantId}.${contactId}.${expiresAt}`).digest("hex");
  return Buffer.from(`${tenantId}.${contactId}.${expiresAt}.${mac}`).toString("base64url");
}

// Constant-time HMAC comparison — never short-circuit on the first mismatched
// byte (timing side-channel). Both args are lowercase hex of equal length when
// the token is well-formed; a length mismatch is an immediate reject.
function macEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function verifyUnsubToken(token: string): { tenantId: number | null; contactId: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    const now = Math.floor(Date.now() / 1000);

    if (parts.length === 4) {
      // Current format: tenant-bound.
      const [tenantStr, idStr, expiryStr, mac] = parts;
      const tenantId = parseInt(tenantStr, 10);
      const contactId = parseInt(idStr, 10);
      const expiresAt = parseInt(expiryStr, 10);
      if (isNaN(tenantId) || isNaN(contactId) || isNaN(expiresAt)) return null;
      if (now > expiresAt) return null;
      const expected = createHmac("sha256", UNSUB_SECRET).update(`${tenantId}.${contactId}.${expiresAt}`).digest("hex");
      return macEquals(mac, expected) ? { tenantId, contactId } : null;
    }

    if (parts.length === 3) {
      // Legacy format (no tenant) — grace window for links already in inboxes.
      const [idStr, expiryStr, mac] = parts;
      const contactId = parseInt(idStr, 10);
      const expiresAt = parseInt(expiryStr, 10);
      if (isNaN(contactId) || isNaN(expiresAt)) return null;
      if (now > expiresAt) return null;
      const expected = createHmac("sha256", UNSUB_SECRET).update(`${contactId}.${expiresAt}`).digest("hex");
      return macEquals(mac, expected) ? { tenantId: null, contactId } : null;
    }

    return null;
  } catch {
    return null;
  }
}

// ─── GET /sales/unsubscribe?token=... ─────────────────────
router.get("/unsubscribe", async (req, res): Promise<void> => {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(400).send("<h2>Invalid unsubscribe link.</h2>");
    return;
  }
  const verified = verifyUnsubToken(token);
  if (!verified) {
    res.status(400).send("<h2>Invalid or expired unsubscribe link.</h2>");
    return;
  }
  const { tenantId, contactId } = verified;
  try {
    // Scope the UPDATE to the token's tenant when present (current 4-part
    // tokens). Legacy 3-part tokens carry no tenant, so they fall back to the
    // contact id alone within their grace window.
    await db.update(salesContactsTable)
      .set({ status: "unsubscribed" })
      .where(tenantId !== null
        ? and(eq(salesContactsTable.id, contactId), eq(salesContactsTable.tenantId, tenantId))
        : eq(salesContactsTable.id, contactId));
    res.status(200).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafb}
.box{text-align:center;padding:48px;max-width:400px}h1{color:#003A30;margin-bottom:12px}p{color:#555;line-height:1.6}</style></head>
<body><div class="box"><h1>You've been unsubscribed</h1>
<p>You won't receive any more emails from this sender. If this was a mistake, please reply to any previous email to re-subscribe.</p></div></body></html>`);
  } catch {
    res.status(500).send("<h2>Something went wrong. Please try again.</h2>");
  }
});

// ─── Utility functions ─────────────────────────────────────

// Normalize a token key so "First Name", "first_name", "FIRSTNAME",
// "first-name", "firstName" all map to the same lookup key.
// Splits camelCase first, then collapses any non-alphanumeric run to "_".
function normalizeTokenKey(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2") // camelCase → camel_Case
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Tolerant template variable replacement.
 *
 * - Matches `{{ anything }}` with arbitrary whitespace/case/punctuation inside.
 * - Normalises keys so `{{first_name}}`, `{{First Name}}`, `{{ firstName }}`,
 *   `{{first-name}}`, `{{FIRSTNAME}}` all resolve to the same value.
 * - SAFETY NET: any `{{...}}` that still doesn't resolve is replaced with the
 *   empty string so recipients NEVER see raw merge tags in their inbox.
 *
 * The `vars` map accepts either `{{first_name}}`-style keys (existing call sites)
 * or bare `first_name`-style keys — both are normalised.
 */
function replaceVars(text: string, vars: Record<string, string>): string {
  const lookup: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    const stripped = k.replace(/^\{\{|\}\}$/g, "").trim();
    lookup[normalizeTokenKey(stripped)] = v;
  }
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, raw: string) => {
    const key = normalizeTokenKey(raw);
    return key in lookup ? lookup[key] : "";
  });
}

/**
 * Escape a plain-text email body for safe HTML embedding AND turn any http(s)
 * URL into a clickable <a> link. Plain-text campaigns/templates resolve
 * `{{microsite_url}}` (and any other URL) to a bare string; without this the
 * personalized page link would render as inert text inside the
 * `white-space:pre-wrap` div. Linkifying here matches the styled (HTML) path
 * where the link is already wrapped in `<a href="{{microsite_url}}">`.
 *
 * Escaping runs first; the URL match therefore includes entity-encoded
 * characters (e.g. `&amp;` from a query string), which are valid inside an
 * href attribute. Trailing punctuation is kept outside the anchor.
 */
function escapeAndLinkifyPlainText(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/https?:\/\/[^\s<]+/g, (match) => {
    const m = /^(.*?)([.,;:!?)]*)$/s.exec(match);
    const url = m ? m[1] : match;
    const trailing = m ? m[2] : "";
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
  });
}

/**
 * Find any `{{...}}` tokens in `text` whose normalised key is NOT in the
 * provided vars map. Used to warn users before sending a campaign with
 * unresolved tokens.
 */
function findUnresolvedTokens(text: string, vars: Record<string, string>): string[] {
  const known = new Set<string>();
  for (const k of Object.keys(vars)) {
    const stripped = k.replace(/^\{\{|\}\}$/g, "").trim();
    known.add(normalizeTokenKey(stripped));
  }
  const found = new Set<string>();
  const re = /\{\{\s*([^{}]+?)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim();
    if (!known.has(normalizeTokenKey(raw))) found.add(raw);
  }
  return Array.from(found);
}

function appendUtms(html: string, utmParams: string): string {
  if (!utmParams) return html;
  return html.replace(/href="(https?:\/\/[^"]+)"/gi, (_match, url: string) => {
    const sep = url.includes("?") ? "&" : "?";
    return `href="${url}${sep}${utmParams}"`;
  });
}

function injectTrackingPixel(html: string, trackUrl: string): string {
  const pixel = `<img src="${trackUrl}" width="1" height="1" style="display:none" alt="" />`;
  return html.includes("</body>") ? html.replace("</body>", pixel + "</body>") : html + pixel;
}

/**
 * Returns true if any of the given strings contain a `{{microsite_url}}`-style
 * token (or any common alias — link, microsite, personalized_link, page_url).
 * Used to decide whether a campaign actually needs a landing page wired up
 * before it can be sent.
 */
function templateNeedsMicrositeUrl(...texts: (string | null | undefined)[]): boolean {
  // Keys MUST match what `normalizeTokenKey` produces — underscores between
  // word boundaries are preserved. Earlier we used the no-underscore form
  // here which silently failed to detect the canonical `{{microsite_url}}`.
  const aliases = new Set([
    "microsite_url",
    "personalized_link",
    "personalized_url",
    "page_url",
    "link",
    "microsite",
  ]);
  const re = /\{\{\s*([^{}]+?)\s*\}\}/g;
  for (const text of texts) {
    if (!text) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (aliases.has(normalizeTokenKey(m[1]))) return true;
    }
  }
  return false;
}

async function sendViaResend(payload: {
  from: string;
  reply_to?: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
}): Promise<{ ok: boolean; error?: string; resendId?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "No RESEND_API_KEY" };
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { ok: false, error: body };
    }
    // Resend returns { id: "..." }. Capture it so the bounce/complaint
    // webhook can map provider events back to our send row.
    let resendId: string | undefined;
    try {
      const parsed = await resp.json() as { id?: string };
      if (parsed?.id) resendId = parsed.id;
    } catch { /* tolerate non-JSON */ }
    return { ok: true, resendId };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Bot/prefetch tolerance: Gmail and Apple Mail Privacy proxies prefetch the
// pixel and rewrite URLs within milliseconds of send. We ignore any open or
// click that fires inside this window so dashboards reflect real recipient
// activity, not security scanners. The pixel and redirect still serve as
// usual — only the DB stamp + signal are suppressed.
const BOT_GRACE_MS = 2000;
function isLikelyBot(sentAt: Date | null | undefined): boolean {
  if (!sentAt) return false;
  return Date.now() - new Date(sentAt).getTime() < BOT_GRACE_MS;
}

// ─── Campaign CRUD ──────────────────────────────────────────

router.get("/campaigns", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const campaigns = await db
      .select()
      .from(salesEmailCampaignsTable)
      .where(eq(salesEmailCampaignsTable.tenantId, tenantId))
      .orderBy(desc(salesEmailCampaignsTable.updatedAt));
    res.json(campaigns);
  } catch (err) {
    logger.error({ err }, "GET /sales/campaigns error");
    res.status(500).json({ error: "Failed to load campaigns" });
  }
});

router.get("/campaigns/:id", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const [campaign] = await db
      .select()
      .from(salesEmailCampaignsTable)
      .where(and(eq(salesEmailCampaignsTable.tenantId, tenantId), eq(salesEmailCampaignsTable.id, Number(req.params.id))));
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    // Enrich with template, sends, and account
    const [template] = campaign.templateId
      ? await db.select().from(salesEmailTemplatesTable).where(eq(salesEmailTemplatesTable.id, campaign.templateId))
      : [null];
    const sends = await db.select({
      id: salesEmailSendsTable.id,
      contactId: salesEmailSendsTable.contactId,
      email: salesEmailSendsTable.email,
      status: salesEmailSendsTable.status,
      sentAt: salesEmailSendsTable.sentAt,
      openedAt: salesEmailSendsTable.openedAt,
      clickedAt: salesEmailSendsTable.clickedAt,
      bouncedAt: salesEmailSendsTable.bouncedAt,
      contactFirst: salesContactsTable.firstName,
      contactLast: salesContactsTable.lastName,
      accountName: salesAccountsTable.name,
    })
      .from(salesEmailSendsTable)
      .leftJoin(salesContactsTable, eq(salesEmailSendsTable.contactId, salesContactsTable.id))
      .leftJoin(salesAccountsTable, eq(salesContactsTable.accountId, salesAccountsTable.id))
      .where(eq(salesEmailSendsTable.campaignId, campaign.id))
      .orderBy(desc(salesEmailSendsTable.createdAt));
    const account = campaign.accountId
      ? (await db.select().from(salesAccountsTable).where(eq(salesAccountsTable.id, campaign.accountId)))[0] ?? null
      : null;

    res.json({ ...campaign, template, sends, account });
  } catch (err) {
    logger.error({ err }, "GET /sales/campaigns/:id error");
    res.status(500).json({ error: "Failed to load campaign" });
  }
});

router.post("/campaigns", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { name, templateId, accountId, status, scheduledAt, metadata } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (typeof name !== "string" || name.length > 255) {
    res.status(400).json({ error: "name must be a string under 255 characters" });
    return;
  }
  if (templateId !== undefined && templateId !== null && isNaN(Number(templateId))) {
    res.status(400).json({ error: "templateId must be a number" });
    return;
  }
  const allowedStatuses = ["draft", "scheduled", "sending", "sent", "paused"];
  if (status && !allowedStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${allowedStatuses.join(", ")}` });
    return;
  }
  // Campaigns being scheduled or already in-flight MUST have a template —
  // otherwise nothing can actually be sent. Draft and paused campaigns can
  // exist without one.
  const effectiveStatus = status ?? "draft";
  const sendingStatuses = ["scheduled", "sending", "sent"];
  if (sendingStatuses.includes(effectiveStatus) && (templateId === undefined || templateId === null)) {
    res.status(400).json({ error: "Pick an email template before scheduling or sending this campaign" });
    return;
  }
  // Reject oversized metadata (prevent payload bombs)
  if (metadata && JSON.stringify(metadata).length > 10000) {
    res.status(400).json({ error: "metadata exceeds maximum size" });
    return;
  }
  try {
    const [campaign] = await db
      .insert(salesEmailCampaignsTable)
      .values({
        tenantId,
        name: name.slice(0, 255),
        templateId: templateId !== undefined && templateId !== null ? Number(templateId) : null,
        accountId: accountId ? Number(accountId) : null,
        status: effectiveStatus,
        scheduledAt: scheduledAt ?? null,
        metadata: metadata ?? {},
      })
      .returning();
    res.status(201).json(campaign);
  } catch (err) {
    logger.error({ err }, "POST /sales/campaigns error");
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// ─── Clone campaign ────────────────────────────────────────
router.post("/campaigns/:id/clone", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const [original] = await db.select().from(salesEmailCampaignsTable)
      .where(and(eq(salesEmailCampaignsTable.tenantId, tenantId), eq(salesEmailCampaignsTable.id, Number(req.params.id))));
    if (!original) { res.status(404).json({ error: "Campaign not found" }); return; }
    const [clone] = await db.insert(salesEmailCampaignsTable).values({
      tenantId,
      name: `${original.name} (copy)`,
      templateId: original.templateId,
      accountId: original.accountId,
      status: "draft",
      metadata: original.metadata ?? {},
    }).returning();
    res.status(201).json(clone);
  } catch (err) {
    logger.error({ err }, "POST /sales/campaigns/:id/clone error");
    res.status(500).json({ error: "Failed to clone campaign" });
  }
});

router.patch("/campaigns/:id", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const updates: Record<string, unknown> = {};
    const fields = ["name", "templateId", "accountId", "status", "scheduledAt", "recipientCount", "metadata"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    // If the campaign is being scheduled or sent, it must have a template.
    const sendingStatuses = ["scheduled", "sending", "sent"];
    if (typeof updates.status === "string" && sendingStatuses.includes(updates.status)) {
      const incomingTemplateId = "templateId" in updates ? updates.templateId : undefined;
      const needsLookup = incomingTemplateId === undefined;
      let templateIdToCheck: unknown = incomingTemplateId;
      if (needsLookup) {
        const [existing] = await db.select({ templateId: salesEmailCampaignsTable.templateId })
          .from(salesEmailCampaignsTable)
          .where(and(eq(salesEmailCampaignsTable.tenantId, tenantId), eq(salesEmailCampaignsTable.id, Number(req.params.id))));
        if (!existing) { res.status(404).json({ error: "Campaign not found" }); return; }
        templateIdToCheck = existing.templateId;
      }
      if (templateIdToCheck === null || templateIdToCheck === undefined) {
        res.status(400).json({ error: "Pick an email template before scheduling or sending this campaign" });
        return;
      }
    }
    const [updated] = await db
      .update(salesEmailCampaignsTable)
      .set(updates)
      .where(and(eq(salesEmailCampaignsTable.tenantId, tenantId), eq(salesEmailCampaignsTable.id, Number(req.params.id))))
      .returning();
    if (!updated) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /sales/campaigns/:id error");
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

router.delete("/campaigns/:id", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const [deleted] = await db
      .delete(salesEmailCampaignsTable)
      .where(and(eq(salesEmailCampaignsTable.tenantId, tenantId), eq(salesEmailCampaignsTable.id, Number(req.params.id))))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /sales/campaigns/:id error");
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});

// ─── Campaign Send ──────────────────────────────────────────

router.post("/campaigns/:id/send", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const campaignId = Number(req.params.id);
  try {
    // Load campaign — TENANT-SCOPED so a user can't send another tenant's campaigns.
    const [campaign] = await db.select().from(salesEmailCampaignsTable)
      .where(and(
        eq(salesEmailCampaignsTable.id, campaignId),
        eq(salesEmailCampaignsTable.tenantId, tenantId),
      ));
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    // Load template — also tenant-scoped.
    if (campaign.templateId === null) {
      res.status(400).json({ error: "Campaign has no template assigned" });
      return;
    }
    const [template] = await db.select().from(salesEmailTemplatesTable)
      .where(and(
        eq(salesEmailTemplatesTable.id, campaign.templateId),
        eq(salesEmailTemplatesTable.tenantId, tenantId),
      ));
    if (!template) { res.status(400).json({ error: "Template not found" }); return; }

    // Load contacts — batch query instead of N+1 loop. Always tenant-scope so a
    // malicious metadata.contactIds payload can't pull other tenants' contacts.
    const contactIds: number[] = (campaign.metadata as any)?.contactIds ?? [];
    // Multi-account audience: metadata.accountIds takes precedence over the legacy
    // single accountId column so campaigns targeting multiple accounts broadcast
    // to every active contact across all of them.
    const metaAccountIds: number[] = Array.isArray((campaign.metadata as any)?.accountIds)
      ? ((campaign.metadata as any).accountIds as number[]).filter(n => typeof n === "number")
      : [];
    const targetAccountIds = metaAccountIds.length > 0
      ? metaAccountIds
      : (campaign.accountId ? [campaign.accountId] : []);
    let contacts;
    if (contactIds.length > 0) {
      contacts = await db.select().from(salesContactsTable)
        .where(and(
          inArray(salesContactsTable.id, contactIds),
          eq(salesContactsTable.tenantId, tenantId),
        ));
    } else if (targetAccountIds.length > 0) {
      contacts = await db.select().from(salesContactsTable)
        .where(and(
          inArray(salesContactsTable.accountId, targetAccountIds),
          eq(salesContactsTable.tenantId, tenantId),
        ));
    } else {
      res.status(400).json({ error: "No contacts specified for campaign" });
      return;
    }

    // Filter to contacts with emails and active status
    const withEmail = contacts.filter(c => c.email && c.status === "active");
    if (withEmail.length === 0) {
      res.status(400).json({ error: "No contacts with email addresses to send to" });
      return;
    }

    // If the template uses a personalized-link token, we MUST have a landing
    // page selected on the campaign — otherwise every recipient would receive
    // an empty link. Validate up front and bail with a clear error.
    const needsMicrosite = templateNeedsMicrositeUrl(template.subject, template.bodyHtml, template.bodyText);
    const campaignPageId = (campaign.metadata as any)?.pageId as number | undefined;
    let campaignPage: { id: number; status: string } | null = null;
    if (campaignPageId) {
      const [pg] = await db.select({ id: lpPagesTable.id, status: lpPagesTable.status })
        .from(lpPagesTable)
        .where(and(eq(lpPagesTable.id, campaignPageId), eq(lpPagesTable.tenantId, tenantId)));
      campaignPage = pg ?? null;
    }
    if (needsMicrosite) {
      if (!campaignPage) {
        res.status(400).json({ error: "This template uses a personalized link — pick a landing page on the campaign before sending." });
        return;
      }
      if (campaignPage.status !== "published") {
        res.status(400).json({ error: "The selected landing page is not published yet. Publish it before sending this campaign." });
        return;
      }
    }

    // Idempotency guard: skip contacts already sent to in this campaign
    const existingSends = await db.select({ contactId: salesEmailSendsTable.contactId })
      .from(salesEmailSendsTable)
      .where(and(
        eq(salesEmailSendsTable.campaignId, campaignId),
        eq(salesEmailSendsTable.status, "sent"),
      ));
    const alreadySentIds = new Set(existingSends.map(s => s.contactId));
    // `sendable`/`skippedCount` are re-derived UNDER the claim lock below (this
    // pre-claim snapshot can go stale if a concurrent send commits between here
    // and the claim), so they are mutable.
    let sendable = withEmail.filter(c => !alreadySentIds.has(c.id));
    let skippedCount = withEmail.length - sendable.length;
    if (sendable.length === 0) {
      res.status(400).json({ error: `All ${withEmail.length} contacts have already been sent to in this campaign` });
      return;
    }

    // Batch-load existing hotlinks for the campaign's landing page so we can
    // reuse tokens instead of generating duplicates. Anything missing will be
    // auto-created below per recipient inside the send loop. We scope to the
    // CAMPAIGN's selected pageId (when set) so we never accidentally send the
    // wrong page's URL just because the contact has some other hotlink.
    const sendableIds = sendable.map(c => c.id);
    const hotlinkByContactId = new Map<number, { id: number; token: string; pageId: number }>();
    if (campaignPageId) {
      const allHotlinks = await db
        .select({
          id: salesHotlinksTable.id,
          token: salesHotlinksTable.token,
          contactId: salesHotlinksTable.contactId,
          pageId: salesHotlinksTable.pageId,
          isActive: salesHotlinksTable.isActive,
        })
        .from(salesHotlinksTable)
        .where(and(
          inArray(salesHotlinksTable.contactId, sendableIds),
          eq(salesHotlinksTable.pageId, campaignPageId),
        ));
      for (const h of allHotlinks) {
        if (h.contactId == null) continue;
        if (!h.isActive) {
          await db.update(salesHotlinksTable)
            .set({ isActive: true })
            .where(eq(salesHotlinksTable.id, h.id));
        }
        hotlinkByContactId.set(h.contactId, { id: h.id, token: h.token, pageId: h.pageId });
      }
    }

    // Batch-load accounts for {{company}} variable
    const accountIds = [...new Set(sendable.map(c => c.accountId).filter((id): id is number => id != null))];
    const allAccounts = accountIds.length > 0
      ? await db.select({ id: salesAccountsTable.id, name: salesAccountsTable.name })
          .from(salesAccountsTable)
          .where(inArray(salesAccountsTable.id, accountIds))
      : [];
    const accountNameById = new Map(allAccounts.map(a => [a.id, a.name]));

    // Concurrency + crash-recovery claim. Two simultaneous send requests for the
    // same campaign would BOTH pass the per-contact idempotency filter above
    // (there's no unique (campaign, contact) constraint) and double-send, so we
    // serialize them with a short claim transaction:
    //   - take a transaction-scoped advisory lock keyed on the campaign id
    //     (pg_advisory_xact_lock auto-releases on commit — safe on the Neon
    //     pooler, unlike session locks which leak),
    //   - re-read the campaign status UNDER the lock,
    //   - reject with 409 if it's already 'sending' with a FRESH marker (another
    //     send is genuinely in flight),
    //   - otherwise stamp status='sending' + metadata.sendingStartedAt so a crash
    //     leaves a STALE marker that a later retry is allowed to reclaim,
    //   - and RE-READ the already-sent set under the same lock to drop any
    //     contacts a concurrent send finished between our pre-claim snapshot and
    //     this claim — this is what actually makes the send race-free.
    const claim = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('sales_campaign_send'), ${campaignId}::int)`);
      const [fresh] = await tx.select({
        status: salesEmailCampaignsTable.status,
        metadata: salesEmailCampaignsTable.metadata,
      })
        .from(salesEmailCampaignsTable)
        .where(eq(salesEmailCampaignsTable.id, campaignId));
      const startedAtRaw = (fresh?.metadata as Record<string, unknown> | null)?.["sendingStartedAt"];
      const startedAt = typeof startedAtRaw === "string" ? Date.parse(startedAtRaw) : NaN;
      const inFlight =
        fresh?.status === "sending" && !isNaN(startedAt) && (Date.now() - startedAt) < SENDING_STALE_MS;
      if (inFlight) return { claimed: false as const };
      // Re-derive the sendable set under the lock so a concurrent (or just-
      // finished) send's rows are honored — closes the snapshot-staleness window.
      const sentRows = await tx.select({ contactId: salesEmailSendsTable.contactId })
        .from(salesEmailSendsTable)
        .where(and(
          eq(salesEmailSendsTable.campaignId, campaignId),
          eq(salesEmailSendsTable.status, "sent"),
        ));
      const sentNow = new Set(sentRows.map(r => r.contactId));
      const remaining = sendable.filter(c => !sentNow.has(c.id));
      await tx.update(salesEmailCampaignsTable)
        .set({
          status: "sending",
          recipientCount: remaining.length,
          metadata: {
            ...((fresh?.metadata as Record<string, unknown> | null) ?? {}),
            sendingStartedAt: new Date().toISOString(),
          },
        })
        .where(eq(salesEmailCampaignsTable.id, campaignId));
      return { claimed: true as const, remaining };
    });
    if (!claim.claimed) {
      res.status(409).json({
        error: "This campaign is already being sent. Wait for the in-progress send to finish before sending again.",
      });
      return;
    }
    // Adopt the lock-checked recipient list. Any contacts dropped here were
    // already sent by a concurrent run, so count them as skipped.
    skippedCount += sendable.length - claim.remaining.length;
    sendable = claim.remaining;
    if (sendable.length === 0) {
      // A concurrent send finished every remaining contact between our snapshot
      // and the claim. Release the marker back to 'sent' and report nothing sent.
      await withDbRetry(() => db.update(salesEmailCampaignsTable)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(salesEmailCampaignsTable.id, campaignId)));
      res.json({ sent: 0, failed: 0, skipped: skippedCount, linkFailures: 0, total: withEmail.length });
      return;
    }
    let lastHeartbeat = Date.now();

    const host = await getTenantOutboundOrigin(tenantId, req);
    const brandCtx = await getSalesBrandContext(tenantId);
    // Resolve the effective sender. Every tenant has a working default (Tier 1
    // shared domain) so there's no "fully configured?" gate — unconfigured
    // tenants send from {Brand} <{slug}@mail.lpstudio.ai>. Campaign metadata
    // overrides are only honored on a verified custom domain.
    const sender = await resolveTenantSender(tenantId, "sales", {
      ctx: brandCtx,
      overrides: {
        senderName: (campaign.metadata as any)?.senderName ?? null,
        senderLocalPart: (campaign.metadata as any)?.senderEmail ?? null,
        replyTo: (campaign.metadata as any)?.replyTo ?? null,
      },
    });
    const senderName =
      (campaign.metadata as any)?.senderName ?? brandCtx.senderName ?? brandCtx.brandName ?? "";
    const campaignPreviewText = ((campaign.metadata as any)?.previewText ?? "") as string;

    let sent = 0, failed = 0;
    // Count recipients who were actually emailed but went out with an empty
    // {{microsite_url}} because their personalized hotlink could not be minted.
    // Counted only on a successful send (see micrositeLinkBlank below) so a
    // separate send failure isn't double-reported. Surfaced in the response so
    // the sender knows some links were blank.
    let linkFailures = 0;

    for (const contact of sendable) {
      const unsubUrl = `${host}/api/sales/unsubscribe?token=${makeUnsubToken(tenantId, contact.id)}`;
      const companyName = contact.accountId ? (accountNameById.get(contact.accountId) ?? "") : "";
      const vars: Record<string, string> = {
        "{{first_name}}": contact.firstName ?? "",
        "{{last_name}}": contact.lastName ?? "",
        "{{company}}": companyName,
        "{{title}}": contact.title ?? "",
        "{{sender_name}}": senderName,
        "{{email}}": contact.email!,
        "{{unsubscribe_url}}": unsubUrl,
        "{{microsite_url}}": "", // fallback: replaced below if hotlink exists
      };

      // Build microsite URL. If the campaign has a landing page selected,
      // find-or-create a hotlink for this contact on the fly so every
      // recipient gets a real, personalized link — not an empty placeholder.
      let hotlink = hotlinkByContactId.get(contact.id) ?? null;
      if (!hotlink && campaignPageId) {
        try {
          const created = await ensureHotlinkForContact(tenantId, contact.id, campaignPageId, contact.salesforceId ?? null);
          hotlink = { id: created.id, token: created.token, pageId: campaignPageId };
          hotlinkByContactId.set(contact.id, hotlink);
        } catch (err) {
          logger.error({ err, contactId: contact.id, pageId: campaignPageId }, "Failed to ensure hotlink for campaign recipient");
        }
      }
      if (hotlink) {
        vars["{{microsite_url}}"] = `${host}/p/${hotlink.token}`;
      }
      // The template uses {{microsite_url}} but we couldn't mint a link for this
      // recipient — they'll get a blank link. Only counted below if the email
      // actually goes out, so a separate send failure isn't double-reported.
      const micrositeLinkBlank = needsMicrosite && !hotlink;

      const subject = replaceVars(template.subject, vars);

      // Build email body — plain templates use bodyText, styled use bodyHtml
      let emailHtml: string;
      const preheaderHtml = campaignPreviewText
        ? `<div style="display:none;font-size:1px;color:#f4f4f4;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${campaignPreviewText}${"&zwnj;&nbsp;".repeat(80)}</div>`
        : "";
      if (template.format === "plain") {
        const plainText = replaceVars(template.bodyText ?? "", vars);
        // Escape HTML entities AND linkify URLs so the personalized microsite
        // link renders as a real clickable <a>, matching the styled path.
        const rendered = escapeAndLinkifyPlainText(plainText);
        emailHtml = `${preheaderHtml}<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;white-space:pre-wrap;padding:20px;">${rendered}</div>`;
      } else {
        // Inject preheader into styled template after <body tag
        let html = replaceVars(template.bodyHtml, vars);
        if (preheaderHtml) {
          html = html.replace(/(<body[^>]*>)/i, `$1${preheaderHtml}`);
        }
        emailHtml = html;
      }

      const payload = {
        from: sender.from,
        ...(sender.replyTo ? { reply_to: sender.replyTo } : {}),
        to: [contact.email!],
        subject,
        html: emailHtml,
      };

      const result = await sendViaResend(payload);

      // Durable per-contact record. Persist IMMEDIATELY (autocommit, not batched
      // at the end) so a crash mid-loop leaves a 'sent' row for every contact we
      // already emailed — the idempotency filter above then skips them on retry
      // instead of double-sending. A failed insert after a successful send is
      // logged but does not abort the loop (the email already went out).
      try {
        await withDbRetry(() => db.insert(salesEmailSendsTable).values({
          campaignId,
          contactId: contact.id,
          hotlinkId: hotlink?.id ?? null,
          email: contact.email!,
          status: result.ok ? "sent" : "failed",
          sentAt: result.ok ? new Date() : null,
          metadata: result.ok
            ? (result.resendId ? { resendId: result.resendId } : {})
            : { error: result.error },
        }));
      } catch (insErr) {
        logger.error({ err: insErr, contactId: contact.id, campaignId }, "send-record insert failed (email status unchanged)");
      }

      if (result.ok) {
        sent++;
        if (micrositeLinkBlank) linkFailures++;
        // Create signal for email sent. The email already went out, so a
        // transient DB hiccup here must not abort the rest of the send —
        // retry then swallow (best-effort), keeping the send counted.
        try {
          const [sig1] = await withDbRetry(() => db.insert(salesSignalsTable).values({
            tenantId,
            accountId: contact.accountId,
            contactId: contact.id,
            hotlinkId: hotlink?.id ?? null,
            type: "email_sent",
            source: `Campaign: ${campaign.name}`,
            metadata: { campaignId, templateId: template.id },
          }).returning());
          if (sig1) broadcastSignal(sig1);
        } catch (sigErr) {
          logger.error({ err: sigErr, contactId: contact.id, campaignId }, "email_sent signal insert failed (email was still sent)");
        }

        // SFDC write-back: log email as Activity (fire-and-forget)
        if (contact.salesforceId) {
          sfdcService.getActiveConnection().then(conn => {
            if (conn) {
              sfdcService.logEmailActivity(conn.id, {
                contactSalesforceId: contact.salesforceId!,
                subject,
                campaignName: campaign.name,
              }).catch(() => {/* non-blocking */});
            }
          }).catch(() => {/* non-blocking */});
        }
      } else {
        failed++;
      }

      // Rate limit: 200ms delay between sends for larger campaigns
      if (sendable.length > 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Heartbeat: refresh the sendingStartedAt marker while we're actively
      // working so a long-but-healthy send is never seen as stale and reclaimed
      // by a concurrent request. Best-effort — a failed heartbeat just risks an
      // earlier stale-reclaim, which the under-lock re-filter already guards.
      if (Date.now() - lastHeartbeat > SENDING_HEARTBEAT_MS) {
        lastHeartbeat = Date.now();
        try {
          await db.execute(sql`UPDATE sales_email_campaigns SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{sendingStartedAt}', to_jsonb(${new Date().toISOString()}::text)) WHERE id = ${campaignId}`);
        } catch (hbErr) {
          logger.warn({ err: hbErr, campaignId }, "campaign send heartbeat update failed");
        }
      }
    }

    // Send records are persisted per-contact inside the loop above (durable).

    // Mark campaign as sent
    await withDbRetry(() => db.update(salesEmailCampaignsTable)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(salesEmailCampaignsTable.id, campaignId)));

    res.json({ sent, failed, skipped: skippedCount, linkFailures, total: sendable.length + skippedCount });
  } catch (err) {
    logger.error({ err, campaignId, tenantId }, "POST /sales/campaigns/:id/send error");
    if (isTransientDbError(err)) {
      res.status(503).json({
        error: "The system is briefly busy and couldn't finish sending the campaign. Please wait a moment and try again.",
      });
      return;
    }
    const detail = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Failed to send campaign: ${detail}` });
  }
});

// ─── Campaign Preview ───────────────────────────────────────
// Returns the campaign's subject + rendered HTML body for a sample recipient,
// plus a list of any unresolved {{...}} tokens. Used by the Quick Campaign
// Wizard so users can verify their email before sending.
router.post("/campaigns/:id/preview", requirePermission("sales_campaigns"), async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const campaignId = Number(req.params.id);
  const requestedContactId = req.body?.contactId ? Number(req.body.contactId) : null;
  try {
    const [campaign] = await db.select().from(salesEmailCampaignsTable)
      .where(and(
        eq(salesEmailCampaignsTable.id, campaignId),
        eq(salesEmailCampaignsTable.tenantId, tenantId),
      ));
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    if (campaign.templateId === null) {
      res.status(400).json({ error: "Campaign has no template assigned" }); return;
    }
    const [template] = await db.select().from(salesEmailTemplatesTable)
      .where(eq(salesEmailTemplatesTable.id, campaign.templateId));
    if (!template) { res.status(400).json({ error: "Template not found" }); return; }

    // Resolve a sample contact: requested one, OR first selected, OR first active in account.
    // SECURITY: only allow contacts that belong to this tenant AND are either
    // in the campaign's contactIds list or in the campaign's target account.
    const contactIds: number[] = (campaign.metadata as any)?.contactIds ?? [];
    const allowedIds = new Set(contactIds);
    let sampleContactId: number | null = null;
    if (requestedContactId && allowedIds.has(requestedContactId)) {
      sampleContactId = requestedContactId;
    } else if (contactIds.length > 0) {
      sampleContactId = contactIds[0];
    }

    let contact: typeof salesContactsTable.$inferSelect | null = null;
    if (sampleContactId) {
      const [c] = await db.select().from(salesContactsTable)
        .where(and(
          eq(salesContactsTable.id, sampleContactId),
          eq(salesContactsTable.tenantId, tenantId),
        ));
      if (c) contact = c;
    }
    if (!contact) {
      // Multi-account fallback: try metadata.accountIds first, then legacy single accountId.
      const metaAccountIds: number[] = Array.isArray((campaign.metadata as any)?.accountIds)
        ? ((campaign.metadata as any).accountIds as number[]).filter(n => typeof n === "number")
        : [];
      const previewAccountIds = metaAccountIds.length > 0
        ? metaAccountIds
        : (campaign.accountId ? [campaign.accountId] : []);
      if (previewAccountIds.length > 0) {
        const [c] = await db.select().from(salesContactsTable)
          .where(and(
            eq(salesContactsTable.tenantId, tenantId),
            inArray(salesContactsTable.accountId, previewAccountIds),
            eq(salesContactsTable.status, "active"),
          ));
        if (c) contact = c;
      }
    }

    const host = await getTenantOutboundOrigin(tenantId, req);
    const previewBrandCtx = await getSalesBrandContext(tenantId);
    const senderName = (campaign.metadata as any)?.senderName ?? previewBrandCtx.senderName ?? "Sender";

    // Build vars — real values if we have a contact, otherwise clearly-labelled samples
    let companyName = "";
    let hotlinkToken: string | null = null;
    // True only when a page IS selected but minting the personalized hotlink
    // failed — distinguishes a broken link from the "no page selected" case
    // (where {{microsite_url}} is legitimately blank).
    let micrositeLinkFailed = false;
    if (contact?.accountId) {
      const [acc] = await db.select({ name: salesAccountsTable.name })
        .from(salesAccountsTable)
        .where(eq(salesAccountsTable.id, contact.accountId));
      companyName = acc?.name ?? "";
    }
    if (contact) {
      // Prefer the campaign's selected landing page so the preview matches
      // what recipients will actually receive. For preview we accept draft
      // pages too — the send-time validation gates publishing.
      const previewPageId = (campaign.metadata as any)?.pageId as number | undefined;
      if (previewPageId) {
        try {
          const created = await ensureHotlinkForContact(tenantId, contact.id, previewPageId, contact.salesforceId ?? null);
          hotlinkToken = created.token;
        } catch (err) {
          logger.error({ err, contactId: contact.id, pageId: previewPageId }, "Failed to ensure hotlink for preview");
          micrositeLinkFailed = true;
        }
      } else {
        // Legacy fallback: any existing published-page hotlink for this contact.
        const [hl] = await db
          .select({ token: salesHotlinksTable.token })
          .from(salesHotlinksTable)
          .innerJoin(lpPagesTable, eq(salesHotlinksTable.pageId, lpPagesTable.id))
          .where(and(
            eq(salesHotlinksTable.contactId, contact.id),
            eq(salesHotlinksTable.isActive, true),
            eq(lpPagesTable.status, "published"),
          ))
          .orderBy(desc(salesHotlinksTable.createdAt))
          .limit(1);
        if (hl) hotlinkToken = hl.token;
      }
    }

    const vars: Record<string, string> = contact ? {
      "{{first_name}}": contact.firstName ?? "",
      "{{last_name}}": contact.lastName ?? "",
      "{{company}}": companyName,
      "{{title}}": contact.title ?? "",
      "{{sender_name}}": senderName,
      "{{email}}": contact.email ?? "",
      "{{unsubscribe_url}}": `${host}/api/sales/unsubscribe?token=PREVIEW`,
      "{{microsite_url}}": hotlinkToken ? `${host}/p/${hotlinkToken}` : "",
    } : {
      "{{first_name}}": "Sarah",
      "{{last_name}}": "Johnson",
      "{{company}}": "Acme Dental",
      "{{title}}": "Practice Manager",
      "{{sender_name}}": senderName,
      "{{email}}": "sarah@example.com",
      "{{unsubscribe_url}}": `${host}/api/sales/unsubscribe?token=PREVIEW`,
      "{{microsite_url}}": "",
    };

    const renderedSubject = replaceVars(template.subject, vars);
    let renderedHtml: string;
    if (template.format === "plain") {
      const plainText = replaceVars(template.bodyText ?? "", vars);
      const rendered = escapeAndLinkifyPlainText(plainText);
      renderedHtml = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;white-space:pre-wrap;padding:20px;">${rendered}</div>`;
    } else {
      renderedHtml = replaceVars(template.bodyHtml, vars);
    }

    // Check the ORIGINAL template (not the rendered output) for unresolved tokens
    const rawCombined = `${template.subject}\n${template.bodyHtml ?? ""}\n${template.bodyText ?? ""}`;
    const unresolvedTokens = findUnresolvedTokens(rawCombined, vars);

    // Also surface tokens whose value resolves to empty (e.g. missing first_name).
    // When the microsite link specifically failed to mint, exclude it here so it
    // isn't reported as generic "missing contact data" — the dedicated
    // micrositeLinkFailed flag below drives a distinct, stronger warning instead.
    const emptyTokens: string[] = [];
    for (const [k, v] of Object.entries(vars)) {
      if (v === "" && rawCombined.includes(k)) {
        if (k === "{{microsite_url}}" && micrositeLinkFailed) continue;
        emptyTokens.push(k.replace(/^\{\{|\}\}$/g, ""));
      }
    }

    res.json({
      subject: renderedSubject,
      html: renderedHtml,
      contact: contact ? {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        company: companyName,
        hasHotlink: !!hotlinkToken,
      } : null,
      unresolvedTokens,
      emptyTokens,
      micrositeLinkFailed,
      isSample: !contact,
    });
  } catch (err) {
    logger.error({ err }, "POST /sales/campaigns/:id/preview error");
    res.status(500).json({ error: "Failed to render preview" });
  }
});

// ─── Email send records ─────────────────────────────────────

router.get("/campaigns/:id/sends", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const campaignId = Number(req.params.id);

    // Verify the campaign belongs to the caller's tenant before exposing its sends.
    const [campaign] = await db.select({ id: salesEmailCampaignsTable.id })
      .from(salesEmailCampaignsTable)
      .where(and(
        eq(salesEmailCampaignsTable.id, campaignId),
        eq(salesEmailCampaignsTable.tenantId, tenantId),
      ));
    if (!campaign) {
      res.json([]);
      return;
    }

    const sends = await db.select().from(salesEmailSendsTable)
      .where(eq(salesEmailSendsTable.campaignId, campaignId))
      .orderBy(desc(salesEmailSendsTable.createdAt));
    res.json(sends);
  } catch (err) {
    logger.error({ err }, "GET /sales/campaigns/:id/sends error");
    res.status(500).json({ error: "Failed to load sends" });
  }
});

// ─── Email tracking endpoints ───────────────────────────────

router.get("/track/open", async (req, res): Promise<void> => {
  const id = req.query.id as string;
  if (id) {
    try {
      // Look up the send first so we can suppress bot/prefetch noise.
      const sendWithCampaign = await db.select({
        send: salesEmailSendsTable,
        tenantId: salesEmailCampaignsTable.tenantId,
      }).from(salesEmailSendsTable)
        .leftJoin(salesEmailCampaignsTable, eq(salesEmailSendsTable.campaignId, salesEmailCampaignsTable.id))
        .where(eq(salesEmailSendsTable.id, Number(id)));

      if (sendWithCampaign.length > 0 && !isLikelyBot(sendWithCampaign[0].send.sentAt)) {
        const { send, tenantId } = sendWithCampaign[0];
        await db.update(salesEmailSendsTable)
          .set({ status: "opened", openedAt: new Date() })
          .where(eq(salesEmailSendsTable.id, Number(id)));

        const [sig2] = await db.insert(salesSignalsTable).values({
          tenantId: tenantId ?? 0, // fallback to 0 if no campaign
          contactId: send.contactId,
          hotlinkId: send.hotlinkId,
          type: "email_open",
          source: `Send #${send.id}`,
          metadata: { campaignId: send.campaignId, email: send.email },
        }).returning();
        broadcastSignal(sig2);
      }
    } catch (err) {
      logger.error({ err }, "Tracking pixel error");
    }
  }
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" });
  res.send(PIXEL);
});

router.get("/track/click", async (req, res): Promise<void> => {
  const { sendId, url: destination } = req.query as Record<string, string>;
  if (!destination) { res.status(400).send("Missing url"); return; }

  if (sendId) {
    try {
      const sendWithCampaign = await db.select({
        send: salesEmailSendsTable,
        tenantId: salesEmailCampaignsTable.tenantId,
      }).from(salesEmailSendsTable)
        .leftJoin(salesEmailCampaignsTable, eq(salesEmailSendsTable.campaignId, salesEmailCampaignsTable.id))
        .where(eq(salesEmailSendsTable.id, Number(sendId)));

      if (sendWithCampaign.length > 0 && !isLikelyBot(sendWithCampaign[0].send.sentAt)) {
        const { send, tenantId } = sendWithCampaign[0];
        await db.update(salesEmailSendsTable)
          .set({ status: "clicked", clickedAt: new Date() })
          .where(eq(salesEmailSendsTable.id, Number(sendId)));

        const [sig3] = await db.insert(salesSignalsTable).values({
          tenantId: tenantId ?? 0, // fallback to 0 if no campaign
          contactId: send.contactId,
          hotlinkId: send.hotlinkId,
          type: "email_click",
          source: destination,
          metadata: { campaignId: send.campaignId, email: send.email },
        }).returning();
        broadcastSignal(sig3);
      }
    } catch (err) {
      logger.error({ err }, "Click tracking error");
    }
  }
  res.redirect(302, destination);
});

// ─── Hotlink-based email open tracking (for Campaign Pages) ──────────────────

router.get("/track/open-hotlink", async (req, res): Promise<void> => {
  const hotlinkId = req.query.h as string;
  if (hotlinkId) {
    try {
      // Bot/prefetch guard: if the most recent send tied to this hotlink
      // went out moments ago, skip — almost certainly an image proxy.
      const [latestSend] = await db.select({ sentAt: salesEmailSendsTable.sentAt })
        .from(salesEmailSendsTable)
        .where(eq(salesEmailSendsTable.hotlinkId, Number(hotlinkId)))
        .orderBy(desc(salesEmailSendsTable.sentAt))
        .limit(1);
      if (latestSend && isLikelyBot(latestSend.sentAt)) {
        res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" });
        res.send(PIXEL);
        return;
      }

      const hotlinkWithPage = await db.select({
        hotlink: salesHotlinksTable,
        tenantId: lpPagesTable.tenantId,
      }).from(salesHotlinksTable)
        .leftJoin(lpPagesTable, eq(salesHotlinksTable.pageId, lpPagesTable.id))
        .where(eq(salesHotlinksTable.id, Number(hotlinkId)));
      if (hotlinkWithPage.length > 0) {
        const { hotlink, tenantId } = hotlinkWithPage[0];
        if (hotlink && hotlink.contactId) {
          const [contact] = await db.select({ accountId: salesContactsTable.accountId })
            .from(salesContactsTable)
            .where(eq(salesContactsTable.id, hotlink.contactId));
          const [page] = await db.select({ title: lpPagesTable.title })
            .from(lpPagesTable)
            .where(eq(lpPagesTable.id, hotlink.pageId));
          await db.insert(salesSignalsTable).values({
            tenantId: tenantId ?? 0,
            accountId: contact?.accountId ?? null,
            contactId: hotlink.contactId,
            hotlinkId: hotlink.id,
            type: "email_open",
            source: page?.title ?? "Campaign Page",
            metadata: { pageId: hotlink.pageId },
          });
        }
      }
    } catch (err) {
      logger.error({ err }, "Hotlink open tracking error");
    }
  }
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" });
  res.send(PIXEL);
});

// ─── All sends (with contact + campaign info joined) ─────────────────────────

router.get("/sends", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const campaignIdFilter = req.query.campaignId ? Number(req.query.campaignId) : undefined;
  const limitNum = Math.min(Number(req.query.limit ?? 300), 500);

  try {
    // Tenant scope: inner-join the campaign and filter by its tenantId so a tenant
    // never sees another tenant's sends. Sends without a campaign are excluded —
    // they cannot be attributed to a tenant.
    const whereClause = campaignIdFilter
      ? and(
          eq(salesEmailCampaignsTable.tenantId, tenantId),
          eq(salesEmailSendsTable.campaignId, campaignIdFilter),
        )
      : eq(salesEmailCampaignsTable.tenantId, tenantId);

    const rows = await db
      .select({
        id: salesEmailSendsTable.id,
        campaignId: salesEmailSendsTable.campaignId,
        contactId: salesEmailSendsTable.contactId,
        email: salesEmailSendsTable.email,
        status: salesEmailSendsTable.status,
        sentAt: salesEmailSendsTable.sentAt,
        openedAt: salesEmailSendsTable.openedAt,
        clickedAt: salesEmailSendsTable.clickedAt,
        bouncedAt: salesEmailSendsTable.bouncedAt,
        createdAt: salesEmailSendsTable.createdAt,
        contactFirstName: salesContactsTable.firstName,
        contactLastName: salesContactsTable.lastName,
        accountId: salesAccountsTable.id,
        accountName: salesAccountsTable.name,
        campaignName: salesEmailCampaignsTable.name,
      })
      .from(salesEmailSendsTable)
      .innerJoin(salesEmailCampaignsTable, eq(salesEmailSendsTable.campaignId, salesEmailCampaignsTable.id))
      .leftJoin(salesContactsTable, eq(salesEmailSendsTable.contactId, salesContactsTable.id))
      .leftJoin(salesAccountsTable, eq(salesContactsTable.accountId, salesAccountsTable.id))
      .where(whereClause)
      .orderBy(desc(salesEmailSendsTable.createdAt))
      .limit(limitNum);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /sales/sends error");
    res.status(500).json({ error: "Failed to load sends" });
  }
});

// ─── Hotlink-based email click tracking (for Campaign Pages) ─────────────────

router.get("/track/click-hotlink", async (req, res): Promise<void> => {
  const { h: hotlinkId, url: destination } = req.query as Record<string, string>;
  if (!destination) { res.status(400).send("Missing url"); return; }

  if (hotlinkId) {
    try {
      // Bot/prefetch guard — same logic as the hotlink open endpoint.
      const [latestSend] = await db.select({ sentAt: salesEmailSendsTable.sentAt })
        .from(salesEmailSendsTable)
        .where(eq(salesEmailSendsTable.hotlinkId, Number(hotlinkId)))
        .orderBy(desc(salesEmailSendsTable.sentAt))
        .limit(1);
      if (latestSend && isLikelyBot(latestSend.sentAt)) {
        res.redirect(302, destination);
        return;
      }

      const hotlinkWithPage = await db.select({
        hotlink: salesHotlinksTable,
        tenantId: lpPagesTable.tenantId,
      }).from(salesHotlinksTable)
        .leftJoin(lpPagesTable, eq(salesHotlinksTable.pageId, lpPagesTable.id))
        .where(eq(salesHotlinksTable.id, Number(hotlinkId)));
      if (hotlinkWithPage.length > 0) {
        const { hotlink, tenantId } = hotlinkWithPage[0];
        if (hotlink && hotlink.contactId) {
          const [contact] = await db.select({ accountId: salesContactsTable.accountId })
            .from(salesContactsTable)
            .where(eq(salesContactsTable.id, hotlink.contactId));
          const [page] = await db.select({ title: lpPagesTable.title })
            .from(lpPagesTable)
            .where(eq(lpPagesTable.id, hotlink.pageId));
          await db.insert(salesSignalsTable).values({
            tenantId: tenantId ?? 0,
            accountId: contact?.accountId ?? null,
            contactId: hotlink.contactId,
            hotlinkId: hotlink.id,
            type: "email_click",
            source: page?.title ?? "Campaign Page",
            metadata: { pageId: hotlink.pageId, destination },
          });
        }
      }
    } catch (err) {
      logger.error({ err }, "Hotlink click tracking error");
    }
  }
  res.redirect(302, destination);
});

// ─── Single send (one-off email to a contact) ──────────────

router.post("/send-email", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { contactId, subject, bodyHtml, bodyText, senderName, senderEmail, replyTo } = req.body;
  if (!contactId || !subject || (!bodyHtml && !bodyText)) {
    res.status(400).json({ error: "contactId, subject, and either bodyHtml or bodyText are required" });
    return;
  }

  try {
    const [contact] = await db.select().from(salesContactsTable)
      .where(and(
        eq(salesContactsTable.id, Number(contactId)),
        eq(salesContactsTable.tenantId, tenantId),
      ));
    if (!contact?.email) {
      res.status(400).json({ error: "Contact has no email address" });
      return;
    }

    const singleBrandCtx = await getSalesBrandContext(tenantId);
    // Every tenant has a working default sender (Tier 1 shared domain) so no
    // "fully configured?" gate; per-request overrides apply on verified custom.
    const sender = await resolveTenantSender(tenantId, "sales", {
      ctx: singleBrandCtx,
      overrides: { senderName: senderName ?? null, senderLocalPart: senderEmail ?? null, replyTo: replyTo ?? null },
    });
    const fromName = senderName ?? singleBrandCtx.senderName ?? singleBrandCtx.brandName ?? "";

    // Fetch account name for {{company}}
    let companyName = "";
    if (contact.accountId) {
      const [account] = await db.select({ name: salesAccountsTable.name })
        .from(salesAccountsTable)
        .where(eq(salesAccountsTable.id, contact.accountId));
      companyName = account?.name ?? "";
    }

    const host = await getTenantOutboundOrigin(tenantId, req);
    const vars: Record<string, string> = {
      "{{first_name}}": contact.firstName ?? "",
      "{{last_name}}": contact.lastName ?? "",
      "{{company}}": companyName,
      "{{sender_name}}": fromName,
      "{{email}}": contact.email,
      "{{unsubscribe_url}}": `${host}/api/sales/unsubscribe?token=${makeUnsubToken(tenantId, contact.id)}`,
    };

    // Check for hotlink — only published microsites; never send a dead link.
    const [hotlinkRow] = await db
      .select({ id: salesHotlinksTable.id, token: salesHotlinksTable.token })
      .from(salesHotlinksTable)
      .innerJoin(lpPagesTable, eq(salesHotlinksTable.pageId, lpPagesTable.id))
      .where(and(
        eq(salesHotlinksTable.contactId, contact.id),
        eq(salesHotlinksTable.isActive, true),
        eq(lpPagesTable.status, "published"),
      ))
      .orderBy(desc(salesHotlinksTable.createdAt))
      .limit(1);
    const hotlink = hotlinkRow ?? null;
    if (hotlink) {
      vars["{{microsite_url}}"] = `${host}/p/${hotlink.token}`;
    }

    const renderedSubject = replaceVars(subject, vars);

    // Support both HTML and plain-text bodies
    const htmlBody = bodyHtml
      ? replaceVars(bodyHtml, vars)
      : `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#111;white-space:pre-wrap">${escapeAndLinkifyPlainText(replaceVars(bodyText, vars))}</div>`;
    const textBody = bodyText ? replaceVars(bodyText, vars) : undefined;

    const result = await sendViaResend({
      from: sender.from,
      ...(sender.replyTo ? { reply_to: sender.replyTo } : {}),
      to: [contact.email],
      subject: renderedSubject,
      html: htmlBody,
      ...(textBody ? { text: textBody } : {}),
    });

    if (!result.ok) {
      // Parse Resend error for a cleaner message
      let userMessage = "Failed to send email";
      try {
        const parsed = JSON.parse(result.error ?? "");
        if (parsed.message) userMessage = parsed.message;
      } catch { /* leave default */ }
      res.status(500).json({ error: userMessage, detail: result.error });
      return;
    }

    // Log the send
    const [sendRecord] = await db.insert(salesEmailSendsTable).values({
      contactId: contact.id,
      hotlinkId: hotlink?.id ?? null,
      email: contact.email,
      status: "sent",
      sentAt: new Date(),
    }).returning();

    // Create signal
    const [sig4] = await db.insert(salesSignalsTable).values({
      tenantId,
      accountId: contact.accountId,
      contactId: contact.id,
      hotlinkId: hotlink?.id ?? null,
      type: "email_sent",
      source: renderedSubject,
      metadata: { single: true },
    }).returning();
    broadcastSignal(sig4);

    // SFDC write-back: log single email as Activity (fire-and-forget)
    if (contact.salesforceId) {
      sfdcService.getActiveConnection().then(conn => {
        if (conn) {
          sfdcService.logEmailActivity(conn.id, {
            contactSalesforceId: contact.salesforceId!,
            subject: renderedSubject,
          }).catch(() => {/* non-blocking */});
        }
      }).catch(() => {/* non-blocking */});
    }

    res.json({ ok: true, sendId: sendRecord.id });
  } catch (err) {
    logger.error({ err }, "POST /sales/send-email error");
    res.status(500).json({ error: "Failed to send email" });
  }
});

// ─── POST /sales/send-test-email ──────────────────────────────────────────
// Sends a test email to the requester's inbox, applying merge variables from
// a real contact record (if contactId provided) or using sample placeholder values.
// Does NOT log a send record or create any signals.
router.post("/send-test-email", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { to, subject, bodyHtml, bodyText, contactId, pageId, senderName, senderEmail, replyTo } = req.body;
  if (!to || !subject || (!bodyHtml && !bodyText)) {
    res.status(400).json({ error: "to, subject, and either bodyHtml or bodyText are required" });
    return;
  }

  try {
    const testBrandCtx = await getSalesBrandContext(tenantId);
    // Every tenant has a working default sender (Tier 1 shared domain) so no
    // "fully configured?" gate; per-request overrides apply on verified custom.
    const sender = await resolveTenantSender(tenantId, "sales", {
      ctx: testBrandCtx,
      overrides: { senderName: senderName ?? null, senderLocalPart: senderEmail ?? null, replyTo: replyTo ?? null },
    });
    const fromName = senderName ?? testBrandCtx.senderName ?? testBrandCtx.brandName ?? "";

    const host = await getTenantOutboundOrigin(tenantId, req);

    // True only when a page IS selected but minting the personalized hotlink
    // failed — lets the caller distinguish a broken link from "no page selected".
    let micrositeLinkFailed = false;

    // Build merge vars — use real contact data if contactId provided, otherwise sample values
    let vars: Record<string, string> = {
      "{{first_name}}": "Sarah",
      "{{last_name}}": "Johnson",
      "{{company}}": "Acme Dental",
      "{{sender_name}}": fromName,
      "{{email}}": to,
      "{{unsubscribe_url}}": `${host}/api/sales/unsubscribe?token=PREVIEW`,
      "{{microsite_url}}": "https://example.com/p/abc12345",
    };

    if (contactId) {
      // TENANT-SCOPED so a user can't trigger hotlink creation against another
      // tenant's contacts or pages by crafting the request body.
      const [contact] = await db.select().from(salesContactsTable)
        .where(and(
          eq(salesContactsTable.id, Number(contactId)),
          eq(salesContactsTable.tenantId, tenantId),
        ));
      if (contact) {
        let companyName = "";
        if (contact.accountId) {
          const [account] = await db.select({ name: salesAccountsTable.name })
            .from(salesAccountsTable)
            .where(and(
              eq(salesAccountsTable.id, contact.accountId),
              eq(salesAccountsTable.tenantId, tenantId),
            ));
          companyName = account?.name ?? "";
        }
        // Prefer the explicit pageId (passed in from the campaign editor) so
        // the test email mirrors what real recipients will see. Auto-create
        // a hotlink for this contact+page if one doesn't already exist.
        let testToken: string | null = null;
        if (pageId) {
          // Verify the page belongs to this tenant before creating a hotlink.
          const [pg] = await db.select({ id: lpPagesTable.id })
            .from(lpPagesTable)
            .where(and(
              eq(lpPagesTable.id, Number(pageId)),
              eq(lpPagesTable.tenantId, tenantId),
            ));
          if (!pg) {
            res.status(400).json({ error: "Landing page not found for this tenant" });
            return;
          }
          try {
            const created = await ensureHotlinkForContact(tenantId, contact.id, Number(pageId), contact.salesforceId ?? null);
            testToken = created.token;
          } catch (err) {
            logger.error({ err, contactId: contact.id, pageId }, "Failed to ensure hotlink for test email");
            micrositeLinkFailed = true;
          }
        } else {
          const [hotlink] = await db
            .select({ token: salesHotlinksTable.token })
            .from(salesHotlinksTable)
            .innerJoin(lpPagesTable, eq(salesHotlinksTable.pageId, lpPagesTable.id))
            .where(and(
              eq(salesHotlinksTable.contactId, contact.id),
              eq(salesHotlinksTable.isActive, true),
              eq(lpPagesTable.status, "published"),
            ))
            .orderBy(desc(salesHotlinksTable.createdAt))
            .limit(1);
          if (hotlink) testToken = hotlink.token;
        }
        vars = {
          "{{first_name}}": contact.firstName ?? "",
          "{{last_name}}": contact.lastName ?? "",
          "{{company}}": companyName,
          "{{sender_name}}": fromName,
          "{{email}}": contact.email ?? to,
          "{{unsubscribe_url}}": `${host}/api/sales/unsubscribe?token=${makeUnsubToken(tenantId, contact.id)}`,
          "{{microsite_url}}": testToken ? `${host}/p/${testToken}` : "",
        };
      }
    }

    const renderedSubject = `[TEST] ${replaceVars(subject, vars)}`;
    const htmlBody = bodyHtml
      ? replaceVars(bodyHtml, vars)
      : `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#111;white-space:pre-wrap">${escapeAndLinkifyPlainText(replaceVars(bodyText, vars))}</div>`;
    const textBody = bodyText ? replaceVars(bodyText, vars) : undefined;

    const result = await sendViaResend({
      from: sender.from,
      ...(sender.replyTo ? { reply_to: sender.replyTo } : {}),
      to: [to],
      subject: renderedSubject,
      html: htmlBody,
      ...(textBody ? { text: textBody } : {}),
    });

    if (!result.ok) {
      let userMessage = "Failed to send test email";
      try {
        const parsed = JSON.parse(result.error ?? "");
        if (parsed.message) userMessage = parsed.message;
      } catch { /* leave default */ }
      res.status(500).json({ error: userMessage, detail: result.error });
      return;
    }

    res.json({ ok: true, micrositeLinkFailed });
  } catch (err) {
    logger.error({ err }, "POST /sales/send-test-email error");
    res.status(500).json({ error: "Failed to send test email" });
  }
});

export default router;
