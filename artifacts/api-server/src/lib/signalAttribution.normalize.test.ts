/**
 * Pure-function unit tests for the signal-attribution canonicalizers.
 *
 * `normalizeLinkedinUrl` and `normalizeDomain` are the JS half of the
 * exact/canonical (never fuzzy) matching contract in `resolveSignalLinkage` and
 * the retroactive backfill. The SQL half is asserted to AGREE with these in the
 * hermetic integration test; here we lock in the JS behaviour on its own (no DB)
 * so a regression surfaces fast.
 *
 * The single most important guarantee: the LinkedIn canonicalizer must KEEP THE
 * PATH (only strip query/fragment + trailing slash) — collapsing a profile URL
 * to the bare `linkedin.com` would make every contact match every signal →
 * mass mis-attribution.
 */
import { describe, it, expect } from "vitest";
import { normalizeLinkedinUrl, normalizeDomain } from "./signalAttribution";

describe("normalizeLinkedinUrl", () => {
  it("returns null for empty / whitespace / nullish input", () => {
    expect(normalizeLinkedinUrl(null)).toBeNull();
    expect(normalizeLinkedinUrl(undefined)).toBeNull();
    expect(normalizeLinkedinUrl("")).toBeNull();
    expect(normalizeLinkedinUrl("   ")).toBeNull();
  });

  it("KEEPS the profile path (never collapses to the bare domain)", () => {
    expect(normalizeLinkedinUrl("https://www.linkedin.com/in/jane-doe")).toBe(
      "linkedin.com/in/jane-doe",
    );
    // Two different profiles must NOT canonicalize to the same value.
    expect(normalizeLinkedinUrl("https://linkedin.com/in/jane-doe")).not.toBe(
      normalizeLinkedinUrl("https://linkedin.com/in/john-roe"),
    );
  });

  it("strips protocol, www., query, fragment, and trailing slash", () => {
    const variants = [
      "https://www.linkedin.com/in/jane-doe",
      "http://www.linkedin.com/in/jane-doe/",
      "https://linkedin.com/in/jane-doe?utm_source=x&trk=y",
      "https://www.linkedin.com/in/jane-doe#about",
      "LinkedIn.com/in/jane-doe",
      "  https://www.linkedin.com/in/jane-doe/  ",
    ];
    for (const v of variants) {
      expect(normalizeLinkedinUrl(v)).toBe("linkedin.com/in/jane-doe");
    }
  });

  it("lowercases the whole URL", () => {
    expect(normalizeLinkedinUrl("HTTPS://WWW.LinkedIn.com/in/Jane-Doe")).toBe(
      "linkedin.com/in/jane-doe",
    );
  });
});

describe("normalizeDomain", () => {
  it("returns null for empty / nullish input", () => {
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain(undefined)).toBeNull();
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("   ")).toBeNull();
  });

  it("strips protocol, www., and any path/query/fragment down to the host", () => {
    const variants = [
      "acme.com",
      "www.acme.com",
      "https://acme.com",
      "https://www.acme.com/",
      "https://www.acme.com/careers?ref=x",
      "http://acme.com#top",
      "  ACME.com  ",
    ];
    for (const v of variants) {
      expect(normalizeDomain(v)).toBe("acme.com");
    }
  });

  it("keeps subdomains distinct (exact match, no fuzz)", () => {
    expect(normalizeDomain("eu.acme.com")).toBe("eu.acme.com");
    expect(normalizeDomain("eu.acme.com")).not.toBe(normalizeDomain("acme.com"));
  });
});
