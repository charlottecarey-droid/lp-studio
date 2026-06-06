/**
 * Tests for the regular image upload (POST /api/lp/upload) and video upload
 * (POST /api/lp/media/upload) routes — the siblings of the PDF upload route in
 * storage.ts. They share the same multer + object-storage + media-table
 * machinery as the PDF route, so this suite mirrors
 * storage.pdfUpload.integration.test.ts: object storage and @workspace/db are
 * mocked, and requests are injected in-process (the vitest worker pool here
 * can't bind a listening port).
 *
 * Each route enforces a per-type mime fileFilter and a multer size cap
 * (30 MB images, 200 MB video), then uploads the bytes to object storage and
 * persists a media row scoped to the caller's tenant.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture every buffer/contentType the routes hand to object storage so we can
// assert on the uploaded bytes directly.
const uploads: Array<{ buffer: Buffer; contentType: string }> = [];

vi.mock("../lib/objectStorage", () => {
  class ObjectStorageService {
    async uploadObjectEntity(buffer: Buffer, contentType: string): Promise<string> {
      uploads.push({ buffer, contentType });
      return "/objects/uploads/fake-media-id";
    }
  }
  class ObjectNotFoundError extends Error {}
  return { ObjectStorageService, ObjectNotFoundError };
});

// Capture the row passed to db.insert(...).values(...) and return a fabricated
// record so the route's response shaping (incl. createdAt.toISOString()) runs.
interface InsertedRow {
  tenantId: number | null;
  title: string;
  url: string;
  mediaType: string;
  mimeType: string;
  sizeBytes: number;
  tags?: string[];
  isShared?: boolean;
}
let insertedRow: InsertedRow | null = null;

vi.mock("@workspace/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn((vals: InsertedRow) => ({
        returning: vi.fn(async () => {
          insertedRow = vals;
          return [
            {
              id: 4242,
              title: vals.title,
              url: vals.url,
              mediaType: vals.mediaType,
              mimeType: vals.mimeType,
              sizeBytes: vals.sizeBytes,
              createdAt: new Date("2025-01-01T00:00:00.000Z"),
            },
          ];
        }),
      })),
    })),
  },
  pool: { query: vi.fn(async () => { throw new Error("no db in test"); }) },
  lpMediaTable: {},
  tenantsTable: {},
}));

import express, { type Request, type Response, type NextFunction } from "express";
import { inject, type InjectResponse } from "../test-utils/injectRequest";
import type { AuthUser } from "../middleware/requireAuth";
import storageRouter from "./storage";

/** Stand-in auth: populate req.authUser so getTenantId resolves a tenant. */
function fakeAuth(user: Partial<AuthUser> | null) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (user) (req as Request & { authUser?: AuthUser }).authUser = user as AuthUser;
    next();
  };
}

/** No-op logger: the real app mounts pino-http; the error path calls req.log. */
function fakeLog(req: Request, _res: Response, next: NextFunction): void {
  const noop = () => {};
  (req as Request & { log: unknown }).log = {
    error: noop, warn: noop, info: noop, debug: noop, trace: noop, fatal: noop,
  } as unknown as Request["log"];
  next();
}

type Part =
  | { kind: "file"; name: string; filename: string; contentType: string; data: Buffer }
  | { kind: "field"; name: string; value: string };

/** Build a multipart/form-data body from an arbitrary set of file/text parts. */
function multipart(parts: Part[]): { body: Buffer; contentType: string } {
  const boundary = `----vitestBoundary${Date.now()}${Math.random().toString(16).slice(2)}`;
  const segments: Buffer[] = [];
  for (const part of parts) {
    if (part.kind === "file") {
      segments.push(
        Buffer.from(
          `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n` +
            `Content-Type: ${part.contentType}\r\n\r\n`,
          "utf8",
        ),
        part.data,
        Buffer.from("\r\n", "utf8"),
      );
    } else {
      segments.push(
        Buffer.from(
          `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${part.name}"\r\n\r\n` +
            `${part.value}\r\n`,
          "utf8",
        ),
      );
    }
  }
  segments.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
  return {
    body: Buffer.concat(segments),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function postParts(
  url: string,
  parts: Part[],
  user: Partial<AuthUser> | null = { tenantId: 1, userId: 1 },
): Promise<InjectResponse> {
  const mp = multipart(parts);
  const localApp = express();
  localApp.use(fakeLog);
  localApp.use(fakeAuth(user));
  localApp.use("/api", storageRouter);
  return inject(localApp, {
    method: "POST",
    url,
    headers: { "content-type": mp.contentType },
    body: mp.body,
  });
}

beforeEach(() => {
  uploads.length = 0;
  insertedRow = null;
});

describe("POST /api/lp/upload — image upload", () => {
  it("accepts a valid image and persists a media row", async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);
    const res = await postParts("/api/lp/upload", [
      { kind: "file", name: "file", filename: "Team_Photo.png", contentType: "image/png", data: bytes },
    ]);

    expect(res.status).toBe(200);
    const body = res.json as { url: string; mediaId: number };
    // The route returns the raw storage servePath (not the /api/storage URL).
    expect(body.url).toBe("/objects/uploads/fake-media-id");
    expect(body.mediaId).toBe(4242);

    // Exact bytes uploaded, stored under the source mime type.
    expect(uploads).toHaveLength(1);
    expect(uploads[0].contentType).toBe("image/png");
    expect(uploads[0].buffer.equals(bytes)).toBe(true);

    // Persisted row carries the resolved tenant, derived title and serve URL.
    expect(insertedRow?.tenantId).toBe(1);
    expect(insertedRow?.title).toBe("Team Photo");
    expect(insertedRow?.url).toBe("/api/storage/objects/uploads/fake-media-id");
    expect(insertedRow?.mediaType).toBe("image");
    expect(insertedRow?.mimeType).toBe("image/png");
    expect(insertedRow?.sizeBytes).toBe(bytes.length);
    expect(insertedRow?.tags).toEqual([]);
  });

  it("parses comma-separated folderTags into the persisted row", async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const res = await postParts("/api/lp/upload", [
      { kind: "file", name: "file", filename: "office.png", contentType: "image/png", data: bytes },
      { kind: "field", name: "folderTags", value: "Workspace, Team , office" },
    ]);
    expect(res.status).toBe(200);
    expect(insertedRow?.tags).toEqual(["workspace", "team", "office"]);
  });

  it("rejects an image larger than 30 MB", async () => {
    const big = Buffer.alloc(30 * 1024 * 1024 + 16, 0);
    const res = await postParts("/api/lp/upload", [
      { kind: "file", name: "file", filename: "huge.png", contentType: "image/png", data: big },
    ]);
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBe("File too large. Maximum size is 30 MB.");
    expect(insertedRow).toBeNull();
  });

  it("rejects a non-image mime type", async () => {
    const res = await postParts("/api/lp/upload", [
      { kind: "file", name: "file", filename: "doc.pdf", contentType: "application/pdf", data: Buffer.from("%PDF-1.4") },
    ]);
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBe("Only image files are allowed");
    expect(uploads).toHaveLength(0);
    expect(insertedRow).toBeNull();
  });

  it("returns 400 when no file part is provided", async () => {
    const res = await postParts("/api/lp/upload", [
      { kind: "field", name: "folderTags", value: "team" },
    ]);
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBe("No file uploaded");
    expect(insertedRow).toBeNull();
  });

  it("returns 403 and persists nothing for an unauthenticated caller (no tenant)", async () => {
    // Note: this route uploads the bytes to storage BEFORE the tenant check, so
    // the storage write happens, but no media row is persisted.
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const res = await postParts(
      "/api/lp/upload",
      [{ kind: "file", name: "file", filename: "team.png", contentType: "image/png", data: bytes }],
      null,
    );
    expect(res.status).toBe(403);
    expect(insertedRow).toBeNull();
  });
});

describe("POST /api/lp/media/upload — video upload", () => {
  it("accepts a valid video and persists a media row", async () => {
    const bytes = Buffer.from("fake mp4 bytes", "latin1");
    const res = await postParts("/api/lp/media/upload", [
      { kind: "file", name: "file", filename: "Promo_Reel.mp4", contentType: "video/mp4", data: bytes },
    ]);

    expect(res.status).toBe(200);
    const body = res.json as {
      id: string; title: string; url: string; mediaType: string;
      mimeType: string; sizeBytes: number; isPreloaded: boolean; createdAt: string;
    };
    expect(body.id).toBe("4242");
    expect(body.title).toBe("Promo Reel");
    expect(body.url).toBe("/api/storage/objects/uploads/fake-media-id");
    expect(body.mediaType).toBe("video");
    expect(body.mimeType).toBe("video/mp4");
    expect(body.sizeBytes).toBe(bytes.length);
    expect(body.isPreloaded).toBe(false);
    expect(body.createdAt).toBe("2025-01-01T00:00:00.000Z");

    expect(uploads).toHaveLength(1);
    expect(uploads[0].contentType).toBe("video/mp4");
    expect(uploads[0].buffer.equals(bytes)).toBe(true);

    expect(insertedRow?.tenantId).toBe(1);
    expect(insertedRow?.mediaType).toBe("video");
    expect(insertedRow?.sizeBytes).toBe(bytes.length);
  });

  it("prefers an explicit title field over the derived filename", async () => {
    const res = await postParts("/api/lp/media/upload", [
      { kind: "file", name: "file", filename: "raw_clip.webm", contentType: "video/webm", data: Buffer.from("webm") },
      { kind: "field", name: "title", value: "Q4 Highlight Reel" },
    ]);
    expect(res.status).toBe(200);
    expect(insertedRow?.title).toBe("Q4 Highlight Reel");
  });

  it("rejects a non-video mime type", async () => {
    const res = await postParts("/api/lp/media/upload", [
      { kind: "file", name: "file", filename: "photo.png", contentType: "image/png", data: Buffer.from("png") },
    ]);
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBe("Only video files are allowed (MP4, WebM, OGG, MOV)");
    expect(uploads).toHaveLength(0);
    expect(insertedRow).toBeNull();
  });

  it("rejects a video larger than 200 MB", async () => {
    const big = Buffer.alloc(200 * 1024 * 1024 + 16, 0);
    const res = await postParts("/api/lp/media/upload", [
      { kind: "file", name: "file", filename: "huge.mp4", contentType: "video/mp4", data: big },
    ]);
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBe("File too large. Maximum size is 200 MB.");
    expect(insertedRow).toBeNull();
  });

  it("returns 400 when no file part is provided", async () => {
    const res = await postParts("/api/lp/media/upload", [
      { kind: "field", name: "title", value: "orphan" },
    ]);
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBe("No file uploaded");
    expect(insertedRow).toBeNull();
  });
});
