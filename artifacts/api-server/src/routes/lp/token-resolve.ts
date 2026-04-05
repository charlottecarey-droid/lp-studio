import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getClientIp, lookupGeoAsync } from "../../lib/geo";
import rateLimit from "express-rate-limit";

interface LinkWithPage {
  id: number;
  page_id: number;
  tenant_id: number | null;
  contact_name: string;
  company: string | null;
  page_title: string;
  page_slug: string;
  microsite_domain: string | null;
}

interface VisitRow {
  id: number;
  visited_at: Date;
}

interface AlertEmailRow {
  email: string;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendVisitAlert(
  recipients: string[],
  opts: { contactName: string; company?: string | null; pageTitle: string; pageSlug: string; token: string; visitedAt: string; micrositeDomain?: string | null; siteOrigin: string },
): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey || recipients.length === 0) return;

  const baseUrl =
    opts.micrositeDomain
      ? `https://${opts.micrositeDomain}`
      : (process.env["SITE_URL"] ?? opts.siteOrigin ?? null);

  const pageUrl = baseUrl ? `${baseUrl}/p/${opts.token}` : null;

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
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#333">${pageUrl ? `<a href="${pageUrl}" style="color:#003A30">${escapeHtml(opts.pageSlug)}</a>` : escapeHtml(opts.pageSlug)}</td>
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
        from: process.env["RESEND_FROM_EMAIL"] ?? "LP Studio <notifications@ent.meetdandy.com>",
        to: recipients,
        subject: `${opts.contactName} just viewed your page`,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      logger.error({ status: res.status, body, recipients }, "Resend rejected visit alert email");
    } else {
      logger.info({ recipients, contactName: opts.contactName }, "Visit alert email sent");
    }
  } catch (err) {
    logger.error({ err }, "Failed to send visit alert (network error)");
  }
}

const router = Router();

// Rate limit token resolution: 30 per IP per minute to prevent enumeration attacks
const tokenResolveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many token resolution requests. Please try again later." },
  skip: (req) => {
    // Allow internal/health checks through (optional, remove if not needed)
    return false;
  },
});

/**
 * Resolves a personalized link token. Returns the page slug and token so the
 * frontend can redirect to /lp/:slug?_plToken=<token>, enabling engagement
 * tracking (scroll depth, CTA clicks) to be attributed to the same visitor.
 */
router.get("/lp/resolve-token/:token", tokenResolveLimiter, async (req, res): Promise<void> => {
  const token = String(req.params.token);

  try {
    const linkResult = await db.execute(sql`
      SELECT pl.id, pl.page_id, pl.contact_name, pl.company, pl.tenant_id,
             lp.title AS page_title, lp.slug AS page_slug,
             t.microsite_domain
      FROM lp_personalized_links pl
      JOIN lp_pages lp ON lp.id = pl.page_id
      LEFT JOIN tenants t ON t.id = pl.tenant_id
      WHERE pl.token = ${token}
      LIMIT 1
    `);

    if (!linkResult.rows.length) {
      res.status(404).json({ error: "Link not found" });
      return;
    }

    const link = linkResult.rows[0] as unknown as LinkWithPage;
    const ip = getClientIp(req);
    const { city, region, country } = await lookupGeoAsync(ip);

    const visitResult = await db.execute(sql`
      INSERT INTO lp_personalized_link_visits (link_id, ip, city, region, country, scroll_depth_pct, cta_clicks)
      VALUES (${link.id}, ${ip}, ${city}, ${region}, ${country}, NULL, 0)
      RETURNING id, visited_at
    `);

    const visit = visitResult.rows[0] as unknown as VisitRow;

    setImmediate(async () => {
      try {
        const alertResult = await db.execute(sql`
          SELECT email FROM lp_page_alert_emails WHERE page_id = ${link.page_id}
        `);
        const recipients = (alertResult.rows as unknown as AlertEmailRow[]).map(r => r.email).filter(Boolean);
        logger.info({ pageId: link.page_id, recipients }, "Visit alert: checking recipients");
        if (!process.env["RESEND_API_KEY"]) {
          logger.warn("Visit alert skipped: RESEND_API_KEY is not set");
        } else if (recipients.length > 0) {
          const origin =
            (req.headers["x-forwarded-proto"] && req.headers["x-forwarded-host"])
              ? `${req.headers["x-forwarded-proto"]}://${req.headers["x-forwarded-host"]}`
              : `${req.protocol}://${req.get("host")}`;
          await sendVisitAlert(recipients, {
            contactName: link.contact_name,
            company: link.company,
            pageTitle: link.page_title,
            pageSlug: link.page_slug,
            token,
            visitedAt: visit?.visited_at ? String(visit.visited_at) : new Date().toISOString(),
            micrositeDomain: link.microsite_domain,
            siteOrigin: origin,
          });
        }
      } catch (err) {
        logger.error({ err }, "Failed to process visit alert");
      }
    });

    res.json({
      pageSlug: link.page_slug,
      pageTitle: link.page_title,
      contactName: link.contact_name,
      token,
      linkId: link.id,
      visitId: visit?.id,
    });
  } catch (err) {
    logger.error({ err }, "Failed to resolve token");
    res.status(500).json({ error: "Failed to resolve link" });
  }
});

export default router;
