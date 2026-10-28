import { describe, expect, it } from "vitest";
import { MAX_CONTENT_LENGTH_RESPONSE, objectServeHeaders } from "./objectServeHeaders";

describe("objectServeHeaders — large objects stream chunked", () => {
  const base = { contentType: "application/pdf", isPublic: false, cacheTtlSec: 3600 };

  it("small object: exact Content-Length, private cache", () => {
    const h = objectServeHeaders({ ...base, size: "860304" });
    expect(h["Content-Length"]).toBe("860304");
    expect(h["Transfer-Encoding"]).toBeUndefined();
    expect(h["Cache-Control"]).toBe("private, max-age=3600");
    expect(h["Content-Type"]).toBe("application/pdf");
  });

  it("53 MB brochure: no Content-Length (the front end would 500 it), chunked instead", () => {
    const h = objectServeHeaders({ ...base, size: 52_759_460 });
    expect(h["Content-Length"]).toBeUndefined();
    expect(h["Transfer-Encoding"]).toBe("chunked");
  });

  it("boundary: exactly the cap still gets a length; one byte over does not", () => {
    expect(objectServeHeaders({ ...base, size: MAX_CONTENT_LENGTH_RESPONSE })["Content-Length"]).toBe(String(MAX_CONTENT_LENGTH_RESPONSE));
    expect(objectServeHeaders({ ...base, size: MAX_CONTENT_LENGTH_RESPONSE + 1 })["Content-Length"]).toBeUndefined();
  });

  it("unknown size: chunked, octet-stream fallback, public cache when the ACL says so", () => {
    const h = objectServeHeaders({ contentType: null, size: undefined, isPublic: true, cacheTtlSec: 60 });
    expect(h["Transfer-Encoding"]).toBe("chunked");
    expect(h["Content-Type"]).toBe("application/octet-stream");
    expect(h["Cache-Control"]).toBe("public, max-age=60");
  });
});
