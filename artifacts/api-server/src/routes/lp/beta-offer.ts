/**
 * Public founding-beta status for the marketing site.
 *
 * Reports the SAME cap the signup path enforces (BETA_SCALE_OFFER_CAP) plus
 * the live claimed count, so the number a visitor sees is by construction the
 * number that exists. Displaying a different number than the enforced cap is
 * exactly the failure this design rules out.
 */
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { BETA_OFFER_TIER } from "@workspace/plan-config";
import { betaOfferCap, betaOfferStatus } from "../../lib/betaOffer";

const router = Router();

router.get("/lp/beta-offer", async (_req, res): Promise<void> => {
  try {
    const cap = betaOfferCap(process.env.BETA_SCALE_OFFER_CAP);
    if (cap === 0) {
      // Offer off — cacheable briefly so the marketing page stays cheap.
      res.set("Cache-Control", "public, max-age=300");
      res.json(betaOfferStatus(0, 0));
      return;
    }
    const r = await db.execute(
      sql`SELECT count(*)::int AS claimed FROM tenants WHERE trial_tier = ${BETA_OFFER_TIER}`,
    );
    const claimed = Number((r.rows[0] as { claimed?: number })?.claimed ?? 0);
    // Short cache: "spots remaining" should feel live without hammering the DB.
    res.set("Cache-Control", "public, max-age=60");
    res.json(betaOfferStatus(cap, claimed));
  } catch (err) {
    console.error("GET /lp/beta-offer error:", err);
    res.status(500).json({ error: "Failed to load beta status" });
  }
});

export default router;
