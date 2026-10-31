import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockDsoGrowthThesis, DSO_GROWTH_THESIS_DEFAULT_PROPS } from "./BlockDsoGrowthThesis";
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { BLOCK_REGISTRY } from "@/lib/block-types/block-registry";
import { getDefaultBlockTags } from "@workspace/lp-template-engine";

// DSO — Growth thesis (Oct 2026). Pins the fail-open reveal contract: under a
// static render the whole statement and every pillar number are in the
// markup at their final values (no word stuck dim, no count-up at 0).
describe("BlockDsoGrowthThesis", () => {
  it("renders the statement verbatim and the final pillar values under static render", () => {
    const html = renderToStaticMarkup(
      <StaticRenderContext.Provider value={true}>
        <BlockDsoGrowthThesis
          props={{
            ...DSO_GROWTH_THESIS_DEFAULT_PROPS,
            statement: "Acquisitions slow down. Same-store growth doesn't have to.",
            pillars: [
              { value: "50%", label: "Fewer denture appointments", body: "From seven or eight visits down to four." },
              { value: "$0", label: "Scanner CapEx", body: "Hardware in every operatory." },
              { value: "12.5%", label: "Annualized revenue increase", body: "Measured at a partner DSO." },
            ],
          }}
        />
      </StaticRenderContext.Provider>,
    );
    expect(html).toContain("Acquisitions slow down. Same-store growth doesn&#x27;t have to.");
    expect(html).toContain("50%");
    expect(html).toContain("$0");
    expect(html).toContain("12.5%");
    expect(html).toContain("Fewer denture appointments");
    expect(html).toContain('data-block="dso-growth-thesis"');
  });

  it("is registered with brand-neutral defaults and template-engine tags", () => {
    const def = BLOCK_REGISTRY.find((b) => b.type === "dso-growth-thesis");
    expect(def).toBeTruthy();
    const json = JSON.stringify(def!.defaultProps()).toLowerCase();
    expect(json).not.toMatch(/dandy|dental|denture|crown/);
    expect(getDefaultBlockTags("dso-growth-thesis")).toEqual(["stats", "content"]);
  });
});
