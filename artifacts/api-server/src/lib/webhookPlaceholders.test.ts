import { describe, expect, it } from "vitest";
import { isUnresolvedPlaceholder, stripUnresolvedPlaceholders } from "./webhookPlaceholders";

describe("isUnresolvedPlaceholder", () => {
  it("flags Apollo label text and mustache tokens", () => {
    expect(isUnresolvedPlaceholder("<Contact › First name>")).toBe(true);
    expect(isUnresolvedPlaceholder("<account › website / domain>")).toBe(true);
    expect(isUnresolvedPlaceholder(" {{contact.first_name}} ")).toBe(true);
  });

  it("leaves real values alone", () => {
    expect(isUnresolvedPlaceholder("Jane")).toBe(false);
    expect(isUnresolvedPlaceholder("acmedental.com")).toBe(false);
    expect(isUnresolvedPlaceholder("https://partners.meetdandy.com/dso?a=<b>")).toBe(false);
    expect(isUnresolvedPlaceholder(42)).toBe(false);
  });
});

describe("stripUnresolvedPlaceholders", () => {
  it("removes placeholder fields deep in the payload and counts them", () => {
    const { value, stripped } = stripUnresolvedPlaceholders({
      organization: { name: "<Account › Name>", domain: "acme.com" },
      person: { first_name: "<Contact › First name>", title: "Office Manager" },
      visitor: { page_url: "<Website visit › Page URL>" },
    });
    expect(stripped).toBe(3);
    expect(value).toEqual({
      organization: { domain: "acme.com" },
      person: { title: "Office Manager" },
      visitor: {},
    });
  });
});
