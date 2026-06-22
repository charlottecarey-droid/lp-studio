import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import multer from "multer";
import sharp from "sharp";
import OpenAI from "openai";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { tenantCanReadAcl, tenantIdFromAclOwner } from "../lib/objectAcl";
import { OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from "../lib/resolvePageOG";
import { db, lpMediaTable, tenantsTable, pool } from "@workspace/db";
import { asc, desc, eq, sql, ilike, and, count, inArray, type SQL } from "drizzle-orm";
import { resolveOwnedTenantIds, libraryReadablePredicate, isSharedOrGlobalAsset } from "../lib/libraryScope";
import { isProtectedEnterpriseSlug } from "../lib/planFeatures";
import { getTenantId, SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { requireSuperadmin } from "../middleware/requireSuperadmin";
import { readImageDimensions } from "../lib/imageDimensions";
import { autoTagImage, VALID_PURPOSES, isSocialCardDims, PROMO_GRAPHIC_TAG, type ImagePurpose } from "../lib/imageAutoTag";

/**
 * Read-only requester resolver for the storage serve route. Looks up the
 * session cookie directly and returns the caller's tenantId, or null for any
 * unauthenticated / invalid / expired-session case. Never writes to res, so
 * anonymous callers fall through cleanly to the public-serve path used by
 * published microsites embedding AI-generated images.
 */
async function resolveRequesterTenantId(req: Request): Promise<number | null> {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) return null;
  try {
    const result = await pool.query(
      `SELECT sess FROM app_sessions WHERE sid = $1 AND expire > now()`,
      [sid],
    );
    if (!result.rows.length) return null;
    const user = JSON.parse(result.rows[0].sess) as AuthUser;
    return user.tenantId ?? null;
  } catch {
    // Treat any session lookup failure as anonymous. The route already
    // applies the strictest fallback (allow public read for ACL'd objects)
    // and tenant-mismatch denial only kicks in when we successfully prove
    // the caller is a *different* tenant.
    return null;
  }
}

/**
 * Resolve the set of tenant ids whose media a given tenant should be allowed
 * to see/modify (the tenant's own + any sibling it explicitly shares a library
 * with). Returns null if no tenant context can be established.
 *
 * Sibling sharing is RECIPROCAL: A is treated as sharing with B only if both
 * `tenants[A].shares_library_with_tenant_id = B` AND
 * `tenants[B].shares_library_with_tenant_id = A`. A one-sided value is ignored,
 * so a misconfiguration on a single row cannot grant cross-tenant access.
 */
async function resolveLibraryTenantScope(req: Request, res: Response): Promise<{
  tenantId: number;
  ownedTenantIds: number[];
} | null> {
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return null;
  // Single source of truth for the reciprocal-sibling read ACL — shared with
  // the AI page/microsite generator (see lib/libraryScope.ts).
  const ownedTenantIds = await resolveOwnedTenantIds(tenantId);
  return { tenantId, ownedTenantIds };
}

/** WHERE clause for "I can mutate this row" — own tenant or sibling tenant only (not shared). */
function libraryWritablePredicate(ownedTenantIds: number[]): SQL<unknown> {
  return inArray(lpMediaTable.tenantId, ownedTenantIds);
}

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * Best-effort deletion of the underlying stored object backing a media row's
 * URL. Media URLs are stored as "/api/storage/objects/uploads/<id>"; we strip
 * the "/api/storage" serve prefix to recover the "/objects/..." path the
 * storage service understands. URLs that don't point at a stored object
 * (external/preloaded/legacy) are skipped, and a missing file is treated as
 * success — so reclaiming storage never blocks or fails the row delete.
 */
async function deleteStoredObjectForUrl(
  url: string | null | undefined,
  log: Request["log"],
): Promise<void> {
  if (!url || !url.startsWith("/api/storage/objects/")) return;
  const objectPath = url.slice("/api/storage".length);
  try {
    await objectStorageService.deleteObjectEntity(objectPath);
  } catch (err) {
    log.warn({ err, url }, "Failed to delete stored object for media row");
  }
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "image/avif", "image/heic", "image/heif", "image/svg+xml",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4", "video/webm", "video/ogg", "video/quicktime",
  "video/x-msvideo", "video/x-matroska",
]);

const ALLOWED_PDF_TYPES = new Set(["application/pdf"]);

const MAX_SIZE_BYTES = 200 * 1024 * 1024;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new Error("Only image files are allowed"));
    } else {
      cb(null, true);
    }
  },
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_VIDEO_TYPES.has(file.mimetype)) {
      cb(new Error("Only video files are allowed (MP4, WebM, OGG, MOV)"));
    } else {
      cb(null, true);
    }
  },
});

// The PDF upload accepts EITHER a raw multipart `file` part OR a base64-encoded
// `fileBase64` text field. The base64 path exists because the Cloudflare edge
// WAF in front of custom-domain tenant hosts 403s POSTs carrying a raw PDF
// binary before they reach the origin (see lp-studio's pdf-upload.ts). A 50 MB
// PDF base64-encodes to ~66.7 MB, so `fieldSize` is raised accordingly while the
// decoded buffer is still capped at 50 MB in the handler.
const PDF_MAX_BYTES = 50 * 1024 * 1024;
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PDF_MAX_BYTES, fieldSize: 70 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_PDF_TYPES.has(file.mimetype)) {
      cb(new Error("Only PDF files are allowed"));
    } else {
      cb(null, true);
    }
  },
});

const PRELOADED_VIDEOS = [
  {
    id: "preloaded-dandy-digital-lab",
    title: "Dandy Digital Lab",
    url: "/videos/dandy-digital-lab.mp4",
    mediaType: "video",
    mimeType: "video/mp4",
    isPreloaded: true,
    sizeBytes: null as number | null,
    createdAt: new Date("2025-01-01").toISOString(),
  },
  {
    id: "preloaded-dandy-lab-video",
    title: "Dandy Lab Animation",
    url: "/videos/dandy-lab-video.mp4",
    mediaType: "video",
    mimeType: "video/mp4",
    isPreloaded: true,
    sizeBytes: null as number | null,
    createdAt: new Date("2025-01-01").toISOString(),
  },
  {
    id: "preloaded-dandy-broll",
    title: "Dandy B-Roll (No Text)",
    url: "/videos/dandy-broll.mp4",
    mediaType: "video",
    mimeType: "video/mp4",
    isPreloaded: true,
    sizeBytes: null as number | null,
    createdAt: new Date("2025-01-01").toISOString(),
  },
  {
    id: "preloaded-dandy-website-animation",
    title: "Dandy Website Animation",
    url: "/dandy-lab-video-2/",
    mediaType: "video",
    mimeType: "text/html",
    isPreloaded: true,
    sizeBytes: null as number | null,
    createdAt: new Date("2025-01-01").toISOString(),
  },
  {
    id: "preloaded-ai-scan-review",
    title: "AI Scan Review",
    url: "/videos/ai-scan-review.mp4",
    mediaType: "video",
    mimeType: "video/mp4",
    isPreloaded: true,
    sizeBytes: null as number | null,
    createdAt: new Date("2025-01-01").toISOString(),
  },
  ...[
    ["scan-overhead", "Intraoral Scan — Overhead"],
    ["scan-soft-tissue", "Intraoral Scan — Soft Tissue"],
    ["scan-arch-rotate", "Intraoral Scan — Arch Rotate"],
    ["scan-arch-vertical", "Intraoral Scan — Arch Close-Up (Vertical)"],
    ["scan-zoom-detail", "Intraoral Scan — Zoom Detail"],
    ["scan-finish", "Intraoral Scan — Finish & Confirm"],
    ["scan-wand-pass", "Intraoral Scan — Wand Pass"],
    ["scan-wand-vertical", "Intraoral Scan — Wand Close-Up (Vertical)"],
  ].map(([slug, title]) => ({
    id: `preloaded-${slug}`,
    title,
    url: `/videos/${slug}.mp4`,
    mediaType: "video",
    mimeType: "video/mp4",
    isPreloaded: true,
    sizeBytes: null as number | null,
    createdAt: new Date("2025-01-01").toISOString(),
  })),
  ...[
    ["brooke-sears", "Testimonial — Brooke Sears, RDA"],
    ["dr-michael-cabral", "Testimonial — Dr. Michael Cabral"],
    ["dr-raj-patel", "Testimonial — Dr. Raj Patel"],
    ["dr-alexander-linares", "Testimonial — Dr. Alexander Linares"],
    ["dr-daniel-bures", "Testimonial — Dr. Daniel Bures"],
    ["dr-jessica-krausz", "Testimonial — Dr. Jessica Krausz"],
    ["dr-tiffanie-garrison-jeter", "Testimonial — Dr. Tiffanie Garrison-Jeter"],
    ["dr-johnimel-bianco", "Testimonial — Dr. Johnimel Bianco"],
  ].map(([slug, title]) => ({
    id: `preloaded-${slug}`,
    title,
    url: `/videos/${slug}.mp4`,
    mediaType: "video",
    mimeType: "video/mp4",
    isPreloaded: true,
    sizeBytes: null as number | null,
    createdAt: new Date("2025-01-01").toISOString(),
  })),
];

/** Re-classify just the purpose (lp-hero/lp-feature/product-detail/og-image) for an image that already has content tags.
 *  Much lighter than full autoTagImage — only updates the purpose prefix tag.
 */
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Outcome of a single purpose-classification attempt, so the batch loop can
 *  log progress and react to rate limiting instead of silently giving up. */
type ClassifyResult = "tagged" | "skipped" | "no-config" | "rate-limited" | "error";

async function classifyPurposeOnly(mediaId: number, imageBuffer: Buffer, mimeType: string, existingTags: string[]): Promise<ClassifyResult> {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) return "no-config";

  // The OpenAI SDK auto-retries 429/5xx with exponential backoff, honoring the
  // Retry-After header. Without a raised maxRetries the batch reclassify bursts
  // past the AI proxy's rate limit after ~20 images; every later call then 429s
  // and (previously, behind a silent catch) failed invisibly — the "only tags 20
  // then stops" bug.
  const openai = new OpenAI({ baseURL, apiKey, maxRetries: 6, timeout: 30_000 });
  const base64 = imageBuffer.toString("base64");
  const dataUri = `data:${mimeType};base64,${base64}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 20,
      messages: [
        {
          role: "system",
          content:
            `Classify this image's landing page purpose. Reply with ONLY one of these exact strings:
lp-hero        → lifestyle, people, smiles, clinic/team environment, before-after results — good as a landing page hero
lp-feature     → clean product/procedure angle, moderate close-up, good for a feature section
product-detail → extreme close-up, technical diagram, spec illustration, guide graphic — not suitable as a hero
og-image       → any of: social-sharing / Open Graph card, text or logo overlaid on a background image, website screenshot, promotional ad creative, advertisement banner, call-to-action graphic, marketing card with text overlays, or any composite design with significant text NOT suitable as a standalone editorial photo. Choose og-image when in doubt for images with text.`,
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUri, detail: "low" } },
            { type: "text", text: "Reply with only the purpose string." },
          ],
        },
      ],
    });

    const raw = (completion.choices[0]?.message?.content?.trim() ?? "").toLowerCase();
    const staleTagSet = new Set([...VALID_PURPOSES as readonly string[], "og-image", PROMO_GRAPHIC_TAG]);

    if (raw.includes("og-image")) {
      // Geometry gate before the hard exclusion (mirrors autoTagImage): only a
      // TRUE social-card shape (~1200x630 / >=1.8 aspect under 1400px wide)
      // earns the "og-image" exclusion tag. A text-heavy promo graphic at
      // content geometry — e.g. a fashion brand's imported homepage banners —
      // is re-tagged "promo-graphic" so it stays eligible for AI generation.
      // This is exactly what lets "Re-scan all (fix OG images)" heal rows the
      // old classifier blanket-tagged "og-image". Unknown dimensions stay
      // conservative (og-image).
      const dims = await readImageDimensions(imageBuffer, mimeType);
      const socialCard = isSocialCardDims(dims?.width, dims?.height);
      const cleanedTags = existingTags.filter(t => !staleTagSet.has(t));
      const merged = [socialCard === false ? PROMO_GRAPHIC_TAG : "og-image", ...cleanedTags].slice(0, 11);
      await db.update(lpMediaTable).set({ tags: merged }).where(eq(lpMediaTable.id, mediaId));
      return "tagged";
    }

    const purpose = VALID_PURPOSES.find(p => raw.includes(p));
    if (!purpose) return "skipped";

    // Remove any stale purpose/og tags, prepend new one
    const cleanedTags = existingTags.filter(t => !staleTagSet.has(t));
    const merged = [purpose, ...cleanedTags].slice(0, 11);
    await db.update(lpMediaTable).set({ tags: merged }).where(eq(lpMediaTable.id, mediaId));
    return "tagged";
  } catch (err) {
    const status = (err as { status?: number } | null)?.status;
    return status === 429 ? "rate-limited" : "error";
  }
}

/** Purpose/og tags that mark an image as "already classified". Includes
 *  "promo-graphic" so a non-force run converges instead of re-classifying the
 *  same promo rows every pass (a force re-scan still revisits them). */
const ALL_PURPOSE_TAGS = new Set([...VALID_PURPOSES as readonly string[], "og-image", PROMO_GRAPHIC_TAG]);

/** Max images a single /lp/media/classify-batch call will process. The client
 *  drives the whole library by calling repeatedly in chunks of this size. */
const CLASSIFY_BATCH_MAX = 20;

/**
 * "Classify for AI" — discovery step. Returns the ids of the CALLER'S OWN images
 * that still need a landing-page purpose tag, so the client can drive
 * classification in bounded batches (POST /lp/media/classify-batch), show real
 * progress, and resume after any interruption. `?force=true` returns ALL of the
 * tenant's images (re-scan to fix mis-tagged OG/social images).
 *
 * Tenant-scoped (own + reciprocal-sibling library rows only — never shared/global
 * rows) and authenticated via the normal tenant session, so every tenant can
 * classify their own library to improve AI page-generation relevance.
 *
 * Replaces the old superadmin-only GLOBAL background loop, which ran across every
 * tenant, died silently on any API restart, and abandoned images once the AI
 * proxy rate-limited (~20 in — the "stops at 20" bug).
 */
router.get("/lp/media/classify-targets", async (req: Request, res: Response) => {
  try {
    const scope = await resolveLibraryTenantScope(req, res);
    if (!scope) { res.status(401).json({ error: "Not authenticated" }); return; }
    const force = req.query.force === "true";

    const rows = await db
      .select({ id: lpMediaTable.id, tags: lpMediaTable.tags })
      .from(lpMediaTable)
      .where(and(libraryWritablePredicate(scope.ownedTenantIds), eq(lpMediaTable.mediaType, "image")));

    const ids = (force
      ? rows
      : rows.filter(r => {
          const tags = (r.tags as string[]) ?? [];
          return !tags.some(t => ALL_PURPOSE_TAGS.has(t));
        })
    ).map(r => r.id);

    res.json({ ids, total: ids.length, force });
  } catch (error) {
    req.log.error({ err: error }, "classify-targets failed");
    res.status(500).json({ error: "Failed to list images to classify" });
  }
});

/**
 * Classify ONE bounded batch (max CLASSIFY_BATCH_MAX) of the caller's own images.
 * Synchronous: returns a per-id status so the client can advance progress and
 * re-queue any id that came back "rate-limited" — the batch never silently drops
 * an image. Ownership is re-verified against the caller's tenant scope for every
 * id, so a client cannot classify another tenant's media by passing foreign ids.
 *
 * Under sustained rate limiting the loop stops early and reports the remaining
 * ids as "rate-limited", keeping the HTTP request bounded; the client backs off
 * and retries them in a later batch.
 */
router.post("/lp/media/classify-batch", async (req: Request, res: Response) => {
  try {
    const scope = await resolveLibraryTenantScope(req, res);
    if (!scope) { res.status(401).json({ error: "Not authenticated" }); return; }

    const rawIds: unknown = req.body?.ids;
    const ids = Array.isArray(rawIds)
      ? [...new Set(rawIds.filter((n): n is number => Number.isInteger(n)))].slice(0, CLASSIFY_BATCH_MAX)
      : [];
    if (ids.length === 0) { res.json({ results: [] }); return; }

    // Re-fetch ONLY rows the caller owns — never trust the client's id list.
    const rows = await db
      .select({ id: lpMediaTable.id, url: lpMediaTable.url, mimeType: lpMediaTable.mimeType, tags: lpMediaTable.tags })
      .from(lpMediaTable)
      .where(and(
        libraryWritablePredicate(scope.ownedTenantIds),
        eq(lpMediaTable.mediaType, "image"),
        inArray(lpMediaTable.id, ids),
      ));

    const port = process.env.PORT ?? "8080";
    const results: { id: number; status: ClassifyResult }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let status: ClassifyResult;
      try {
        const resp = await fetch(`http://localhost:${port}${row.url}`);
        if (!resp.ok) { results.push({ id: row.id, status: "error" }); continue; }
        const buffer = Buffer.from(await resp.arrayBuffer());
        const mimeType = row.mimeType ?? "image/jpeg";
        status = await classifyPurposeOnly(row.id, buffer, mimeType, (row.tags as string[]) ?? []);
        // One short in-request retry smooths a transient 429.
        if (status === "rate-limited") {
          await sleep(3_000);
          status = await classifyPurposeOnly(row.id, buffer, mimeType, (row.tags as string[]) ?? []);
        }
      } catch (err) {
        req.log.warn({ err, mediaId: row.id }, "classify-batch: image failed");
        status = "error";
      }
      results.push({ id: row.id, status });

      if (status === "no-config") {
        // AI integration unavailable — pointless to keep trying this batch.
        for (const r of rows.slice(i + 1)) results.push({ id: r.id, status: "no-config" });
        break;
      }
      if (status === "rate-limited") {
        // Proxy saturated — stop now and report the rest as rate-limited so the
        // client backs off and retries them (keeps this request bounded).
        for (const r of rows.slice(i + 1)) results.push({ id: r.id, status: "rate-limited" });
        break;
      }
      // Gentle throttle keeps the batch under the proxy's per-minute rate limit.
      await sleep(200);
    }

    res.json({ results });
  } catch (error) {
    req.log.error({ err: error }, "classify-batch failed");
    res.status(500).json({ error: "Failed to classify batch" });
  }
});

router.post("/lp/upload", (req: Request, res: Response) => {
  imageUpload.single("file")(req, res, async (err) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum size is 30 MB."
        : (err as Error).message ?? "Upload failed";
      res.status(400).json({ error: message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    try {
      const servePath = await objectStorageService.uploadObjectEntity(
        req.file.buffer,
        req.file.mimetype,
      );
      const serveUrl = `/api/storage${servePath}`;
      const title = req.file.originalname?.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") ?? "Untitled";

      // Parse any folder-derived tags sent by the client
      let folderTags: string[] = [];
      const rawFolderTags = req.body?.folderTags;
      if (typeof rawFolderTags === "string" && rawFolderTags.length > 0) {
        folderTags = rawFolderTags.split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean);
      }

      // Save to media table so it appears in the library
      const tenantId = getTenantId(req, res);
      if (tenantId == null) return;
      // Capture intrinsic pixel dimensions so the AI page generator can refuse
      // undersized images as full-bleed hero backgrounds (task #1065).
      const dims = await readImageDimensions(req.file.buffer, req.file.mimetype);
      const [record] = await db.insert(lpMediaTable).values({
        tenantId,
        title,
        url: serveUrl,
        mediaType: "image",
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        tags: folderTags,
      }).returning();

      // Auto-tag in the background — merges AI tags with existing folder tags
      setImmediate(() => autoTagImage(record.id, req.file!.buffer, req.file!.mimetype, folderTags));

      res.json({ url: servePath, mediaId: record.id });
    } catch (error) {
      req.log.error({ err: error }, "Error uploading LP image");
      res.status(500).json({ error: "Upload failed" });
    }
  });
});

/**
 * Admin-only image upload. Requires superadmin session (requireSuperadmin),
 * so it does NOT require a tenant session.
 *
 * Default behaviour: uploads land in the shared "starter" library
 *   (tenant_id = NULL, is_shared = true) — visible to every tenant.
 * If `tenantId` is provided in the form body, the upload is scoped to that
 *   tenant only (used for one-time backfills like re-homing the Dandy product
 *   photos out of the JS bundle).
 *
 * Body (multipart/form-data):
 *   file:       the image (jpg/png/gif/webp/avif/heic/heif, max 30 MB)
 *   title?:     friendly title (defaults to filename without extension)
 *   tags?:      comma-separated tag list (e.g. "workspace,team,office")
 *   tenantId?:  numeric tenant id to scope the upload to. Omit for shared.
 */
router.post("/lp/media/shared/upload", requireSuperadmin, (req: Request, res: Response) => {
  imageUpload.single("file")(req, res, async (err) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum size is 30 MB."
        : (err as Error).message ?? "Upload failed";
      res.status(400).json({ error: message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    try {
      const servePath = await objectStorageService.uploadObjectEntity(
        req.file.buffer,
        req.file.mimetype,
      );
      const serveUrl = `/api/storage${servePath}`;
      const rawTitle = (req.body as { title?: string }).title;
      const title = (rawTitle && rawTitle.trim())
        || (req.file.originalname?.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") ?? "Untitled");

      let tags: string[] = [];
      const rawTags = (req.body as { tags?: string }).tags;
      if (typeof rawTags === "string" && rawTags.length > 0) {
        tags = rawTags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
      }

      const rawTenantId = (req.body as { tenantId?: string }).tenantId;
      let tenantId: number | null = null;
      let isShared = true;
      if (rawTenantId !== undefined && rawTenantId !== "") {
        const parsed = parseInt(String(rawTenantId), 10);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          res.status(400).json({ error: "Invalid tenantId" });
          return;
        }
        tenantId = parsed;
        isShared = false;
      }

      // Capture intrinsic pixel dimensions (task #1065) — same as the
      // tenant upload route above.
      const dims = await readImageDimensions(req.file.buffer, req.file.mimetype);
      const [record] = await db.insert(lpMediaTable).values({
        tenantId,
        title,
        url: serveUrl,
        mediaType: "image",
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        tags,
        isShared,
      }).returning();

      res.json({ id: record.id, url: serveUrl, title: record.title, tenantId, isShared });
    } catch (error) {
      req.log.error({ err: error }, "Error uploading shared image");
      res.status(500).json({ error: "Upload failed" });
    }
  });
});

/**
 * Task #967 — server-side sharp center-crop to the canonical OG share-card
 * size (1200×630). The client uploads the raw image BYTES directly (multipart),
 * so we never fetch an attacker-supplied URL server-side (no SSRF surface).
 * The crop uses `fit: "cover", position: "centre"` — a sharp, lossless-quality
 * center crop that fills the frame exactly without distortion — then uploads to
 * object storage and returns the served URL plus the fixed dimensions.
 *
 * Body (multipart/form-data):
 *   file: the source image (jpg/png/gif/webp/avif/heic/heif, max 30 MB)
 *
 * Response: { url, width: 1200, height: 630 }
 */
router.post("/lp/og-image/resize", (req: Request, res: Response) => {
  imageUpload.single("file")(req, res, async (err) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum size is 30 MB."
        : (err as Error).message ?? "Upload failed";
      res.status(400).json({ error: message });
      return;
    }
    // The resize endpoint is tenant-scoped — anonymous callers have no business
    // generating share cards. getTenantId writes the 401/403 on failure.
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    try {
      const resized = await sharp(req.file.buffer)
        .resize({ width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, fit: "cover", position: "centre" })
        .png()
        .toBuffer();
      const servePath = await objectStorageService.uploadObjectEntity(resized, "image/png");
      const serveUrl = `/api/storage${servePath}`;
      res.json({ url: serveUrl, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT });
    } catch (error) {
      req.log.error({ err: error }, "Error resizing OG share-card image");
      res.status(400).json({ error: "Could not process this image. Please try a different file." });
    }
  });
});

/**
 * Task #1110 — auto-generate a square browser-tab favicon from the tenant's
 * existing logo. The client fetches its own logo into a blob and uploads the
 * raw BYTES (multipart), so we never fetch an attacker-supplied URL server-side
 * (same no-SSRF posture as the OG resize endpoint above).
 *
 * sharp pads the logo onto a transparent square canvas (`fit: "contain"`) at
 * 256×256 — preserving the whole mark without distortion or cropping — and
 * emits a PNG. SVG inputs are rasterized at a higher density for a crisp icon.
 * The result is stored just like a manual favicon upload, so all downstream
 * injection (snapshot + live view) works unchanged.
 *
 * Body (multipart/form-data):
 *   file: the source logo (svg/png/jpg/gif/webp/avif, max 30 MB)
 *
 * Response: { url, width: 256, height: 256 }
 */
router.post("/lp/favicon/from-logo", (req: Request, res: Response) => {
  imageUpload.single("file")(req, res, async (err) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum size is 30 MB."
        : (err as Error).message ?? "Upload failed";
      res.status(400).json({ error: message });
      return;
    }
    // Tenant-scoped — anonymous callers have no business generating favicons.
    // getTenantId writes the 401/403 on failure.
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    try {
      const FAVICON_SIZE = 256;
      // Higher density only affects vector (SVG) inputs — gives a crisp raster.
      const favicon = await sharp(req.file.buffer, { density: 384 })
        .resize({
          width: FAVICON_SIZE,
          height: FAVICON_SIZE,
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      const servePath = await objectStorageService.uploadObjectEntity(favicon, "image/png");
      const serveUrl = `/api/storage${servePath}`;
      res.json({ url: serveUrl, width: FAVICON_SIZE, height: FAVICON_SIZE });
    } catch (error) {
      req.log.error({ err: error }, "Error generating favicon from logo");
      res.status(400).json({ error: "Could not generate a favicon from this logo. Please try a different image." });
    }
  });
});

router.post("/lp/media/upload", (req: Request, res: Response) => {
  videoUpload.single("file")(req, res, async (err) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum size is 200 MB."
        : (err as Error).message ?? "Upload failed";
      res.status(400).json({ error: message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    try {
      const servePath = await objectStorageService.uploadObjectEntity(
        req.file.buffer,
        req.file.mimetype,
      );
      const serveUrl = `/api/storage${servePath}`;
      const title = (req.body as { title?: string }).title
        ?? req.file.originalname.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");

      const tenantId = getTenantId(req, res);
      if (tenantId == null) return;
      const [record] = await db.insert(lpMediaTable).values({
        tenantId,
        title,
        url: serveUrl,
        mediaType: "video",
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      }).returning();

      res.json({
        id: String(record.id),
        title: record.title,
        url: record.url,
        mediaType: record.mediaType,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        isPreloaded: false,
        createdAt: record.createdAt.toISOString(),
      });
    } catch (error) {
      req.log.error({ err: error }, "Error uploading video");
      res.status(500).json({ error: "Upload failed" });
    }
  });
});

router.post("/lp/pdf/upload", (req: Request, res: Response) => {
  pdfUpload.single("file")(req, res, async (err) => {
    if (err) {
      const tooLarge = err instanceof multer.MulterError
        && (err.code === "LIMIT_FILE_SIZE" || err.code === "LIMIT_FIELD_VALUE");
      const message = tooLarge
        ? "File too large. Maximum size is 50 MB."
        : (err as Error).message ?? "Upload failed";
      res.status(400).json({ error: message });
      return;
    }

    // Resolve the PDF bytes from either the raw multipart `file` part or the
    // base64 `fileBase64` field (WAF-evasion path — see pdfUpload comment).
    let buffer: Buffer;
    let originalName: string;
    const fileBase64 = typeof req.body?.fileBase64 === "string" ? req.body.fileBase64 : "";
    if (req.file) {
      buffer = req.file.buffer;
      originalName = req.file.originalname ?? "document.pdf";
    } else if (fileBase64) {
      const base64 = (fileBase64.includes(",") ? fileBase64.slice(fileBase64.indexOf(",") + 1) : fileBase64)
        .replace(/\s+/g, "");
      // Buffer.from(..., "base64") silently drops invalid characters, so a
      // malformed payload could still decode to bytes that pass the %PDF- check.
      // Reject anything that isn't strict, correctly-padded base64 up front.
      const isStrictBase64 =
        base64.length > 0 &&
        base64.length % 4 === 0 &&
        /^[A-Za-z0-9+/]+={0,2}$/.test(base64);
      if (!isStrictBase64) {
        res.status(400).json({ error: "Invalid file encoding" });
        return;
      }
      buffer = Buffer.from(base64, "base64");
      // Round-trip check: a valid base64 string re-encodes to itself. Catches
      // any residual malformed input Node tolerated during decode.
      if (buffer.toString("base64") !== base64) {
        res.status(400).json({ error: "Invalid file encoding" });
        return;
      }
      if (buffer.length === 0) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }
      if (buffer.length > PDF_MAX_BYTES) {
        res.status(400).json({ error: "File too large. Maximum size is 50 MB." });
        return;
      }
      // Verify the decoded bytes are actually a PDF (the base64 path bypasses
      // multer's mime fileFilter, so validate the magic number here).
      if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
        res.status(400).json({ error: "Only PDF files are allowed" });
        return;
      }
      originalName = typeof req.body?.filename === "string" && req.body.filename
        ? req.body.filename
        : "document.pdf";
    } else {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      const servePath = await objectStorageService.uploadObjectEntity(
        buffer,
        "application/pdf",
      );
      const serveUrl = `/api/storage${servePath}`;
      const title = originalName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ") || "Untitled";

      const tenantId = getTenantId(req, res);
      if (tenantId == null) return;
      const [record] = await db.insert(lpMediaTable).values({
        tenantId,
        title,
        url: serveUrl,
        mediaType: "pdf",
        mimeType: "application/pdf",
        sizeBytes: buffer.length,
        tags: [],
      }).returning();

      res.json({
        id: String(record.id),
        title: record.title,
        url: record.url,
        mediaType: record.mediaType,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        createdAt: record.createdAt.toISOString(),
      });
    } catch (error) {
      req.log.error({ err: error }, "Error uploading PDF");
      res.status(500).json({ error: "Upload failed" });
    }
  });
});

router.get("/lp/media", async (req: Request, res: Response) => {
  try {
    const scope = await resolveLibraryTenantScope(req, res);
    if (!scope) return;
    const mediaTypeFilter = typeof req.query.mediaType === "string" ? req.query.mediaType : "video";
    const uploaded = await db.select().from(lpMediaTable)
      .where(libraryReadablePredicate(scope.ownedTenantIds))
      .orderBy(desc(lpMediaTable.createdAt));

    const uploadedItems = uploaded
      .filter(r => r.mediaType === mediaTypeFilter)
      .map(r => ({
        id: String(r.id),
        title: r.title,
        url: r.url,
        mediaType: r.mediaType,
        mimeType: r.mimeType,
        sizeBytes: r.sizeBytes,
        isPreloaded: false,
        createdAt: r.createdAt.toISOString(),
      }));

    // The preloaded library is the Dandy-branded video set (lab / intraoral
    // scan / doctor-testimonial clips). It must only surface for the Dandy
    // workspaces — Dandy Enterprise + Dandy SMB, the reciprocal sibling pair
    // that also shares the uploaded image library. Every other tenant gets
    // none of them, so Dandy's videos never leak into a partner / customer
    // media drawer.
    const tenantRow = await db
      .select({ slug: tenantsTable.slug })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, scope.tenantId))
      .limit(1);
    const tenantSlug = tenantRow[0]?.slug ?? null;
    const isDandyTenant = isProtectedEnterpriseSlug(tenantSlug);

    const preloaded = isDandyTenant
      ? PRELOADED_VIDEOS.filter(v => v.mediaType === mediaTypeFilter)
      : [];

    res.json({ items: [...preloaded, ...uploadedItems] });
  } catch (error) {
    req.log.error({ err: error }, "Error listing media");
    res.status(500).json({ error: "Failed to list media" });
  }
});

/** Browse image library with optional search query and tag filter */
router.get("/lp/media/images", async (req: Request, res: Response) => {
  try {
    const scope = await resolveLibraryTenantScope(req, res);
    if (!scope) return;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
    const excludeTag = typeof req.query.excludeTag === "string" ? req.query.excludeTag.trim() : "";
    const onlyTag = typeof req.query.onlyTag === "string" ? req.query.onlyTag.trim() : "";
    const pageNum = Math.max(1, parseInt(typeof req.query.page === "string" ? req.query.page : "1") || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(typeof req.query.limit === "string" ? req.query.limit : "48") || 48));

    // Build SQL conditions — tenant scope first so we never leak cross-tenant rows.
    const conditions = [
      libraryReadablePredicate(scope.ownedTenantIds),
      eq(lpMediaTable.mediaType, "image"),
    ];
    // Search matches the title OR any tag (case-insensitive substring). Most
    // uploaded/scraped product images have hash-y or generic titles with the
    // real subject living in `tags` (e.g. "crown", "veneers"), so a title-only
    // search silently returned nothing for them.
    if (q) {
      const like = `%${q}%`;
      conditions.push(
        sql`(${lpMediaTable.title} ILIKE ${like} OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(${lpMediaTable.tags}, '[]'::jsonb)) AS qt(val)
          WHERE qt.val ILIKE ${like}
        ))`
      );
    }
    if (tag) conditions.push(sql`${lpMediaTable.tags}::jsonb @> ${JSON.stringify([tag])}::jsonb`);
    // excludeTag: hide images that have this tag (e.g. "og-image")
    if (excludeTag) conditions.push(sql`NOT (${lpMediaTable.tags}::jsonb @> ${JSON.stringify([excludeTag])}::jsonb)`);
    // onlyTag: show ONLY images that have this tag
    if (onlyTag) conditions.push(sql`${lpMediaTable.tags}::jsonb @> ${JSON.stringify([onlyTag])}::jsonb`);
    const where = and(...conditions);

    // Paginated items
    const rows = await db
      .select()
      .from(lpMediaTable)
      .where(where)
      .orderBy(asc(lpMediaTable.isShared), desc(lpMediaTable.createdAt))
      .limit(limitNum)
      .offset((pageNum - 1) * limitNum);

    // Total count (for pagination)
    const [{ total }] = await db
      .select({ total: count() })
      .from(lpMediaTable)
      .where(where);

    // All tags for the category sidebar — same conditions applied so tags reflect the filtered set
    const allTagRows = await db
      .select({ tags: lpMediaTable.tags })
      .from(lpMediaTable)
      .where(where);

    const tagMap = new Map<string, number>();
    for (const row of allTagRows) {
      for (const t of (row.tags as string[]) ?? []) {
        tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
      }
    }
    const tagCounts = [...tagMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));

    const items = rows.map(r => ({
      id: r.id,
      title: r.title,
      url: r.url,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      tags: (r.tags as string[]) ?? [],
      createdAt: r.createdAt.toISOString(),
    }));

    const totalNum = Number(total);
    res.json({
      items,
      tagCounts,
      total: totalNum,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(totalNum / limitNum)),
    });
  } catch (error) {
    req.log.error({ err: error }, "Error listing images");
    res.status(500).json({ error: "Failed to list images" });
  }
});

/**
 * Suggest content images from the tenant's media library by tag/keyword match.
 * Powers the "Auto-fill from library" button on a product's content images in
 * Brand Settings: given the product name + keywords, return the best-matching
 * library images (ranked by how many query tokens hit each image's title/tags).
 *
 * Tenant-scoped. Never returns logos, OG images, or hero-tagged images (those
 * aren't content imagery). Hard-capped at 5 so a product can't pull in dozens.
 */
const SUGGEST_EXCLUDE_TAGS = ["logo", "og-image", "lp-hero"] as const;
const SUGGEST_STOPWORDS = new Set([
  "the", "and", "for", "with", "our", "your", "from", "that", "this", "are",
  "you", "all", "new", "get", "use", "best", "more", "into", "over",
]);
router.post("/lp/media/suggest", async (req: Request, res: Response) => {
  try {
    const scope = await resolveLibraryTenantScope(req, res);
    if (!scope) return;
    const body = (req.body ?? {}) as { query?: unknown; keywords?: unknown; exclude?: unknown; limit?: unknown };
    const queryStr = typeof body.query === "string" ? body.query : "";
    const keywords = Array.isArray(body.keywords) ? body.keywords.filter((k): k is string => typeof k === "string") : [];
    const exclude = new Set(Array.isArray(body.exclude) ? body.exclude.filter((u): u is string => typeof u === "string") : []);
    const limit = Math.min(5, Math.max(1, typeof body.limit === "number" ? Math.floor(body.limit) : 5));

    // Tokenize the product name + keywords into significant lowercase words.
    const tokens = [...new Set(
      [queryStr, ...keywords]
        .join(" ")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3 && !SUGGEST_STOPWORDS.has(t)),
    )];
    if (tokens.length === 0) {
      res.json({ urls: [] });
      return;
    }

    const conditions = [
      libraryReadablePredicate(scope.ownedTenantIds),
      eq(lpMediaTable.mediaType, "image"),
    ];
    for (const t of SUGGEST_EXCLUDE_TAGS) {
      conditions.push(sql`NOT (${lpMediaTable.tags}::jsonb @> ${JSON.stringify([t])}::jsonb)`);
    }
    const rows = await db
      .select({ url: lpMediaTable.url, title: lpMediaTable.title, tags: lpMediaTable.tags, createdAt: lpMediaTable.createdAt })
      .from(lpMediaTable)
      .where(and(...conditions))
      .orderBy(asc(lpMediaTable.isShared), desc(lpMediaTable.createdAt));

    // Score by distinct query tokens that appear in the title or any tag. Tag
    // hits weigh slightly higher than title hits (tags are curated subjects).
    const scored = rows
      .map((r) => {
        if (exclude.has(r.url)) return null;
        const title = (r.title ?? "").toLowerCase();
        const tagText = ((r.tags as string[]) ?? []).join(" ").toLowerCase();
        let score = 0;
        for (const t of tokens) {
          if (tagText.includes(t)) score += 2;
          else if (title.includes(t)) score += 1;
        }
        return score > 0 ? { url: r.url, score } : null;
      })
      .filter((x): x is { url: string; score: number } => x !== null);

    const seen = new Set<string>();
    const urls: string[] = [];
    for (const s of scored.sort((a, b) => b.score - a.score)) {
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      urls.push(s.url);
      if (urls.length >= limit) break;
    }
    res.json({ urls });
  } catch (error) {
    req.log.error({ err: error }, "Error suggesting media");
    res.status(500).json({ error: "Failed to suggest media" });
  }
});

/**
 * List the reference sites this tenant has scraped images from, with per-host
 * counts. Powers the "Reference sites" section of the media library so users
 * can see which images were pulled in from a reference website during page
 * generation and bulk-manage them by source host.
 *
 * Only counts rows the requester can mutate (own tenant + reciprocal sibling),
 * since this list feeds the bulk-delete affordance — shared starter rows are
 * never surfaced here.
 */
router.get("/lp/media/reference-sources", async (req: Request, res: Response) => {
  try {
    const scope = await resolveLibraryTenantScope(req, res);
    if (!scope) return;
    const rows = await db
      .select({ tags: lpMediaTable.tags })
      .from(lpMediaTable)
      .where(and(
        libraryWritablePredicate(scope.ownedTenantIds),
        eq(lpMediaTable.mediaType, "image"),
        sql`${lpMediaTable.tags}::jsonb @> ${JSON.stringify(["scraped"])}::jsonb`,
      ));

    const hostMap = new Map<string, number>();
    let total = 0;
    let untagged = 0;
    for (const row of rows) {
      total++;
      const tags = (row.tags as string[]) ?? [];
      const hostTag = tags.find(t => typeof t === "string" && t.startsWith("refhost:"));
      const host = hostTag ? hostTag.slice("refhost:".length) : "";
      if (host) hostMap.set(host, (hostMap.get(host) ?? 0) + 1);
      else untagged++;
    }
    const hosts = [...hostMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([host, count]) => ({ host, count }));
    res.json({ total, hosts, untagged });
  } catch (error) {
    req.log.error({ err: error }, "Error listing reference sources");
    res.status(500).json({ error: "Failed to list reference sources" });
  }
});

/**
 * Bulk-delete reference-sourced (scraped) images for this tenant.
 *   - ?host=<host>  → delete only images scraped from that source host
 *   - no host       → delete ALL reference-sourced images
 *
 * Tenant-scoped via libraryWritablePredicate (own + reciprocal sibling only),
 * so shared starter rows and other tenants' rows can never be matched. Must be
 * declared BEFORE `DELETE /lp/media/:id` or Express would route "reference"
 * into the `:id` handler.
 */
router.delete("/lp/media/reference", async (req: Request, res: Response) => {
  try {
    const scope = await resolveLibraryTenantScope(req, res);
    if (!scope) return;
    const host = typeof req.query.host === "string" ? req.query.host.trim() : "";
    const conditions = [
      libraryWritablePredicate(scope.ownedTenantIds),
      eq(lpMediaTable.mediaType, "image"),
      sql`${lpMediaTable.tags}::jsonb @> ${JSON.stringify(["scraped"])}::jsonb`,
    ];
    if (host) {
      conditions.push(sql`${lpMediaTable.tags}::jsonb @> ${JSON.stringify([`refhost:${host}`])}::jsonb`);
    }
    const result = await db
      .delete(lpMediaTable)
      .where(and(...conditions))
      .returning({ id: lpMediaTable.id, url: lpMediaTable.url });
    // Reclaim the underlying stored objects best-effort, in parallel — a
    // failed/missing object never blocks the row delete that already succeeded.
    await Promise.all(result.map(r => deleteStoredObjectForUrl(r.url, req.log)));
    res.json({ deleted: result.length });
  } catch (error) {
    req.log.error({ err: error }, "Error bulk-deleting reference media");
    res.status(500).json({ error: "Failed to delete reference media" });
  }
});

/** Update tags for a media item */
router.patch("/lp/media/:id/tags", async (req: Request, res: Response) => {
  try {
    const scope = await resolveLibraryTenantScope(req, res);
    if (!scope) return;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { tags } = req.body as { tags?: string[] };
    if (!Array.isArray(tags)) { res.status(400).json({ error: "tags must be an array" }); return; }

    const cleaned = tags.filter(t => typeof t === "string" && t.trim()).map(t => t.trim().toLowerCase()).slice(0, 12);
    // Only allow editing rows the requester owns (own tenant or sibling). Shared
    // starter rows are read-only — admins manage them via the admin upload route.
    const result = await db
      .update(lpMediaTable)
      .set({ tags: cleaned })
      .where(and(eq(lpMediaTable.id, id), libraryWritablePredicate(scope.ownedTenantIds)))
      .returning({ id: lpMediaTable.id });
    if (result.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ tags: cleaned });
  } catch (error) {
    req.log.error({ err: error }, "Error updating tags");
    res.status(500).json({ error: "Failed to update tags" });
  }
});

/** Bulk-remove a single tag from many images at once. Operates on the full set
 *  of ids the client sends (which may span pagination), reading + rewriting each
 *  row's tags server-side so the caller doesn't need every row loaded. Tenant-
 *  scoped: only rows the requester can write are touched; the rest are ignored. */
router.post("/lp/media/remove-tag", async (req: Request, res: Response) => {
  try {
    const scope = await resolveLibraryTenantScope(req, res);
    if (!scope) return;
    const { ids, tag } = req.body as { ids?: unknown; tag?: unknown };
    const cleanIds = Array.isArray(ids)
      ? [...new Set(ids.map(n => Number(n)).filter(n => Number.isInteger(n)))]
      : [];
    const cleanTag = typeof tag === "string" ? tag.trim().toLowerCase() : "";
    if (cleanIds.length === 0 || !cleanTag) {
      res.status(400).json({ error: "ids (non-empty) and tag are required" });
      return;
    }
    const rows = await db
      .select({ id: lpMediaTable.id, tags: lpMediaTable.tags })
      .from(lpMediaTable)
      .where(and(inArray(lpMediaTable.id, cleanIds), libraryWritablePredicate(scope.ownedTenantIds)));
    let updated = 0;
    await Promise.all(rows.map(async (row) => {
      const current = (row.tags as string[]) ?? [];
      if (!current.includes(cleanTag)) return;
      const next = current.filter(t => t !== cleanTag);
      await db
        .update(lpMediaTable)
        .set({ tags: next })
        .where(and(eq(lpMediaTable.id, row.id), libraryWritablePredicate(scope.ownedTenantIds)));
      updated++;
    }));
    res.json({ updated });
  } catch (error) {
    req.log.error({ err: error }, "Error bulk-removing tag");
    res.status(500).json({ error: "Failed to remove tag" });
  }
});

/** Bulk-add a single tag to many images at once. Mirror of /remove-tag:
 *  operates on the full set of ids the client sends (which may span pagination),
 *  reading + rewriting each row's tags server-side. Tenant-scoped: only rows the
 *  requester can write are touched. Idempotent (a row already carrying the tag is
 *  left unchanged) and honours the same 12-tag-per-image cap as PATCH /:id/tags
 *  (rows already at the cap that lack the tag are skipped). */
router.post("/lp/media/add-tag", async (req: Request, res: Response) => {
  try {
    const scope = await resolveLibraryTenantScope(req, res);
    if (!scope) return;
    const { ids, tag } = req.body as { ids?: unknown; tag?: unknown };
    const cleanIds = Array.isArray(ids)
      ? [...new Set(ids.map(n => Number(n)).filter(n => Number.isInteger(n)))]
      : [];
    const cleanTag = typeof tag === "string" ? tag.trim().toLowerCase() : "";
    if (cleanIds.length === 0 || !cleanTag) {
      res.status(400).json({ error: "ids (non-empty) and tag are required" });
      return;
    }
    const rows = await db
      .select({ id: lpMediaTable.id, tags: lpMediaTable.tags })
      .from(lpMediaTable)
      .where(and(inArray(lpMediaTable.id, cleanIds), libraryWritablePredicate(scope.ownedTenantIds)));
    let updated = 0;
    await Promise.all(rows.map(async (row) => {
      const current = (row.tags as string[]) ?? [];
      if (current.includes(cleanTag) || current.length >= 12) return;
      const next = [...current, cleanTag];
      await db
        .update(lpMediaTable)
        .set({ tags: next })
        .where(and(eq(lpMediaTable.id, row.id), libraryWritablePredicate(scope.ownedTenantIds)));
      updated++;
    }));
    res.json({ updated, tag: cleanTag });
  } catch (error) {
    req.log.error({ err: error }, "Error bulk-adding tag");
    res.status(500).json({ error: "Failed to add tag" });
  }
});

router.delete("/lp/media/:id", async (req: Request, res: Response) => {
  try {
    const scope = await resolveLibraryTenantScope(req, res);
    if (!scope) return;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const result = await db
      .delete(lpMediaTable)
      .where(and(eq(lpMediaTable.id, id), libraryWritablePredicate(scope.ownedTenantIds)))
      .returning({ id: lpMediaTable.id, url: lpMediaTable.url });
    if (result.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    // Reclaim the underlying stored object best-effort — never fails the delete.
    await deleteStoredObjectForUrl(result[0].url, req.log);
    res.json({ success: true });
  } catch (error) {
    req.log.error({ err: error }, "Error deleting media");
    res.status(500).json({ error: "Failed to delete media" });
  }
});

router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;

    if (!wildcardPath.startsWith("uploads/")) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(`/objects/${wildcardPath}`);

    // Tenant-scoped ACL enforcement (task #226, refined post-launch).
    // Objects uploaded by the AI image-generation flow carry an ACL policy
    // whose owner is `tenant:<id>`. The threat model is a *logged-in* user
    // from a different tenant fetching another tenant's image via a leaked
    // UUID. Anonymous viewers are NOT a threat: AI images are embedded in
    // published microsites that are themselves public, so the asset has to
    // be reachable without a session for the page to render.
    //
    // Policy:
    //   anonymous     → 200 (public microsite consumption)
    //   owner tenant  → 200
    //   other tenant  → 403 (the actual leak vector)
    //
    // Legacy objects with no ACL stay fully public-by-URL so existing
    // /lp/upload + /lp/media/upload assets keep working.
    const aclPolicy = await objectStorageService.getObjectAclPolicy(objectFile);
    if (aclPolicy && tenantIdFromAclOwner(aclPolicy.owner) != null) {
      // The response varies by session cookie (anonymous → 200, owner →
      // 200, other tenant → 403), so any shared cache (CDN, corporate
      // proxy) MUST key on the cookie or it could hand a 200 anonymous
      // payload to a sibling-tenant authed user — defeating the ACL.
      // Set this BEFORE the branch can short-circuit with a 403 so the
      // header is present on every ACL'd response.
      res.setHeader("Vary", "Cookie");
      // Resolve the caller's session WITHOUT failing the request when
      // there is no session — anonymous must fall through to the serve
      // path so the public microsite's <img> tag can load the asset.
      const requesterTenantId = await resolveRequesterTenantId(req);
      // Anonymous (no session) is allowed through. Only block authenticated
      // callers from a *different* tenant.
      if (requesterTenantId !== null) {
        let allowed = tenantCanReadAcl(aclPolicy, requesterTenantId) === true;
        // Reciprocal-sibling read parity: the media library (GET /lp/media and
        // /lp/media/images) lists every image owned by the requester's
        // `resolveOwnedTenantIds` set — the requester's own tenant PLUS any
        // reciprocally-linked sibling tenants (e.g. an account-microsite
        // pair). The serve ACL must honor that SAME set, or the sibling-owned
        // thumbnails and heroes the library legitimately shows render as broken
        // (empty) <img> frames in the content library and builder. This lookup
        // runs ONLY on the cross-tenant path (exact-owner already returned
        // true above), so the hot path is unaffected, and it grants no access
        // the library list did not already expose to this requester.
        if (!allowed) {
          const ownerTenant = tenantIdFromAclOwner(aclPolicy.owner);
          if (ownerTenant != null) {
            const ownedTenantIds = await resolveOwnedTenantIds(requesterTenantId);
            allowed = ownedTenantIds.includes(ownerTenant);
          }
        }
        if (!allowed) {
          // Before refusing, allow the request when this object is an
          // intentionally-shared asset (shared starter-library row or imagery
          // referenced by a GLOBAL template). Global/shared imagery is meant to
          // be visible to every tenant, but the underlying object can still
          // carry a tenant-private ACL (e.g. it was uploaded by one tenant and
          // then promoted into a global template). This lookup runs ONLY on the
          // rare cross-tenant 403 path, so the hot path is unaffected, and it
          // does NOT broaden access for genuinely private tenant uploads.
          const shared = await isSharedOrGlobalAsset(wildcardPath);
          if (!shared) {
            res.status(403).json({ error: "Access denied" });
            return;
          }
        }
      }
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    // These objects are public brand/microsite assets meant to be embedded
    // cross-origin: in published microsites, in tenant notification emails,
    // and in the email-shell preview (rendered in a `sandbox=""` iframe whose
    // opaque origin makes every fetch cross-origin). Helmet's app-wide default
    // of `Cross-Origin-Resource-Policy: same-origin` would block those embeds
    // (e.g. an uploaded logo shows a broken-image icon in the preview), so
    // relax CORP to `cross-origin` for this public serve path only.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
