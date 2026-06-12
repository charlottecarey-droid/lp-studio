import { describe, it, expect } from "vitest";
import { buildSitemapXml } from "./sitemapXml";

describe("buildSitemapXml", () => {
  it("emits one <url> per indexable page with loc + lastmod", () => {
    const lastmod = new Date("2026-06-01T12:00:00.000Z");
    const xml = buildSitemapXml(
      [
        { slug: "pricing", indexable: true, lastmod },
        { slug: "about-us", indexable: true, lastmod: null },
      ],
      "pages.example.com",
    );
    expect(xml).toContain(`<?xml version="1.0" encoding="UTF-8"?>`);
    expect(xml).toContain(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);
    expect(xml).toContain("<loc>https://pages.example.com/pricing</loc>");
    expect(xml).toContain("<lastmod>2026-06-01T12:00:00.000Z</lastmod>");
    expect(xml).toContain("<loc>https://pages.example.com/about-us</loc>");
    // about-us has no timestamp → exactly one lastmod in the document.
    expect((xml.match(/<lastmod>/g) || []).length).toBe(1);
    expect((xml.match(/<url>/g) || []).length).toBe(2);
  });

  it("excludes non-indexable (noindex-resolved) pages", () => {
    const xml = buildSitemapXml(
      [
        { slug: "public-page", indexable: true },
        { slug: "secret-noindex-page", indexable: false },
      ],
      "pages.example.com",
    );
    expect(xml).toContain("public-page");
    expect(xml).not.toContain("secret-noindex-page");
    expect((xml.match(/<url>/g) || []).length).toBe(1);
  });

  it("produces a valid empty urlset for an empty list", () => {
    const xml = buildSitemapXml([], "pages.example.com");
    expect(xml).toContain(`<?xml version="1.0" encoding="UTF-8"?>`);
    expect(xml).toContain(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
    expect(xml).not.toContain("<url>");
  });

  it("produces a valid empty urlset when every page is non-indexable", () => {
    const xml = buildSitemapXml(
      [{ slug: "a", indexable: false }, { slug: "b", indexable: false }],
      "pages.example.com",
    );
    expect(xml).not.toContain("<url>");
    expect(xml).toContain("</urlset>");
  });

  it("escapes XML-special characters in the loc", () => {
    const xml = buildSitemapXml(
      [{ slug: `a&b<c>"d'e`, indexable: true }],
      "pages.example.com",
    );
    expect(xml).toContain(
      "<loc>https://pages.example.com/a&amp;b&lt;c&gt;&quot;d&apos;e</loc>",
    );
    expect(xml).not.toContain("a&b");
    expect(xml).not.toContain("<c>");
  });

  it("normalises the host (port stripped, lowercased) and skips empty slugs", () => {
    const xml = buildSitemapXml(
      [
        { slug: "page", indexable: true },
        { slug: "  ", indexable: true },
      ],
      "Pages.Example.com:443",
    );
    expect(xml).toContain("<loc>https://pages.example.com/page</loc>");
    expect((xml.match(/<url>/g) || []).length).toBe(1);
  });
});
