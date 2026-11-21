import { describe, expect, it } from "vitest";
import { filterHubs, hubFlags, hubLandingTab, needsLine, sortHubs, type HubRow } from "./sales-partner-hubs-shared";

const hub = (o: Partial<HubRow>): HubRow => ({ pageId: 1, title: "A Partner Hub", name: "A", slug: "a-hub", status: "draft", url: "", account: null, day: null, waitingOnCustomer: 0, waitingOnUs: 0, views30: 0, people30: 0, lastVisitAt: null, mine: false, test: false, updatedAt: "2026-11-01T00:00:00.000Z", ...o });

describe("partner hubs table", () => {
  const hubs = [
    hub({ pageId: 1, name: "Old other", updatedAt: "2026-11-01T00:00:00.000Z" }),
    hub({ pageId: 2, name: "New other", updatedAt: "2026-11-10T00:00:00.000Z" }),
    hub({ pageId: 3, name: "Mine", mine: true, updatedAt: "2026-10-01T00:00:00.000Z", account: { id: 9, name: "MB2 Dental", owner: "Sam Lee" } }),
    hub({ pageId: 4, name: "Ladd", mine: true, test: true, updatedAt: "2026-11-16T00:00:00.000Z" }),
  ];
  it("puts the rep's own hubs first, newest next, test hubs last", () => {
    expect(sortHubs(hubs).map((h) => h.pageId)).toEqual([3, 2, 1, 4]);
  });
  it("filters to mine and by a search over hub, account and owner", () => {
    expect(filterHubs(hubs, { scope: "mine", q: "" }).map((h) => h.pageId)).toEqual([3, 4]);
    expect(filterHubs(hubs, { scope: "all", q: "mb2" }).map((h) => h.pageId)).toEqual([3]);
    expect(filterHubs(hubs, { scope: "all", q: " SAM " }).map((h) => h.pageId)).toEqual([3]);
    expect(filterHubs(hubs, { scope: "all", q: "nothing" })).toEqual([]);
  });
});

describe("what a hub needs, and when it is going quiet", () => {
  const NOW = new Date("2026-11-21T12:00:00Z");
  it("opens on what needs the rep", () => {
    expect(hubLandingTab({ needs: { access: 0, marketing: 2, requests: 0, minutes: 1 } })).toBe("activity");
    expect(hubLandingTab({ needs: { access: 0, marketing: 0, requests: 0, minutes: 1 } })).toBe("calendar");
    expect(hubLandingTab({ needs: { access: 0, marketing: 0, requests: 0, minutes: 0 } })).toBe("performance");
    expect(hubLandingTab({})).toBe("performance");
  });
  it("says what is waiting in words", () => {
    expect(needsLine({ access: 1, marketing: 3, requests: 0, minutes: 0 })).toBe("1 person asking for access · 3 programs to send to marketing");
    expect(needsLine(undefined)).toBe("");
  });
  it("flags a live hub nobody visits or with no practices, never a draft or a test hub", () => {
    const live = { status: "live" as const, test: false, practices: { total: 40, live: 3 } };
    expect(hubFlags({ ...live, lastVisitAt: "2026-11-20T12:00:00Z" }, NOW)).toEqual([]);
    expect(hubFlags({ ...live, lastVisitAt: "2026-11-01T12:00:00Z" }, NOW)).toEqual(["No visit in 20 days"]);
    expect(hubFlags({ ...live, lastVisitAt: null, practices: null }, NOW)).toEqual(["Never visited", "No practices loaded"]);
    expect(hubFlags({ ...live, status: "draft", lastVisitAt: null }, NOW)).toEqual([]);
    expect(hubFlags({ ...live, test: true, lastVisitAt: null }, NOW)).toEqual([]);
    expect(hubFlags({ ...live, archived: true, lastVisitAt: null }, NOW)).toEqual([]);
  });
});
