import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { lpEventsTable, lpSessionsTable, lpVariantsTable, lpTestsTable, lpPagesTable, lpPageVisitsTable } from "@workspace/db";
import { TrackEventBody, GetPageConfigParams, GetPageConfigQueryParams } from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";
import type { LpVariant } from "@workspace/db";
import geoip from "geoip-lite";
import {
  collectFeatures,
  pickVariantThompson,
  recordImpression,
  recordConversion,
  type VisitorFeatures,
} from "../../lib/smart-traffic";

function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) {
    return (typeof fwd === "string" ? fwd : fwd[0]).split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? req.ip ?? "";
}

function lookupGeo(req: Request) {
  const raw = getClientIp(req);
  const ip = raw.replace(/^::ffff:/, "");
  const geo = geoip.lookup(ip);
  if (!geo) return { city: null, region: null, country: null, countryCode: null };
  return {
    city: geo.city || null,
    region: geo.region || null,
    country: geo.country || null,
    countryCode: geo.country || null,
  };
}

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
  const [event] = await db.insert(lpEventsTable).values({
    sessionId: parsed.data.sessionId,
    testId: parsed.data.testId,
    variantId: parsed.data.variantId,
    eventType: parsed.data.eventType,
    conversionType: parsed.data.conversionType ?? null,
  }).returning();

  // Update smart traffic stats on conversion events (fire-and-forget)
  if (parsed.data.eventType === "conversion" && parsed.data.testId) {
    (async () => {
      try {
        // Look up the session to get features
        const [session] = await db
          .select()
          .from(lpSessionsTable)
          .where(and(
            eq(lpSessionsTable.sessionId, parsed.data.sessionId),
            eq(lpSessionsTable.testId, parsed.data.testId),
          ));
        if (session) {
          const features = (session.features ?? {}) as VisitorFeatures;
          // Only record if features exist (session was created with smart traffic)
          if (features.device) {
            await recordConversion(parsed.data.testId, parsed.data.variantId, features);
          }
        }
      } catch {
        // Silently ignore — smart traffic stats are best-effort
      }
    })();
  }

  res.json({ success: true, eventId: event.id });
});

router.get("/lp/page/:slug", async (req, res): Promise<void> => {
  const params = GetPageConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const queryParsed = GetPageConfigQueryParams.safeParse(req.query);
  const sessionId = queryParsed.success && queryParsed.data.sessionId
    ? queryParsed.data.sessionId
    : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Preview mode: bypass session assignment, no tracking
  const previewVariantId = req.query.previewVariantId
    ? parseInt(req.query.previewVariantId as string, 10)
    : undefined;

  const [test] = await db
    .select()
    .from(lpTestsTable)
    .where(eq(lpTestsTable.slug, params.data.slug));

  if (!test) {
    // Check if it's a builder page
    const [builderPage] = await db
      .select()
      .from(lpPagesTable)
      .where(eq(lpPagesTable.slug, params.data.slug));

    if (builderPage) {
      // Record a geo-tagged visit for builder pages (fire-and-forget)
      const geo = lookupGeo(req);
      db.insert(lpPageVisitsTable).values({
        pageId: builderPage.id,
        sessionId,
        ...geo,
      }).onConflictDoNothing().catch(() => undefined);

      // Cache published pages at the HTTP layer — browsers and CDNs can reuse
      // the response for 60 s. Draft pages are never cached so editors see changes immediately.
      if (builderPage.status === "published" && !previewVariantId) {
        res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      } else {
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
    const geo = lookupGeo(req);
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
      let rand = Math.random() * totalWeight;
      for (const variant of variants) {
        rand -= variant.trafficWeight;
        if (rand <= 0) {
          assignedVariant = variant;
          break;
        }
      }
      if (!assignedVariant) assignedVariant = variants[0];
    }

    // Store session assignment with geo + features
    await db.insert(lpSessionsTable).values({
      sessionId,
      testId: test.id,
      variantId: assignedVariant.id,
      ...geo,
      features,
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
    const [found] = await db
      .select()
      .from(lpPagesTable)
      .where(eq(lpPagesTable.slug, params.data.slug));
    if (found) basePage = found;
  }

  if (basePage && !enrichedHasPage) {
    // Return as a builder page response with A/B tracking info embedded
    const blockOverrides = (enrichedVariant as LpVariant).blockOverrides as Record<string, unknown> | null | undefined;
    const hasOverrides = blockOverrides && Object.keys(blockOverrides).length > 0;
    const blocks = hasOverrides
      ? applyBlockOverrides(basePage.blocks as unknown[], blockOverrides as Record<string, unknown>)
      : basePage.blocks as unknown[];

    const geo = lookupGeo(req);
    db.insert(lpPageVisitsTable).values({ pageId: basePage.id, sessionId, ...geo }).onConflictDoNothing().catch(() => undefined);

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

  res.json({
    testId: test.id,
    slug: test.slug,
    testName: test.name,
    sessionId,
    assignedVariant: enrichedVariant,
    status: test.status,
  });
});

export default router;
