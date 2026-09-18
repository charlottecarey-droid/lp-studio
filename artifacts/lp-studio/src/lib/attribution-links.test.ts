import { describe, it, expect } from "vitest";
import { decorateHref, registrableDomain } from "./attribution-links";

const PAGE = "https://lp.meetdandy.com/2-appointment-workflow?utm_source=google";
const PARAMS = { utm_source: "google", utm_medium: "cpc", gclid: "Cj0KCQ" };

describe("registrableDomain", () => {
  it("collapses subdomains to the registrable domain", () => {
    expect(registrableDomain("lp.meetdandy.com")).toBe("meetdandy.com");
    expect(registrableDomain("www.meetdandy.com")).toBe("meetdandy.com");
    expect(registrableDomain("meetdandy.com")).toBe("meetdandy.com");
  });
});

describe("decorateHref", () => {
  it("forwards attribution to another host on the same registrable domain", () => {
    const out = decorateHref("https://www.meetdandy.com/pricing/", PAGE, PARAMS);
    const u = new URL(out);
    expect(u.searchParams.get("utm_source")).toBe("google");
    expect(u.searchParams.get("utm_medium")).toBe("cpc");
    expect(u.searchParams.get("gclid")).toBe("Cj0KCQ");
    expect(u.pathname).toBe("/pricing/");
  });

  it("leaves third-party links untouched so attribution never leaks", () => {
    for (const href of [
      "https://calendly.com/dandy/demo",
      "https://meetdandy.com.evil.example/phish",
      "https://facebook.com/meetdandy",
    ]) {
      expect(decorateHref(href, PAGE, PARAMS)).toBe(href);
    }
  });

  it("leaves non-http destinations untouched", () => {
    for (const href of ["#cta", "mailto:hi@meetdandy.com", "tel:+15125550142", "javascript:void 0"]) {
      expect(decorateHref(href, PAGE, PARAMS)).toBe(href);
    }
  });

  it("never overwrites a param the author already put on the link", () => {
    const out = decorateHref("https://www.meetdandy.com/p/?utm_source=footer", PAGE, PARAMS);
    const u = new URL(out);
    expect(u.searchParams.get("utm_source")).toBe("footer");
    expect(u.searchParams.get("utm_medium")).toBe("cpc");
  });

  it("keeps relative links relative", () => {
    const out = decorateHref("/pricing", PAGE, { utm_source: "google" });
    expect(out).toBe("/pricing?utm_source=google");
  });

  it("is idempotent", () => {
    const once = decorateHref("https://www.meetdandy.com/pricing/", PAGE, PARAMS);
    expect(decorateHref(once, PAGE, PARAMS)).toBe(once);
  });

  it("returns the href unchanged when there is no attribution to forward", () => {
    expect(decorateHref("https://www.meetdandy.com/pricing/", PAGE, {})).toBe(
      "https://www.meetdandy.com/pricing/",
    );
  });
});
