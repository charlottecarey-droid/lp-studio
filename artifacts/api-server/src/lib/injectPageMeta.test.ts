import { describe, it, expect } from "vitest";
import { injectPageMeta, __test } from "./injectPageMeta";

const baseHtml = `<!DOCTYPE html><html><head><title>old</title></head><body>x</body></html>`;

const meta = {
  title: "Hero Title",
  metaTitle: "SEO Title",
  metaDescription: "SEO description here.",
  ogImage: "https://cdn.example.com/og.png",
  slug: "my-page",
  canonicalHost: "pages.example.com",
  tenantName: "Example Co",
};

describe("injectPageMeta", () => {
  it("replaces existing <title>", () => {
    const out = injectPageMeta(baseHtml, meta);
    expect(out).toContain("<title>SEO Title</title>");
    expect(out).not.toContain("<title>old</title>");
  });

  it("inserts meta description when missing", () => {
    const out = injectPageMeta(baseHtml, meta);
    expect(out).toContain(
      `<meta name="description" content="SEO description here." />`,
    );
  });

  it("builds canonical URL from host + slug", () => {
    const out = injectPageMeta(baseHtml, meta);
    expect(out).toContain(
      `<link rel="canonical" href="https://pages.example.com/my-page" />`,
    );
  });

  it("emits all OG and Twitter tags from page columns (per-page meta)", () => {
    const out = injectPageMeta(baseHtml, meta);
    expect(out).toContain(`<meta property="og:type" content="website" />`);
    expect(out).toContain(
      `<meta property="og:url" content="https://pages.example.com/my-page" />`,
    );
    expect(out).toContain(`<meta property="og:title" content="SEO Title" />`);
    expect(out).toContain(
      `<meta property="og:description" content="SEO description here." />`,
    );
    expect(out).toContain(
      `<meta property="og:image" content="https://cdn.example.com/og.png" />`,
    );
    expect(out).toContain(`<meta name="twitter:card" content="summary_large_image" />`);
    expect(out).toContain(`<meta name="twitter:title" content="SEO Title" />`);
    expect(out).toContain(
      `<meta name="twitter:image" content="https://cdn.example.com/og.png" />`,
    );
  });

  it("replaces existing OG tags rather than duplicating them", () => {
    const seeded = baseHtml.replace(
      "</head>",
      `<meta property="og:title" content="STALE" /></head>`,
    );
    const out = injectPageMeta(seeded, meta);
    const matches = out.match(/property="og:title"/g) || [];
    expect(matches.length).toBe(1);
    expect(out).toContain(`<meta property="og:title" content="SEO Title" />`);
    expect(out).not.toContain("STALE");
  });

  it("falls back to page.title when metaTitle empty", () => {
    const out = injectPageMeta(baseHtml, { ...meta, metaTitle: null });
    expect(out).toContain(`<title>Hero Title</title>`);
  });

  it("uses summary (not summary_large_image) when ogImage missing", () => {
    const out = injectPageMeta(baseHtml, { ...meta, ogImage: null });
    expect(out).toContain(`<meta name="twitter:card" content="summary" />`);
    expect(out).not.toContain("og:image");
    expect(out).not.toContain("twitter:image");
  });

  it("removes stale og:image/twitter:image tags from snapshot when ogImage cleared", () => {
    // Simulate a snapshot that still has og:image/twitter:image from an
    // earlier version of the page. After clearing og_image in the DB and
    // re-rendering, those tags MUST NOT survive in the final HTML.
    const seeded = baseHtml.replace(
      "</head>",
      `<meta property="og:image" content="https://old.example.com/stale.png" />` +
        `<meta name="twitter:image" content="https://old.example.com/stale.png" /></head>`,
    );
    const out = injectPageMeta(seeded, { ...meta, ogImage: null });
    expect(out).not.toContain("og:image");
    expect(out).not.toContain("twitter:image");
    expect(out).not.toContain("stale.png");
  });

  it("strips duplicate managed tags from the snapshot", () => {
    // SPA happened to emit two og:title tags. Final output must have ONE.
    const seeded = baseHtml.replace(
      "</head>",
      `<meta property="og:title" content="dup1" />` +
        `<meta property="og:title" content="dup2" /></head>`,
    );
    const out = injectPageMeta(seeded, meta);
    const matches = out.match(/property="og:title"/g) || [];
    expect(matches.length).toBe(1);
    expect(out).toContain(`content="SEO Title"`);
    expect(out).not.toContain("dup1");
    expect(out).not.toContain("dup2");
  });

  it("escapes quotes/angle brackets in meta values to prevent injection", () => {
    const out = injectPageMeta(baseHtml, {
      ...meta,
      metaTitle: `Hi"<script>alert(1)</script>`,
    });
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).toContain("&quot;&lt;script&gt;");
  });

  it("buildTags uses tenant name when nothing else is set", () => {
    const tags = __test.buildTags({
      ...meta,
      metaTitle: null,
      title: "",
    });
    expect(tags.title).toBe("Example Co");
  });
});
