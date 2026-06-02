// Content Series episode-notification engine (Task #806).
//
// Backs the "email subscribers about new episodes" feature on the Content
// Series landing-page block. Responsibilities:
//   • derive a stable per-episode key (slug → rssGuid → slugified title)
//   • find a page's subscribers (leads captured via the built-in Subscribe form)
//   • send a clean branded email per new episode, deduped at-most-once per
//     (page, episode, recipient) via content_series_episode_sends
//   • honor per-page lead opt-outs (content_series_unsubscribes) + a signed,
//     stateless unsubscribe token (the app-user notification-preferences system
//     does not cover external LP leads)
//   • on (re)publish, detect newly-added episodes vs a page-level seen baseline
//     and auto-send when the block's toggle is on (never blasting the initial
//     backlog: the first baseline write sends nothing)
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  pool,
  lpLeadsTable,
  lpPagesTable,
  contentSeriesSeenEpisodesTable,
  contentSeriesEpisodeSendsTable,
  contentSeriesUnsubscribesTable,
} from "@workspace/db";
import { isTestLead, leadEmail, type LeadFields } from "@workspace/lead-utils";
import { resolveTenantSender, type ResolvedSender } from "./tenantSender";
import { getSalesBrandContext } from "./salesBrandContext";
import { escapeHtml } from "./emailRender";
import { logger } from "./logger";

const SUBSCRIBE_SOURCE = "content-series-subscribe";
const TOKEN_TTL_SEC = 60 * 60 * 24 * 365; // 1 year

/* ----------------------------- episode keys ----------------------------- */

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function episodeKeyOf(ep: {
  slug?: string | null;
  rssGuid?: string | null;
  title?: string | null;
}): string {
  const slug = (ep.slug ?? "").trim();
  if (slug) return slug;
  const guid = (ep.rssGuid ?? "").trim();
  if (guid) return guid;
  return slugify(ep.title ?? "");
}

export interface SubscribeEpisode {
  key: string;
  title: string;
  description: string;
  ctaUrl: string;
  ctaText: string;
}

export interface ContentSeriesBlockInfo {
  autoSend: boolean;
  seriesTitle: string;
  episodes: SubscribeEpisode[];
}

/**
 * Walk a page's `blocks` jsonb tree and pull out every `content-series` block's
 * notification-relevant config. Hidden episodes and episodes with no derivable
 * key are dropped; duplicate keys within a block collapse to the first.
 */
export function extractContentSeriesBlocks(blocks: unknown): ContentSeriesBlockInfo[] {
  const out: ContentSeriesBlockInfo[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    if (obj.type === "content-series" && obj.props && typeof obj.props === "object") {
      const p = obj.props as Record<string, unknown>;
      const rawEps = Array.isArray(p.episodes) ? p.episodes : [];
      const episodes: SubscribeEpisode[] = [];
      const seenKeys = new Set<string>();
      for (const e of rawEps) {
        if (!e || typeof e !== "object") continue;
        const ep = e as Record<string, unknown>;
        if (ep.hidden === true) continue;
        const title = typeof ep.title === "string" ? ep.title : "";
        const key = episodeKeyOf({
          slug: typeof ep.slug === "string" ? ep.slug : undefined,
          rssGuid: typeof ep.rssGuid === "string" ? ep.rssGuid : undefined,
          title,
        });
        if (!key || seenKeys.has(key)) continue;
        seenKeys.add(key);
        episodes.push({
          key,
          title: title || "New episode",
          description: typeof ep.description === "string" ? ep.description : "",
          ctaUrl: typeof ep.ctaUrl === "string" ? ep.ctaUrl : "",
          ctaText:
            typeof ep.ctaText === "string" && ep.ctaText.trim() ? ep.ctaText : "Watch the episode",
        });
      }
      out.push({
        autoSend: p.subscribeNotifyAutoSend === true,
        seriesTitle: typeof p.seriesTitle === "string" ? p.seriesTitle : "",
        episodes,
      });
    }
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") visit(v);
    }
  };
  visit(blocks);
  return out;
}

/* ----------------------------- subscribers ------------------------------ */

export interface Subscriber {
  email: string;
  leadId: number;
}

/**
 * Subscribers = non-test leads on this page captured via the block's built-in
 * Subscribe form (`fields._source === 'content-series-subscribe'`) that carry a
 * usable email. Deduped by lowercased email (first lead wins). Linked-form and
 * Marketo subscribers live in those external systems and are not included.
 */
export async function getPageSubscribers(tenantId: number, pageId: number): Promise<Subscriber[]> {
  const rows = await db
    .select({ id: lpLeadsTable.id, fields: lpLeadsTable.fields })
    .from(lpLeadsTable)
    .where(and(eq(lpLeadsTable.tenantId, tenantId), eq(lpLeadsTable.pageId, pageId)));
  const byEmail = new Map<string, Subscriber>();
  for (const r of rows) {
    const fields = (r.fields ?? {}) as Record<string, unknown>;
    if (fields._source !== SUBSCRIBE_SOURCE) continue;
    if (isTestLead(fields as LeadFields)) continue;
    const email = leadEmail(fields as LeadFields).trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    if (!byEmail.has(email)) byEmail.set(email, { email, leadId: r.id });
  }
  return [...byEmail.values()];
}

async function loadOptedOut(tenantId: number, pageId: number): Promise<Set<string>> {
  const rows = await db
    .select({ email: contentSeriesUnsubscribesTable.email })
    .from(contentSeriesUnsubscribesTable)
    .where(
      and(
        eq(contentSeriesUnsubscribesTable.tenantId, tenantId),
        eq(contentSeriesUnsubscribesTable.pageId, pageId),
      ),
    );
  return new Set(rows.map((r) => r.email.toLowerCase()));
}

async function loadAlreadySent(pageId: number, episodeKey: string): Promise<Set<string>> {
  const rows = await db
    .select({ email: contentSeriesEpisodeSendsTable.recipientEmail })
    .from(contentSeriesEpisodeSendsTable)
    .where(
      and(
        eq(contentSeriesEpisodeSendsTable.pageId, pageId),
        eq(contentSeriesEpisodeSendsTable.episodeKey, episodeKey),
      ),
    );
  return new Set(rows.map((r) => r.email.toLowerCase()));
}

/* --------------------------- unsubscribe token -------------------------- */

function unsubSecret(): string {
  const secret =
    process.env["NOTIFICATION_PREFS_SECRET"] ??
    process.env["UNSUB_SECRET"] ??
    process.env["SESSION_SECRET"] ??
    process.env["RESEND_API_KEY"];
  if (!secret) {
    throw new Error(
      "[contentSeriesNotify] no signing secret configured — set NOTIFICATION_PREFS_SECRET",
    );
  }
  return secret;
}

interface UnsubPayload {
  p: number; // pageId
  t: number; // tenantId
  e: string; // lowercased email
  x: number; // exp (unix seconds)
}

/** Mint a stateless, signed unsubscribe token for (tenant, page, email). */
export function makeLeadUnsubToken(tenantId: number, pageId: number, email: string): string {
  const payload: UnsubPayload = {
    p: pageId,
    t: tenantId,
    e: email.toLowerCase(),
    x: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC,
  };
  const json = JSON.stringify(payload);
  const b = Buffer.from(json, "utf8").toString("base64url");
  const mac = crypto.createHmac("sha256", unsubSecret()).update(json).digest("hex");
  return `${b}.${mac}`;
}

export function verifyLeadUnsubToken(
  token: string,
): { tenantId: number; pageId: number; email: string } | null {
  try {
    const sep = token.indexOf(".");
    if (sep < 1 || sep === token.length - 1) return null;
    const b = token.slice(0, sep);
    const mac = token.slice(sep + 1);
    const json = Buffer.from(b, "base64url").toString("utf8");
    const expected = crypto.createHmac("sha256", unsubSecret()).update(json).digest("hex");
    const macBuf = Buffer.from(mac);
    const expBuf = Buffer.from(expected);
    if (macBuf.length !== expBuf.length || !crypto.timingSafeEqual(macBuf, expBuf)) return null;
    const pl = JSON.parse(json) as Partial<UnsubPayload>;
    if (
      typeof pl.p !== "number" ||
      typeof pl.t !== "number" ||
      typeof pl.e !== "string" ||
      typeof pl.x !== "number"
    ) {
      return null;
    }
    if (Math.floor(Date.now() / 1000) > pl.x) return null;
    return { tenantId: pl.t, pageId: pl.p, email: pl.e };
  } catch {
    return null;
  }
}

/** Record a per-page opt-out for a lead email (idempotent). */
export async function recordLeadUnsubscribe(
  tenantId: number,
  pageId: number,
  email: string,
): Promise<void> {
  await db
    .insert(contentSeriesUnsubscribesTable)
    .values({ tenantId, pageId, email: email.toLowerCase() })
    .onConflictDoNothing();
}

/* ------------------------------- email body ----------------------------- */

interface BrandBits {
  brandName: string;
  primaryColor: string;
  logoUrl: string;
}

async function loadBrandBits(tenantId: number): Promise<BrandBits> {
  let brandName = "";
  try {
    brandName = (await getSalesBrandContext(tenantId)).brandName;
  } catch {
    /* fall through to brand-settings / default */
  }
  let primaryColor = "";
  let logoUrl = "";
  try {
    const r = await pool.query<{ config: Record<string, unknown> | null }>(
      `SELECT config FROM lp_brand_settings WHERE tenant_id = $1 LIMIT 1`,
      [tenantId],
    );
    const cfg = r.rows[0]?.config ?? {};
    if (typeof cfg["primaryColor"] === "string") primaryColor = cfg["primaryColor"];
    if (typeof cfg["logoUrl"] === "string") logoUrl = cfg["logoUrl"];
    if (!brandName && typeof cfg["brandName"] === "string") brandName = cfg["brandName"];
  } catch {
    /* defaults below */
  }
  return {
    brandName: brandName.trim() || "The Team",
    primaryColor: /^#[0-9a-fA-F]{3,8}$/.test(primaryColor) ? primaryColor : "#111111",
    // Only render the logo when it's an absolute http(s) URL — root-relative
    // storage paths render broken in mail clients, so fall back to the wordmark.
    logoUrl: /^https?:\/\//i.test(logoUrl) ? logoUrl : "",
  };
}

function buildEpisodeEmailHtml(opts: {
  brand: BrandBits;
  seriesTitle: string;
  episode: SubscribeEpisode;
  unsubscribeUrl: string;
}): string {
  const { brand, seriesTitle, episode, unsubscribeUrl } = opts;
  const headerInner = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.brandName)}" style="max-height:40px;max-width:200px;" />`
    : `<span style="font-size:20px;font-weight:700;color:#ffffff;">${escapeHtml(brand.brandName)}</span>`;
  const eyebrow = seriesTitle ? `New episode of ${escapeHtml(seriesTitle)}` : "New episode";
  const descHtml = episode.description
    ? `<p style="margin:0 0 24px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#444444;">${escapeHtml(
        episode.description,
      )}</p>`
    : "";
  const ctaHtml = episode.ctaUrl
    ? `<a href="${escapeHtml(episode.ctaUrl)}" style="display:inline-block;background:${escapeHtml(
        brand.primaryColor,
      )};color:#ffffff;text-decoration:none;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">${escapeHtml(
        episode.ctaText,
      )}</a>`
    : "";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:${escapeHtml(brand.primaryColor)};padding:24px 32px;text-align:left;">${headerInner}</td>
            </tr>
            <tr>
              <td style="padding:36px 32px 8px;">
                <p style="margin:0 0 8px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${escapeHtml(
                  brand.primaryColor,
                )};">${eyebrow}</p>
                <h1 style="margin:0 0 16px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:24px;line-height:1.3;color:#111111;">${escapeHtml(
                  episode.title,
                )}</h1>
                ${descHtml}
                ${ctaHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:32px;border-top:1px solid #eeeeee;">
                <p style="margin:0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#999999;">
                  You're receiving this because you subscribed to ${escapeHtml(
                    seriesTitle || brand.brandName,
                  )}.
                  <a href="${escapeHtml(unsubscribeUrl)}" style="color:#999999;text-decoration:underline;">Unsubscribe</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildUnsubUrl(requestHost: string, token: string): string {
  const host = requestHost.split(",")[0]!.trim();
  return `https://${host}/api/lp/content-series/unsubscribe?token=${encodeURIComponent(token)}`;
}

async function sendViaResend(
  apiKey: string,
  sender: ResolvedSender,
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const body: Record<string, unknown> = { from: sender.from, to: [to], subject, html };
  if (sender.replyTo) body.reply_to = sender.replyTo;
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      logger.error({ status: resp.status, body: t }, "content-series notify: Resend send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, "content-series notify: Resend send threw");
    return false;
  }
}

/* ------------------------------ send + status --------------------------- */

export interface EpisodeNotifyStatus {
  totalSubscribers: number;
  optedOut: number;
  alreadyNotified: number;
  pending: number;
}

export async function getEpisodeNotifyStatus(
  tenantId: number,
  pageId: number,
  episodeKey: string,
): Promise<EpisodeNotifyStatus> {
  const [subs, optedOutSet, sentSet] = await Promise.all([
    getPageSubscribers(tenantId, pageId),
    loadOptedOut(tenantId, pageId),
    loadAlreadySent(pageId, episodeKey),
  ]);
  let optedOut = 0;
  let alreadyNotified = 0;
  let pending = 0;
  for (const s of subs) {
    if (optedOutSet.has(s.email)) optedOut++;
    else if (sentSet.has(s.email)) alreadyNotified++;
    else pending++;
  }
  return { totalSubscribers: subs.length, optedOut, alreadyNotified, pending };
}

export interface NotifyResult {
  totalSubscribers: number;
  sent: number;
  alreadyNotified: number;
  optedOut: number;
  failed: number;
}

/**
 * Send one episode to all eligible subscribers, claiming a per-recipient dedupe
 * row before sending so concurrent auto+manual sends never double-deliver. A
 * failed send releases its claim so a later retry can re-attempt.
 */
export async function sendEpisodeNotifications(opts: {
  tenantId: number;
  pageId: number;
  seriesTitle: string;
  episode: SubscribeEpisode;
  requestHost: string;
  subscribers?: Subscriber[];
}): Promise<NotifyResult> {
  const { tenantId, pageId, episode, requestHost } = opts;
  const subscribers = opts.subscribers ?? (await getPageSubscribers(tenantId, pageId));
  const result: NotifyResult = {
    totalSubscribers: subscribers.length,
    sent: 0,
    alreadyNotified: 0,
    optedOut: 0,
    failed: 0,
  };
  const [optedOutSet, sentSet] = await Promise.all([
    loadOptedOut(tenantId, pageId),
    loadAlreadySent(pageId, episode.key),
  ]);
  const pending: Subscriber[] = [];
  for (const sub of subscribers) {
    if (optedOutSet.has(sub.email)) result.optedOut++;
    else if (sentSet.has(sub.email)) result.alreadyNotified++;
    else pending.push(sub);
  }
  if (pending.length === 0) return result;

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.warn({ tenantId, pageId }, "content-series notify: RESEND_API_KEY not set — skipping");
    result.failed += pending.length;
    return result;
  }

  const [sender, brand] = await Promise.all([
    resolveTenantSender(tenantId, "notifications"),
    loadBrandBits(tenantId),
  ]);

  for (const sub of pending) {
    // Claim the dedupe row first. onConflictDoNothing → empty returning means a
    // concurrent run already claimed it.
    const claimed = await db
      .insert(contentSeriesEpisodeSendsTable)
      .values({
        tenantId,
        pageId,
        episodeKey: episode.key,
        recipientEmail: sub.email,
        leadId: sub.leadId,
      })
      .onConflictDoNothing()
      .returning({ id: contentSeriesEpisodeSendsTable.id });
    if (claimed.length === 0) {
      result.alreadyNotified++;
      continue;
    }
    const html = buildEpisodeEmailHtml({
      brand,
      seriesTitle: opts.seriesTitle,
      episode,
      unsubscribeUrl: buildUnsubUrl(requestHost, makeLeadUnsubToken(tenantId, pageId, sub.email)),
    });
    const subject = episode.title ? `New episode: ${episode.title}` : "A new episode is live";
    const ok = await sendViaResend(apiKey, sender, sub.email, subject, html);
    if (ok) {
      result.sent++;
    } else {
      result.failed++;
      // Release the claim so the recipient can be retried later.
      await db
        .delete(contentSeriesEpisodeSendsTable)
        .where(eq(contentSeriesEpisodeSendsTable.id, claimed[0]!.id))
        .catch(() => {});
    }
  }
  return result;
}

/* --------------------------- publish-time hook -------------------------- */

/**
 * Called best-effort after a page is (re)published. Records the current episode
 * set as the page's "seen" baseline and, when a block's auto-send toggle is on,
 * emails subscribers about episodes that are genuinely new since the last
 * publish. The very first baseline write for a page sends nothing — it only
 * establishes the baseline so enabling the feature never blasts the backlog.
 */
export async function handlePagePublishNotifications(opts: {
  tenantId: number;
  pageId: number;
  requestHost: string;
}): Promise<void> {
  try {
    const [page] = await db
      .select({ blocks: lpPagesTable.blocks })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.id, opts.pageId));
    if (!page) return;

    const blocks = extractContentSeriesBlocks(page.blocks);
    if (blocks.length === 0) return;

    // Union episodes across blocks; a key is auto-send-eligible if ANY block
    // carrying it has the toggle on.
    const allEpisodes = new Map<
      string,
      { ep: SubscribeEpisode; seriesTitle: string; autoSend: boolean }
    >();
    for (const b of blocks) {
      for (const ep of b.episodes) {
        const existing = allEpisodes.get(ep.key);
        if (!existing) {
          allEpisodes.set(ep.key, { ep, seriesTitle: b.seriesTitle, autoSend: b.autoSend });
        } else if (b.autoSend) {
          existing.autoSend = true;
        }
      }
    }
    const currentKeys = [...allEpisodes.keys()];
    if (currentKeys.length === 0) return;

    const seenRows = await db
      .select({ key: contentSeriesSeenEpisodesTable.episodeKey })
      .from(contentSeriesSeenEpisodesTable)
      .where(eq(contentSeriesSeenEpisodesTable.pageId, opts.pageId));
    const seen = new Set(seenRows.map((r) => r.key));
    const isFirstBaseline = seen.size === 0;
    const newKeys = currentKeys.filter((k) => !seen.has(k));

    // Always record the full current set as the new baseline.
    await db
      .insert(contentSeriesSeenEpisodesTable)
      .values(
        currentKeys.map((k) => ({ tenantId: opts.tenantId, pageId: opts.pageId, episodeKey: k })),
      )
      .onConflictDoNothing();

    // Never auto-send the initial backlog.
    if (isFirstBaseline) return;

    const toSend = newKeys
      .map((k) => allEpisodes.get(k)!)
      .filter((x) => x.autoSend);
    if (toSend.length === 0) return;

    const subscribers = await getPageSubscribers(opts.tenantId, opts.pageId);
    if (subscribers.length === 0) return;

    for (const { ep, seriesTitle } of toSend) {
      try {
        await sendEpisodeNotifications({
          tenantId: opts.tenantId,
          pageId: opts.pageId,
          seriesTitle,
          episode: ep,
          requestHost: opts.requestHost,
          subscribers,
        });
      } catch (err) {
        logger.error({ err, pageId: opts.pageId, key: ep.key }, "content-series auto-notify failed");
      }
    }
  } catch (err) {
    logger.error({ err, pageId: opts.pageId }, "handlePagePublishNotifications failed");
  }
}
