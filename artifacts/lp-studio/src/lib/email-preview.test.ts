import { describe, expect, it } from "vitest";
import { buildEmailPreviewHtml, firstNameOf, buildOutreachEmail, buildGmailComposeUrl } from "./email-preview";

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

describe("firstNameOf", () => {
  it("takes the first token of a full name", () => {
    expect(firstNameOf("Ava Nguyen")).toBe("Ava");
    expect(firstNameOf("  Ben  Ortiz ")).toBe("Ben");
  });

  it("returns '' for junk so callers can drop the name from the greeting", () => {
    expect(firstNameOf(null)).toBe("");
    expect(firstNameOf("   ")).toBe("");
    // A contact with no name falls back to their email — never greet "Hey ava@x.com,"
    expect(firstNameOf("ava@acmedental.com")).toBe("");
  });
});

describe("buildOutreachEmail", () => {
  const url = "https://ent.example.com/p/tok-ava";

  it("greets by first name and always carries the URL in the body", () => {
    const { subject, body } = buildOutreachEmail({ firstName: "Ava", pageTitle: "Acme — Proposal", url });
    expect(subject).toBe("Acme — Proposal");
    expect(body.startsWith("Hey Ava,")).toBe(true);
    // The card can't ride a compose URL, so an un-pasted send must still work.
    expect(body).toContain(url);
  });

  it("degrades to a name-less greeting and a generic subject", () => {
    const { subject, body } = buildOutreachEmail({ url });
    expect(subject).toBe("A page for you");
    expect(body.startsWith("Hey,")).toBe(true);
    expect(body).not.toContain("Hey ,");
  });
});

describe("buildGmailComposeUrl", () => {
  it("builds a compose URL and encodes the body", () => {
    const u = new URL(buildGmailComposeUrl({ to: "ava@x.com", subject: "Hi & bye", body: "Line 1\nLine 2" }));
    expect(u.origin + u.pathname).toBe("https://mail.google.com/mail/");
    expect(u.searchParams.get("view")).toBe("cm");
    expect(u.searchParams.get("to")).toBe("ava@x.com");
    expect(u.searchParams.get("su")).toBe("Hi & bye");
    expect(u.searchParams.get("body")).toBe("Line 1\nLine 2");
  });

  it("omits `to` entirely when there's no recipient (plain-link path)", () => {
    const u = new URL(buildGmailComposeUrl({ to: "  ", subject: "s", body: "b" }));
    expect(u.searchParams.has("to")).toBe(false);
  });
});
