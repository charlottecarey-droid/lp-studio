import { describe, expect, it } from "vitest";
import { buildEmailPreviewHtml, DEFAULT_CARD_LINK_LABEL, firstNameOf, buildOutreachEmail, buildGmailComposeUrl, buildMailtoUrl, fillOutreachTokens } from "./email-preview";

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
    expect(html).toContain(DEFAULT_CARD_LINK_LABEL);
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

describe("fillOutreachTokens", () => {
  it("substitutes tokens and tolerates whitespace/case inside the braces", () => {
    expect(fillOutreachTokens("Hey {{first_name}} re {{ Page_Title }}", { firstName: "Ava", pageTitle: "Proposal" }))
      .toBe("Hey Ava re Proposal");
  });

  it("repairs the dangling punctuation a missing name leaves behind", () => {
    expect(fillOutreachTokens("Hey {{first_name}},", { firstName: "", pageTitle: "" })).toBe("Hey,");
  });

  it("leaves unknown tokens alone rather than blanking them", () => {
    expect(fillOutreachTokens("Hi {{company}}", { firstName: "A", pageTitle: "B" })).toBe("Hi {{company}}");
  });
});

describe("buildOutreachEmail — workspace templates", () => {
  const url = "https://x.example.com/p/tok";

  it("uses the workspace subject + intro when set", () => {
    const { subject, body } = buildOutreachEmail({
      firstName: "Ava", pageTitle: "Q3 Proposal", url,
      subjectTemplate: "{{page_title}} for you",
      introTemplate: "Morning {{first_name}} — quick one:",
    });
    expect(subject).toBe("Q3 Proposal for you");
    expect(body.startsWith("Morning Ava — quick one:")).toBe(true);
    expect(body).toContain(url);
  });

  it("treats a blank/whitespace template as unset", () => {
    const { subject, body } = buildOutreachEmail({
      firstName: "Ava", pageTitle: "Q3 Proposal", url, subjectTemplate: "   ", introTemplate: "",
    });
    expect(subject).toBe("Q3 Proposal");
    expect(body.startsWith("Hey Ava,")).toBe(true);
  });

  it("never yields an empty subject when the template resolves to nothing", () => {
    expect(buildOutreachEmail({ url, subjectTemplate: "{{page_title}}" }).subject).toBe("A page for you");
  });
});

describe("buildMailtoUrl", () => {
  it("encodes spaces as %20 (a '+' shows up literally in mail clients)", () => {
    const u = buildMailtoUrl({ to: "ava@x.com", subject: "Hello there", body: "Line one\nLine two" });
    expect(u.startsWith("mailto:ava%40x.com?")).toBe(true);
    expect(u).toContain("subject=Hello%20there");
    expect(u).not.toContain("+");
  });

  it("still builds a usable draft with no recipient", () => {
    expect(buildMailtoUrl({ to: null, subject: "s", body: "b" }).startsWith("mailto:?")).toBe(true);
  });
});

describe("buildEmailPreviewHtml — link caption", () => {
  it("defaults to the action phrase, not the page title", () => {
    const html = buildEmailPreviewHtml({ pageUrl: "https://x.com/p/t", imageUrl: "https://x.com/i.png" });
    expect(html).toContain(DEFAULT_CARD_LINK_LABEL);
    expect(html).toContain(`${DEFAULT_CARD_LINK_LABEL} &rarr;`);
  });

  it("uses a per-page label when one is supplied", () => {
    const html = buildEmailPreviewHtml({ pageUrl: "https://x.com/p/t", imageUrl: "https://x.com/i.png", title: "Check it out" });
    expect(html).toContain("Check it out &rarr;");
    expect(html).not.toContain(DEFAULT_CARD_LINK_LABEL);
  });

  it("escapes a label containing markup", () => {
    const html = buildEmailPreviewHtml({ pageUrl: "https://x.com/p/t", imageUrl: "https://x.com/i.png", title: '<script>x</script>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
