/**
 * Test for POST /api/lp/og-image/resize — Task #967's server-side share-card
 * center-crop. The route accepts raw image BYTES (multipart), sharp-crops them
 * to the canonical 1200×630 PNG, uploads to object storage, and returns the
 * served URL + fixed dimensions.
 *
 * Object storage is mocked so we can (a) run without any storage credentials
 * and (b) capture the exact buffer the route uploads — that buffer is then
 * re-read with sharp to PROVE the output is a 1200×630 PNG regardless of the
 * input shape. Requests are injected in-process (the vitest worker pool here
 * can't bind a listening port), with a tiny middleware standing in for the
 * real auth chain so getTenantId() resolves a tenant.
 */
import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";

// Capture every buffer/contentType the route hands to object storage so we can
// assert on the resized bytes directly.
const uploads: Array<{ buffer: Buffer; contentType: string }> = [];

vi.mock("../lib/objectStorage", () => {
  class ObjectStorageService {
    async uploadObjectEntity(buffer: Buffer, contentType: string): Promise<string> {
      uploads.push({ buffer, contentType });
      return "/objects/uploads/fake-id";
    }
  }
  class ObjectNotFoundError extends Error {}
  return { ObjectStorageService, ObjectNotFoundError };
});

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

/** Build a minimal multipart/form-data body carrying a single `file` field. */
function multipart(filename: string, contentType: string, data: Buffer): {
  body: Buffer;
  contentType: string;
} {
  const boundary = `----vitestBoundary${Date.now()}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return {
    body: Buffer.concat([head, data, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function postFile(opts: {
  user?: Partial<AuthUser> | null;
  filename?: string;
  contentType?: string;
  data: Buffer;
}): Promise<InjectResponse> {
  const mp = multipart(opts.filename ?? "source.png", opts.contentType ?? "image/png", opts.data);
  const localApp = express();
  localApp.use(fakeLog);
  localApp.use(fakeAuth(opts.user === undefined ? { tenantId: 1, userId: 1 } : opts.user));
  localApp.use("/api", storageRouter);
  return inject(localApp, {
    method: "POST",
    url: "/api/lp/og-image/resize",
    headers: { "content-type": mp.contentType },
    body: mp.body,
  });
}

/** A real (non-1200×630) PNG so we genuinely exercise sharp's crop. */
async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
}

describe("POST /api/lp/og-image/resize", () => {
  it("crops a tall square input to exactly 1200×630 PNG", async () => {
    uploads.length = 0;
    const res = await postFile({ data: await makePng(800, 800) });

    expect(res.status).toBe(200);
    const body = res.json as { url: string; width: number; height: number };
    expect(body.width).toBe(1200);
    expect(body.height).toBe(630);
    expect(body.url).toBe("/api/storage/objects/uploads/fake-id");

    // The bytes actually uploaded must be a 1200×630 PNG.
    expect(uploads).toHaveLength(1);
    expect(uploads[0].contentType).toBe("image/png");
    const meta = await sharp(uploads[0].buffer).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });

  it("crops a wide input to exactly 1200×630 PNG and converts JPEG → PNG", async () => {
    uploads.length = 0;
    const jpeg = await sharp({
      create: { width: 2000, height: 500, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .jpeg()
      .toBuffer();

    const res = await postFile({ data: jpeg, filename: "wide.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    const meta = await sharp(uploads[0].buffer).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });

  it("returns 403 for an unauthenticated caller (no tenant)", async () => {
    uploads.length = 0;
    const res = await postFile({ user: null, data: await makePng(800, 800) });
    expect(res.status).toBe(403);
    expect(uploads).toHaveLength(0);
  });

  it("returns 400 when the uploaded file is not a valid image", async () => {
    uploads.length = 0;
    const res = await postFile({ data: Buffer.from("not an image at all"), filename: "x.png" });
    expect(res.status).toBe(400);
    expect(uploads).toHaveLength(0);
  });

  it("returns 400 when a non-image mime type is rejected by the upload filter", async () => {
    uploads.length = 0;
    const res = await postFile({
      data: Buffer.from("hello"),
      filename: "note.txt",
      contentType: "text/plain",
    });
    expect(res.status).toBe(400);
    expect(uploads).toHaveLength(0);
  });
});
