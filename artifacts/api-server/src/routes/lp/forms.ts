import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpFormsTable } from "@workspace/db";
import { findTenantByHost } from "../../lib/tenantHosts";
import { getRequestHost } from "../../lib/requestHost";
import { getTenantPlanFeatures } from "../../lib/planFeatures";

const router = Router();

router.get("/lp/forms", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const forms = await db
    .select()
    .from(lpFormsTable)
    .where(eq(lpFormsTable.tenantId, tenantId))
    .orderBy(desc(lpFormsTable.createdAt));
  res.json(forms);
});

router.post("/lp/forms", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  // Task #407 — plan-tier form-count gate. Superadmin bypass.
  if (req.authUser?.appUserRole !== "superadmin") {
    try {
      const { plan, features } = await getTenantPlanFeatures(tenantId);
      const cap = features.limits.forms;
      if (cap !== null) {
        const countRow = await db.execute(
          sql`SELECT COUNT(*)::int AS n FROM lp_forms WHERE tenant_id = ${tenantId}`,
        );
        const current = Number((countRow.rows[0] as { n: number } | undefined)?.n ?? 0);
        if (current >= cap) {
          res.status(402).json({
            error: "plan_upgrade_required",
            feature: "forms",
            plan,
            limit: cap,
            current,
            message: `Your ${plan} plan is limited to ${cap} forms. Upgrade to add more.`,
          });
          return;
        }
      }
    } catch (err) {
      console.error("[lp/forms] plan-limit check failed:", err);
      res.status(503).json({ error: "plan_check_unavailable" });
      return;
    }
  }
  const [form] = await db
    .insert(lpFormsTable)
    .values({
      tenantId,
      name: name.trim(),
      description: description?.trim() ?? null,
      steps: [{ title: "Step 1", fields: [{ id: `field-${Date.now()}`, type: "email", label: "Email Address", required: true }] }],
      multiStep: false,
      submitButtonText: "Submit",
      successMessage: "Thanks! We'll be in touch.",
      redirectUrl: null,
      backgroundStyle: "white",
      emailRecipients: [],
      webhookUrl: null,
      marketoConfig: null,
      salesforceConfig: null,
      chiliPiperConfig: null,
      // Leave as NULL so the public viewer falls through to the built-in
      // default payload ({ enabled: true, event: "Marketo Form Submission",
      // formName: "Demo Form" }) — matches the SMB trios5 form 6 behavior
      // for every new form out of the box.
      gtmDataLayerConfig: null,
    })
    .returning();
  res.status(201).json(form);
});

router.get("/lp/forms/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid form ID" }); return; }

  const tenantId = req.authUser?.tenantId ?? null;

  if (tenantId !== null) {
    // Authenticated: return full form scoped to tenant
    const [form] = await db.select().from(lpFormsTable).where(
      and(eq(lpFormsTable.tenantId, tenantId), eq(lpFormsTable.id, id))
    );
    if (!form) { res.status(404).json({ error: "Form not found" }); return; }
    res.json(form);
  } else {
    // Public (unauthenticated): return only display-safe fields needed to
    // render the form. The result is scoped to the request host's tenant so
    // a viewer on tenantA's domain can never read tenantB's form (which would
    // leak tenantB's chili_piper_config URL). This also defends against the
    // page-block attack vector where a tenant author embeds another tenant's
    // formId in their page JSON: the host-scoped lookup returns 404 unless
    // the form's tenant_id matches the host-resolved tenant.
    //
    // chili_piper_config is included because the Marketo / handoff branch in
    // the public viewer needs it to build the scheduler URL on submit.
    // Marketo creds and Salesforce/email-recipient/webhook config are
    // deliberately omitted — those are operator-side integrations, never the
    // public viewer's business.
    //
    // marketo_config is sanitised to a public-safe subset before sending: we
    // expose `fieldMappings` (label → Marketo REST name) and the optional
    // `forms2` ghost-submit triple (baseUrl/munchkinId/formId), both of
    // which are needed by the front-end Forms2 ghost submission. Operator-
    // facing fields (OAuth client id/secret, etc.) live elsewhere and never
    // appear on this record.
    const host = getRequestHost(req);
    const tenantMatch = host ? await findTenantByHost(host) : null;
    if (!tenantMatch) {
      res.status(404).json({ error: "Form not found" });
      return;
    }
    const [form] = await db.select({
      id: lpFormsTable.id,
      // Expose `name` so the public viewer's Marketo embed can use it as
      // the GTM dataLayer `formName` for the "Marketo Form Submission"
      // event. The name is operator-authored display text (no creds), and
      // already appears in the page block JSON when an author links the
      // form, so this surfaces no new sensitive data.
      name: lpFormsTable.name,
      steps: lpFormsTable.steps,
      multiStep: lpFormsTable.multiStep,
      submitButtonText: lpFormsTable.submitButtonText,
      successMessage: lpFormsTable.successMessage,
      redirectUrl: lpFormsTable.redirectUrl,
      backgroundStyle: lpFormsTable.backgroundStyle,
      chiliPiperConfig: lpFormsTable.chiliPiperConfig,
      marketoConfig: lpFormsTable.marketoConfig,
      // GTM dataLayer push config (or NULL → use defaults). Exposed on
      // the public payload so BlockForm / MarketoForm on the rendered
      // page can honor the per-form override. Contains only operator-
      // authored strings (event name + formName) and an enabled flag —
      // no secrets.
      gtmDataLayerConfig: lpFormsTable.gtmDataLayerConfig,
      // Visual styling (FormStyling shape). Operator-authored color /
      // font tokens — no secrets, safe to expose on the public viewer
      // so BlockForm can apply the Inside Dandy / AVP look on render.
      styling: lpFormsTable.styling,
    }).from(lpFormsTable).where(
      and(eq(lpFormsTable.tenantId, tenantMatch.tenantId), eq(lpFormsTable.id, id)),
    );
    if (!form) { res.status(404).json({ error: "Form not found" }); return; }
    // Sanitise marketo_config to the public-safe subset before serialising.
    const rawMkto = form.marketoConfig as
      | { fieldMappings?: Record<string, string>; forms2?: { baseUrl: string; munchkinId: string; formId: number } }
      | null
      | undefined;
    const publicMarketoConfig = rawMkto
      ? {
          ...(rawMkto.fieldMappings ? { fieldMappings: rawMkto.fieldMappings } : {}),
          ...(rawMkto.forms2 ? { forms2: rawMkto.forms2 } : {}),
        }
      : null;
    // Vary on Host so the 60s edge cache doesn't serve tenantA's form
    // payload to a request that arrived on tenantB's hostname.
    res.set("Vary", "Host, X-Forwarded-Host, X-Original-Host");
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json({ ...form, marketoConfig: publicMarketoConfig });
  }
});

router.put("/lp/forms/:id", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid form ID" }); return; }

  const allowed = [
    "name", "description", "steps", "multiStep", "submitButtonText",
    "successMessage", "redirectUrl", "backgroundStyle",
    "emailRecipients", "webhookUrl", "marketoConfig", "salesforceConfig",
    "sheetsConfig",
    "chiliPiperConfig", "gtmDataLayerConfig",
    "sendFollowUpToSubmitter", "followUpTemplateId",
    "styling",
  ];
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (key in req.body) updates[key] = (req.body as Record<string, unknown>)[key];
  }

  // Validate sheetsConfig if present: must be null or an object with
  // optional { enabled:boolean, sheetId:string<=200, tabName:string<=100 }.
  // Trims strings and rejects extra keys to keep the persisted shape clean
  // before it's consumed by syncLeadToSheets.
  if ("sheetsConfig" in updates) {
    const sc = updates.sheetsConfig;
    if (sc === null || sc === undefined) {
      updates.sheetsConfig = null;
    } else if (typeof sc !== "object" || Array.isArray(sc)) {
      res.status(400).json({ error: "sheetsConfig must be an object or null" }); return;
    } else {
      const raw = sc as Record<string, unknown>;
      const clean: { enabled?: boolean; sheetId?: string; tabName?: string } = {};
      if ("enabled" in raw) {
        if (typeof raw.enabled !== "boolean") { res.status(400).json({ error: "sheetsConfig.enabled must be boolean" }); return; }
        clean.enabled = raw.enabled;
      }
      if ("sheetId" in raw && raw.sheetId != null && raw.sheetId !== "") {
        if (typeof raw.sheetId !== "string" || raw.sheetId.length > 200) { res.status(400).json({ error: "sheetsConfig.sheetId must be a string ≤200 chars" }); return; }
        clean.sheetId = raw.sheetId.trim();
      }
      if ("tabName" in raw && raw.tabName != null && raw.tabName !== "") {
        if (typeof raw.tabName !== "string" || raw.tabName.length > 100) { res.status(400).json({ error: "sheetsConfig.tabName must be a string ≤100 chars" }); return; }
        clean.tabName = raw.tabName.trim();
      }
      updates.sheetsConfig = clean;
    }
  }

  const [form] = await db
    .update(lpFormsTable)
    .set(updates)
    .where(and(eq(lpFormsTable.tenantId, tenantId), eq(lpFormsTable.id, id)))
    .returning();
  if (!form) { res.status(404).json({ error: "Form not found" }); return; }
  res.json(form);
});

router.post("/lp/forms/:id/duplicate", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid form ID" }); return; }
  const [src] = await db.select().from(lpFormsTable).where(
    and(eq(lpFormsTable.tenantId, tenantId), eq(lpFormsTable.id, id))
  );
  if (!src) { res.status(404).json({ error: "Form not found" }); return; }
  const [copy] = await db
    .insert(lpFormsTable)
    .values({
      tenantId,
      name: `${src.name} (copy)`,
      description: src.description,
      steps: src.steps,
      multiStep: src.multiStep,
      submitButtonText: src.submitButtonText,
      successMessage: src.successMessage,
      redirectUrl: src.redirectUrl,
      backgroundStyle: src.backgroundStyle,
      emailRecipients: src.emailRecipients,
      webhookUrl: src.webhookUrl,
      marketoConfig: src.marketoConfig,
      salesforceConfig: src.salesforceConfig,
      sheetsConfig: src.sheetsConfig,
      chiliPiperConfig: src.chiliPiperConfig,
      gtmDataLayerConfig: src.gtmDataLayerConfig,
      styling: src.styling,
    })
    .returning();
  res.status(201).json(copy);
});

router.delete("/lp/forms/:id", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid form ID" }); return; }
  await db.delete(lpFormsTable).where(
    and(eq(lpFormsTable.tenantId, tenantId), eq(lpFormsTable.id, id))
  );
  res.json({ success: true });
});

export default router;
