// Shared filter/sort semantics for the two web template libraries (task #753):
// the Marketing marketplace (template-marketplace.tsx) and the Sales
// marketplace (sales/sales-marketplace.tsx). Keeping these helpers in one
// place guarantees both libraries bucket templates by Type and Industry — and
// order "Recently Used" — identically.

export type TemplateTypeFilter = "All" | "Full Page" | "Premium" | "Industry-specific" | "Custom";

/** Minimal shape needed to bucket a template by Type / Industry. */
export interface TemplateTypeShape {
  /** True for platform-seeded global starters; false/undefined = tenant-owned. */
  isGlobal?: boolean;
  /** Industry tag for global starters (e.g. "dental"). The catch-all "generic"
   *  tag is treated as untagged — those only ever appear under the "All" type. */
  industry?: string | null;
  /** Marketplace rank; 1–10 marks a curated flagship "Premium" template. */
  premiumRank?: number;
  /** True for standalone full-page templates (the page's first block renders an
   *  entire page rather than composing into one). */
  fullPage?: boolean;
}

/** Premium = curated flagship starter templates (premiumRank 1–10). */
export function isPremiumTemplate(t: TemplateTypeShape): boolean {
  return (
    !!t.isGlobal &&
    typeof t.premiumRank === "number" &&
    t.premiumRank >= 1 &&
    t.premiumRank <= 10
  );
}

/** True when a global template carries a real industry tag. The "generic"
 *  catch-all is NOT a real industry — generic starters are untagged and only
 *  surface under the "All" type / "All industries" filter. */
export function hasRealIndustry(t: TemplateTypeShape): boolean {
  const tag = t.industry?.trim().toLowerCase();
  return !!t.isGlobal && !!tag && tag !== "generic";
}

/** Type buckets:
 *   - Full Page        → standalone full-page templates (first block is a full page)
 *   - Premium          → curated flagship starters (premiumRank 1–10)
 *   - Industry-specific → global starters with a real industry tag (non-premium)
 *   - Custom           → tenant-owned templates (not global)
 *   - All              → everything (the only place generic untagged globals show)
 */
export function templateMatchesType(t: TemplateTypeShape, type: TemplateTypeFilter): boolean {
  switch (type) {
    case "All":
      return true;
    case "Full Page":
      return !!t.fullPage;
    case "Custom":
      return !t.isGlobal;
    case "Premium":
      return isPremiumTemplate(t);
    case "Industry-specific":
      return hasRealIndustry(t) && !isPremiumTemplate(t);
  }
}

/** Industry filter: a specific selection only restricts industry-tagged global
 *  starters. Tenant-owned templates and untagged/generic globals always remain
 *  visible so the user never loses access to their own work. */
export function templateMatchesIndustry(t: TemplateTypeShape, selectedIndustry: string | null): boolean {
  if (!selectedIndustry) return true; // "All industries"
  if (!t.isGlobal) return true; // tenant-owned always visible
  const tag = t.industry?.trim();
  if (!tag) return true; // untagged globals always visible
  return tag.toLowerCase() === selectedIndustry.toLowerCase();
}

/** Real industry tags present across the loaded templates (excludes the
 *  "generic" catch-all), sorted alphabetically. Drives the Industry dropdown. */
export function collectIndustries(templates: TemplateTypeShape[]): string[] {
  const set = new Set<string>();
  for (const t of templates) {
    if (hasRealIndustry(t) && t.industry) set.add(t.industry.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** "Recently Used" order: most-recently-used first, never-used (null) last,
 *  ties broken by label. */
export function compareRecentlyUsed(
  a: { lastUsedAt?: string | null; templateLabel: string },
  b: { lastUsedAt?: string | null; templateLabel: string },
): number {
  const ta = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : -Infinity;
  const tb = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : -Infinity;
  if (ta !== tb) return tb - ta;
  return a.templateLabel.localeCompare(b.templateLabel);
}

/** Title-case a free-form industry slug for display ("local-services" →
 *  "Local Services"). */
export function formatIndustry(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}
