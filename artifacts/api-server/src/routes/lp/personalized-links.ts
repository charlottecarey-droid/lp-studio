import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getClientIp, lookupGeoAsync } from "../../lib/geo";

interface LinkRow {
  id: number;
  page_id: number;
  contact_name: string;
  company: string | null;
  email: string | null;
  token: string;
  created_at: Date;
}

interface LinkWithStats extends LinkRow {
  visit_count: number;
  last_visited_at: Date | null;
  max_scroll_depth: number | null;
  total_cta_clicks: number;
}

interface VisitRow {
  id: number;
  visited_at: Date;
}

interface AlertEmailRow {
  email: string;
}

interface PageRow {
  id: number;
  title: string;
  slug: string;
}

interface LinkWithPage extends LinkRow {
  page_title: string;
  page_slug: string;
  microsite_domain: string | null;
}

function generateToken(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

async function generateUniqueToken(maxAttempts = 5): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const token = generateToken();
    const exists = await db.execute(sql`SELECT id FROM lp_personalized_links WHERE token = ${token} LIMIT 1`);
    if (exists.rows.length === 0) return token;
  }
  throw new Error("Failed to generate unique token after multiple attempts");
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendPersonalizedLinkVisitAlert(
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
    await fetch("https://api.resend.com/emails", {
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
  } catch (err) {
    logger.error({ err }, "Failed to send personalized link visit alert");
  }
}

const router = Router();

router.post("/lp/personalized-links", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { pageId, contactName, company, email } = req.body as {
    pageId?: unknown;
    contactName?: unknown;
    company?: unknown;
    email?: unknown;
  };

  if (!pageId || typeof pageId !== "number") {
    res.status(400).json({ error: "pageId is required" });
    return;
  }
  if (!contactName || typeof contactName !== "string" || !contactName.trim()) {
    res.status(400).json({ error: "contactName is required" });
    return;
  }

  try {
    const pageResult = await db.execute(sql`
      SELECT id, title, slug FROM lp_pages WHERE id = ${pageId} AND tenant_id = ${tenantId} LIMIT 1
    `);
    if (!pageResult.rows.length) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    const token = await generateUniqueToken();
    const insertResult = await db.execute(sql`
      INSERT INTO lp_personalized_links (tenant_id, page_id, contact_name, company, email, token)
      VALUES (${tenantId}, ${pageId}, ${contactName.trim()}, ${company ? String(company).trim() : null}, ${email ? String(email).trim() : null}, ${token})
      RETURNING id, page_id, contact_name, company, email, token, created_at
    `);
    res.status(201).json((insertResult.rows[0] as LinkRow));
  } catch (err) {
    logger.error({ err }, "Failed to create personalized link");
    res.status(500).json({ error: "Failed to create link" });
  }
});

router.get("/lp/personalized-links", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const pageId = req.query.pageId ? parseInt(String(req.query.pageId), 10) : null;
  if (!pageId || isNaN(pageId)) {
    res.status(400).json({ error: "pageId query param is required" });
    return;
  }

  try {
    const result = await db.execute(sql`
      SELECT
        pl.id,
        pl.page_id,
        pl.contact_name,
        pl.company,
        pl.email,
        pl.token,
        pl.created_at,
        COUNT(plv.id)::int AS visit_count,
        MAX(plv.visited_at) AS last_visited_at,
        MAX(plv.scroll_depth_pct) AS max_scroll_depth,
        COALESCE(SUM(plv.cta_clicks), 0)::int AS total_cta_clicks
      FROM lp_personalized_links pl
      LEFT JOIN lp_personalized_link_visits plv ON plv.link_id = pl.id
      WHERE pl.page_id = ${pageId} AND pl.tenant_id = ${tenantId}
      GROUP BY pl.id
      ORDER BY pl.created_at DESC
    `);
    res.json(result.rows as LinkWithStats[]);
  } catch (err) {
    logger.error({ err }, "Failed to list personalized links");
    res.status(500).json({ error: "Failed to list links" });
  }
});

router.post("/lp/personalized-links/:token/visit", async (req, res): Promise<void> => {
  const { token } = req.params;
  const { scrollDepthPct, ctaClicks } = req.body as { scrollDepthPct?: unknown; ctaClicks?: unknown };

  try {
    const linkResult = await db.execute(sql`
      SELECT pl.id, pl.page_id, pl.contact_name, pl.company, pl.email,
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

    const link = linkResult.rows[0] as LinkWithPage;
    const ip = getClientIp(req);
    const { city, region, country } = await lookupGeoAsync(ip);

    const visitResult = await db.execute(sql`
      INSERT INTO lp_personalized_link_visits (link_id, ip, city, region, country, scroll_depth_pct, cta_clicks)
      VALUES (
        ${link.id},
        ${ip},
        ${city},
        ${region},
        ${country},
        ${scrollDepthPct != null ? Number(scrollDepthPct) : null},
        ${ctaClicks != null ? Number(ctaClicks) : 0}
      )
      RETURNING id, visited_at
    `);

    const visit = visitResult.rows[0] as VisitRow;
    res.json({ success: true, visitId: visit.id });

    setImmediate(async () => {
      try {
        const alertResult = await db.execute(sql`
          SELECT email FROM lp_page_alert_emails WHERE page_id = ${link.page_id}
        `);
        const recipients = (alertResult.rows as AlertEmailRow[]).map(r => r.email).filter(Boolean);
        if (recipients.length > 0) {
          const origin =
            (req.headers["x-forwarded-proto"] && req.headers["x-forwarded-host"])
              ? `${req.headers["x-forwarded-proto"]}://${req.headers["x-forwarded-host"]}`
              : `${req.protocol}://${req.get("host")}`;
          await sendPersonalizedLinkVisitAlert(recipients, {
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
        logger.error({ err }, "Failed to send visit alert emails");
      }
    });
  } catch (err) {
    logger.error({ err }, "Failed to record link visit");
    res.status(500).json({ error: "Failed to record visit" });
  }
});

router.patch("/lp/personalized-links/:token/engagement", async (req, res): Promise<void> => {
  const { token } = req.params;
  const { scrollDepthPct, ctaClicks } = req.body as { scrollDepthPct?: unknown; ctaClicks?: unknown };

  try {
    const result = await db.execute(sql`
      UPDATE lp_personalized_link_visits
      SET
        scroll_depth_pct = GREATEST(COALESCE(scroll_depth_pct, 0), ${scrollDepthPct != null ? Number(scrollDepthPct) : 0}),
        cta_clicks = cta_clicks + ${ctaClicks != null ? Number(ctaClicks) : 0}
      WHERE id = (
        SELECT plv.id FROM lp_personalized_link_visits plv
        JOIN lp_personalized_links pl ON pl.id = plv.link_id
        WHERE pl.token = ${token}
        ORDER BY plv.visited_at DESC
        LIMIT 1
      )
      RETURNING id
    `);
    res.json({ success: true, updated: result.rows.length > 0 });
  } catch (err) {
    logger.error({ err }, "Failed to update engagement");
    res.status(500).json({ error: "Failed to update engagement" });
  }
});

router.get("/lp/page-alert-emails", async (req, res): Promise<void> => {
  const pageId = req.query.pageId ? parseInt(String(req.query.pageId), 10) : null;
  if (!pageId || isNaN(pageId)) {
    res.status(400).json({ error: "pageId query param is required" });
    return;
  }
  try {
    const result = await db.execute(sql`SELECT id, email FROM lp_page_alert_emails WHERE page_id = ${pageId} ORDER BY created_at`);
    res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "Failed to list alert emails");
    res.status(500).json({ error: "Failed to list alert emails" });
  }
});

router.post("/lp/page-alert-emails", async (req, res): Promise<void> => {
  const { pageId, email } = req.body as { pageId?: unknown; email?: unknown };
  if (!pageId || typeof pageId !== "number") {
    res.status(400).json({ error: "pageId is required" });
    return;
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }
  try {
    const result = await db.execute(sql`
      INSERT INTO lp_page_alert_emails (page_id, email)
      VALUES (${pageId}, ${email.trim().toLowerCase()})
      ON CONFLICT (page_id, email) DO NOTHING
      RETURNING id, email
    `);
    if (result.rows.length) {
      res.status(201).json(result.rows[0]);
    } else {
      res.status(200).json({ id: null, email: email.trim().toLowerCase() });
    }
  } catch (err) {
    logger.error({ err }, "Failed to add alert email");
    res.status(500).json({ error: "Failed to add alert email" });
  }
});

router.delete("/lp/page-alert-emails/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.execute(sql`DELETE FROM lp_page_alert_emails WHERE id = ${id}`);
  res.json({ success: true });
});

router.delete("/lp/personalized-links/:id", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.execute(sql`DELETE FROM lp_personalized_links WHERE id = ${id} AND tenant_id = ${tenantId}`);
  res.json({ success: true });
});

export default router;
