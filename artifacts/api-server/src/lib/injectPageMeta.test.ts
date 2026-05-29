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

describe("injectPageMeta — powered-by badge per tier", () => {
  // The plan→showPoweredByBadge mapping itself lives in
  // triggerPublishedRender.ts (`plan === "free"`); here we just lock
  // in that injectPageMeta honours the flag both ways, so a paid tenant
  // never accidentally gets the badge and a free tenant never
  // accidentally has it stripped.
  it("free tier: appends the Powered by LP Studio badge before </body>", () => {
    const out = injectPageMeta(baseHtml, { ...meta, showPoweredByBadge: true });
    expect(out).toContain("Powered by");
    expect(out).toContain("<strong style=\"font-weight:700\">LP Studio</strong>");
    expect(out).toContain('href="https://lpstudio.ai"');
    expect(out.indexOf("Powered by")).toBeLessThan(out.indexOf("</body>"));
  });

  it("growth / enterprise tier (flag false): omits the badge entirely", () => {
    const out = injectPageMeta(baseHtml, { ...meta, showPoweredByBadge: false });
    expect(out).not.toContain("Powered by");
    expect(out).not.toContain("lpstudio.ai");
  });

  it("flag absent (legacy callers): omits the badge — fails closed for paid tenants", () => {
    const out = injectPageMeta(baseHtml, meta);
    expect(out).not.toContain("Powered by");
  });
});

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

describe("injectPageMeta — OG image robustness for scrapers", () => {
  it("resolves a root-relative og_image to an absolute https URL on the canonical host", () => {
    const out = injectPageMeta(baseHtml, { ...meta, ogImage: "/uploads/og.jpg" });
    expect(out).toContain(
      `<meta property="og:image" content="https://pages.example.com/uploads/og.jpg" />`,
    );
    expect(out).toContain(
      `<meta name="twitter:image" content="https://pages.example.com/uploads/og.jpg" />`,
    );
  });

  it("resolves a bare relative og_image to an absolute https URL", () => {
    const out = injectPageMeta(baseHtml, { ...meta, ogImage: "uploads/og.jpg" });
    expect(out).toContain(
      `<meta property="og:image" content="https://pages.example.com/uploads/og.jpg" />`,
    );
  });

  it("upgrades a protocol-relative og_image to https", () => {
    const out = injectPageMeta(baseHtml, { ...meta, ogImage: "//cdn.example.com/og.png" });
    expect(out).toContain(
      `<meta property="og:image" content="https://cdn.example.com/og.png" />`,
    );
  });

  it("leaves an already-absolute og_image untouched", () => {
    const out = injectPageMeta(baseHtml, meta);
    expect(out).toContain(
      `<meta property="og:image" content="https://cdn.example.com/og.png" />`,
    );
  });

  it("preserves an absolute http:// og_image verbatim (does not coerce to https)", () => {
    // Author-supplied absolute URLs are trusted as-is; we only normalise
    // relative/protocol-relative shapes. Coercing the scheme could break a
    // host that only serves the asset over http.
    const out = injectPageMeta(baseHtml, {
      ...meta,
      ogImage: "http://cdn.example.com/og.png",
    });
    expect(out).toContain(
      `<meta property="og:image" content="http://cdn.example.com/og.png" />`,
    );
  });

  it("emits og:image:secure_url, og:image:type, og:image:alt and og:site_name", () => {
    const out = injectPageMeta(baseHtml, meta);
    expect(out).toContain(
      `<meta property="og:image:secure_url" content="https://cdn.example.com/og.png" />`,
    );
    expect(out).toContain(`<meta property="og:image:type" content="image/png" />`);
    expect(out).toContain(`<meta property="og:image:alt" content="SEO Title" />`);
    expect(out).toContain(`<meta name="twitter:image:alt" content="SEO Title" />`);
    expect(out).toContain(`<meta property="og:site_name" content="Example Co" />`);
  });

  it("infers og:image:type from a .jpg extension (ignoring query strings)", () => {
    const out = injectPageMeta(baseHtml, {
      ...meta,
      ogImage: "https://cdn.example.com/og.jpg?v=2",
    });
    expect(out).toContain(`<meta property="og:image:type" content="image/jpeg" />`);
  });

  it("omits og:image:type when the extension is unknown", () => {
    const out = injectPageMeta(baseHtml, {
      ...meta,
      ogImage: "https://cdn.example.com/render",
    });
    expect(out).not.toContain("og:image:type");
    expect(out).toContain(`<meta property="og:image" content="https://cdn.example.com/render" />`);
  });

  it("strips og:image:secure_url/type/alt and twitter:image:alt when ogImage cleared", () => {
    const seeded = baseHtml.replace(
      "</head>",
      `<meta property="og:image:secure_url" content="https://old/stale.png" />` +
        `<meta property="og:image:type" content="image/png" />` +
        `<meta property="og:image:alt" content="stale" />` +
        `<meta name="twitter:image:alt" content="stale" /></head>`,
    );
    const out = injectPageMeta(seeded, { ...meta, ogImage: null });
    expect(out).not.toContain("og:image:secure_url");
    expect(out).not.toContain("og:image:type");
    expect(out).not.toContain("og:image:alt");
    expect(out).not.toContain("twitter:image:alt");
    expect(out).not.toContain("stale");
  });

  it("does not duplicate og:site_name on re-render of a snapshot that already has one", () => {
    const seeded = baseHtml.replace(
      "</head>",
      `<meta property="og:site_name" content="STALE CO" /></head>`,
    );
    const out = injectPageMeta(seeded, meta);
    const matches = out.match(/property="og:site_name"/g) || [];
    expect(matches.length).toBe(1);
    expect(out).toContain(`content="Example Co"`);
    expect(out).not.toContain("STALE CO");
  });
});
