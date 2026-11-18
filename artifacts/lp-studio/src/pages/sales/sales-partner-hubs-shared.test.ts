import { describe, expect, it } from "vitest";
import { filterHubs, sortHubs, type HubRow } from "./sales-partner-hubs-shared";

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
