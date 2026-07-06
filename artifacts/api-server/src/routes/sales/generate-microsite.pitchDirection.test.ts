import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSystemPrompt } from "./generate-microsite";
import { logger } from "../../lib/logger";

// Regression guard for Task #1066 (the pitch-direction fix) — a future prompt
// refactor must not silently drop the "you are the seller" framing or let the
// resolved seller name degrade to an empty string, which would let the dominant
// account/reference context flip the copy to the prospect's point of view.

type Brand = Record<string, unknown>;

const SEGMENT = { id: "default", name: "Default audience" };

function buildPrompt(brand: Brand): string {
  return buildSystemPrompt(SEGMENT, brand);
}

describe("buildSystemPrompt — pitch direction & seller identity", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => logger);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("always emits the PITCH DIRECTION section naming the resolved seller", () => {
    const prompt = buildPrompt({ brandName: "Royal Design" });

    // The unambiguous persuasion-direction block must be present.
    expect(prompt).toContain("PITCH DIRECTION — read carefully, NEVER reverse this:");
    // It must name the resolved seller and frame the page as written AS the seller.
    expect(prompt).toContain("You write AS Royal Design (the SELLER).");
    expect(prompt).toContain('Write in Royal Design\'s first-person voice ("we", "our"). Address the account as "you".');
    // It must forbid the prospect's point of view and generic copy.
    expect(prompt).toContain("NEVER write from the target account's point of view.");
    // A configured tenant logs no weak-seller warning.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("forbids 'Join {target company}' CTA phrasing and directs CTAs at the seller (issue #1443)", () => {
    const prompt = buildPrompt({ brandName: "Royal Design" });

    // The CTA rule lives inside PITCH DIRECTION so it carries hard-rule weight.
    expect(prompt).toContain("CTA COPY: the reader ALREADY WORKS at the target account");
    expect(prompt).toContain('NEVER invite them to "join" or "sign up for" the target account\'s own company');
    // …and it names the seller as the destination of every CTA.
    expect(prompt).toContain("Every CTA names the next step with Royal Design");
  });

  it("keeps the seller framing when only companyDescription is set (no brandName)", () => {
    const prompt = buildPrompt({
      companyDescription: "an AI-powered logistics platform",
    });

    expect(prompt).toContain("PITCH DIRECTION — read carefully, NEVER reverse this:");
    // No brandName → seller name falls back, but the section still names a seller.
    expect(prompt).toContain("You write AS the selling company (the SELLER).");
    // companyDescription anchors the identity, so no weak-seller warning fires.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("resolves a non-empty fallback seller and logs a warning when neither brandName nor companyDescription is set", () => {
    const prompt = buildPrompt({});

    // PITCH DIRECTION must still be present and name a non-empty seller.
    expect(prompt).toContain("PITCH DIRECTION — read carefully, NEVER reverse this:");
    expect(prompt).toContain("You write AS the selling company (the SELLER).");
    // The fallback must never leave a dangling empty seller name.
    expect(prompt).not.toContain("You write AS  (the SELLER).");
    expect(prompt).not.toContain("Write in 's first-person voice");

    // A weak seller identity must be surfaced via a logged warning.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [, message] = warnSpy.mock.calls[0];
    expect(String(message)).toContain("seller identity is weak");
  });
});
