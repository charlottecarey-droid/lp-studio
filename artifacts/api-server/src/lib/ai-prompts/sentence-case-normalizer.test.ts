import { describe, it, expect } from "vitest";
import {
  normalizeHeadingsToSentenceCase,
  sentenceCaseHeading,
} from "./sentence-case-normalizer";

describe("sentenceCaseHeading", () => {
  it("converts a fully Title-Cased heading to sentence case", () => {
    expect(sentenceCaseHeading("Streamline Your Dental Practice Workflow")).toBe(
      "Streamline your dental practice workflow",
    );
  });

  it("capitalizes the first word of each sentence in a multi-fragment heading", () => {
    expect(sentenceCaseHeading("More Cases. Zero Lab Drama.")).toBe(
      "More cases. Zero lab drama.",
    );
  });

  it("handles a two-word Title-Cased heading", () => {
    expect(sentenceCaseHeading("Dental Excellence")).toBe("Dental excellence");
  });

  it("leaves copy that is already sentence case untouched", () => {
    const s = "We help dental practices grow faster.";
    expect(sentenceCaseHeading(s)).toBe(s);
  });

  it("preserves all-caps acronyms", () => {
    expect(sentenceCaseHeading("Built For Every DSO")).toBe("Built for every DSO");
  });

  it("canonicalizes a lowercased curated acronym", () => {
    expect(sentenceCaseHeading("Boost Your Roi Today")).toBe("Boost your ROI today");
  });

  it("preserves mixed-case product/tech tokens", () => {
    expect(sentenceCaseHeading("Powered By iOS")).toBe("Powered by iOS");
  });

  it("lowercases hyphenated compounds while keeping acronym segments", () => {
    expect(sentenceCaseHeading("Real-Time Lab Updates")).toBe("Real-time lab updates");
    expect(sentenceCaseHeading("AI-Powered Insights")).toBe("AI-powered insights");
  });

  it("protects a single-word brand proper noun", () => {
    expect(sentenceCaseHeading("Why Teams Choose Dandy", ["Dandy"])).toBe(
      "Why teams choose Dandy",
    );
  });

  it("protects a multi-word proper-noun phrase", () => {
    expect(
      sentenceCaseHeading("Faster Turnaround With Dandy Lab", ["Dandy Lab"]),
    ).toBe("Faster turnaround with Dandy Lab");
  });

  it("does not touch a single-word heading", () => {
    expect(sentenceCaseHeading("Dandy", ["Dandy"])).toBe("Dandy");
  });
});

describe("sentenceCaseHeading — SHOUTED (all-caps) copy", () => {
  it("sentence-cases a mixed shouted+Title-Cased heading (the July 2026 field report)", () => {
    expect(sentenceCaseHeading("50 YEARS OF INNOVATION in Dental Technology")).toBe(
      "50 years of innovation in dental technology",
    );
  });

  it("sentence-cases a fully ALL-CAPS heading", () => {
    expect(sentenceCaseHeading("TRUSTED BY LEADING DENTAL PRACTICES")).toBe(
      "Trusted by leading dental practices",
    );
  });

  it("keeps curated acronyms out of shouted runs", () => {
    expect(sentenceCaseHeading("MAXIMIZE YOUR ROI THIS YEAR")).toBe(
      "Maximize your ROI this year",
    );
    // Adjacent curated acronyms never shout each other.
    expect(sentenceCaseHeading("Boost AI ROI Today")).toBe("Boost AI ROI today");
  });

  it("preserves an ISOLATED unknown all-caps word as an acronym", () => {
    const s = "Precision CEREC Workflows";
    expect(sentenceCaseHeading(s)).toBe("Precision CEREC workflows");
  });

  it("numbers are transparent inside a shouted run", () => {
    expect(sentenceCaseHeading("SAVE 50 HOURS EVERY MONTH")).toBe(
      "Save 50 hours every month",
    );
  });

  it("shouted hyphenated compounds sentence-case per segment, keeping curated acronyms", () => {
    expect(sentenceCaseHeading("AI-POWERED DENTISTRY Made Simple")).toBe(
      "AI-powered dentistry made simple",
    );
  });

  it("a protected proper noun in caps survives a shouted heading", () => {
    expect(sentenceCaseHeading("WHY TEAMS CHOOSE DANDY LAB", ["Dandy Lab"])).toBe(
      "Why teams choose Dandy Lab",
    );
  });
});

describe("normalizeHeadingsToSentenceCase — key coverage (July 2026 gaps)", () => {
  it("covers subhead / heroSubhead / heroDeck / headline-line + emphasis fragments", () => {
    const blocks = [{
      type: "x",
      props: {
        subhead: "Faster Turnaround For Your Practice",
        heroSubhead: "Built For Modern Labs",
        heroDeck: "The Future Of Denture Workflows",
        heroHeadlineLine1: "Precision You Can",
        heroHeadlineLine2: "Actually Trust",
        calendarHeadlineEmphasis: "Every Single Week",
      },
    }];
    normalizeHeadingsToSentenceCase(blocks);
    const p = blocks[0].props;
    expect(p.subhead).toBe("Faster turnaround for your practice");
    expect(p.heroSubhead).toBe("Built for modern labs");
    expect(p.heroDeck).toBe("The future of denture workflows");
    expect(p.heroHeadlineLine1).toBe("Precision you can");
    expect(p.heroHeadlineLine2).toBe("Actually trust");
    expect(p.calendarHeadlineEmphasis).toBe("Every single week");
  });

  it("never touches styling/config keys that merely contain a heading word", () => {
    const blocks = [{
      type: "x",
      props: {
        headlineFont: "Playfair Display",
        headlineColor: "Dark Slate Blue",
        headingScale: "Extra Large",
        headlineWeight: "Semi Bold",
        headlineAlign: "Center Right",
        headerLayout: "Split Stacked",
      },
    }];
    const before = JSON.stringify(blocks);
    normalizeHeadingsToSentenceCase(blocks);
    expect(JSON.stringify(blocks)).toBe(before);
  });
});

describe("normalizeHeadingsToSentenceCase", () => {
  it("only rewrites heading-like fields, never body/url/color/name", () => {
    const blocks = [
      {
        id: "b1",
        type: "hero",
        props: {
          headline: "Grow Your Dental Practice",
          subheadline: "Trusted By 500 Practices Nationwide",
          body: "This Is A Sentence That Should Not Be Touched Because It Is Body Copy.",
          ctaLabel: "Book A Demo",
          ctaHref: "https://Example.com/Book-A-Demo",
          backgroundColor: "#FFFFFF",
        },
      },
    ];
    const { changed } = normalizeHeadingsToSentenceCase(blocks, {
      properNouns: ["Acme"],
    });
    const props = (blocks[0] as { props: Record<string, string> }).props;
    expect(props.headline).toBe("Grow your dental practice");
    expect(props.subheadline).toBe("Trusted by 500 practices nationwide");
    expect(props.ctaLabel).toBe("Book a demo");
    // Untouched fields
    expect(props.body).toBe(
      "This Is A Sentence That Should Not Be Touched Because It Is Body Copy.",
    );
    expect(props.ctaHref).toBe("https://Example.com/Book-A-Demo");
    expect(props.backgroundColor).toBe("#FFFFFF");
    expect(changed).toBe(3);
  });

  it("recurses into nested arrays of items", () => {
    const blocks = [
      {
        id: "b2",
        type: "steps",
        props: {
          steps: [
            { stepTitle: "Sign Your Agreement", description: "Some Body Text Here." },
            { stepTitle: "Go Live Fast", description: "More Body Text." },
          ],
        },
      },
    ];
    normalizeHeadingsToSentenceCase(blocks);
    const steps = (blocks[0] as { props: { steps: Record<string, string>[] } }).props.steps;
    expect(steps[0].stepTitle).toBe("Sign your agreement");
    expect(steps[1].stepTitle).toBe("Go live fast");
    // descriptions are body copy → untouched
    expect(steps[0].description).toBe("Some Body Text Here.");
  });

  it("does not de-title-case a person's name or job title in an author card", () => {
    const blocks = [
      {
        id: "b3",
        type: "testimonial",
        props: {
          quote: "Best decision we made.",
          name: "Dr. Jane Smith",
          title: "Chief Dental Officer",
        },
      },
    ];
    const { changed } = normalizeHeadingsToSentenceCase(blocks);
    const props = (blocks[0] as { props: Record<string, string> }).props;
    expect(props.name).toBe("Dr. Jane Smith");
    expect(props.title).toBe("Chief Dental Officer");
    expect(changed).toBe(0);
  });

  it("is fail-safe on malformed input", () => {
    expect(normalizeHeadingsToSentenceCase(null as unknown as unknown[]).changed).toBe(0);
    expect(normalizeHeadingsToSentenceCase([null, 1, "x"]).changed).toBe(0);
  });
});
