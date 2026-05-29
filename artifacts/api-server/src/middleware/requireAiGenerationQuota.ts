import type { Request, Response, NextFunction } from "express";
import { getTenantPlan } from "../lib/planFeatures";
import { getPlanConfig } from "../lib/planConfig";
import { capUpgradeBody } from "../lib/planGate";
import { countTenantAiGenerationsThisMonth } from "../lib/aiUsage";

/**
 * Monthly AI-generation quota gate (`aiGenerationsPerMonth`).
 *
 * Counts rows in `ai_generation_log` for the active tenant in the current
 * calendar month and denies with the shared structured-402 contract once the
 * tenant has reached the cap. The log table is written one-row-per call to
 * `/lp/generate-page`, so this meters full-page AI generations (the expensive,
 * cappable unit). Lighter AI helpers (copy / image / SEO) are intentionally
 * not metered — capping micro-edits at the free tier's allowance would make
 * the builder unusable. They can be folded in later by logging their calls.
 *
 * Exemptions mirror `requirePlanFeature`:
 *   - no `authUser` → next() (defensive; AI routes are auth-gated upstream),
 *   - superadmin → next() (operators support every tier),
 *   - unlimited cap (null) → next().
 *
 * Fails closed (503) on a DB error — refusing a generation on a blip beats
 * letting a free tenant burn unmetered AI spend.
 */
export function requireAiGenerationQuota() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.authUser;
    if (!user) return next();
    if (user.appUserRole === "superadmin") return next();
    try {
      const plan = await getTenantPlan(user.tenantId);
      const config = await getPlanConfig();
      const cap = config[plan].features.limits.aiGenerationsPerMonth;
      if (cap === null) return next();
      const current = await countTenantAiGenerationsThisMonth(user.tenantId);
      if (current >= cap) {
        res
          .status(402)
          .json(capUpgradeBody("aiGenerationsPerMonth", current, cap, plan, config));
        return;
      }
      return next();
    } catch (err) {
      console.error("[requireAiGenerationQuota] check failed:", err);
      res.status(503).json({ error: "plan_check_unavailable" });
    }
  };
}
