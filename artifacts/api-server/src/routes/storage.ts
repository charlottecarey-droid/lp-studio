import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import multer from "multer";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { db, lpMediaTable } from "@workspace/db";
import { desc } from "drizzle-orm";

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
    url: "/lp-studio/videos/dandy-digital-lab.mp4",
    mediaType: "video",
    mimeType: "video/mp4",
    isPreloaded: true,
    sizeBytes: null as number | null,
    createdAt: new Date("2025-01-01").toISOString(),
  },
  {
    id: "preloaded-dandy-lab-video",
    title: "Dandy Lab Animation",
    url: "/lp-studio/videos/dandy-lab-video.mp4",
    mediaType: "video",
    mimeType: "video/mp4",
    isPreloaded: true,
    sizeBytes: null as number | null,
    createdAt: new Date("2025-01-01").toISOString(),
  },
  {
    id: "preloaded-dandy-broll",
    title: "Dandy B-Roll (No Text)",
    url: "/lp-studio/videos/dandy-broll.mp4",
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
      res.json({ url: servePath });
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
