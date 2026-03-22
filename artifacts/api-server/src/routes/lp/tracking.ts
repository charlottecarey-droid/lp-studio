import { Router } from "express";
import { db } from "@workspace/db";
import { lpEventsTable, lpSessionsTable, lpVariantsTable, lpTestsTable } from "@workspace/db";
import { TrackEventBody, GetPageConfigParams, GetPageConfigQueryParams } from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";

const router = Router();

router.post("/lp/track", async (req, res): Promise<void> => {
  const parsed = TrackEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [event] = await db.insert(lpEventsTable).values({
    sessionId: parsed.data.sessionId,
    testId: parsed.data.testId,
    variantId: parsed.data.variantId,
    eventType: parsed.data.eventType,
    conversionType: parsed.data.conversionType ?? null,
  }).returning();
  res.json({ success: true, eventId: event.id });
});

router.get("/lp/page/:slug", async (req, res): Promise<void> => {
  const params = GetPageConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const queryParsed = GetPageConfigQueryParams.safeParse(req.query);
  const sessionId = queryParsed.success && queryParsed.data.sessionId
    ? queryParsed.data.sessionId
    : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Preview mode: bypass session assignment, no tracking
  const previewVariantId = req.query.previewVariantId
    ? parseInt(req.query.previewVariantId as string, 10)
    : undefined;

  const [test] = await db
    .select()
    .from(lpTestsTable)
    .where(eq(lpTestsTable.slug, params.data.slug));

  if (!test) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  const variants = await db
    .select()
    .from(lpVariantsTable)
    .where(eq(lpVariantsTable.testId, test.id));

  if (variants.length === 0) {
    res.status(404).json({ error: "No variants configured" });
    return;
  }

  // Preview mode: return the requested variant without session assignment
  if (previewVariantId) {
    const previewVariant = variants.find(v => v.id === previewVariantId);
    if (previewVariant) {
      res.json({
        testId: test.id,
        slug: test.slug,
        testName: test.name,
        sessionId: `preview-${previewVariantId}`,
        assignedVariant: previewVariant,
        status: test.status,
        isPreview: true,
      });
      return;
    }
  }

  // Check if this session already has a variant assignment
  const [existingSession] = await db
    .select()
    .from(lpSessionsTable)
    .where(and(
      eq(lpSessionsTable.sessionId, sessionId),
      eq(lpSessionsTable.testId, test.id),
    ));

  let assignedVariant;

  if (existingSession) {
    assignedVariant = variants.find(v => v.id === existingSession.variantId);
  }

  if (!assignedVariant) {
    // Weighted random assignment based on trafficWeight
    const totalWeight = variants.reduce((sum, v) => sum + v.trafficWeight, 0);
    let rand = Math.random() * totalWeight;
    for (const variant of variants) {
      rand -= variant.trafficWeight;
      if (rand <= 0) {
        assignedVariant = variant;
        break;
      }
    }
    // Fallback to first variant
    if (!assignedVariant) assignedVariant = variants[0];

    // Store session assignment
    await db.insert(lpSessionsTable).values({
      sessionId,
      testId: test.id,
      variantId: assignedVariant.id,
    }).onConflictDoNothing();
  }

  res.json({
    testId: test.id,
    slug: test.slug,
    testName: test.name,
    sessionId,
    assignedVariant,
    status: test.status,
  });
});

export default router;
