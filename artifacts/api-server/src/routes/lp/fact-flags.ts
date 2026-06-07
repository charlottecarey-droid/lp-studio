// Task #1138 — Strict Facts simplified review flow API. Lives under /lp.
//
// Persistent per-page fact flags replace the old ephemeral sessionStorage
// hand-off: detection writes `lp_page_fact_flags` rows (via /sync), the builder
// banner lists them, and the reviewer resolves each one (approve-for-page /
// edit / swap / remove / save-to-library / undo) or bulk-approves. Publishing
// is gated until zero pending flags remain. Strict tenant isolation throughout.
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getTenantId } from "../../middleware/requireAuth";
import {
  buildApprovedFacts,
  listFactFlags,
  syncFactFlags,
  setAtPath,
  normalizedFormFor,
  trackFactEvent,
  type FactFlagRow,
  type FactKind,
} from "../../lib/factFlags";

const router = Router();

interface PageRow {
  id: number;
  blocks: unknown[];
  status: string;
}

async function loadPage(tenantId: number, pageId: number): Promise<PageRow | null> {
  const r = await db.execute(
    sql`SELECT id, blocks, status FROM lp_pages WHERE id = ${pageId} AND tenant_id = ${tenantId} LIMIT 1`,
  );
  const row = r.rows[0] as { id?: number; blocks?: unknown; status?: string } | undefined;
  if (!row || typeof row.id !== "number") return null;
  return { id: row.id, blocks: Array.isArray(row.blocks) ? row.blocks : [], status: row.status ?? "draft" };
}

async function saveBlocks(tenantId: number, pageId: number, blocks: unknown[]): Promise<void> {
  await db.execute(
    sql`UPDATE lp_pages SET blocks = ${JSON.stringify(blocks)}::jsonb, updated_at = now()
        WHERE id = ${pageId} AND tenant_id = ${tenantId}`,
  );
}

async function loadFlag(tenantId: number, id: number): Promise<FactFlagRow | null> {
  const rows = await db.execute(
    sql`SELECT id, tenant_id AS "tenantId", page_id AS "pageId", fact_kind AS "factKind",
          normalized_form AS "normalizedForm", block_id AS "blockId", block_type AS "blockType",
          field_path AS "fieldPath", original_text AS "originalText", triage_state AS "triageState",
          replacement_text AS "replacementText", swapped_with_proof_point_id AS "swappedWithProofPointId",
          library_saved AS "librarySaved", source, attribution_name AS "attributionName",
          attribution_title AS "attributionTitle", attribution_company AS "attributionCompany",
          context_label AS "contextLabel", resolved_at AS "resolvedAt"
        FROM lp_page_fact_flags WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1`,
  );
  return (rows.rows[0] as unknown as FactFlagRow) ?? null;
}

export interface PendingFactFlagState {
  /** Number of pending flags. 0 when none — and also 0 when `ok` is false. */
  pending: number;
  /**
   * True when the pending-flag count was determined successfully. False when
   * the query errored (e.g. the Strict Facts schema is missing on this DB), in
   * which case callers must WARN rather than treat the page as clean.
   */
  ok: boolean;
}

/**
 * Resolve how many pending fact flags a page has — shared with the publish gate
 * in pages.ts.
 *
 * Critically, a query failure no longer silently reports "0 pending". Returning
 * `{ pending: 0, ok: false }` lets the publish gate distinguish "genuinely no
 * flags" (publish freely) from "couldn't check" (warn the user) so unapproved
 * stats can never slip through a *silent* publish when the check itself errors.
 */
export async function getPendingFactFlagState(
  tenantId: number,
  pageId: number,
): Promise<PendingFactFlagState> {
  try {
    const r = await db.execute(
      sql`SELECT COUNT(*)::int AS c FROM lp_page_fact_flags
          WHERE tenant_id = ${tenantId} AND page_id = ${pageId} AND triage_state = 'pending'`,
    );
    return { pending: (r.rows[0] as { c?: number })?.c ?? 0, ok: true };
  } catch (err) {
    logger.error(
      { err, tenantId, pageId },
      "countPendingFactFlags query failed — publish gate will warn rather than pass silently",
    );
    return { pending: 0, ok: false };
  }
}

/**
 * Shared Strict Facts publish gate used by BOTH the `PUT /lp/pages/:id` publish
 * path and the `POST /lp/pages/:id/approve` review-approval path.
 *
 * Warn-and-confirm semantics (never a hard block):
 *   - Genuinely zero pending flags → returns `{ blocked: false }`, publish runs
 *     normally with no prompt.
 *   - Pending flags OR the count couldn't be determined → unless the caller has
 *     explicitly confirmed via `bulkApproveFactFlags: true`, respond 409 with
 *     `code: "fact_flags_pending"` so the client opens the Review Facts modal.
 *     The user always sees the warning; nothing publishes silently.
 *   - Confirmed (`bulkApproveFactFlags: true`) → best-effort bulk-approve of any
 *     pending flags, then allow the publish. If the bulk-approve UPDATE itself
 *     fails (e.g. the schema is missing) we still let the publish through — the
 *     user has explicitly chosen to proceed, so a confirmed request is never
 *     hard-blocked.
 *
 * Returns `{ blocked: true }` when a 409 response was already sent (caller must
 * return immediately); `{ blocked: false }` when the publish may proceed.
 */
export async function enforceFactFlagPublishGate(
  tenantId: number,
  pageId: number,
  req: Request,
  res: Response,
): Promise<{ blocked: boolean }> {
  const state = await getPendingFactFlagState(tenantId, pageId);
  const needsWarning = !state.ok || state.pending > 0;
  if (!needsWarning) return { blocked: false };

  if (req.body?.bulkApproveFactFlags === true) {
    try {
      await db.execute(
        sql`UPDATE lp_page_fact_flags
            SET triage_state = 'approved_for_page', resolved_at = now(), updated_at = now()
            WHERE tenant_id = ${tenantId} AND page_id = ${pageId} AND triage_state = 'pending'`,
      );
    } catch (err) {
      // The user explicitly chose to publish anyway — never block on the
      // best-effort cleanup (the schema may be missing, which is the very
      // failure that tripped the warning).
      logger.error({ err, tenantId, pageId }, "bulk-approve-and-publish update failed; publishing anyway");
    }
    trackFactEvent("fact_flag_published_with_bulk_approve", { tenantId, pageId, approved: state.pending });
    return { blocked: false };
  }

  res.status(409).json({
    error: "Resolve flagged facts before publishing",
    code: "fact_flags_pending",
    pendingCount: state.pending,
    // Signal that the count itself couldn't be verified, so the client can show
    // an appropriate "couldn't verify facts" message instead of "0 pending".
    checkFailed: !state.ok,
  });
  return { blocked: true };
}

function setBlockField(blocks: unknown[], row: FactFlagRow, value: string): void {
  const block = blocks.find(
    (b) => b && typeof b === "object" && (b as { id?: string }).id === (row.blockId ?? undefined),
  );
  if (block) setAtPath(block, row.fieldPath, value);
}

// ── GET: list flags for a page (drives the banner + reviewer) ──────────────
router.get("/lp/pages/:pageId/fact-flags", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const pageId = parseInt(req.params.pageId, 10);
  if (isNaN(pageId)) { res.status(400).json({ error: "Invalid page ID" }); return; }
  try {
    const flags = await listFactFlags(tenantId, pageId);
    const pending = flags.filter((f) => f.triageState === "pending").length;
    res.json({ flags, pendingCount: pending, total: flags.length });
  } catch (err) {
    logger.error({ err }, "fact-flags route error");
    res.status(500).json({ error: String(err) });
  }
});

// ── POST: detect + persist flags for a saved page (regen memory aware) ─────
router.post("/lp/pages/:pageId/fact-flags/sync", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const pageId = parseInt(req.params.pageId, 10);
  if (isNaN(pageId)) { res.status(400).json({ error: "Invalid page ID" }); return; }
  try {
    const page = await loadPage(tenantId, pageId);
    if (!page) { res.status(404).json({ error: "Page not found" }); return; }
    const templateForms = new Set<string>(
      Array.isArray(req.body?.templateForms)
        ? (req.body.templateForms as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
    );
    const approved = await buildApprovedFacts(tenantId);
    const result = await syncFactFlags({ tenantId, pageId, blocks: page.blocks, approved, templateForms });
    if (result.mutated) await saveBlocks(tenantId, pageId, result.blocks);
    const flags = await listFactFlags(tenantId, pageId);
    res.json({ flags, pendingCount: result.pendingCount, created: result.created, mutated: result.mutated });
  } catch (err) {
    logger.error({ err }, "fact-flags route error");
    res.status(500).json({ error: String(err) });
  }
});

// ── POST: approve-for-page (no content change) ─────────────────────────────
router.post("/lp/fact-flags/:id/approve", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const r = await db.execute(
      sql`UPDATE lp_page_fact_flags
          SET triage_state = 'approved_for_page', resolved_at = now(), updated_at = now()
          WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id`,
    );
    if (!r.rows.length) { res.status(404).json({ error: "Flag not found" }); return; }
    const flag = await loadFlag(tenantId, id);
    trackFactEvent("fact_flag_approved", { tenantId, flagId: id, factKind: flag?.factKind });
    if (flag?.factKind === "quote" && req.body?.quoteConfirmed === true) {
      trackFactEvent("fact_flag_quote_approve_confirmed", { tenantId, flagId: id });
    }
    res.json({ ok: true, flag });
  } catch (err) {
    logger.error({ err }, "fact-flags route error");
    res.status(500).json({ error: String(err) });
  }
});

// ── POST: edit — replace the flagged text with corrected copy ──────────────
router.post("/lp/fact-flags/:id/edit", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const replacementText = typeof req.body?.replacementText === "string" ? req.body.replacementText : null;
  if (replacementText === null) { res.status(400).json({ error: "replacementText required" }); return; }
  try {
    const flag = await loadFlag(tenantId, id);
    if (!flag) { res.status(404).json({ error: "Flag not found" }); return; }
    const page = await loadPage(tenantId, flag.pageId);
    if (!page) { res.status(404).json({ error: "Page not found" }); return; }
    setBlockField(page.blocks, flag, replacementText);
    await saveBlocks(tenantId, flag.pageId, page.blocks);
    const newNorm = normalizedFormFor(flag.factKind, replacementText, {
      name: flag.attributionName ?? undefined,
    });
    await db.execute(
      sql`UPDATE lp_page_fact_flags
          SET triage_state = 'edited', replacement_text = ${replacementText},
              normalized_form = ${newNorm}, resolved_at = now(), updated_at = now()
          WHERE id = ${id} AND tenant_id = ${tenantId}`,
    );
    trackFactEvent("fact_flag_edited", { tenantId, flagId: id, factKind: flag.factKind });
    res.json({ ok: true, flag: await loadFlag(tenantId, id) });
  } catch (err) {
    logger.error({ err }, "fact-flags route error");
    res.status(500).json({ error: String(err) });
  }
});

// ── POST: swap — replace with an approved proof point ──────────────────────
router.post("/lp/fact-flags/:id/swap", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.id, 10);
  const proofPointId = parseInt(req.body?.proofPointId, 10);
  if (isNaN(id) || isNaN(proofPointId)) { res.status(400).json({ error: "id and proofPointId required" }); return; }
  try {
    const flag = await loadFlag(tenantId, id);
    if (!flag) { res.status(404).json({ error: "Flag not found" }); return; }
    const ppRes = await db.execute(
      sql`SELECT value, label, attribution_name AS "attributionName"
          FROM lp_proof_points WHERE id = ${proofPointId} AND tenant_id = ${tenantId} LIMIT 1`,
    );
    const pp = ppRes.rows[0] as { value?: string; label?: string; attributionName?: string } | undefined;
    if (!pp) { res.status(404).json({ error: "Proof point not found" }); return; }
    const replacement = flag.factKind === "quote" ? (pp.value || pp.label || "") : (pp.value || "");
    const page = await loadPage(tenantId, flag.pageId);
    if (!page) { res.status(404).json({ error: "Page not found" }); return; }
    setBlockField(page.blocks, flag, replacement);
    await saveBlocks(tenantId, flag.pageId, page.blocks);
    const newNorm = normalizedFormFor(flag.factKind, replacement, {
      name: pp.attributionName ?? flag.attributionName ?? undefined,
    });
    await db.execute(
      sql`UPDATE lp_page_fact_flags
          SET triage_state = 'swapped', replacement_text = ${replacement},
              swapped_with_proof_point_id = ${proofPointId}, normalized_form = ${newNorm},
              resolved_at = now(), updated_at = now()
          WHERE id = ${id} AND tenant_id = ${tenantId}`,
    );
    trackFactEvent("fact_flag_swapped", { tenantId, flagId: id, factKind: flag.factKind, proofPointId });
    res.json({ ok: true, flag: await loadFlag(tenantId, id) });
  } catch (err) {
    logger.error({ err }, "fact-flags route error");
    res.status(500).json({ error: String(err) });
  }
});

// ── POST: remove — clear the flagged value (keeps an empty scaffold) ───────
router.post("/lp/fact-flags/:id/remove", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const flag = await loadFlag(tenantId, id);
    if (!flag) { res.status(404).json({ error: "Flag not found" }); return; }
    const page = await loadPage(tenantId, flag.pageId);
    if (!page) { res.status(404).json({ error: "Page not found" }); return; }
    setBlockField(page.blocks, flag, "");
    await saveBlocks(tenantId, flag.pageId, page.blocks);
    await db.execute(
      sql`UPDATE lp_page_fact_flags
          SET triage_state = 'removed', replacement_text = '', resolved_at = now(), updated_at = now()
          WHERE id = ${id} AND tenant_id = ${tenantId}`,
    );
    trackFactEvent("fact_flag_removed", { tenantId, flagId: id, factKind: flag.factKind });
    res.json({ ok: true, flag: await loadFlag(tenantId, id) });
  } catch (err) {
    logger.error({ err }, "fact-flags route error");
    res.status(500).json({ error: String(err) });
  }
});

// ── POST: save the (resolved) fact to the proof-point library ──────────────
router.post("/lp/fact-flags/:id/save-to-library", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const flag = await loadFlag(tenantId, id);
    if (!flag) { res.status(404).json({ error: "Flag not found" }); return; }
    const value = (req.body?.value as string) ?? flag.replacementText ?? flag.originalText;
    // Prefill the human-readable context as the label when the client doesn't
    // send one (or sends a blank/whitespace-only one), so saved proof points
    // are never stored with an empty label.
    const bodyLabel = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    const label = bodyLabel || (flag.contextLabel?.trim() ?? "");
    const factKind: FactKind = flag.factKind;
    const ins = await db.execute(
      sql`INSERT INTO lp_proof_points
            (tenant_id, value, label, source_url, approved_for_ai, fact_kind,
             attribution_name, attribution_title, attribution_company, sort_order)
          VALUES (${tenantId}, ${String(value ?? "")}, ${String(label)}, '', true, ${factKind},
             ${flag.attributionName ?? ""}, ${flag.attributionTitle ?? ""},
             ${flag.attributionCompany ?? ""},
             COALESCE((SELECT MAX(sort_order) + 1 FROM lp_proof_points WHERE tenant_id = ${tenantId}), 0))
          RETURNING id`,
    );
    await db.execute(
      sql`UPDATE lp_page_fact_flags SET library_saved = true, updated_at = now()
          WHERE id = ${id} AND tenant_id = ${tenantId}`,
    );
    const proofPointId = (ins.rows[0] as { id?: number })?.id;
    trackFactEvent("fact_flag_library_upgrade", { tenantId, flagId: id, factKind, proofPointId });
    res.json({ ok: true, proofPointId, flag: await loadFlag(tenantId, id) });
  } catch (err) {
    logger.error({ err }, "fact-flags route error");
    res.status(500).json({ error: String(err) });
  }
});

// ── POST: undo — revert a resolved flag back to pending + restore content ──
router.post("/lp/fact-flags/:id/undo", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const flag = await loadFlag(tenantId, id);
    if (!flag) { res.status(404).json({ error: "Flag not found" }); return; }
    // Restore the original text if the content was changed by a prior action.
    if (flag.triageState === "edited" || flag.triageState === "swapped" || flag.triageState === "removed") {
      const page = await loadPage(tenantId, flag.pageId);
      if (page) {
        setBlockField(page.blocks, flag, flag.originalText);
        await saveBlocks(tenantId, flag.pageId, page.blocks);
      }
    }
    const restoredNorm = normalizedFormFor(flag.factKind, flag.originalText, {
      name: flag.attributionName ?? undefined,
    });
    await db.execute(
      sql`UPDATE lp_page_fact_flags
          SET triage_state = 'pending', replacement_text = NULL,
              swapped_with_proof_point_id = NULL, normalized_form = ${restoredNorm},
              resolved_at = NULL, updated_at = now()
          WHERE id = ${id} AND tenant_id = ${tenantId}`,
    );
    trackFactEvent("fact_flag_undo", { tenantId, flagId: id, factKind: flag.factKind });
    res.json({ ok: true, flag: await loadFlag(tenantId, id) });
  } catch (err) {
    logger.error({ err }, "fact-flags route error");
    res.status(500).json({ error: String(err) });
  }
});

// ── POST: bulk-approve all pending flags on a page ─────────────────────────
router.post("/lp/pages/:pageId/fact-flags/bulk-approve", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const pageId = parseInt(req.params.pageId, 10);
  if (isNaN(pageId)) { res.status(400).json({ error: "Invalid page ID" }); return; }
  try {
    const r = await db.execute(
      sql`UPDATE lp_page_fact_flags
          SET triage_state = 'approved_for_page', resolved_at = now(), updated_at = now()
          WHERE tenant_id = ${tenantId} AND page_id = ${pageId} AND triage_state = 'pending'
          RETURNING id`,
    );
    trackFactEvent("fact_flag_bulk_approved", { tenantId, pageId, approved: r.rows.length });
    res.json({ ok: true, approved: r.rows.length, flags: await listFactFlags(tenantId, pageId) });
  } catch (err) {
    logger.error({ err }, "fact-flags route error");
    res.status(500).json({ error: String(err) });
  }
});

// ── GET: approved proof points for the swap picker, filtered by fact kind ──
router.get("/lp/fact-flags/proof-points", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const factKind = String(req.query.factKind ?? "stat");
  try {
    const rows = await db.execute(
      factKind === "quote"
        ? sql`SELECT id, value, label, attribution_name AS "attributionName"
              FROM lp_proof_points
              WHERE tenant_id = ${tenantId} AND approved_for_ai = true AND fact_kind = 'quote'
              ORDER BY sort_order ASC, id ASC`
        : sql`SELECT id, value, label, attribution_name AS "attributionName"
              FROM lp_proof_points
              WHERE tenant_id = ${tenantId} AND approved_for_ai = true
                AND (fact_kind IS NULL OR fact_kind = ${factKind})
              ORDER BY sort_order ASC, id ASC`,
    );
    res.json(rows.rows);
  } catch (err) {
    logger.error({ err }, "fact-flags route error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
