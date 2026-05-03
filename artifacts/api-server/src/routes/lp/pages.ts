import { getTenantId } from "../../middleware/requireAuth";
import type { AuthUser } from "../../middleware/requireAuth";
import { Router } from "express";
import { eq, asc, and, or, desc } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { lpPagesTable, lpPageReviewsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { tenantRequiresReview } from "../../lib/tenantSettings";
import { createReviewTask, commentAndCompleteTask } from "../../lib/asana";
import crypto from "node:crypto";

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
    const pages = await db
      .select()
      .from(lpPagesTable)
      .where(eq(lpPagesTable.tenantId, tenantId))
      .orderBy(lpPagesTable.createdAt);

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
router.get("/lp/templates", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res); if (tenantId === null) return;
    const ownedOnly = String(req.query.ownedOnly ?? "").toLowerCase() === "true";
    const visibility = ownedOnly
      ? eq(lpPagesTable.tenantId, tenantId)
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
        metaTitle: typeof metaTitle === "string" && metaTitle.length > 0 ? metaTitle : sourceMetaTitle,
        metaDescription: typeof metaDescription === "string" && metaDescription.length > 0 ? metaDescription : sourceMetaDescription,
        ogImage: typeof ogImage === "string" && ogImage.length > 0 ? ogImage : sourceOgImage,
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
  const { title, slug, blocks, status, customCss, metaTitle, metaDescription, ogImage, animationsEnabled, smoothScroll, pageVariables, audienceType, segmentId } = req.body as {
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
  };

  const updates: Partial<{ title: string; slug: string; blocks: unknown[]; status: string; customCss: string; metaTitle: string; metaDescription: string; ogImage: string; animationsEnabled: boolean; smoothScroll: boolean; pageVariables: Record<string, string>; audienceType: string | null; segmentId: string | null; updatedBy: string | null }> = {};
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
  updates.updatedBy = req.authUser?.email ?? null;

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
    res.json(page);
  } catch (err) {
    console.error("mark-template error:", err);
    res.status(500).json({ error: "Failed to update template status" });
  }
});

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
        title: `Copy of ${source.title}`,
        slug,
        blocks: Array.isArray(source.blocks) ? source.blocks : [],
        status: "draft",
        customCss: source.customCss ?? "",
        metaTitle: source.metaTitle ?? "",
        metaDescription: source.metaDescription ?? "",
        ogImage: source.ogImage ?? "",
        animationsEnabled: source.animationsEnabled ?? true,
        smoothScroll: source.smoothScroll ?? true,
        pageVariables: (source.pageVariables && typeof source.pageVariables === "object" && !Array.isArray(source.pageVariables)) ? source.pageVariables as Record<string, string> : {},
        createdBy: req.authUser?.email ?? null,
        ...(linkAccountId ? { accountId: linkAccountId } : {}),
      })
      .returning();
    res.status(201).json(page);
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
  await db.delete(lpPagesTable).where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, id)));
  res.json({ ok: true });
});

export default router;
