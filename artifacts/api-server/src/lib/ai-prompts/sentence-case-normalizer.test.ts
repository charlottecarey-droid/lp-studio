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
