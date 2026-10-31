/**
 * Proof-point library (lp_proof_points) — the tenant's approved stats, claims
 * and customer quotes. Shared by page generation, microsite generation, the
 * copy refresh route and the account briefing so every AI path sees the same
 * facts and the same verbatim-quote contract.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/** Task #256 — proof point row as returned by the library route. Subset of
 *  the DB columns we actually consume in the prompt + sanitize pool. */
export interface ProofPoint {
  id: number;
  value: string;
  label: string;
  source_url: string;
  as_of_date: string | null;
  approved_for_ai: boolean;
  /** Oct 2026 — "stat" | "claim" | "quote". Quote rows are customer speech
   *  and are surfaced VERBATIM with their attribution (see
   *  buildProofPointsSection / restoreVerbatimQuotes); they never enter the
   *  stat pool as numbers. */
  fact_kind: "stat" | "claim" | "quote" | string;
  attribution_name: string;
  attribution_title: string;
  attribution_company: string;
}

/** Task #256 — fetch the tenant's proof-point library so it can be injected
 *  into the AI brief and the strict-mode approved-stat pool. Returns ALL
 *  rows (the caller filters by approved_for_ai for prompt vs pool use). */
export async function fetchProofPoints(tenantId: number | null): Promise<ProofPoint[]> {
  if (tenantId == null) return [];
  try {
    const rows = await db.execute(
      sql`SELECT id, value, label, source_url, as_of_date, approved_for_ai,
                 fact_kind, attribution_name, attribution_title, attribution_company
          FROM lp_proof_points
          WHERE tenant_id = ${tenantId}
          ORDER BY sort_order ASC, id ASC`,
    );
    return (rows.rows as Array<{
      id: number;
      value: string;
      label: string;
      source_url: string;
      as_of_date: string | null;
      approved_for_ai: boolean;
      fact_kind: string | null;
      attribution_name: string | null;
      attribution_title: string | null;
      attribution_company: string | null;
    }>).map((r) => ({
      id: r.id,
      value: r.value ?? "",
      label: r.label ?? "",
      source_url: r.source_url ?? "",
      as_of_date: r.as_of_date,
      approved_for_ai: r.approved_for_ai !== false,
      fact_kind: r.fact_kind || "stat",
      attribution_name: r.attribution_name ?? "",
      attribution_title: r.attribution_title ?? "",
      attribution_company: r.attribution_company ?? "",
    }));
  } catch {
    return [];
  }
}

export function isQuoteProofPoint(p: Pick<ProofPoint, "fact_kind">): boolean {
  return (p.fact_kind ?? "").toLowerCase() === "quote";
}

/** One prompt line for an approved customer quote: the exact text in quotes
 *  plus whatever attribution the row carries ("— Dr. Nathan Suter, Chief
 *  Clinical Officer, Enable Dental"). */
export function formatQuoteProofPointLine(p: ProofPoint): string {
  const attribution = [p.attribution_name, p.attribution_title, p.attribution_company]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const topic = p.label?.trim() ? ` [topic: ${p.label.trim()}]` : "";
  return attribution ? `- "${p.value.trim()}" — ${attribution}${topic}` : `- "${p.value.trim()}"${topic}`;
}

export function buildProofPointsSection(points: ProofPoint[], strict: boolean): string {
  const usable = strict ? points.filter((p) => p.approved_for_ai) : points;
  // Oct 2026 — quotes are customer speech, not stats. Listing them as bare
  // "value label" lines under a stats heading taught the model to treat them
  // as raw material it could tighten, and the banned-phrase list then pushed
  // it to reword a real customer's words ("game-changer" → paraphrase). They
  // get their own section with an explicit verbatim contract.
  const quotes = usable.filter(isQuoteProofPoint).filter((p) => p.value.trim());
  const facts = usable.filter((p) => !isQuoteProofPoint(p));
  const parts: string[] = [];
  if (facts.length === 0) {
    if (strict) parts.push("APPROVED PROOF POINTS: (none) — for any stat slot in this page, use the literal placeholder \"X\" instead of inventing numbers.");
  } else {
    const lines = facts.map((p) => {
      const date = p.as_of_date ? ` [as of ${p.as_of_date}]` : "";
      const src = p.source_url ? ` (source: ${p.source_url})` : "";
      return `- ${p.value} ${p.label}${date}${src}`.trim();
    }).join("\n");
    parts.push(strict
      ? `APPROVED PROOF POINTS (use ONLY these — together with any APPROVED SEGMENT STATS — for any stat-bearing block; do not invent others):\n${lines}`
      : `Proof Points (reusable across pages and segments):\n${lines}`);
  }
  if (quotes.length > 0) {
    parts.push(
      `APPROVED CUSTOMER QUOTES — these are real people's words. For any quote/testimonial slot, copy the chosen quote CHARACTER-FOR-CHARACTER (same words, punctuation, and contractions) with its exact attribution (name, title, company as given). Never reword, shorten, merge, or "improve" a quote, and never invent a quote or attribution that is not listed. Quoted speech is exempt from the banned-phrase and voice rules — if a quote contains a banned word, keep it anyway. If no quote fits, leave the quote slot empty or choose a block without one:\n` +
      quotes.map(formatQuoteProofPointLine).join("\n"),
    );
  }
  return parts.join("\n\n");
}
