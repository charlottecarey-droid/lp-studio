import { Router, type Request } from "express";
import { eq, desc, gte, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpLeadsTable, lpFormNotificationsTable, lpPagesTable, lpVariantsTable } from "@workspace/db";
import { z } from "zod";
import {
  sendEmailNotification,
  deliverWebhook,
  syncToMarketo,
  syncToSalesforce,
  type LeadPayload,
  type MarketoConfig,
  type SalesforceConfig,
} from "../../lib/notifications";

const router = Router();

const SubmitLeadBody = z.object({
  pageId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  fields: z.record(z.unknown()),
});

function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return (typeof fwd === "string" ? fwd : fwd[0]).split(",")[0].trim();
  return req.socket?.remoteAddress ?? req.ip ?? "";
}

router.post("/lp/leads", async (req, res): Promise<void> => {
  const parsed = SubmitLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { pageId, variantId, fields } = parsed.data;

  const [page] = await db.select().from(lpPagesTable).where(eq(lpPagesTable.id, pageId));
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] ?? null;

  const [lead] = await db.insert(lpLeadsTable).values({
    pageId,
    variantId: variantId ?? null,
    fields,
    ip,
    userAgent,
  }).returning();

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
        submittedAt: lead.createdAt.toISOString(),
      };

      const [notif] = await db.select().from(lpFormNotificationsTable).where(eq(lpFormNotificationsTable.pageId, pageId));

      if (notif) {
        const recipients = (notif.emailRecipients as string[]) ?? [];
        if (recipients.length > 0) {
          await sendEmailNotification(recipients, payload);
        }
        if (notif.webhookUrl) {
          await deliverWebhook(notif.webhookUrl, payload);
        }
        if (notif.marketoConfig) {
          await syncToMarketo(notif.marketoConfig as MarketoConfig, payload);
        }
        if (notif.salesforceConfig) {
          await syncToSalesforce(notif.salesforceConfig as SalesforceConfig, payload);
        }
      }
    } catch (err) {
      console.error("Error processing lead notifications:", err);
    }
  });
});

router.get("/lp/leads", async (req, res): Promise<void> => {
  const pageId = parseInt(req.query.pageId as string, 10);
  if (isNaN(pageId)) {
    res.status(400).json({ error: "pageId query param is required" });
    return;
  }

  const page = parseInt(req.query.page as string || "1", 10);
  const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);
  const offset = (page - 1) * limit;

  const dateFrom = req.query.dateFrom as string | undefined;

  const conditions = [eq(lpLeadsTable.pageId, pageId)];
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
  const pageId = parseInt(req.query.pageId as string, 10);
  if (isNaN(pageId)) {
    res.status(400).json({ error: "pageId query param is required" });
    return;
  }

  const dateFrom = req.query.dateFrom as string | undefined;
  const conditions = [eq(lpLeadsTable.pageId, pageId)];
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

router.get("/lp/leads/summary", async (_req, res): Promise<void> => {
  const pages = await db.select().from(lpPagesTable).orderBy(lpPagesTable.title);
  const leads = await db.select().from(lpLeadsTable);

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
