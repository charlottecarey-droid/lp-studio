import { describe, it, expect } from "vitest";
import { resolveDeadGeneratedLinks, type DeadLinkBlock } from "./dead-links";

const form = (id = "f1"): DeadLinkBlock => ({
  id,
  type: "form",
  props: { headline: "Talk to us", steps: [] },
});

describe("nav-link anchoring", () => {
  it("rewrites topic-matching nav links to section anchors and assigns anchorIds", () => {
    const nav: DeadLinkBlock = {
      id: "n1",
      type: "nav-header",
      props: {
        navLinks: [
          { label: "Pricing", url: "#" },
          { label: "FAQ", url: "#" },
        ],
      },
    };
    const pricing: DeadLinkBlock = { id: "p1", type: "glass-pricing-tiers", props: {} };
    const faq: DeadLinkBlock = { id: "q1", type: "dso-faq", props: {} };
    const blocks = [nav, pricing, faq, form()];
    const res = resolveDeadGeneratedLinks(blocks);

    expect(res.anchored).toBe(2);
    const links = nav.props!.navLinks as Array<{ label: string; url: string }>;
    expect(links[0].url).toBe("#pricing");
    expect(links[1].url).toBe("#faq");
    expect(pricing.blockSettings?.anchorId).toBe("pricing");
    expect(faq.blockSettings?.anchorId).toBe("faq");
  });

  it("routes conversion labels to the form block's anchor and reuses existing anchorIds", () => {
    const nav: DeadLinkBlock = {
      id: "n1",
      type: "mega-menu-nav",
      props: { links: [{ label: "Get started", url: "#" }] },
    };
    const f = form();
    f.blockSettings = { anchorId: "contact-us" };
    const blocks = [nav, f];
    const res = resolveDeadGeneratedLinks(blocks);

    expect(res.anchored).toBe(1);
    expect((nav.props!.links as Array<{ url: string }>)[0].url).toBe("#contact-us");
    expect(f.blockSettings.anchorId).toBe("contact-us"); // untouched
  });

  it("drops nav links with no matching section (empty beats dead), covers nested menuGroups", () => {
    const nav: DeadLinkBlock = {
      id: "n1",
      type: "mega-menu-nav",
      props: {
        links: [{ label: "Careers", url: "#" }],
        menuGroups: [
          { title: "Product", links: [{ label: "Solutions", url: "#" }, { label: "Partners", url: "#" }] },
        ],
      },
    };
    const features: DeadLinkBlock = { id: "z1", type: "zigzag-features", props: {} };
    const res = resolveDeadGeneratedLinks([nav, features]);

    // "Careers" + "Partners" have no section → removed; "Solutions" anchors.
    expect(res.dropped).toBe(2);
    expect(res.anchored).toBe(1);
    expect(nav.props!.links).toEqual([]);
    const group = (nav.props!.menuGroups as Array<{ links: Array<{ label: string; url: string }> }>)[0];
    expect(group.links).toHaveLength(1);
    expect(group.links[0]).toMatchObject({ label: "Solutions", url: "#features" });
  });

  it("treats a labeled link with an empty url as dead, but never touches real urls", () => {
    const nav: DeadLinkBlock = {
      id: "n1",
      type: "nav-header",
      props: {
        navLinks: [
          { label: "Pricing", url: "" },
          { label: "Docs", url: "https://docs.example.com" },
          { label: "Top", url: "#hero" },
        ],
      },
    };
    const pricing: DeadLinkBlock = { id: "p1", type: "gradient-pricing", props: {} };
    const res = resolveDeadGeneratedLinks([nav, pricing]);

    const links = nav.props!.navLinks as Array<{ url: string }>;
    expect(links.map((l) => l.url)).toEqual(["#pricing", "https://docs.example.com", "#hero"]);
    expect(res.dropped).toBe(0);
  });
});

describe("CTA prop resolution", () => {
  it("prefers the tenant defaultCtaUrl for buttons, before the form anchor", () => {
    const hero: DeadLinkBlock = {
      id: "h1",
      type: "hero",
      props: { headline: "Hi", ctaText: "Get a demo", ctaUrl: "#" },
    };
    const res = resolveDeadGeneratedLinks([hero, form()], { defaultCtaUrl: "https://x.com/demo" });
    expect(hero.props!.ctaUrl).toBe("https://x.com/demo");
    expect(res.resolved).toBe(1);
  });

  it("falls back to the form anchor, assigning get-started", () => {
    const hero: DeadLinkBlock = {
      id: "h1",
      type: "hero",
      props: { ctaText: "Get a demo", ctaUrl: "#" },
    };
    const f = form();
    resolveDeadGeneratedLinks([hero, f]);
    expect(hero.props!.ctaUrl).toBe("#get-started");
    expect(f.blockSettings?.anchorId).toBe("get-started");
  });

  it("hides the button (clears url + label) when there is no target at all", () => {
    const hero: DeadLinkBlock = {
      id: "h1",
      type: "hero",
      props: { ctaText: "Get a demo", ctaUrl: "#" },
    };
    const res = resolveDeadGeneratedLinks([hero]);
    expect(hero.props!.ctaUrl).toBe("");
    expect(hero.props!.ctaText).toBe("");
    expect(res.dropped).toBe(1);
  });

  it("never touches non-URL CTA actions (chilipiper stays configured, url inert)", () => {
    const hero: DeadLinkBlock = {
      id: "h1",
      type: "hero",
      props: { ctaText: "Book", ctaAction: "chilipiper", chilipiperUrl: "https://x.chilipiper.com/r", ctaUrl: "#" },
    };
    const res = resolveDeadGeneratedLinks([hero, form()]);
    expect(hero.props!.ctaUrl).toBe("#");
    expect(hero.props!.ctaText).toBe("Book");
    expect(res.resolved + res.dropped).toBe(0);
  });

  it("ignores unlabeled CTA urls, fixes secondary/nav CTA pairs, walks children", () => {
    const section: DeadLinkBlock = {
      id: "s1",
      type: "section",
      props: {},
      children: [
        { id: "c1", type: "cta-button", props: { ctaText: "Start", ctaUrl: "#" } },
      ],
    };
    const heroChrome: DeadLinkBlock = {
      id: "h1",
      type: "aurora-gradient-hero",
      props: {
        ctaText: "", ctaUrl: "#",            // no label → untouched
        navCtaText: "Get started", navCtaUrl: "#",
        ctaSecondaryText: "See more", ctaSecondaryUrl: "#",
      },
    };
    resolveDeadGeneratedLinks([heroChrome, section, form()], { defaultCtaUrl: "https://x.com/go" });
    expect(heroChrome.props!.ctaUrl).toBe("#");           // unlabeled: left alone
    expect(heroChrome.props!.navCtaUrl).toBe("https://x.com/go");
    expect(heroChrome.props!.ctaSecondaryUrl).toBe("https://x.com/go");
    expect((section.children![0].props as Record<string, unknown>).ctaUrl).toBe("https://x.com/go");
  });

  it("leaves form redirectUrl alone and clears a dead mega-menu featuredUrl", () => {
    const f: DeadLinkBlock = { id: "f1", type: "form", props: { redirectUrl: "#", steps: [] } };
    const nav: DeadLinkBlock = { id: "n1", type: "mega-menu-nav", props: { featuredUrl: "#", featuredTitle: "News" } };
    resolveDeadGeneratedLinks([nav, f]);
    expect(f.props!.redirectUrl).toBe("#");
    expect(nav.props!.featuredUrl).toBe("");
  });
});

describe("anchor uniqueness + idempotence", () => {
  it("dedupes a new anchor against an existing one with the same slug", () => {
    const nav: DeadLinkBlock = { id: "n1", type: "nav-header", props: { navLinks: [{ label: "Pricing", url: "#" }] } };
    const other: DeadLinkBlock = { id: "x1", type: "rich-text", props: {}, blockSettings: { anchorId: "pricing" } };
    const pricing: DeadLinkBlock = { id: "p1", type: "gradient-pricing", props: {} };
    resolveDeadGeneratedLinks([nav, other, pricing]);
    expect(pricing.blockSettings?.anchorId).toBe("pricing-2");
    expect((nav.props!.navLinks as Array<{ url: string }>)[0].url).toBe("#pricing-2");
  });

  it("is a no-op on a page with nothing dead", () => {
    const blocks: DeadLinkBlock[] = [
      { id: "h1", type: "hero", props: { ctaText: "Go", ctaUrl: "https://x.com" } },
      form(),
    ];
    const res = resolveDeadGeneratedLinks(blocks);
    expect(res).toMatchObject({ anchored: 0, resolved: 0, dropped: 0 });
  });
});
