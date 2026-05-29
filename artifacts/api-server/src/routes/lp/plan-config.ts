import { Router } from "express";
import { PLANS } from "@workspace/plan-config";
import { getPlanConfig } from "../../lib/planConfig";

const router = Router();

/**
 * GET /lp/plan-config — public, unauthenticated.
 *
 * Returns the live (SuperAdmin-editable, DB-backed, cached) plan/pricing
 * config so the SaaS app's BillingPage / UpgradePrompt surfaces can show
 * the same names, prices, and caps the backend enforces — without
 * hardcoding them on the client and drifting from server gates.
 *
 * Falls back to canonical defaults whenever the DB is unavailable (handled
 * inside getPlanConfig), so this endpoint never fails just because the
 * config table hiccupped.
 *
 * Listed in LP_PUBLIC (routes/index.ts) so it skips the blanket /lp/* auth.
 */
router.get("/lp/plan-config", async (_req, res): Promise<void> => {
  try {
    const cfg = await getPlanConfig();
    // Stable, low-to-high ordered array — clients render the ladder in order.
    const plans = PLANS.map((p) => cfg[p]).sort((a, b) => a.sortOrder - b.sortOrder);
    res.json({ plans });
  } catch (err) {
    console.error("[lp/plan-config] error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
