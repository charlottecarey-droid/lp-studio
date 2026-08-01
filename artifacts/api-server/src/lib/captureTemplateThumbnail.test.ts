import { describe, expect, it } from "vitest";
import { storedObjectPathFromServeUrl, resolvePreviewBaseUrl } from "./captureTemplateThumbnail";

describe("storedObjectPathFromServeUrl", () => {
  it("maps our serve URLs back to storage object paths", () => {
    expect(storedObjectPathFromServeUrl("/api/storage/objects/uploads/abc-123")).toBe(
      "/objects/uploads/abc-123",
    );
  });

  it("refuses to touch external URLs (incl. legacy thum.io links)", () => {
    expect(storedObjectPathFromServeUrl("https://image.thum.io/get/width/1600/x")).toBeNull();
    expect(storedObjectPathFromServeUrl("https://images.unsplash.com/photo-1")).toBeNull();
    expect(storedObjectPathFromServeUrl("/objects/uploads/raw-path")).toBeNull();
    expect(storedObjectPathFromServeUrl(null)).toBeNull();
    expect(storedObjectPathFromServeUrl(undefined)).toBeNull();
  });
});

describe("resolvePreviewBaseUrl", () => {
  it("prefers the triggering request host with a scheme by locality", () => {
    expect(resolvePreviewBaseUrl("studio.example.com")).toBe("https://studio.example.com");
    expect(resolvePreviewBaseUrl("localhost:3000")).toBe("http://localhost:3000");
    expect(resolvePreviewBaseUrl("127.0.0.1:5173")).toBe("http://127.0.0.1:5173");
  });
});
