/**
 * Microsite normalize path — alias-guard regression pin (Task #1067).
 *
 * Task #1066 fixed the case where a model-emitted `features` block surfaced an
 * "Unknown block type" placeholder on the published sales microsite. The fix
 * canonicalizes the type inside `normalizeBlock` BEFORE the freeform allow-list
 * filter runs, so a synonym becomes a renderable block AND survives the filter.
 *
 * This pins both halves of that contract end-to-end on the real route helpers:
 *   - normalizeBlock rewrites a `features` block to the renderable `benefits-grid`
 *     and preserves its content (mapped through the benefits-grid defaults).
 *   - the resulting canonical type is in FREEFORM_ALLOWED_TYPE_SET, so the
 *     freeform filter keeps it instead of dropping it.
 */
import { describe, expect, it } from "vitest";
import { normalizeBlock, FREEFORM_ALLOWED_TYPE_SET } from "./generate-microsite";

const BRAND = { name: "Acme", tagline: "", valuePropPairs: [] };

describe("microsite normalize path — features alias", () => {
  it("rewrites a model-emitted `features` block to a renderable `benefits-grid`", () => {
    const normalized = normalizeBlock(
      {
        type: "features",
        props: {
          headline: "Why Acme",
          items: [{ title: "Fast", description: "Very fast" }],
        },
      },
      0,
      BRAND,
    );

    expect(normalized.type).toBe("benefits-grid");
    const props = normalized.props as Record<string, unknown>;
    expect(props.headline).toBe("Why Acme");
    expect(props.items).toEqual([
      { icon: "Zap", title: "Fast", description: "Very fast" },
    ]);
  });

  it("the canonical type survives the freeform allow-list filter", () => {
    const normalized = normalizeBlock({ type: "features", props: {} }, 0, BRAND);
    // The freeform mode drops any block whose type isn't in this set; the alias
    // guard must land it on a type the set contains.
    expect(FREEFORM_ALLOWED_TYPE_SET.has(String(normalized.type))).toBe(true);
  });

  it("every alias target is accepted by the freeform allow-list", () => {
    // trust-bar / testimonial / benefits-grid / bottom-cta — each alias canonical
    // must be a type the freeform filter keeps, or a synonym would be silently
    // dropped from the page instead of rendered.
    for (const canonical of ["benefits-grid", "trust-bar", "testimonial", "bottom-cta"]) {
      const normalized = normalizeBlock({ type: canonical, props: {} }, 0, BRAND);
      expect(FREEFORM_ALLOWED_TYPE_SET.has(String(normalized.type))).toBe(true);
    }
  });
});
