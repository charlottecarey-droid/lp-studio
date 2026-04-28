import { Router } from "express";
import { randomBytes } from "crypto";
import { db, pool } from "@workspace/db";
import { lpEventsTable, lpSessionsTable, lpVariantsTable, lpTestsTable, lpPagesTable, lpPageVisitsTable, lpPageReviewsTable } from "@workspace/db";
import { TrackEventBody, GetPageConfigParams, GetPageConfigQueryParams } from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";
import type { LpVariant } from "@workspace/db";
import type { Request } from "express";
import { getClientIp, lookupGeoAsync } from "../../lib/geo";
import { revealAccountName } from "../../lib/apollo-reveal";
import { findTenantByHost } from "../../lib/tenantHosts";
import { getRequestHost } from "../../lib/requestHost";
import { SESSION_COOKIE, type AuthUser } from "../../middleware/requireAuth";

/**
 * Resolve tenant id for a public, slug-based request from the request host.
 * Returns null if no tenant is mapped to that host. Page lookups by slug must
 * always be scoped by tenant — slugs are unique only per (tenant_id, slug).
 */
async function resolveTenantIdFromRequest(req: Request): Promise<number | null> {
  const host = getRequestHost(req);
  if (!host) return null;
  const match = await findTenantByHost(host);
  return match?.tenantId ?? null;
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
      return {
        ...variant,
        linkedPage: {
          id: linkedPage.id,
          title: linkedPage.title,
          slug: linkedPage.slug,
          blocks: linkedPage.blocks,
          customCss: linkedPage.customCss ?? "",
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
  return {
    ...variant,
    linkedPage: {
      id: page.id,
      title: page.title,
      slug: page.slug,
      blocks: mergedBlocks,
    },
  };
}

const router = Router();

router.post("/lp/track", async (req, res): Promise<void> => {
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
    const tenantId = await resolveTenantIdFromRequest(req);
    if (tenantId == null) { res.status(404).send("Not found"); return; }

    const [page] = await db.select({
      title: lpPagesTable.title,
      metaTitle: lpPagesTable.metaTitle,
      metaDescription: lpPagesTable.metaDescription,
      ogImage: lpPagesTable.ogImage,
      status: lpPagesTable.status,
    }).from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.slug, slug)))
      .limit(1);

    if (!page || page.status === "draft") {
      res.status(404).send("Not found");
      return;
    }

    const pageTitle = page.metaTitle || "Meet Dandy | The Modern Operating System for Dentistry";
    const pageDesc = page.metaDescription || "See what Dandy can do for your dental practice.";
    const pageImage = page.ogImage || "";

    // Derive canonical public URL from request origin
    const host = getRequestHost(req) || "partners.meetdandy.com";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const canonicalUrl = `${proto}://${host}/lp/${slug}`;

    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(pageDesc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(pageDesc)}" />
  ${pageImage ? `<meta property="og:image" content="${escapeHtml(pageImage)}" />` : ""}
  <meta name="twitter:card" content="summary_large_image" />
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

router.get("/lp/page/:slug", async (req, res): Promise<void> => {
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
    // so we must scope the lookup by the host's tenant.
    const tenantId = await resolveTenantIdFromRequest(req);
    if (tenantId == null) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    const [builderPage] = await db
      .select()
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.slug, params.data.slug)));

    if (builderPage) {
      // Drafts must NEVER be served from a tenant-mapped public host.
      // We're inside this branch only when the request host resolved to a
      // tenant via findTenantByHost — i.e. the visitor is on a public-facing
      // domain (microsite-only OR tenant-locked custom domain). The previous
      // implementation hardcoded "partners.meetdandy.com" which leaked drafts
      // on lp.meetdandy.com, custom tenant domains, and *.lpstudio.ai
      // wildcard subdomains. Authenticated tenant members and review-token
      // holders should use /api/lp/preview/:slug instead.
      if (builderPage.status === "draft") {
        res.status(404).json({ error: "Page not found" });
        return;
      }

      // Record a geo-tagged visit for builder pages (fire-and-forget)
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

      // Cache published pages at the HTTP layer — browsers and CDNs can reuse
      // the response for 60 s. Draft pages are never cached so editors see changes immediately.
      if (builderPage.status === "published" && !previewVariantId) {
        res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      } else {
        res.set("Cache-Control", "no-store");
      }

      // Apollo IP reveal — only called when the page uses {{accountNameApollo}}
      // so pages without the placeholder have zero extra latency.
      const blocksJson = JSON.stringify(builderPage.blocks ?? []);
      const needsApollo = blocksJson.includes("{{accountNameApollo}}");
      const accountNameApollo = needsApollo
        ? await revealAccountName(getClientIp(req))
        : "";

      // Pages with Apollo personalization must not be cached at the CDN layer
      // because the response differs per visitor IP.
      if (needsApollo) {
        res.set("Cache-Control", "no-store");
      }

      res.json({
        pageType: "builder",
        id: builderPage.id,
        title: builderPage.title,
        slug: builderPage.slug,
        blocks: builderPage.blocks,
        status: builderPage.status,
        customCss: builderPage.customCss ?? "",
        animationsEnabled: builderPage.animationsEnabled,
        metaTitle: builderPage.metaTitle || "",
        metaDescription: builderPage.metaDescription || "",
        ogImage: builderPage.ogImage || "",
        accountNameApollo,
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
  let basePage: { id: number; title: string; slug: string; blocks: unknown; customCss: string | null; status: string; animationsEnabled: boolean } | null = null;
  if (!enrichedHasPage) {
    const tenantId = await resolveTenantIdFromRequest(req);
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
// GET /api/lp/preview/:slug
//
// Authenticated/authorised counterpart to /api/lp/page/:slug. Renders BOTH
// drafts and published pages so editors and reviewers can see in-progress
// work. Public hosts must NEVER serve drafts via the live URL — that's the
// /api/lp/page/:slug path which returns 404 for drafts above. The preview
// path is the only way to view a draft.
//
// Authorisation is satisfied by EITHER:
//   1. A valid session cookie (lp_sid) whose tenantId matches the page's
//      tenantId — or where the user is a global superadmin (isAdmin=true).
//   2. A query param ?reviewToken=<token> matching an lp_page_reviews row
//      whose pageId matches the looked-up page. Page-scoped: a token issued
//      for page A cannot unlock page B.
//
// Tenant resolution prefers the request host (when it maps to a tenant) and
// falls back to the authenticated user's tenant — this lets editors load
// previews from the admin host (app.lpstudio.ai) without a tenant-mapped
// host header.
//
// Tracking, smart-traffic, A/B assignment, and Apollo IP reveal are all
// disabled here — preview is a static read.

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

  // Authorisation path 1: review token. Page-scoped — never lets a token
  // for page A unlock page B with the same slug in another tenant.
  //
  // Token validity model (see schema in lib/db/src/schema/lpCollaboration.ts):
  // the lp_page_reviews row IS the token. Revocation is implemented as
  // DELETE on the row (DELETE /lp/pages/:pageId/reviews/:reviewId in
  // collaboration.ts) — once the row is gone the WHERE-clause below
  // returns nothing and we 404, so revoked tokens are correctly rejected
  // here without any extra predicate. The schema deliberately has no
  // expires_at / revoked_at columns; if/when expiry semantics are added,
  // the WHERE clause must grow corresponding predicates.
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

  // Authorisation path 2: authenticated session. We always look up the page
  // under the SESSION's tenant — never under a host-derived tenant. This
  // prevents a tenant-admin of A from previewing tenant B's drafts simply by
  // sending a request with B's host header. (`AuthUser.isAdmin` here means
  // "tenant-role admin", not "global superadmin" — see auth.ts where it is
  // populated from `tenant_roles.is_admin` — so it must NOT bypass tenant
  // isolation. The cross-tenant Switch Tenant tool issues a fresh session
  // for the new tenant, which then matches `user.tenantId` here.)
  //
  // Note: the request host is intentionally ignored. The page lookup is
  // strictly scoped to `user.tenantId`, so a session can only ever surface
  // its own tenant's pages regardless of which host the request arrived on.
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
  res.json({
    pageType: "builder",
    id: page.id,
    title: page.title,
    slug: page.slug,
    blocks: page.blocks,
    status: page.status,
    customCss: page.customCss ?? "",
    animationsEnabled: page.animationsEnabled,
    metaTitle: page.metaTitle || "",
    metaDescription: page.metaDescription || "",
    ogImage: page.ogImage || "",
    accountNameApollo: "",
    isPreview: true,
  });
});

export default router;
