import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockDsoVideoCaseStudy, DSO_VIDEO_CASE_STUDY_DEFAULT_PROPS } from "./BlockDsoVideoCaseStudy";
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { BLOCK_REGISTRY } from "@/lib/block-types/block-registry";
import { getDefaultBlockTags } from "@workspace/lp-template-engine";

// DSO — Video case study (Nov 2026). Static render must carry the company,
// headline, every outcome number, the verbatim quote and the poster.
describe("BlockDsoVideoCaseStudy", () => {
  it("renders the story, numbers, verbatim quote and poster under static render", () => {
    const html = renderToStaticMarkup(
      <StaticRenderContext.Provider value={true}>
        <BlockDsoVideoCaseStudy
          props={{
            ...DSO_VIDEO_CASE_STUDY_DEFAULT_PROPS,
            company: "Enable Dental",
            headline: "From four appointments per denture to fewer than two",
            stats: [{ value: "<2", label: "Appointments per denture" }, { value: "$9.2M+", label: "Total annualized value" }],
            quote: "that's a game-changer for a mobile practice",
            quoteAuthor: "Dr. Nathan Suter",
            videoUrl: "https://fast.wistia.net/embed/iframe/srm79zv45w",
            posterUrl: "https://example.com/poster.webp",
          }}
        />
      </StaticRenderContext.Provider>,
    );
    expect(html).toContain("Enable Dental");
    expect(html).toContain("From four appointments per denture to fewer than two");
    expect(html).toContain("&lt;2");
    expect(html).toContain("$9.2M+");
    expect(html).toContain("game-changer");
    expect(html).toContain('src="https://example.com/poster.webp"');
    expect(html).toContain("Play Enable Dental story");
    // The Wistia iframe mounts only after play — never at first paint.
    expect(html).not.toContain("<iframe");
  });

  it("is registered with brand-neutral defaults and social-proof tags", () => {
    const def = BLOCK_REGISTRY.find((b) => b.type === "dso-video-case-study");
    expect(def).toBeTruthy();
    expect(JSON.stringify(def!.defaultProps()).toLowerCase()).not.toMatch(/dandy|dental|denture|crown/);
    expect(getDefaultBlockTags("dso-video-case-study")).toEqual(["social-proof", "media"]);
  });
});
