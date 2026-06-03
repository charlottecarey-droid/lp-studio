import { describe, it, expect } from "vitest";
import {
  WAF_TRIPPING_BODY,
  encodeBodyForWaf,
  maybeEncodeBodyForWaf,
} from "./api-fetch";

// A representative styled marketing email: a CTA button whose href is the
// `{{microsite_url}}` merge token plus a footer unsubscribe link carrying
// `{{unsubscribe_url}}`. This is the exact shape the production edge WAF
// (Cloudflare managed rules) 403s before it ever reaches the origin.
const STYLED_EMAIL_HTML =
  '<table><tr><td>' +
  '<a href="{{microsite_url}}" class="btn">View your page</a>' +
  '</td></tr><tr><td class="footer">' +
  '<a href="{{unsubscribe_url}}">Unsubscribe</a>' +
  "</td></tr></table>";

describe("WAF_TRIPPING_BODY", () => {
  it("matches a raw styled-email HTML string", () => {
    expect(WAF_TRIPPING_BODY.test(STYLED_EMAIL_HTML)).toBe(true);
  });

  it("matches a JSON.stringify'd payload with escaped href tokens (the regression)", () => {
    // When the body is serialized, the attribute quote becomes backslash-escaped
    // (`href=\"{{`). The original regex didn't tolerate that, so serialized
    // styled emails were never wrapped and got blocked at the edge.
    const serialized = JSON.stringify({
      subject: "Your page is live",
      bodyHtml: STYLED_EMAIL_HTML,
    });
    expect(serialized).toContain('href=\\"{{');
    expect(WAF_TRIPPING_BODY.test(serialized)).toBe(true);
  });

  it("matches both single- and double-quoted hrefs", () => {
    expect(WAF_TRIPPING_BODY.test(`<a href='{{cta_url}}'>x</a>`)).toBe(true);
    expect(WAF_TRIPPING_BODY.test(`<a href="{{cta_url}}">x</a>`)).toBe(true);
  });

  it("does NOT match a plain-text body", () => {
    const plain = JSON.stringify({
      subject: "Hello",
      bodyText: "Visit your page at https://example.com and reply to unsubscribe.",
    });
    expect(WAF_TRIPPING_BODY.test(plain)).toBe(false);
  });

  it("does NOT match an already-`__encoded` body (no double-wrap)", () => {
    const alreadyWrapped = encodeBodyForWaf(STYLED_EMAIL_HTML);
    expect(alreadyWrapped).toContain("__encoded");
    expect(WAF_TRIPPING_BODY.test(alreadyWrapped)).toBe(false);
  });
});

describe("encodeBodyForWaf", () => {
  it("wraps the body as `{ __encoded: <base64-utf8> }` that round-trips", () => {
    const wrapped = encodeBodyForWaf(STYLED_EMAIL_HTML);
    const parsed = JSON.parse(wrapped) as { __encoded: string };
    expect(typeof parsed.__encoded).toBe("string");
    // The raw href-token pattern must NOT survive into the wire payload.
    expect(wrapped).not.toContain("href=");
    expect(wrapped).not.toContain("{{");
    const decoded = Buffer.from(parsed.__encoded, "base64").toString("utf8");
    expect(decoded).toBe(STYLED_EMAIL_HTML);
  });

  it("preserves multi-byte UTF-8 content through the round-trip", () => {
    const utf8 = '<a href="{{microsite_url}}">Voir votre page — café ☕ 日本</a>';
    const parsed = JSON.parse(encodeBodyForWaf(utf8)) as { __encoded: string };
    const decoded = Buffer.from(parsed.__encoded, "base64").toString("utf8");
    expect(decoded).toBe(utf8);
  });
});

describe("maybeEncodeBodyForWaf", () => {
  it("wraps a serialized styled-email payload", () => {
    const serialized = JSON.stringify({ bodyHtml: STYLED_EMAIL_HTML });
    const out = maybeEncodeBodyForWaf(serialized);
    expect(typeof out).toBe("string");
    expect(out).not.toBe(serialized);
    const parsed = JSON.parse(out as string) as { __encoded: string };
    const decoded = Buffer.from(parsed.__encoded, "base64").toString("utf8");
    expect(decoded).toBe(serialized);
  });

  it("passes a plain-text body through untouched", () => {
    const plain = JSON.stringify({ bodyText: "No tokens here." });
    expect(maybeEncodeBodyForWaf(plain)).toBe(plain);
  });

  it("does NOT double-wrap an already-`__encoded` body", () => {
    const wrapped = encodeBodyForWaf(STYLED_EMAIL_HTML);
    expect(maybeEncodeBodyForWaf(wrapped)).toBe(wrapped);
  });

  it("passes non-string bodies (FormData) through untouched", () => {
    const fd = new FormData();
    fd.append("file", "x");
    expect(maybeEncodeBodyForWaf(fd)).toBe(fd);
  });

  it("passes null/undefined bodies through untouched", () => {
    expect(maybeEncodeBodyForWaf(undefined)).toBeUndefined();
    expect(maybeEncodeBodyForWaf(null)).toBeNull();
  });
});
