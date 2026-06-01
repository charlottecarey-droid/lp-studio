/**
 * Unit tests for the Conversion Scorer calibration.
 *
 * These exercise the pure functions `analyzeBlocks` and `computeConversionScore`
 * — no DB, no network. The contract under test (Task: calibrate so starter
 * pages score B+):
 *   1. Block detection recognizes the full social-proof and booking/form
 *      vocabulary the generator and catalog actually emit.
 *   2. A structurally complete page with NO traffic scores B- or higher out of
 *      the box, and its social-proof / form-friction categories score well.
 *   3. A deliberately weak page still scores low.
 *   4. Behavioral signals still influence the score once traffic exists.
 */
import { describe, it, expect } from "vitest";
import { analyzeBlocks, computeConversionScore, letterGrade } from "./conversion-scoring";

/** A structurally complete generated DSO/dental page (ChiliPiper booking). */
const COMPLETE_PAGE = [
  { type: "dso-heartland-hero", props: { headline: "Emergency dental care, same day", primaryCtaText: "Book now", primaryCtaMode: "chilipiper", primaryCtaUrl: "https://meetdandy.chilipiper.com/x", stats: [{ value: "350+", label: "locations" }] } },
  { type: "trust-bar", props: { items: [{ value: "10,000+", label: "patients" }, { value: "98%", label: "fit" }] } },
  { type: "benefits-grid", props: { headline: "Why patients choose us", items: [{ title: "Fast", description: "x" }] } },
  { type: "dso-stat-showcase", props: { stats: [{ value: "96%", label: "fit" }] } },
  { type: "dso-success-stories", props: { cases: [{ name: "Acme", stat: "60%" }] } },
  { type: "image", props: {} },
  { type: "dso-faq", props: { items: [{ question: "q", answer: "a" }] } },
  { type: "dso-final-cta", props: { headline: "Ready?", primaryCtaText: "Book a demo", primaryCtaMode: "chilipiper", primaryCtaUrl: "https://meetdandy.chilipiper.com/x" } },
  { type: "footer", props: {} },
];

const NO_META = { metaTitle: null, metaDescription: null };
const NO_TRAFFIC = { impressions: 0, cvr: 0, leadCount: 0, avgScrollDepth: 0 };

function gradeOf(name: string, cats: { name: string; score: number; grade: string; recommendation: string }[]) {
  return cats.find((c) => c.name === name)!;
}

describe("analyzeBlocks — broadened detection", () => {
  it("recognizes the full social-proof vocabulary", () => {
    for (const type of [
      "trust-bar",
      "stat-callout",
      "case-studies",
      "story-hub",
      "dso-stat-bar",
      "dso-stat-row",
      "dso-stat-showcase",
      "dso-success-stories",
      "dso-testimonials",
      "dso-case-study",
      "testimonial",
    ]) {
      expect(analyzeBlocks([{ type, props: {} }]).hasSocialProof, type).toBe(true);
    }
  });

  it("detects bento tiles whose kind is quote or stat as social proof", () => {
    expect(analyzeBlocks([{ type: "bento-showcase", props: { tiles: [{ kind: "image" }, { kind: "quote" }] } }]).hasSocialProof).toBe(true);
    expect(analyzeBlocks([{ type: "dso-bento-outcomes", props: { tiles: [{ type: "stat", value: "10x" }] } }]).hasSocialProof).toBe(true);
    expect(analyzeBlocks([{ type: "bento-showcase", props: { tiles: [{ kind: "image" }, { kind: "feature" }] } }]).hasSocialProof).toBe(false);
  });

  it("does NOT mistake 'bold-statement' for social proof (substring 'stat')", () => {
    expect(analyzeBlocks([{ type: "bold-statement", props: {} }]).hasSocialProof).toBe(false);
  });

  it("treats a ChiliPiper-wired CTA as a booking path", () => {
    expect(analyzeBlocks([{ type: "bottom-cta", props: { ctaMode: "chilipiper", ctaUrl: "https://x.chilipiper.com/y" } }]).hasBooking).toBe(true);
    expect(analyzeBlocks([{ type: "dso-cta-capture", props: {} }]).hasBooking).toBe(true);
    expect(analyzeBlocks([{ type: "roi-calculator", props: { ctaEnabled: true, ctaText: "Book" } }]).hasBooking).toBe(true);
  });

  it("does NOT treat an empty chilipiperUrl key as a booking path", () => {
    expect(analyzeBlocks([{ type: "popup", props: { chilipiperUrl: "", ctaMode: "url" } }]).hasBooking).toBe(false);
  });

  it("treats a dedicated final/conversion CTA block with a label as a conversion path", () => {
    expect(analyzeBlocks([{ type: "bottom-cta", props: { ctaText: "Get started" } }]).hasBooking).toBe(true);
    expect(analyzeBlocks([{ type: "dandy-conversion-panel-1", props: { primaryCtaText: "Get a Free Demo" } }]).hasBooking).toBe(true);
    // A conversion block with no CTA label is NOT a usable path.
    expect(analyzeBlocks([{ type: "bottom-cta", props: {} }]).hasBooking).toBe(false);
  });

  it("recognizes social proof from a non-empty stats/testimonials/cases prop array", () => {
    expect(analyzeBlocks([{ type: "dandy-conversion-panel-1", props: { stats: [{ value: "8,000+", label: "practices" }] } }]).hasSocialProof).toBe(true);
    expect(analyzeBlocks([{ type: "feature-block", props: { testimonials: [{ quote: "great" }] } }]).hasSocialProof).toBe(true);
    expect(analyzeBlocks([{ type: "feature-block", props: { stats: [] } }]).hasSocialProof).toBe(false);
  });

  it("counts imagery from photo/carousel blocks and a non-empty images[] array", () => {
    expect(analyzeBlocks([{ type: "photo-strip", props: { images: [{}, {}, {}] } }]).imageCount).toBe(1);
    expect(analyzeBlocks([{ type: "editorial-carousel", props: {} }]).imageCount).toBe(1);
    // A non-image block with an empty images[] array contributes no imagery.
    expect(analyzeBlocks([{ type: "feature-block", props: { images: [] } }]).imageCount).toBe(0);
  });

  it("counts single-step form fields under props.fields and multi-step under steps[].fields", () => {
    expect(analyzeBlocks([{ type: "form", props: { fields: [{}, {}, {}] } }]).formFieldCount).toBe(3);
    expect(analyzeBlocks([{ type: "form", props: { steps: [{ fields: [{}, {}] }, { fields: [{}] }] } }]).formFieldCount).toBe(3);
  });

  it("keeps trust signals distinct from the social-proof trust-bar", () => {
    const a = analyzeBlocks([{ type: "trust-bar", props: {} }]);
    expect(a.hasSocialProof).toBe(true);
    expect(a.hasTrustSignals).toBe(false);
  });

  it("detects a hero, headline, social proof, booking, imagery, and trust inside a premium all-in-one block", () => {
    const a = analyzeBlocks([
      {
        type: "business-case-premium",
        props: {
          heroHeadline: "Why PDS doctors keep finding Dandy.",
          heroLayout: "split-image-right",
          heroImageUrl: "/api/storage/objects/uploads/abc",
          situationStats: [{ value: "9", label: "active practices" }],
          mathStats: [{ value: "$25K", label: "Monthly spend" }],
          proofFeatured: { name: "PDS practice", quote: "The scans are hit or miss." },
          shiftRows: [{ oldWay: "Tracked weeks late", withDandy: "Real time" }],
          showFinalCta: true,
          finalCtaPrimaryText: "Explore DSO Partnerships",
          finalCtaPrimaryUrl: "https://www.meetdandy.com/dso",
        },
      },
    ]);
    expect(a.hasHero).toBe(true);
    expect(a.headlineCount).toBeGreaterThanOrEqual(1);
    expect(a.hasSocialProof).toBe(true);
    expect(a.hasBooking).toBe(true);
    expect(a.hasImagery).toBe(true);
    expect(a.hasTrustSignals).toBe(true);
  });

  it("treats old-way-vs-new-way comparison blocks as trust signals", () => {
    expect(analyzeBlocks([{ type: "dandy-versus", props: {} }]).hasTrustSignals).toBe(true);
    expect(
      analyzeBlocks([{ type: "dso-paradigm-shift", props: { oldWayItems: ["a"], newWayItems: ["b"] } }]).hasTrustSignals,
    ).toBe(true);
    expect(analyzeBlocks([{ type: "dso-comparison", props: { rows: [{ traditional: "x", dandy: "y" }] } }]).hasTrustSignals).toBe(
      true,
    );
  });

  it("recognizes social proof from bespoke *Stats prop names and stat/quote object shapes", () => {
    expect(analyzeBlocks([{ type: "x", props: { mathStats: [{ value: "8k", label: "practices" }] } }]).hasSocialProof).toBe(true);
    expect(analyzeBlocks([{ type: "x", props: { signalCards: [{ body: "...", stat: "Quality" }] } }]).hasSocialProof).toBe(true);
    expect(analyzeBlocks([{ type: "x", props: { proofSecondary: [{ name: "n", quote: "q" }] } }]).hasSocialProof).toBe(true);
  });

  it("does NOT treat feature/step item lists as social proof or trust", () => {
    const switchback = analyzeBlocks([{ type: "dandy-switchback", props: { items: [{ title: "t", ctaUrl: "u", ctaText: "c" }] } }]);
    expect(switchback.hasSocialProof).toBe(false);
    expect(switchback.hasTrustSignals).toBe(false);
    const benefits = analyzeBlocks([{ type: "benefits-grid", props: { items: [{ title: "t", description: "d" }] } }]);
    expect(benefits.hasSocialProof).toBe(false);
  });

  it("flags imagery from bespoke *ImageUrl / imageUrls props without inflating the speed imageCount", () => {
    const a = analyzeBlocks([{ type: "dso-problem", props: { imageUrls: ["/a", "/b"], panels: [{}, {}] } }]);
    expect(a.hasImagery).toBe(true);
    expect(a.imageCount).toBe(0);
    // Image-flavored config strings (tone/zoom/focus) must NOT count as imagery.
    const b = analyzeBlocks([{ type: "x", props: { heroImageTone: "color", heroImageZoom: "fill", heroImageFocus: "top" } }]);
    expect(b.hasImagery).toBe(false);
  });
});

describe("computeConversionScore — calibration", () => {
  it("scores a structurally complete page B- or higher with no traffic", () => {
    const analysis = analyzeBlocks(COMPLETE_PAGE);
    const { overallScore, categories } = computeConversionScore({ analysis, ...NO_META, ...NO_TRAFFIC });
    expect(overallScore).toBeGreaterThanOrEqual(68); // B- floor
    // Social Proof B+ or higher
    expect(gradeOf("Social Proof", categories).score).toBeGreaterThanOrEqual(80);
    // Form Friction (booking path) scores well
    expect(gradeOf("Form Friction", categories).score).toBeGreaterThanOrEqual(80);
    // Behavioral categories not dragged below B with no data
    expect(gradeOf("CTA Effectiveness", categories).score).toBeGreaterThanOrEqual(80);
    expect(gradeOf("Mobile Responsiveness", categories).score).toBeGreaterThanOrEqual(80);
  });

  it("reaches B+ once meta title/description are present", () => {
    const analysis = analyzeBlocks(COMPLETE_PAGE);
    const { overallScore } = computeConversionScore({
      analysis,
      metaTitle: "Emergency Dental Care USA",
      metaDescription: "Same-day emergency dental care near you.",
      ...NO_TRAFFIC,
    });
    expect(overallScore).toBeGreaterThanOrEqual(80);
  });

  it("keeps a deliberately weak page low", () => {
    const weak = [
      { type: "hero", props: { headline: "Hello" } },
      { type: "form", props: { fields: new Array(10).fill({}) } },
    ];
    const analysis = analyzeBlocks(weak);
    const { overallScore, categories } = computeConversionScore({ analysis, ...NO_META, ...NO_TRAFFIC });
    expect(overallScore).toBeLessThan(60); // C or lower
    expect(gradeOf("Social Proof", categories).score).toBeLessThan(40);
    expect(gradeOf("Form Friction", categories).score).toBeLessThanOrEqual(40);
  });

  it("lets real CVR influence CTA once traffic exists", () => {
    const analysis = analyzeBlocks(COMPLETE_PAGE);
    const strong = computeConversionScore({ analysis, ...NO_META, impressions: 1000, cvr: 5, leadCount: 20, avgScrollDepth: 80 });
    const weak = computeConversionScore({ analysis, ...NO_META, impressions: 1000, cvr: 0, leadCount: 0, avgScrollDepth: 80 });
    const strongCta = strong.categories.find((c) => c.name === "CTA Effectiveness")!.score;
    const weakCta = weak.categories.find((c) => c.name === "CTA Effectiveness")!.score;
    expect(strongCta).toBeGreaterThan(weakCta);
  });

  it("does not recommend adding testimonials when social proof is present", () => {
    const analysis = analyzeBlocks(COMPLETE_PAGE);
    const { categories } = computeConversionScore({ analysis, ...NO_META, ...NO_TRAFFIC });
    const social = gradeOf("Social Proof", categories);
    expect(social.recommendation.toLowerCase()).not.toContain("add testimonials");
  });
});

describe("letterGrade", () => {
  it("maps thresholds", () => {
    expect(letterGrade(95)).toBe("A");
    expect(letterGrade(82)).toBe("B+");
    expect(letterGrade(70)).toBe("B-");
    expect(letterGrade(20)).toBe("F");
  });
});
