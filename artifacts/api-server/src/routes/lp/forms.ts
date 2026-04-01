import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpFormsTable } from "@workspace/db";

const router = Router();

router.get("/lp/forms", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId ?? 1;
  const forms = await db
    .select()
    .from(lpFormsTable)
    .where(eq(lpFormsTable.tenantId, tenantId))
    .orderBy(desc(lpFormsTable.createdAt));
  res.json(forms);
});

router.post("/lp/forms", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId ?? 1;
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
    })
    .returning();
  res.status(201).json(form);
});

router.get("/lp/forms/:id", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId ?? 1;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid form ID" }); return; }
  const [form] = await db.select().from(lpFormsTable).where(
    and(eq(lpFormsTable.tenantId, tenantId), eq(lpFormsTable.id, id))
  );
  if (!form) { res.status(404).json({ error: "Form not found" }); return; }
  res.json(form);
});

router.put("/lp/forms/:id", async (req, res): Promise<void> => {
  const tenantId = req.authUser?.tenantId ?? 1;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid form ID" }); return; }

  const allowed = [
    "name", "description", "steps", "multiStep", "submitButtonText",
    "successMessage", "redirectUrl", "backgroundStyle",
    "emailRecipients", "webhookUrl", "marketoConfig", "salesforceConfig",
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
  const tenantId = req.authUser?.tenantId ?? 1;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid form ID" }); return; }
  await db.delete(lpFormsTable).where(
    and(eq(lpFormsTable.tenantId, tenantId), eq(lpFormsTable.id, id))
  );
  res.json({ success: true });
});

export default router;
