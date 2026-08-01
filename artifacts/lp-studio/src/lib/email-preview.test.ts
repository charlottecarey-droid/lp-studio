import { describe, expect, it } from "vitest";
import { buildEmailPreviewHtml } from "./email-preview";

describe("buildEmailPreviewHtml", () => {
  it("wraps the preview image and text link in anchors to the page URL", () => {
    const html = buildEmailPreviewHtml({
      pageUrl: "https://partner.example.com/p/tok123",
      imageUrl: "https://studio.example.com/api/storage/objects/uploads/abc",
      title: "Acme — your lab, upgraded",
    });
    // Both the image and the caption link click through to the page.
    expect(html.match(/href="https:\/\/partner\.example\.com\/p\/tok123"/g)?.length).toBe(2);
    expect(html).toContain('src="https://studio.example.com/api/storage/objects/uploads/abc"');
    expect(html).toContain("Acme — your lab, upgraded");
    // Fixed pixel width — email clients don't reflow like browsers.
    expect(html).toContain('width="480"');
  });

  it("escapes HTML in the title and URLs", () => {
    const html = buildEmailPreviewHtml({
      pageUrl: 'https://x.example/p/a"><script>alert(1)</script>',
      imageUrl: "https://x.example/img.png",
      title: '<b>Bold "claim" & more</b>',
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&quot;claim&quot; &amp; more");
  });

  it("falls back to a neutral label when no title is given", () => {
    const html = buildEmailPreviewHtml({
      pageUrl: "https://x.example/p/a",
      imageUrl: "https://x.example/img.png",
    });
    expect(html).toContain("Take a look");
  });
});
