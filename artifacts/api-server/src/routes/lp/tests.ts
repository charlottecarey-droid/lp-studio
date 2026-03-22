import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { lpTestsTable, lpVariantsTable } from "@workspace/db";
import {
  CreateTestBody,
  UpdateTestBody,
  UpdateTestParams,
  DeleteTestParams,
  GetTestParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/lp/tests", async (req, res): Promise<void> => {
  const tests = await db
    .select({
      id: lpTestsTable.id,
      name: lpTestsTable.name,
      slug: lpTestsTable.slug,
      description: lpTestsTable.description,
      status: lpTestsTable.status,
      testType: lpTestsTable.testType,
      createdAt: lpTestsTable.createdAt,
      updatedAt: lpTestsTable.updatedAt,
      variantCount: sql<number>`(select count(*) from lp_variants where test_id = ${lpTestsTable.id})::int`,
    })
    .from(lpTestsTable)
    .orderBy(lpTestsTable.createdAt);
  res.json(tests);
});

router.post("/lp/tests", async (req, res): Promise<void> => {
  const parsed = CreateTestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [test] = await db.insert(lpTestsTable).values({
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description,
    testType: parsed.data.testType ?? "ab",
    status: "draft",
  }).returning();
  res.status(201).json({ ...test, variantCount: 0 });
});

router.get("/lp/tests/:testId", async (req, res): Promise<void> => {
  const params = GetTestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [test] = await db
    .select({
      id: lpTestsTable.id,
      name: lpTestsTable.name,
      slug: lpTestsTable.slug,
      description: lpTestsTable.description,
      status: lpTestsTable.status,
      testType: lpTestsTable.testType,
      createdAt: lpTestsTable.createdAt,
      updatedAt: lpTestsTable.updatedAt,
      variantCount: sql<number>`(select count(*) from lp_variants where test_id = ${lpTestsTable.id})::int`,
    })
    .from(lpTestsTable)
    .where(eq(lpTestsTable.id, params.data.testId));
  if (!test) {
    res.status(404).json({ error: "Test not found" });
    return;
  }
  const variants = await db
    .select()
    .from(lpVariantsTable)
    .where(eq(lpVariantsTable.testId, params.data.testId));
  res.json({ ...test, variants });
});

router.put("/lp/tests/:testId", async (req, res): Promise<void> => {
  const params = UpdateTestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.testType !== undefined) updateData.testType = parsed.data.testType;

  const [test] = await db
    .update(lpTestsTable)
    .set(updateData)
    .where(eq(lpTestsTable.id, params.data.testId))
    .returning();
  if (!test) {
    res.status(404).json({ error: "Test not found" });
    return;
  }
  const variantCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lpVariantsTable)
    .where(eq(lpVariantsTable.testId, params.data.testId));
  res.json({ ...test, variantCount: variantCount[0]?.count ?? 0 });
});

router.delete("/lp/tests/:testId", async (req, res): Promise<void> => {
  const params = DeleteTestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [test] = await db
    .delete(lpTestsTable)
    .where(eq(lpTestsTable.id, params.data.testId))
    .returning();
  if (!test) {
    res.status(404).json({ error: "Test not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
