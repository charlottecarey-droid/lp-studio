// Generator presets — endpoints (June 2026).
//
// Three audiences:
//
//  GENERATOR READ (tenant-auth — goes through the blanket /lp/* requireAuth
//  guard; NOT in LP_PUBLIC because it needs tenant context):
//   - GET /lp/generator-presets?surface=marketing|sales
//       → the EFFECTIVE, ENABLED, ordered presets for the caller's tenant
//         (global defaults ∪ tenant overrides ∪ tenant-specific presets). This
//         is what the marketing + sales generators call. Fail-open: on any
//         error it returns an empty list so the generators fall back to their
//         safe built-in state.
//
//  TENANT OVERRIDE MANAGEMENT (tenant-auth + "settings" permission, mirroring
//  /lp/templates/manage):
//   - GET    /lp/generator-presets/manage?surface=… → effective list INCLUDING
//            disabled rows + each row's override/global provenance, for the
//            tenant settings UI.
//   - PUT    /lp/generator-presets/overrides/:globalPresetId → upsert a tenant
//            override of a GLOBAL preset (enable/disable, reorder, re-skin,
//            re-tie). NULL fields inherit the global value.
//   - DELETE /lp/generator-presets/overrides/:globalPresetId → clear an override
//            (revert to the global default).
//   - POST   /lp/generator-presets/tenant → add a TENANT-SPECIFIC preset.
//   - PUT    /lp/generator-presets/tenant/:id → edit a tenant-specific preset.
//   - DELETE /lp/generator-presets/tenant/:id → delete a tenant-specific preset.
//
//  SUPERADMIN GLOBAL MANAGEMENT (requireSuperadmin, mirroring blog.ts):
//   - GET    /admin/generator-presets         → ALL global presets (both surfaces).
//   - POST   /admin/generator-presets         → create a global preset.
//   - PUT    /admin/generator-presets/:id      → update a global preset.
//   - DELETE /admin/generator-presets/:id      → delete a global preset.
//   - POST   /admin/generator-presets/reorder  → bulk reorder global presets.
//
// All template ties reuse the existing eligibility/intent system: a tie is a
// slug/intent string carried on the preset; selectEligibleTemplate downstream
// decides whether it actually surfaces.

import { Router } from "express";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import {
  db,
  generatorPresetsTable,
  generatorPresetOverridesTable,
  lpPagesTable,
  lpBrandSettingsTable,
} from "@workspace/db";
import { getTenantId, requireAuth, requirePermission } from "../../middleware/requireAuth";
import { requireSuperadmin } from "../../middleware/requireSuperadmin";
import {
  mergeEffectivePresets,
  normalizeSurface,
  resolvePresetTemplateTie,
  type PresetRow,
  type PresetOverrideRow,
  type PresetSurface,
} from "../../lib/generatorPresets";
// Template eligibility (June 2026). Data-driven gate REUSED from the sales
// microsite path: templates DECLARE where they may be auto-recommended (segment
// / persona / funnel stage), and the tenant has ONE governance behavior
// (micrositeTemplateAiBehavior; default ai-from-scratch-only) controlling how
// aggressively AI auto-picks vs. defaults to from-scratch. The marketing chip's
// tied template is gated through the SAME engine + setting so the two paths
// never drift (see /sales/microsite/recommend).
import {
  selectEligibleTemplate,
  normalizeTemplateAiBehavior,
  type EligibilityCandidate,
} from "../../lib/ai-prompts/template-eligibility";

const router = Router();

// ── shared helpers ──────────────────────────────────────────────────────────

type Row = typeof generatorPresetsTable.$inferSelect;
type OverrideRow = typeof generatorPresetOverridesTable.$inferSelect;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function nullableStr(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}
function nullableBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function nullableInt(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
}

/** Coerce a request `surface` query/body value to a target generator surface. */
function targetSurface(v: unknown): "marketing" | "sales" {
  return v === "sales" ? "sales" : "marketing";
}

function toPresetRow(r: Row): PresetRow {
  return {
    id: r.id,
    tenantId: r.tenantId ?? null,
    surface: r.surface,
    label: r.label,
    description: r.description ?? null,
    icon: r.icon ?? null,
    promptSkeleton: r.promptSkeleton ?? null,
    objective: r.objective ?? null,
    tiedTemplateSlug: r.tiedTemplateSlug ?? null,
    tiedTemplateIntent: r.tiedTemplateIntent ?? null,
    enabled: r.enabled,
    sortOrder: r.sortOrder,
  };
}

function toOverrideRow(o: OverrideRow): PresetOverrideRow {
  return {
    globalPresetId: o.globalPresetId,
    enabled: o.enabled ?? null,
    sortOrder: o.sortOrder ?? null,
    label: o.label ?? null,
    description: o.description ?? null,
    icon: o.icon ?? null,
    promptSkeleton: o.promptSkeleton ?? null,
    objective: o.objective ?? null,
    tiedTemplateSlug: o.tiedTemplateSlug ?? null,
    tiedTemplateIntent: o.tiedTemplateIntent ?? null,
  };
}

/** Load global presets, tenant-own presets, and the tenant's overrides. */
async function loadForTenant(tenantId: number): Promise<{
  globals: PresetRow[];
  tenantOwn: PresetRow[];
  overrides: PresetOverrideRow[];
}> {
  const [globalRows, tenantRows, overrideRows] = await Promise.all([
    db.select().from(generatorPresetsTable).where(isNull(generatorPresetsTable.tenantId)),
    db.select().from(generatorPresetsTable).where(eq(generatorPresetsTable.tenantId, tenantId)),
    db
      .select()
      .from(generatorPresetOverridesTable)
      .where(eq(generatorPresetOverridesTable.tenantId, tenantId)),
  ]);
  return {
    globals: globalRows.map(toPresetRow),
    tenantOwn: tenantRows.map(toPresetRow),
    overrides: overrideRows.map(toOverrideRow),
  };
}

// ── GENERATOR READ ────────────────────────────────────────────────────────

// GET /lp/generator-presets?surface=marketing|sales → effective ENABLED list.
router.get("/lp/generator-presets", async (req, res): Promise<void> => {
  const surface = targetSurface(req.query.surface);
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return; // getTenantId already 403'd
    const { globals, tenantOwn, overrides } = await loadForTenant(tenantId);
    const presets = mergeEffectivePresets({
      globals,
      tenantOwn,
      overrides,
      surface,
      onlyEnabled: true,
    });
    res.json({ surface, presets });
  } catch (err) {
    // FAIL-OPEN: never break the generator. Return an empty list; the
    // marketing generator then renders nothing and the sales generator falls
    // back to its built-in objective cards.
    console.error("GET /lp/generator-presets error:", String(err));
    res.json({ surface, presets: [] });
  }
});

// ── MARKETING CHIP TEMPLATE-TIE RESOLUTION (June 2026) ──────────────────────
//
// A MARKETING starter chip can carry a TIED template (tiedTemplateSlug). This
// endpoint GATES that tie through the SAME eligibility engine + tenant
// governance setting (micrositeTemplateAiBehavior, default ai-from-scratch-only)
// the sales microsite uses — mirroring POST /sales/microsite/recommend. It
// returns the resolved slug (or null = build from scratch) + a reasoning trail
// the modal surfaces as a short note. The prompt skeleton still prefills
// regardless; this governs only whether the tied template becomes the AI's
// starting point. FAIL-OPEN: on ANY error it returns the tied slug as-is so it
// never blocks generation. Rate-limited + tenant-auth-gated like the other /lp
// generator endpoints.

// Light rate limit (pure + cheap — one small DB read + a deterministic decide).
// Higher ceiling than generation, mirroring /sales/microsite/recommend.
const resolveTemplateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many template-resolution requests. Please wait a moment." },
});

interface ResolveTemplateBody {
  tiedTemplateSlug?: unknown;
  segmentId?: unknown;
}

// POST /lp/generator-presets/resolve-template → gate a marketing chip's tied
// template by eligibility for the page's context.
router.post(
  "/lp/generator-presets/resolve-template",
  requireAuth,
  resolveTemplateLimiter,
  async (req, res): Promise<void> => {
    const b = (req.body ?? {}) as ResolveTemplateBody;
    const tiedTemplateSlug = typeof b.tiedTemplateSlug === "string" ? b.tiedTemplateSlug.trim() : "";
    const segmentId = typeof b.segmentId === "string" ? b.segmentId.trim() : "";

    // No tie → nothing to resolve; from-scratch with an empty reasoning trail.
    if (!tiedTemplateSlug) {
      res.json({ recommendedTemplateSlug: null, fromScratch: true, reasoning: [] });
      return;
    }

    const tenantId = getTenantId(req, res);
    if (tenantId === null) return; // getTenantId already 403'd

    try {
      // 1) Tenant governance behavior — REUSED micrositeTemplateAiBehavior from
      //    brand_settings.config (additive JSONB key; no migration). Default to
      //    the owner's safe value (ai-from-scratch-only).
      let aiBehavior = normalizeTemplateAiBehavior(undefined);
      // 2) The preset carrying this tie (so we can read its objective → funnel
      //    stage) + the resolved segment NAME. Load brand config + presets +
      //    candidate templates in parallel.
      const [bsRows, candidateRows, presetTieRows] = await Promise.all([
        db
          .select({ config: lpBrandSettingsTable.config })
          .from(lpBrandSettingsTable)
          .where(eq(lpBrandSettingsTable.tenantId, tenantId))
          .limit(1),
        // Candidate pool: every global/tenant template VISIBLE to this tenant
        // that declares an eligibility constraint (or a primary funnel stage),
        // which always includes the tied slug's own row when it exists.
        db
          .select({
            slug: lpPagesTable.slug,
            label: lpPagesTable.templateLabel,
            eligibleSegments: lpPagesTable.eligibleSegments,
            eligiblePersonas: lpPagesTable.eligiblePersonas,
            eligibleFunnelStages: lpPagesTable.eligibleFunnelStages,
            funnelStage: lpPagesTable.funnelStage,
          })
          .from(lpPagesTable)
          .where(
            and(
              eq(lpPagesTable.isTemplate, true),
              or(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.isGlobal, true)),
            ),
          ),
        // The marketing preset(s) tying THIS slug — global ∪ tenant — so we can
        // pick up an objective the chip carries as its funnel-stage hint.
        db
          .select({
            objective: generatorPresetsTable.objective,
            tenantId: generatorPresetsTable.tenantId,
          })
          .from(generatorPresetsTable)
          .where(
            and(
              eq(generatorPresetsTable.tiedTemplateSlug, tiedTemplateSlug),
              or(
                isNull(generatorPresetsTable.tenantId),
                eq(generatorPresetsTable.tenantId, tenantId),
              ),
            ),
          ),
      ]);

      const cfg = (bsRows[0]?.config ?? {}) as Record<string, unknown>;
      aiBehavior = normalizeTemplateAiBehavior(cfg.micrositeTemplateAiBehavior);

      // Resolve the segment NAME from its id via the brand config's segments
      // array (the eligibility engine matches on name/id). Persona is omitted —
      // marketing landing pages typically have no persona axis.
      let segmentName: string | null = null;
      if (segmentId) {
        const segments = Array.isArray((cfg as { segments?: unknown }).segments)
          ? ((cfg as { segments?: Array<{ id?: unknown; name?: unknown }> }).segments ?? [])
          : [];
        const match = segments.find((s) => typeof s?.id === "string" && s.id === segmentId);
        segmentName =
          (match && typeof match.name === "string" && match.name) ||
          // Fall back to the id itself so a template declaring eligibility by id
          // can still match when the segment has no resolvable name.
          segmentId;
      }

      // Funnel stage: the chip's preset objective when present, else null
      // (unconstrained). Prefer a tenant-specific preset's objective over a
      // global one (tenant overrides win), mirroring the effective-merge.
      const tenantTie = presetTieRows.find((p) => p.tenantId === tenantId);
      const globalTie = presetTieRows.find((p) => p.tenantId === null);
      const objective =
        (tenantTie?.objective ?? globalTie?.objective ?? "").trim() || null;

      const asStrArr = (v: unknown): string[] | null =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
      const candidates: EligibilityCandidate[] = candidateRows.map((r) => ({
        slug: r.slug,
        label: r.label ?? undefined,
        eligibleSegments: asStrArr(r.eligibleSegments),
        eligiblePersonas: asStrArr(r.eligiblePersonas),
        eligibleFunnelStages: asStrArr(r.eligibleFunnelStages),
        funnelStage: r.funnelStage ?? null,
      }));
      // Guarantee the tied slug is in the candidate pool even if it isn't itself
      // flagged isTemplate (so a wildcard tie is still considered eligible).
      if (!candidates.some((c) => c.slug === tiedTemplateSlug)) {
        candidates.push({ slug: tiedTemplateSlug });
      }

      const result = resolvePresetTemplateTie({
        tiedTemplateSlug,
        context: { segment: segmentName, funnelStage: objective },
        candidates,
        aiBehavior,
      });

      res.json(result);
    } catch (err) {
      // FAIL-OPEN: never block generation. Return the tied slug as-is so the
      // modal applies it exactly as it did before this gate existed.
      console.error("POST /lp/generator-presets/resolve-template error:", String(err));
      res.json({
        recommendedTemplateSlug: tiedTemplateSlug,
        fromScratch: false,
        reasoning: [],
      });
    }
  },
);

// ── TENANT OVERRIDE MANAGEMENT (settings permission) ────────────────────────

// GET /lp/generator-presets/manage?surface=… → effective list incl. disabled.
router.get(
  "/lp/generator-presets/manage",
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    const surface = targetSurface(req.query.surface);
    try {
      const tenantId = getTenantId(req, res);
      if (tenantId === null) return;
      const { globals, tenantOwn, overrides } = await loadForTenant(tenantId);
      const presets = mergeEffectivePresets({
        globals,
        tenantOwn,
        overrides,
        surface,
        onlyEnabled: false,
      });
      res.json({ surface, presets });
    } catch (err) {
      console.error("GET /lp/generator-presets/manage error:", String(err));
      res.status(500).json({ error: "Failed to load presets" });
    }
  },
);

interface OverrideBody {
  enabled?: unknown;
  sortOrder?: unknown;
  label?: unknown;
  description?: unknown;
  icon?: unknown;
  promptSkeleton?: unknown;
  objective?: unknown;
  tiedTemplateSlug?: unknown;
  tiedTemplateIntent?: unknown;
}

// PUT /lp/generator-presets/overrides/:globalPresetId → upsert a tenant override.
router.put(
  "/lp/generator-presets/overrides/:globalPresetId",
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    try {
      const tenantId = getTenantId(req, res);
      if (tenantId === null) return;
      const globalPresetId = parseInt(String(req.params.globalPresetId), 10);
      if (Number.isNaN(globalPresetId)) {
        res.status(400).json({ error: "Invalid preset id" });
        return;
      }
      // The target must be an existing GLOBAL preset.
      const [g] = await db
        .select({ id: generatorPresetsTable.id, tenantId: generatorPresetsTable.tenantId })
        .from(generatorPresetsTable)
        .where(eq(generatorPresetsTable.id, globalPresetId));
      if (!g || g.tenantId !== null) {
        res.status(404).json({ error: "Global preset not found" });
        return;
      }
      const b = (req.body ?? {}) as OverrideBody;
      const values = {
        tenantId,
        globalPresetId,
        enabled: nullableBool(b.enabled),
        sortOrder: nullableInt(b.sortOrder),
        label: nullableStr(b.label),
        description: nullableStr(b.description),
        icon: nullableStr(b.icon),
        promptSkeleton: nullableStr(b.promptSkeleton),
        objective: nullableStr(b.objective),
        tiedTemplateSlug: nullableStr(b.tiedTemplateSlug),
        tiedTemplateIntent: nullableStr(b.tiedTemplateIntent),
        updatedAt: new Date(),
      };
      await db
        .insert(generatorPresetOverridesTable)
        .values(values)
        .onConflictDoUpdate({
          target: [
            generatorPresetOverridesTable.tenantId,
            generatorPresetOverridesTable.globalPresetId,
          ],
          set: {
            enabled: values.enabled,
            sortOrder: values.sortOrder,
            label: values.label,
            description: values.description,
            icon: values.icon,
            promptSkeleton: values.promptSkeleton,
            objective: values.objective,
            tiedTemplateSlug: values.tiedTemplateSlug,
            tiedTemplateIntent: values.tiedTemplateIntent,
            updatedAt: values.updatedAt,
          },
        });
      res.json({ ok: true });
    } catch (err) {
      console.error("PUT /lp/generator-presets/overrides/:id error:", String(err));
      res.status(500).json({ error: "Failed to save override" });
    }
  },
);

// DELETE /lp/generator-presets/overrides/:globalPresetId → revert to default.
router.delete(
  "/lp/generator-presets/overrides/:globalPresetId",
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    try {
      const tenantId = getTenantId(req, res);
      if (tenantId === null) return;
      const globalPresetId = parseInt(String(req.params.globalPresetId), 10);
      if (Number.isNaN(globalPresetId)) {
        res.status(400).json({ error: "Invalid preset id" });
        return;
      }
      await db
        .delete(generatorPresetOverridesTable)
        .where(
          and(
            eq(generatorPresetOverridesTable.tenantId, tenantId),
            eq(generatorPresetOverridesTable.globalPresetId, globalPresetId),
          ),
        );
      res.json({ ok: true });
    } catch (err) {
      console.error("DELETE /lp/generator-presets/overrides/:id error:", String(err));
      res.status(500).json({ error: "Failed to clear override" });
    }
  },
);

interface PresetBody extends OverrideBody {
  surface?: unknown;
}

/** Build INSERT/UPDATE values for a preset row from a request body. For tenant
 *  presets we default enabled=true and sortOrder=0 when unset. */
function presetValuesFromBody(b: PresetBody): {
  surface: PresetSurface;
  label: string;
  description: string | null;
  icon: string | null;
  promptSkeleton: string | null;
  objective: string | null;
  tiedTemplateSlug: string | null;
  tiedTemplateIntent: string | null;
  enabled: boolean;
  sortOrder: number;
} {
  return {
    surface: normalizeSurface(b.surface),
    label: str(b.label).trim(),
    description: nullableStr(b.description),
    icon: nullableStr(b.icon),
    promptSkeleton: nullableStr(b.promptSkeleton),
    objective: nullableStr(b.objective),
    tiedTemplateSlug: nullableStr(b.tiedTemplateSlug),
    tiedTemplateIntent: nullableStr(b.tiedTemplateIntent),
    enabled: typeof b.enabled === "boolean" ? b.enabled : true,
    sortOrder: nullableInt(b.sortOrder) ?? 0,
  };
}

// POST /lp/generator-presets/tenant → add a tenant-specific preset.
router.post(
  "/lp/generator-presets/tenant",
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    try {
      const tenantId = getTenantId(req, res);
      if (tenantId === null) return;
      const vals = presetValuesFromBody((req.body ?? {}) as PresetBody);
      if (!vals.label) {
        res.status(400).json({ error: "label is required" });
        return;
      }
      const [row] = await db
        .insert(generatorPresetsTable)
        .values({ ...vals, tenantId })
        .returning();
      res.status(201).json({ preset: row });
    } catch (err) {
      console.error("POST /lp/generator-presets/tenant error:", String(err));
      res.status(500).json({ error: "Failed to create preset" });
    }
  },
);

// PUT /lp/generator-presets/tenant/:id → edit a tenant-specific preset.
router.put(
  "/lp/generator-presets/tenant/:id",
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    try {
      const tenantId = getTenantId(req, res);
      if (tenantId === null) return;
      const id = parseInt(String(req.params.id), 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: "Invalid preset id" });
        return;
      }
      const [existing] = await db
        .select({ id: generatorPresetsTable.id, tenantId: generatorPresetsTable.tenantId })
        .from(generatorPresetsTable)
        .where(eq(generatorPresetsTable.id, id));
      if (!existing || existing.tenantId !== tenantId) {
        res.status(404).json({ error: "Preset not found" });
        return;
      }
      const vals = presetValuesFromBody((req.body ?? {}) as PresetBody);
      if (!vals.label) {
        res.status(400).json({ error: "label is required" });
        return;
      }
      const [row] = await db
        .update(generatorPresetsTable)
        .set({ ...vals, updatedAt: new Date() })
        .where(eq(generatorPresetsTable.id, id))
        .returning();
      res.json({ preset: row });
    } catch (err) {
      console.error("PUT /lp/generator-presets/tenant/:id error:", String(err));
      res.status(500).json({ error: "Failed to update preset" });
    }
  },
);

// DELETE /lp/generator-presets/tenant/:id → delete a tenant-specific preset.
router.delete(
  "/lp/generator-presets/tenant/:id",
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    try {
      const tenantId = getTenantId(req, res);
      if (tenantId === null) return;
      const id = parseInt(String(req.params.id), 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: "Invalid preset id" });
        return;
      }
      const deleted = await db
        .delete(generatorPresetsTable)
        .where(
          and(
            eq(generatorPresetsTable.id, id),
            eq(generatorPresetsTable.tenantId, tenantId),
          ),
        )
        .returning({ id: generatorPresetsTable.id });
      if (deleted.length === 0) {
        res.status(404).json({ error: "Preset not found" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("DELETE /lp/generator-presets/tenant/:id error:", String(err));
      res.status(500).json({ error: "Failed to delete preset" });
    }
  },
);

// ── SUPERADMIN GLOBAL MANAGEMENT ────────────────────────────────────────────

// GET /admin/generator-presets → ALL global presets (both surfaces).
router.get("/admin/generator-presets", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(generatorPresetsTable)
      .where(isNull(generatorPresetsTable.tenantId))
      .orderBy(asc(generatorPresetsTable.surface), asc(generatorPresetsTable.sortOrder), asc(generatorPresetsTable.id));
    res.json({ presets: rows });
  } catch (err) {
    console.error("GET /admin/generator-presets error:", String(err));
    res.status(500).json({ error: "Failed to load presets" });
  }
});

// POST /admin/generator-presets → create a global preset.
router.post("/admin/generator-presets", requireSuperadmin, async (req, res): Promise<void> => {
  try {
    const vals = presetValuesFromBody((req.body ?? {}) as PresetBody);
    if (!vals.label) {
      res.status(400).json({ error: "label is required" });
      return;
    }
    const [row] = await db
      .insert(generatorPresetsTable)
      .values({ ...vals, tenantId: null })
      .returning();
    res.status(201).json({ preset: row });
  } catch (err) {
    console.error("POST /admin/generator-presets error:", String(err));
    res.status(500).json({ error: "Failed to create preset" });
  }
});

// PUT /admin/generator-presets/:id → update a global preset.
router.put("/admin/generator-presets/:id", requireSuperadmin, async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid preset id" });
      return;
    }
    const [existing] = await db
      .select({ id: generatorPresetsTable.id, tenantId: generatorPresetsTable.tenantId })
      .from(generatorPresetsTable)
      .where(eq(generatorPresetsTable.id, id));
    if (!existing || existing.tenantId !== null) {
      res.status(404).json({ error: "Global preset not found" });
      return;
    }
    const vals = presetValuesFromBody((req.body ?? {}) as PresetBody);
    if (!vals.label) {
      res.status(400).json({ error: "label is required" });
      return;
    }
    const [row] = await db
      .update(generatorPresetsTable)
      .set({ ...vals, updatedAt: new Date() })
      .where(eq(generatorPresetsTable.id, id))
      .returning();
    res.json({ preset: row });
  } catch (err) {
    console.error("PUT /admin/generator-presets/:id error:", String(err));
    res.status(500).json({ error: "Failed to update preset" });
  }
});

// DELETE /admin/generator-presets/:id → delete a global preset (its tenant
// overrides cascade via the FK).
router.delete("/admin/generator-presets/:id", requireSuperadmin, async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid preset id" });
      return;
    }
    const deleted = await db
      .delete(generatorPresetsTable)
      .where(and(eq(generatorPresetsTable.id, id), isNull(generatorPresetsTable.tenantId)))
      .returning({ id: generatorPresetsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Global preset not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/generator-presets/:id error:", String(err));
    res.status(500).json({ error: "Failed to delete preset" });
  }
});

// POST /admin/generator-presets/reorder → bulk reorder global presets.
// body { order: number[] } — preset ids in their new display order; sortOrder
// is set to the index*10 so later inserts can slot between.
router.post(
  "/admin/generator-presets/reorder",
  requireSuperadmin,
  async (req, res): Promise<void> => {
    try {
      const order = (req.body ?? {}) as { order?: unknown };
      const ids = Array.isArray(order.order)
        ? order.order.filter((x): x is number => typeof x === "number" && Number.isFinite(x))
        : [];
      if (ids.length === 0) {
        res.status(400).json({ error: "order must be a non-empty number[]" });
        return;
      }
      let i = 0;
      for (const id of ids) {
        await db
          .update(generatorPresetsTable)
          .set({ sortOrder: i * 10, updatedAt: new Date() })
          .where(and(eq(generatorPresetsTable.id, id), isNull(generatorPresetsTable.tenantId)));
        i += 1;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("POST /admin/generator-presets/reorder error:", String(err));
      res.status(500).json({ error: "Failed to reorder presets" });
    }
  },
);

export default router;
