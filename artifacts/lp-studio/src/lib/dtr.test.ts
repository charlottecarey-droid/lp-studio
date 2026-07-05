// Pins the DTR token contract after the July 2026 programmatic-pages fix:
// page-variable DEFAULTS (bare keys from lp_pages.pageVariables) are merged
// into the params map by the viewer, and the token pass ALWAYS runs — a
// visitor must never see raw {{code}}, even on a URL with no query params.
import { describe, it, expect } from "vitest";
import { replaceDtrTokens, applyDtr } from "./dtr";

describe("replaceDtrTokens", () => {
  it("replaces a token from params", () => {
    expect(replaceDtrTokens("Hi {{company}}!", { company: "Acme" })).toBe("Hi Acme!");
  });

  it("params win over the inline fallback", () => {
    expect(replaceDtrTokens("{{company|your practice}}", { company: "Acme" })).toBe("Acme");
  });

  it("uses the inline fallback when the param is missing", () => {
    expect(replaceDtrTokens("{{company|your practice}}", {})).toBe("your practice");
  });

  it("strips an unresolved token instead of rendering raw code", () => {
    expect(replaceDtrTokens("Welcome, {{company}}.", {})).toBe("Welcome, .");
  });

  it("matches token names case-insensitively against lowercased param keys", () => {
    expect(replaceDtrTokens("{{Company}}", { company: "Acme" })).toBe("Acme");
  });

  it("leaves single-brace placeholders (e.g. {dso}) untouched", () => {
    expect(replaceDtrTokens("Hello {dso} team", { dso: "x" })).toBe("Hello {dso} team");
  });
});

describe("applyDtr", () => {
  it("resolves inline fallbacks even with ZERO params (no early return)", () => {
    const props = { headline: "Built for {{company|your team}}" };
    expect(applyDtr(props, {})).toEqual({ headline: "Built for your team" });
  });

  it("deep-walks nested arrays/objects and applies page-variable defaults", () => {
    const props = {
      items: [{ title: "{{company}} pricing" }, { title: "About {{company}}" }],
      cta: { label: "Talk to {{company}}" },
    };
    expect(applyDtr(props, { company: "Acme" })).toEqual({
      items: [{ title: "Acme pricing" }, { title: "About Acme" }],
      cta: { label: "Talk to Acme" },
    });
  });

  it("does NOT substring-replace bare words (only {{token}} syntax matches)", () => {
    const props = { body: "Our company loves {{company}}" };
    expect(applyDtr(props, { company: "Acme" })).toEqual({ body: "Our company loves Acme" });
  });

  it("preserves non-string values", () => {
    const props = { count: 3, on: true, nothing: null, name: "{{first_name|there}}" };
    expect(applyDtr(props, {})).toEqual({ count: 3, on: true, nothing: null, name: "there" });
  });
});
