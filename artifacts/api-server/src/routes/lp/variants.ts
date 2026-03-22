import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpVariantsTable } from "@workspace/db";
import {
  CreateVariantParams,
  CreateVariantBody,
  UpdateVariantParams,
  UpdateVariantBody,
  DeleteVariantParams,
  ListVariantsParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/lp/tests/:testId/variants", async (req, res): Promise<void> => {
  const params = ListVariantsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const variants = await db
    .select()
    .from(lpVariantsTable)
    .where(eq(lpVariantsTable.testId, params.data.testId))
    .orderBy(lpVariantsTable.createdAt);
  res.json(variants);
});

router.post("/lp/tests/:testId/variants", async (req, res): Promise<void> => {
  const params = CreateVariantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateVariantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Use raw req.body.config to preserve extended JSONB fields the Zod schema would strip
  const [variant] = await db.insert(lpVariantsTable).values({
    testId: params.data.testId,
    name: parsed.data.name,
    isControl: parsed.data.isControl ?? false,
    trafficWeight: parsed.data.trafficWeight,
    config: req.body.config ?? parsed.data.config,
  }).returning();
  res.status(201).json(variant);
});

router.put("/lp/tests/:testId/variants/:variantId", async (req, res): Promise<void> => {
  const params = UpdateVariantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // Validate top-level fields only; skip strict config validation since the
  // JSONB config field may contain extended fields (pageId, trustBar, benefits, etc.)
  // that the generated Zod schema would strip or reject.
  const parsed = UpdateVariantBody.omit({ config: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.trafficWeight !== undefined) updateData.trafficWeight = parsed.data.trafficWeight;
  if (req.body.isControl !== undefined) updateData.isControl = req.body.isControl;
  // Use raw req.body.config to preserve extended JSONB fields (pageId, templateId, trustBar, benefits, etc.)
  // that Zod strips when validating against the base VariantConfig schema
  if (req.body.config !== undefined) updateData.config = req.body.config;

  const [variant] = await db
    .update(lpVariantsTable)
    .set(updateData)
    .where(and(
      eq(lpVariantsTable.id, params.data.variantId),
      eq(lpVariantsTable.testId, params.data.testId),
    ))
    .returning();
  if (!variant) {
    res.status(404).json({ error: "Variant not found" });
    return;
  }
  res.json(variant);
});

router.delete("/lp/tests/:testId/variants/:variantId", async (req, res): Promise<void> => {
  const params = DeleteVariantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [variant] = await db
    .delete(lpVariantsTable)
    .where(and(
      eq(lpVariantsTable.id, params.data.variantId),
      eq(lpVariantsTable.testId, params.data.testId),
    ))
    .returning();
  if (!variant) {
    res.status(404).json({ error: "Variant not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
