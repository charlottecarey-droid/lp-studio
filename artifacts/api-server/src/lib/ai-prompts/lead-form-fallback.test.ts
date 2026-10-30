import { describe, it, expect } from "vitest";
import { ensureLeadCaptureForm, hasCtaDestination, LEAD_FORM_ANCHOR, LEAD_FORM_BLOCK_ID } from "./lead-form-fallback";
import { resolveDeadGeneratedLinks } from "./dead-links";

const page = () => [
  { id: "h", type: "full-bleed-hero", props: { headline: "Massive sale", ctaText: "Book now", ctaUrl: "#", navLinks: [{ label: "Contact", href: "#" }] } },
  { id: "s", type: "stat-row", props: {} },
  { id: "c", type: "aurora-cta-finale", props: { headline: "Ready?", ctaText: "Get a quote", ctaUrl: "#" } },
  { id: "f", type: "footer", props: { copyrightText: "© 2026 Acme" } },
];

describe("hasCtaDestination", () => {
  it("treats blank and '#' as no destination; a URL or Chili Piper link counts", () => {
    expect(hasCtaDestination({})).toBe(false);
    expect(hasCtaDestination({ defaultCtaUrl: "#" })).toBe(false);
    expect(hasCtaDestination({ defaultCtaUrl: "  " })).toBe(false);
    expect(hasCtaDestination({ defaultCtaUrl: "https://acme.test/book" })).toBe(true);
    expect(hasCtaDestination({ chilipiperUrl: "https://calendar.chilipiper.com/acme" })).toBe(true);
  });
});

describe("ensureLeadCaptureForm", () => {
  it("injects a native form before the footer when the tenant has no CTA destination", () => {
    const blocks = page();
    const r = ensureLeadCaptureForm(blocks, { brand: { brandName: "Acme Heating", defaultCtaUrl: "#" } });
    expect(r.injected).toBe(true);
    expect(blocks.map((b) => b.type)).toEqual(["full-bleed-hero", "stat-row", "aurora-cta-finale", "form", "footer"]);
    const form = blocks[3] as unknown as { id: string; props: { headline: string; steps: Array<{ fields: unknown[] }> }; blockSettings: { anchorId: string } };
    expect(form.id).toBe(LEAD_FORM_BLOCK_ID);
    expect(form.props.headline).toBe("Talk to Acme Heating");
    expect(form.props.steps[0].fields.length).toBeGreaterThanOrEqual(3);
    expect(form.blockSettings.anchorId).toBe(LEAD_FORM_ANCHOR);
  });

  it("the dead-link pass then anchors every cleared CTA to the form instead of hiding it", () => {
    const blocks = page();
    ensureLeadCaptureForm(blocks, { brand: { brandName: "Acme", defaultCtaUrl: "#" } });
    const fixes = resolveDeadGeneratedLinks(blocks as Parameters<typeof resolveDeadGeneratedLinks>[0], { defaultCtaUrl: "#" });
    const hero = blocks[0].props as { ctaText: string; ctaUrl: string; navLinks: Array<{ href: string }> };
    const finale = blocks[2].props as { ctaText: string; ctaUrl: string };
    expect(hero.ctaUrl).toBe(`#${LEAD_FORM_ANCHOR}`);
    expect(hero.ctaText).toBe("Book now");
    expect(finale.ctaUrl).toBe(`#${LEAD_FORM_ANCHOR}`);
    expect(hero.navLinks[0].href).toBe(`#${LEAD_FORM_ANCHOR}`);
    expect(fixes.dropped).toBe(0);
  });

  it("does nothing when a destination, an existing form, or a single full-page block is present", () => {
    const withUrl = page();
    expect(ensureLeadCaptureForm(withUrl, { brand: { defaultCtaUrl: "https://acme.test/book" } }).reason).toBe("destination");
    expect(withUrl.some((b) => b.type === "form")).toBe(false);

    const withForm = [...page().slice(0, 3), { id: "x", type: "split-form-final-cta", props: {} }, page()[3]];
    expect(ensureLeadCaptureForm(withForm, { brand: {} }).reason).toBe("has-form");
    expect(withForm.filter((b) => b.type === "form")).toHaveLength(0);

    const fullPage = [{ id: "e", type: "event-page", props: {} }];
    expect(ensureLeadCaptureForm(fullPage, { brand: {}, isSingleFullPage: true }).reason).toBe("full-page");
    expect(fullPage).toHaveLength(1);
  });

  it("appends when the page has no footer and uses a neutral headline without a brand name", () => {
    const blocks = [{ id: "h", type: "hero", props: { ctaUrl: "#" } }];
    ensureLeadCaptureForm(blocks, { brand: {} });
    expect(blocks.map((b) => b.type)).toEqual(["hero", "form"]);
    expect((blocks[1].props as unknown as { headline: string }).headline).toBe("Get in touch");
  });
});
