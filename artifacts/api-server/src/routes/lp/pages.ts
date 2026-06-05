import { getTenantId } from "../../middleware/requireAuth";
import type { AuthUser } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, asc, and, or, desc } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { lpPagesTable, lpPageReviewsTable, salesAccountsTable, lpTemplateUsageTable, tenantsTable } from "@workspace/db";
import { resolveOGFields } from "../../lib/resolvePageOG";
import { sql } from "drizzle-orm";
import { tenantRequiresReview } from "../../lib/tenantSettings";
import { getTenantPlan } from "../../lib/planFeatures";
import { getPlanConfig } from "../../lib/planConfig";
import { capUpgradeBody } from "../../lib/planGate";
import { createReviewTask, commentAndCompleteTask } from "../../lib/asana";
import { findTenantByHost } from "../../lib/tenantHosts";
import { getRequestHost } from "../../lib/requestHost";
import crypto from "node:crypto";
import { triggerPublishedRender, triggerPublishedDelete } from "../../lib/triggerPublishedRender";
import { handlePagePublishNotifications } from "../../lib/contentSeriesNotify";
import { triggerTemplateThumbnailCapture } from "../../lib/captureTemplateThumbnail";

const router = Router();

/**
 * Page-review permission helpers (task #108).
 *
 * `pages.publish` gates flipping a page TO `published` (or any away-from-
 * pending_review status change driven by an editor). `pages.review` gates the
 * approve/reject endpoints and the Pending Review queue.
 *
 * Three tiers grant either perm:
 *   1. tenant Admin (req.authUser.isAdmin)        — set via tenant_roles
 *   2. explicit perm in their tenant role         — pages.publish / pages.review
 *   3. Dandy super-admin (app_users.role)         — looked up once per call,
 *      not in the session, so promoting a user takes effect immediately.
 */
async function isAppSuperadmin(userId: number | undefined): Promise<boolean> {
  if (!userId) return false;
  const r = await pool.query(`SELECT role FROM app_users WHERE id = $1`, [userId]);
  return r.rows[0]?.role === "superadmin";
}

async function userCanPublish(
  user: AuthUser | undefined,
  tenantId: number | null,
): Promise<boolean> {
  if (!user) return false;
  if (user.isAdmin || user.permissions["pages.publish"]) return true;
  if (await isAppSuperadmin(user.userId)) return true;
  // Task #113: when the tenant has the review-required toggle OFF, anyone
  // with the basic `pages` permission can publish directly. The toggle
  // defaults to ON for tenants existing before #113 (preserving #108
  // behaviour) so this short-circuit only fires for opted-out tenants.
  if (user.permissions["pages"] && !(await tenantRequiresReview(tenantId))) return true;
  return false;
}

async function userCanReview(user: AuthUser | undefined): Promise<boolean> {
  if (!user) return false;
  if (user.isAdmin || user.permissions["pages.review"]) return true;
  return isAppSuperadmin(user.userId);
}

/**
 * Grid-piece gating (task #120). Mirrored from
 * `lp-studio/src/lib/audience-gating.ts` — kept in sync manually because the
 * server can't import from artifact source.
 */
// Keep in sync with GRID_PIECE_BLOCK_TYPES in
// artifacts/lp-studio/src/lib/audience-gating.ts. Server can't import the
// client module so the list is duplicated; only the small drop-in tiles +
// the schema-driven custom block are gated — generic content blocks like
// rich-text / custom-html / spacer / cta-button intentionally stay open.
const GRID_PIECE_BLOCK_TYPES: ReadonlySet<string> = new Set([
  // New small drop-in tiles
  "grid-image",
  "grid-headline-sub",
  "grid-paragraph-bullets",
  "grid-headline-paragraph",
  "grid-icon-feature",
  "grid-stat",
  "grid-quote",
  "grid-cta-tile",
  "grid-logo",
  "grid-video",
  "custom-schema",
  // Existing grid-oriented blocks recategorized into Grid Pieces — server
  // enforcement must match client palette gating to prevent payload-crafted
  // bypass.
  "grid",
  "benefits-grid",
  "product-grid",
  "photo-strip",
  "bento-showcase",
]);

async function userCanManageBlocks(user: AuthUser | undefined): Promise<boolean> {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (user.permissions["blocks"]) return true;
  return isAppSuperadmin(user.userId);
}

/** Walk a (possibly nested) blocks tree and return the first grid-piece type
 *  found, or null when none are present. Container blocks store children at
 *  `children: PageBlock[]`; we recurse into anything that looks like one.
 */
function findGridPieceInTree(blocks: unknown): string | null {
  if (!Array.isArray(blocks)) return null;
  for (const raw of blocks) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as { type?: unknown; children?: unknown };
    if (typeof b.type === "string" && GRID_PIECE_BLOCK_TYPES.has(b.type)) return b.type;
    const nested = findGridPieceInTree(b.children);
    if (nested) return nested;
  }
  return null;
}

function buildPreviewUrl(req: import("express").Request, slug: string): string {
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
  // Use the in-app preview route (works for draft + pending_review pages),
  // not /p/:slug (which only serves *published* pages and 404s on submissions).
  return `${proto}://${host}/preview/${encodeURIComponent(slug)}`;
}
function buildReviewUrl(req: import("express").Request, pageId: number): string {
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
  return `${proto}://${host}/builder/${pageId}`;
}

interface DbError {
  code?: string;
}

function isDbError(err: unknown): err is DbError {
  return typeof err === "object" && err !== null && "code" in err;
}

/**
 * Sanitizes CSS by removing dangerous patterns:
 * - expression() calls (IE only, but block anyway)
 * - javascript: references
 * - url() with data: or javascript: protocols
 * - -moz-binding directives
 */
function sanitizeCSS(css: string): string {
  if (!css) return css;

  // Remove expression() calls
  let sanitized = css.replace(/expression\s*\([^)]*\)/gi, "");

  // Remove javascript: references
  sanitized = sanitized.replace(/javascript:/gi, "");

  // Remove url() with dangerous protocols
  sanitized = sanitized.replace(/url\s*\(\s*['"]?(data:|javascript:)[^)]*\)/gi, "");

  // Remove -moz-binding directives
  sanitized = sanitized.replace(/-moz-binding\s*:[^;]*;/gi, "");

  return sanitized;
}

router.get("/lp/pages", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    // Optional ?tag=<value> filter for authenticated callers (dashboard,
    // template pickers). The public Story Hub block uses the unauthenticated
    // /lp/public-pages route below instead. We don't have a dedicated tag
    // column on lp_pages, so the tag is interpreted as a slug-prefix
    // convention: a page matches when its slug equals "<tag>", or begins
    // with "<tag>/" or "<tag>-". When a tag is supplied we also restrict
    // to published pages so a Story Hub preview in the builder never shows
    // drafts. The no-tag path is unchanged.
    const tagRaw = req.query.tag;
    const tag = typeof tagRaw === "string" ? tagRaw.trim().toLowerCase() : "";
    const tagWhere = tag
      ? sql`(
          lower(${lpPagesTable.slug}) = ${tag}
          OR lower(${lpPagesTable.slug}) LIKE ${tag + "/%"}
          OR lower(${lpPagesTable.slug}) LIKE ${tag + "-%"}
        ) AND ${lpPagesTable.status} = 'published'`
      : undefined;
    const pages = await db
      .select()
      .from(lpPagesTable)
      .where(tagWhere ? and(eq(lpPagesTable.tenantId, tenantId), tagWhere) : eq(lpPagesTable.tenantId, tenantId))
      // Order by true last-edited time (most recent first) so the default
      // server order matches intent even before the client re-sorts. The
      // client (dashboard + pages gallery) still sorts by updatedAt. (task #490)
      .orderBy(desc(lpPagesTable.updatedAt));

    // For admins: resolve email → display name from app_users
    if (req.authUser?.isAdmin) {
      const emails = new Set<string>();
      for (const p of pages) {
        if (p.createdBy) emails.add(p.createdBy);
        if (p.updatedBy) emails.add(p.updatedBy);
      }
      if (emails.size > 0) {
        const rows = await db.execute(
          sql`SELECT email, name FROM app_users WHERE email = ANY(ARRAY[${sql.raw(
            [...emails].map(e => `'${e.replace(/'/g, "''")}'`).join(",")
          )}])`
        );
        const nameMap: Record<string, string> = {};
        for (const row of rows.rows as { email: string; name: string }[]) {
          nameMap[row.email] = row.name || row.email;
        }
        const enriched = pages.map(p => ({
          ...p,
          createdByName: p.createdBy ? (nameMap[p.createdBy] ?? p.createdBy) : null,
          updatedByName: p.updatedBy ? (nameMap[p.updatedBy] ?? p.updatedBy) : null,
        }));
        res.json(enriched);
        return;
      }
    }

    res.json(pages);
  } catch (err) {
    const cause = (err as { cause?: Error })?.cause;
    console.error("GET /lp/pages error:", cause?.message ?? String(err));
    res.status(500).json({ error: "Failed to load pages" });
  }
});

/**
 * GET /lp/public-pages?tag=<value>
 *
 * Public, host-resolved page list for use by published landing-page blocks
 * (the Premium Customer Story Hub). The request host pins the tenant exactly
 * the way /lp/brand and /lp/page/:slug do, so an anonymous visitor on a
 * tenant domain can list that tenant's published case-study pages without
 * authenticating. This route is allow-listed in LP_PUBLIC.
 *
 * Behaviour:
 *   - Always restricted to status='published'. Drafts are never exposed.
 *   - `tag` (required, non-empty) is matched against slug using the same
 *     slug-prefix convention used by the authenticated /lp/pages route:
 *     equals "<tag>", or begins with "<tag>/" or "<tag>-".
 *   - Returns only the small set of public-safe fields the Story Hub
 *     renderer needs — never internal review metadata, author emails,
 *     blocks JSON, or status.
 *   - Returns an empty array when the host can't be resolved or no tag is
 *     supplied. Clients are expected to fall back to in-block placeholder
 *     content in that case (so the builder preview still shows something).
 */
router.get("/lp/public-pages", async (req, res): Promise<void> => {
  try {
    const tagRaw = req.query.tag;
    const tag = typeof tagRaw === "string" ? tagRaw.trim().toLowerCase() : "";
    if (!tag) { res.json([]); return; }
    const host = getRequestHost(req);
    const match = host ? await findTenantByHost(host) : null;
    const tenantId = match?.tenantId ?? null;
    if (tenantId == null) { res.json([]); return; }
    const rows = await db
      .select({
        id: lpPagesTable.id,
        title: lpPagesTable.title,
        slug: lpPagesTable.slug,
        metaTitle: lpPagesTable.metaTitle,
        metaDescription: lpPagesTable.metaDescription,
        ogImage: lpPagesTable.ogImage,
      })
      .from(lpPagesTable)
      .where(
        and(
          eq(lpPagesTable.tenantId, tenantId),
          eq(lpPagesTable.status, "published"),
          sql`(
            lower(${lpPagesTable.slug}) = ${tag}
            OR lower(${lpPagesTable.slug}) LIKE ${tag + "/%"}
            OR lower(${lpPagesTable.slug}) LIKE ${tag + "-%"}
          )`,
        ),
      )
      .orderBy(desc(lpPagesTable.updatedAt));
    res.json(rows);
  } catch (err) {
    console.error("GET /lp/public-pages error:", String(err));
    res.status(500).json({ error: "Failed to load public pages" });
  }
});

// List all marketing-defined templates (pages with isTemplate = true).
// Returns the union of:
//   1. The caller's tenant-owned templates
//   2. All global templates (isGlobal=true), regardless of industry — every
//      tenant has access to the full global template library.
//
// When `?ownedOnly=true` is passed, the global template library is excluded
// and only the caller's tenant-owned templates are returned. Used by the
// sales-rep microsite generator so reps only see brand-vetted internal
// templates (no off-brand global starters).
//
// When `?salesMode=true` is passed, the result is the caller's tenant-owned
// templates PLUS the global "business-case" flagship templates (detected by
// the first block's type starting with "business-case"). These are
// brand-vetted Dandy sales documents the rep microsite generator is meant to
// use, so we surface them without opening the full global starter library.
router.get("/lp/templates", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const ownedOnly = String(req.query.ownedOnly ?? "").toLowerCase() === "true";
    const salesMode = String(req.query.salesMode ?? "").toLowerCase() === "true";
    // The first block's type — business-case templates are single-block
    // "monograph" documents whose first (only) block is business-case-*.
    const isBusinessCaseGlobal = and(
      eq(lpPagesTable.isGlobal, true),
      sql`(${lpPagesTable.blocks} -> 0 ->> 'type') LIKE 'business-case%'`,
    );
    // ownedOnly: tenant-owned AND not flagged is_global. The is_global=false
    // guard is defensive — a tenant template should not normally also be a
    // global starter, but if it ever is, we don't want it leaking into the
    // sales-rep microsite generator's tenant-only picker.
    const ownedTemplates = and(
      eq(lpPagesTable.tenantId, tenantId),
      eq(lpPagesTable.isGlobal, false),
    );
    const visibility = salesMode
      ? or(ownedTemplates, isBusinessCaseGlobal)
      : ownedOnly
        ? ownedTemplates
        : or(
            eq(lpPagesTable.tenantId, tenantId),
            eq(lpPagesTable.isGlobal, true),
          );
    const templates = await db
      .select()
      .from(lpPagesTable)
      .where(
        and(
          eq(lpPagesTable.isTemplate, true),
          visibility,
        ),
      )
      .orderBy(asc(lpPagesTable.templateLabel));
    res.json(templates);
  } catch (err) {
    console.error("GET /lp/templates error:", String(err));
    res.status(500).json({ error: "Failed to load templates" });
  }
});

router.post("/lp/pages", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const {
    title, slug, blocks, status, customCss, metaTitle, metaDescription,
    ogImage, animationsEnabled, smoothScroll, pageVariables, fromTemplateId, audienceType, segmentId,
  } = req.body as {
    title?: unknown;
    slug?: unknown;
    blocks?: unknown;
    status?: unknown;
    customCss?: unknown;
    metaTitle?: unknown;
    metaDescription?: unknown;
    ogImage?: unknown;
    animationsEnabled?: unknown;
    smoothScroll?: unknown;
    pageVariables?: unknown;
    fromTemplateId?: unknown;
    audienceType?: unknown;
    segmentId?: unknown;
  };
  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (!slug || typeof slug !== "string") {
    res.status(400).json({ error: "slug is required" });
    return;
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length !== 1) {
    res.status(400).json({ error: "slug must match /^[a-z0-9][a-z0-9-]*[a-z0-9]$/ or be a single character" });
    return;
  }
  if (slug.length > 255) {
    res.status(400).json({ error: "slug must be max 255 characters" });
    return;
  }
  // Validate blocks array size
  if (Array.isArray(blocks) && blocks.length > 1000) {
    res.status(400).json({ error: "blocks array cannot exceed 1000 items" });
    return;
  }
  // Validate total request body size (roughly 10MB limit)
  const bodySize = JSON.stringify(req.body).length;
  if (bodySize > 10 * 1024 * 1024) {
    res.status(413).json({ error: "Request payload exceeds maximum size of 10MB" });
    return;
  }

  // If fromTemplateId is provided, copy all settings from that template page
  let sourceBlocks: unknown[] = [];
  let sourceCss = "";
  let sourceAnimationsEnabled = true;
  let sourceSmoothScroll = true;
  let sourceMetaTitle = "";
  let sourceMetaDescription = "";
  let sourceOgImage = "";
  let sourcePageVariables: Record<string, string> = {};
  if (typeof fromTemplateId === "number") {
    // Source can be either a tenant-owned template or any global template.
    // Non-template global pages are not allowed.
    const [source] = await db.select().from(lpPagesTable).where(
      and(
        eq(lpPagesTable.id, fromTemplateId),
        or(
          eq(lpPagesTable.tenantId, tenantId),
          and(
            eq(lpPagesTable.isGlobal, true),
            eq(lpPagesTable.isTemplate, true),
          ),
        ),
      )
    );
    if (source) {
      sourceBlocks = Array.isArray(source.blocks) ? source.blocks : [];
      sourceCss = source.customCss ?? "";
      sourceAnimationsEnabled = source.animationsEnabled ?? true;
      sourceSmoothScroll = source.smoothScroll ?? true;
      sourceMetaTitle = source.metaTitle ?? "";
      sourceMetaDescription = source.metaDescription ?? "";
      sourceOgImage = source.ogImage ?? "";
      sourcePageVariables = (source.pageVariables && typeof source.pageVariables === "object" && !Array.isArray(source.pageVariables))
        ? source.pageVariables as Record<string, string>
        : {};
    }
  }

  // Task #120: gate grid pieces on the server too — a non-privileged user
  // shouldn't be able to sneak `grid-*` / `custom-schema` blocks past the
  // client palette by hand-crafting a request body OR by cloning a template
  // that happens to contain them. Validate the EFFECTIVE blocks (request
  // body wins, otherwise the cloned template's blocks).
  {
    const effectiveBlocks: unknown = (Array.isArray(blocks) && blocks.length > 0) ? blocks : sourceBlocks;
    const offending = findGridPieceInTree(effectiveBlocks);
    if (offending && !(await userCanManageBlocks(req.authUser))) {
      res.status(403).json({ error: `Block type "${offending}" requires the blocks permission.` });
      return;
    }
  }

  // Gate the requested status against the publish-permission model so a
  // regular editor cannot create a page directly as `published` (or jump it
  // straight into `pending_review` is allowed for any user with `pages`
  // perm — that's the explicit submit-for-review entry point). Without this
  // gate, the review workflow could be bypassed entirely on create.
  const requestedStatus = typeof status === "string" ? status : "draft";
  let effectiveStatus = requestedStatus;
  if (requestedStatus === "published") {
    if (!(await userCanPublish(req.authUser, tenantId))) {
      effectiveStatus = "draft";
    }
  } else if (requestedStatus !== "draft" && requestedStatus !== "pending_review") {
    // Unknown status values fall back to draft.
    effectiveStatus = "draft";
  }

  // Task #407 — plan-tier page-count gate. Superadmins bypass (consistent
  // with requirePlanFeature) so support staff can spin up demo pages on
  // any tenant. Template pages don't count toward the cap; they're a
  // marketing surface, not the tenant's own marketing output.
  if (req.authUser?.appUserRole !== "superadmin") {
    try {
      const plan = await getTenantPlan(tenantId);
      const config = await getPlanConfig();
      const cap = config[plan].features.limits.pages;
      if (cap !== null) {
        const countRow = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM lp_pages
            WHERE tenant_id = $1 AND is_template = false`,
          [tenantId],
        );
        const current = Number(countRow.rows[0]?.count ?? 0);
        if (current >= cap) {
          res.status(402).json(capUpgradeBody("pages", current, cap, plan, config));
          return;
        }
      }
    } catch (err) {
      console.error("[lp/pages] plan-limit check failed:", err);
      res.status(503).json({ error: "plan_check_unavailable" });
      return;
    }
  }

  // Task #967 — pre-fill the per-page OG fields from the tenant-default cascade
  // on create so a new page ships with its effective share-card values already
  // visible (and editable) in the SEO panel, rather than appearing blank until
  // the user touches them. Explicit overrides and template-source values still
  // win; we only fill fields that are otherwise empty. Best-effort: a lookup
  // failure leaves the fields empty (the publish-time resolver still cascades).
  const effectiveBlocksForOg: unknown = (Array.isArray(blocks) && blocks.length > 0) ? blocks : sourceBlocks;
  let prefillMetaTitle = typeof metaTitle === "string" && metaTitle.length > 0 ? metaTitle : sourceMetaTitle;
  let prefillMetaDescription = typeof metaDescription === "string" && metaDescription.length > 0 ? metaDescription : sourceMetaDescription;
  let prefillOgImage = typeof ogImage === "string" && ogImage.length > 0 ? ogImage : sourceOgImage;
  if (!prefillMetaTitle || !prefillMetaDescription || !prefillOgImage) {
    try {
      const [tenantRow] = await db
        .select({
          name: tenantsTable.name,
          defaultOgTitle: tenantsTable.defaultOgTitle,
          defaultOgDescription: tenantsTable.defaultOgDescription,
          defaultOgImageUrl: tenantsTable.defaultOgImageUrl,
        })
        .from(tenantsTable)
        .where(eq(tenantsTable.id, tenantId))
        .limit(1);
      const resolved = resolveOGFields({
        pageTitle: title,
        pageMetaTitle: prefillMetaTitle,
        pageMetaDescription: prefillMetaDescription,
        pageOgImage: prefillOgImage,
        blocks: effectiveBlocksForOg,
        tenantName: (tenantRow?.name ?? "").trim(),
        tenantDefaultTitle: (tenantRow?.defaultOgTitle ?? "").trim(),
        tenantDefaultDescription: (tenantRow?.defaultOgDescription ?? "").trim(),
        tenantDefaultImageUrl: (tenantRow?.defaultOgImageUrl ?? "").trim(),
      });
      if (!prefillMetaTitle) prefillMetaTitle = resolved.title;
      if (!prefillMetaDescription) prefillMetaDescription = resolved.description;
      if (!prefillOgImage) prefillOgImage = resolved.image;
    } catch (ogErr) {
      console.warn("[lp/pages] OG pre-fill lookup failed; leaving fields empty", { tenantId, err: ogErr });
    }
  }

  try {
    const finalCustomCss = (typeof customCss === "string" && customCss.length > 0) ? sanitizeCSS(customCss) : sanitizeCSS(sourceCss);
    const [page] = await db
      .insert(lpPagesTable)
      .values({
        tenantId,
        title,
        slug,
        // When fromTemplateId is set, source content wins unless caller sends explicit non-empty overrides
        blocks: (Array.isArray(blocks) && blocks.length > 0) ? blocks : sourceBlocks,
        status: effectiveStatus,
        customCss: finalCustomCss,
        metaTitle: prefillMetaTitle,
        metaDescription: prefillMetaDescription,
        ogImage: prefillOgImage,
        animationsEnabled: typeof animationsEnabled === "boolean" ? animationsEnabled : sourceAnimationsEnabled,
        smoothScroll: typeof smoothScroll === "boolean" ? smoothScroll : sourceSmoothScroll,
        pageVariables: (pageVariables && typeof pageVariables === "object" && !Array.isArray(pageVariables))
          ? pageVariables as Record<string, string>
          : sourcePageVariables,
        audienceType: typeof audienceType === "string" && audienceType ? audienceType : null,
        segmentId: typeof segmentId === "string" && segmentId ? segmentId : null,
        createdBy: req.authUser?.email ?? null,
      })
      .returning();
    // Task #364: kick off prerender if the page was created directly as
    // `published` (superadmin / publish-perm tool). Fire-and-forget — the
    // user's 201 returns immediately and the rendered HTML lands a few
    // seconds later. Visitors that beat the render see SPA fallback.
    if (page && page.status === "published") {
      triggerPublishedRender({ pageId: page.id, requestHost: getRequestHost(req) });
    }
    res.status(201).json(page);
  } catch (err) {
    if (isDbError(err) && err.code === "23505") {
      res.status(409).json({ error: "A page with that slug already exists" });
    } else {
      res.status(500).json({ error: "Failed to create page" });
    }
  }
});

// ─── Pending Review queue (task #108) ─────────────────────────────────────────
//
// IMPORTANT: this `/lp/pages/pending-review` route MUST be declared BEFORE the
// `/lp/pages/:pageId` route below, otherwise express matches "pending-review"
// as a non-numeric pageId and the GET-by-id handler 400s with "Invalid page ID".
router.get("/lp/pages/pending-review", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  // Task #113: when the tenant has the review-required toggle OFF the queue
  // is meaningless — return 409 so any stale UI hammering this endpoint
  // sees an explicit signal to hide itself instead of an empty list.
  if (!(await tenantRequiresReview(tenantId))) {
    res.status(409).json({ error: "Page review workflow is disabled for this tenant" });
    return;
  }
  if (!(await userCanReview(req.authUser))) {
    res.status(403).json({ error: "Permission denied" });
    return;
  }
  // Source the requester from the dedicated submitted_by_user_id audit column
  // (joined to app_users for the email) rather than `updated_by`. updated_by
  // can drift if someone edits the page while it sits in review, but the
  // person who actually clicked "Submit for Review" must remain stable.
  const result = await pool.query(
    `SELECT
        p.id,
        p.title,
        p.slug,
        p.submitted_for_review_at AS "submittedAt",
        COALESCE(u.email, p.updated_by) AS "submittedBy",
        p.asana_task_id AS "asanaTaskId"
     FROM lp_pages p
     LEFT JOIN app_users u ON u.id = p.submitted_by_user_id
     WHERE p.tenant_id = $1 AND p.status = 'pending_review'
     ORDER BY p.submitted_for_review_at DESC`,
    [tenantId],
  );
  res.json(result.rows);
});

router.get("/lp/pages/:pageId", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  // Superadmins can read any page (incl. global templates owned by other tenants).
  const isSuper = await isAppSuperadmin(req.authUser?.userId);
  const where = isSuper
    ? eq(lpPagesTable.id, id)
    : and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id));
  const [page] = await db.select().from(lpPagesTable).where(where);
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  res.json(page);
});

router.post("/lp/pages/:pageId/submit-review", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid page ID" }); return; }
  // Task #113: review workflow is opt-in per tenant. When OFF, this endpoint
  // is meaningless — return 409 to make the contract explicit.
  if (!(await tenantRequiresReview(tenantId))) {
    res.status(409).json({ error: "Page review workflow is disabled for this tenant" });
    return;
  }
  // Anyone with `pages` perm can submit. Admins implicitly have it.
  const user = req.authUser;
  if (!user || (!user.isAdmin && !user.permissions["pages"])) {
    res.status(403).json({ error: "Permission denied" });
    return;
  }
  const [page] = await db.select().from(lpPagesTable).where(
    and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id))
  );
  if (!page) { res.status(404).json({ error: "Page not found" }); return; }
  if (page.status === "published") {
    res.status(409).json({ error: "Page is already published" });
    return;
  }

  // Mint (or reuse) a review token so the Asana preview link works without
  // requiring a logged-in lp-studio session. Reusing the most recent pending
  // token avoids piling up rows on every resubmit.
  let reviewToken: string | null = null;
  try {
    const [existing] = await db
      .select({ token: lpPageReviewsTable.token })
      .from(lpPageReviewsTable)
      .where(and(eq(lpPageReviewsTable.pageId, id), eq(lpPageReviewsTable.status, "pending")))
      .orderBy(desc(lpPageReviewsTable.createdAt))
      .limit(1);
    if (existing?.token) {
      reviewToken = existing.token;
    } else {
      const fresh = crypto.randomBytes(24).toString("hex");
      const [inserted] = await db
        .insert(lpPageReviewsTable)
        .values({ pageId: id, token: fresh, status: "pending" })
        .returning({ token: lpPageReviewsTable.token });
      reviewToken = inserted?.token ?? fresh;
    }
  } catch (err) {
    // Token minting is best-effort. If it fails, the Asana link still works
    // for logged-in tenant users; only external reviewers lose access.
    console.error("[submit-review] could not mint review token", err);
  }

  const previewUrl = reviewToken
    ? `${buildPreviewUrl(req, page.slug)}?reviewToken=${encodeURIComponent(reviewToken)}`
    : buildPreviewUrl(req, page.slug);

  // Asana is best-effort. We attempt the task creation BEFORE flipping status
  // so we can record the task id atomically with the status change. If asana
  // is misconfigured or unreachable, the warning is surfaced to the requester
  // but the workflow still proceeds.
  const asana = await createReviewTask({
    tenantId,
    pageId: id,
    pageTitle: page.title,
    requesterEmail: user.email,
    previewUrl,
    reviewUrl: buildReviewUrl(req, id),
  });

  const [updated] = await db
    .update(lpPagesTable)
    .set({
      status: "pending_review",
      submittedForReviewAt: new Date(),
      submittedByUserId: user.userId,
      lastReviewNote: null,
      lastReviewDecisionBy: null,
      lastReviewDecisionAt: null,
      asanaTaskId: asana.taskId ?? null,
      updatedBy: user.email,
    })
    .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id)))
    .returning();
  res.json({ page: updated, asanaTaskId: asana.taskId ?? null, asanaWarning: asana.warning ?? null });
});

router.post("/lp/pages/:pageId/approve", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid page ID" }); return; }
  // Task #113: 409 when the tenant has the review workflow disabled.
  if (!(await tenantRequiresReview(tenantId))) {
    res.status(409).json({ error: "Page review workflow is disabled for this tenant" });
    return;
  }
  if (!(await userCanReview(req.authUser))) {
    res.status(403).json({ error: "Permission denied" });
    return;
  }
  const [page] = await db.select().from(lpPagesTable).where(
    and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id))
  );
  if (!page) { res.status(404).json({ error: "Page not found" }); return; }
  if (page.status !== "pending_review") {
    res.status(409).json({ error: "Page is not pending review" });
    return;
  }

  const [updated] = await db
    .update(lpPagesTable)
    .set({
      status: "published",
      lastReviewDecisionBy: req.authUser!.email,
      lastReviewDecisionAt: new Date(),
      lastReviewNote: null,
      submittedForReviewAt: null,
      submittedByUserId: null,
      updatedBy: req.authUser!.email,
    })
    .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id)))
    .returning();

  let asanaWarning: string | null = null;
  if (page.asanaTaskId) {
    const result = await commentAndCompleteTask({
      tenantId,
      pageId: id,
      taskId: page.asanaTaskId,
      comment: `Approved by ${req.authUser!.email} — page published.`,
    });
    if (!result.ok) asanaWarning = result.warning ?? null;
  }
  // Task #364: approve = first time the page becomes publicly published.
  // Kick off prerender so visitors get static HTML w/ per-page OG meta.
  triggerPublishedRender({ pageId: id, requestHost: getRequestHost(req) });
  // Task #806: notify Content Series subscribers about newly-added episodes
  // (best-effort, fire-and-forget — never block the publish response).
  void handlePagePublishNotifications({ tenantId, pageId: id, requestHost: getRequestHost(req) });
  res.json({ page: updated, asanaWarning });
});

router.post("/lp/pages/:pageId/reject", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid page ID" }); return; }
  // Task #113: 409 when the tenant has the review workflow disabled.
  if (!(await tenantRequiresReview(tenantId))) {
    res.status(409).json({ error: "Page review workflow is disabled for this tenant" });
    return;
  }
  if (!(await userCanReview(req.authUser))) {
    res.status(403).json({ error: "Permission denied" });
    return;
  }
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 2000) : "";
  if (!note) {
    res.status(400).json({ error: "A rejection note is required" });
    return;
  }
  const [page] = await db.select().from(lpPagesTable).where(
    and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id))
  );
  if (!page) { res.status(404).json({ error: "Page not found" }); return; }
  if (page.status !== "pending_review") {
    res.status(409).json({ error: "Page is not pending review" });
    return;
  }

  const [updated] = await db
    .update(lpPagesTable)
    .set({
      status: "draft",
      lastReviewDecisionBy: req.authUser!.email,
      lastReviewDecisionAt: new Date(),
      lastReviewNote: note,
      submittedForReviewAt: null,
      submittedByUserId: null,
      updatedBy: req.authUser!.email,
    })
    .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id)))
    .returning();

  let asanaWarning: string | null = null;
  if (page.asanaTaskId) {
    const result = await commentAndCompleteTask({
      tenantId,
      pageId: id,
      taskId: page.asanaTaskId,
      comment: `Rejected by ${req.authUser!.email}: ${note}`,
    });
    if (!result.ok) asanaWarning = result.warning ?? null;
  }
  res.json({ page: updated, asanaWarning });
});

router.put("/lp/pages/:pageId", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  // Superadmins can edit any page (incl. global starter templates owned by
  // other tenants). For everyone else, ownership is enforced by tenantId.
  const isSuper = await isAppSuperadmin(req.authUser?.userId);
  const ownershipWhere = isSuper
    ? eq(lpPagesTable.id, id)
    : and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id));
  // Validate blocks array size
  if (Array.isArray(req.body.blocks) && req.body.blocks.length > 1000) {
    res.status(400).json({ error: "blocks array cannot exceed 1000 items" });
    return;
  }
  // Validate total request body size (roughly 10MB limit)
  const bodySize = JSON.stringify(req.body).length;
  if (bodySize > 10 * 1024 * 1024) {
    res.status(413).json({ error: "Request payload exceeds maximum size of 10MB" });
    return;
  }
  const { title, slug, blocks, status, customCss, metaTitle, metaDescription, ogImage, animationsEnabled, smoothScroll, pageVariables, audienceType, segmentId, allowIndexing, allowFollowing } = req.body as {
    title?: string;
    slug?: string;
    blocks?: unknown[];
    status?: string;
    customCss?: string;
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
    animationsEnabled?: boolean;
    smoothScroll?: boolean;
    pageVariables?: Record<string, string>;
    audienceType?: string | null;
    segmentId?: string | null;
    // Task #494 — tri-state robots overrides. null = inherit tenant default.
    allowIndexing?: boolean | null;
    allowFollowing?: boolean | null;
  };

  const updates: Partial<{ title: string; slug: string; blocks: unknown[]; status: string; customCss: string; metaTitle: string; metaDescription: string; ogImage: string; animationsEnabled: boolean; smoothScroll: boolean; pageVariables: Record<string, string>; audienceType: string | null; segmentId: string | null; allowIndexing: boolean | null; allowFollowing: boolean | null; updatedBy: string | null }> = {};
  if (title !== undefined) updates.title = title;
  if (slug !== undefined) {
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length !== 1) {
      res.status(400).json({ error: "slug must match /^[a-z0-9][a-z0-9-]*[a-z0-9]$/ or be a single character" });
      return;
    }
    if (slug.length > 255) {
      res.status(400).json({ error: "slug must be max 255 characters" });
      return;
    }
    updates.slug = slug;
  }
  if (blocks !== undefined) {
    // Task #120: same grid-piece gate as POST.
    const offending = findGridPieceInTree(blocks);
    if (offending && !(await userCanManageBlocks(req.authUser))) {
      res.status(403).json({ error: `Block type "${offending}" requires the blocks permission.` });
      return;
    }
    updates.blocks = blocks;
  }
  if (status !== undefined) {
    // Page-review gating (task #108). The PUT endpoint is only allowed to
    // change status when the caller holds publish perm — the dedicated
    // submit-review / approve / reject endpoints handle the other transitions
    // and have their own perm checks. We have to look up the current status
    // because we only want to gate transitions that would short-circuit the
    // review workflow (status NOOPs are still allowed).
    const [current] = await db
      .select({ status: lpPagesTable.status })
      .from(lpPagesTable)
      .where(ownershipWhere);
    if (current && current.status !== status) {
      const allowed = await userCanPublish(req.authUser, tenantId);
      if (!allowed) {
        res.status(403).json({ error: "You don't have permission to change page status. Submit for review instead." });
        return;
      }
    }
    updates.status = status;
  }
  if (customCss !== undefined) updates.customCss = sanitizeCSS(customCss);
  if (metaTitle !== undefined) updates.metaTitle = metaTitle;
  if (metaDescription !== undefined) updates.metaDescription = metaDescription;
  if (ogImage !== undefined) updates.ogImage = ogImage;
  if (animationsEnabled !== undefined) updates.animationsEnabled = animationsEnabled;
  if (smoothScroll !== undefined) updates.smoothScroll = smoothScroll;
  if (pageVariables !== undefined) updates.pageVariables = pageVariables;
  if (audienceType !== undefined) updates.audienceType = audienceType ?? null;
  if (segmentId !== undefined) updates.segmentId = segmentId ?? null;
  // Task #494 — accept tri-state robots overrides. An explicit `null` resets
  // the page back to "inherit tenant default", so we must distinguish
  // "field present" (write, possibly null) from "field absent" (leave as-is).
  // Enforce STRICT tri-state at the boundary: only boolean | null are valid.
  // No `!!` coercion — a stray string like "false" must 400, not silently
  // flip the page to allow-indexing.
  if (allowIndexing !== undefined) {
    if (allowIndexing !== null && typeof allowIndexing !== "boolean") {
      res.status(400).json({ error: "allowIndexing must be true, false, or null" });
      return;
    }
    updates.allowIndexing = allowIndexing;
  }
  if (allowFollowing !== undefined) {
    if (allowFollowing !== null && typeof allowFollowing !== "boolean") {
      res.status(400).json({ error: "allowFollowing must be true, false, or null" });
      return;
    }
    updates.allowFollowing = allowFollowing;
  }
  updates.updatedBy = req.authUser?.email ?? null;

  // Capture pre-update state so we can detect status transitions + slug
  // renames for the prerender cache lifecycle (task #364).
  const [preUpdate] = await db
    .select({ status: lpPagesTable.status, slug: lpPagesTable.slug })
    .from(lpPagesTable)
    .where(ownershipWhere);

  try {
    const [page] = await db
      .update(lpPagesTable)
      .set(updates)
      .where(ownershipWhere)
      .returning();
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    // Task #364: keep the prerendered HTML cache in sync with the row.
    //   • newly published → render
    //   • published → published with content changes → re-render
    //   • published → anything else → delete cached file
    //   • slug renamed while published → delete old slug's file, render new
    if (preUpdate) {
      const wasPublished = preUpdate.status === "published";
      const isPublished = page.status === "published";
      const slugChanged = preUpdate.slug !== page.slug;
      if (wasPublished && slugChanged) {
        triggerPublishedDelete(page.tenantId, preUpdate.slug);
      }
      if (isPublished) {
        triggerPublishedRender({ pageId: page.id, requestHost: getRequestHost(req) });
        // Task #806: fire-and-forget Content Series episode notifications.
        void handlePagePublishNotifications({
          tenantId: page.tenantId,
          pageId: page.id,
          requestHost: getRequestHost(req),
        });
      } else if (wasPublished) {
        triggerPublishedDelete(page.tenantId, page.slug);
      }
    }
    // Task #736: keep a template's gallery thumbnail fresh when its content or
    // styling changes. Debounced so rapid autosaves coalesce into one capture;
    // the old thumbnail stays visible until the new one is ready.
    if (page.isTemplate && (updates.blocks !== undefined || updates.customCss !== undefined)) {
      triggerTemplateThumbnailCapture({ pageId: page.id, requestHost: getRequestHost(req) });
    }
    res.json(page);
  } catch (err) {
    if (isDbError(err) && err.code === "23505") {
      res.status(409).json({ error: "A page with that slug already exists" });
    } else {
      res.status(500).json({ error: "Failed to update page" });
    }
  }
});

// Mark or unmark a page as a microsite template
router.patch("/lp/pages/:pageId/mark-template", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  const { isTemplate, templateLabel, templateDescription } = req.body as {
    isTemplate?: boolean;
    templateLabel?: string;
    templateDescription?: string;
  };

  try {
    const [page] = await db
      .update(lpPagesTable)
      .set({
        isTemplate: typeof isTemplate === "boolean" ? isTemplate : true,
        templateLabel: typeof templateLabel === "string" ? templateLabel.trim() : null,
        templateDescription: typeof templateDescription === "string" ? templateDescription.trim() : null,
      })
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id)))
      .returning();
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    // Task #736: when a page becomes a template, capture its gallery thumbnail.
    // Short debounce (vs. the autosave default) since this is a deliberate
    // one-shot action and the user expects a preview to appear shortly.
    if (page.isTemplate) {
      triggerTemplateThumbnailCapture({
        pageId: page.id,
        requestHost: getRequestHost(req),
        debounceMs: 2000,
      });
    }
    res.json(page);
  } catch (err) {
    console.error("mark-template error:", err);
    res.status(500).json({ error: "Failed to update template status" });
  }
});

// ── Account-name personalization on clone ────────────────────────────────────
// When a template is cloned and linked to an account, swap every reference to
// the template's "source" account (e.g. "DCA") with the target account's name
// (e.g. "Absolute Dental"). This is a pure string transform over block JSON —
// no AI involved — so the rewrite is fast, deterministic, and reversible.
const TITLE_STOP_WORDS = new Set([
  "copy", "of", "partner", "partners", "practice", "practices", "welcome",
  "pilot", "onboarding", "proposal", "template", "templates", "overview",
  "intro", "introduction", "kickoff", "launch", "case", "study", "studies",
  "brief", "summary", "update", "preview", "pitch", "sales", "sheet", "deck",
  "page", "microsite", "landing", "portal", "hub", "experience", "client",
  "corporate", "and", "for", "the", "a", "an", "with", "to",
]);

// Extract a likely "source account name" from a template title. Returns the
// leading run of capitalized tokens before the first generic stop-word — so
// "DCA Partner Practices" → "DCA", "North Star Dental Welcome" → "North Star
// Dental". Returns null when nothing usable is found.
function guessSourceNameFromTitle(rawTitle: string): string | null {
  const title = rawTitle.replace(/^copy of /i, "").trim();
  const tokens = title.split(/\s+/);
  const picked: string[] = [];
  for (const t of tokens) {
    const word = t.replace(/[^\p{L}\p{N}'&-]/gu, "");
    if (!word) break;
    if (TITLE_STOP_WORDS.has(word.toLowerCase())) break;
    // Only keep tokens that look like a proper noun (capitalized, all-caps,
    // or contain an internal capital). Reject lowercase connector words.
    if (!/^[A-Z]/.test(word) && !/[A-Z]/.test(word)) break;
    picked.push(word);
    if (picked.length >= 4) break;
  }
  const joined = picked.join(" ").trim();
  return joined.length >= 2 ? joined : null;
}

// Build a case-insensitive whole-word regex for the source name. Escapes regex
// metacharacters so names with "." or "&" are matched literally.
function buildNameMatcher(source: string): RegExp | null {
  const trimmed = source.trim();
  if (trimmed.length < 2) return null;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // \b doesn't play well with non-ASCII; use a manual boundary that allows
  // start-of-string and adjacency to whitespace/punctuation on either side.
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "giu");
}

// Recursively rewrite every string in a JSON tree, replacing the source name
// with the target name. Returns a structurally-new tree.
function rewriteAccountNameInTree(value: unknown, matcher: RegExp, target: string): unknown {
  if (typeof value === "string") {
    // Reset lastIndex because matchers are reused across many strings.
    matcher.lastIndex = 0;
    if (!matcher.test(value)) return value;
    matcher.lastIndex = 0;
    return value.replace(matcher, (_m, lead: string) => `${lead}${target}`);
  }
  if (Array.isArray(value)) {
    return value.map(v => rewriteAccountNameInTree(v, matcher, target));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = rewriteAccountNameInTree(v, matcher, target);
    }
    return out;
  }
  return value;
}

router.post("/lp/pages/:pageId/clone", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  // Source can be either a page/template owned by the caller's tenant, OR any
  // global template (is_global=true AND is_template=true). This mirrors the
  // visibility rule used by GET /lp/templates/enriched and the fromTemplateId
  // branch of POST /lp/pages, so cross-tenant global templates can be cloned
  // regardless of industry.
  const [source] = await db.select().from(lpPagesTable).where(
    and(
      eq(lpPagesTable.id, id),
      or(
        eq(lpPagesTable.tenantId, tenantId),
        and(
          eq(lpPagesTable.isGlobal, true),
          eq(lpPagesTable.isTemplate, true),
        ),
      ),
    )
  );
  if (!source) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  // Optional: link the clone to a specific account immediately
  const linkAccountId = req.body?.accountId ? Number(req.body.accountId) : null;

  // ── Resolve target + source names for automatic personalization ──
  // The caller may pass an explicit `sourceAccountName` to override the
  // heuristic. If not, we try the source page's linked account, then fall
  // back to a heuristic on the template title.
  let targetName: string | null = null;
  if (linkAccountId) {
    const [acct] = await db
      .select({ name: salesAccountsTable.name, displayName: salesAccountsTable.displayName })
      .from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, linkAccountId)));
    if (acct) targetName = (acct.displayName?.trim() || acct.name?.trim()) ?? null;
  }

  let sourceName: string | null = null;
  const explicitSource = typeof req.body?.sourceAccountName === "string"
    ? (req.body.sourceAccountName as string).trim()
    : "";
  if (explicitSource.length >= 2) {
    sourceName = explicitSource;
  } else if (source.accountId) {
    const [srcAcct] = await db
      .select({ name: salesAccountsTable.name, displayName: salesAccountsTable.displayName })
      .from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.tenantId, tenantId), eq(salesAccountsTable.id, source.accountId)));
    if (srcAcct) sourceName = (srcAcct.displayName?.trim() || srcAcct.name?.trim()) ?? null;
  }
  if (!sourceName) sourceName = guessSourceNameFromTitle(source.title);

  // Decide whether we have enough to do a rewrite. Skip when names match (no-op)
  // or when either side is missing.
  const shouldRewrite =
    !!targetName && !!sourceName && targetName.toLowerCase() !== sourceName.toLowerCase();

  const matcher = shouldRewrite ? buildNameMatcher(sourceName!) : null;
  const rewrittenBlocks = matcher
    ? rewriteAccountNameInTree(Array.isArray(source.blocks) ? source.blocks : [], matcher, targetName!) as unknown[]
    : (Array.isArray(source.blocks) ? source.blocks : []);

  // For metadata, do a fresh test per field so each one resets the regex state.
  function rewriteString(s: string): string {
    if (!matcher) return s;
    return rewriteAccountNameInTree(s, matcher, targetName!) as string;
  }
  const rewrittenMetaTitle = rewriteString(source.metaTitle ?? "");
  const rewrittenMetaDescription = rewriteString(source.metaDescription ?? "");

  // Title: when we're personalizing, prefer "<target> <rest-of-template-title>"
  // over "Copy of <template-title>" so the page title reads naturally.
  let newTitle: string;
  if (shouldRewrite) {
    const rewritten = rewriteString(source.title);
    newTitle = rewritten !== source.title ? rewritten : `${targetName} — ${source.title}`;
  } else {
    newTitle = `Copy of ${source.title}`;
  }

  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const [existing] = await db.select({ id: lpPagesTable.id }).from(lpPagesTable).where(and(eq(lpPagesTable.slug, slug), eq(lpPagesTable.tenantId, tenantId)));
    if (!existing) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  try {
    const [page] = await db
      .insert(lpPagesTable)
      .values({
        tenantId,
        title: newTitle,
        slug,
        blocks: rewrittenBlocks,
        status: "draft",
        customCss: source.customCss ?? "",
        metaTitle: rewrittenMetaTitle,
        metaDescription: rewrittenMetaDescription,
        ogImage: source.ogImage ?? "",
        animationsEnabled: source.animationsEnabled ?? true,
        smoothScroll: source.smoothScroll ?? true,
        pageVariables: (source.pageVariables && typeof source.pageVariables === "object" && !Array.isArray(source.pageVariables)) ? source.pageVariables as Record<string, string> : {},
        createdBy: req.authUser?.email ?? null,
        ...(linkAccountId ? { accountId: linkAccountId } : {}),
      })
      .returning();
    // Best-effort: record that this workspace just used the source template so
    // the library's "Recently Used" sort reflects it. Only template sources are
    // tracked, and the write must NEVER block or fail the clone — swallow errors.
    if (source.isTemplate) {
      try {
        await db
          .insert(lpTemplateUsageTable)
          .values({ tenantId, templateId: source.id, lastUsedAt: new Date() })
          .onConflictDoUpdate({
            target: [lpTemplateUsageTable.tenantId, lpTemplateUsageTable.templateId],
            set: { lastUsedAt: new Date() },
          });
      } catch (usageErr) {
        console.error("Template usage upsert failed (non-fatal):", String(usageErr));
      }
    }
    res.status(201).json({
      ...page,
      personalization: shouldRewrite
        ? { sourceName, targetName, applied: true }
        : { sourceName, targetName, applied: false },
    });
  } catch (err) {
    console.error("Clone page error:", err);
    res.status(500).json({ error: "Failed to clone page" });
  }
});

router.delete("/lp/pages/:pageId", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = parseInt(req.params.pageId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }
  // Capture slug/status BEFORE the delete so we can clean up the rendered
  // HTML file in object storage (task #364). DB row is the source of truth;
  // the cache is best-effort.
  const [pre] = await db
    .select({ slug: lpPagesTable.slug, status: lpPagesTable.status })
    .from(lpPagesTable)
    .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id)));
  await db.delete(lpPagesTable).where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id)));
  if (pre && pre.status === "published") {
    triggerPublishedDelete(tenantId, pre.slug);
  }
  res.json({ ok: true });
});

export default router;
