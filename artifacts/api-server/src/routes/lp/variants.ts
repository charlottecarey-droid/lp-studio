import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpVariantsTable } from "@workspace/db";
import {
  CreateVariantParams,
  UpdateVariantParams,
  DeleteVariantParams,
  ListVariantsParams,
} from "@workspace/api-zod";

const CreateVariantBodyLoose = {
  safeParse(body: unknown): { success: true; data: { name: string; isControl: boolean; trafficWeight: number } } | { success: false; error: { message: string } } {
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return { success: false, error: { message: "body must be an object" } };
    }
    const b = body as Record<string, unknown>;
    if (typeof b.name !== "string" || b.name.trim().length === 0) {
      return { success: false, error: { message: "name is required and must be a non-empty string" } };
    }
    if (typeof b.trafficWeight !== "number" || isNaN(b.trafficWeight) || b.trafficWeight < 0 || b.trafficWeight > 100) {
      return { success: false, error: { message: "trafficWeight must be a number between 0 and 100" } };
    }
    return {
      success: true,
      data: {
        name: b.name.trim(),
        isControl: typeof b.isControl === "boolean" ? b.isControl : false,
        trafficWeight: b.trafficWeight,
      },
    };
  },
};

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
  const parsed = CreateVariantBodyLoose.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const builderPageId =
    typeof req.body.builderPageId === "number" ? req.body.builderPageId : null;
  // Use raw req.body.config to preserve extended JSONB fields (trustBar, benefits,
  // testimonials, templateId, etc.) that the generated Zod schema strips on parse.
  const rawConfig =
    req.body.config !== undefined && typeof req.body.config === "object" && req.body.config !== null
      ? req.body.config
      : (parsed.data.config ?? {});
  const [variant] = await db.insert(lpVariantsTable).values({
    testId: params.data.testId,
    name: parsed.data.name,
    isControl: parsed.data.isControl ?? false,
    trafficWeight: parsed.data.trafficWeight,
    config: rawConfig,
    builderPageId,
  }).returning();
  res.status(201).json(variant);
});

router.put("/lp/tests/:testId/variants/:variantId", async (req, res): Promise<void> => {
  const params = UpdateVariantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = req.body as Record<string, unknown>;

  const updateData: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.length > 0) updateData.name = body.name;
  if (typeof body.trafficWeight === "number") updateData.trafficWeight = body.trafficWeight;
  if (typeof body.isControl === "boolean") updateData.isControl = body.isControl;
  if ("config" in body && body.config !== undefined && typeof body.config === "object" && body.config !== null) {
    updateData.config = body.config;
  }
  if ("builderPageId" in body) {
    updateData.builderPageId =
      body.builderPageId === null ? null :
      typeof body.builderPageId === "number" ? body.builderPageId :
      null;
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

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
