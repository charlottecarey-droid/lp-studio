import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { randomBytes } from "crypto";
import { eq, and, isNotNull, not, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  salesContactsTable,
  salesAccountsTable,
  salesHotlinksTable,
  salesSignalsTable,
  lpPagesTable,
} from "@workspace/db";
import { resolveContacts } from "./audiences";
import { getTenantOutboundOrigin } from "../../lib/tenantHosts";
import { getSalesBrandContext } from "../../lib/salesBrandContext";
import { resolveTenantSender } from "../../lib/tenantSender";
import { isTransientDbError, withDbRetry } from "../../lib/dbResilience";

const router = Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";

// Tolerant token replacement — see campaigns.ts for full docs.
// Matches `{{ anything }}` with arbitrary whitespace/case/punctuation,
// and STRIPS any unresolved tokens so recipients never see raw merge tags.
function normalizeTokenKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
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

async function sendViaResend(payload: {
  from: string;
  reply_to?: string;
  to: string[];
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
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
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function generateToken(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

async function getOrCreateHotlink(tenantId: number, contactId: number, pageId: number, sfdcContactId?: string | null): Promise<typeof salesHotlinksTable.$inferSelect> {
  const existing = await db.select().from(salesHotlinksTable)
    .where(and(
      eq(salesHotlinksTable.contactId, contactId),
      eq(salesHotlinksTable.pageId, pageId),
    ))
    .limit(1);
  if (existing.length > 0) return existing[0];

  let token: string;
  for (let i = 0; i < 5; i++) {
    token = generateToken();
    const dup = await db.select({ id: salesHotlinksTable.id }).from(salesHotlinksTable)
      .where(eq(salesHotlinksTable.token, token)).limit(1);
    if (dup.length === 0) break;
  }
  const [hotlink] = await db.insert(salesHotlinksTable).values({
    tenantId,
    token: token!,
    contactId,
    sfdcContactId: sfdcContactId ?? null,
    pageId,
  }).returning();
  return hotlink;
}

// ─── List all hotlinks for a page (enriched with contact + account) ─────────

router.get("/campaign-pages/links/:pageId", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const pageId = Number(req.params.pageId);
    const host = await getTenantOutboundOrigin(tenantId, req);

    const links = await db
      .select({
        id: salesHotlinksTable.id,
        token: salesHotlinksTable.token,
        isActive: salesHotlinksTable.isActive,
        createdAt: salesHotlinksTable.createdAt,
        firstName: salesContactsTable.firstName,
        lastName: salesContactsTable.lastName,
        email: salesContactsTable.email,
        accountName: salesAccountsTable.name,
        accountId: salesContactsTable.accountId,
      })
      .from(salesHotlinksTable)
      .leftJoin(salesContactsTable, eq(salesHotlinksTable.contactId, salesContactsTable.id))
      .leftJoin(salesAccountsTable, eq(salesContactsTable.accountId, salesAccountsTable.id))
      .where(and(eq(salesHotlinksTable.pageId, pageId), eq(salesContactsTable.tenantId, tenantId)))
      .orderBy(salesAccountsTable.name, salesContactsTable.lastName);

    res.json(links.map(l => ({
      ...l,
      url: `${host}/p/${l.token}`,
    })));
  } catch (err) {
    console.error("GET /sales/campaign-pages/links/:pageId error:", err);
    res.status(500).json({ error: "Failed to load links" });
  }
});

// ─── Get stats for a campaign page (hotlink count, account reach) ────────────

router.get("/campaign-pages/stats/:pageId", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const pageId = Number(req.params.pageId);
    // Join through contacts to enforce tenant isolation
    const hotlinks = await db.select({ contactId: salesHotlinksTable.contactId, accountId: salesContactsTable.accountId })
      .from(salesHotlinksTable)
      .innerJoin(salesContactsTable, eq(salesHotlinksTable.contactId, salesContactsTable.id))
      .where(and(eq(salesHotlinksTable.pageId, pageId), eq(salesContactsTable.tenantId, tenantId)));

    const uniqueAccounts = new Set(hotlinks.map(h => h.accountId).filter(Boolean));

    // Count total active contacts with emails (potential reach) — tenant-scoped
    const eligible = await db.select({ id: salesContactsTable.id })
      .from(salesContactsTable)
      .where(and(
        eq(salesContactsTable.tenantId, tenantId),
        isNotNull(salesContactsTable.email),
        not(eq(salesContactsTable.status, "unsubscribed")),
      ));

    res.json({ hotlinkCount: hotlinks.length, accountCount: uniqueAccounts.size, eligibleContactCount: eligible.length });
  } catch (err) {
    console.error("GET /sales/campaign-pages/stats/:pageId error:", err);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// ─── Preview contacts eligible for a campaign launch ────────────────────────

router.get("/campaign-pages/eligible-contacts", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const contacts = await db
      .select({
        id: salesContactsTable.id,
        firstName: salesContactsTable.firstName,
        lastName: salesContactsTable.lastName,
        email: salesContactsTable.email,
        accountId: salesContactsTable.accountId,
        accountName: salesAccountsTable.name,
      })
      .from(salesContactsTable)
      .leftJoin(salesAccountsTable, eq(salesContactsTable.accountId, salesAccountsTable.id))
      .where(and(
        eq(salesContactsTable.tenantId, tenantId),
        isNotNull(salesContactsTable.email),
        not(eq(salesContactsTable.status, "unsubscribed")),
      ))
      .limit(2000);

    res.json(contacts);
  } catch (err) {
    console.error("GET /sales/campaign-pages/eligible-contacts error:", err);
    res.status(500).json({ error: "Failed to get eligible contacts" });
  }
});

// ─── Launch a campaign page to an audience ───────────────────────────────────

router.post("/campaign-pages/launch", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const {
    pageId,
    audienceId,
    emailSubject,
    emailBodyHtml,
    senderName: senderNameOverride,
    senderEmail: senderEmailOverride,
    sendEmails = true,
    alertEmails = [],
  } = req.body;

  try {
    // Per-tenant sender identity — no Dandy fallbacks. Refuse the launch
    // (rather than send from another tenant's address) when sender/reply-to
    // are unset. This DB read runs INSIDE the try (and is retry-wrapped like
    // the other launch queries) so a transient pool-saturation timeout
    // surfaces as a machine-readable 503 via the catch below — not an
    // unhandled throw that the client renders as a dead-end "Failed to launch
    // campaign" with no detail.
    const launchBrandCtx = await withDbRetry(() => getSalesBrandContext(tenantId));
    // Every tenant has a working default sender (Tier 1 shared domain), so the
    // launch no longer refuses on an unconfigured tenant — it sends from
    // {Brand} <{slug}@mail.lpstudio.ai>. Per-launch overrides apply only on a
    // verified custom domain. Resolver is retry-wrapped like the other launch
    // DB reads so a transient timeout surfaces as a 503 via the catch.
    const sender = await withDbRetry(() =>
      resolveTenantSender(tenantId, "sales", {
        ctx: launchBrandCtx,
        overrides: { senderName: senderNameOverride ?? null, senderLocalPart: senderEmailOverride ?? null },
      }),
    );
    const senderName =
      senderNameOverride ?? launchBrandCtx.senderName ?? launchBrandCtx.brandName ?? "";

    if (!pageId) {
      res.status(400).json({ error: "pageId is required" });
      return;
    }
    if (!audienceId) {
      res.status(400).json({ error: "audienceId is required — select an audience before launching" });
      return;
    }

    const [page] = await db.select().from(lpPagesTable)
      .where(and(eq(lpPagesTable.id, Number(pageId)), eq(lpPagesTable.tenantId, tenantId)));
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    if (page.status !== "published") {
      res.status(400).json({
        error: `This page is ${page.status} — publish it before launching so recipients land on a live page.`,
      });
      return;
    }

    const audResult = await db.execute(sql`
      SELECT filters FROM sales_audiences WHERE id = ${Number(audienceId)}
    `);
    if (!audResult.rows.length) {
      res.status(404).json({ error: "Audience not found" });
      return;
    }

    const host = await withDbRetry(() => getTenantOutboundOrigin(tenantId, req));
    const filters = audResult.rows[0].filters as Record<string, unknown>;
    const contacts = await resolveContacts(filters, tenantId);

    let sent = 0;
    let failed = 0;
    let hotlinksCreated = 0;

    for (const contact of contacts) {
      try {
        const existingCheck = await withDbRetry(() => db.select({ id: salesHotlinksTable.id })
          .from(salesHotlinksTable)
          .where(and(eq(salesHotlinksTable.contactId, contact.id), eq(salesHotlinksTable.pageId, Number(pageId))))
          .limit(1));
        const isNew = existingCheck.length === 0;

        const hotlink = await withDbRetry(() => getOrCreateHotlink(tenantId, contact.id, Number(pageId)));
        if (isNew) hotlinksCreated++;

        const micrositeUrl = `${host}/p/${hotlink.token}`;

        if (sendEmails && emailSubject && emailBodyHtml) {
          // Wrap the personalized link with click tracking
          const trackedMicrositeUrl = `${host}/api/sales/track/click-hotlink?h=${hotlink.id}&url=${encodeURIComponent(micrositeUrl)}`;

          const vars: Record<string, string> = {
            "{{first_name}}": contact.firstName ?? "",
            "{{last_name}}": contact.lastName ?? "",
            "{{company}}": contact.accountName ?? "",
            "{{microsite_url}}": trackedMicrositeUrl,
            "{{sender_name}}": senderName,
            "{{email}}": contact.email!,
          };

          const subject = replaceVars(emailSubject, vars);
          let html = replaceVars(emailBodyHtml, vars);

          // Inject open tracking pixel
          const pixelUrl = `${host}/api/sales/track/open-hotlink?h=${hotlink.id}`;
          const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
          html = html.includes("</body>") ? html.replace("</body>", pixel + "</body>") : html + pixel;

          const result = await sendViaResend({
            from: sender.from,
            ...(sender.replyTo ? { reply_to: sender.replyTo } : {}),
            to: [contact.email!],
            subject,
            html,
          });

          if (result.ok) {
            sent++;
            // The email already went out — a failed signal insert must not
            // un-count the send, so this is best-effort (retry then swallow).
            try {
              await withDbRetry(() => db.insert(salesSignalsTable).values({
                tenantId,
                accountId: contact.accountId,
                contactId: contact.id,
                hotlinkId: hotlink.id,
                type: "email_sent",
                source: `Campaign Page: ${page.title}`,
                metadata: { pageId: Number(pageId), micrositeUrl },
              }));
            } catch (sigErr) {
              console.error(`email_sent signal insert failed for contact ${contact.id} (email was still sent):`, sigErr);
            }
          } else {
            failed++;
            console.error(`Failed to send to ${contact.email}:`, result.error);
          }

          if (contacts.length > 10) {
            await new Promise(r => setTimeout(r, 150));
          }
        }
      } catch (contactErr) {
        // A single contact's failure (e.g. transient DB pool timeout while
        // resolving its hotlink) shouldn't abort the entire launch. Count it
        // as failed (it wasn't delivered) and continue so the rest of the
        // audience still gets sent to.
        failed++;
        console.error(
          `Launch: failed to process contact ${contact.id} (${contact.email ?? "no-email"}):`,
          contactErr,
        );
      }
    }

    // Upsert view alert emails for this page
    const validAlertEmails: string[] = Array.isArray(alertEmails)
      ? alertEmails.map((e: unknown) => String(e).trim().toLowerCase()).filter((e: string) => e.includes("@"))
      : [];
    if (validAlertEmails.length > 0) {
      for (const email of validAlertEmails) {
        await db.execute(sql`
          INSERT INTO lp_page_alert_emails (page_id, email)
          VALUES (${Number(pageId)}, ${email})
          ON CONFLICT (page_id, email) DO NOTHING
        `);
      }
    }

    if (!sendEmails) {
      res.json({
        hotlinksCreated,
        sent: 0,
        failed,
        total: contacts.length,
        alertEmailsConfigured: validAlertEmails.length,
        message: failed > 0
          ? `Hotlinks created for ${contacts.length - failed} of ${contacts.length} contacts. No emails were sent.`
          : "Hotlinks created. No emails were sent.",
      });
    } else {
      res.json({ hotlinksCreated, sent, failed, total: contacts.length, alertEmailsConfigured: validAlertEmails.length });
    }
  } catch (err) {
    // Log the real underlying error with context — the opaque fixed string
    // used to hide DB pool timeouts and made prod failures undebuggable.
    console.error(
      `POST /sales/campaign-pages/launch error (tenant ${tenantId}, page ${pageId}, audience ${audienceId}):`,
      err,
    );
    if (isTransientDbError(err)) {
      // The DB pool was briefly saturated (typically by concurrent background
      // sweeps). This is retryable — tell the user so instead of a dead-end 500.
      res.status(503).json({
        error: "The system is briefly busy and couldn't launch the campaign. Please wait a moment and try again.",
      });
      return;
    }
    const detail = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Failed to launch campaign: ${detail}` });
  }
});

export default router;
