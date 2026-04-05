import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    // Verify database connectivity by executing a simple query
    await db.execute(sql`SELECT 1`);
    const data = HealthCheckResponse.parse({ status: "ok", db: "connected" });
    res.json(data);
  } catch (err) {
    console.error("Health check failed - DB unreachable:", err);
    res.status(503).json({ status: "unhealthy", db: "disconnected" });
  }
});

export default router;
