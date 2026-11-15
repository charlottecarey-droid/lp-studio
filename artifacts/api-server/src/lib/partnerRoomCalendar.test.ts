import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, lpRoomEventsTable: {}, lpRoomSettingsTable: {} }));
vi.mock("./slack-service", () => ({ slackService: { postMessage: vi.fn(async () => true) } }));

import { cleanMinutes, googleDocText, minutesAreEmpty, minutesFromModel, roomEventsFromGoogle, CALENDAR_ID_RE } from "./partnerRoomCalendar";
import { roomCalendarIcs } from "./partnerRoom";

const DOC = "application/vnd.google-apps.document";
const ITEMS = [
  { id: "e1", summary: "MB2 weekly sync", start: { dateTime: "2027-01-12T20:00:00Z" }, end: { dateTime: "2027-01-12T20:30:00Z" }, attendees: [{ email: "rep@dandy.com", displayName: "Sam Rep" }, { email: "levi.stone@MB2Dental.com" }, { email: "room-4@resource.calendar.google.com", resource: true }], attachments: [{ fileId: "1AbCdEfGhIjKlMnOp", title: "MB2 weekly sync - Notes by Gemini", mimeType: DOC }, { fileId: "9ZyXwVuTsRqPoNmLk", title: "Deck", mimeType: "application/vnd.google-apps.presentation" }] },
  { id: "e2", summary: "Internal: MB2 deal strategy", start: { dateTime: "2027-01-13T15:00:00Z" }, attendees: [{ email: "rep@dandy.com" }, { email: "boss@dandy.com" }] },
  { id: "e3", summary: "Cancelled sync", status: "cancelled", start: { dateTime: "2027-01-14T15:00:00Z" }, attendees: [{ email: "levi@mb2dental.com" }] },
  { id: "e4", summary: "Private thing", visibility: "private", start: { dateTime: "2027-01-15T15:00:00Z" }, attendees: [{ email: "levi@mb2dental.com" }] },
  { id: "e5", summary: "Launch day", start: { date: "2027-02-01" }, end: { date: "2027-02-02" }, attendees: [{ email: "dana@mb2dental.com", displayName: "dana@mb2dental.com" }] },
  { id: "e6", summary: "Other customer", start: { dateTime: "2027-01-16T15:00:00Z" }, attendees: [{ email: "x@otherdso.com" }] },
  { id: "e1", summary: "Duplicate", start: { dateTime: "2027-01-12T20:00:00Z" }, attendees: [{ email: "levi@mb2dental.com" }] },
];

describe("which calendar events a room shows", () => {
  it("keeps only live, non-private events with a guest at the customer's domain", () => {
    const out = roomEventsFromGoogle(ITEMS, ["@mb2dental.com"]);
    expect(out.map((e) => e.externalId)).toEqual(["e1", "e5"]);
    expect(out[0]).toMatchObject({ title: "MB2 weekly sync", allDay: false, notesFileId: "1AbCdEfGhIjKlMnOp" });
    expect(out[0].startsAt.toISOString()).toBe("2027-01-12T20:00:00.000Z");
    // Guest names only, never addresses or rooms.
    expect(out[0].attendees).toBe("Sam Rep, Levi Stone");
    expect(out[1]).toMatchObject({ allDay: true, notesFileId: null, attendees: "Dana" });
  });
  it("shows nothing without a customer domain or with junk input", () => {
    expect(roomEventsFromGoogle(ITEMS, [])).toEqual([]);
    expect(roomEventsFromGoogle(null, ["mb2dental.com"])).toEqual([]);
    expect(roomEventsFromGoogle([null, {}, { id: "x" }], ["mb2dental.com"])).toEqual([]);
  });
  it("accepts calendar ids and rejects anything that could change the request path", () => {
    expect(CALENDAR_ID_RE.test("primary")).toBe(true);
    expect(CALENDAR_ID_RE.test("c_abc123@group.calendar.google.com")).toBe(true);
    expect(CALENDAR_ID_RE.test("a/b?x=1")).toBe(false);
  });
});

describe("minutes", () => {
  it("reads a Google Doc's text, tables included", () => {
    const doc = { body: { content: [{ paragraph: { elements: [{ textRun: { content: "Summary\n" } }, { textRun: { content: "Wave one is live.\n" } }] } }, { table: { tableRows: [{ tableCells: [{ content: [{ paragraph: { elements: [{ textRun: { content: "Send roster\n" } }] } }] }] }] } }] } };
    expect(googleDocText(doc)).toBe("Summary\nWave one is live.\nSend roster");
    expect(googleDocText(null)).toBe("");
  });
  it("cleans what the model or a person sends", () => {
    const m = cleanMinutes({ summary: "  Wave one is live.  ", decisions: ["Start with Texas", "", 7], actions: [{ text: "Send the roster", owner: "Levi", due: "Feb 2" }, { text: "" }, { text: "Book trainers", done: true, extra: "x" }, "nope"] });
    expect(m).toEqual({ summary: "Wave one is live.", decisions: ["Start with Texas"], actions: [{ text: "Send the roster", owner: "Levi", due: "Feb 2" }, { text: "Book trainers", done: true }] });
    expect(minutesAreEmpty(cleanMinutes({}))).toBe(true);
    expect(minutesAreEmpty(m)).toBe(false);
  });
  it("parses the model's reply, fenced or not, and rejects an empty or broken one", () => {
    expect(minutesFromModel('```json\n{"summary":"Done.","decisions":[],"actions":[]}\n```')?.summary).toBe("Done.");
    expect(minutesFromModel('{"summary":"","decisions":[],"actions":[]}')).toBeNull();
    expect(minutesFromModel("Sorry, I can't")).toBeNull();
    expect(minutesFromModel(null)).toBeNull();
  });
});

describe("calendar feed with synced meetings", () => {
  it("adds synced meetings with their real times", () => {
    const ics = roomCalendarIcs([{ type: "room-workspace", props: {} }], "MB2", [{ id: 7, title: "MB2 weekly sync", startsAt: "2027-01-12T20:00:00.000Z", endsAt: "2027-01-12T20:30:00.000Z", allDay: false }, { id: 8, title: "Launch day", startsAt: "2027-02-01T00:00:00.000Z", endsAt: null, allDay: true }])!;
    expect(ics).toContain("UID:meeting-7@partner-room");
    expect(ics).toContain("DTSTART:20270112T200000Z");
    expect(ics).toContain("DTEND:20270112T203000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20270201");
    expect(ics).toContain("DTEND;VALUE=DATE:20270202");
  });
});
