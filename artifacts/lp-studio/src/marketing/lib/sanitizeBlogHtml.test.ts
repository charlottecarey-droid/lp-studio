import { describe, it, expect } from "vitest";
import { sanitizeBlogHtml } from "./sanitizeBlogHtml";

describe("sanitizeBlogHtml — semantic allowlist", () => {
  it("keeps semantic editorial tags", () => {
    const html =
      "<h2>Title</h2><p>Para <strong>bold</strong> <em>em</em></p>" +
      "<ul><li>one</li><li>two</li></ul><ol><li>a</li></ol>" +
      "<blockquote>quote</blockquote><pre><code>code</code></pre><hr />";
    const out = sanitizeBlogHtml(html);
    expect(out).toContain("<h2>Title</h2>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>em</em>");
    expect(out).toContain("<li>one</li>");
    expect(out).toContain("<blockquote>");
    expect(out).toContain("<pre>");
    expect(out).toContain("<hr");
  });

  it("keeps tables", () => {
    const html =
      "<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>";
    const out = sanitizeBlogHtml(html);
    expect(out).toContain("<table>");
    expect(out).toContain("<thead>");
    expect(out).toContain("<th>A</th>");
    expect(out).toContain("<td>1</td>");
  });

  it("keeps figure/figcaption", () => {
    const out = sanitizeBlogHtml(
      '<figure><img src="/a.png" alt="x" /><figcaption>cap</figcaption></figure>',
    );
    expect(out).toContain("<figure>");
    expect(out).toContain("<figcaption>cap</figcaption>");
    expect(out).toContain('src="/a.png"');
  });

  it("keeps inline SVG and its children/attrs", () => {
    const svg =
      '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="0" y="0" width="10" height="10" fill="#4B47E5"/>' +
      '<path d="M0 0L10 10" stroke="#E26B4F"/><text x="1" y="1">hi</text></svg>';
    const out = sanitizeBlogHtml(svg);
    expect(out).toContain("<svg");
    expect(out).toContain('viewbox="0 0 10 10"');
    expect(out).toContain('fill="#4B47E5"');
    expect(out).toContain('<path d="M0 0L10 10"');
    expect(out).toContain("<text");
    expect(out).not.toContain("&lt;svg");
  });

  it("keeps safe links and external rel; rewrites javascript: href", () => {
    const out = sanitizeBlogHtml(
      '<a href="https://x.com" target="_blank" rel="noopener">x</a>' +
        '<a href="javascript:alert(1)">bad</a>',
    );
    expect(out).toContain('href="https://x.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('href="#"'); // javascript: rewritten
    expect(out).not.toContain("javascript:");
  });
});

describe("sanitizeBlogHtml — iframe embed allowlist", () => {
  it("allows a YouTube iframe", () => {
    const out = sanitizeBlogHtml(
      '<iframe src="https://www.youtube.com/embed/abc123" allowfullscreen></iframe>',
    );
    expect(out).toContain("<iframe");
    expect(out).toContain("youtube.com/embed/abc123");
  });

  it("allows Vimeo and Loom iframes", () => {
    expect(sanitizeBlogHtml('<iframe src="https://player.vimeo.com/video/123"></iframe>')).toContain(
      "<iframe",
    );
    expect(sanitizeBlogHtml('<iframe src="https://www.loom.com/embed/xyz"></iframe>')).toContain(
      "<iframe",
    );
  });

  it("strips an iframe from a non-allowlisted host", () => {
    const out = sanitizeBlogHtml('<iframe src="https://evil.example.com/x"></iframe>');
    expect(out).not.toContain("<iframe");
    expect(out).toContain("&lt;iframe"); // escaped to text
  });

  it("strips an http (non-https) youtube iframe", () => {
    const out = sanitizeBlogHtml('<iframe src="http://www.youtube.com/embed/abc"></iframe>');
    expect(out).not.toContain("<iframe ");
  });
});

describe("sanitizeBlogHtml — XSS guards", () => {
  it("drops <script> entirely (content removed, not escaped-into-output)", () => {
    const out = sanitizeBlogHtml('<p>safe</p><script>alert(1)</script><p>after</p>');
    expect(out).toContain("<p>safe</p>");
    expect(out).toContain("<p>after</p>");
    expect(out).not.toContain("alert(1)");
    expect(out).not.toContain("<script");
  });

  it("drops <style> blocks", () => {
    const out = sanitizeBlogHtml("<style>body{display:none}</style><p>ok</p>");
    expect(out).not.toContain("display:none");
    expect(out).toContain("<p>ok</p>");
  });

  it("strips on* event handlers", () => {
    const out = sanitizeBlogHtml('<p onclick="steal()">hi</p><img src="/a.png" onerror="x()" />');
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onerror");
    expect(out).toContain("<p>hi</p>");
    expect(out).toContain('src="/a.png"');
  });

  it("rewrites javascript: in img/src and a/href", () => {
    const out = sanitizeBlogHtml('<img src="javascript:alert(1)" />');
    expect(out).not.toContain("javascript:");
  });

  it("strips non-image data: URLs but allows data:image", () => {
    expect(sanitizeBlogHtml('<img src="data:text/html,<script>x</script>" />')).not.toContain(
      "data:text/html",
    );
    expect(sanitizeBlogHtml('<img src="data:image/png;base64,AAAA" />')).toContain(
      "data:image/png;base64,AAAA",
    );
  });

  it("escapes disallowed tags to visible text", () => {
    const out = sanitizeBlogHtml("<object data='x'></object><p>ok</p>");
    expect(out).toContain("&lt;object");
    expect(out).toContain("<p>ok</p>");
  });

  it("sanitizes style attributes (drops url()/expression, keeps width)", () => {
    const out = sanitizeBlogHtml(
      '<div style="width:50%;background:url(javascript:alert(1))">x</div>',
    );
    // url(...) makes the whole style value drop
    expect(out).not.toContain("url(");
    expect(out).not.toContain("javascript:");
  });

  it("keeps a benign width style", () => {
    const out = sanitizeBlogHtml('<img src="/a.png" style="width:50%;border-radius:8px" />');
    expect(out).toContain("width: 50%");
    expect(out).toContain("border-radius: 8px");
  });
});
