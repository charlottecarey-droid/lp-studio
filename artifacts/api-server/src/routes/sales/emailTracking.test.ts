/**
 * Unit tests for outbound email tracking (open pixel + click rewriting).
 *
 * These two helpers are why the Performance tab can count anything at all:
 * before this, `injectTrackingPixel` was defined but never called and no link
 * was ever routed through /track/click, so every campaign reported 0 opens and
 * 0 clicks no matter how much real engagement there was.
 *
 * Pure string functions — no Postgres, no network.
 */
import { describe, it, expect } from "vitest";
import { rewriteLinksForClickTracking, applyEmailTracking } from "./campaigns";

const HOST = "https://go.example.com";
const SEND_ID = 42;

function trackedUrl(html: string): string {
  const m = /[?&]url=([^"']+)/.exec(html);
  return m ? decodeURIComponent(m[1]) : "";
}

describe("rewriteLinksForClickTracking", () => {
  it("routes a double-quoted link through /track/click with the send id", () => {
    const out = rewriteLinksForClickTracking('<a href="https://x.com/a">hi</a>', HOST, SEND_ID);
    expect(out).toContain(`${HOST}/api/sales/track/click?sendId=${SEND_ID}`);
    expect(trackedUrl(out)).toBe("https://x.com/a");
  });

  it("handles single-quoted hrefs (templates are not all double-quoted)", () => {
    const out = rewriteLinksForClickTracking("<a href='https://x.com/a'>hi</a>", HOST, SEND_ID);
    expect(out).toContain("href='https://go.example.com/api/sales/track/click");
    expect(trackedUrl(out)).toBe("https://x.com/a");
  });

  it("unescapes &amp; so the redirect target is not mangled", () => {
    // escapeAndLinkifyPlainText escapes before it linkifies, so plain-text
    // campaign bodies reach this helper with &amp; inside the href.
    const out = rewriteLinksForClickTracking('<a href="https://x.com/a?u=1&amp;v=2">hi</a>', HOST, SEND_ID);
    expect(trackedUrl(out)).toBe("https://x.com/a?u=1&v=2");
  });

  it("never wraps the unsubscribe link", () => {
    const html = `<a href="${HOST}/api/sales/unsubscribe?token=abc">unsubscribe</a>`;
    expect(rewriteLinksForClickTracking(html, HOST, SEND_ID)).toBe(html);
  });

  it("leaves mailto: and tel: alone", () => {
    const html = '<a href="mailto:a@b.com">mail</a><a href="tel:+15551234">call</a>';
    expect(rewriteLinksForClickTracking(html, HOST, SEND_ID)).toBe(html);
  });

  it("is idempotent — a second pass does not double-wrap", () => {
    const once = rewriteLinksForClickTracking('<a href="https://x.com/a">z</a>', HOST, SEND_ID);
    expect(rewriteLinksForClickTracking(once, HOST, SEND_ID)).toBe(once);
  });

  it("tracks the personalized microsite link too", () => {
    const out = rewriteLinksForClickTracking(`<a href="${HOST}/p/tok123">page</a>`, HOST, SEND_ID);
    expect(trackedUrl(out)).toBe(`${HOST}/p/tok123`);
  });
});

describe("applyEmailTracking", () => {
  it("appends the open pixel inside </body> when present", () => {
    const out = applyEmailTracking("<body>hello</body>", HOST, SEND_ID);
    expect(out).toContain(`<img src="${HOST}/api/sales/track/open?id=${SEND_ID}"`);
    expect(out.endsWith("</body>")).toBe(true);
  });

  it("appends the pixel at the end for a body with no </body>", () => {
    const out = applyEmailTracking("<div>hello</div>", HOST, SEND_ID);
    expect(out).toContain(`/api/sales/track/open?id=${SEND_ID}`);
  });

  it("does not rewrite the pixel it just added", () => {
    const out = applyEmailTracking("<body>hi</body>", HOST, SEND_ID);
    expect(out).not.toContain("track/click?sendId");
  });

  it("applies both open and click tracking in one pass", () => {
    const out = applyEmailTracking('<body><a href="https://x.com/a">go</a></body>', HOST, SEND_ID);
    expect(out).toContain("/api/sales/track/click?sendId=");
    expect(out).toContain("/api/sales/track/open?id=");
  });
});
