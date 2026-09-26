import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * SSR smoke + contract test for the Stack block family (Sept 2026): the seven
 * Ramp-style glow/video blocks. Pins the things that matter for every consumer:
 *
 *  - every block renders its headline copy from registry defaults under the
 *    neutral DEFAULT_BRAND (no brand-specific assumptions);
 *  - registry defaults leak no Dandy strings / colours (the generic-catalog
 *    contract — Dandy copy lives only in the dental seed);
 *  - the media contract: a native video URL renders a muted looping <video>
 *    blended into its panel; an image-only slot renders an <img>; an empty
 *    slot renders the built-in placeholder graphic instead of nothing;
 *  - the stat band count-up short-circuits to the final number under
 *    StaticRenderContext (fail-open reveal contract).
 */
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import { BlockGlowVideoHero } from "./BlockGlowVideoHero";
import { BlockVideoStepShowcase } from "./BlockVideoStepShowcase";
import { BlockGlowStatBand } from "./BlockGlowStatBand";
import { BlockVideoZigzag } from "./BlockVideoZigzag";
import { BlockBenchmarkBars } from "./BlockBenchmarkBars";
import { BlockVideoCardTrio } from "./BlockVideoCardTrio";
import { BlockGlowFinalCta } from "./BlockGlowFinalCta";
import { BlockGlowFormHero } from "./BlockGlowFormHero";

const FAMILY = [
  ["glow-video-hero", BlockGlowVideoHero],
  ["video-step-showcase", BlockVideoStepShowcase],
  ["glow-stat-band", BlockGlowStatBand],
  ["video-zigzag", BlockVideoZigzag],
  ["benchmark-bars", BlockBenchmarkBars],
  ["video-card-trio", BlockVideoCardTrio],
  ["glow-final-cta", BlockGlowFinalCta],
  ["glow-form-hero", BlockGlowFormHero],
] as const;

function defaultsFor(type: string): Record<string, unknown> {
  const def = BLOCK_REGISTRY.find((d) => d.type === type);
  if (!def) throw new Error(`missing registry entry: ${type}`);
  return def.defaultProps() as Record<string, unknown>;
}

function renderStatic(Component: (p: never) => ReactElement, props: Record<string, unknown>, staticRender = false): string {
  const el = createElement(Component as never, { props, brand: DEFAULT_BRAND } as never);
  return renderToStaticMarkup(
    staticRender ? createElement(StaticRenderContext.Provider, { value: true }, el) : el,
  );
}

const DANDY_LEAK = /meetdandy|#003a30|#00231d|#c7e738|\bDandy\b/i;

describe("Stack family — registry defaults render under the neutral brand", () => {
  it.each(FAMILY)("%s renders its default headline and leaks no Dandy content", (type, Component) => {
    const props = defaultsFor(type);
    const html = renderStatic(Component as never, props);
    const headline = (props.headline as string) ?? "";
    expect(headline.length).toBeGreaterThan(0);
    // InlineText HTML-escapes apostrophes; compare on a safe fragment.
    expect(html).toContain(headline.split("'")[0].slice(0, 12));
    expect(html).not.toMatch(DANDY_LEAK);
    expect(html).toContain("<section");
  });
});

describe("Stack family — media contract", () => {
  it("glow-video-hero renders a muted looping blended <video> for a native clip", () => {
    const html = renderStatic(BlockGlowVideoHero as never, {
      ...defaultsFor("glow-video-hero"),
      mediaVideoUrl: "/videos/clip.mp4",
    });
    expect(html).toMatch(/<video[^>]*src="\/videos\/clip\.mp4"/);
    expect(html).toMatch(/<video[^>]*\bmuted\b/);
    expect(html).toMatch(/<video[^>]*\bloop\b/);
    expect(html).toMatch(/<video[^>]*playsinline/i);
    expect(html).toMatch(/mix-blend-mode:\s*multiply/);
    expect(html).not.toContain("<iframe");
  });

  it("uses screen blending on a dark surface and multiply on a light one", () => {
    const base = { ...defaultsFor("video-zigzag") } as Record<string, unknown>;
    const rows = [{ title: "Row", body: "Body", videoUrl: "/videos/a.mp4" }];
    const light = renderStatic(BlockVideoZigzag as never, { ...base, rows, bgColor: "#F5F4F0" });
    const dark = renderStatic(BlockVideoZigzag as never, { ...base, rows, bgColor: "#111111" });
    expect(light).toMatch(/mix-blend-mode:\s*multiply/);
    expect(dark).toMatch(/mix-blend-mode:\s*screen/);
  });

  it("mediaBlend \"none\" renders opaque media", () => {
    const html = renderStatic(BlockVideoCardTrio as never, {
      ...defaultsFor("video-card-trio"),
      mediaBlend: "none",
      cards: [{ title: "A", body: "b", videoUrl: "/videos/a.mp4" }],
    });
    expect(html).toMatch(/mix-blend-mode:\s*normal/);
  });

  it("an image-only slot renders an <img>, an empty slot renders the placeholder graphic", () => {
    const withImage = renderStatic(BlockVideoStepShowcase as never, {
      ...defaultsFor("video-step-showcase"),
      steps: [{ title: "One", body: "b", imageUrl: "https://example.com/shot.png", imageAlt: "Shot" }],
    });
    expect(withImage).toMatch(/<img[^>]*src="https:\/\/example\.com\/shot\.png"/);
    expect(withImage).not.toContain("gm-ph");

    const empty = renderStatic(BlockVideoStepShowcase as never, {
      ...defaultsFor("video-step-showcase"),
      steps: [{ title: "One", body: "b" }],
    });
    expect(empty).toContain("gm-ph");
    expect(empty).not.toContain("<video");
    expect(empty).not.toContain("<img");
  });

  it("extension-less media-library uploads play as native <video>, not an <iframe>", () => {
    const html = renderStatic(BlockGlowVideoHero as never, {
      ...defaultsFor("glow-video-hero"),
      mediaVideoUrl: "/api/storage/objects/uploads/f6f413fd-9db8-4772-b888-b6d45e58bbb9",
    });
    expect(html).toMatch(/<video[^>]*src="\/api\/storage\/objects\/uploads\/f6f413fd-9db8-4772-b888-b6d45e58bbb9"/);
    expect(html).not.toContain("<iframe");
  });

  it("embed links render an autoplaying iframe rather than a <video>", () => {
    const html = renderStatic(BlockVideoZigzag as never, {
      ...defaultsFor("video-zigzag"),
      rows: [{ title: "Row", body: "Body", videoUrl: "https://www.youtube.com/watch?v=abc123" }],
    });
    expect(html).toMatch(/<iframe[^>]*youtube\.com\/embed\/abc123/);
    expect(html).not.toContain("<video");
  });
});

describe("glow-form-hero — lead form contract", () => {
  it("renders the configured native fields, a required email, and the submit button", () => {
    const html = renderStatic(BlockGlowFormHero as never, {
      ...defaultsFor("glow-form-hero"),
      fields: ["firstName", "lastName", "email", "company", "locations"],
      chilipiperUrl: "https://example.chilipiper.com/round-robin/x",
      riskLine: "30 minutes. No commitment.",
    });
    expect(html).toMatch(/<form/);
    expect(html).toMatch(/name="firstName"/);
    expect(html).toMatch(/name="lastName"/);
    expect(html).toMatch(/name="email"[^>]*required|required[^>]*name="email"/);
    expect(html).toMatch(/name="company"/);
    expect(html).toMatch(/<select[^>]*name="locations"/);
    expect(html).not.toMatch(/name="phone"/);
    expect(html).toContain("30 minutes. No commitment.");
    expect(html).toContain("or pick a time now");
    expect(html).not.toContain("<video");
  });

  it("omits the pick-a-time link when no booking URL is set", () => {
    const html = renderStatic(BlockGlowFormHero as never, { ...defaultsFor("glow-form-hero"), chilipiperUrl: "" });
    expect(html).not.toContain("or pick a time now");
  });
});

describe("Stack family — static render (fail-open) contract", () => {
  it("glow-stat-band shows the final stat figure under StaticRenderContext", () => {
    const html = renderStatic(
      BlockGlowStatBand as never,
      { ...defaultsFor("glow-stat-band"), stats: [{ prefix: "Up to", value: "60%", label: "faster" }], quotes: [] },
      true,
    );
    // The count-up spring is jumped to the final value on static render; the
    // affix always renders around the numeral.
    expect(html).toContain("%");
    expect(html).toContain("Up to");
    expect(html).not.toContain("opacity:0");
  });

  it("benchmark-bars pins each fill height in its inline style so a static frame shows the chart", () => {
    const html = renderStatic(
      BlockBenchmarkBars as never,
      { ...defaultsFor("benchmark-bars"), bars: [{ label: "Us", value: 100, highlighted: true }, { label: "Them", value: 42, delta: "+9 pts" }] },
      true,
    );
    expect(html).toMatch(/height:\s*100%/);
    expect(html).toMatch(/height:\s*42%/);
    expect(html).toContain("+9 pts");
  });

  it("every block renders no hidden (opacity:0) reveal content under StaticRenderContext", () => {
    for (const [type, Component] of FAMILY) {
      // The step showcase stacks one media panel per step and hides the
      // INACTIVE ones with opacity:0 — that is content selection (the active
      // step is always opacity:1), not a scroll reveal, so it is asserted
      // separately below.
      if (type === "video-step-showcase") continue;
      const html = renderStatic(Component as never, defaultsFor(type), true);
      expect(html, type).not.toMatch(/opacity:\s*0[;"]/);
    }
  });

  it("video-step-showcase renders the first step's panel visible under StaticRenderContext", () => {
    const html = renderStatic(BlockVideoStepShowcase as never, defaultsFor("video-step-showcase"), true);
    const firstPanel = html.indexOf('class="absolute inset-0 transition-opacity');
    expect(firstPanel).toBeGreaterThan(-1);
    expect(html.slice(firstPanel, firstPanel + 160)).toMatch(/opacity:\s*1/);
    expect(html).toMatch(/aria-selected="true"/);
  });
});
