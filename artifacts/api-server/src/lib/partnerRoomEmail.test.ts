import { describe, expect, it } from "vitest";
import { DEFAULT_EMAIL_SHELL, expandEmailVars, renderEmail } from "./emailRender";
import { readableOn, roomActionEmailBody } from "./partnerRoomEmail";

describe("Partner Hub emails in the workspace's shell", () => {
  it("picks button text that reads on the brand colour", () => {
    expect(readableOn("#003A30")).toBe("#FFFFFF");
    expect(readableOn("#C7E738")).toBe("#14161A");
    expect(readableOn("#fff")).toBe("#14161A");
    expect(readableOn("not a colour")).toBe("#FFFFFF");
  });

  it("carries the headline, the link and the notes, escaped, with the brand colour on the button", () => {
    const body = roomActionEmailBody({ headline: "You're invited to <MB2>", bodyHtml: "Hi <strong>Dana</strong>", ctaLabel: "Open the Partner Hub", ctaUrl: "https://partners.example.com/mb2?rt=a&b=1", buttonColor: "#003A30", expiryNote: "Works for 90 days.", footerNote: "You were invited." });
    expect(body).toContain("You&#39;re invited to &lt;MB2&gt;");
    expect(body).toContain("Hi <strong>Dana</strong>");
    expect(body).toContain('href="https://partners.example.com/mb2?rt=a&amp;b=1"');
    expect(body).toContain("background:#003A30");
    expect(body).toContain("color:#FFFFFF");
    expect(body).toContain("Works for 90 days.");
    expect(body).toContain("You were invited.");
    expect(body).not.toContain("{{");
    expect(body).not.toContain("LP Studio");
  });

  it("falls back to a dark button when the colour isn't a hex value", () => {
    expect(roomActionEmailBody({ headline: "h", bodyHtml: "b", ctaLabel: "c", ctaUrl: "https://x.example", buttonColor: "red;}" })).toContain("background:#1A1815");
  });

  it("survives being rendered into a shell", () => {
    const body = roomActionEmailBody({ headline: "Your link", bodyHtml: "Open it.", ctaLabel: "Open", ctaUrl: "https://x.example/hub", buttonColor: "#003A30" });
    const html = renderEmail({ shell: { ...DEFAULT_EMAIL_SHELL, headerBg: "#003A30" }, bodyHtml: body, wrapInShell: true, vars: expandEmailVars({ headline: "Your link" }) });
    expect(html).toContain("https://x.example/hub");
    expect(html).toContain("Your link");
  });
});
