import { describe, it, expect } from "vitest";
import {
  buildGeneralSystemPrompt,
  extractGeneralBlockBullets,
  extractPromptBlockTypes,
} from "./generate-page";

// `mega-menu-nav` is a real GENERAL block type advertised in the general system
// prompt — a clean stand-in for a superadmin-approved extra block whose
// description must be lifted out of the GENERAL library so it can be advertised
// on the curated DSO paths (segment-approval vocab expansion).
const EXTRA = "mega-menu-nav";

describe("segment-approval — extractGeneralBlockBullets", () => {
  const general = buildGeneralSystemPrompt({
    includeContentSeries: true,
    includeBlogSeries: true,
    includeStorefront: true,
  });

  it("the general library actually advertises the extra type", () => {
    expect(extractPromptBlockTypes(general)).toContain(EXTRA);
  });

  it("lifts the full bullet for an approved extra type", () => {
    const bullets = extractGeneralBlockBullets(general, [EXTRA]);
    expect(bullets).toHaveLength(1);
    expect(bullets[0].startsWith(`- "${EXTRA}":`)).toBe(true);
  });

  it("returns nothing for an unknown type (fail-safe — cannot describe it)", () => {
    expect(extractGeneralBlockBullets(general, ["totally-made-up-block"])).toEqual([]);
  });

  it("returns nothing for an empty request", () => {
    expect(extractGeneralBlockBullets(general, [])).toEqual([]);
  });

  it("only returns the found subset, preserving requested order", () => {
    const bullets = extractGeneralBlockBullets(general, ["totally-made-up-block", EXTRA]);
    expect(bullets).toHaveLength(1);
    expect(bullets[0].startsWith(`- "${EXTRA}":`)).toBe(true);
  });
});
