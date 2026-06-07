/**
 * Unit tests for the content-series brand accent + logo post-pass (Task #1173,
 * tested under Task #1177).
 *
 * `applyContentSeriesBranding` is the deterministic post-pass that bakes the
 * tenant's brand accent into a generated content-series block's `theme.primary`
 * and its real logo into `logoUrl`. The self-contained content-series full-page
 * block carries its accent in `theme.primary` (NOT a top-level `accentColor`
 * prop), so the generic accentColor post-pass never touches it — this function
 * is what persists an explicit accent + logo on the saved block.
 *
 * Asserted contract:
 *   1. A content-series block gets theme.primary = brand accentColor and
 *      logoUrl = brand logoUrl.
 *   2. accentColor falls back to primaryColor when no accent is set.
 *   3. A brand with no logo leaves logoUrl untouched (text-logo fallback "").
 *   4. Non-content-series blocks are never touched.
 *   5. An existing theme object is preserved (only `primary` is overwritten).
 */
import { describe, it, expect } from "vitest";
import { applyContentSeriesBranding } from "./generate-page";

describe("applyContentSeriesBranding", () => {
  it("bakes the brand accent into theme.primary and the brand logo into logoUrl", () => {
    const blocks = [
      { type: "content-series", props: { logoUrl: "" } },
    ];
    applyContentSeriesBranding(blocks, {
      accentColor: "#C7E738",
      primaryColor: "#0f172a",
      logoUrl: "/api/storage/logo.png",
    });
    const props = blocks[0]!.props as Record<string, unknown>;
    expect(props.theme).toEqual({ primary: "#C7E738" });
    expect(props.logoUrl).toBe("/api/storage/logo.png");
  });

  it("falls back to primaryColor when the brand has no accentColor", () => {
    const blocks = [{ type: "content-series", props: {} }];
    applyContentSeriesBranding(blocks, {
      primaryColor: "#123456",
      logoUrl: "/api/storage/logo.png",
    });
    const props = blocks[0]!.props as Record<string, unknown>;
    expect((props.theme as Record<string, unknown>).primary).toBe("#123456");
  });

  it("leaves logoUrl untouched for a brand with no logo (text-logo fallback)", () => {
    const blocks = [{ type: "content-series", props: { logoUrl: "" } }];
    applyContentSeriesBranding(blocks, { accentColor: "#C7E738" });
    const props = blocks[0]!.props as Record<string, unknown>;
    expect(props.logoUrl).toBe("");
  });

  it("treats a whitespace-only brand logo as no logo", () => {
    const blocks = [{ type: "content-series", props: { logoUrl: "" } }];
    applyContentSeriesBranding(blocks, { accentColor: "#C7E738", logoUrl: "   " });
    const props = blocks[0]!.props as Record<string, unknown>;
    expect(props.logoUrl).toBe("");
  });

  it("never touches non-content-series blocks", () => {
    const blocks = [
      { type: "hero", props: { logoUrl: "" } },
      { type: "footer", props: {} },
    ];
    applyContentSeriesBranding(blocks, {
      accentColor: "#C7E738",
      logoUrl: "/api/storage/logo.png",
    });
    expect((blocks[0]!.props as Record<string, unknown>).logoUrl).toBe("");
    expect((blocks[0]!.props as Record<string, unknown>).theme).toBeUndefined();
    expect((blocks[1]!.props as Record<string, unknown>).theme).toBeUndefined();
  });

  it("preserves an existing theme object and only overwrites primary", () => {
    const blocks = [
      { type: "content-series", props: { theme: { primary: "#old", accent: "#keep" } } },
    ];
    applyContentSeriesBranding(blocks, { accentColor: "#C7E738" });
    const theme = (blocks[0]!.props as Record<string, unknown>).theme as Record<string, unknown>;
    expect(theme.primary).toBe("#C7E738");
    expect(theme.accent).toBe("#keep");
  });

  it("is a no-op when the brand has neither accent nor primary color", () => {
    const blocks = [{ type: "content-series", props: { logoUrl: "" } }];
    applyContentSeriesBranding(blocks, {});
    const props = blocks[0]!.props as Record<string, unknown>;
    expect(props.theme).toBeUndefined();
    expect(props.logoUrl).toBe("");
  });
});
