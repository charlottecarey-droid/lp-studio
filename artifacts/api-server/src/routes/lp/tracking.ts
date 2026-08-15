import { Router } from "express";
import { randomBytes } from "crypto";
import { db, pool, tenantsTable, salesAccountsTable } from "@workspace/db";
import { lpEventsTable, lpSessionsTable, lpVariantsTable, lpTestsTable, lpPagesTable, lpPageVisitsTable, lpPageReviewsTable, salesHotlinksTable } from "@workspace/db";
import { resolveRobotsContentForPage } from "../../lib/resolveRobots";
import { resolvePageOG, resolveOGFields, substitutePageTitleToken, deriveOgCardCopy, deriveHeroImage, toPlainCardText, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from "../../lib/resolvePageOG";
import { isProtectedEnterpriseSlug } from "@workspace/plan-config";
import { TrackEventBody, GetPageConfigParams, GetPageConfigQueryParams } from "@workspace/api-zod";
import { eq, and, sql } from "drizzle-orm";
import type { LpVariant } from "@workspace/db";
import type { Request } from "express";
import { getClientIp, lookupGeoAsync } from "../../lib/geo";
import { rateLimit, envLimit } from "../../lib/rateLimit";
import { revealAccountName } from "../../lib/apollo-reveal";
import { findTenantByHost, getActiveHostsForTenant, extractWildcardSlug } from "../../lib/tenantHosts";
import { getRequestHost } from "../../lib/requestHost";
import { SESSION_COOKIE, optionalAuth, type AuthUser } from "../../middleware/requireAuth";
import { hydrateCustomSchemaBlocks } from "./hydrate-custom-schema";

/**
 * Resolve tenant id for a public, slug-based request from the request host.
 * Returns null if no tenant is mapped to that host. Page lookups by slug must
 * always be scoped by tenant — slugs are unique only per (tenant_id, slug).
 */
/**
 * Resolve the tenant a page request belongs to. HOST-FIRST — public visitors
 * on a tenant-bound host (custom domain, microsite domain, wildcard
 * subdomain) resolve exactly as before, and responses stay CDN-cacheable.
 *
 * SESSION FALLBACK (July 2026): when the host pins no tenant (the admin app
 * host, a dev webview, localhost), fall back to the authenticated session's
 * tenant — this is what lets "View page" open on the CURRENT origin for
 * editors and tenant-switched superadmins whose canonical tenant host is
 * unreachable or differs from where they're working. Anonymous visitors on
 * unbound hosts still resolve to nothing (404), so nothing new is exposed.
 * `viaSession` responses must never be publicly cached (same URL, different
 * tenant per session) and must not record analytics visits (an editor
 * checking their own page is not a visitor).
 */
async function resolveTenantIdFromRequest(
  req: Request,
): Promise<{ tenantId: number | null; viaSession: boolean }> {
  const host = getRequestHost(req);
  if (host) {
    const match = await findTenantByHost(host);
    if (match?.tenantId != null) return { tenantId: match.tenantId, viaSession: false };
  }
  const authedTenantId =
    (req as { authUser?: { tenantId?: number | null } }).authUser?.tenantId ?? null;
  return { tenantId: authedTenantId, viaSession: authedTenantId != null };
}

/**
 * Task #547/#633 — resolve the visible provenance line for a published
 * microsite: "Sent by [Tenant Name] for [Target Account]".
 *
 * The footer is a "you're still on our shared domain" signal. Task #633
 * domain-gates it (no longer plan-gated): it renders ONLY when ALL of the
 * following hold —
 *   1. The page is a personalized microsite, i.e. it is linked to a target
 *      account (`accountId` present). Regular landing pages never show it.
 *   2. The page is being served on the tenant's default shared host
 *      (`<slug>.lpstudio.ai`), NOT on the tenant's own custom domain. This is
 *      decided from the `activeHost` at render time via the same wildcard-
 *      subdomain matching used everywhere else — no stored plan / domain-status
 *      flag is consulted.
 *
 * The existing Dandy slug exclusion stays as a safety net (host-based gating
 * already hides it anyway, since Dandy pages serve on their own custom domain).
 *
 * `activeHost` is the request host on the live page path, and the tenant's
 * canonical published host on the preview/prerender path (so the editor preview
 * and the static R2 snapshot reflect what visitors on the published host see,
 * not the admin / fixed render host).
 *
 * Returns null when no provenance should be shown. Failures are non-fatal:
 * provenance is a legitimacy signal, not a security control, so we degrade
 * silently rather than block the page.
 */
async function resolveProvenance(
  page: {
    accountId: number | null;
    tenantId: number;
  },
  activeHost: string | null,
): Promise<{ tenantName: string; accountName: string | null } | null> {
  try {
    // (1) Regular landing pages (no target account) never show the footer.
    if (page.accountId == null) return null;

    const [tenantRow] = await db
      .select({ slug: tenantsTable.slug, name: tenantsTable.name })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, page.tenantId));
    if (!tenantRow) return null;
    if (isProtectedEnterpriseSlug(tenantRow.slug)) return null;

    // (2) Domain gate — only on the default shared host `<slug>.lpstudio.ai`.
    // extractWildcardSlug returns the subdomain only for the wildcard base
    // hosts we control; any custom domain yields null (→ no footer).
    const wildcardSlug = activeHost ? extractWildcardSlug(activeHost) : null;
    if (wildcardSlug === null || wildcardSlug !== tenantRow.slug.toLowerCase()) {
      return null;
    }

    // Tenant-scoped lookup — never resolve another tenant's account name.
    const [account] = await db
      .select({
        name: salesAccountsTable.name,
        displayName: salesAccountsTable.displayName,
      })
      .from(salesAccountsTable)
      .where(
        and(
          eq(salesAccountsTable.id, page.accountId),
          eq(salesAccountsTable.tenantId, page.tenantId),
        ),
      );
    const accountName = account?.displayName || account?.name || null;

    return { tenantName: tenantRow.name, accountName };
  } catch (err) {
    console.warn("[tracking] provenance lookup failed; omitting", {
      tenantId: page.tenantId,
      err,
    });
    return null;
  }
}

/**
 * Task #633 — the host the provenance gate should evaluate for the
 * preview/prerender path. The in-builder preview is served on the admin host
 * and the prerender snapshot is rendered against a single fixed render host
 * (LP_STUDIO_RENDER_BASE_URL), neither of which is the page's published host.
 * Both must instead reflect the tenant's canonical published host so the
 * footer matches what a visitor sees on the live published page.
 *
 * getActiveHostsForTenant returns the tenant's hosts in priority order
 * (custom domain → microsite domain → `<slug>.<wildcard base>`), so [0] is the
 * canonical published host: a custom domain when the tenant has one (→ footer
 * hidden), otherwise the shared `<slug>.lpstudio.ai` subdomain (→ footer shown).
 */
async function resolveCanonicalPublishedHost(tenantId: number): Promise<string | null> {
  try {
    const hosts = await getActiveHostsForTenant(tenantId);
    return hosts[0] ?? null;
  } catch (err) {
    console.warn("[tracking] canonical host lookup failed; omitting provenance", {
      tenantId,
      err,
    });
    return null;
  }
}

/**
 * Task #635 — the host the provenance gate should evaluate for the PRERENDER
 * snapshot specifically. Unlike the in-builder editor preview (which mirrors
 * what a visitor sees on the canonical published host), the static snapshot is
 * rendered ONCE and then copied to one R2 object per host the tenant owns. For
 * a tenant with BOTH a custom domain AND the shared subdomain, baking against
 * the canonical (custom) host would hide the footer on the shared-domain
 * snapshot too, where the live rule says it must appear.
 *
 * So the prerender bakes the snapshot in its MAXIMAL footer state by gating
 * provenance on the tenant's shared subdomain (`<slug>.<wildcard base>`) — the
 * one host where an eligible microsite shows the footer. triggerPublishedRender
 * then strips the band per host for any host that must not show it. Returns the
 * first active wildcard-subdomain host, or null when the tenant has none.
 */
async function resolveSharedPublishedHost(tenantId: number): Promise<string | null> {
  try {
    const hosts = await getActiveHostsForTenant(tenantId);
    return hosts.find((h) => extractWildcardSlug(h) !== null) ?? null;
  } catch (err) {
    console.warn("[tracking] shared host lookup failed; omitting provenance", {
      tenantId,
      err,
    });
    return null;
  }
}

/** Extract UTM parameters from the request query string */
function extractUtm(req: Request): {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
} {
  const qs = req.query;
  return {
    utmSource: typeof qs.utm_source === "string" && qs.utm_source ? qs.utm_source : null,
    utmMedium: typeof qs.utm_medium === "string" && qs.utm_medium ? qs.utm_medium : null,
    utmCampaign: typeof qs.utm_campaign === "string" && qs.utm_campaign ? qs.utm_campaign : null,
    utmTerm: typeof qs.utm_term === "string" && qs.utm_term ? qs.utm_term : null,
    utmContent: typeof qs.utm_content === "string" && qs.utm_content ? qs.utm_content : null,
  };
}
import {
  collectFeatures,
  pickVariantThompson,
  recordImpression,
  recordConversion,
  type VisitorFeatures,
} from "../../lib/smart-traffic";

function applyBlockOverrides(blocks: unknown[], blockOverrides: Record<string, unknown>): unknown[] {
  if (!blockOverrides || Object.keys(blockOverrides).length === 0) return blocks;
  return blocks.map((block) => {
    const b = block as Record<string, unknown>;
    if (typeof b.id === "string" && b.id in blockOverrides) {
      const overrideProps = blockOverrides[b.id];
      return { ...b, props: { ...(b.props as Record<string, unknown>), ...(overrideProps as Record<string, unknown>) } };
    }
    return block;
  });
}

async function enrichVariantWithPage(variant: LpVariant) {
  if (variant.builderPageId != null) {
    const [linkedPage] = await db
      .select()
      .from(lpPagesTable)
      .where(eq(lpPagesTable.id, variant.builderPageId));
    if (linkedPage) {
      let blocks: unknown = linkedPage.blocks;
      try {
        blocks = await hydrateCustomSchemaBlocks(linkedPage.blocks, linkedPage.tenantId);
      } catch (err) {
        console.warn("hydrateCustomSchemaBlocks failed for variant page", linkedPage.id, ":", err);
      }
      return {
        ...variant,
        linkedPage: {
          id: linkedPage.id,
          title: linkedPage.title,
          slug: linkedPage.slug,
          blocks,
          customCss: linkedPage.customCss ?? "",
          animationsEnabled: linkedPage.animationsEnabled !== false,
          smoothScroll: linkedPage.smoothScroll !== false,
          // Page-level cookie-banner opt-in — the viewer calls
          // window.__lpConsent.showBanner() only when this is true.
          showCookieBanner: linkedPage.showCookieBanner === true,
          // Page-level default CTA, so the viewer's variant render can drive each
          // block's PRIMARY button from the Page CTA (matching the main path).
          ctaDefault: linkedPage.ctaDefault ?? null,
          // "Match style from URL" overrides — the viewer's variant branch
          // merges these into the brand (mergePageStyleOverrides).
          styleOverrides: linkedPage.styleOverrides ?? null,
          // Page-record variables flow to the viewer so per-page settings
          // (e.g. linked-form colour overrides under the reserved
          // `__linkedFormStyle` key) take effect at runtime.
          pageVariables: (linkedPage.pageVariables && typeof linkedPage.pageVariables === "object" && !Array.isArray(linkedPage.pageVariables))
            ? linkedPage.pageVariables as Record<string, string>
            : {},
        },
      };
    }
  }
  return variant;
}

async function enrichVariantWithBlockOverrides(variant: LpVariant, basePageId?: number | null) {
  const testedBlockId = variant.testedBlockId;
  if (!testedBlockId) return variant;
  const pageId = basePageId ?? variant.builderPageId;
  if (!pageId) return variant;
  const [page] = await db.select().from(lpPagesTable).where(eq(lpPagesTable.id, pageId));
  if (!page) return variant;
  const blockOverrides = variant.blockOverrides as Record<string, unknown> | null | undefined;
  const hasOverrides = blockOverrides && Object.keys(blockOverrides).length > 0;
  const mergedBlocks = hasOverrides
    ? applyBlockOverrides(page.blocks as unknown[], blockOverrides as Record<string, unknown>)
    : page.blocks as unknown[];
  let blocks: unknown = mergedBlocks;
  try {
    blocks = await hydrateCustomSchemaBlocks(mergedBlocks, page.tenantId);
  } catch (err) {
    console.warn("hydrateCustomSchemaBlocks failed for AB-test page", page.id, ":", err);
  }
  return {
    ...variant,
    linkedPage: {
      id: page.id,
      title: page.title,
      slug: page.slug,
      blocks,
      animationsEnabled: page.animationsEnabled !== false,
      smoothScroll: page.smoothScroll !== false,
      // Page-level default CTA, so AB-test variant renders also drive each
      // block's PRIMARY button from the Page CTA (matching the main path).
      ctaDefault: page.ctaDefault ?? null,
      // "Match style from URL" overrides ride along for the same reason.
      styleOverrides: page.styleOverrides ?? null,
      pageVariables: (page.pageVariables && typeof page.pageVariables === "object" && !Array.isArray(page.pageVariables))
        ? page.pageVariables as Record<string, string>
        : {},
    },
  };
}

const router = Router();

// Launch hardening (June 2026) — /lp/track is PUBLIC (LP_PUBLIC allowlist in
// routes/index.ts) and fires from every visitor pageview/CTA/conversion, so
// it gets a generous per-IP ceiling that a real page can't hit but a bot
// flood will. Override via RATE_LIMIT_TRACKING_PER_MIN.
const trackEventLimiter = rateLimit({
  name: "lp-track",
  windowMs: 60 * 1000,
  max: envLimit("RATE_LIMIT_TRACKING_PER_MIN", 500),
});

/**
 * Dwell beacon — time-on-page for analytics (Sales Pages view).
 *
 * The viewer's use-dwell-tracker hook reports the session's CUMULATIVE
 * tab-visible seconds (sendBeacon on hide/leave + periodic keepalive flush).
 * We MAX-merge onto the visit row(s) for this (page, session): cumulative
 * totals make replayed or out-of-order beacons harmless, and a missing visit
 * row (editor sessions, ancient sessions) is a silent no-op. Hand-validated
 * body instead of api-zod — the payload is three fields and public.
 */
router.post("/lp/track/dwell", trackEventLimiter, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as { pageId?: unknown; sessionId?: unknown; seconds?: unknown; hlToken?: unknown };
  const pageId = typeof body.pageId === "number" ? Math.floor(body.pageId) : NaN;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const secondsRaw = typeof body.seconds === "number" ? Math.floor(body.seconds) : NaN;
  const hlToken = typeof body.hlToken === "string" ? body.hlToken.trim() : "";
  if (!Number.isFinite(pageId) || pageId <= 0 || !sessionId || sessionId.length > 128 || !Number.isFinite(secondsRaw) || secondsRaw < 1) {
    res.status(400).json({ error: "Invalid dwell payload" });
    return;
  }
  // Server-side cap mirrors the client's: a tab open overnight (or a hostile
  // payload) can never poison averages.
  const seconds = Math.min(secondsRaw, 1800);
  try {
    // Hotlink attribution: the viewer forwards the raw ?hl= token with each
    // dwell flush. The client's numeric hotlinkId is never trusted — we
    // re-resolve the (unguessable, unique) token here and only stamp it when
    // the hotlink actually points at the page being reported. Riding on the
    // repeating dwell beacon (rather than a one-shot call) makes attribution
    // immune to the race with the fire-and-forget visit insert in the page
    // config handler: if the visit row doesn't exist yet, a later flush
    // stamps it. COALESCE keeps the first attribution — a session can't be
    // re-attributed to a different contact by replaying another token.
    let hotlinkId: number | null = null;
    if (hlToken && hlToken.length <= 64) {
      const [hl] = await db
        .select({ id: salesHotlinksTable.id, pageId: salesHotlinksTable.pageId })
        .from(salesHotlinksTable)
        .where(eq(salesHotlinksTable.token, hlToken));
      if (hl && hl.pageId === pageId) hotlinkId = hl.id;
    }
    await db
      .update(lpPageVisitsTable)
      .set({
        dwellSeconds: sql`GREATEST(COALESCE(${lpPageVisitsTable.dwellSeconds}, 0), ${seconds})`,
        ...(hotlinkId != null
          ? { hotlinkId: sql`COALESCE(${lpPageVisitsTable.hotlinkId}, ${hotlinkId})` }
          : {}),
      })
      .where(and(eq(lpPageVisitsTable.pageId, pageId), eq(lpPageVisitsTable.sessionId, sessionId)));
    res.json({ ok: true });
  } catch (err) {
    console.warn("Error recording dwell for page", pageId, ":", err);
    res.status(500).json({ error: "Failed to record dwell" });
  }
});

router.post("/lp/track", trackEventLimiter, async (req, res): Promise<void> => {
  const parsed = TrackEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // testId / variantId are optional: builder pages without an active A/B test
  // emit conversions (form submits, chili piper bookings, etc.) that aren't
  // tied to any test row. Coerce missing values to null so the FK constraints
  // (now nullable) accept the row instead of 500ing on a phantom test_id=0.
  const [event] = await db.insert(lpEventsTable).values({
    sessionId: parsed.data.sessionId,
    testId: parsed.data.testId ?? null,
    variantId: parsed.data.variantId ?? null,
    eventType: parsed.data.eventType,
    conversionType: parsed.data.conversionType ?? null,
    // Page + form attribution. Both nullable in lp_events so callers
    // that don't know either (legacy CTAs, impressions) keep working.
    // The Marketo ghost-submit telemetry POSTs from BlockForm always
    // send these so the analytics drill-down can pinpoint which page
    // and form is silently dropping leads.
    pageId: parsed.data.pageId ?? null,
    formId: parsed.data.formId ?? null,
  }).returning();

  // Update smart traffic stats on conversion events (fire-and-forget). Smart
  // traffic only applies when both a test AND a variant are attributed —
  // standalone-page conversions can't update per-variant stats.
  if (
    parsed.data.eventType === "conversion" &&
    parsed.data.testId != null &&
    parsed.data.variantId != null
  ) {
    const testId = parsed.data.testId;
    const variantId = parsed.data.variantId;
    (async () => {
      try {
        // Look up the session to get features
        const [session] = await db
          .select()
          .from(lpSessionsTable)
          .where(and(
            eq(lpSessionsTable.sessionId, parsed.data.sessionId),
            eq(lpSessionsTable.testId, testId),
          ));
        if (session) {
          const features = (session.features ?? {}) as VisitorFeatures;
          // Only record if features exist (session was created with smart traffic)
          if (features.device) {
            await recordConversion(testId, variantId, features);
          }
        }
      } catch (err) {
        // Log error but don't fail — smart traffic stats are best-effort
        console.warn("Error recording conversion for smart traffic (test", testId, "):", err);
      }
    })();
  }

  res.json({ success: true, eventId: event.id });
});

// ─── Social media / bot OG preview endpoint ─────────────────────────────────
// Serves a minimal HTML shell with correct OG tags so social media scrapers,
// Slack, Telegram, etc. see per-page metadata instead of the LP Studio fallback.
// Usage: route bot user-agents (e.g. via Cloudflare Worker) from /lp/:slug to
//        /api/lp/og-preview/:slug and let regular browsers continue to the SPA.

const SOCIAL_BOT_UA = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Googlebot|Applebot|Discordbot|redditbot|pinterest/i;

router.get("/lp/og-preview/:slug", async (req, res): Promise<void> => {
  const slug = req.params.slug?.trim();
  if (!slug) { res.status(400).send("Bad request"); return; }

  try {
    // Slugs are unique per (tenant_id, slug). Resolve the tenant from the
    // request host so we never serve another tenant's page metadata.
    const host = getRequestHost(req);
    if (!host) { res.status(404).send("Not found"); return; }
    const tenantMatch = await findTenantByHost(host);
    if (!tenantMatch) { res.status(404).send("Not found"); return; }
    const tenantId = tenantMatch.tenantId;

    const [page] = await db.select({
      id: lpPagesTable.id,
      status: lpPagesTable.status,
      allowIndexing: lpPagesTable.allowIndexing,
      allowFollowing: lpPagesTable.allowFollowing,
    }).from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.slug, slug)))
      .limit(1);

    // Only published pages are exposed on public endpoints. Drafts and
    // pages in pending_review must remain private (preview only).
    if (!page || page.status !== "published") {
      res.status(404).send("Not found");
      return;
    }

    // Task #547 — bot-facing HTML must carry the SAME robots directive as the
    // SPA/prerender paths: noindex by default for non-Dandy tenants. Emit both
    // the <meta> tag AND the X-Robots-Tag header so crawlers that only read the
    // header (and never parse the body) still honour it.
    const robots = await resolveRobotsContentForPage({
      allowIndexing: page.allowIndexing,
      allowFollowing: page.allowFollowing,
      tenantId,
    });
    if (robots) res.set("X-Robots-Tag", robots);

    // Task #999 — resolve OG via the single shared cascade (per-page meta →
    // tenant default_og_* w/ {{page_title}} → derived content → tenant name).
    // This is the SAME resolver the R2 prerender uses, so the bot path now
    // honours the tenant's brand-settings default share card as the fallback
    // instead of bare metaTitle||title||name with no image.
    const og = await resolvePageOG(page.id);
    const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || "https";
    const canonicalUrl = `${proto}://${host}/${slug}`;
    const pageTitle = og?.title || tenantMatch.tenantName;
    const pageDesc = og?.description || tenantMatch.tenantName;
    // Resolved image may be relative (e.g. /api/storage/...) — absolutise it
    // per request host so scrapers can fetch it.
    const pageImage = absolutiseOgImage(og?.image || "", proto, host);
    const imageWidth = og?.image ? OG_IMAGE_WIDTH : null;
    const imageHeight = og?.image ? OG_IMAGE_HEIGHT : null;

    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(pageTitle)}</title>
  ${robots ? `<meta name="robots" content="${escapeHtml(robots)}" />` : ""}
  <meta name="description" content="${escapeHtml(pageDesc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(pageDesc)}" />
  ${pageImage ? `<meta property="og:image" content="${escapeHtml(pageImage)}" />` : ""}
  ${pageImage ? `<meta property="og:image:secure_url" content="${escapeHtml(pageImage)}" />` : ""}
  ${pageImage && imageWidth ? `<meta property="og:image:width" content="${imageWidth}" />` : ""}
  ${pageImage && imageHeight ? `<meta property="og:image:height" content="${imageHeight}" />` : ""}
  <meta name="twitter:card" content="${pageImage ? "summary_large_image" : "summary"}" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(pageDesc)}" />
  ${pageImage ? `<meta name="twitter:image" content="${escapeHtml(pageImage)}" />` : ""}
  <meta http-equiv="refresh" content="0; url=${escapeHtml(canonicalUrl)}" />
</head>
<body>
  <a href="${escapeHtml(canonicalUrl)}">${escapeHtml(pageTitle)}</a>
</body>
</html>`);
  } catch (err) {
    console.error("OG preview error:", err);
    res.status(500).send("Internal server error");
  }
});

/**
 * Task #999 — host-level OG preview (no slug). Serves the tenant's
 * brand-settings default share card for scrapers hitting a tenant/Dandy host's
 * root or an app-shell route where there is no page slug. Without this, a bot
 * scraping `ent.meetdandy.com` / `partners.meetdandy.com` root would fall
 * through the edge worker to the tenant SPA shell and read a bare "Landing Page
 * Studio" title. lpstudio.ai hosts never reach here (the worker passes them
 * straight through to the marketing origin).
 *
 * Cascade: tenant default_og_* ({{page_title}} → tenant name) → tenant name.
 * Robots: the host root is not a page, so we resolve the tenant's inherit
 * default (noindex for non-Dandy, fail-closed) via the shared resolver.
 */
router.get("/lp/og-host-preview", async (req, res): Promise<void> => {
  try {
    const host = getRequestHost(req);
    if (!host) { res.status(404).send("Not found"); return; }
    const tenantMatch = await findTenantByHost(host);
    if (!tenantMatch) { res.status(404).send("Not found"); return; }
    const tenantId = tenantMatch.tenantId;
    const tenantName = tenantMatch.tenantName;

    const [tenantRow] = await db.select({
      defaultOgTitle: tenantsTable.defaultOgTitle,
      defaultOgDescription: tenantsTable.defaultOgDescription,
      defaultOgImageUrl: tenantsTable.defaultOgImageUrl,
    }).from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId))
      .limit(1);

    const rawTitle = (tenantRow?.defaultOgTitle ?? "").trim();
    // {{page_title}} has no page at host level — substitute the tenant name so a
    // template like "{{page_title}} | Brand" still reads sensibly.
    const title =
      (rawTitle ? substitutePageTitleToken(rawTitle, tenantName).trim() : "") ||
      tenantName;
    const desc = (tenantRow?.defaultOgDescription ?? "").trim() || tenantName;

    const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || "https";
    const image = absolutiseOgImage((tenantRow?.defaultOgImageUrl ?? "").trim(), proto, host);
    const canonicalUrl = `${proto}://${host}/`;

    // Host root is not a page → resolve the tenant's inherit robots default.
    const robots = await resolveRobotsContentForPage({
      allowIndexing: null,
      allowFollowing: null,
      tenantId,
    });
    if (robots) res.set("X-Robots-Tag", robots);

    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  ${robots ? `<meta name="robots" content="${escapeHtml(robots)}" />` : ""}
  <meta name="description" content="${escapeHtml(desc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(desc)}" />
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ""}
  ${image ? `<meta property="og:image:secure_url" content="${escapeHtml(image)}" />` : ""}
  ${image ? `<meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />` : ""}
  ${image ? `<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />` : ""}
  <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(desc)}" />
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ""}
</head>
<body>
  <a href="${escapeHtml(canonicalUrl)}">${escapeHtml(title)}</a>
</body>
</html>`);
  } catch (err) {
    console.error("OG host preview error:", err);
    res.status(500).send("Internal server error");
  }
});

/** Absolutise a possibly-relative OG image URL against the request host so
 *  scrapers (which never run the SPA) can fetch it. Leaves absolute URLs and
 *  empty strings untouched. */
function absolutiseOgImage(image: string, proto: string, host: string): string {
  const v = image.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v) || v.startsWith("data:")) return v;
  if (v.startsWith("/")) return `${proto}://${host}${v}`;
  return v;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// optionalAuth: this route is public (anonymous visitors on tenant hosts),
// but on hosts that pin no tenant the resolver falls back to the caller's
// session tenant — optionalAuth hydrates req.authUser so that fallback works.
router.get("/lp/page/:slug", optionalAuth, async (req, res): Promise<void> => {
  const params = GetPageConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const queryParsed = GetPageConfigQueryParams.safeParse(req.query);
  const sessionId = queryParsed.success && queryParsed.data.sessionId
    ? queryParsed.data.sessionId
    : `anon-${Date.now()}-${randomBytes(8).toString("base64url")}`;

  // Preview mode: bypass session assignment, no tracking
  const previewVariantId = req.query.previewVariantId
    ? parseInt(req.query.previewVariantId as string, 10)
    : undefined;

  const [test] = await db
    .select()
    .from(lpTestsTable)
    .where(eq(lpTestsTable.slug, params.data.slug));

  if (!test) {
    // Check if it's a builder page — slugs are unique only per (tenant_id, slug),
    // so we must scope the lookup by the host's tenant (or, on hosts that pin
    // no tenant, the authenticated session's tenant — see the resolver).
    const { tenantId, viaSession } = await resolveTenantIdFromRequest(req);
    if (tenantId == null) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    const [builderPage] = await db
      .select()
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.slug, params.data.slug)));

    if (builderPage) {
      // Only published pages may be served from a tenant-mapped public host.
      // We're inside this branch only when the request host resolved to a
      // tenant via findTenantByHost — i.e. the visitor is on a public-facing
      // domain (microsite-only OR tenant-locked custom domain). The previous
      // implementation hardcoded "partners.meetdandy.com" which leaked drafts
      // on lp.meetdandy.com, custom tenant domains, and *.lpstudio.ai
      // wildcard subdomains. Pages in draft or pending_review must remain
      // private — authenticated tenant members and review-token holders
      // should use /api/lp/preview/:slug instead.
      if (builderPage.status !== "published") {
        res.status(404).json({ error: "Page not found" });
        return;
      }

      // Record a geo-tagged visit for builder pages (fire-and-forget).
      // Session-resolved views are editors/superadmins checking their own
      // page from the app host — not visitors; keep them out of analytics.
      if (!viaSession) {
        const clientIp = getClientIp(req);
        const utm = extractUtm(req);
        lookupGeoAsync(clientIp)
          .then((geo) =>
            db.insert(lpPageVisitsTable).values({
              pageId: builderPage.id,
              sessionId,
              ...geo,
              ...utm,
            }).onConflictDoNothing()
          )
          .catch((err) => {
            console.warn("Error recording page visit for page", builderPage.id, ":", err);
          });
      }

      // Cache published pages at the HTTP layer — browsers and CDNs can reuse
      // the response for 60 s. Draft pages are never cached so editors see changes immediately.
      // ETag/conditional-GET is disabled globally in app.ts so this response
      // is never returned as a 304 with an empty body (which would crash the
      // viewer client — see app.ts comment).
      if (viaSession) {
        // Same URL resolves to a DIFFERENT tenant per session on unbound
        // hosts — a shared/CDN cache entry here would leak one tenant's page
        // to another tenant's editors (or to anonymous 404s). Never cache.
        res.set("Cache-Control", "private, no-store");
      } else if (builderPage.status === "published" && !previewVariantId) {
        // Browser caches for 60 s (returning visitors get instant loads),
        // CDN/edge caches for 5 min (s-maxage), and serves a stale
        // response for up to 24 h while revalidating in the background.
        // The long SWR window is the key reliability lever: during a brief
        // API outage or a deploy, the edge keeps serving the last good
        // JSON so visitors never see "Page Not Found" or the
        // "something went wrong" fallback. ETag/conditional-GET is
        // disabled globally in app.ts so 304s can't return empty bodies.
        res.set(
          "Cache-Control",
          "public, max-age=60, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400",
        );
      } else {
        res.set("Cache-Control", "no-store");
      }

      // Hydrate custom-schema blocks with the live schema/template from the
      // tenant's lp_custom_blocks rows (task #120). Public viewers can't
      // fetch /api/lp/custom-blocks themselves (auth-protected), so the
      // server stamps the latest values on the response. Failures fall back
      // to whatever is stored on the page block itself.
      let hydratedBlocks: unknown = builderPage.blocks;
      try {
        hydratedBlocks = await hydrateCustomSchemaBlocks(builderPage.blocks, builderPage.tenantId);
      } catch (err) {
        console.warn("hydrateCustomSchemaBlocks failed for page", builderPage.id, ":", err);
      }

      // Apollo IP reveal — only called when the page uses {{accountNameApollo}}
      // so pages without the placeholder have zero extra latency.
      const blocksJson = JSON.stringify(hydratedBlocks ?? []);
      const needsApollo = blocksJson.includes("{{accountNameApollo}}");
      const accountNameApollo = needsApollo
        ? await revealAccountName(getClientIp(req))
        : "";

      // Pages with Apollo personalization must not be cached at the CDN layer
      // because the response differs per visitor IP.
      if (needsApollo) {
        res.set("Cache-Control", "no-store");
      }

      // Task #494/#547 — resolved robots directive so the SPA viewer matches
      // the prerendered static HTML. null = fully allowed (viewer emits no tag).
      const robots = await resolveRobotsContentForPage(builderPage);

      // Task #547/#633 — provenance line ("Sent by [Tenant] for [Account]"),
      // shown only on a personalized microsite served on the default shared
      // host. Gated on the live visitor's request host. null = render nothing.
      const provenance = await resolveProvenance(builderPage, getRequestHost(req));

      res.json({
        pageType: "builder",
        id: builderPage.id,
        title: builderPage.title,
        slug: builderPage.slug,
        blocks: hydratedBlocks,
        status: builderPage.status,
        customCss: builderPage.customCss ?? "",
        animationsEnabled: builderPage.animationsEnabled,
        smoothScroll: builderPage.smoothScroll,
        metaTitle: builderPage.metaTitle || "",
        metaDescription: builderPage.metaDescription || "",
        ogImage: builderPage.ogImage || "",
        robots,
        provenance,
        accountNameApollo,
        // Page-level default CTA + "Match style from URL" overrides. The
        // viewer applies both (pageCta prop / mergePageStyleOverrides) but
        // they were omitted here, so published pages silently rendered
        // without them while the builder canvas showed them.
        ctaDefault: builderPage.ctaDefault ?? null,
        styleOverrides: builderPage.styleOverrides ?? null,
        pageVariables: (builderPage.pageVariables && typeof builderPage.pageVariables === "object" && !Array.isArray(builderPage.pageVariables))
          ? builderPage.pageVariables as Record<string, string>
          : {},
      });
      return;
    }

    res.status(404).json({ error: "Page not found" });
    return;
  }

  const variants = await db
    .select()
    .from(lpVariantsTable)
    .where(eq(lpVariantsTable.testId, test.id));

  if (variants.length === 0) {
    res.status(404).json({ error: "No variants configured" });
    return;
  }

  // Find the base page for block-level tests (from the control variant's builderPageId)
  const controlVariant = variants.find(v => v.isControl);
  const basePageId = controlVariant?.builderPageId ?? null;

  async function enrichVariant(variant: LpVariant) {
    if (variant.testedBlockId) {
      return enrichVariantWithBlockOverrides(variant, basePageId);
    }
    return enrichVariantWithPage(variant);
  }

  // Preview mode: return the requested variant without session assignment
  if (previewVariantId) {
    const previewVariant = variants.find(v => v.id === previewVariantId);
    if (previewVariant) {
      const enriched = await enrichVariant(previewVariant);
      res.set("Cache-Control", "no-store");
      res.json({
        testId: test.id,
        slug: test.slug,
        testName: test.name,
        sessionId: `preview-${previewVariantId}`,
        assignedVariant: enriched,
        status: test.status,
        isPreview: true,
      });
      return;
    }
  }

  // Check if this session already has a variant assignment
  const [existingSession] = await db
    .select()
    .from(lpSessionsTable)
    .where(and(
      eq(lpSessionsTable.sessionId, sessionId),
      eq(lpSessionsTable.testId, test.id),
    ));

  let assignedVariant: LpVariant | undefined;

  if (existingSession) {
    assignedVariant = variants.find(v => v.id === existingSession.variantId);
  }

  if (!assignedVariant) {
    const geo = await lookupGeoAsync(getClientIp(req));
    const features = collectFeatures(req, geo.countryCode);

    // Smart Traffic: use Thompson Sampling when enabled
    if (test.smartTrafficEnabled) {
      const variantIds = variants.map(v => v.id);
      const smartPick = await pickVariantThompson(
        test.id,
        variantIds,
        features,
        test.smartTrafficMinSamples,
      );
      if (smartPick !== null) {
        assignedVariant = variants.find(v => v.id === smartPick);
      }
    }

    // Fallback: weighted random assignment based on trafficWeight
    if (!assignedVariant) {
      const totalWeight = variants.reduce((sum, v) => sum + v.trafficWeight, 0);
      let rand = (randomBytes(4).readUInt32BE(0) / 0x100000000) * totalWeight;
      for (const variant of variants) {
        rand -= variant.trafficWeight;
        if (rand <= 0) {
          assignedVariant = variant;
          break;
        }
      }
      if (!assignedVariant) assignedVariant = variants[0];
    }

    // Store session assignment with geo + features + UTM
    const utmParams = extractUtm(req);
    await db.insert(lpSessionsTable).values({
      sessionId,
      testId: test.id,
      variantId: assignedVariant.id,
      ...geo,
      features,
      ...utmParams,
    }).onConflictDoNothing();

    // Record impression for smart traffic stats (fire-and-forget)
    if (test.smartTrafficEnabled) {
      recordImpression(test.id, assignedVariant.id, features).catch(() => {});
    }
  }

  const enrichedVariant = await enrichVariant(assignedVariant!);

  // If the variant has no linked page, check if there's a builder page with this slug
  // This covers the case where a test was created on a builder page without linking variants
  const enrichedHasPage = "linkedPage" in enrichedVariant && enrichedVariant.linkedPage != null;
  let basePage: { id: number; title: string; slug: string; blocks: unknown; customCss: string | null; status: string; animationsEnabled: boolean; smoothScroll: boolean; pageVariables: unknown } | null = null;
  if (!enrichedHasPage) {
    const { tenantId } = await resolveTenantIdFromRequest(req);
    if (tenantId != null) {
      const [found] = await db
        .select()
        .from(lpPagesTable)
        .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.slug, params.data.slug)));
      if (found) basePage = found;
    }
  }

  if (basePage && !enrichedHasPage) {
    // Return as a builder page response with A/B tracking info embedded
    const blockOverrides = (enrichedVariant as LpVariant).blockOverrides as Record<string, unknown> | null | undefined;
    const hasOverrides = blockOverrides && Object.keys(blockOverrides).length > 0;
    const blocks = hasOverrides
      ? applyBlockOverrides(basePage.blocks as unknown[], blockOverrides as Record<string, unknown>)
      : basePage.blocks as unknown[];

    const utmForVisit = extractUtm(req);
    lookupGeoAsync(getClientIp(req))
      .then((geo) =>
        db.insert(lpPageVisitsTable).values({ pageId: basePage.id, sessionId, ...geo, ...utmForVisit }).onConflictDoNothing()
      )
      .catch((err) => {
        console.warn("Error recording A/B test page visit for page", basePage.id, ":", err);
      });

    // A/B test responses are session-personalised — never cache
    res.set("Cache-Control", "no-store");
    res.json({
      pageType: "builder",
      id: basePage.id,
      title: basePage.title,
      slug: basePage.slug,
      blocks,
      status: basePage.status,
      customCss: basePage.customCss ?? "",
      animationsEnabled: basePage.animationsEnabled !== false,
      smoothScroll: basePage.smoothScroll !== false,
      pageVariables: (basePage.pageVariables && typeof basePage.pageVariables === "object" && !Array.isArray(basePage.pageVariables))
        ? basePage.pageVariables as Record<string, string>
        : {},
      // Embed A/B test info for tracking
      testId: test.id,
      testName: test.name,
      sessionId,
      assignedVariant: enrichedVariant,
      testStatus: test.status,
    });
    return;
  }

  // A/B test variant response — session-personalised, never cache
  res.set("Cache-Control", "no-store");
  res.json({
    testId: test.id,
    slug: test.slug,
    testName: test.name,
    sessionId,
    assignedVariant: enrichedVariant,
    status: test.status,
  });
});

// ─── Preview endpoint ──────────────────────────────────────────────────────
// GET /api/lp/preview/:slug — auth/token-gated draft preview.
// Auth: lp_sid session scoped to page.tenantId, OR ?reviewToken= matching
// an lp_page_reviews row whose pageId === page.id. No tracking.

async function loadAuthUser(req: Request): Promise<AuthUser | null> {
  const sid = (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE];
  if (!sid) return null;
  try {
    const result = await pool.query<{ sess: string }>(
      `SELECT sess FROM app_sessions WHERE sid = $1 AND expire > now()`,
      [sid],
    );
    if (!result.rows.length) return null;
    return JSON.parse(result.rows[0].sess) as AuthUser;
  } catch {
    return null;
  }
}

router.get("/lp/preview/:slug", async (req, res): Promise<void> => {
  const slug = req.params.slug?.trim();
  if (!slug) { res.status(404).json({ error: "Page not found" }); return; }

  const reviewToken = typeof req.query.reviewToken === "string" ? req.query.reviewToken : null;

  let page: typeof lpPagesTable.$inferSelect | null = null;

  // Path 1: review token. Page-scoped via review.pageId === page.id.
  // Revocation = DELETE on lp_page_reviews row (no expires_at column).
  if (reviewToken) {
    const [review] = await db
      .select()
      .from(lpPageReviewsTable)
      .where(eq(lpPageReviewsTable.token, reviewToken));
    if (review) {
      const [byTokenPage] = await db
        .select()
        .from(lpPagesTable)
        .where(and(eq(lpPagesTable.id, review.pageId), eq(lpPagesTable.slug, slug)));
      if (byTokenPage) page = byTokenPage;
    }
  }

  // Path 2: session. Page lookup is scoped to user.tenantId; the request
  // host is ignored, so a tenant-A admin can never reach tenant B's pages.
  if (!page) {
    const user = await loadAuthUser(req);
    if (!user || user.tenantId == null) { res.status(404).json({ error: "Page not found" }); return; }

    const [byAuthPage] = await db
      .select()
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, user.tenantId), eq(lpPagesTable.slug, slug)));
    if (byAuthPage) page = byAuthPage;
  }

  if (!page) { res.status(404).json({ error: "Page not found" }); return; }

  // Preview responses are never cached — they're authenticated and the page
  // content can change as the editor saves between previews.
  res.set("Cache-Control", "no-store");
  let previewBlocks: unknown = page.blocks;
  try {
    previewBlocks = await hydrateCustomSchemaBlocks(page.blocks, page.tenantId);
  } catch (err) {
    console.warn("hydrateCustomSchemaBlocks failed for preview page", page.id, ":", err);
  }
  // Task #494/#547 — resolved robots directive so the in-builder preview
  // matches the published page. null = fully allowed (viewer emits no tag).
  const robots = await resolveRobotsContentForPage(page);
  // Task #547/#633/#635 — provenance line in preview so the editor (and the
  // prerender snapshot, which also renders through this route) sees what
  // visitors on the published page see.
  //
  // Editor preview: gated on the tenant's canonical published host (what a
  // visitor on the primary host sees), not the admin / fixed render host.
  //
  // Prerender snapshot (`?prerender=1`): gated on the tenant's SHARED subdomain
  // so the band is baked in its maximal state; triggerPublishedRender then
  // strips it per host for hosts that must not show it (task #635). This fixes
  // the shared-domain snapshot of a tenant that ALSO has a custom domain.
  // null = render nothing.
  const isPrerender = req.query.prerender === "1";
  const provenanceHost = isPrerender
    ? await resolveSharedPublishedHost(page.tenantId)
    : await resolveCanonicalPublishedHost(page.tenantId);
  const provenance = await resolveProvenance(page, provenanceHost);
  res.json({
    pageType: "builder",
    id: page.id,
    title: page.title,
    slug: page.slug,
    blocks: previewBlocks,
    status: page.status,
    customCss: page.customCss ?? "",
    animationsEnabled: page.animationsEnabled,
    smoothScroll: page.smoothScroll,
    metaTitle: page.metaTitle || "",
    metaDescription: page.metaDescription || "",
    ogImage: page.ogImage || "",
    robots,
    provenance,
    accountNameApollo: "",
    // Same fields the public route sends — the preview (and the prerender
    // snapshot, which renders through this route) must match the published
    // page's Page CTA + style-from-URL rendering.
    ctaDefault: page.ctaDefault ?? null,
    styleOverrides: page.styleOverrides ?? null,
    pageVariables: (page.pageVariables && typeof page.pageVariables === "object" && !Array.isArray(page.pageVariables))
      ? page.pageVariables as Record<string, string>
      : {},
    isPreview: true,
  });
});

/**
 * Data payload for the designed OG share card (`/og-card/:slug` in the SPA —
 * the page the headless capture screenshots instead of the live layout).
 * Auth is identical to /lp/preview above: a page-scoped review token, or the
 * caller's session tenant. Brand colors/logo/fonts are NOT here — the card
 * route loads them through the existing /lp/brand?slug&reviewToken path.
 */
router.get("/lp/og-card-data/:slug", async (req, res): Promise<void> => {
  const slug = req.params.slug?.trim();
  if (!slug) { res.status(404).json({ error: "Page not found" }); return; }
  const reviewToken = typeof req.query.reviewToken === "string" ? req.query.reviewToken : null;

  let page: typeof lpPagesTable.$inferSelect | null = null;
  if (reviewToken) {
    const [review] = await db
      .select()
      .from(lpPageReviewsTable)
      .where(eq(lpPageReviewsTable.token, reviewToken));
    if (review) {
      const [byTokenPage] = await db
        .select()
        .from(lpPagesTable)
        .where(and(eq(lpPagesTable.id, review.pageId), eq(lpPagesTable.slug, slug)));
      if (byTokenPage) page = byTokenPage;
    }
  }
  if (!page) {
    const user = await loadAuthUser(req);
    if (!user || user.tenantId == null) { res.status(404).json({ error: "Page not found" }); return; }
    const [byAuthPage] = await db
      .select()
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, user.tenantId), eq(lpPagesTable.slug, slug)));
    if (byAuthPage) page = byAuthPage;
  }
  if (!page) { res.status(404).json({ error: "Page not found" }); return; }

  res.set("Cache-Control", "no-store");
  const [tenant] = await db
    .select({
      name: tenantsTable.name,
      defaultOgTitle: tenantsTable.defaultOgTitle,
      defaultOgDescription: tenantsTable.defaultOgDescription,
    })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, page.tenantId))
    .limit(1);

  const copy = deriveOgCardCopy(page.blocks);
  const trim = (v: string | null | undefined) => (typeof v === "string" ? v.trim() : "");
  // Partner mark: 'none' suppresses it entirely, an explicit URL wins, blank
  // falls back to the content guess. Auto-detection reads block content and
  // WILL pick the wrong mark on a page carrying several logos, so the explicit
  // controls are the reliable path.
  const partnerPref = trim(page.ogCardPartnerLogo);
  const partnerLogo = partnerPref === "none" ? "" : partnerPref || copy.accountLogo;
  // Per-page overrides (builder "Email embed card" section) beat everything —
  // they exist precisely because the derived hero copy sometimes reads wrong
  // on the card. Then hero copy, then the meta cascade scrapers see.
  const metaFallback = resolveOGFields({
    pageTitle: trim(page.title),
    pageMetaTitle: trim(page.metaTitle),
    pageMetaDescription: trim(page.metaDescription),
    pageOgImage: "",
    blocks: page.blocks,
    tenantName: trim(tenant?.name),
    tenantDefaultTitle: trim(tenant?.defaultOgTitle),
    tenantDefaultDescription: trim(tenant?.defaultOgDescription),
    tenantDefaultImageUrl: "",
  });
  const host = await resolveCanonicalPublishedHost(page.tenantId);
  // toPlainCardText at the boundary, not just inside deriveOgCardCopy: the
  // per-page overrides and the meta cascade are separate sources, and a pasted
  // override or an auto-generated title can carry markup just as easily. The
  // card renders text, so nothing markup-shaped should reach it by any route.
  res.json({
    headline: toPlainCardText(trim(page.ogCardHeadline) || copy.headline || metaFallback.title),
    subheadline: toPlainCardText(trim(page.ogCardSubheadline) || copy.subheadline || metaFallback.description),
    accountName: partnerPref === "none" ? "" : toPlainCardText(copy.accountName),
    accountLogo: partnerLogo,
    // Background: per-page override first, else the page's HERO image
    // (deriveHeroImage — NOT the first image anywhere, which used to surface a
    // stock headshot or carousel frame). Never og_image/og_card_image, which
    // may themselves be captures of this card (recursion) or the old layout.
    backgroundImage: trim(page.ogCardBackground) || deriveHeroImage(page.blocks),
    host: host ?? "",
    slug: page.slug,
  });
});

export default router;
