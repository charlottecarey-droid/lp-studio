import { describe, it, expect } from "vitest";
import { isChiliPiperUrl, parseLpCtaMessage, resolveLpCtaAction } from "./custom-html-cta";

describe("parseLpCtaMessage", () => {
  it("accepts a valid request and cleans the email", () => {
    expect(parseLpCtaMessage({ __lpOpenCta: { mode: "chilipiper", email: " a@b.co " } })).toEqual({ mode: "chilipiper", email: "a@b.co" });
  });
  it("ignores other messages and bad modes", () => {
    expect(parseLpCtaMessage({ __lpCustomHtmlHeight: 300 })).toBeNull();
    expect(parseLpCtaMessage({ __lpOpenCta: { mode: "evil" } })).toBeNull();
    expect(parseLpCtaMessage("x")).toBeNull();
    expect(parseLpCtaMessage(null)).toBeNull();
  });
  it("drops invalid emails and non-Chili-Piper urls", () => {
    expect(parseLpCtaMessage({ __lpOpenCta: { mode: "form", email: "nope", url: "https://evil.example/x" } })).toEqual({ mode: "form", email: "" });
    expect(parseLpCtaMessage({ __lpOpenCta: { mode: "chilipiper", url: "https://dandy.chilipiper.com/router/x" } })?.url).toBe("https://dandy.chilipiper.com/router/x");
  });
});

describe("isChiliPiperUrl", () => {
  it("only allows https chilipiper hosts", () => {
    expect(isChiliPiperUrl("https://acme.chilipiper.com/book/me")).toBe(true);
    expect(isChiliPiperUrl("http://acme.chilipiper.com/book/me")).toBe(false);
    expect(isChiliPiperUrl("https://chilipiper.com.evil.example/")).toBe(false);
    expect(isChiliPiperUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("resolveLpCtaAction", () => {
  const cp = "https://acme.chilipiper.com/router/demo";
  it("chilipiper mode uses request url, then page CTA, then brand", () => {
    expect(resolveLpCtaAction({ mode: "chilipiper", email: "a@b.co", url: cp }, {})).toEqual({ kind: "chilipiper", url: cp, email: "a@b.co" });
    expect(resolveLpCtaAction({ mode: "chilipiper", email: "" }, { modalChilipiperUrl: cp })).toEqual({ kind: "chilipiper", url: cp, email: "" });
    expect(resolveLpCtaAction({ mode: "chilipiper", email: "" }, {}, cp)).toEqual({ kind: "chilipiper", url: cp, email: "" });
    expect(resolveLpCtaAction({ mode: "chilipiper", email: "" }, {}).kind).toBe("none");
  });
  it("cta mode follows the page CTA's action", () => {
    expect(resolveLpCtaAction({ mode: "cta", email: "a@b.co" }, { action: "modal-form" })).toEqual({ kind: "form", email: "a@b.co" });
    expect(resolveLpCtaAction({ mode: "cta", email: "" }, { action: "url", url: "https://x.example" })).toEqual({ kind: "navigate", url: "https://x.example" });
    expect(resolveLpCtaAction({ mode: "cta", email: "" }, { action: "url", url: "javascript:x" }).kind).toBe("none");
    expect(resolveLpCtaAction({ mode: "cta", email: "" }, { action: "modal-chilipiper", modalChilipiperUrl: cp }).kind).toBe("chilipiper");
  });
});
