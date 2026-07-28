import { describe, expect, it } from "vitest";
import { extractPartnerLogos } from "./partner-logo-scrape";

const BASE = "https://conf.example.com/partners";

describe("extractPartnerLogos", () => {
  it("picks marks out of a sponsor wall", () => {
    const html = `
      <section class="sponsor-grid">
        <img src="/logos/acme.svg" alt="Acme Corp logo">
        <img src="/logos/northwind.png" alt="Northwind">
      </section>`;
    const { candidates } = extractPartnerLogos(html, BASE);
    expect(candidates.map((c) => c.name)).toEqual(["Acme Corp", "Northwind"]);
    expect(candidates[0].url).toBe("https://conf.example.com/logos/acme.svg");
  });

  it("finds a wall introduced only by its heading (no useful class names)", () => {
    const html = `
      <div><h2>Our sponsors</h2>
        <div><img src="/a.png" alt="Acme"></div>
      </div>`;
    expect(extractPartnerLogos(html, BASE).candidates).toHaveLength(1);
  });

  it("NEVER returns the host site's own header or footer logo", () => {
    // The inverse of the brand-import extractor: its target is our noise.
    const html = `
      <header><img src="/brand/site-logo.svg" alt="Example Conf logo"></header>
      <footer><img src="/brand/site-logo-white.svg" alt="Example Conf logo"></footer>
      <section class="partners"><img src="/logos/acme.svg" alt="Acme"></section>`;
    const { candidates } = extractPartnerLogos(html, BASE);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].name).toBe("Acme");
  });

  it("skips icons, social glyphs and tracking pixels", () => {
    const html = `
      <section class="partners">
        <img src="/logos/acme.svg" alt="Acme">
        <img src="/icons/twitter.svg" alt="Twitter">
        <img src="/img/spacer-1x1.gif" alt="">
        <img src="/sprite.png" alt="sprite">
      </section>`;
    expect(extractPartnerLogos(html, BASE).candidates.map((c) => c.name)).toEqual(["Acme"]);
  });

  it("dedupes the same mark shipped at several widths", () => {
    const html = `
      <section class="partners">
        <img src="/logos/acme-200x100.png" alt="Acme">
        <img src="/logos/acme-400x200.png" alt="Acme">
        <img src="/logos/acme.png?w=800" alt="Acme">
      </section>`;
    expect(extractPartnerLogos(html, BASE).candidates).toHaveLength(1);
  });

  it("falls back to the filename when there is no alt text", () => {
    const html = `<section class="partners"><img src="/logos/northwind-systems-logo.svg" alt=""></section>`;
    expect(extractPartnerLogos(html, BASE).candidates[0].name).toBe("Northwind Systems");
  });

  it("resolves relative, root-relative and protocol-relative srcs", () => {
    const html = `
      <section class="partners">
        <img src="acme.svg" alt="A">
        <img src="/b.svg" alt="B">
        <img src="//cdn.example.net/c.svg" alt="C">
      </section>`;
    expect(extractPartnerLogos(html, BASE).candidates.map((c) => c.url)).toEqual([
      "https://conf.example.com/acme.svg",
      "https://conf.example.com/b.svg",
      "https://cdn.example.net/c.svg",
    ]);
  });

  it("reads srcset and data-src when there's no plain src", () => {
    const html = `
      <section class="partners">
        <img srcset="/logos/a.png 1x, /logos/a@2x.png 2x" alt="A">
        <img data-src="/logos/b.png" alt="B">
      </section>`;
    expect(extractPartnerLogos(html, BASE).candidates).toHaveLength(2);
  });

  it("ignores data: URIs rather than trying to re-host them", () => {
    const html = `<section class="partners"><img src="data:image/png;base64,AAAA" alt="A"></section>`;
    expect(extractPartnerLogos(html, BASE).candidates).toHaveLength(0);
  });

  it("REPORTS truncation instead of silently capping", () => {
    const imgs = Array.from({ length: 8 }, (_, i) => `<img src="/logos/p${i}.svg" alt="P${i}">`).join("");
    const res = extractPartnerLogos(`<section class="partners">${imgs}</section>`, BASE, 5);
    expect(res.candidates).toHaveLength(5);
    expect(res.truncated).toBe(true);
    expect(extractPartnerLogos(`<section class="partners">${imgs}</section>`, BASE, 50).truncated).toBe(false);
  });

  it("a page with no wall and no logo-ish images yields nothing", () => {
    const html = `<main><img src="/photos/keynote.jpg" alt="A speaker on stage"></main>`;
    expect(extractPartnerLogos(html, BASE).candidates).toHaveLength(0);
  });

  it("still catches a logo-named image outside any recognisable wall", () => {
    const html = `<main><img src="/uploads/acme-logo.png" alt="Acme Corp logo"></main>`;
    expect(extractPartnerLogos(html, BASE).candidates.map((c) => c.name)).toEqual(["Acme Corp"]);
  });
});
