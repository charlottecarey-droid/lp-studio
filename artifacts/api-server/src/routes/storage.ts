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
import { getTenantId, SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { requireSuperadmin } from "../middleware/requireSuperadmin";
import { readImageDimensions } from "../lib/imageDimensions";

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

const VALID_PURPOSES = ["lp-hero", "lp-feature", "product-detail"] as const;
type ImagePurpose = typeof VALID_PURPOSES[number];

/** Auto-tag an image using GPT-4o vision (runs in background, never blocks upload).
 *  Also assigns a landing-page purpose tag:
 *   "lp-hero"        — lifestyle, people, environments, smiles, clinic shots (hero sections)
 *   "lp-feature"     — clean product/procedure shots, moderate close-ups (feature rows)
 *   "product-detail" — very close-up product, diagrams, spec/guide illustrations
 *   "og-image"       — (exclusion tag) social/OG sharing image; auto-excluded from AI page generation
 */
async function autoTagImage(mediaId: number, imageBuffer: Buffer, mimeType: string, existingTags: string[] = []) {
  try {
    const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
    const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
    if (!baseURL || !apiKey) return;

    const openai = new OpenAI({ baseURL, apiKey });
    const base64 = imageBuffer.toString("base64");
    const dataUri = `data:${mimeType};base64,${base64}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            `You are an image tagger for a dental/medical marketing asset library. Return ONLY a valid JSON object (no markdown, no explanation):
{
  "tags": ["tag1", "tag2"],
  "purpose": "lp-hero",
  "og": false
}
Rules:
- "tags": 3–6 short lowercase descriptive tags (1–3 words each) describing subject, style, and mood.
- "purpose": exactly one of:
    "lp-hero"        → lifestyle shot, people smiling, team/clinic environment, before-after results, patient story — suitable as a landing page hero
    "lp-feature"     → clean product/procedure angle, moderate close-up of a device or service, good for a feature row
    "product-detail" → extreme close-up, technical diagram, spec illustration, guide graphic, not suitable as a hero
- "og": true if the image is ANY of the following — social-sharing / Open Graph card (text or logo overlaid on a background, wide 1.91:1 ratio with headline text, brand name, or URL), website screenshot, promotional ad creative, advertisement banner, call-to-action graphic, marketing promotional card with text overlays, or any composite design NOT suitable as a standalone editorial photo. When in doubt, set og: true for images with significant text content. Set false only for clean standalone photos with no text overlays.`,
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUri, detail: "low" } },
            { type: "text", text: "Tag this image, classify its landing page purpose, and detect if it is an OG/social-sharing image." },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let aiTags: string[] = [];
    let purpose: ImagePurpose | "" = "";
    let isOg = false;

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        // Graceful fallback: old plain-array format
        aiTags = parsed;
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.tags)) aiTags = parsed.tags;
        if (typeof parsed.purpose === "string" && VALID_PURPOSES.includes(parsed.purpose as ImagePurpose)) {
          purpose = parsed.purpose as ImagePurpose;
        }
        if (parsed.og === true) isOg = true;
      }
    } catch {
      // JSON parse failed — skip tagging
    }

    if (aiTags.length > 0 || purpose || isOg) {
      // OG images get the "og-image" exclusion tag prepended; no LP purpose tag assigned
      const purposeArr: string[] = isOg ? ["og-image"] : (purpose ? [purpose] : []);
      // Remove any stale purpose/og tags from existing tags before merging
      const staleTagSet = new Set([...VALID_PURPOSES as readonly string[], "og-image"]);
      const cleanedExisting = existingTags.filter(t => !staleTagSet.has(t));
      const merged = [...new Set([...purposeArr, ...cleanedExisting, ...aiTags])].slice(0, 11);
      await db
        .update(lpMediaTable)
        .set({ tags: merged })
        .where(eq(lpMediaTable.id, mediaId));
    }
  } catch {
    // Auto-tagging is best-effort — never fail the upload
  }
}

/** Re-classify just the purpose (lp-hero/lp-feature/product-detail/og-image) for an image that already has content tags.
 *  Much lighter than full autoTagImage — only updates the purpose prefix tag.
 */
async function classifyPurposeOnly(mediaId: number, imageBuffer: Buffer, mimeType: string, existingTags: string[]): Promise<void> {
  try {
    const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
    const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
    if (!baseURL || !apiKey) return;

    const openai = new OpenAI({ baseURL, apiKey });
    const base64 = imageBuffer.toString("base64");
    const dataUri = `data:${mimeType};base64,${base64}`;

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
    const staleTagSet = new Set([...VALID_PURPOSES as readonly string[], "og-image"]);

    if (raw.includes("og-image")) {
      // OG images: tag as "og-image", remove any LP purpose tags
      const cleanedTags = existingTags.filter(t => !staleTagSet.has(t));
      const merged = ["og-image", ...cleanedTags].slice(0, 11);
      await db.update(lpMediaTable).set({ tags: merged }).where(eq(lpMediaTable.id, mediaId));
      return;
    }

    const purpose = VALID_PURPOSES.find(p => raw.includes(p));
    if (!purpose) return;

    // Remove any stale purpose/og tags, prepend new one
    const cleanedTags = existingTags.filter(t => !staleTagSet.has(t));
    const merged = [purpose, ...cleanedTags].slice(0, 11);
    await db.update(lpMediaTable).set({ tags: merged }).where(eq(lpMediaTable.id, mediaId));
  } catch {
    // best-effort
  }
}

/**
 * Reclassify all images that don't yet have a purpose tag.
 * Superadmin only — this is a global maintenance op that touches
 * every tenant's images, not a per-tenant user feature.
 */
router.post("/lp/media/reclassify", requireSuperadmin, async (req: Request, res: Response) => {
  try {
    // force=true re-examines ALL images, including those already tagged.
    // Use this to fix images that were misclassified before the OG-detection prompt was tightened.
    const force = req.query.force === "true" || req.body?.force === true;

    const rows = await db
      .select({ id: lpMediaTable.id, url: lpMediaTable.url, mimeType: lpMediaTable.mimeType, tags: lpMediaTable.tags })
      .from(lpMediaTable)
      .where(eq(lpMediaTable.mediaType, "image"));

    const ALL_PURPOSE_TAGS = new Set([...VALID_PURPOSES, "og-image"]);
    const toProcess = force
      ? rows
      : rows.filter(r => {
          const tags = (r.tags as string[]) ?? [];
          return !tags.some(t => ALL_PURPOSE_TAGS.has(t));
        });

    res.json({
      total: toProcess.length,
      force,
      message: force
        ? `Force-reclassifying all ${toProcess.length} images (including already-tagged) in the background…`
        : `Reclassifying ${toProcess.length} unclassified images in the background…`,
    });

    // Process in background — fetch each image buffer from local serve URL
    setImmediate(async () => {
      const port = process.env.PORT ?? "8080";
      for (const row of toProcess) {
        try {
          const fullUrl = `http://localhost:${port}${row.url}`;
          const resp = await fetch(fullUrl);
          if (!resp.ok) continue;
          const buffer = Buffer.from(await resp.arrayBuffer());
          const mimeType = row.mimeType ?? "image/jpeg";
          await classifyPurposeOnly(row.id, buffer, mimeType, (row.tags as string[]) ?? []);
        } catch { /* skip on error */ }
      }
    });
  } catch (error) {
    req.log.error({ err: error }, "Error starting reclassification");
    res.status(500).json({ error: "Failed to start reclassification" });
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

    // Resolve tenant slug so we can gate Dandy-internal-only preloaded
    // assets (currently just `preloaded-ai-scan-review`, which is a
    // Dandy-branded UI feature video that should not appear in any
    // partner / customer media library).
    const tenantRow = await db
      .select({ slug: tenantsTable.slug })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, scope.tenantId))
      .limit(1);
    const tenantSlug = tenantRow[0]?.slug ?? null;
    const isDandyTenant = tenantSlug === "dandy";

    const preloaded = PRELOADED_VIDEOS
      .filter(v => v.mediaType === mediaTypeFilter)
      .filter(v => v.id !== "preloaded-ai-scan-review" || isDandyTenant);

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
    if (q) conditions.push(ilike(lpMediaTable.title, `%${q}%`));
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
        const allowed = tenantCanReadAcl(aclPolicy, requesterTenantId);
        if (allowed !== true) {
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
