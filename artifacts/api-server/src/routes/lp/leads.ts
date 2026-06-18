import { getTenantId } from "../../middleware/requireAuth";
import { Router, type Request } from "express";
import { eq, desc, gte, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { isTestLead, leadName, leadEmail } from "@workspace/lead-utils";
import { withDbRetry } from "../../lib/dbResilience";
import { restoreRows } from "../../lib/restoreRows";
import { lpLeadsTable, lpFormNotificationsTable, lpFormsTable, lpPagesTable, lpVariantsTable, lpSessionsTable, lpPageVisitsTable, sfdcFieldMappingsTable, salesEmailTemplatesTable, salesSignalsTable } from "@workspace/db";
import { resolveContactByEmail } from "../../lib/signalAttribution";
import { broadcastSignal } from "../sales/signals";
import { z } from "zod";
import { rateLimit, envLimit } from "../../lib/rateLimit";
import {
  sendEmailNotification,
  deliverWebhook,
  type LeadPayload,
  type MarketoConfig,
  type SalesforceConfig,
} from "../../lib/notifications";
import { syncLeadToSheets, syncLeadToMarketo } from "./integrations";
import { appendGuestApplicationToSheet } from "./podcast-availability";
import { sfdcService } from "../../lib/sfdc-service";
import { hubspotService } from "../../lib/hubspot-service";
import { slackService } from "../../lib/slack-service";
import { renderTenantEmail } from "../../lib/tenantEmailRender";
import { escapeHtml } from "../../lib/emailRender";
import { platformFromAddress, platformReplyTo } from "../../lib/platformSender";

const router = Router();

// Rate limit form submissions: 10 per IP per minute to deter spam bots.
// Generous for a human — multi-step forms submit ONCE at the end (BlockForm
// handleSubmit posts the accumulated fields in a single /lp/leads call), so
// this never blocks a legitimate multi-step flow. June 2026: moved to the
// shared memory-bounded limiter (lib/rateLimit.ts) with an env override.
const leadSubmitLimiter = rateLimit({
  name: "lp-leads",
  windowMs: 60 * 1000,
  max: envLimit("RATE_LIMIT_LEADS_PER_MIN", 10),
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

// Common label/key variants for "email" on submitted forms — first match wins.
const SUBMITTER_EMAIL_KEYS = ["email", "Email", "Email Address", "email_address", "work_email", "Work Email", "workEmail"];

function findSubmitterEmail(fields: Record<string, unknown>): string | null {
  // First try the well-known keys exactly
  for (const k of SUBMITTER_EMAIL_KEYS) {
    const v = fields[k];
    if (typeof v === "string" && v.includes("@")) return v.trim();
  }
  // Fall back to any field whose key looks like an email label
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v !== "string" || !v.includes("@")) continue;
    const norm = k.toLowerCase().replace(/[^a-z]/g, "");
    if (norm === "email" || norm.endsWith("email") || norm === "emailaddress") return v.trim();
  }
  return null;
}

// Build the merge-var lookup from form fields. Keys are exposed as both their
// raw label AND a normalised form (lowercase, spaces → underscores) so a
// template using {{first_name}} or {{First Name}} both resolve.
function buildMergeVars(fields: Record<string, unknown>): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k.startsWith("_")) continue;
    const val = v == null ? "" : String(v);
    vars[k] = val;
    const norm = k.toLowerCase().replace(/\s+/g, "_");
    if (norm !== k) vars[norm] = val;
  }
  return vars;
}

function substituteMergeVars(template: string, vars: Record<string, string>): string {
  // Match {{ anything that isn't a closing brace }} so raw labels with spaces
  // like {{First Name}} resolve alongside normalised tokens like {{first_name}}.
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, raw: string) => {
    const name = raw.trim();
    if (vars[name] !== undefined) return vars[name];
    const norm = name.toLowerCase().replace(/\s+/g, "_");
    if (vars[norm] !== undefined) return vars[norm];
    return "";
  });
}

async function sendFollowUpEmailToSubmitter(opts: {
  tenantId: number;
  templateId: number;
  fields: Record<string, unknown>;
  pageTitle: string;
  leadId: number;
}): Promise<void> {
  const { tenantId, templateId, fields, leadId } = opts;
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    console.warn("[lead", leadId, "] RESEND_API_KEY not set — skipping follow-up email");
    return;
  }

  const submitterEmail = findSubmitterEmail(fields);
  if (!submitterEmail) {
    console.warn("[lead", leadId, "] no submitter email found in fields — skipping follow-up");
    return;
  }

  const [template] = await db
    .select()
    .from(salesEmailTemplatesTable)
    .where(and(eq(salesEmailTemplatesTable.tenantId, tenantId), eq(salesEmailTemplatesTable.id, templateId)));
  if (!template || !template.isActive) {
    console.warn("[lead", leadId, "] follow-up template", templateId, "not found or inactive");
    return;
  }

  const vars = buildMergeVars(fields);
  const subject = substituteMergeVars(template.subject, vars);
  const html = template.bodyHtml ? substituteMergeVars(template.bodyHtml, vars) : undefined;
  const text = template.bodyText ? substituteMergeVars(template.bodyText, vars) : undefined;

  // Wrap the tenant's authored sales copy in their branded shell (Task #588).
  // The substituted content is injected verbatim via the `content` raw slot; on
  // any failure we fall back to the unwrapped content so the email still sends.
  let finalSubject = subject;
  let finalHtml: string | undefined = html;
  const finalText = text;
  try {
    const contentHtml =
      html ??
      (text
        ? `<p style="margin:0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.62;color:#2A2722;">${escapeHtml(
            text,
          ).replace(/\n/g, "<br>")}</p>`
        : "");
    if (contentHtml) {
      const rendered = await renderTenantEmail({
        tenantId,
        key: "form_followup",
        vars: { pageTitle: opts.pageTitle, recipientEmail: submitterEmail },
        rawSlots: { content: contentHtml },
        subjectOverride: subject,
      });
      if (rendered) {
        finalSubject = rendered.subject;
        finalHtml = rendered.html;
      }
    }
  } catch (err) {
    console.error("[lead", leadId, "] follow-up tenant render failed — using legacy fallback", err);
  }

  const followUpReplyTo = platformReplyTo();
  const body: Record<string, unknown> = {
    from: platformFromAddress(),
    to: [submitterEmail],
    subject: finalSubject,
  };
  if (followUpReplyTo) body.reply_to = followUpReplyTo;
  if (finalHtml) body.html = finalHtml;
  if (finalText) body.text = finalText;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    console.error("[lead", leadId, "] Resend follow-up failed:", resp.status, errText);
    return;
  }
  console.info("[lead", leadId, "] follow-up email sent to", submitterEmail, "(template", templateId, ")");
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

  const { pageId, variantId, formId, sessionId: bodySessionId } = parsed.data;
  const idempotencyKey = req.headers["x-idempotency-key"] as string | undefined;

  // Enrich the submitted fields with Cloudflare-supplied geo headers when available.
  // Cloudflare sets `cf-ipcountry` (ISO 3166-1 alpha-2) on every proxied request.
  // We only set the field if the form actually has a labeled slot for it AND the
  // visitor didn't already submit a value (so manual entries always win).
  const fields: Record<string, unknown> = { ...(parsed.data.fields as Record<string, unknown>) };
  const cfCountry = req.headers["cf-ipcountry"];
  const country = typeof cfCountry === "string" && cfCountry && cfCountry !== "XX" && cfCountry !== "T1"
    ? cfCountry.toUpperCase()
    : null;
  if (country) {
    for (const key of ["IP Country", "ip_country", "ipCountry", "Country"]) {
      if (key in fields && (fields[key] === "" || fields[key] == null)) {
        fields[key] = country;
      }
    }
  }

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
      // Persist the tracking session id so the page-detail visits table can
      // link this lead back to the visitor's anonymous page visits and show a
      // real name instead of "Anonymous" (Task #910).
      sessionId: bodySessionId ?? null,
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
      sessionId: bodySessionId ?? null,
      ip,
      userAgent,
      ...utmFields,
    }).returning();
    lead = newLead as LeadWithIdempotencyKey;
  }

  res.status(201).json({ success: true, leadId: lead.id });

  setImmediate(async () => {
    // Record a Sales Console "form_submit" engagement signal so a known
    // contact filling out a microsite/campaign form shows up in the activity
    // feed alongside their page views and email opens/clicks. Attribution is
    // strictly tenant-scoped by email (resolveContactByEmail); when the
    // submitter isn't a known contact we skip the signal to keep the sales
    // feed free of anonymous public-form noise. Non-blocking.
    try {
      const submitterEmail = findSubmitterEmail(fields);
      if (page.tenantId && submitterEmail) {
        const matched = await resolveContactByEmail(page.tenantId, submitterEmail);
        if (matched) {
          const [formSig] = await db.insert(salesSignalsTable).values({
            tenantId: page.tenantId,
            accountId: matched.accountId,
            contactId: matched.id,
            type: "form_submit",
            source: page.title,
            metadata: { pageId: page.id, leadId: lead.id, email: submitterEmail },
          }).returning();
          broadcastSignal(formSig);
        }
      }
    } catch (err) {
      console.error("[leads] form_submit signal error for lead", lead.id, ":", err);
    }

    // Content-series guest applications: append the submission to the
    // configured podcast tracker Google Sheet (Applications tab).
    if (fields._source === "content-series-guest") {
      appendGuestApplicationToSheet(pageId, fields, page.slug).catch(err => {
        console.error("[leads] podcast sheet writeback failed:", err);
      });
    }
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
        utm: {
          source: utmSource,
          medium: utmMedium,
          campaign: utmCampaign,
          term: utmTerm,
          content: utmContent,
        },
      };

      let emailRecipients: string[] = [];
      let webhookUrl: string | null = null;
      let marketoConfig: MarketoConfig | null = null;
      let salesforceConfig: SalesforceConfig | null = null;
      let sheetsConfig: { enabled?: boolean; sheetId?: string; tabName?: string } | null = null;
      let sendFollowUpToSubmitter = false;
      let followUpTemplateId: number | null = null;

      if (formId) {
        // Tenant-scoped lookup: a global form's config only applies when it
        // belongs to the same tenant as the page being submitted. Without
        // this guard, a request could pair pageA with formB from another
        // tenant and redirect lead sync (sheets/CRM/webhook) cross-tenant.
        const [globalForm] = await db.select().from(lpFormsTable).where(and(
          eq(lpFormsTable.id, formId),
          eq(lpFormsTable.tenantId, page.tenantId),
        ));
        if (globalForm) {
          emailRecipients = (globalForm.emailRecipients as string[]) ?? [];
          webhookUrl = globalForm.webhookUrl ?? null;
          marketoConfig = globalForm.marketoConfig as MarketoConfig | null;
          salesforceConfig = globalForm.salesforceConfig as SalesforceConfig | null;
          sheetsConfig = (globalForm.sheetsConfig as typeof sheetsConfig) ?? null;
          sendFollowUpToSubmitter = !!globalForm.sendFollowUpToSubmitter;
          followUpTemplateId = globalForm.followUpTemplateId ?? null;
        }
      } else {
        const [notif] = await db.select().from(lpFormNotificationsTable).where(eq(lpFormNotificationsTable.pageId, pageId));
        if (notif) {
          emailRecipients = (notif.emailRecipients as string[]) ?? [];
          webhookUrl = notif.webhookUrl ?? null;
          marketoConfig = notif.marketoConfig as MarketoConfig | null;
          salesforceConfig = notif.salesforceConfig as SalesforceConfig | null;
          sendFollowUpToSubmitter = !!notif.sendFollowUpToSubmitter;
          followUpTemplateId = notif.followUpTemplateId ?? null;
        }
      }

      if (emailRecipients.length > 0) {
        await sendEmailNotification(emailRecipients, payload, page.tenantId).catch(err =>
          console.error("Email notification error for lead", lead.id, ":", err)
        );
      }

      // Best-effort follow-up email to the submitter — never blocks lead
      // capture, swallows all errors. Looks up the configured template,
      // substitutes merge variables from the submitted fields (lowercased,
      // spaces → underscores), and sends via Resend.
      if (sendFollowUpToSubmitter && followUpTemplateId) {
        try {
          await sendFollowUpEmailToSubmitter({
            tenantId: page.tenantId,
            templateId: followUpTemplateId,
            fields: fields as Record<string, unknown>,
            pageTitle: page.title,
            leadId: lead.id,
          });
        } catch (err) {
          console.error("Follow-up email error for lead", lead.id, ":", err);
        }
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
      await syncLeadToSheets({
        submittedAt: payload.submittedAt,
        pageTitle: payload.pageTitle,
        pageSlug: payload.pageSlug,
        variantName: payload.variantName,
        fields: payload.fields,
      }, pageTenantId, sheetsConfig).catch(err =>
        console.error("Sheets sync error for lead", lead.id, ":", err)
      );

      // SFDC write-back: create Lead in Salesforce from form submission via the
      // tenant's OAuth connection to the shared platform Connected App (with
      // token refresh handled by sfdcService). Scoped to the page's tenant so a
      // form submit only ever pushes through the acting tenant's own connection.
      // This is the single Salesforce sync path — the legacy client_credentials
      // path has been retired. A form can still opt out via Forms → Notifications
      // (perFormSalesforce.enabled === false), and its per-form field mappings
      // are layered on top of the structured Lead fields below.
      try {
        const conn = perFormSalesforce?.enabled === false
          ? null
          : await sfdcService.getActiveConnection(pageTenantId);
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

          // Per-form field mappings (configured in Forms → Notifications) map a
          // submitted form field name → SFDC Lead API field. These are layered
          // last so they override the structured fields and UTM defaults below
          // (createLead spreads customFields after its structured fields), which
          // preserves the per-form mapping behavior unchanged after the OAuth
          // migration.
          const perFormMapped: Record<string, string> = {};
          const perFormMappings = perFormSalesforce?.fieldMappings ?? {};
          for (const [formField, sfdcField] of Object.entries(perFormMappings)) {
            const value = f[formField];
            if (sfdcField && value !== undefined && value !== "") {
              perFormMapped[sfdcField] = value;
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
            customFields: { ...sfdcUtm, ...perFormMapped },
          });
        }
      } catch (err) {
        console.error("SFDC Lead creation error:", err);
      }

      // HubSpot write-back (Phase-2 service): upsert the submitter as a HubSpot
      // contact by email (idempotent at HubSpot's side via the email
      // id-property) and, when configured, enrol them into the connection's
      // list. Idempotent per lead via the activities-pushed ledger so a retry
      // never double-pushes. Tenant-scoped: only ever pushes through the page
      // tenant's own connection. Fire-and-forget — never blocks lead capture.
      try {
        const hsConn = await hubspotService.getActiveConnection(pageTenantId);
        if (hsConn) {
          const f = fields as Record<string, string>;
          const email = f.email || f.Email || f.work_email;
          if (email) {
            await hubspotService.pushFormLead(hsConn.id, pageTenantId, {
              localEventId: `form_lead:${lead.id}`,
              email,
              firstName: f.first_name || f.firstName || f.First_Name || undefined,
              lastName: f.last_name || f.lastName || f.Last_Name || undefined,
              company: f.company || f.Company || f.practice_name || f.organization || undefined,
              title: f.title || f.Title || f.job_title || undefined,
              phone: f.phone || f.Phone || f.phone_number || undefined,
              enrollListId: hsConn.enrollListId,
            });
          }
        }
      } catch (err) {
        console.error("HubSpot lead sync error for lead", lead.id, ":", err);
      }

      // Slack notifier (outbound-only): post a Block Kit "New lead" message to
      // the tenant's configured channel. Fire-and-forget — never blocks lead
      // capture and swallows all errors. Gated on the per-event toggle.
      try {
        const slackConn = await slackService.getActiveConnection(pageTenantId);
        if (slackConn && slackConn.eventToggles.form_submit !== false) {
          const msg = slackService.buildNewLeadBlocks({
            pageTitle: page.title,
            pageSlug: page.slug,
            fields: fields as Record<string, unknown>,
            submittedAt: (lead.createdAt as Date).toISOString(),
          });
          await slackService.postMessage(pageTenantId, msg).catch(() => {});
        }
      } catch (err) {
        console.error("Slack notify error for lead", lead.id, ":", err);
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
  // Suspected test/junk leads are hidden by default so day-to-day numbers
  // reflect real activity; "?includeTest=1" reveals them (flagged client-side).
  const includeTest = req.query.includeTest === "1" || req.query.includeTest === "true";

  const dateFrom = req.query.dateFrom as string | undefined;

  const conditions = [eq(lpLeadsTable.pageId, pageId), eq(lpLeadsTable.tenantId, tenantId)];
  if (dateFrom) {
    const from = new Date(dateFrom);
    if (!isNaN(from.getTime())) {
      conditions.push(gte(lpLeadsTable.createdAt, from));
    }
  }

  // The test-lead heuristic is a JS rule (not expressible in SQL), so fetch the
  // tenant+page rows newest-first and filter/paginate in memory. Per-page lead
  // volume is small enough that this stays cheap.
  const allRows = await withDbRetry(() => db
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
    .orderBy(desc(lpLeadsTable.createdAt)));

  const withFlags = allRows.map(r => ({ ...r, isTest: isTestLead(r.fields as Record<string, unknown>) }));
  const filtered = includeTest ? withFlags : withFlags.filter(r => !r.isTest);
  const total = filtered.length;
  const rows = filtered.slice(offset, offset + limit);

  res.json({ leads: rows, page, limit, total });
});

// Master "All Leads" list — every lead across every page in the tenant,
// newest-first, joined with its page title/slug. Supports a search term that
// matches the lead's name/email and the page title, optional page filtering,
// and a flag to include suspected test leads (excluded by default). Filtering
// and pagination happen in memory because the test-lead + search heuristics
// aren't expressible in SQL.
router.get("/lp/leads/all", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;

  const page = Math.max(1, parseInt(req.query.page as string || "1", 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string || "50", 10) || 50), 200);
  const offset = (page - 1) * limit;
  const includeTest = req.query.includeTest === "1" || req.query.includeTest === "true";
  const search = (req.query.search as string || "").trim().toLowerCase();
  const pageIdRaw = parseInt(req.query.pageId as string, 10);
  const pageId = isNaN(pageIdRaw) ? null : pageIdRaw;

  const conditions = [eq(lpLeadsTable.tenantId, tenantId)];
  if (pageId !== null) conditions.push(eq(lpLeadsTable.pageId, pageId));

  const allRows = await withDbRetry(() => db
    .select({
      id: lpLeadsTable.id,
      pageId: lpLeadsTable.pageId,
      pageTitle: lpPagesTable.title,
      pageSlug: lpPagesTable.slug,
      variantId: lpLeadsTable.variantId,
      variantName: lpVariantsTable.name,
      fields: lpLeadsTable.fields,
      createdAt: lpLeadsTable.createdAt,
    })
    .from(lpLeadsTable)
    .leftJoin(lpPagesTable, eq(lpLeadsTable.pageId, lpPagesTable.id))
    .leftJoin(lpVariantsTable, eq(lpLeadsTable.variantId, lpVariantsTable.id))
    .where(and(...conditions))
    .orderBy(desc(lpLeadsTable.createdAt)));

  const withFlags = allRows.map(r => ({ ...r, isTest: isTestLead(r.fields as Record<string, unknown>) }));
  let filtered = includeTest ? withFlags : withFlags.filter(r => !r.isTest);

  if (search) {
    filtered = filtered.filter(r => {
      const fields = r.fields as Record<string, unknown>;
      const name = (leadName(fields) ?? "").toLowerCase();
      const email = leadEmail(fields).toLowerCase();
      const title = (r.pageTitle ?? "").toLowerCase();
      return name.includes(search) || email.includes(search) || title.includes(search);
    });
  }

  const total = filtered.length;
  const rows = filtered.slice(offset, offset + limit);

  res.json({ leads: rows, page, limit, total });
});

// Most recent leads across every page in the tenant — used by the
// dashboard "Recent leads" widget so users can see new activity without
// drilling into a specific page first.
router.get("/lp/leads/recent", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const limit = Math.max(1, Math.min(parseInt(req.query.limit as string || "5", 10) || 5, 25));

  const rows = await db
    .select({
      id: lpLeadsTable.id,
      pageId: lpLeadsTable.pageId,
      pageTitle: lpPagesTable.title,
      pageSlug: lpPagesTable.slug,
      fields: lpLeadsTable.fields,
      createdAt: lpLeadsTable.createdAt,
    })
    .from(lpLeadsTable)
    .leftJoin(lpPagesTable, eq(lpLeadsTable.pageId, lpPagesTable.id))
    .where(eq(lpLeadsTable.tenantId, tenantId))
    .orderBy(desc(lpLeadsTable.createdAt))
    .limit(limit);

  res.json({ leads: rows });
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
  // Suspected test leads are excluded from the per-page counts by default so
  // the summary cards reflect real activity; "?includeTest=1" counts them too.
  const includeTest = req.query.includeTest === "1" || req.query.includeTest === "true";
  const pages = await db.select().from(lpPagesTable).where(eq(lpPagesTable.tenantId, tenantId)).orderBy(lpPagesTable.title);
  const leads = await db.select().from(lpLeadsTable).where(eq(lpLeadsTable.tenantId, tenantId));

  const countByPage: Record<number, number> = {};
  for (const lead of leads) {
    if (!includeTest && isTestLead(lead.fields as Record<string, unknown>)) continue;
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

const BulkDeleteBody = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

// Tenant-scoped bulk delete. Every id must belong to the current tenant — the
// WHERE clause combines the id list with the tenant filter so a tenant can
// never delete another tenant's leads. Fails closed on a null/missing tenant
// (getTenantId already responds). Returns the count actually deleted.
router.delete("/lp/leads", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const parsed = BulkDeleteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ids must be a non-empty array of positive integers" });
    return;
  }
  try {
    // Return the full deleted rows under `restore` so the client can offer an
    // Undo affordance that re-inserts them (capture-and-reinsert pattern).
    const deleted = await withDbRetry(() => db
      .delete(lpLeadsTable)
      .where(and(eq(lpLeadsTable.tenantId, tenantId), inArray(lpLeadsTable.id, parsed.data.ids)))
      .returning());
    res.json({ deleted: deleted.length, restore: { leads: deleted } });
  } catch (err) {
    console.error("[lp/leads] bulk delete failed", err);
    res.status(500).json({ error: "Failed to delete leads" });
  }
});

// Permanently delete every suspected test/junk lead for the tenant. The
// heuristic is JS-only, so we load the tenant's leads, compute the test ids,
// and delete just those (still tenant-scoped). Returns the count deleted.
router.delete("/lp/leads/test", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const rows = await withDbRetry(() => db
      .select({ id: lpLeadsTable.id, fields: lpLeadsTable.fields })
      .from(lpLeadsTable)
      .where(eq(lpLeadsTable.tenantId, tenantId)));
    const testIds = rows
      .filter(r => isTestLead(r.fields as Record<string, unknown>))
      .map(r => r.id);
    if (testIds.length === 0) {
      res.json({ deleted: 0 });
      return;
    }
    const deleted = await withDbRetry(() => db
      .delete(lpLeadsTable)
      .where(and(eq(lpLeadsTable.tenantId, tenantId), inArray(lpLeadsTable.id, testIds)))
      .returning());
    res.json({ deleted: deleted.length, restore: { leads: deleted } });
  } catch (err) {
    console.error("[lp/leads] delete test leads failed", err);
    res.status(500).json({ error: "Failed to delete test leads" });
  }
});

// Restore leads deleted via Undo. Re-inserts the captured rows with their
// original ids/timestamps preserved (capture-and-reinsert). restoreRows forces
// the trusted tenantId onto every row so a tampered payload can never land a
// lead in another tenant, and onConflictDoNothing makes it idempotent.
router.post("/lp/leads/restore", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const { leads } = req.body as { leads?: unknown[] };
    const restored = await restoreRows(lpLeadsTable, leads, { tenantId });
    res.json({ restored });
  } catch (err) {
    console.error("[lp/leads] restore failed", err);
    res.status(500).json({ error: "Failed to restore leads" });
  }
});

export default router;
