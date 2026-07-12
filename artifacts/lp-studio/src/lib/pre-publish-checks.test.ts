import { describe, it, expect } from "vitest";
import { runPrePublishChecks, type PrePublishInput, type CheckableBlock } from "./pre-publish-checks";

const SETTINGS = {
  metaTitle: "Title",
  metaDescription: "Desc",
  ogImage: "https://cdn.example.com/og.png",
  allowIndexing: null,
  pageCta: null,
} satisfies Omit<PrePublishInput, "blocks">;

function run(blocks: CheckableBlock[], overrides: Partial<PrePublishInput> = {}) {
  return runPrePublishChecks({ blocks, ...SETTINGS, ...overrides });
}

const LEADFUL_FORM: CheckableBlock = {
  id: "f1",
  type: "form",
  props: { formId: 12, steps: [] },
};

describe("dead CTA detection", () => {
  it("flags a labeled button with no destination", () => {
    const findings = run([
      { id: "b1", type: "dso-split-feature", props: { ctaText: "Get started", ctaUrl: "" } },
      LEADFUL_FORM,
    ]);
    const dead = findings.find(f => f.id === "dead-cta:b1");
    expect(dead?.severity).toBe("warning");
    expect(dead?.title).toContain("Get started");
    expect(dead?.blockId).toBe("b1");
  });

  it("flags a bare '#' anchor and a chilipiper mode without a URL", () => {
    const findings = run([
      { id: "b1", type: "hero", props: { ctaText: "Go", ctaUrl: "#" } },
      { id: "b2", type: "hero", props: { ctaText: "Book", ctaMode: "chilipiper", chilipiperUrl: "" } },
      LEADFUL_FORM,
    ]);
    expect(findings.some(f => f.id === "dead-cta:b1")).toBe(true);
    expect(findings.some(f => f.id === "dead-cta:b2")).toBe(true);
  });

  it("does not flag working CTAs: real URLs, anchors, mailto, chilipiper, modal-form, email-capture", () => {
    const findings = run([
      { id: "b1", type: "hero", props: { ctaText: "Go", ctaUrl: "https://x.com" } },
      { id: "b2", type: "hero", props: { ctaText: "Jump", ctaUrl: "#pricing" } },
      { id: "b3", type: "hero", props: { ctaText: "Mail", ctaUrl: "mailto:a@b.co" } },
      { id: "b4", type: "hero", props: { ctaText: "Book", ctaMode: "chilipiper", chilipiperUrl: "https://x.chilipiper.com/r" } },
      { id: "b5", type: "hero", props: { ctaText: "Form", ctaAction: "modal-form", modalFormId: 3 } },
      { id: "b6", type: "hero", props: { ctaText: "Sub", ctaStyle: "email-capture", ctaUrl: "" } },
      { id: "b7", type: "hero", props: { headline: "No CTA here" } },
    ]);
    expect(findings.filter(f => f.id.startsWith("dead-cta:"))).toEqual([]);
  });

  it("skips blocks that follow an active Page CTA, but not opted-out blocks", () => {
    const pageCta = { label: "Book a demo", action: "url", url: "https://x.com" } as PrePublishInput["pageCta"];
    const follower: CheckableBlock = { id: "b1", type: "hero", props: { ctaText: "Go", ctaUrl: "" } };
    const optedOut: CheckableBlock = {
      id: "b2", type: "hero", props: { ctaText: "Custom", ctaUrl: "" }, blockSettings: { useCustomCta: true },
    };
    const findings = run([follower, optedOut, LEADFUL_FORM], { pageCta });
    expect(findings.some(f => f.id === "dead-cta:b1")).toBe(false);
    expect(findings.some(f => f.id === "dead-cta:b2")).toBe(true);
  });

  it("walks container children", () => {
    const findings = run([
      {
        id: "col", type: "columns", props: {},
        children: [{ id: "b9", type: "grid-cta-tile", props: { ctaText: "Tap", ctaUrl: "" } }],
      },
      LEADFUL_FORM,
    ]);
    expect(findings.some(f => f.id === "dead-cta:b9")).toBe(true);
  });
});

describe("form + lead-capture checks", () => {
  it("flags a form block with no linked form and no fields", () => {
    const findings = run([{ id: "f1", type: "form", props: { steps: [{ fields: [] }] } }]);
    expect(findings.some(f => f.id === "empty-form:f1")).toBe(true);
  });

  it("accepts a linked global form or inline fields", () => {
    const findings = run([
      { id: "f1", type: "form", props: { formId: 4 } },
      { id: "f2", type: "form", props: { steps: [{ fields: [{ label: "Email" }] }] } },
    ]);
    expect(findings.filter(f => f.id.startsWith("empty-form:"))).toEqual([]);
  });

  it("notes when the page has no lead-capture path at all", () => {
    const findings = run([{ id: "b1", type: "hero", props: { ctaText: "Read", ctaUrl: "https://x.com" } }]);
    expect(findings.some(f => f.id === "no-lead-capture" && f.severity === "note")).toBe(true);
  });

  it("chat-capture, scheduler CTAs, and a modal-form Page CTA all count as lead capture", () => {
    expect(run([{ id: "c1", type: "chat-capture", props: {} }]).some(f => f.id === "no-lead-capture")).toBe(false);
    expect(
      run([{ id: "b1", type: "hero", props: { ctaText: "Book", ctaMode: "chilipiper", chilipiperUrl: "https://x.cp.com" } }])
        .some(f => f.id === "no-lead-capture"),
    ).toBe(false);
    expect(
      run([{ id: "b1", type: "hero", props: {} }], {
        pageCta: { label: "Talk", action: "modal-form", modalFormId: 2 } as PrePublishInput["pageCta"],
      }).some(f => f.id === "no-lead-capture"),
    ).toBe(false);
  });
});

describe("placeholder + page hygiene", () => {
  it("flags lorem ipsum, uppercase TODO, and placeholder-image hosts (once per block)", () => {
    const findings = run([
      { id: "b1", type: "hero", props: { headline: "Lorem ipsum dolor", body: "also lorem ipsum here" } },
      { id: "b2", type: "hero", props: { note: "TODO replace this" } },
      { id: "b3", type: "hero", props: { imageUrl: "https://placehold.co/600x400" } },
      { id: "b4", type: "hero", props: { body: "our todo list feature" } },
      LEADFUL_FORM,
    ]);
    expect(findings.filter(f => f.id.startsWith("placeholder:")).map(f => f.blockId)).toEqual(["b1", "b2", "b3"]);
  });

  it("warns on noindex and notes missing meta/og fields", () => {
    const findings = run([LEADFUL_FORM], {
      allowIndexing: false,
      metaTitle: "",
      metaDescription: "  ",
      ogImage: "",
    });
    expect(findings.find(f => f.id === "noindex")?.severity).toBe("warning");
    expect(findings.some(f => f.id === "no-meta-title")).toBe(true);
    expect(findings.some(f => f.id === "no-meta-description")).toBe(true);
    expect(findings.some(f => f.id === "no-og-image")).toBe(true);
  });

  it("returns no findings for a healthy page — warnings always sort before notes", () => {
    const healthy = run([
      { id: "b1", type: "hero", props: { ctaText: "Go", ctaUrl: "https://x.com" } },
      LEADFUL_FORM,
    ]);
    expect(healthy).toEqual([]);

    const mixed = run([{ id: "b1", type: "hero", props: { ctaText: "Go", ctaUrl: "" } }], { metaTitle: "" });
    const severities = mixed.map(f => f.severity);
    expect(severities.indexOf("note")).toBeGreaterThan(severities.lastIndexOf("warning"));
  });
});

describe("generation annotations (builder UX #6)", () => {
  const IMG = "https://cdn.example.com/hero.jpg";
  const HERO_WITH_IMG: CheckableBlock = {
    id: "h1",
    type: "hero",
    props: { ctaText: "Go", ctaUrl: "https://x.com", imageUrl: IMG },
  };

  it("surfaces an image-fit flag as a note pointing at the matching block", () => {
    const findings = run([HERO_WITH_IMG, LEADFUL_FORM], {
      generationAnnotations: {
        imageFitFlags: [{ blockType: "hero", field: "imageUrl", imageUrl: IMG, reason: "topic mismatch" }],
      },
    });
    const fit = findings.find(f => f.id === "image-fit:h1:imageUrl");
    expect(fit?.severity).toBe("note");
    expect(fit?.blockId).toBe("h1");
    expect(fit?.detail).toContain("topic mismatch");
  });

  it("self-prunes an image-fit flag once the image was replaced or the block removed", () => {
    const flag = { blockType: "hero", field: "imageUrl", imageUrl: IMG, reason: "r" };
    // Image replaced with a different URL.
    const replaced = run(
      [{ ...HERO_WITH_IMG, props: { ...HERO_WITH_IMG.props, imageUrl: "https://cdn.example.com/other.jpg" } }, LEADFUL_FORM],
      { generationAnnotations: { imageFitFlags: [flag] } },
    );
    expect(replaced.some(f => f.id.startsWith("image-fit:"))).toBe(false);
    // Block removed entirely.
    const removed = run([LEADFUL_FORM], { generationAnnotations: { imageFitFlags: [flag] } });
    expect(removed.some(f => f.id.startsWith("image-fit:"))).toBe(false);
  });

  it("surfaces only UNRESOLVED critique annotations whose block still exists", () => {
    const findings = run([HERO_WITH_IMG, LEADFUL_FORM], {
      generationAnnotations: {
        critiqueAnnotations: [
          { blockId: "h1", blockType: "hero", removedPhrases: ["game-changing"], resolved: false },
          { blockId: "h1", blockType: "hero", removedPhrases: [], resolved: true },
          { blockId: "gone", blockType: "hero", removedPhrases: ["synergy"], resolved: false },
        ],
      },
    });
    const crit = findings.filter(f => f.id.startsWith("critique:"));
    expect(crit).toHaveLength(1);
    expect(crit[0].blockId).toBe("h1");
    expect(crit[0].severity).toBe("note");
    expect(crit[0].detail).toContain("game-changing");
  });

  it("dedupes annotation findings and is a no-op for null/absent annotations", () => {
    const dup = { blockType: "hero", field: "imageUrl", imageUrl: IMG, reason: "r" };
    const findings = run([HERO_WITH_IMG, LEADFUL_FORM], {
      generationAnnotations: { imageFitFlags: [dup, dup] },
    });
    expect(findings.filter(f => f.id.startsWith("image-fit:"))).toHaveLength(1);

    expect(run([HERO_WITH_IMG, LEADFUL_FORM], { generationAnnotations: null })).toEqual([]);
    expect(run([HERO_WITH_IMG, LEADFUL_FORM])).toEqual([]);
  });
});
