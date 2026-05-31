/**
 * Per-host handling of the "Sent by [Tenant] for [Account]" provenance footer
 * in the published-page SNAPSHOT pipeline (task #635).
 *
 * Background — why this exists:
 *   The footer is a "you're still on our shared domain" signal. The LIVE page
 *   path (`GET /lp/page/:slug`) decides per request from the visitor's host:
 *   it shows ONLY on a personalized microsite served on the tenant's default
 *   shared host `<slug>.lpstudio.ai`, and is hidden on the tenant's own custom
 *   domain (and for the Dandy tenant).
 *
 *   The published snapshot, however, is rendered to HTML exactly ONCE (against
 *   a single fixed render host) and then copied to one R2 object per host the
 *   tenant owns. A tenant with BOTH a custom domain AND the shared subdomain
 *   would therefore get the SAME baked footer state on every host — wrong for
 *   at least one of them.
 *
 * Strategy: bake the snapshot in its MAXIMAL footer state (the prerender path
 * resolves provenance against the shared subdomain, so an eligible microsite
 * always has the `[data-lp-provenance]` band in the DOM) and then STRIP that
 * band per host for any host where the live rule says it must NOT appear.
 * Stripping is safe and idempotent; injection would require reconstructing the
 * SPA's exact markup + styling, so we deliberately bake-then-strip instead.
 */
import { isProtectedEnterpriseSlug } from "@workspace/plan-config";
import { extractWildcardSlug } from "./tenantHosts";

export interface ProvenanceFooterHostInput {
  /** lp_pages.account_id — non-null only for personalized microsites. */
  accountId: number | null;
  /** tenants.slug — used for the Dandy exclusion and shared-host matching. */
  tenantSlug: string | null;
  /** The host whose snapshot variant is being built (no scheme). */
  host: string;
}

/**
 * Mirror of the live-path provenance gate (resolveProvenance in tracking.ts),
 * but as a pure host decision for the snapshot layer. The footer is shown on a
 * given host iff ALL hold:
 *   1. the page is a personalized microsite (accountId present),
 *   2. the tenant is not the Dandy enterprise tenant (slug-gated, never by
 *      brand name), and
 *   3. the host is the tenant's default shared subdomain `<slug>.<wildcard
 *      base>` — any custom domain yields extractWildcardSlug === null → hidden.
 */
export function shouldShowProvenanceFooterOnHost(
  input: ProvenanceFooterHostInput,
): boolean {
  if (input.accountId == null) return false;
  const slug = (input.tenantSlug ?? "").toLowerCase();
  if (!slug) return false;
  if (isProtectedEnterpriseSlug(input.tenantSlug)) return false;
  const wildcardSlug = input.host ? extractWildcardSlug(input.host) : null;
  return wildcardSlug !== null && wildcardSlug === slug;
}

/**
 * Remove the `<div data-lp-provenance="1">…</div>` band from a rendered HTML
 * document. No-op when the band is absent. Uses balanced `<div>` matching so a
 * future change that nests a `<div>` inside the banner can't truncate the page.
 * Only the FIRST occurrence is removed — the SPA renders the banner exactly
 * once, but a stray duplicate would be a bug worth leaving visible rather than
 * silently swallowing the whole tail of the document.
 */
export function stripProvenanceFooter(html: string): string {
  const openRe = /<div\b[^>]*\bdata-lp-provenance\b[^>]*>/i;
  const open = openRe.exec(html);
  if (!open) return html;

  const start = open.index;
  const tagRe = /<(\/?)div\b[^>]*?>/gi;
  tagRe.lastIndex = start + open[0].length;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    if (m[1] === "/") {
      depth -= 1;
      if (depth === 0) {
        const end = m.index + m[0].length;
        return html.slice(0, start) + html.slice(end);
      }
    } else {
      depth += 1;
    }
  }
  // Unbalanced markup — leave the document untouched rather than risk
  // dropping everything after the opening tag.
  return html;
}

/**
 * Apply the per-host footer rule to a baked snapshot: keep the (maximally
 * baked) footer when this host should show it, strip it otherwise.
 */
export function applyProvenanceFooterForHost(
  html: string,
  input: ProvenanceFooterHostInput,
): string {
  return shouldShowProvenanceFooterOnHost(input) ? html : stripProvenanceFooter(html);
}
