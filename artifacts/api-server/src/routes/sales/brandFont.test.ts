/**
 * Unit test for the /sales/brand-font resolver.
 *
 * The resolver fetches a Google Fonts CSS v1 document server-side (with a
 * non-modern UA so Google returns embeddable TTF rather than woff2), parses the
 * @font-face blocks into weight/style → gstatic TTF URL, fetches each TTF, and
 * returns it base64-encoded for jsPDF to embed. This test stubs `fetch` so it
 * runs offline and asserts:
 *
 *   - the CSS request uses the curl UA (otherwise Google serves woff2);
 *   - @font-face blocks are mapped to normal/bold/italic/bolditalic correctly;
 *   - SSRF guard: a TTF URL on any host other than fonts.gstatic.com is dropped;
 *   - results are cached (a second request issues no new fetches);
 *   - invalid family names are rejected with 400;
 *   - any upstream failure degrades gracefully to an empty faces map.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import express, { type Express } from "express";
import { inject } from "../../test-utils/injectRequest";
import brandFontRouter from "./brand-font";

// A tiny valid TTF byte sequence (magic 0x00010000 + padding) so the magic-byte
// check passes; the actual glyph data is irrelevant to the resolver.
const TTF_MAGIC = Buffer.concat([Buffer.from([0x00, 0x01, 0x00, 0x00]), Buffer.alloc(64, 1)]);

function cssBlock(weight: number, style: "normal" | "italic", url: string): string {
  return `@font-face {
  font-family: 'Test Sans';
  font-style: ${style};
  font-weight: ${weight};
  src: url(${url}) format('truetype');
}`;
}

function ttfResponse(): Response {
  return new Response(TTF_MAGIC, { status: 200 });
}

function cssResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/css" } });
}

let app: Express;

function buildApp(): Express {
  const a = express();
  a.use(brandFontRouter);
  return a;
}

describe("/sales/brand-font resolver", () => {
  beforeEach(() => {
    app = buildApp();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves regular/bold/italic/bolditalic from gstatic and uses the curl UA", async () => {
    const css = [
      cssBlock(400, "normal", "https://fonts.gstatic.com/s/test/regular.ttf"),
      cssBlock(700, "normal", "https://fonts.gstatic.com/s/test/bold.ttf"),
      cssBlock(400, "italic", "https://fonts.gstatic.com/s/test/italic.ttf"),
      cssBlock(700, "italic", "https://fonts.gstatic.com/s/test/bolditalic.ttf"),
    ].join("\n");

    const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("fonts.googleapis.com")) return cssResponse(css);
      if (url.endsWith(".ttf")) return ttfResponse();
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await inject(app, { method: "GET", url: "/brand-font?family=Embed%20Fam" });
    expect(res.status).toBe(200);
    const body = res.json as { family: string; faces: Record<string, string> };
    expect(body.family).toBe("Embed Fam");
    expect(Object.keys(body.faces).sort()).toEqual(["bold", "bolditalic", "italic", "normal"]);
    for (const v of Object.values(body.faces)) expect(typeof v).toBe("string");

    // CSS request must carry the curl UA (else Google serves woff2).
    const cssCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("fonts.googleapis.com"));
    expect(cssCall).toBeTruthy();
    const headers = (cssCall?.[1] as RequestInit | undefined)?.headers as Record<string, string> | undefined;
    expect(headers?.["User-Agent"]).toMatch(/curl/i);
  });

  it("drops a TTF URL whose host is not fonts.gstatic.com (SSRF guard)", async () => {
    const css = [
      cssBlock(400, "normal", "https://fonts.gstatic.com/s/test/regular.ttf"),
      cssBlock(700, "normal", "https://evil.example.com/s/test/bold.ttf"),
    ].join("\n");

    const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("fonts.googleapis.com")) return cssResponse(css);
      if (url.startsWith("https://fonts.gstatic.com") && url.endsWith(".ttf")) return ttfResponse();
      // An attacker-controlled host must never be fetched.
      throw new Error(`SSRF: fetched disallowed host ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await inject(app, { method: "GET", url: "/brand-font?family=Ssrf%20Fam" });
    expect(res.status).toBe(200);
    const body = res.json as { faces: Record<string, string> };
    expect(Object.keys(body.faces)).toEqual(["normal"]);
    // The evil host must not have been requested at all.
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("evil.example.com"))).toBe(false);
  });

  it("caches results — a repeat request issues no new fetches", async () => {
    const css = cssBlock(400, "normal", "https://fonts.gstatic.com/s/cached/regular.ttf");
    const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("fonts.googleapis.com")) return cssResponse(css);
      return ttfResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await inject(app, { method: "GET", url: "/brand-font?family=CachedFam" });
    expect(first.status).toBe(200);
    const callsAfterFirst = fetchMock.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    const second = await inject(app, { method: "GET", url: "/brand-font?family=CachedFam" });
    expect(second.status).toBe(200);
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("rejects an invalid font family with 400", async () => {
    const fetchMock = vi.fn(async () => cssResponse(""));
    vi.stubGlobal("fetch", fetchMock);
    const res = await inject(app, { method: "GET", url: "/brand-font?family=Bad%2Fname%3Bhack" });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("degrades to an empty faces map when the upstream CSS fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const res = await inject(app, { method: "GET", url: "/brand-font?family=Whatever" });
    expect(res.status).toBe(200);
    const body = res.json as { family: string; faces: Record<string, string> };
    expect(body.family).toBe("Whatever");
    expect(body.faces).toEqual({});
  });
});
