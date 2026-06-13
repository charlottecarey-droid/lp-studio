import { describe, it, expect } from "vitest";
import {
  markdownToHtml,
  looksLikeMarkdown,
  htmlWordCount,
  sanitizeRawBlogHtml,
} from "./blogHtml";

describe("markdownToHtml — round-trips editorial markdown to HTML", () => {
  it("converts ATX headings", () => {
    expect(markdownToHtml("# H1")).toBe("<h1>H1</h1>");
    expect(markdownToHtml("## H2")).toBe("<h2>H2</h2>");
    expect(markdownToHtml("### H3")).toBe("<h3>H3</h3>");
  });

  it("converts paragraphs with bold/italic", () => {
    const out = markdownToHtml("A **bold** and _em_ word.");
    expect(out).toContain("<p>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>em</em>");
  });

  it("converts links and marks external links", () => {
    const out = markdownToHtml("See [home](https://x.com) now.");
    expect(out).toContain('<a href="https://x.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain("home</a>");
  });

  it("rewrites a javascript: link", () => {
    const out = markdownToHtml("[bad](javascript:alert(1))");
    expect(out).not.toContain("javascript:");
    expect(out).toContain('href="#"');
  });

  it("converts images", () => {
    const out = markdownToHtml("![alt text](/img/a.png)");
    expect(out).toContain('<img src="/img/a.png"');
    expect(out).toContain('alt="alt text"');
    expect(out).toContain("loading=");
  });

  it("converts unordered and ordered lists", () => {
    expect(markdownToHtml("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
    expect(markdownToHtml("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
  });

  it("converts blockquotes and horizontal rules", () => {
    expect(markdownToHtml("> quoted")).toContain("<blockquote>quoted</blockquote>");
    expect(markdownToHtml("---")).toBe("<hr />");
  });

  it("converts fenced code blocks and escapes their contents", () => {
    const out = markdownToHtml("```\n<script>x</script>\n```");
    expect(out).toContain("<pre><code>");
    expect(out).toContain("&lt;script&gt;");
    expect(out).not.toContain("<script>");
  });

  it("passes inline SVG through unescaped (preserves infographics)", () => {
    const md =
      '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="10" height="10" fill="#4B47E5"/></svg>';
    const out = markdownToHtml(md);
    expect(out).toContain('<div class="lp-blog-embed">');
    expect(out).toContain("<svg");
    expect(out).toContain('fill="#4B47E5"');
    expect(out).not.toContain("&lt;svg");
  });

  it("passes an allowlisted table block through", () => {
    const md =
      "<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>";
    const out = markdownToHtml(md);
    expect(out).toContain("<table>");
    expect(out).toContain("<th>A</th>");
    expect(out).toContain("<td>1</td>");
  });

  it("escapes a raw <script> in prose", () => {
    const out = markdownToHtml("Hello <script>alert(1)</script> world");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });
});

describe("looksLikeMarkdown — gates the one-time heal", () => {
  it("detects markdown bodies", () => {
    expect(looksLikeMarkdown("# Heading\n\nbody")).toBe(true);
    expect(looksLikeMarkdown("- a\n- b")).toBe(true);
    expect(looksLikeMarkdown("See [x](https://y.com)")).toBe(true);
    expect(looksLikeMarkdown("> quote")).toBe(true);
  });

  it("treats HTML bodies as already-converted (heal is a no-op)", () => {
    expect(looksLikeMarkdown("<h2>x</h2><p>y</p>")).toBe(false);
    expect(looksLikeMarkdown('<div class="lp-blog-embed"><svg></svg></div>')).toBe(false);
    expect(looksLikeMarkdown("")).toBe(false);
  });

  it("converting markdown yields HTML that the heal won't re-process", () => {
    const md = "# Title\n\nA **bold** [link](https://x.com).\n\n- one\n- two";
    const html = markdownToHtml(md);
    expect(looksLikeMarkdown(md)).toBe(true);
    expect(looksLikeMarkdown(html)).toBe(false); // idempotent
  });
});

describe("htmlWordCount — drives SEO/GEO wordCount", () => {
  it("counts prose words, excluding tags + SVG + code", () => {
    const html =
      "<h2>One Two</h2><p>three four five</p>" +
      '<div class="lp-blog-embed"><svg><text>ignored words here</text></svg></div>' +
      "<pre><code>ignored code</code></pre>";
    expect(htmlWordCount(html)).toBe(5);
  });
});

describe("sanitizeRawBlogHtml — server-side raw HTML guard", () => {
  it("escapes script and strips on* handlers", () => {
    const out = sanitizeRawBlogHtml('<p onclick="x()">hi</p><script>y()</script>');
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("<script");
    expect(out).toContain("<p>hi</p>");
  });

  it("drops a non-allowlisted iframe host but keeps youtube", () => {
    expect(sanitizeRawBlogHtml('<iframe src="https://evil.com/x"></iframe>')).not.toContain(
      "<iframe",
    );
    expect(
      sanitizeRawBlogHtml('<iframe src="https://www.youtube.com/embed/a"></iframe>'),
    ).toContain("<iframe");
  });
});
