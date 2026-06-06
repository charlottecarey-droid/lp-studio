/**
 * Tests for POST /api/lp/pdf/upload — the base64 upload branch added to evade
 * the Cloudflare edge WAF that 403s raw-PDF binary POSTs on custom-domain tenant
 * hosts (see lp-studio's pdf-upload.ts and the pdfUpload comment in storage.ts).
 *
 * The route accepts EITHER a raw multipart `file` part OR a base64-encoded
 * `fileBase64` text field. The base64 branch bypasses multer's mime fileFilter,
 * so it does its own validation: strict base64 charset/length, a decode
 * round-trip check, a 50 MB decoded-size cap, and a `%PDF-` magic-number check.
 *
 * Object storage and @workspace/db are mocked so the suite runs without storage
 * credentials or a database, and so we can capture the exact bytes the route
 * uploads. Requests are injected in-process (the vitest worker pool here can't
 * bind a listening port), with a tiny middleware standing in for the real auth
 * chain so getTenantId() resolves a tenant.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture every buffer/contentType the route hands to object storage so we can
// assert on the uploaded bytes directly.
const uploads: Array<{ buffer: Buffer; contentType: string }> = [];

vi.mock("../lib/objectStorage", () => {
  class ObjectStorageService {
    async uploadObjectEntity(buffer: Buffer, contentType: string): Promise<string> {
      uploads.push({ buffer, contentType });
      return "/objects/uploads/fake-pdf-id";
    }
  }
  class ObjectNotFoundError extends Error {}
  return { ObjectStorageService, ObjectNotFoundError };
});

// Capture the row passed to db.insert(...).values(...) and return a fabricated
// record so the route's response shaping (incl. createdAt.toISOString()) runs.
interface InsertedRow {
  tenantId: number;
  title: string;
  url: string;
  mediaType: string;
  mimeType: string;
  sizeBytes: number;
  tags: string[];
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

function postParts(parts: Part[], user: Partial<AuthUser> | null = { tenantId: 1, userId: 1 }): Promise<InjectResponse> {
  const mp = multipart(parts);
  const localApp = express();
  localApp.use(fakeLog);
  localApp.use(fakeAuth(user));
  localApp.use("/api", storageRouter);
  return inject(localApp, {
    method: "POST",
    url: "/api/lp/pdf/upload",
    headers: { "content-type": mp.contentType },
    body: mp.body,
  });
}

/** Send a `fileBase64` (and optional `filename`) text field. */
function postBase64(fileBase64: string, filename?: string): Promise<InjectResponse> {
  const parts: Part[] = [{ kind: "field", name: "fileBase64", value: fileBase64 }];
  if (filename !== undefined) parts.push({ kind: "field", name: "filename", value: filename });
  return postParts(parts);
}

/** Minimal byte sequence that begins with the PDF magic number. */
function pdfBytes(tail = "1.4\n%minimal\n%%EOF\n"): Buffer {
  return Buffer.from(`%PDF-${tail}`, "latin1");
}

beforeEach(() => {
  uploads.length = 0;
  insertedRow = null;
});

describe("POST /api/lp/pdf/upload — base64 branch", () => {
  it("accepts a valid base64-encoded PDF and persists it", async () => {
    const bytes = pdfBytes();
    const res = await postBase64(bytes.toString("base64"), "Quarterly_Report.pdf");

    expect(res.status).toBe(200);
    const body = res.json as {
      id: string; title: string; url: string; mediaType: string;
      mimeType: string; sizeBytes: number; createdAt: string;
    };
    expect(body.id).toBe("4242");
    expect(body.title).toBe("Quarterly Report");
    expect(body.url).toBe("/api/storage/objects/uploads/fake-pdf-id");
    expect(body.mediaType).toBe("pdf");
    expect(body.mimeType).toBe("application/pdf");
    expect(body.sizeBytes).toBe(bytes.length);
    expect(body.createdAt).toBe("2025-01-01T00:00:00.000Z");

    // The bytes uploaded must be the exact decoded PDF, stored as application/pdf.
    expect(uploads).toHaveLength(1);
    expect(uploads[0].contentType).toBe("application/pdf");
    expect(uploads[0].buffer.equals(bytes)).toBe(true);

    // And the persisted row carries the resolved tenant + decoded size.
    expect(insertedRow?.tenantId).toBe(1);
    expect(insertedRow?.mediaType).toBe("pdf");
    expect(insertedRow?.sizeBytes).toBe(bytes.length);
  });

  it("accepts a base64 data-URI prefix and strips it before decoding", async () => {
    const bytes = pdfBytes();
    const dataUri = `data:application/pdf;base64,${bytes.toString("base64")}`;
    const res = await postBase64(dataUri);

    expect(res.status).toBe(200);
    expect(uploads).toHaveLength(1);
    expect(uploads[0].buffer.equals(bytes)).toBe(true);
  });

  it("defaults the title when no filename field is supplied", async () => {
    const res = await postBase64(pdfBytes().toString("base64"));
    expect(res.status).toBe(200);
    expect((res.json as { title: string }).title).toBe("document");
  });

  it("rejects base64 with an invalid charset", async () => {
    const res = await postBase64("not*valid*base64!!");
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBe("Invalid file encoding");
    expect(uploads).toHaveLength(0);
  });

  it("rejects base64 whose length is not a multiple of four", async () => {
    // "abc" is valid charset but length 3 — fails the strict %4 padding check.
    const res = await postBase64("abc");
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBe("Invalid file encoding");
    expect(uploads).toHaveLength(0);
  });

  it("rejects non-canonical base64 that decodes but fails the round-trip check", async () => {
    // "AB==" passes the charset + %4 checks, decodes to a single 0x00 byte, but
    // re-encodes to "AA==" — Node tolerates the dropped low bits, the round-trip
    // guard does not.
    expect(Buffer.from("AB==", "base64").toString("base64")).toBe("AA==");
    const res = await postBase64("AB==");
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBe("Invalid file encoding");
    expect(uploads).toHaveLength(0);
  });

  it("rejects a decoded payload larger than 50 MB", async () => {
    const PDF_MAX_BYTES = 50 * 1024 * 1024;
    const big = Buffer.alloc(PDF_MAX_BYTES + 16, 0);
    big.write("%PDF-1.4\n", 0, "latin1");
    const res = await postBase64(big.toString("base64"));
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBe("File too large. Maximum size is 50 MB.");
    expect(uploads).toHaveLength(0);
  });

  it("rejects decoded bytes that are not a PDF (missing %PDF- magic number)", async () => {
    // A real PNG header is valid base64 but is not a PDF.
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = await postBase64(png.toString("base64"));
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBe("Only PDF files are allowed");
    expect(uploads).toHaveLength(0);
  });

  it("accepts non-PDF bytes that merely spoof the %PDF- prefix (magic number is trusted)", async () => {
    // The route validates only the 5-byte prefix, so a buffer that starts with
    // "%PDF-" followed by arbitrary, non-PDF garbage still uploads successfully.
    const spoof = Buffer.concat([
      Buffer.from("%PDF-", "latin1"),
      Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x42, 0x99]),
    ]);
    const res = await postBase64(spoof.toString("base64"), "looks-like.pdf");
    expect(res.status).toBe(200);
    expect(uploads).toHaveLength(1);
    expect(uploads[0].buffer.equals(spoof)).toBe(true);
  });

  it("returns 403 and persists nothing for an unauthenticated caller (no tenant)", async () => {
    // Note: this route uploads the decoded bytes to storage BEFORE the tenant
    // check, so the storage write happens, but no media row is persisted.
    const res = await postParts(
      [{ kind: "field", name: "fileBase64", value: pdfBytes().toString("base64") }],
      null,
    );
    expect(res.status).toBe(403);
    expect(insertedRow).toBeNull();
  });
});

describe("POST /api/lp/pdf/upload — raw multipart file branch (backward compatible)", () => {
  it("accepts a raw multipart `file` PDF part", async () => {
    const bytes = pdfBytes();
    const res = await postParts([
      { kind: "file", name: "file", filename: "Brochure.pdf", contentType: "application/pdf", data: bytes },
    ]);

    expect(res.status).toBe(200);
    const body = res.json as { title: string; mediaType: string; mimeType: string; sizeBytes: number };
    expect(body.title).toBe("Brochure");
    expect(body.mediaType).toBe("pdf");
    expect(body.mimeType).toBe("application/pdf");
    expect(body.sizeBytes).toBe(bytes.length);

    expect(uploads).toHaveLength(1);
    expect(uploads[0].contentType).toBe("application/pdf");
    expect(uploads[0].buffer.equals(bytes)).toBe(true);
  });

  it("rejects a raw multipart `file` part with a non-PDF mime type", async () => {
    const res = await postParts([
      { kind: "file", name: "file", filename: "image.png", contentType: "image/png", data: Buffer.from("not a pdf") },
    ]);
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBe("Only PDF files are allowed");
    expect(uploads).toHaveLength(0);
  });

  it("returns 400 when neither a file part nor a fileBase64 field is provided", async () => {
    const res = await postParts([{ kind: "field", name: "filename", value: "orphan.pdf" }]);
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBe("No file uploaded");
    expect(uploads).toHaveLength(0);
  });
});
