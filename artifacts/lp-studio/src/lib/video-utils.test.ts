import { describe, expect, it } from "vitest";
import { getAutoplayEmbedUrl, isNativeVideoUrl } from "./video-utils";

/**
 * Pins the Wistia branch of the generic embed resolver: every Wistia link
 * shape must land on the fast.wistia.net iframe endpoint (a wistia.com/medias
 * page X-Frame-denies, so passing it through would render an empty player in
 * every VideoModal / inline-embed consumer). Share tokens (/s/) resolve
 * asynchronously at input time, so here they must pass through unchanged.
 */
describe("getAutoplayEmbedUrl — Wistia", () => {
  it("converts a media-page link to the iframe player with silent autoplay", () => {
    expect(getAutoplayEmbedUrl("https://dandy.wistia.com/medias/abc123def4")).toBe(
      "https://fast.wistia.net/embed/iframe/abc123def4?autoPlay=true&silentAutoPlay=allow",
    );
  });

  it("normalizes an embed URL onto the same endpoint", () => {
    expect(getAutoplayEmbedUrl("https://fast.wistia.net/embed/iframe/abc123def4")).toBe(
      "https://fast.wistia.net/embed/iframe/abc123def4?autoPlay=true&silentAutoPlay=allow",
    );
  });

  it("honors ?wvideo= share decorations on any host", () => {
    expect(
      getAutoplayEmbedUrl("https://www.example.com/some-page?wvideo=abc123def4"),
    ).toBe("https://fast.wistia.net/embed/iframe/abc123def4?autoPlay=true&silentAutoPlay=allow");
  });

  it("passes /s/ share tokens through unchanged (resolved async at input time)", () => {
    const share = "https://dandy.wistia.com/s/tokentoken1";
    expect(getAutoplayEmbedUrl(share)).toBe(share);
  });

  it("leaves YouTube and native files on their existing paths", () => {
    expect(getAutoplayEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toContain(
      "youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(getAutoplayEmbedUrl("https://cdn.example.com/clip.mp4")).toBe(
      "https://cdn.example.com/clip.mp4",
    );
    expect(isNativeVideoUrl("https://cdn.example.com/clip.mp4")).toBe(true);
  });
});
