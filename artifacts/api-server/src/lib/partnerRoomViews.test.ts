import { describe, expect, it } from "vitest";
import { hubIsMine, hubSetupItems, hubSetupState, parseRoomView, sameSfdcId, summarizeRoomViews, visitsFromViews, VIEW_MAX_SECONDS, type RoomViewRow } from "./partnerRoomViews";

const at = (iso: string) => new Date(iso);
const row = (o: Partial<RoomViewRow> & { createdAt: Date }): RoomViewRow => ({ sessionId: "sess-0001", module: "overview", seconds: 0, viewerEmail: null, viewerName: null, ...o });

describe("parseRoomView", () => {
  const ok = { pageId: 7, viewId: "view-12345678", sessionId: "sess-12345678", module: "practices", seconds: 12.9 };
  it("accepts a section opening and floors the seconds", () => {
    expect(parseRoomView(ok)).toEqual({ ...ok, seconds: 12 });
  });
  it("caps the time one opening can count for", () => {
    expect(parseRoomView({ ...ok, seconds: 99_999 })?.seconds).toBe(VIEW_MAX_SECONDS);
    expect(parseRoomView({ ...ok, seconds: -5 })?.seconds).toBe(0);
  });
  it("refuses anything that is not a report", () => {
    expect(parseRoomView(null)).toBeNull();
    expect(parseRoomView({ ...ok, pageId: "7" })).toBeNull();
    expect(parseRoomView({ ...ok, module: "Over view" })).toBeNull();
    expect(parseRoomView({ ...ok, viewId: "x" })).toBeNull();
    expect(parseRoomView({ ...ok, sessionId: "a b c d e f g h" })).toBeNull();
  });
});

describe("visits", () => {
  const rows: RoomViewRow[] = [
    row({ createdAt: at("2026-11-10T10:00:00Z"), viewerEmail: "ana@mb2.com", viewerName: "Ana Ruiz", seconds: 60 }),
    row({ createdAt: at("2026-11-10T10:01:00Z"), viewerEmail: "ana@mb2.com", module: "practices", seconds: 120 }),
    // Same person, hours later: a second visit.
    row({ createdAt: at("2026-11-10T15:00:00Z"), viewerEmail: "ana@mb2.com", module: "marketing", seconds: 30 }),
    // Two unnamed sessions.
    row({ createdAt: at("2026-11-11T09:00:00Z"), sessionId: "sess-anon-1", seconds: 10 }),
    row({ createdAt: at("2026-11-11T09:05:00Z"), sessionId: "sess-anon-2", seconds: 5 }),
  ];

  it("splits one person's openings into visits by the gap between them", () => {
    const visits = visitsFromViews(rows).filter((v) => v.email === "ana@mb2.com");
    expect(visits).toHaveLength(2);
    expect(visits[1]).toMatchObject({ name: "Ana Ruiz", seconds: 180, modules: ["overview", "practices"] });
    expect(visits[0]).toMatchObject({ seconds: 30, modules: ["marketing"] });
  });

  it("summarises people, sections and days", () => {
    const s = summarizeRoomViews(rows, { days: 7, now: at("2026-11-12T12:00:00Z") });
    expect(s).toMatchObject({ visits: 4, visitors: 3, named: 1, anonymous: 2, seconds: 225 });
    expect(s.people).toHaveLength(1);
    expect(s.people[0]).toMatchObject({ email: "ana@mb2.com", name: "Ana Ruiz", visits: 2, seconds: 210 });
    expect(s.people[0].modules[0]).toEqual({ module: "practices", opens: 1, seconds: 120 });
    expect(s.modules[0]).toEqual({ module: "overview", opens: 3, people: 3, seconds: 75 });
    expect(s.days).toHaveLength(7);
    expect(s.days.find((d) => d.date === "2026-11-10")).toEqual({ date: "2026-11-10", visits: 2, visitors: 1 });
    expect(s.days.find((d) => d.date === "2026-11-11")).toEqual({ date: "2026-11-11", visits: 2, visitors: 2 });
    expect(s.recent[0].startedAt).toBe("2026-11-11T09:05:00.000Z");
    expect(s.recent[0]).not.toHaveProperty("key");
  });

  it("is empty without rows", () => {
    expect(summarizeRoomViews([], { days: 7 })).toMatchObject({ visits: 0, visitors: 0, lastAt: null, people: [], modules: [], recent: [] });
  });
});

describe("hub list helpers", () => {
  it("matches 15 and 18 character Salesforce ids", () => {
    expect(sameSfdcId("0015d000041HyXr", "0015d000041HyXrAAK")).toBe(true);
    expect(sameSfdcId("0015d000041HyXr", "0015d000041HyXs")).toBe(false);
    expect(sameSfdcId("", "")).toBe(false);
    expect(sameSfdcId(null, "0015d000041HyXr")).toBe(false);
  });
  it("knows a rep's own hubs", () => {
    const me = { email: "Sam@Dandy.com", name: "Sam Lee" };
    expect(hubIsMine(me, { accountOwner: "sam lee" })).toBe(true);
    expect(hubIsMine(me, { updatedBy: "sam@dandy.com" })).toBe(true);
    expect(hubIsMine(me, { teamEmails: ["x@dandy.com", "SAM@dandy.com"] })).toBe(true);
    expect(hubIsMine(me, { accountOwner: "Jo Park", createdBy: "automatic rooms", teamEmails: [] })).toBe(false);
    expect(hubIsMine({}, { accountOwner: "" })).toBe(false);
  });
});

describe("setup checklist", () => {
  it("reads what is left from the hub as it is now", () => {
    const fresh = hubSetupItems({ team: [{ members: [{ name: "Sam Lee" }] }, { members: [{ name: "[Name]" }] }], assets: [{ kind: "pdf", title: "Guide", fileUrl: "/api/storage/x.pdf" }] }, { published: false, invited: 0 });
    expect(fresh.map((i) => [i.key, i.done])).toEqual([["logo", false], ["kickoff", false], ["ourTeam", true], ["team", false], ["kit", false], ["slack", false], ["publish", false], ["invite", false]]);
    const ready = hubSetupItems(
      { partnerLogoUrl: "/logo.png", kickoffDate: "2026-11-03", team: [{ members: [{ name: "Sam Lee" }] }, { members: [{ name: "Ana Ruiz" }, { name: "Hidden", hidden: true }] }], assets: [{ fileUrl: "/a.pdf" }, { fileUrl: "/b.png" }, { fileUrl: "/c.png", hidden: true }] },
      { published: true, invited: 3, slackLinked: true },
    );
    expect(ready.every((i) => i.done)).toBe(true);
    expect(ready.find((i) => i.key === "ourTeam")?.title).toBe("Check your team (1 listed)");
    expect(ready.find((i) => i.key === "team")?.title).toBe("Check the customer's team (1 listed)");
    expect(ready.find((i) => i.key === "invite")?.title).toBe("Invite the customer (3 invited)");
  });
  it("says whether a hub is in setup, ready to share, or shared", () => {
    const step = (where: "account" | "publish" | "invite", done: boolean) => ({ where, done });
    expect(hubSetupState([step("account", false), step("publish", false), step("invite", false)])).toEqual({ state: "setup", left: 1, total: 3 });
    expect(hubSetupState([step("account", true), step("publish", false), step("invite", false)])).toEqual({ state: "ready", left: 2, total: 3 });
    expect(hubSetupState([step("account", true), step("publish", true), step("invite", true)])).toEqual({ state: "shared", left: 0, total: 3 });
  });
  it("survives a hub with no content", () => {
    expect(hubSetupItems(null, { published: false, invited: 0 }).filter((i) => i.done)).toEqual([]);
  });
});
