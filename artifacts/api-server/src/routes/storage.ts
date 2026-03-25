import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import multer from "multer";
import OpenAI from "openai";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { db, lpMediaTable } from "@workspace/db";
import { desc, eq, sql, ilike, or } from "drizzle-orm";

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

/** Auto-tag an image using GPT-4o vision (runs in background, never blocks upload) */
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
            "You are an image tagger for a marketing asset library. Return ONLY a JSON array of 3-6 short descriptive tags (lowercase, 1-3 words each). Tags should describe the subject, style, mood, and use case. Example: [\"dental office\", \"team photo\", \"modern\", \"hero image\", \"professional\"]",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUri, detail: "low" } },
            { type: "text", text: "Tag this image." },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const aiTags = JSON.parse(cleaned);
    if (Array.isArray(aiTags) && aiTags.length > 0) {
      // Merge folder tags + AI tags, deduplicated, capped at 10
      const merged = [...new Set([...existingTags, ...aiTags])].slice(0, 10);
      await db
        .update(lpMediaTable)
        .set({ tags: merged })
        .where(eq(lpMediaTable.id, mediaId));
    }
  } catch {
    // Auto-tagging is best-effort — never fail the upload
  }
}

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

    let query = db.select().from(lpMediaTable)
      .where(eq(lpMediaTable.mediaType, "image"))
      .orderBy(desc(lpMediaTable.createdAt))
      .$dynamic();

    const rows = await query;

    let items = rows.map(r => ({
      id: r.id,
      title: r.title,
      url: r.url,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      tags: (r.tags as string[]) ?? [],
      createdAt: r.createdAt.toISOString(),
    }));

    // Filter by tag (case-insensitive)
    if (tag) {
      const tagLower = tag.toLowerCase();
      items = items.filter(item => item.tags.some(t => t.toLowerCase() === tagLower));
    }

    // Filter by search query (match title or tags)
    if (q) {
      const qLower = q.toLowerCase();
      items = items.filter(item =>
        item.title.toLowerCase().includes(qLower) ||
        item.tags.some(t => t.toLowerCase().includes(qLower))
      );
    }

    // Collect all unique tags for the filter UI
    const allTags = new Map<string, number>();
    for (const row of rows) {
      for (const t of (row.tags as string[]) ?? []) {
        allTags.set(t, (allTags.get(t) ?? 0) + 1);
      }
    }
    const tagCounts = [...allTags.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));

    res.json({ items, tagCounts });
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
