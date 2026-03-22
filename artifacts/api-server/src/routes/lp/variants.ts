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
  const [variant] = await db.insert(lpVariantsTable).values({
    testId: params.data.testId,
    name: parsed.data.name,
    isControl: parsed.data.isControl ?? false,
    trafficWeight: parsed.data.trafficWeight,
    config: parsed.data.config,
  }).returning();
  res.status(201).json(variant);
});

router.put("/lp/tests/:testId/variants/:variantId", async (req, res): Promise<void> => {
  const params = UpdateVariantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateVariantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.trafficWeight !== undefined) updateData.trafficWeight = parsed.data.trafficWeight;
  if (parsed.data.config !== undefined) updateData.config = parsed.data.config;

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
