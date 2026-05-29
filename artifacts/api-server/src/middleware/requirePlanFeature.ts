import type { Request, Response, NextFunction } from "express";
import { getTenantPlan, type PlanFeatures } from "../lib/planFeatures";
import { getPlanFeaturesMap } from "../lib/planConfig";

/**
 * Plan-tier feature gate. Returns 402 Payment Required when the active
 * tenant's plan does not include the requested feature.
 *
 * Two intentional exemptions:
 *
 *  1. **No `authUser`** — we let the request through. This is the
 *     pattern that makes the gate safe to mount on the entire
 *     `/api/sales/*` surface even though that surface contains a
 *     handful of public, visitor-facing routes (email link tracking,
 *     unsubscribe, Resend webhook). Those routes are exempted from
 *     `requireAuth` via the LP_PUBLIC list in routes/index.ts, so when
 *     they hit this middleware `req.authUser` is undefined and the
 *     plan check is skipped. Auth-gated /sales routes always have
 *     `req.authUser` populated and ARE checked.
 *
 *  2. **Superadmin** (`app_users.role === "superadmin"`) — Dandy
 *     operators support customers on every tier, including ones whose
 *     plan doesn't include the feature. They bypass the check the same
 *     way they bypass tenant isolation via `X-Tenant-Id` in
 *     `getTenantId`.
 *
 * The 402 response shape is intentionally machine-readable so the
 * client can show an upgrade CTA instead of a generic error toast.
 */
export function requirePlanFeature(feature: keyof PlanFeatures) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.authUser;
    if (!user) return next();
    if (user.appUserRole === "superadmin") return next();
    try {
      const plan = await getTenantPlan(user.tenantId);
      const featuresMap = await getPlanFeaturesMap();
      if (featuresMap[plan][feature]) return next();
      res.status(402).json({
        error: "plan_upgrade_required",
        feature,
        plan,
        message: `Your current plan does not include ${feature}.`,
      });
    } catch (err) {
      console.error("[requirePlanFeature] lookup failed:", err);
      // Fail closed — refusing a paid feature on a DB blip is better
      // than silently letting a starter tenant burn enrichment quota.
      res.status(503).json({ error: "plan_check_unavailable" });
    }
  };
}
