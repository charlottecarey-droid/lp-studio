import { describe, expect, it } from "vitest";
import { needsLine, needsTodo, needsTotal, parseNotifyVia, plainHeadline, reminderEmail, slackLineToHtml, teamNotifyEmail } from "./partnerRoomNotify";

describe("what a hub needs from the account team", () => {
  it("adds up, and says it in words", () => {
    const n = { access: 2, marketing: 3, requests: 1, minutes: 1 };
    expect(needsTotal(n)).toBe(7);
    expect(needsTodo(n)).toBe(6);
    expect(needsLine(n)).toBe("2 people asking for access · 3 programs to send to marketing · 1 new request · 1 set of minutes to review");
    expect(needsLine({ access: 0, marketing: 1, requests: 0, minutes: 0 })).toBe("1 program to send to marketing");
    expect(needsLine({ access: 0, marketing: 0, requests: 0, minutes: 0 })).toBe("");
  });
  it("defaults to Slack", () => {
    expect(parseNotifyVia(undefined)).toBe("slack");
    expect(parseNotifyVia("nope")).toBe("slack");
    expect(parseNotifyVia("email")).toBe("email");
    expect(parseNotifyVia("both")).toBe("both");
  });
});

describe("emails", () => {
  it("turns a Slack line into safe HTML", () => {
    expect(slackLineToHtml("*Dana <b>* chose *Include* & more")).toBe("<b>Dana &lt;b&gt;</b> chose <b>Include</b> &amp; more");
    expect(plainHeadline("🗳️ Marketing plan decision")).toBe("Marketing plan decision");
  });
  it("tells the account owner what the Slack post would have", () => {
    const m = teamNotifyEmail({ hubTitle: "Acme Partner Hub", headline: "📝 New request", lines: ["*Dana* asked: *Extra kits*", ""], hubUrl: "https://hub.example/acme" });
    expect(m.subject).toBe("Acme Partner Hub: New request");
    expect(m.html).toContain("<b>Dana</b> asked: <b>Extra kits</b>");
    expect(m.html).toContain('href="https://hub.example/acme"');
  });
  it("reminds the customer of the next few things, not all of them", () => {
    const m = reminderEmail({ partnerName: "Acme", senderName: "Dandy", by: "Sam Rep", items: ["One", "Two", "Three", "Four", "Five", "Six", "Seven"], hubUrl: "https://hub.example/acme", note: "Hi <team>" });
    expect(m.subject).toBe("Acme × Dandy: 7 things are waiting on you");
    expect(m.html).toContain("Hi &lt;team&gt;");
    expect(m.html).toContain(">Five<");
    expect(m.html).not.toContain(">Six<");
    expect(m.html).toContain("and 2 more");
    expect(reminderEmail({ partnerName: "Acme", senderName: "Dandy", by: "Sam", items: ["One"], hubUrl: "https://x.test" }).subject).toBe("Acme × Dandy: one thing is waiting on you");
  });
});
