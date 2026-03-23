import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { lpEventsTable, lpSessionsTable, lpVariantsTable, lpTestsTable, lpPagesTable, lpPageVisitsTable } from "@workspace/db";
import { TrackEventBody, GetPageConfigParams, GetPageConfigQueryParams } from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";
import type { LpVariant } from "@workspace/db";
import geoip from "geoip-lite";

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

      res.json({
        pageType: "builder",
        id: builderPage.id,
        title: builderPage.title,
        slug: builderPage.slug,
        blocks: builderPage.blocks,
        status: builderPage.status,
        customCss: builderPage.customCss ?? "",
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
    // Weighted random assignment based on trafficWeight
    const totalWeight = variants.reduce((sum, v) => sum + v.trafficWeight, 0);
    let rand = Math.random() * totalWeight;
    for (const variant of variants) {
      rand -= variant.trafficWeight;
      if (rand <= 0) {
        assignedVariant = variant;
        break;
      }
    }
    // Fallback to first variant
    if (!assignedVariant) assignedVariant = variants[0];

    // Store session assignment with geo
    const geo = lookupGeo(req);
    await db.insert(lpSessionsTable).values({
      sessionId,
      testId: test.id,
      variantId: assignedVariant.id,
      ...geo,
    }).onConflictDoNothing();
  }

  const enrichedVariant = await enrichVariant(assignedVariant!);
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
