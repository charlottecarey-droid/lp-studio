import { describe, it, expect, vi, afterEach } from "vitest";
import {
  extractWistiaId,
  isWistiaShareLink,
  resolveWistiaShareLink,
  wistiaIdFromOembedHtml,
  wistiaIframeUrl,
} from "./wistia";

describe("extractWistiaId", () => {
  it("parses direct Wistia link shapes to the hashed id", () => {
    const id = "t7fcicxvhs";
    expect(extractWistiaId(`https://dandy.wistia.com/medias/${id}`)).toBe(id);
    expect(extractWistiaId(`https://fast.wistia.net/embed/iframe/${id}`)).toBe(id);
    expect(extractWistiaId(`https://fast.wistia.com/embed/medias/${id}.jsonp`)).toBe(id);
    expect(extractWistiaId(`https://example.com/page?wvideo=${id}`)).toBe(id);
    expect(extractWistiaId(id)).toBe(id);
    expect(extractWistiaId(`  https://dandy.wistia.com/medias/${id}?foo=1  `)).toBe(id);
  });

  it("does NOT treat /s/ share tokens as media ids (they aren't — the player 404s)", () => {
    expect(extractWistiaId("https://dandy.wistia.com/s/r0zpnamhjfarc6a")).toBeNull();
  });

  it("rejects non-Wistia URLs and junk", () => {
    expect(extractWistiaId("")).toBeNull();
    expect(extractWistiaId("https://youtube.com/watch?v=abc12345")).toBeNull();
    expect(extractWistiaId("https://dandy.wistia.com/")).toBeNull();
    expect(extractWistiaId("not a url with spaces")).toBeNull();
    expect(extractWistiaId("https://notwistia.com/medias/abc12345")).toBeNull();
  });
});

describe("isWistiaShareLink", () => {
  it("matches only wistia.com/s/<token> links", () => {
    expect(isWistiaShareLink("https://dandy.wistia.com/s/r0zpnamhjfarc6a")).toBe(true);
    expect(isWistiaShareLink("https://dandy.wistia.com/medias/t7fcicxvhs")).toBe(false);
    expect(isWistiaShareLink("https://example.com/s/whatever")).toBe(false);
    expect(isWistiaShareLink("junk")).toBe(false);
  });
});

describe("wistiaIdFromOembedHtml", () => {
  it("pulls the media id out of a real oEmbed html payload", () => {
    // Shape of the actual fast.wistia.com/oembed response for a /s/ link.
    const html =
      '<iframe src="https://fast.wistia.net/embed/iframe/t7fcicxvhs" title="Polychromatic Shade™ Video" allow="autoplay; fullscreen"></iframe>\n<script src="https://fast.wistia.net/assets/external/E-v1.js" async></script>';
    expect(wistiaIdFromOembedHtml(html)).toBe("t7fcicxvhs");
    expect(wistiaIdFromOembedHtml("<p>nope</p>")).toBeNull();
  });
});

describe("resolveWistiaShareLink", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("resolves via oEmbed and returns the media id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ html: '<iframe src="https://fast.wistia.net/embed/iframe/t7fcicxvhs"></iframe>' }),
    })));
    await expect(resolveWistiaShareLink("https://dandy.wistia.com/s/r0zpnamhjfarc6a")).resolves.toBe(
      "t7fcicxvhs",
    );
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe(
      "https://fast.wistia.com/oembed?url=https%3A%2F%2Fdandy.wistia.com%2Fs%2Fr0zpnamhjfarc6a",
    );
  });

  it("returns null on HTTP failure or network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    await expect(resolveWistiaShareLink("https://dandy.wistia.com/s/x12345")).resolves.toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await expect(resolveWistiaShareLink("https://dandy.wistia.com/s/x12345")).resolves.toBeNull();
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
