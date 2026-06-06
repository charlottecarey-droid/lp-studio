// Task #1138 — approval matching, regen memory, and flag persistence for the
// Strict Facts review flow. Detection (detect.ts) only finds candidates; this
// module decides which candidates become pending flags, re-applies prior
// decisions on regeneration, and writes the `lp_page_fact_flags` rows.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { ApprovedFacts, DetectedFact, FactKind, TriageState } from "./types";
import { detectFacts } from "./detect";
import { buildApprovedFacts } from "./approved";
import { normalizeText, quoteKernel, statKernel } from "./normalize";
import { setAtPath } from "./path";
import { trackFactEvent } from "./telemetry";

export interface FactFlagRow {
  id: number;
  tenantId: number;
  pageId: number;
  factKind: FactKind;
  normalizedForm: string;
  blockId: string | null;
  blockType: string | null;
  fieldPath: string;
  originalText: string;
  triageState: TriageState;
  replacementText: string | null;
  swappedWithProofPointId: number | null;
  librarySaved: boolean;
  source: string;
  attributionName: string | null;
  attributionTitle: string | null;
  attributionCompany: string | null;
  resolvedAt: string | null;
}

/** Does a detected fact already match one of the tenant's approved facts? */
export function matchesApproved(fact: DetectedFact, approved: ApprovedFacts): boolean {
  if (fact.factKind === "stat") {
    const kernel = statKernel(fact.originalText);
    if (kernel && approved.statKernels.has(kernel)) return true;
    const v = normalizeText(fact.originalText);
    if (approved.statPool.has(v)) return true;
    for (const a of approved.statPool) {
      if (a && (v.includes(a) || a.includes(v))) return true;
    }
    return false;
  }
  if (fact.factKind === "claim") {
    const v = normalizeText(fact.originalText);
    if (approved.claims.has(v)) return true;
    for (const a of approved.claims) {
      if (a && (v.includes(a) || a.includes(v))) return true;
    }
    return false;
  }
  // quote — first-N words + attribution name.
  const kernel = quoteKernel(fact.originalText);
  const name = fact.attribution?.name ? normalizeText(fact.attribution.name) : "";
  for (const q of approved.quotes) {
    if (q.kernel && q.kernel === kernel && (!q.name || !name || q.name === name)) return true;
  }
  return false;
}

const ROW_COLS = sql`id, tenant_id AS "tenantId", page_id AS "pageId", fact_kind AS "factKind",
  normalized_form AS "normalizedForm", block_id AS "blockId", block_type AS "blockType",
  field_path AS "fieldPath", original_text AS "originalText", triage_state AS "triageState",
  replacement_text AS "replacementText", swapped_with_proof_point_id AS "swappedWithProofPointId",
  library_saved AS "librarySaved", source, attribution_name AS "attributionName",
  attribution_title AS "attributionTitle", attribution_company AS "attributionCompany",
  resolved_at AS "resolvedAt"`;

export async function listFactFlags(tenantId: number, pageId: number): Promise<FactFlagRow[]> {
  const res = await db.execute(
    sql`SELECT ${ROW_COLS} FROM lp_page_fact_flags
        WHERE tenant_id = ${tenantId} AND page_id = ${pageId}
        ORDER BY id ASC`,
  );
  return res.rows as unknown as FactFlagRow[];
}

/** Re-apply a resolved decision onto the block content (regen memory). Returns
 *  true if it mutated the blocks. */
export function applyResolutionToBlocks(blocks: unknown[], row: FactFlagRow): boolean {
  const block = blocks.find(
    (b) => b && typeof b === "object" && (b as { id?: string }).id === (row.blockId ?? undefined),
  );
  if (!block) return false;
  if (row.triageState === "edited" || row.triageState === "swapped") {
    if (row.replacementText == null) return false;
    return setAtPath(block, row.fieldPath, row.replacementText);
  }
  if (row.triageState === "removed") {
    // Quotes keep an empty scaffold; stats/claims clear the value too.
    return setAtPath(block, row.fieldPath, "");
  }
  return false;
}

/**
 * Detect facts in `blocks`, filter out already-approved facts, re-apply prior
 * resolved decisions (regen memory) by mutating `blocks` in place, and persist
 * pending flag rows. Returns the mutated blocks, whether any mutation occurred,
 * and the resulting pending count. Tenant + page scoped throughout.
 *
 * `templateForms` are normalized forms known to be template-authored (vetted) —
 * they never become flags.
 */
export async function syncFactFlags(opts: {
  tenantId: number;
  pageId: number;
  blocks: unknown[];
  approved: ApprovedFacts;
  templateForms?: Set<string>;
}): Promise<{ blocks: unknown[]; mutated: boolean; pendingCount: number; created: number }> {
  const { tenantId, pageId, approved } = opts;
  const blocks = opts.blocks;
  const templateForms = opts.templateForms ?? new Set<string>();

  const detected = detectFacts(blocks);
  const existing = await listFactFlags(tenantId, pageId);
  // Prefer a resolved row over a pending one when the same form repeats.
  const byNorm = new Map<string, FactFlagRow>();
  for (const r of existing) {
    const prev = byNorm.get(r.normalizedForm);
    if (!prev || (prev.triageState === "pending" && r.triageState !== "pending")) {
      byNorm.set(r.normalizedForm, r);
    }
  }

  let mutated = false;
  let created = 0;
  const detectedNorms = new Set<string>();
  const keepIds = new Set<number>();

  for (const fact of detected) {
    const norm = fact.normalizedForm;
    detectedNorms.add(norm);

    // Vetted template content or an already-approved fact never flags.
    if (templateForms.has(norm)) continue;
    if (matchesApproved(fact, approved)) continue;

    const prior = byNorm.get(norm);
    if (prior && prior.triageState !== "pending") {
      // Regen memory: re-apply the prior decision and refresh location.
      keepIds.add(prior.id);
      if (applyResolutionToBlocks(blocks, prior)) mutated = true;
      await db.execute(
        sql`UPDATE lp_page_fact_flags
            SET block_id = ${fact.blockId ?? null}, block_type = ${fact.blockType ?? null},
                field_path = ${fact.fieldPath}, original_text = ${fact.originalText},
                updated_at = now()
            WHERE id = ${prior.id}`,
      );
      continue;
    }
    if (prior && prior.triageState === "pending") {
      // Existing pending flag — refresh its location only.
      keepIds.add(prior.id);
      await db.execute(
        sql`UPDATE lp_page_fact_flags
            SET block_id = ${fact.blockId ?? null}, block_type = ${fact.blockType ?? null},
                field_path = ${fact.fieldPath}, original_text = ${fact.originalText},
                updated_at = now()
            WHERE id = ${prior.id}`,
      );
      continue;
    }

    // New pending flag.
    const ins = await db.execute(
      sql`INSERT INTO lp_page_fact_flags
            (tenant_id, page_id, fact_kind, normalized_form, block_id, block_type,
             field_path, original_text, triage_state, source,
             attribution_name, attribution_title, attribution_company)
          VALUES (${tenantId}, ${pageId}, ${fact.factKind}, ${norm},
             ${fact.blockId ?? null}, ${fact.blockType ?? null}, ${fact.fieldPath},
             ${fact.originalText}, 'pending', 'ai',
             ${fact.attribution?.name ?? null}, ${fact.attribution?.title ?? null},
             ${fact.attribution?.company ?? null})
          RETURNING id`,
    );
    const id = (ins.rows[0] as { id?: number })?.id;
    if (typeof id === "number") {
      keepIds.add(id);
      byNorm.set(norm, { ...({} as FactFlagRow), id, normalizedForm: norm, triageState: "pending" });
    }
    created++;
  }

  // Drop stale PENDING rows no longer present in the page (regen replaced the
  // content). Resolved rows are kept for regen memory even if not present now.
  const staleP = existing.filter(
    (r) => r.triageState === "pending" && !keepIds.has(r.id) && !detectedNorms.has(r.normalizedForm),
  );
  if (staleP.length > 0) {
    const ids = staleP.map((r) => r.id);
    await db.execute(
      sql`DELETE FROM lp_page_fact_flags WHERE id = ANY(${sql`ARRAY[${sql.join(ids.map((i) => sql`${i}`), sql`, `)}]::int[]`})`,
    );
  }

  const pend = await db.execute(
    sql`SELECT COUNT(*)::int AS c FROM lp_page_fact_flags
        WHERE tenant_id = ${tenantId} AND page_id = ${pageId} AND triage_state = 'pending'`,
  );
  const pendingCount = (pend.rows[0] as { c?: number })?.c ?? 0;

  if (created > 0) {
    trackFactEvent("fact_flag_created", { tenantId, pageId, created, pendingCount });
  }

  return { blocks, mutated, pendingCount, created };
}

/**
 * Normalized forms for facts that are template-authored (vetted). Pass the base
 * template's blocks so their facts are pre-tagged as a template source and never
 * become flags on a generated page.
 */
export function templateFactForms(templateBlocks: unknown[]): Set<string> {
  return new Set(detectFacts(templateBlocks).map((f) => f.normalizedForm));
}

/**
 * Server-side convenience for the AI-generation surfaces (landing pages, sales
 * microsites, one-pagers): build the tenant's approved-fact pools, detect facts
 * in the freshly-generated page, and persist pending flags. Callers should run
 * this best-effort (catch + log) so a detection hiccup never blocks generation.
 */
export async function detectAndWriteFlagsForPage(opts: {
  tenantId: number;
  pageId: number;
  blocks: unknown[];
  templateForms?: Set<string>;
}): Promise<{ blocks: unknown[]; mutated: boolean; pendingCount: number; created: number }> {
  const approved = await buildApprovedFacts(opts.tenantId);
  return syncFactFlags({
    tenantId: opts.tenantId,
    pageId: opts.pageId,
    blocks: opts.blocks,
    approved,
    templateForms: opts.templateForms,
  });
}

export interface FactWarning {
  factKind: FactKind;
  text: string;
}

/**
 * Advisory (non-persistent) fact detection for ephemeral surfaces with no page
 * anchor — AI email drafts. Detects unapproved stats / claims / quotes in the
 * given text fields and returns a de-duplicated list the editor can surface as a
 * soft "review before sending" notice. There is no flag table row, no gate.
 */
export async function detectAdvisoryFacts(
  tenantId: number,
  fields: Record<string, string>,
): Promise<FactWarning[]> {
  const approved = await buildApprovedFacts(tenantId);
  const detected = detectFacts([{ id: "advisory", type: "richtext", props: fields }]);
  const seen = new Set<string>();
  const out: FactWarning[] = [];
  for (const f of detected) {
    if (matchesApproved(f, approved)) continue;
    if (seen.has(f.normalizedForm)) continue;
    seen.add(f.normalizedForm);
    out.push({ factKind: f.factKind, text: f.originalText });
  }
  return out;
}
