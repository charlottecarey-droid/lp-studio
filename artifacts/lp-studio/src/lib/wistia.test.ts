import { describe, it, expect } from "vitest";
import { extractWistiaId, wistiaIframeUrl } from "./wistia";

describe("extractWistiaId", () => {
  it("parses every common Wistia link shape to the hashed id", () => {
    const id = "r0zpnamhjfarc6a";
    expect(extractWistiaId(`https://dandy.wistia.com/s/${id}`)).toBe(id);
    expect(extractWistiaId(`https://dandy.wistia.com/medias/${id}`)).toBe(id);
    expect(extractWistiaId(`https://fast.wistia.net/embed/iframe/${id}`)).toBe(id);
    expect(extractWistiaId(`https://fast.wistia.com/embed/medias/${id}.jsonp`)).toBe(id);
    expect(extractWistiaId(`https://example.com/page?wvideo=${id}`)).toBe(id);
    expect(extractWistiaId(id)).toBe(id);
    expect(extractWistiaId(`  https://dandy.wistia.com/medias/${id}?foo=1  `)).toBe(id);
  });

  it("rejects non-Wistia URLs and junk", () => {
    expect(extractWistiaId("")).toBeNull();
    expect(extractWistiaId("https://youtube.com/watch?v=abc12345")).toBeNull();
    expect(extractWistiaId("https://dandy.wistia.com/")).toBeNull();
    expect(extractWistiaId("not a url with spaces")).toBeNull();
    expect(extractWistiaId("https://notwistia.com/medias/abc12345")).toBeNull();
  });
});

describe("wistiaIframeUrl", () => {
  it("builds the fast.wistia.net iframe URL, with optional autoplay", () => {
    expect(wistiaIframeUrl("abc12345")).toBe("https://fast.wistia.net/embed/iframe/abc12345");
    expect(wistiaIframeUrl("abc12345", { autoPlay: true })).toBe(
      "https://fast.wistia.net/embed/iframe/abc12345?autoPlay=true",
    );
  });
});
