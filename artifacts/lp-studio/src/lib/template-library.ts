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
  /** Stable template slug (e.g. "ind-dental-family-practice"). The seeded
   *  industry starters all use the "ind-" prefix; we recognize them by it
   *  because they carry a null `industry` tag (see isIndustryTemplate). */
  slug?: string | null;
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

/** True when a global template is one of the seeded industry starters. These
 *  carry slugs like "ind-dental-family-practice" but are deliberately stored
 *  with a null `industry` tag (so they stay visible to every tenant), so a
 *  plain `industry`-tag check (hasRealIndustry) misses them and they fall into
 *  the "Block templates" catch-all. We additionally recognize them by the
 *  "ind-" slug prefix so they land in their own "Industry templates" section. */
export function isIndustryTemplate(t: TemplateTypeShape): boolean {
  if (hasRealIndustry(t)) return true;
  const slug = t.slug?.trim().toLowerCase();
  return !!t.isGlobal && !!slug && slug.startsWith("ind-");
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
      return isIndustryTemplate(t) && !isPremiumTemplate(t);
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

// ---------------------------------------------------------------------------
// Shared section grouping + pagination (task #1371). Both template libraries —
// the Marketing marketplace and the Sales marketplace — group their filtered+
// sorted templates into the SAME ordered, labeled sections and paginate them
// identically. Keeping the logic here guarantees the two galleries never drift.
// ---------------------------------------------------------------------------

/** Minimal shape needed to assign a template to a display section. Extends the
 *  Type/Industry shape with the per-tenant id + starred flag the buckets read. */
export interface TemplateGroupShape extends TemplateTypeShape {
  /** Stable per-template id — matched against the homepage-default id set. */
  id: number;
  /** True when the caller's tenant has starred this template (→ "Featured"). */
  featured?: boolean;
}

/** One labeled display section: a stable key (for React lists + page-stitching)
 *  plus its label and the templates assigned to it (in their incoming order). */
export interface TemplateGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/** Page size for the template galleries. With 50 or fewer templates everything
 *  fits on a single page (no pager). Past 50 the two lowest-priority sections
 *  ("Block templates", "Industry templates") spill onto later pages. */
export const TEMPLATE_PAGE_SIZE = 50;

/**
 * Group filtered+sorted templates into the ordered display sections:
 *
 *   1. Featured                    — the tenant's starred templates
 *   2. Your templates              — the tenant's own (non-global) templates
 *   3. Platform Homepage templates — superadmin homepage-default templates
 *   4. Full page templates         — standalone full-page templates
 *   5. Block templates             — global starters not in any bucket above/below
 *   6. Industry templates          — global starters with a real industry tag (LAST)
 *
 * Every template lands in exactly ONE section — the first it matches in the
 * priority order above. Industry-tagged globals are pulled out before the
 * "Block templates" catch-all so block-templates only holds generic untagged
 * starters. Empty sections are dropped. `homepageDefaultIds` may be null (still
 * loading) or empty (fetch failed) — in either case the Homepage section is
 * simply skipped and those templates fall through to their next matching bucket.
 */
export function buildTemplateGroups<T extends TemplateGroupShape>(
  templates: T[],
  homepageDefaultIds: Set<number> | null,
): TemplateGroup<T>[] {
  const featured: T[] = [];
  const yours: T[] = [];
  const homepage: T[] = [];
  const fullPage: T[] = [];
  const block: T[] = [];
  const industry: T[] = [];

  for (const t of templates) {
    if (t.featured) {
      featured.push(t);
    } else if (!t.isGlobal) {
      yours.push(t);
    } else if (homepageDefaultIds && homepageDefaultIds.has(t.id)) {
      homepage.push(t);
    } else if (t.fullPage) {
      fullPage.push(t);
    } else if (isIndustryTemplate(t)) {
      industry.push(t);
    } else {
      block.push(t);
    }
  }

  const groups: TemplateGroup<T>[] = [];
  if (featured.length) groups.push({ key: "featured", label: "Featured", items: featured });
  if (yours.length) groups.push({ key: "yours", label: "Your templates", items: yours });
  if (homepage.length) groups.push({ key: "homepage", label: "Platform Homepage templates", items: homepage });
  if (fullPage.length) groups.push({ key: "fullPage", label: "Full page templates", items: fullPage });
  if (block.length) groups.push({ key: "block", label: "Block templates", items: block });
  if (industry.length) groups.push({ key: "industry", label: "Industry templates", items: industry });
  return groups;
}

/** The grouped view of a single gallery page, returned by paginateTemplateGroups. */
export interface PaginatedTemplateGroups<T> {
  /** Sections present on THIS page, in order, with their per-page item slices.
   *  A section that spans a page boundary appears (continued) on each page. */
  groups: TemplateGroup<T>[];
  /** Total number of templates across every section (all pages). */
  total: number;
  /** Total page count (always >= 1). */
  totalPages: number;
  /** The resolved current page (clamped to [1, totalPages]). */
  page: number;
}

/**
 * Flatten the ordered sections into a single stream, slice out the requested
 * page, then re-group the slice back into sections so headers render per page
 * wherever a section starts or continues. The flattening preserves section
 * order, so the highest-priority sections fill page 1 first and the two
 * lowest-priority sections naturally overflow onto later pages once the total
 * exceeds the page size. `page` is clamped into range so an out-of-bounds page
 * (e.g. after a filter shrinks the list) resolves to the last valid page.
 */
export function paginateTemplateGroups<T>(
  groups: TemplateGroup<T>[],
  page: number,
  pageSize: number = TEMPLATE_PAGE_SIZE,
): PaginatedTemplateGroups<T> {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const resolved = Math.min(Math.max(1, page), totalPages);
  const start = (resolved - 1) * pageSize;
  const end = start + pageSize;

  const flat: { group: TemplateGroup<T>; item: T }[] = [];
  for (const g of groups) {
    for (const item of g.items) flat.push({ group: g, item });
  }
  const slice = flat.slice(start, end);

  const pageGroups: TemplateGroup<T>[] = [];
  for (const { group, item } of slice) {
    const last = pageGroups[pageGroups.length - 1];
    if (last && last.key === group.key) {
      last.items.push(item);
    } else {
      pageGroups.push({ key: group.key, label: group.label, items: [item] });
    }
  }

  return { groups: pageGroups, total, totalPages, page: resolved };
}
