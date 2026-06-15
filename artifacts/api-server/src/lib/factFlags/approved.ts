// Task #1138 — build the tenant's approved-fact pools for the review flow.
//
// Self-contained DB reads (brand settings, proof points, case-study library) so
// this module has NO dependency on generate-page.ts — generate-page imports the
// detector from here, so the reverse import would be circular.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { ApprovedFacts } from "./types";
import { normalizeText, quoteKernel, statKernel } from "./normalize";

type ClaimEntry = string | { text?: string; approvedForAi?: boolean };
function claimText(c: ClaimEntry): string {
  return typeof c === "string" ? c : c?.text ?? "";
}
function claimApproved(c: ClaimEntry): boolean {
  return typeof c === "string" ? true : c?.approvedForAi !== false;
}

interface BrandConfigLite {
  brandName?: string;
  aiStrictFactsMode?: boolean;
  productLines?: Array<{ claims?: ClaimEntry[] }>;
  segments?: Array<{
    stats?: Array<{ value?: string; approvedForAi?: boolean; linkProofPointId?: number }>;
  }>;
}

/**
 * Whether the tenant has Strict Facts mode ON. Mirrors the `aiStrictFactsMode
 * !== false` default-ON convention used by the AI generation paths, so the
 * review surface (banner, publish gate, fact-flag sync) honours the same brand
 * setting that gates generation.
 *
 * Fail-CLOSED: when the tenant is unknown or the read errors we treat Strict
 * Facts as ON, so a transient DB hiccup can never silently drop the review
 * gate while a tenant genuinely has it enabled.
 */
export async function isStrictFactsEnabled(tenantId: number | null): Promise<boolean> {
  if (tenantId == null) return true;
  try {
    const brandRows = await db.execute(
      sql`SELECT config FROM lp_brand_settings WHERE tenant_id = ${tenantId} LIMIT 1`,
    );
    const cfg = (brandRows.rows[0] as { config?: BrandConfigLite } | undefined)?.config ?? {};
    return cfg.aiStrictFactsMode !== false;
  } catch {
    return true;
  }
}

/** The tenant's own SELLING-brand name, used by the claim detector to suppress
 *  self-positioning ("Acme is your trusted lab") that is NOT external
 *  validation. Returns "" when unknown — back-compatible, fail-open. */
export async function fetchTenantBrandName(tenantId: number | null): Promise<string> {
  if (tenantId == null) return "";
  try {
    const brandRows = await db.execute(
      sql`SELECT config FROM lp_brand_settings WHERE tenant_id = ${tenantId} LIMIT 1`,
    );
    const cfg = (brandRows.rows[0] as { config?: BrandConfigLite } | undefined)?.config ?? {};
    return (cfg.brandName ?? "").trim();
  } catch {
    return "";
  }
}

export async function buildApprovedFacts(tenantId: number | null): Promise<ApprovedFacts> {
  const statPool = new Set<string>();
  const statKernels = new Set<string>();
  const claims = new Set<string>();
  const quotes: { kernel: string; name: string }[] = [];

  const addStat = (raw: string | undefined): void => {
    if (!raw) return;
    const v = String(raw).trim().toLowerCase();
    if (!v) return;
    statPool.add(v);
    const k = statKernel(v);
    if (k) statKernels.add(k);
  };
  const addClaim = (raw: string | undefined): void => {
    if (!raw) return;
    const v = normalizeText(raw);
    if (v) claims.add(v);
  };
  const addQuote = (body: string | undefined, name: string | undefined): void => {
    const kernel = body ? quoteKernel(body) : "";
    if (!kernel) return;
    quotes.push({ kernel, name: name ? normalizeText(name) : "" });
  };

  if (tenantId == null) return { statPool, statKernels, claims, quotes };

  try {
    const brandRows = await db.execute(
      sql`SELECT config FROM lp_brand_settings WHERE tenant_id = ${tenantId} LIMIT 1`,
    );
    const cfg = (brandRows.rows[0] as { config?: BrandConfigLite } | undefined)?.config ?? {};
    for (const p of cfg.productLines ?? []) {
      for (const c of p.claims ?? []) {
        if (!claimApproved(c)) continue;
        const text = claimText(c);
        addStat(text); // numeric claims feed the stat pool (mirrors buildApprovedStatSet)
        addClaim(text);
      }
    }
    for (const seg of cfg.segments ?? []) {
      for (const s of seg.stats ?? []) {
        if (s.approvedForAi === false) continue;
        addStat(s.value);
      }
    }
  } catch {
    /* brand settings optional */
  }

  try {
    const pp = await db.execute(
      sql`SELECT value, label, fact_kind, attribution_name
          FROM lp_proof_points
          WHERE tenant_id = ${tenantId} AND approved_for_ai = true`,
    );
    for (const r of pp.rows as Array<{
      value?: string;
      label?: string;
      fact_kind?: string;
      attribution_name?: string;
    }>) {
      if (r.fact_kind === "quote") {
        addQuote(r.value || r.label, r.attribution_name);
      } else {
        addStat(r.value);
      }
    }
  } catch {
    /* proof points optional */
  }

  try {
    const cs = await db.execute(
      sql`SELECT content FROM lp_library_items
          WHERE tenant_id = ${tenantId} AND type = 'case_study' AND approved_for_ai = true
          LIMIT 50`,
    );
    for (const r of cs.rows as Array<{ content?: Record<string, unknown> }>) {
      const c = r.content ?? {};
      const stat = typeof c.stat === "string" ? c.stat : "";
      const quote = typeof c.quote === "string" ? c.quote : "";
      const author = typeof c.author === "string" ? c.author : "";
      if (stat) addStat(stat);
      if (quote) addQuote(quote, author);
    }
  } catch {
    /* case studies optional */
  }

  return { statPool, statKernels, claims, quotes };
}
