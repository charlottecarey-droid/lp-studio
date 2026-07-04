// Dependency-free constants entry point. Safe to import from bundles (e.g. the
// api-server) that must NOT pull in the jspdf-heavy generators. The main "."
// entry re-exports these for client/PDF consumers.

export const TEMPLATE_VISIBILITY_KEY = "template_visibility";
export const DELETED_BUILTINS_KEY = "deleted_builtin_templates";

/**
 * Built-in one-pager templates that are too Dandy-coded to neutralize via
 * copy scrubbing alone, and so are hidden from the template picker for
 * non-Dandy tenants and rejected on the server publish/save paths.
 *
 * The former entries ("comparison" / "Evolution" and "agreement-summary")
 * were rewritten to be brand-agnostic — they derive their palette from the
 * tenant's one-pager colors (resolvePalette), route all copy through
 * scrubBrandDeep, and render a neutral/tenant header image instead of the
 * bundled Dandy scanner (resolveOnePagerAssets). Both are available to every
 * tenant alongside the other built-ins.
 *
 * "roi" (July 2026): gated because it is Dandy UNIT ECONOMICS, not just copy —
 * its headline metrics are computed from Dandy per-practice constants
 * (appointments/chair-hours/revenue per location) and its proof pillars are
 * real dental case studies with named customers and quotes. Scrubbing names
 * would leave fabricated numbers attributed to another brand; there is no
 * honest neutral default. Non-dental brands get the other four built-ins +
 * custom templates.
 */
export const DANDY_GATED_BUILTIN_IDS = ["roi"] as const satisfies readonly string[];
export type DandyGatedBuiltinId = (typeof DANDY_GATED_BUILTIN_IDS)[number];

/** True when the given built-in id is gated to Dandy-only tenants. */
export function isDandyGatedBuiltin(id: string | null | undefined): boolean {
  return !!id && (DANDY_GATED_BUILTIN_IDS as readonly string[]).includes(id);
}

/**
 * True when a sales layout-defaults storage key belongs to a Dandy-gated
 * built-in template. The editor persists layout state under keys shaped like
 * `dandy_<id>_template_layout`, where `<id>` is the built-in id with hyphens
 * replaced by underscores (e.g. `agreement-summary` → `agreement_summary`).
 * This parses the key back to its built-in id and reuses `isDandyGatedBuiltin`
 * so the server can reject non-Dandy writes to gated templates (defense in
 * depth behind the client gate).
 */
export function isDandyGatedLayoutKey(key: string | null | undefined): boolean {
  if (!key) return false;
  const m = /^dandy_(.+)_template_layout$/.exec(key);
  if (!m) return false;
  const builtinId = m[1].replace(/_/g, "-");
  return isDandyGatedBuiltin(builtinId);
}

/**
 * Canonical client-side Dandy brand check. Neutral/non-Dandy tenants ship
 * `brandName === ""`; the two Dandy workspaces (dandy, dandy-smb) share the
 * "Dandy" brand name, so this single check covers both.
 */
export function isDandyBrandName(brandName: string | null | undefined): boolean {
  return (brandName ?? "").trim().toLowerCase() === "dandy";
}
