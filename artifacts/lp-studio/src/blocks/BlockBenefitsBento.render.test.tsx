import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

/**
 * SSR smoke test for the benefits bento block after the responsive-header fix
 * (container queries replace viewport breakpoints so the headline/subheadline
 * stack whenever the RENDERED width is narrow — builder canvas and mobile
 * preview included) and the premium polish pass (section decor, gradient icon
 * chips, eyebrow accent dash, hero/wide tile corner glows).
 */
import { BlockBenefitsBento } from "./BlockBenefitsBento";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import type { BenefitsBentoBlockProps } from "@/lib/block-types";

const baseProps: BenefitsBentoBlockProps = {
  eyebrow: "Why teams switch",
  headline: "Everything your rollout needs",
  subheadline: "One workspace from first draft to launch day.",
  tiles: [
    { icon: "Rocket", title: "Launch faster", description: "Ship pages in hours." },
    { icon: "Shield", title: "Stay compliant", description: "Approvals built in." },
    { icon: "Zap", title: "Automate follow-up", description: "Leads route instantly." },
    { icon: "BarChart", title: "See what works", description: "Conversion analytics." },
    { icon: "Users", title: "Bring the team", description: "Roles and reviews for everyone." },
  ],
};

function render(props: BenefitsBentoBlockProps): string {
  return renderToStaticMarkup(
    createElement(BlockBenefitsBento, { props, brand: DEFAULT_BRAND }),
  );
}

describe("BlockBenefitsBento render", () => {
  it("renders all tiles and the header copy", () => {
    const html = render(baseProps);
    expect(html).toContain("Everything your rollout needs");
    expect(html).toContain("One workspace from first draft to launch day.");
    for (const tile of baseProps.tiles) {
      expect(html).toContain(tile.title);
    }
  });

  it("uses container queries (not viewport breakpoints) for header and grid", () => {
    const html = render(baseProps);
    expect(html).toContain("@container");
    expect(html).toContain("@4xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]");
    expect(html).toContain("@3xl:grid-cols-3");
    expect(html).toContain("@3xl:col-span-2");
    expect(html).not.toContain("md:grid-cols-3");
    expect(html).not.toContain("lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]");
  });

  it("applies the premium polish details", () => {
    const html = render(baseProps);
    // Gradient icon chips per the section-block polish convention.
    expect(html).toContain("linear-gradient(135deg");
    // Corner glow on the hero/wide tiles.
    expect(html).toContain("radial-gradient(circle");
    // Eyebrow accent dash.
    expect(html).toContain("h-px w-8");
  });

  it("still renders without optional fields", () => {
    const html = render({
      headline: "Bare minimum",
      tiles: baseProps.tiles.slice(0, 3),
      showCta: false,
    });
    expect(html).toContain("Bare minimum");
    expect(html).not.toContain("Get started");
  });
});
