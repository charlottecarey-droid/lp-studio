import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, lpPagesTable: {} }));
vi.mock("./logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { accountNameForms, fillTemplateName, isPracticeSite, isTestPracticeSite, practiceSiteMatch, practiceSiteSlug, setRoomPracticeLink } from "./partnerRoomPracticeSite";

describe("finding an account's practice microsite", () => {
  it("looks for the whole name and the name without its generic words", () => {
    expect(accountNameForms("MB2 Dental -HQ")).toEqual(["mb2-dental", "mb2"]);
    expect(accountNameForms("Smile Brands DSO Enterprise Parent")).toEqual(["smile-brands"]);
    expect(accountNameForms("Heartland Dental")).toEqual(["heartland-dental", "heartland"]);
    expect(accountNameForms("DC")).toEqual([]);
  });

  it("matches by Salesforce id first, else by the name as whole words in the title or address", () => {
    const mb2 = { name: "MB2 Dental", sfdcId: "0015d000041HyXrAAK" };
    expect(practiceSiteMatch({ title: "Anything", slug: "x", sfdcAccountId: "0015d000041HyXr" }, mb2)).toBe(3);
    expect(practiceSiteMatch({ title: "MB2 Practices Microsite", slug: "mb2-practices" }, mb2)).toBe(2);
    expect(practiceSiteMatch({ title: "Heartland Sign Up", slug: "hdp", sfdcAccountId: null }, { name: "Heartland Dental-HQ" })).toBe(2);
    // Another customer whose name merely starts the same way is not a match.
    expect(practiceSiteMatch({ title: "Smile Partners USA Landing Page", slug: "smile-partners-usa" }, { name: "Smile Brands" })).toBe(0);
    expect(practiceSiteMatch({ title: "MB20 Practices", slug: "mb20-practices" }, mb2)).toBe(0);
    expect(practiceSiteMatch({ title: "DCA Partner Practices", slug: "dca-practices" }, mb2)).toBe(0);
  });

  it("knows a practice sign-up page by its blocks", () => {
    expect(isPracticeSite([{ type: "nav-header" }, { type: "dso-practice-hero" }])).toBe(true);
    expect(isPracticeSite([{ type: "room-workspace" }])).toBe(false);
    expect(isPracticeSite(null)).toBe(false);
  });
});

describe("drafting one from the template", () => {
  it("writes the account's name wherever the template leaves a blank for it", () => {
    const blocks = [{ type: "dso-practice-hero", props: { eyebrow: "[dso name]  x dandy", headline: "See why 10,000 practices trust Dandy", nested: [{ text: "Welcome, {{account}} teams" }], n: 3 } }];
    expect(fillTemplateName(blocks, "Cedar Dental")).toEqual([{ type: "dso-practice-hero", props: { eyebrow: "Cedar Dental  x dandy", headline: "See why 10,000 practices trust Dandy", nested: [{ text: "Welcome, Cedar Dental teams" }], n: 3 } }]);
    expect(practiceSiteSlug("MB2 Dental -HQ")).toBe("mb2-dental-practices");
    // A microsite drafted by a test run is recognisable, so a real hub never links to it.
    expect(isTestPracticeSite("mb2-dental-practices-test")).toBe(true);
    expect(isTestPracticeSite("mb2-dental-practices-test-2")).toBe(true);
    expect(isTestPracticeSite("mb2-practices")).toBe(false);
  });

  it("puts the microsite first in the hub's launch-kit links, once", () => {
    const hub = [{ type: "room-workspace", props: { links: [{ title: "Success Plan", url: "https://x.example/plan" }] } }];
    const next = setRoomPracticeLink(hub, { url: "https://partners.example.com/cedar-dental-practices", short: "Cedar" })!;
    const links = (next[0] as { props: { links: { key?: string; title: string; url: string; description?: string }[] } }).props.links;
    expect(links[0]).toEqual({ key: "practice-site", title: "Cedar practice sign-up page", description: "partners.example.com/cedar-dental-practices", url: "https://partners.example.com/cedar-dental-practices" });
    expect(links).toHaveLength(2);
    // Running it again with a new address replaces the entry rather than adding another.
    const again = setRoomPracticeLink(next, { url: "https://partners.example.com/cedar-2", short: "Cedar" })!;
    expect((again[0] as { props: { links: unknown[] } }).props.links).toHaveLength(2);
    // A link someone typed by hand to the same page is left as it is.
    const byHand = [{ type: "room-workspace", props: { links: [{ title: "Sign up here", url: "https://partners.example.com/cedar" }] } }];
    expect(setRoomPracticeLink(byHand, { url: "https://partners.example.com/cedar", short: "Cedar" })).toEqual(byHand);
    expect(setRoomPracticeLink([{ type: "hero" }], { url: "https://x", short: "X" })).toBeNull();
  });
});
