// Task #234 — Generic, anywhere-in-the-app AI image generation.
//
// Provides POST /lp/image/generate, the endpoint that backs the "Generate"
// and "Tweak" buttons surfaced on every shared <ImagePicker> when a tenant
// has the superadmin-only `aiImageGenOutsideBuilderEnabled` flag flipped on.
//
// The custom-block builder still uses its own per-field
// /lp/custom-blocks/generate-image route — that one is gated by the
// pre-existing `aiImageGenEnabled` flag and tied to a block schema. This
// route is intentionally schema-less: it accepts a free-form brief plus
// optional brand hints / size override, generates one image, and stores
// it in the calling tenant's media library so the editor can re-pick it
// later without spending another image-API credit.
//
// Reuses `generateAndStoreImage` and `loadBrandHints` from
// custom-blocks-generate.ts to keep the on-brand prompt assembly and tenant
// media-library bookkeeping identical to the in-builder flow.

import { Router } from "express";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { getAiImageGenOutsideBuilderEnabled } from "../../lib/tenantSettings";
import { getTenantPlanFeatures } from "../../lib/planFeatures";
import { generateAndStoreImage, loadBrandHints } from "./custom-blocks-generate";

const router = Router();

type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
const ALLOWED_RATIOS: ReadonlySet<AspectRatio> = new Set(["1:1", "16:9", "9:16", "4:3", "3:4"]);

// Map task-spec `size` strings (the public contract) to internal aspect
// ratios. Accepts both bare aspect-ratio strings ("16:9") and explicit
// orientation words so future callers have a friendlier vocabulary.
function normalizeSize(size: unknown): AspectRatio {
  if (typeof size !== "string") return "16:9";
  const s = size.trim().toLowerCase();
  if (ALLOWED_RATIOS.has(s as AspectRatio)) return s as AspectRatio;
  if (s === "square") return "1:1";
  if (s === "landscape" || s === "wide") return "16:9";
  if (s === "portrait" || s === "tall") return "9:16";
  return "16:9";
}

router.post("/lp/image/generate", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return; // getTenantId already wrote a 4xx response

  // Task #407 — plan-tier gate (must come BEFORE the per-tenant toggle
  // check). AI image generation is an Enterprise-only feature in the
  // canonical PLAN_FEATURES matrix. A starter / growth tenant cannot
  // enable it at all, so we 402 with the standard plan_upgrade_required
  // payload so the global upgrade-prompt UX kicks in.
  const { plan, features } = await getTenantPlanFeatures(tenantId);
  if (!features.aiImageGen) {
    res.status(402).json({
      error: "plan_upgrade_required",
      feature: "aiImageGen",
      plan,
      message: "AI image generation is an Enterprise feature. Upgrade your plan to enable it.",
    });
    return;
  }

  // Per-tenant operator toggle (task #234). Available on Enterprise but
  // OFF by default — a Dandy operator must flip the superadmin-only flag
  // before any tenant gets the buttons. Stays as 403 (permission gate,
  // not a billing gate); the frontend ImagePicker hides controls in
  // lockstep, so this only fires on a direct API call.
  const enabled = await getAiImageGenOutsideBuilderEnabled(tenantId);
  if (!enabled) {
    res.status(403).json({ error: "AI image generation is not enabled for this workspace" });
    return;
  }

  const body = (req.body ?? {}) as {
    brief?: unknown;
    altHint?: unknown;
    size?: unknown;
    brand?: unknown;
    useBrand?: unknown;
  };

  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  if (!brief) {
    res.status(400).json({ error: "brief is required" });
    return;
  }
  if (brief.length > 1000) {
    res.status(400).json({ error: "brief must be 1000 characters or fewer" });
    return;
  }

  const altHint = typeof body.altHint === "string" ? body.altHint.trim().slice(0, 200) : "";
  const aspectRatio = normalizeSize(body.size);

  // Brand resolution:
  //   - If caller passed an explicit `brand` object, use those hints
  //     verbatim (handy for "use this product line's palette" scenarios).
  //   - Otherwise default to the tenant's saved brand hints unless the
  //     caller opted out with `useBrand: false` (more generic stock-style
  //     output).
  let brand: Awaited<ReturnType<typeof loadBrandHints>> = null;
  if (body.brand && typeof body.brand === "object") {
    const b = body.brand as Record<string, unknown>;
    brand = {
      primaryColor: typeof b.primaryColor === "string" ? b.primaryColor : undefined,
      accentColor: typeof b.accentColor === "string" ? b.accentColor : undefined,
      textColor: typeof b.textColor === "string" ? b.textColor : undefined,
      backgroundColor: typeof b.backgroundColor === "string" ? b.backgroundColor : undefined,
      headingFont: typeof b.headingFont === "string" ? b.headingFont : undefined,
      bodyFont: typeof b.bodyFont === "string" ? b.bodyFont : undefined,
    };
  } else if (body.useBrand !== false) {
    brand = await loadBrandHints(tenantId);
  }

  const result = await generateAndStoreImage(
    {
      // Synthetic field id / label so the prompt builder & media-library
      // bookkeeping (title, tags) get sensible values without leaking the
      // builder-specific "block name" abstraction into a generic endpoint.
      fieldId: "image",
      fieldLabel: altHint || "Image",
      blockName: "Generated image",
      blockDescription: brief,
      brand,
      instruction: brief,
    },
    aspectRatio,
    tenantId,
  );

  if (!result) {
    res.status(502).json({ error: "Image generation failed" });
    return;
  }

  // Task #234 — return both the served URL and the new media-library row id
  // so the frontend can show "View in library" / select-by-id flows without
  // a second round-trip.
  res.json({ url: result.url, mediaId: result.mediaId });
});

export default router;
