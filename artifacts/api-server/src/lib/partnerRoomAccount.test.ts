import { describe, expect, it } from "vitest";
import { ROOM_LOGO_TASK_KEY, extractRoomTasks, isLogoImage, parseRoomAccount, parseRoomTeam, roomAccountInfo, roomLogoTask, setRoomProps } from "./partnerRoom";

const blocks = [
  { type: "hero", props: { headline: "Hi" } },
  { type: "room-workspace", props: { partnerName: "Acme Dental", title: "launch plan", partnerLogoScale: 100, assets: [{ key: "a" }], team: [{ title: "Our team", members: [{ name: "Sam Lee", role: "AE" }] }] } },
];

describe("hub account settings from the pop-up", () => {
  it("returns only the keys that were sent, cleaned", () => {
    const parsed = parseRoomAccount({ partnerName: "  Acme Dental Group ", partnerLogoScale: 999, look: "nope", kickoffDate: "2026-12-01", rolloutDays: "120", requireEmail: true });
    expect(parsed).toEqual({ ok: true, value: { partnerName: "Acme Dental Group", partnerLogoScale: 300, look: "classic", kickoffDate: "2026-12-01", rolloutDays: 120, requireEmail: true } });
  });

  it("refuses a blank name, a bad date, and addresses that are not pictures or links", () => {
    expect(parseRoomAccount({ partnerName: " " }).ok).toBe(false);
    expect(parseRoomAccount({ kickoffDate: "next week" }).ok).toBe(false);
    expect(parseRoomAccount({ partnerLogoUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(parseRoomAccount({ heroImageUrl: "/api/storage/../secret" }).ok).toBe(false);
    expect(parseRoomAccount({ scheduleUrl: "calendly.com/sam" }).ok).toBe(false);
    expect(parseRoomAccount({ partnerLogoUrl: "/api/storage/objects/uploads/abc", scheduleUrl: "https://calendly.com/sam", heroImageUrl: "" })).toMatchObject({ ok: true });
  });

  it("changes the hub block only, and leaves its other props alone", () => {
    const parsed = parseRoomAccount({ partnerName: "Acme Dental Group", partnerLogoScale: 150 });
    const next = setRoomProps(blocks, parsed.ok ? parsed.value : {})!;
    expect(next[0]).toBe(blocks[0]);
    expect((next[1] as { props: Record<string, unknown> }).props).toMatchObject({ partnerName: "Acme Dental Group", partnerLogoScale: 150, title: "launch plan", assets: [{ key: "a" }] });
    expect(roomAccountInfo(next)!.account).toEqual({ partnerName: "Acme Dental Group", partnerLogoScale: 150 });
    expect(setRoomProps([{ type: "hero" }], {})).toBeNull();
  });
});

describe("hub team from the pop-up", () => {
  it("keeps named people with their details, and drops blanks", () => {
    const parsed = parseRoomTeam({ teamNote: " Who to call ", team: [{ title: "Our team", members: [{ name: "Sam Lee", role: "AE", email: "sam@example.com", bookingUrl: "https://calendly.com/sam", phone: "", hidden: true }, { name: "  " }] }] });
    expect(parsed).toEqual({ ok: true, value: { teamNote: "Who to call", team: [{ title: "Our team", members: [{ name: "Sam Lee", role: "AE", email: "sam@example.com", bookingUrl: "https://calendly.com/sam", hidden: true }] }] } });
  });

  it("says who has a bad email or booking link", () => {
    const bad = parseRoomTeam({ team: [{ title: "Our team", members: [{ name: "Sam Lee", email: "sam at example" }] }] });
    expect(bad).toEqual({ ok: false, error: "Sam Lee's email doesn't look right." });
    expect(parseRoomTeam({ team: [{ title: "T", members: [{ name: "Jo", bookingUrl: "javascript:x" }] }] }).ok).toBe(false);
  });

  it("reads the stored team back", () => {
    expect(roomAccountInfo(blocks)!.team).toEqual({ teamNote: "", team: [{ title: "Our team", members: [{ name: "Sam Lee", role: "AE" }] }] });
  });
});

describe("the customer's logo", () => {
  const hub = (steps: unknown[]) => [{ type: "room-workspace", props: { onboarding: { steps }, planGroups: [] } }];

  it("files a logo under the Overview's logo step where the hub has one", () => {
    const tasks = extractRoomTasks(hub([{ key: "onboard-logo", title: "Upload your logo", action: "upload" }]));
    expect(tasks.has(ROOM_LOGO_TASK_KEY)).toBe(false);
    expect(roomLogoTask(tasks)).toMatchObject({ key: "onboard-logo", action: "upload" });
  });

  it("still takes a logo on a hub with no logo step, without adding to its task list", () => {
    const tasks = extractRoomTasks(hub([{ key: "onboard-team", title: "Add your team", action: "team" }]));
    expect(tasks.has(ROOM_LOGO_TASK_KEY)).toBe(false);
    expect(roomLogoTask(tasks)).toEqual({ key: ROOM_LOGO_TASK_KEY, title: "Upload your logo", action: "upload" });
  });

  it("only treats pictures as a logo", () => {
    expect(isLogoImage("image/png")).toBe(true);
    expect(isLogoImage("image/jpeg")).toBe(true);
    expect(isLogoImage("application/pdf")).toBe(false);
    expect(isLogoImage("application/zip")).toBe(false);
  });
});
