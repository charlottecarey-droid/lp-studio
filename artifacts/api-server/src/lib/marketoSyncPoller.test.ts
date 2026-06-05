import { describe, it, expect } from "vitest";
import { parseScheduledSyncState, planResume } from "./marketo-service";

describe("parseScheduledSyncState", () => {
  it("reads a well-formed resume cursor out of metadata", () => {
    expect(parseScheduledSyncState({ scheduledSync: { listId: "123", cursor: "TOKEN==" } })).toEqual({
      listId: "123",
      cursor: "TOKEN==",
    });
  });

  it("preserves sibling metadata keys (only reads scheduledSync)", () => {
    expect(
      parseScheduledSyncState({ activityTypeIds: [1, 2], scheduledSync: { listId: "9", cursor: "abc" } }),
    ).toEqual({ listId: "9", cursor: "abc" });
  });

  it("fails closed (null) for missing / empty / partial / malformed state", () => {
    expect(parseScheduledSyncState(null)).toBeNull();
    expect(parseScheduledSyncState(undefined)).toBeNull();
    expect(parseScheduledSyncState({})).toBeNull();
    expect(parseScheduledSyncState({ scheduledSync: null })).toBeNull();
    expect(parseScheduledSyncState({ scheduledSync: { listId: "123" } })).toBeNull(); // no cursor
    expect(parseScheduledSyncState({ scheduledSync: { cursor: "abc" } })).toBeNull(); // no listId
    expect(parseScheduledSyncState({ scheduledSync: { listId: "", cursor: "abc" } })).toBeNull(); // empty listId
    expect(parseScheduledSyncState({ scheduledSync: { listId: "1", cursor: "" } })).toBeNull(); // empty cursor
    expect(parseScheduledSyncState({ scheduledSync: { listId: 1, cursor: 2 } })).toBeNull(); // wrong types
  });
});

describe("planResume", () => {
  const lists = [{ marketoId: "a" }, { marketoId: "b" }, { marketoId: "c" }];

  it("visits every list from the top when there is no resume state", () => {
    expect(planResume(lists, null)).toEqual([
      { listId: "a" },
      { listId: "b" },
      { listId: "c" },
    ]);
  });

  it("resumes the saved list from its cursor and skips earlier lists", () => {
    expect(planResume(lists, { listId: "b", cursor: "TOK" })).toEqual([
      { listId: "b", startCursor: "TOK" },
      { listId: "c" },
    ]);
  });

  it("resumes the first list in place (no lists skipped)", () => {
    expect(planResume(lists, { listId: "a", cursor: "TOK" })).toEqual([
      { listId: "a", startCursor: "TOK" },
      { listId: "b" },
      { listId: "c" },
    ]);
  });

  it("resumes the last list, leaving only it", () => {
    expect(planResume(lists, { listId: "c", cursor: "TOK" })).toEqual([
      { listId: "c", startCursor: "TOK" },
    ]);
  });

  it("fails closed to a full re-scan when the saved list no longer exists", () => {
    expect(planResume(lists, { listId: "gone", cursor: "TOK" })).toEqual([
      { listId: "a" },
      { listId: "b" },
      { listId: "c" },
    ]);
  });

  it("returns an empty plan for an empty list set", () => {
    expect(planResume([], null)).toEqual([]);
    expect(planResume([], { listId: "a", cursor: "x" })).toEqual([]);
  });
});
