import { describe, expect, it } from "vitest";
import { needsPdfThumbnail } from "./pdf-thumbnail";

describe("needsPdfThumbnail — which resources get a generated first-page thumbnail", () => {
  it("hosted PDFs without a thumbnail only", () => {
    expect(needsPdfThumbnail({ kind: "pdf", fileUrl: "/api/storage/objects/uploads/abc" })).toBe(true);
    expect(needsPdfThumbnail({ kind: "pdf", fileUrl: "/api/storage/objects/uploads/abc", thumbnailUrl: "/api/storage/objects/uploads/t" })).toBe(false);
    expect(needsPdfThumbnail({ kind: "pdf", fileUrl: "", externalUrl: "https://viewer.example.com/x" } as never)).toBe(false);
    expect(needsPdfThumbnail({ kind: "pdf", fileUrl: "https://elsewhere.example.com/file.pdf" })).toBe(false);
    expect(needsPdfThumbnail({ kind: "video", fileUrl: "/api/storage/objects/uploads/abc" })).toBe(false);
    expect(needsPdfThumbnail({ kind: "image", fileUrl: "/api/storage/objects/uploads/abc" })).toBe(false);
  });
});
