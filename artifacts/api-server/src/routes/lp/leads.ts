import { getTenantId } from "../../middleware/requireAuth";
import { Router, type Request } from "express";
import { eq, desc, gte, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpLeadsTable, lpFormNotificationsTable, lpFormsTable, lpPagesTable, lpVariantsTable, lpSessionsTable, lpPageVisitsTable, sfdcFieldMappingsTable } from "@workspace/db";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import {
  sendEmailNotification,
  deliverWebhook,
  type LeadPayload,
  type MarketoConfig,
  type SalesforceConfig,
} from "../../lib/notifications";
import { syncLeadToSheets, syncLeadToMarketo, syncLeadToSalesforce } from "./integrations";
import { sfdcService } from "../../lib/sfdc-service";

const router = Router();

// Rate limit form submissions: 10 per IP per minute to deter spam bots.
const leadSubmitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many form submissions. Please try again in a minute." },
});

const SubmitLeadBody = z.object({
  pageId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  formId: z.number().int().positive().optional(),
  fields: z.record(z.unknown()),
  sessionId: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
});

// Table schema extension type for idempotency key (if column exists)
interface LeadWithIdempotencyKey {
  id: number;
  idempotencyKey?: string | null;
  [key: string]: unknown;
}

function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return (typeof fwd === "string" ? fwd : fwd[0]).split(",")[0].trim();
  return req.socket?.remoteAddress ?? req.ip ?? "";
}

router.post("/lp/leads", leadSubmitLimiter, async (req, res): Promise<void> => {
  const parsed = SubmitLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { pageId, variantId, formId, fields, sessionId: bodySessionId } = parsed.data;
  const idempotencyKey = req.headers["x-idempotency-key"] as string | undefined;

  const [page] = await db.select().from(lpPagesTable).where(eq(lpPagesTable.id, pageId));
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] ?? null;

  // Resolve UTM parameters — prefer values sent by the client, fall back to
  // the session or page visit record so attribution is never lost.
  let utmSource = parsed.data.utmSource ?? null;
  let utmMedium = parsed.data.utmMedium ?? null;
  let utmCampaign = parsed.data.utmCampaign ?? null;
  let utmTerm = parsed.data.utmTerm ?? null;
  let utmContent = parsed.data.utmContent ?? null;

  if (!utmSource && bodySessionId) {
    // Try session first (A/B test pages store UTM on sessions)
    const [sess] = await db
      .select({ utmSource: lpSessionsTable.utmSource, utmMedium: lpSessionsTable.utmMedium, utmCampaign: lpSessionsTable.utmCampaign, utmTerm: lpSessionsTable.utmTerm, utmContent: lpSessionsTable.utmContent })
      .from(lpSessionsTable)
      .where(eq(lpSessionsTable.sessionId, bodySessionId));
    if (sess?.utmSource) {
      utmSource = sess.utmSource;
      utmMedium = utmMedium || sess.utmMedium;
      utmCampaign = utmCampaign || sess.utmCampaign;
      utmTerm = utmTerm || sess.utmTerm;
      utmContent = utmContent || sess.utmContent;
    }
    // Fall back to page visit (builder pages store UTM on visits)
    if (!utmSource) {
      const [visit] = await db
        .select({ utmSource: lpPageVisitsTable.utmSource, utmMedium: lpPageVisitsTable.utmMedium, utmCampaign: lpPageVisitsTable.utmCampaign, utmTerm: lpPageVisitsTable.utmTerm, utmContent: lpPageVisitsTable.utmContent })
        .from(lpPageVisitsTable)
        .where(and(eq(lpPageVisitsTable.sessionId, bodySessionId), eq(lpPageVisitsTable.pageId, pageId)));
      if (visit?.utmSource) {
        utmSource = visit.utmSource;
        utmMedium = utmMedium || visit.utmMedium;
        utmCampaign = utmCampaign || visit.utmCampaign;
        utmTerm = utmTerm || visit.utmTerm;
        utmContent = utmContent || visit.utmContent;
      }
    }
  }

  // Last-resort: extract UTMs from the submitted fields JSON.
  // Forms with hidden UTM fields (e.g. the SFDC global form) store them
  // under labels like "UTM Source", "UTM Medium", etc.
  if (!utmSource && fields) {
    const f = fields as Record<string, unknown>;
    const pick = (label: string): string | null => {
      const v = f[label];
      return typeof v === "string" && v ? v : null;
    };
    utmSource   = utmSource   ?? pick("UTM Source")   ?? pick("utm_source");
    utmMedium   = utmMedium   ?? pick("UTM Medium")   ?? pick("utm_medium");
    utmCampaign = utmCampaign ?? pick("UTM Campaign") ?? pick("utm_campaign");
    utmTerm     = utmTerm     ?? pick("UTM Term")     ?? pick("utm_term");
    utmContent  = utmContent  ?? pick("UTM Content")  ?? pick("utm_content");
  }

  const utmFields = { utmSource, utmMedium, utmCampaign, utmTerm, utmContent };

  // Check for idempotent resubmission if key is provided
  let lead: LeadWithIdempotencyKey;
  if (idempotencyKey) {
    const [existing] = await db.select().from(lpLeadsTable).where(eq((lpLeadsTable as any).idempotencyKey, idempotencyKey));
    if (existing) {
      res.status(201).json({ success: true, leadId: existing.id, isRetry: true });
      return;
    }
    const [newLead] = await db.insert(lpLeadsTable).values({
      tenantId: page.tenantId,
      pageId,
      variantId: variantId ?? null,
      fields,
      ip,
      userAgent,
      ...utmFields,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    } as any).returning();
    lead = newLead as LeadWithIdempotencyKey;
  } else {
    const [newLead] = await db.insert(lpLeadsTable).values({
      tenantId: page.tenantId,
      pageId,
      variantId: variantId ?? null,
      fields,
      ip,
      userAgent,
      ...utmFields,
    }).returning();
    lead = newLead as LeadWithIdempotencyKey;
  }

  res.status(201).json({ success: true, leadId: lead.id });

  setImmediate(async () => {
    try {
      let variantName: string | undefined;
      if (variantId) {
        const [variant] = await db.select().from(lpVariantsTable).where(eq(lpVariantsTable.id, variantId));
        variantName = variant?.name ?? undefined;
      }

      const payload: LeadPayload = {
        leadId: lead.id,
        pageId: page.id,
        pageSlug: page.slug,
        pageTitle: page.title,
        variantName,
        fields: fields as Record<string, unknown>,
        submittedAt: (lead.createdAt as Date).toISOString(),
      };

      let emailRecipients: string[] = [];
      let webhookUrl: string | null = null;
      let marketoConfig: MarketoConfig | null = null;
      let salesforceConfig: SalesforceConfig | null = null;

      if (formId) {
        const [globalForm] = await db.select().from(lpFormsTable).where(eq(lpFormsTable.id, formId));
        if (globalForm) {
          emailRecipients = (globalForm.emailRecipients as string[]) ?? [];
          webhookUrl = globalForm.webhookUrl ?? null;
          marketoConfig = globalForm.marketoConfig as MarketoConfig | null;
          salesforceConfig = globalForm.salesforceConfig as SalesforceConfig | null;
        }
      } else {
        const [notif] = await db.select().from(lpFormNotificationsTable).where(eq(lpFormNotificationsTable.pageId, pageId));
        if (notif) {
          emailRecipients = (notif.emailRecipients as string[]) ?? [];
          webhookUrl = notif.webhookUrl ?? null;
          marketoConfig = notif.marketoConfig as MarketoConfig | null;
          salesforceConfig = notif.salesforceConfig as SalesforceConfig | null;
        }
      }

      if (emailRecipients.length > 0) {
        await sendEmailNotification(emailRecipients, payload).catch(err =>
          console.error("Email notification error for lead", lead.id, ":", err)
        );
      }
      if (webhookUrl) {
        await deliverWebhook(webhookUrl, payload).catch(err =>
          console.error("Webhook delivery error for lead", lead.id, ":", err)
        );
      }

      const pageTenantId = page.tenantId;
      if (!pageTenantId) {
        console.error("Page", page.id, "has no tenant - skipping integrations");
        return;
      }

      const perFormMarketo = marketoConfig as { enabled?: boolean; fieldMappings?: Record<string, string> } | null;
      const perFormSalesforce = salesforceConfig as { enabled?: boolean; fieldMappings?: Record<string, string> } | null;

      await syncLeadToMarketo(payload, perFormMarketo?.fieldMappings, perFormMarketo?.enabled, pageTenantId).catch(err =>
        console.error("Marketo sync error for lead", lead.id, ":", err)
      );
      await syncLeadToSalesforce(payload, perFormSalesforce?.fieldMappings, perFormSalesforce?.enabled, pageTenantId).catch(err =>
        console.error("Salesforce sync error for lead", lead.id, ":", err)
      );
      await syncLeadToSheets({
        submittedAt: payload.submittedAt,
        pageTitle: payload.pageTitle,
        pageSlug: payload.pageSlug,
        variantName: payload.variantName,
        fields: payload.fields,
      }, pageTenantId).catch(err =>
        console.error("Sheets sync error for lead", lead.id, ":", err)
      );

      // SFDC write-back: create Lead in Salesforce from form submission
      try {
        const conn = await sfdcService.getActiveConnection();
        if (conn) {
          const f = fields as Record<string, string>;

          // Look up configured field mappings for the Lead object so UTM
          // params map to whatever fields already exist in this SFDC org
          // (e.g. utm_source__c, UTM_Source__c, GA_Source__c, etc.).
          const mappings = await db
            .select({ sfdcField: sfdcFieldMappingsTable.sfdcField, localField: sfdcFieldMappingsTable.localField })
            .from(sfdcFieldMappingsTable)
            .where(and(
              eq(sfdcFieldMappingsTable.connectionId, conn.id),
              eq(sfdcFieldMappingsTable.sfdcObject, "Lead"),
              eq(sfdcFieldMappingsTable.localTable, "lp_leads"),
              eq(sfdcFieldMappingsTable.isActive, true),
            ));

          // Build a lookup: local column name → SFDC API field name
          const fieldMap: Record<string, string> = {};
          for (const m of mappings) {
            fieldMap[m.localField] = m.sfdcField;
          }

          // Map UTM values to their configured SFDC field names.
          // Falls back to common conventions if no mapping is configured.
          const utmEntries: [string | null, string, string][] = [
            [utmSource, "utm_source", "utm_source__c"],
            [utmMedium, "utm_medium", "utm_medium__c"],
            [utmCampaign, "utm_campaign", "utm_campaign__c"],
            [utmTerm, "utm_term", "utm_term__c"],
            [utmContent, "utm_content", "utm_content__c"],
          ];

          const sfdcUtm: Record<string, string> = {};
          for (const [value, localCol, fallbackSfdcField] of utmEntries) {
            if (value) {
              sfdcUtm[fieldMap[localCol] || fallbackSfdcField] = value;
            }
          }

          await sfdcService.createLead(conn.id, {
            firstName: f.first_name || f.firstName || f.First_Name || undefined,
            lastName: f.last_name || f.lastName || f.Last_Name || "Unknown",
            email: f.email || f.Email || f.work_email || undefined,
            company: f.company || f.Company || f.practice_name || f.organization || undefined,
            title: f.title || f.Title || f.job_title || undefined,
            phone: f.phone || f.Phone || f.phone_number || undefined,
            leadSource: `LP Studio: ${page.title}`,
            description: `Form submission from page "${page.title}" (${page.slug}) at ${(lead.createdAt as Date).toISOString()}`,
            customFields: sfdcUtm,
          });
        }
      } catch (err) {
        console.error("SFDC Lead creation error:", err);
      }
    } catch (err) {
      console.error("Error processing lead notifications:", err);
    }
  });
});

router.get("/lp/leads", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const pageId = parseInt(req.query.pageId as string, 10);
  if (isNaN(pageId)) {
    res.status(400).json({ error: "pageId query param is required" });
    return;
  }

  const page = parseInt(req.query.page as string || "1", 10);
  const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);
  const offset = (page - 1) * limit;

  const dateFrom = req.query.dateFrom as string | undefined;

  const conditions = [eq(lpLeadsTable.pageId, pageId), eq(lpLeadsTable.tenantId, tenantId)];
  if (dateFrom) {
    const from = new Date(dateFrom);
    if (!isNaN(from.getTime())) {
      conditions.push(gte(lpLeadsTable.createdAt, from));
    }
  }

  const rows = await db
    .select({
      id: lpLeadsTable.id,
      pageId: lpLeadsTable.pageId,
      variantId: lpLeadsTable.variantId,
      variantName: lpVariantsTable.name,
      fields: lpLeadsTable.fields,
      ip: lpLeadsTable.ip,
      userAgent: lpLeadsTable.userAgent,
      createdAt: lpLeadsTable.createdAt,
    })
    .from(lpLeadsTable)
    .leftJoin(lpVariantsTable, eq(lpLeadsTable.variantId, lpVariantsTable.id))
    .where(and(...conditions))
    .orderBy(desc(lpLeadsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ leads: rows, page, limit });
});

router.get("/lp/leads/export", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const pageId = parseInt(req.query.pageId as string, 10);
  if (isNaN(pageId)) {
    res.status(400).json({ error: "pageId query param is required" });
    return;
  }

  const dateFrom = req.query.dateFrom as string | undefined;
  const conditions = [eq(lpLeadsTable.pageId, pageId), eq(lpLeadsTable.tenantId, tenantId)];
  if (dateFrom) {
    const from = new Date(dateFrom);
    if (!isNaN(from.getTime())) {
      conditions.push(gte(lpLeadsTable.createdAt, from));
    }
  }

  const leads = await db
    .select({
      id: lpLeadsTable.id,
      pageId: lpLeadsTable.pageId,
      variantId: lpLeadsTable.variantId,
      variantName: lpVariantsTable.name,
      fields: lpLeadsTable.fields,
      ip: lpLeadsTable.ip,
      createdAt: lpLeadsTable.createdAt,
    })
    .from(lpLeadsTable)
    .leftJoin(lpVariantsTable, eq(lpLeadsTable.variantId, lpVariantsTable.id))
    .where(and(...conditions))
    .orderBy(desc(lpLeadsTable.createdAt));

  if (leads.length === 0) {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="leads-page-${pageId}.csv"`);
    res.end("id,submitted_at,variant,ip\r\n");
    return;
  }

  const allFieldKeys = new Set<string>();
  for (const lead of leads) {
    const fields = lead.fields as Record<string, unknown>;
    for (const k of Object.keys(fields)) {
      if (!k.startsWith("_")) allFieldKeys.add(k);
    }
  }
  const fieldKeys = Array.from(allFieldKeys);

  const escapeCsv = (val: unknown): string => {
    const str = val == null ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = ["id", "submitted_at", "variant", ...fieldKeys, "ip"];

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="leads-page-${pageId}.csv"`);

  res.write(headers.join(",") + "\r\n");

  for (const lead of leads) {
    const fields = lead.fields as Record<string, unknown>;
    const variantLabel = lead.variantName ?? (lead.variantId ? `Variant ${lead.variantId}` : "Control");
    const row = [
      lead.id,
      lead.createdAt.toISOString(),
      escapeCsv(variantLabel),
      ...fieldKeys.map(k => escapeCsv(fields[k])),
      escapeCsv(lead.ip),
    ];
    res.write(row.join(",") + "\r\n");
  }

  res.end();
});

router.get("/lp/leads/summary", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const pages = await db.select().from(lpPagesTable).where(eq(lpPagesTable.tenantId, tenantId)).orderBy(lpPagesTable.title);
  const leads = await db.select().from(lpLeadsTable).where(eq(lpLeadsTable.tenantId, tenantId));

  const countByPage: Record<number, number> = {};
  for (const lead of leads) {
    countByPage[lead.pageId] = (countByPage[lead.pageId] ?? 0) + 1;
  }

  const result = pages.map(p => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    leadCount: countByPage[p.id] ?? 0,
  }));

  res.json(result);
});

export default router;
