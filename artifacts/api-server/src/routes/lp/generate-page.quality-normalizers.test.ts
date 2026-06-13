/**
 * Tests for the June-2026 generated-page quality normalizers:
 *
 *  1. stripPlaceholderTestimonials / isPlaceholderTestimonial — strict-facts
 *     placeholder cards ("Add a quote in brand settings" attributions, quotes
 *     with no real author) must never ship; real quotes pass untouched.
 *  2. collapseAdjacentCtaBlocks — no two CTA-role blocks adjacent (keep
 *     aurora-cta-finale, else the LAST), nothing CTA-shaped after an
 *     aurora-cta-finale, form-bearing blocks never dropped, CTAs separated by
 *     content are kept.
 */
import { describe, it, expect } from "vitest";
import {
  collapseAdjacentCtaBlocks,
  isPlaceholderTestimonial,
  stripPlaceholderTestimonials,
} from "./generate-page";

// ── Placeholder testimonial detector ─────────────────────────────────────────

const REAL_QUOTE = {
  id: "t1",
  quote: "Dandy cut our crown remake rate from 9% to under 2% in one quarter.",
  author: "Maya Chen",
  role: "Practice Owner",
  company: "Lakeside Dental",
  rating: 5,
  avatarInitials: "MC",
};

describe("isPlaceholderTestimonial", () => {
  it("passes real quotes", () => {
    expect(isPlaceholderTestimonial(REAL_QUOTE)).toBe(false);
    expect(
      isPlaceholderTestimonial({ quote: "Great results, fast turnaround on every case.", name: "Dr. A. Singh", role: "DDS, Smile Co." }),
    ).toBe(false);
  });

  it("flags the strict-facts placeholder attribution variants (case-insensitive)", () => {
    expect(isPlaceholderTestimonial({ quote: "Real-ish quote about outcomes.", author: "Add a quote in brand settings", role: "Add a role in brand settings" })).toBe(true);
    expect(isPlaceholderTestimonial({ quote: "ADD A QUOTE IN BRAND SETTINGS", author: "Jane Doe" })).toBe(true);
    expect(isPlaceholderTestimonial({ quote: "Something nice.", author: "add your name", role: "Manager" })).toBe(true);
    expect(isPlaceholderTestimonial({ quote: "Something nice.", author: "Jan", role: "Add a title in Brand Settings" })).toBe(true);
  });

  it("flags generic placeholder / lorem text", () => {
    expect(isPlaceholderTestimonial({ quote: "Lorem ipsum dolor sit amet.", author: "Maya Chen" })).toBe(true);
    expect(isPlaceholderTestimonial({ quote: "Placeholder testimonial copy.", author: "Maya Chen" })).toBe(true);
  });

  it("flags a quote with empty or stub attribution", () => {
    expect(isPlaceholderTestimonial({ quote: "We loved the product.", author: "" })).toBe(true);
    expect(isPlaceholderTestimonial({ quote: "We loved the product." })).toBe(true);
    expect(isPlaceholderTestimonial({ quote: "We loved the product.", author: "X" })).toBe(true);
    expect(isPlaceholderTestimonial({ quote: "We loved the product.", name: "—" })).toBe(true);
  });

  it("does not flag attribution-only items or non-objects", () => {
    // No quote at all → nothing to scrub (other passes own empty blocks).
    expect(isPlaceholderTestimonial({ author: "Maya Chen", role: "Owner" })).toBe(false);
    expect(isPlaceholderTestimonial(null)).toBe(false);
    expect(isPlaceholderTestimonial("Add a quote in brand settings")).toBe(false);
  });
});

describe("stripPlaceholderTestimonials", () => {
  it("drops only the placeholder card from a testimonial-grid (the owner-reported 4th card)", () => {
    const blocks = [
      { id: "h", type: "hero", props: { headline: "Hi" } },
      {
        id: "tg",
        type: "testimonial-grid",
        props: {
          headline: "Loved by practices",
          testimonials: [
            REAL_QUOTE,
            { ...REAL_QUOTE, id: "t2", author: "Liam Park" },
            { ...REAL_QUOTE, id: "t3", author: "Ana Souza" },
            {
              id: "t4",
              quote: "The digital workflow changed everything for our practice.",
              author: "Add a quote in brand settings",
              role: "Add a role in brand settings",
              rating: 5,
              avatarInitials: "AS",
            },
          ],
        },
      },
    ];
    const { blocks: out, events } = stripPlaceholderTestimonials(blocks);
    expect(out).toHaveLength(2);
    const grid = out[1] as { props: { testimonials: unknown[] } };
    expect(grid.props.testimonials).toHaveLength(3);
    expect(events).toEqual([
      { blockId: "tg", blockType: "testimonial-grid", removedItems: 1, blockRemoved: false },
    ]);
  });

  it("removes a testimonial block whose every item is placeholder", () => {
    const blocks = [
      {
        id: "qw",
        type: "quote-carousel",
        props: {
          testimonials: [
            { quote: "Add a quote in brand settings", author: "X" },
            { quote: "Great!", author: "" },
          ],
        },
      },
      { id: "f", type: "footer", props: {} },
    ];
    const { blocks: out, events } = stripPlaceholderTestimonials(blocks);
    expect(out.map((b) => (b as { id: string }).id)).toEqual(["f"]);
    expect(events[0]).toMatchObject({ blockType: "quote-carousel", removedItems: 2, blockRemoved: true });
  });

  it("drops a single-quote `testimonial` block with placeholder content", () => {
    const blocks = [
      { id: "t", type: "testimonial", props: { quote: "Add a quote in brand settings", author: "Add a quote in brand settings", role: "", practiceName: "" } },
    ];
    const { blocks: out, events } = stripPlaceholderTestimonials(blocks);
    expect(out).toHaveLength(0);
    expect(events[0]).toMatchObject({ blockType: "testimonial", blockRemoved: true });
  });

  it("leaves clean pages and non-testimonial blocks untouched", () => {
    const blocks = [
      { id: "h", type: "hero", props: { headline: "Add a quote in brand settings is NOT scanned here" } },
      { id: "tw", type: "testimonial-wall", props: { testimonials: [{ quote: "Concrete 32% outcome quote.", name: "Maya Chen", role: "Owner, Lakeside" }] } },
    ];
    const { blocks: out, events } = stripPlaceholderTestimonials(blocks);
    expect(out).toHaveLength(2);
    expect(events).toHaveLength(0);
  });
});

// ── CTA adjacency normalizer ─────────────────────────────────────────────────

const B = (id: string, type: string, props: Record<string, unknown> = {}) => ({ id, type, props });

describe("collapseAdjacentCtaBlocks", () => {
  it("collapses the owner-reported aurora-cta-finale + bottom-cta pair (finale wins)", () => {
    const { blocks, dropped } = collapseAdjacentCtaBlocks([
      B("h", "hero"),
      B("fin", "aurora-cta-finale"),
      B("cta", "bottom-cta"),
      B("f", "footer"),
    ]);
    expect(blocks.map((b) => b.type)).toEqual(["hero", "aurora-cta-finale", "footer"]);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]).toMatchObject({ droppedType: "bottom-cta", reason: "after-finale" });
  });

  it("keeps the finale even when it comes second", () => {
    const { blocks, dropped } = collapseAdjacentCtaBlocks([
      B("cta", "cta-gradient-banner"),
      B("fin", "aurora-cta-finale"),
    ]);
    expect(blocks.map((b) => b.type)).toEqual(["aurora-cta-finale"]);
    expect(dropped[0]).toMatchObject({ droppedType: "cta-gradient-banner", keptType: "aurora-cta-finale", reason: "adjacent" });
  });

  it("keeps the LAST of two adjacent non-finale CTAs (closers belong at the end)", () => {
    const { blocks, dropped } = collapseAdjacentCtaBlocks([
      B("a", "cta-stat-backed"),
      B("b", "bottom-cta"),
      B("f", "footer"),
    ]);
    expect(blocks.map((b) => b.type)).toEqual(["bottom-cta", "footer"]);
    expect(dropped[0]).toMatchObject({ droppedType: "cta-stat-backed", keptType: "bottom-cta" });
  });

  it("collapses a 3-in-a-row CTA stack down to one", () => {
    const { blocks } = collapseAdjacentCtaBlocks([
      B("a", "cta-centered-minimal"),
      B("b", "cta-gradient-banner"),
      B("c", "bottom-cta"),
    ]);
    expect(blocks.map((b) => b.type)).toEqual(["bottom-cta"]);
  });

  it("drops every CTA-role block AFTER an aurora-cta-finale, adjacent or not", () => {
    const { blocks, dropped } = collapseAdjacentCtaBlocks([
      B("fin", "aurora-cta-finale"),
      B("faq", "faq"),
      B("cta", "dso-final-cta"),
      B("f", "footer"),
    ]);
    expect(blocks.map((b) => b.type)).toEqual(["aurora-cta-finale", "faq", "footer"]);
    expect(dropped[0]).toMatchObject({ droppedType: "dso-final-cta", reason: "after-finale" });
  });

  it("keeps buffer-separated CTAs (explicit user requests stay honored)", () => {
    const input = [
      B("h", "hero"),
      B("c1", "cta-split-image"),
      B("feat", "benefits-grid"),
      B("c2", "bottom-cta"),
      B("f", "footer"),
    ];
    const { blocks, dropped } = collapseAdjacentCtaBlocks(input);
    expect(blocks.map((b) => b.type)).toEqual(["hero", "cta-split-image", "benefits-grid", "bottom-cta", "footer"]);
    expect(dropped).toHaveLength(0);
  });

  it("never drops a form-bearing CTA block", () => {
    // split-form-final-cta carries a form: the form side must survive even
    // though it is not last; the plain CTA is the one collapsed.
    const a = collapseAdjacentCtaBlocks([B("form", "split-form-final-cta"), B("plain", "bottom-cta")]);
    expect(a.blocks.map((b) => b.type)).toEqual(["split-form-final-cta"]);

    const b = collapseAdjacentCtaBlocks([B("plain", "bottom-cta"), B("form", "dandy-conversion-panel-1")]);
    expect(b.blocks.map((b2) => b2.type)).toEqual(["dandy-conversion-panel-1"]);

    // Both carry forms → keep both, even adjacent.
    const c = collapseAdjacentCtaBlocks([B("f1", "split-form-final-cta"), B("f2", "dso-cta-capture")]);
    expect(c.blocks).toHaveLength(2);
    expect(c.dropped).toHaveLength(0);

    // A form-bearing CTA after the finale also survives.
    const d = collapseAdjacentCtaBlocks([B("fin", "aurora-cta-finale"), B("form", "dso-cta-capture")]);
    expect(d.blocks).toHaveLength(2);
    expect(d.dropped).toHaveLength(0);
  });

  it("is a no-op on pages with a single CTA", () => {
    const input = [B("h", "hero"), B("cta", "bottom-cta"), B("f", "footer")];
    const { blocks, dropped } = collapseAdjacentCtaBlocks(input);
    expect(blocks.map((b) => b.type)).toEqual(["hero", "bottom-cta", "footer"]);
    expect(dropped).toHaveLength(0);
  });
});
