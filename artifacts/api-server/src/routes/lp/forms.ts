import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpFormsTable } from "@workspace/db";
import { findTenantByHost } from "../../lib/tenantHosts";
import { getRequestHost } from "../../lib/requestHost";

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
    const host = getRequestHost(req);
    const tenantMatch = host ? await findTenantByHost(host) : null;
    if (!tenantMatch) {
      res.status(404).json({ error: "Form not found" });
      return;
    }
    const [form] = await db.select({
      id: lpFormsTable.id,
      steps: lpFormsTable.steps,
      multiStep: lpFormsTable.multiStep,
      submitButtonText: lpFormsTable.submitButtonText,
      successMessage: lpFormsTable.successMessage,
      redirectUrl: lpFormsTable.redirectUrl,
      backgroundStyle: lpFormsTable.backgroundStyle,
      chiliPiperConfig: lpFormsTable.chiliPiperConfig,
    }).from(lpFormsTable).where(
      and(eq(lpFormsTable.tenantId, tenantMatch.tenantId), eq(lpFormsTable.id, id)),
    );
    if (!form) { res.status(404).json({ error: "Form not found" }); return; }
    // Vary on Host so the 60s edge cache doesn't serve tenantA's form
    // payload to a request that arrived on tenantB's hostname.
    res.set("Vary", "Host, X-Forwarded-Host, X-Original-Host");
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json(form);
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
    "chiliPiperConfig",
  ];
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (key in req.body) updates[key] = (req.body as Record<string, unknown>)[key];
  }

  const [form] = await db
    .update(lpFormsTable)
    .set(updates)
    .where(and(eq(lpFormsTable.tenantId, tenantId), eq(lpFormsTable.id, id)))
    .returning();
  if (!form) { res.status(404).json({ error: "Form not found" }); return; }
  res.json(form);
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
