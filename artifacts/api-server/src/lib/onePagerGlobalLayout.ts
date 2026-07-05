/**
 * Global one-pager layout defaults are LAYOUT-ONLY (July 2026).
 *
 * sales_layout_defaults rows with tenant_id NULL are superadmin-managed
 * defaults every tenant inherits. The editor saves whole config objects that
 * mix LAYOUT knobs (spacing, offsets, font sizes, toggles) with CONTENT
 * (headlines, copy, stats, images, links). Content authored in the superadmin
 * editor is written under the OPERATOR's brand — letting it flow to tenants
 * republishes one brand's copy, survey stats, and product imagery under every
 * other brand (exactly the leak the July de-dental pass closed: Dandy's
 * 88/83/67% survey stats must never publish under another tenant's name).
 *
 * So every TENANT-FACING read of a GLOBAL row (GET /sales/layout-defaults,
 * its :key variant, and the web-one-pager partner fallback) passes the config
 * through this filter: known content-bearing keys are dropped, layout knobs
 * survive, and the generators fall back to their brand-aware content defaults.
 * Tenant-owned rows are served untouched — a tenant's own saved copy is theirs.
 * The superadmin endpoints also serve raw rows so the global editor
 * round-trips its own saves.
 *
 * Global CONTENT distribution is a different feature with an explicit surface:
 * global custom templates (sales_one_pager_templates, tenant_id NULL).
 */

/** Top-level keys that carry content (copy, stats, images, links). */
const CONTENT_KEYS = new Set([
  // pilot
  "audienceContent",
  "audienceHeaderImages",
  // comparison
  "comparisonRows",
  "stats",
  // partner
  "partnerHeadline",
  "partnerTestimonialsHeading",
  "partnerIntro",
  "partnerFeatures",
  "partnerStats",
  "partnerQrUrl",
  // agreement summary (flat config)
  "headline",
  "subheadline",
  "footer",
  "sections",
  "footerContacts",
  "footerLinkText",
  "footerLinkUrl",
  "headerImage",
]);

/** Content keys nested inside otherwise-layout sub-configs. */
const NESTED_CONTENT_KEYS: Record<string, Set<string>> = {
  headerCfg: new Set(["titleText", "subtitleText", "headerImage"]),
  bodyCfg: new Set(["headlineText", "checklistHeadingText", "quoteText"]),
  footerCfg: new Set(["link"]),
};

/**
 * Return a copy of a GLOBAL layout-default config with content-bearing keys
 * removed. Non-object inputs are returned as-is.
 */
export function stripContentFromGlobalLayoutConfig(config: unknown): unknown {
  if (config === null || typeof config !== "object" || Array.isArray(config)) return config;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
    if (CONTENT_KEYS.has(key)) continue;
    const nested = NESTED_CONTENT_KEYS[key];
    if (nested && value !== null && typeof value === "object" && !Array.isArray(value)) {
      out[key] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).filter(([k]) => !nested.has(k)),
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}
