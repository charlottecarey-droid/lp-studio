import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";

import { pickImages } from "./photography";
import type { Evidence } from "../types";

function makeEvidence(html: string, overrides: Partial<Evidence> = {}): Evidence {
  return {
    homeUrl: "https://shop.example.com",
    pages: [],
    stylesheets: [],
    $home: cheerio.load(html),
    robots: { allowed: {}, source: null, userAgent: "test" },
    screenshotUrl: null,
    screenshotDataUrl: null,
    sampledPalette: [],
    cssVarPaletteHints: [],
    errors: [],
    ...overrides,
  };
}

describe("pickImages (brand-import photography)", () => {
  it("falls back to a real lazy attr when src is a data: placeholder", () => {
    // The atown-class lazy-loading pattern: 1×1 placeholder in `src`,
    // the real asset in `data-src`. The placeholder must be skipped and
    // the real image picked.
    const html = `
      <main>
        <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="
             data-src="https://cdn.example.com/hero-large.jpg" />
      </main>`;
    expect(pickImages(makeEvidence(html))).toContain("https://cdn.example.com/hero-large.jpg");
  });

  it("picks the largest candidate from a srcset", () => {
    const html = `
      <main>
        <img srcset="https://cdn.example.com/small.jpg 320w,
                     https://cdn.example.com/big.jpg 1024w" />
      </main>`;
    expect(pickImages(makeEvidence(html))).toContain("https://cdn.example.com/big.jpg");
  });

  it("reads <picture><source srcset>", () => {
    const html = `
      <section>
        <picture>
          <source srcset="https://cdn.example.com/art.webp 800w" type="image/webp" />
          <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
        </picture>
      </section>`;
    expect(pickImages(makeEvidence(html))).toContain("https://cdn.example.com/art.webp");
  });

  it("reads data-original lazy attr", () => {
    const html = `
      <div>
        <img data-original="https://cdn.example.com/product.png" />
      </div>`;
    expect(pickImages(makeEvidence(html))).toContain("https://cdn.example.com/product.png");
  });

  it("extracts inline CSS background-image URLs", () => {
    const html = `
      <section style="background-image: url('https://cdn.example.com/bg.jpg'); padding: 2rem;">
        <h1>Hero</h1>
      </section>`;
    expect(pickImages(makeEvidence(html))).toContain("https://cdn.example.com/bg.jpg");
  });

  it("ignores data: URLs entirely (never emits an empty/placeholder ref)", () => {
    const html = `
      <main>
        <img src="data:image/png;base64,iVBORw0KGgo=" />
      </main>`;
    expect(pickImages(makeEvidence(html))).toEqual([]);
  });

  it("skips icon/logo/sprite and header/nav/footer chrome", () => {
    const html = `
      <header><img src="https://cdn.example.com/logo.svg" /></header>
      <nav><img src="https://cdn.example.com/nav-icon.png" /></nav>
      <main><img src="https://cdn.example.com/real-photo.jpg" /></main>
      <footer><img src="https://cdn.example.com/sprite.png" /></footer>`;
    const out = pickImages(makeEvidence(html));
    expect(out).toContain("https://cdn.example.com/real-photo.jpg");
    expect(out).not.toContain("https://cdn.example.com/logo.svg");
    expect(out).not.toContain("https://cdn.example.com/nav-icon.png");
    expect(out).not.toContain("https://cdn.example.com/sprite.png");
  });

  it("resolves relative URLs against homeUrl and dedupes", () => {
    const html = `
      <main>
        <img src="/img/a.jpg" />
        <img src="/img/a.jpg" />
        <img src="https://cdn.example.com/b.jpg" />
      </main>`;
    const out = pickImages(makeEvidence(html));
    expect(out).toEqual([
      "https://shop.example.com/img/a.jpg",
      "https://cdn.example.com/b.jpg",
    ]);
  });

  it("caps output at 8 images", () => {
    const imgs = Array.from({ length: 20 }, (_, i) => `<img src="https://cdn.example.com/p${i}.jpg" />`).join("");
    const out = pickImages(makeEvidence(`<main>${imgs}</main>`));
    expect(out.length).toBe(8);
  });
});
