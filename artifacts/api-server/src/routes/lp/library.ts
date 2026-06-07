import { getTenantId } from "../../middleware/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const VALID_TYPES = ["product_showcase", "product_grid", "case_study", "resource", "team_member"] as const;
type LibraryType = typeof VALID_TYPES[number];

function isValidType(t: string): t is LibraryType {
  return (VALID_TYPES as readonly string[]).includes(t);
}

// Task #1206 — reserved tag for team-member headshots. Team photos are uploaded
// through the Content Library and land in the shared media library (`lp_media`),
// the same pool the AI page generator draws hero/feature imagery from. Marking
// them with this tag lets `fetchMediaCatalog` / `sanitizeAIImageUrls` exclude
// them so a person's headshot is never reused as a hero or section image. The
// "Meet the Team" block populates from the saved `team_member` rows (not the AI
// catalog), so excluding the tagged image does NOT break that section.
const RESERVED_TEAM_PHOTO_TAG = "team-photo";

/**
 * Best-effort: merge the reserved `team-photo` tag onto the media-library row
 * matching this tenant + photo URL, mirroring the brand-logo tagging pattern
 * (routes/lp/brand.ts). Tenant-scoped and idempotent (the `?` guard skips rows
 * that already carry the tag) and preserves any existing tags. Does nothing
 * when no media row matches the URL (e.g. an external/CDN headshot URL). Never
 * throws — a tagging hiccup must not fail the library save.
 */
async function tagTeamPhotoMedia(tenantId: number, photoUrl: unknown): Promise<void> {
  if (typeof photoUrl !== "string" || photoUrl.trim() === "") return;
  try {
    await db.execute(
      sql`UPDATE lp_media
             SET tags = COALESCE(tags, '[]'::jsonb) || ${JSON.stringify([RESERVED_TEAM_PHOTO_TAG])}::jsonb
           WHERE tenant_id = ${tenantId}
             AND url = ${photoUrl}
             AND NOT (COALESCE(tags, '[]'::jsonb) ? ${RESERVED_TEAM_PHOTO_TAG})`
    );
  } catch {
    // Best-effort: the headshot still renders in the team block; the only loss
    // is the AI-reuse protection for this one image.
  }
}

/** Pull a team member's headshot URL out of a library item's `content` payload
 *  (the `dso-meet-team` consumer reads `content.photo` — see fetchTeamMembers). */
function teamPhotoUrl(content: unknown): unknown {
  return content && typeof content === "object"
    ? (content as Record<string, unknown>).photo
    : undefined;
}

router.get("/lp/library/:type", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { type } = req.params;
  if (!isValidType(type)) { res.status(400).json({ error: "Invalid type" }); return; }
  try {
    const rows = await db.execute(
      sql`SELECT id, type, name, content, is_default, sort_order, approved_for_ai, created_at, updated_at
          FROM lp_library_items
          WHERE type = ${type} AND tenant_id = ${tenantId}
          ORDER BY sort_order ASC, id ASC`
    );
    res.json(rows.rows);
  } catch {
    res.json([]);
  }
});

router.post("/lp/library/:type", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { type } = req.params;
  if (!isValidType(type)) { res.status(400).json({ error: "Invalid type" }); return; }
  const { name, content, is_default, approved_for_ai } = req.body;
  // Task #253 — `approved_for_ai` defaults to true so existing client code
  // that does not send the flag keeps the same behaviour as before.
  const approved = approved_for_ai === false ? false : true;
  try {
    const result = await db.execute(
      sql`INSERT INTO lp_library_items (tenant_id, type, name, content, is_default, approved_for_ai, sort_order)
          VALUES (${tenantId}, ${type}, ${name ?? ""}, ${JSON.stringify(content)}::jsonb, ${is_default ?? false}, ${approved},
                  COALESCE((SELECT MAX(sort_order) + 1 FROM lp_library_items WHERE type = ${type} AND tenant_id = ${tenantId}), 0))
          RETURNING *`
    );
    // Task #1206 — reserve a newly-saved team member's headshot from AI reuse.
    if (type === "team_member") {
      await tagTeamPhotoMedia(tenantId, teamPhotoUrl(content));
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Task #1139 — persist an explicit tenant-chosen ordering for a library type.
// The client sends the full ordered list of ids; we rewrite sort_order to
// match. The GET above already returns rows `ORDER BY sort_order ASC, id ASC`,
// and AI generation (rankCaseStudies) uses that same baseline as its
// tie-breaker, so this order directly controls which case studies surface
// first in generated pages/microsites.
router.patch("/lp/library/:type/reorder", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { type } = req.params;
  if (!isValidType(type)) { res.status(400).json({ error: "Invalid type" }); return; }
  const rawIds = (req.body?.ids ?? []) as unknown[];
  const ids = rawIds
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!Array.isArray(rawIds) || ids.length !== rawIds.length) {
    res.status(400).json({ error: "ids must be an array of positive integers" });
    return;
  }
  if (ids.length === 0) { res.json({ ok: true }); return; }
  try {
    // Build an int[] literal safely (a bare JS array would expand to a tuple,
    // which is invalid for unnest) then map each id to its 1-based position.
    const idsArr = sql`ARRAY[${sql.join(ids.map((id) => sql`${id}`), sql`, `)}]::int[]`;
    await db.execute(
      sql`UPDATE lp_library_items AS t
          SET sort_order = v.ord, updated_at = now()
          FROM unnest(${idsArr}) WITH ORDINALITY AS v(id, ord)
          WHERE t.id = v.id AND t.type = ${type} AND t.tenant_id = ${tenantId}`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put("/lp/library/:type/:id", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { type, id } = req.params;
  if (!isValidType(type)) { res.status(400).json({ error: "Invalid type" }); return; }
  const { name, content, is_default, sort_order, approved_for_ai } = req.body;
  // Task #253 — when the caller omits `approved_for_ai` (older client code),
  // we leave the existing column value alone via COALESCE.
  const approvedParam = typeof approved_for_ai === "boolean" ? approved_for_ai : null;
  try {
    const result = await db.execute(
      sql`UPDATE lp_library_items
          SET name = ${name ?? ""}, content = ${JSON.stringify(content)}::jsonb,
              is_default = ${is_default ?? false},
              sort_order = COALESCE(${sort_order ?? null}, sort_order),
              approved_for_ai = COALESCE(${approvedParam}, approved_for_ai),
              updated_at = now()
          WHERE id = ${Number(id)} AND type = ${type} AND tenant_id = ${tenantId}
          RETURNING *`
    );
    if (!result.rows.length) { res.status(404).json({ error: "Item not found" }); return; }
    // Task #1206 — when a team member's photo changes, ensure the (possibly new)
    // headshot is reserved from AI reuse. A stale tag left on a replaced headshot
    // is acceptable (still safe) per the task scope.
    if (type === "team_member") {
      await tagTeamPhotoMedia(tenantId, teamPhotoUrl(content));
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/lp/library/:type/:id", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { type, id } = req.params;
  if (!isValidType(type)) { res.status(400).json({ error: "Invalid type" }); return; }
  try {
    await db.execute(
      sql`DELETE FROM lp_library_items WHERE id = ${Number(id)} AND type = ${type} AND tenant_id = ${tenantId}`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
