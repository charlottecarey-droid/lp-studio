import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";
import {
  buildBlogPostingLd,
  buildBlogListLd,
  wordCount,
  absoluteImage,
  type BlogPostFull,
  type BlogCard,
} from "./blog";

describe("renderMarkdown", () => {
  it("renders headings, paragraphs, and lists", () => {
    const html = renderMarkdown("# Title\n\nA paragraph.\n\n- one\n- two");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<p>A paragraph.</p>");
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
  });

  it("renders ordered lists, blockquotes, and bold/italic/links", () => {
    const html = renderMarkdown(
      "1. first\n2. second\n\n> a quote\n\n**bold** and _em_ and [LP](https://lpstudio.ai)",
    );
    expect(html).toContain("<ol><li>first</li><li>second</li></ol>");
    expect(html).toContain("<blockquote>a quote</blockquote>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>em</em>");
    expect(html).toContain('<a href="https://lpstudio.ai" target="_blank" rel="noopener noreferrer">LP</a>');
  });

  it("escapes script tags and event handlers (XSS guard)", () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)" />');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    // img is allowlisted but onerror is dropped
    expect(html).not.toContain("onerror");
    expect(html).toContain("<img");
  });

  it("neutralizes javascript: URLs", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).toContain('href="#"');
    expect(html).not.toContain("javascript:");
  });

  it("passes through an allowlisted inline SVG infographic", () => {
    const md = '<svg viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="#4B47E5" /></svg>';
    const html = renderMarkdown(md);
    expect(html).toContain("<svg");
    expect(html).toContain("<rect");
    expect(html).toContain('fill="#4B47E5"');
    expect(html).toContain('viewbox="0 0 10 10"');
  });

  it("forces responsive images", () => {
    const html = renderMarkdown("![alt](https://example.com/x.png)");
    expect(html).toContain("max-width:100%");
    expect(html).toContain('alt="alt"');
  });
});

describe("wordCount", () => {
  it("ignores svg + code noise", () => {
    const body = "one two three\n```\n" + "x ".repeat(100) + "```\n<svg>y y y</svg>";
    expect(wordCount(body)).toBe(3);
  });
});

describe("absoluteImage", () => {
  it("absolutizes relative storage URLs", () => {
    expect(absoluteImage("/api/storage/x.jpg")).toBe("https://lpstudio.ai/api/storage/x.jpg");
  });
  it("passes through absolute and data URLs", () => {
    expect(absoluteImage("https://cdn/x.jpg")).toBe("https://cdn/x.jpg");
    expect(absoluteImage("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
  });
  it("returns undefined for empty", () => {
    expect(absoluteImage("")).toBeUndefined();
    expect(absoluteImage(null)).toBeUndefined();
  });
});

const POST: BlogPostFull = {
  slug: "how-to-write-a-landing-page-that-converts",
  title: "How to write a landing page that converts",
  excerpt: "The 7-section structure that does the work.",
  coverImageUrl: "/api/storage/cover.jpg",
  authorName: "LP Studio",
  tags: ["landing pages", "conversion"],
  readingTimeMin: 5,
  publishedAt: "2026-05-01T00:00:00.000Z",
  body: "# Heading\n\nSome words here that count toward word count.",
  seoTitle: "SEO title",
  seoDescription: "SEO description",
  ogImageUrl: null,
  updatedAt: "2026-05-02T00:00:00.000Z",
};

describe("buildBlogPostingLd", () => {
  it("emits a complete BlogPosting with publisher + logo + wordCount", () => {
    const ld = buildBlogPostingLd(POST) as Record<string, any>;
    expect(ld["@type"]).toBe("BlogPosting");
    expect(ld.headline).toBe("SEO title"); // seoTitle overrides title
    expect(ld.description).toBe("SEO description");
    expect(ld.datePublished).toBe("2026-05-01T00:00:00.000Z");
    expect(ld.dateModified).toBe("2026-05-02T00:00:00.000Z");
    expect(ld.author.name).toBe("LP Studio");
    expect(ld.publisher.name).toBe("LP Studio");
    expect(ld.publisher.logo.url).toContain("lpstudio-icon.svg");
    expect(ld.mainEntityOfPage["@id"]).toBe(
      "https://lpstudio.ai/blog/how-to-write-a-landing-page-that-converts",
    );
    expect(ld.url).toBe(
      "https://lpstudio.ai/blog/how-to-write-a-landing-page-that-converts",
    );
    expect(ld.wordCount).toBeGreaterThan(0);
    // og image falls back to cover, absolutized
    expect(ld.image[0]).toBe("https://lpstudio.ai/api/storage/cover.jpg");
    expect(ld.keywords).toBe("landing pages, conversion");
  });

  it("falls back to title/excerpt when seo fields are empty", () => {
    const ld = buildBlogPostingLd({ ...POST, seoTitle: null, seoDescription: null }) as Record<string, any>;
    expect(ld.headline).toBe(POST.title);
    expect(ld.description).toBe(POST.excerpt);
  });
});

describe("buildBlogListLd", () => {
  it("emits a Blog with an itemized blogPost list", () => {
    const cards: BlogCard[] = [
      { ...POST },
    ];
    const ld = buildBlogListLd(cards) as Record<string, any>;
    expect(ld["@type"]).toBe("Blog");
    expect(ld.url).toBe("https://lpstudio.ai/blog");
    expect(Array.isArray(ld.blogPost)).toBe(true);
    expect(ld.blogPost[0].url).toContain("/blog/how-to-write");
    expect(ld.publisher.name).toBe("LP Studio");
  });
});
