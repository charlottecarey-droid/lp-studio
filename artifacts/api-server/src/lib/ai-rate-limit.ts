// May 2026 audit follow-up (B-3) — per-tenant rate limiters for the
// AI-generation endpoints. These endpoints are all auth-gated, so this is
// not a DDoS defence — it is a cost-runaway defence. A single authenticated
// tenant scripting any of these can otherwise burn through the OpenAI /
// Anthropic / Replicate budget overnight, which is the beta-launch concern
// the audit flagged.
//
// Two tiers:
//   • aiHeavyLimiter — for full page / multi-block generation. 8 per minute,
//     30 per hour per tenant. Generous enough for power-user iteration,
//     tight enough that a script can't go wild.
//   • aiLightLimiter — for cheaper single-shot calls (ad-copy, SEO meta,
//     content brief, brand-import). 20 per minute, 120 per hour per tenant.
//
// We key on tenant id (with an IP fallback for anonymous edges — none of
// these routes should hit unauth in practice, but the keyGenerator must
// return a non-empty string).

import rateLimit from "express-rate-limit";
import type { Request } from "express";
import type { AuthUser } from "../middleware/requireAuth";

function tenantKey(req: Request): string {
  const auth = req as Request & { authUser?: AuthUser };
  const tid = auth.authUser?.tenantId;
  if (typeof tid === "number" && Number.isFinite(tid)) return `t:${tid}`;
  // Fall back to IP. Express's req.ip honours `trust proxy` which the app
  // already sets — see app.ts:18.
  return `ip:${req.ip ?? "unknown"}`;
}

const COST_RUNAWAY_MSG = {
  error:
    "AI generation rate limit reached for this workspace. Wait a minute and try again, or contact support if you need a higher cap.",
  code: "rate_limited",
};

/** Heavy generation — full page or multi-block compositions. */
export const aiHeavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  keyGenerator: tenantKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: COST_RUNAWAY_MSG,
});

/** Per-hour cap on top of the per-minute one (defence-in-depth). */
export const aiHeavyHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: tenantKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: COST_RUNAWAY_MSG,
});

/** Light generation — single-shot copy/meta/brand-import. */
export const aiLightLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: tenantKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: COST_RUNAWAY_MSG,
});

/** Per-hour cap for light endpoints. */
export const aiLightHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  keyGenerator: tenantKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: COST_RUNAWAY_MSG,
});
