import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import multer from "multer";
import OpenAI from "openai";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { db, lpMediaTable } from "@workspace/db";
import { desc, eq, sql, ilike, and, count } from "drizzle-orm";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "image/avif", "image/heic", "image/heif",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4", "video/webm", "video/ogg", "video/quicktime",
  "video/x-msvideo", "video/x-matroska",
]);

const MAX_SIZE_BYTES = 200 * 1024 * 1024;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
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
];

const VALID_PURPOSES = ["lp-hero", "lp-feature", "product-detail"] as const;
type ImagePurpose = typeof VALID_PURPOSES[number];

/** Auto-tag an image using GPT-4o vision (runs in background, never blocks upload).
 *  Also assigns a landing-page purpose tag:
 *   "lp-hero"        — lifestyle, people, environments, smiles, clinic shots (hero sections)
 *   "lp-feature"     — clean product/procedure shots, moderate close-ups (feature rows)
 *   "product-detail" — very close-up product, diagrams, spec/guide illustrations
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
  "purpose": "lp-hero"
}
Rules:
- "tags": 3–6 short lowercase descriptive tags (1–3 words each) describing subject, style, and mood.
- "purpose": exactly one of:
    "lp-hero"        → lifestyle shot, people smiling, team/clinic environment, before-after results, patient story — suitable as a landing page hero
    "lp-feature"     → clean product/procedure angle, moderate close-up of a device or service, good for a feature row
    "product-detail" → extreme close-up, technical diagram, spec illustration, guide graphic, not suitable as a hero`,
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUri, detail: "low" } },
            { type: "text", text: "Tag this image and classify its landing page purpose." },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let aiTags: string[] = [];
    let purpose: ImagePurpose | "" = "";

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
      }
    } catch {
      // JSON parse failed — skip tagging
    }

    if (aiTags.length > 0 || purpose) {
      // Purpose tag goes first (guaranteed slot outside the 10-tag cap for regular tags)
      const purposeArr: string[] = purpose ? [purpose] : [];
      // Remove any stale purpose tags from existing tags before merging
      const cleanedExisting = existingTags.filter(t => !VALID_PURPOSES.includes(t as ImagePurpose));
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

/** Re-classify just the purpose (lp-hero/lp-feature/product-detail) for an image that already has content tags.
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
lp-hero       → lifestyle, people, smiles, clinic/team environment, before-after results — good as a landing page hero
lp-feature    → clean product/procedure angle, moderate close-up, good for a feature section
product-detail → extreme close-up, technical diagram, spec illustration, guide graphic — not suitable as a hero`,
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
    const purpose = VALID_PURPOSES.find(p => raw.includes(p));
    if (!purpose) return;

    // Remove any stale purpose tags, prepend new one
    const cleanedTags = existingTags.filter(t => !VALID_PURPOSES.includes(t as typeof VALID_PURPOSES[number]));
    const merged = [purpose, ...cleanedTags].slice(0, 11);
    await db.update(lpMediaTable).set({ tags: merged }).where(eq(lpMediaTable.id, mediaId));
  } catch {
    // best-effort
  }
}

/** Reclassify all images that don't yet have a purpose tag */
router.post("/lp/media/reclassify", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({ id: lpMediaTable.id, url: lpMediaTable.url, mimeType: lpMediaTable.mimeType, tags: lpMediaTable.tags })
      .from(lpMediaTable)
      .where(eq(lpMediaTable.mediaType, "image"));

    const unclassified = rows.filter(r => {
      const tags = (r.tags as string[]) ?? [];
      return !tags.some(t => VALID_PURPOSES.includes(t as typeof VALID_PURPOSES[number]));
    });

    res.json({ total: unclassified.length, message: `Reclassifying ${unclassified.length} images in the background…` });

    // Process in background — fetch each image buffer from local serve URL
    setImmediate(async () => {
      const port = process.env.PORT ?? "8080";
      for (const row of unclassified) {
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
        ? "File too large. Maximum size is 20 MB."
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
      const [record] = await db.insert(lpMediaTable).values({
        title,
        url: serveUrl,
        mediaType: "image",
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
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

      const [record] = await db.insert(lpMediaTable).values({
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

router.get("/lp/media", async (req: Request, res: Response) => {
  try {
    const mediaTypeFilter = typeof req.query.mediaType === "string" ? req.query.mediaType : "video";
    const uploaded = await db.select().from(lpMediaTable)
      .where(undefined)
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

    const preloaded = PRELOADED_VIDEOS.filter(v => v.mediaType === mediaTypeFilter);

    res.json({ items: [...preloaded, ...uploadedItems] });
  } catch (error) {
    req.log.error({ err: error }, "Error listing media");
    res.status(500).json({ error: "Failed to list media" });
  }
});

/** Browse image library with optional search query and tag filter */
router.get("/lp/media/images", async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
    const pageNum = Math.max(1, parseInt(typeof req.query.page === "string" ? req.query.page : "1") || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(typeof req.query.limit === "string" ? req.query.limit : "48") || 48));

    // Build SQL conditions
    const conditions = [eq(lpMediaTable.mediaType, "image")];
    if (q) conditions.push(ilike(lpMediaTable.title, `%${q}%`));
    if (tag) conditions.push(sql`${lpMediaTable.tags}::jsonb @> ${JSON.stringify([tag])}::jsonb`);
    const where = and(...conditions);

    // Paginated items
    const rows = await db
      .select()
      .from(lpMediaTable)
      .where(where)
      .orderBy(desc(lpMediaTable.createdAt))
      .limit(limitNum)
      .offset((pageNum - 1) * limitNum);

    // Total count (for pagination)
    const [{ total }] = await db
      .select({ total: count() })
      .from(lpMediaTable)
      .where(where);

    // All tags for the category sidebar — unfiltered so every category always shows
    const allTagRows = await db
      .select({ tags: lpMediaTable.tags })
      .from(lpMediaTable)
      .where(eq(lpMediaTable.mediaType, "image"));

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

/** Update tags for a media item */
router.patch("/lp/media/:id/tags", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { tags } = req.body as { tags?: string[] };
    if (!Array.isArray(tags)) { res.status(400).json({ error: "tags must be an array" }); return; }

    const cleaned = tags.filter(t => typeof t === "string" && t.trim()).map(t => t.trim().toLowerCase()).slice(0, 12);
    await db.update(lpMediaTable).set({ tags: cleaned }).where(eq(lpMediaTable.id, id));
    res.json({ tags: cleaned });
  } catch (error) {
    req.log.error({ err: error }, "Error updating tags");
    res.status(500).json({ error: "Failed to update tags" });
  }
});

router.delete("/lp/media/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    await db.delete(lpMediaTable).where(eq(lpMediaTable.id, id));
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

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

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
