/**
 * Pure robots-meta resolution — task #494.
 *
 * Tenant-level defaults (stored in `tenants.settings.seo`) set the
 * account-wide allow/deny for search-engine + LLM indexing and link
 * following. Each page may override either axis with a tri-state column on
 * `lp_pages`:
 *   - null / undefined → inherit the tenant default
 *   - true             → force allow
 *   - false            → force deny
 *
 * No I/O, no DOM, no React — shared verbatim by the prerender path
 * (api-server `injectPageMeta`) and the SPA viewer (lp-studio
 * `landing-page-viewer`) so the published file and the in-app preview can
 * never disagree about which robots directive a page carries.
 */

/** Per-page override: null/undefined = inherit, true = allow, false = deny. */
export type RobotsOverride = boolean | null | undefined;

export interface ResolveRobotsInput {
  /** lp_pages.allow_indexing — tri-state override. */
  pageAllowIndexing: RobotsOverride;
  /** lp_pages.allow_following — tri-state override. */
  pageAllowFollowing: RobotsOverride;
  /** Resolved tenant default for indexing (tenants.settings.seo.allowIndexing). */
  tenantAllowIndexing: boolean;
  /** Resolved tenant default for following (tenants.settings.seo.allowFollowing). */
  tenantAllowFollowing: boolean;
}

export interface ResolvedRobots {
  /** Effective indexing decision after applying any page override. */
  indexing: boolean;
  /** Effective following decision after applying any page override. */
  following: boolean;
  /** Where the indexing decision came from — for structured logging. */
  indexingSource: "page" | "tenant";
  /** Where the following decision came from — for structured logging. */
  followingSource: "page" | "tenant";
}

/**
 * Resolve the effective robots decision for a page. A page override only
 * applies when it is an explicit boolean; null/undefined falls through to
 * the tenant default. The two axes resolve independently.
 */
export function resolveRobotsMeta(input: ResolveRobotsInput): ResolvedRobots {
  const indexingOverridden =
    input.pageAllowIndexing === true || input.pageAllowIndexing === false;
  const followingOverridden =
    input.pageAllowFollowing === true || input.pageAllowFollowing === false;
  return {
    indexing: indexingOverridden
      ? (input.pageAllowIndexing as boolean)
      : input.tenantAllowIndexing,
    following: followingOverridden
      ? (input.pageAllowFollowing as boolean)
      : input.tenantAllowFollowing,
    indexingSource: indexingOverridden ? "page" : "tenant",
    followingSource: followingOverridden ? "page" : "tenant",
  };
}

/**
 * Build the `content` value for `<meta name="robots">` from a resolved pair.
 *
 * Returns `null` when BOTH axes are "allow" — the implicit search-engine
 * default — so the caller emits NO tag (never the redundant `index,follow`).
 * This is what keeps already-allowed pages byte-identical to their
 * pre-feature output. When at least one axis is deny, only the negative
 * directive(s) are emitted (`noindex`, `nofollow`, or `noindex,nofollow`);
 * the positive default is left implicit.
 */
export function robotsMetaContent(resolved: {
  indexing: boolean;
  following: boolean;
}): string | null {
  const parts: string[] = [];
  if (!resolved.indexing) parts.push("noindex");
  if (!resolved.following) parts.push("nofollow");
  return parts.length > 0 ? parts.join(",") : null;
}
