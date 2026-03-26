import { Router } from "express";
import { db } from "@workspace/db";
import { lpTestsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSmartTrafficStats, resetSmartTrafficStats } from "../../lib/smart-traffic";

const router = Router();

// Get smart traffic stats for a test
router.get("/lp/tests/:testId/smart-traffic", async (req, res): Promise<void> => {
  const testId = parseInt(req.params.testId, 10);
  if (isNaN(testId)) {
    res.status(400).json({ error: "Invalid test ID" });
    return;
  }

  const [test] = await db
    .select()
    .from(lpTestsTable)
    .where(eq(lpTestsTable.id, testId));

  if (!test) {
    res.status(404).json({ error: "Test not found" });
    return;
  }

  const stats = await getSmartTrafficStats(testId);
  res.json({
    testId,
    smartTrafficEnabled: test.smartTrafficEnabled,
    smartTrafficMinSamples: test.smartTrafficMinSamples,
    ...stats,
  });
});

// Toggle smart traffic on/off for a test
router.put("/lp/tests/:testId/smart-traffic", async (req, res): Promise<void> => {
  const testId = parseInt(req.params.testId, 10);
  if (isNaN(testId)) {
    res.status(400).json({ error: "Invalid test ID" });
    return;
  }

  const { enabled, minSamples } = req.body as { enabled?: boolean; minSamples?: number };

  const updates: Record<string, unknown> = {};
  if (typeof enabled === "boolean") updates.smartTrafficEnabled = enabled;
  if (typeof minSamples === "number" && minSamples >= 10) updates.smartTrafficMinSamples = minSamples;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [updated] = await db
    .update(lpTestsTable)
    .set(updates)
    .where(eq(lpTestsTable.id, testId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Test not found" });
    return;
  }

  res.json({
    testId: updated.id,
    smartTrafficEnabled: updated.smartTrafficEnabled,
    smartTrafficMinSamples: updated.smartTrafficMinSamples,
  });
});

// Reset smart traffic stats for a test
router.post("/lp/tests/:testId/smart-traffic/reset", async (req, res): Promise<void> => {
  const testId = parseInt(req.params.testId, 10);
  if (isNaN(testId)) {
    res.status(400).json({ error: "Invalid test ID" });
    return;
  }

  await resetSmartTrafficStats(testId);
  res.json({ success: true, message: "Smart traffic stats reset" });
});

export default router;
