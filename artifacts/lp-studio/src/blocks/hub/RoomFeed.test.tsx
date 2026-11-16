import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FEED_REACTIONS, matchPeople, mentionKeys, mentionQuery, reactionsOf, splitMentions, WinsView } from "./RoomFeed";
import type { RoomSnapshot, RoomWin } from "./room-client";

const PEOPLE = [
  { key: "k-dana", name: "Dana Lee" },
  { key: "k-dan", name: "Dan Ortiz" },
  { key: "k-sam", name: "Sam Rep" },
];

describe("room feed: mentions", () => {
  it("finds the @name being typed before the caret", () => {
    expect(mentionQuery("Thanks @da", 10)).toEqual({ from: 7, q: "da" });
    expect(mentionQuery("@", 1)).toEqual({ from: 0, q: "" });
    expect(mentionQuery("Thanks @Dana L", 14)).toEqual({ from: 7, q: "dana l" });
    expect(mentionQuery("Thanks @Dana Lee for", 20)).toBeNull();
    expect(mentionQuery("mail me at a@b.com", 18)).toBeNull();
    expect(mentionQuery("Thanks @da and more", 10)).toEqual({ from: 7, q: "da" });
  });

  it("suggests people by name, names that start with it first", () => {
    expect(matchPeople(PEOPLE, "da").map((p) => p.name)).toEqual(["Dan Ortiz", "Dana Lee"]);
    expect(matchPeople(PEOPLE, "rep").map((p) => p.name)).toEqual(["Sam Rep"]);
    expect(matchPeople(PEOPLE, "zz")).toEqual([]);
    expect(matchPeople(PEOPLE, "", 2)).toHaveLength(2);
  });

  it("sends only the people whose @name is still in the text", () => {
    expect(mentionKeys("Thanks @Dana Lee!", [PEOPLE[0], PEOPLE[2], PEOPLE[0]])).toEqual(["k-dana"]);
    expect(mentionKeys("Thanks all", PEOPLE)).toEqual([]);
  });

  it("splits text so tagged names can be highlighted, longest name first", () => {
    expect(splitMentions("Hi @Dana Lee and @Dan Ortiz.", ["Dan Ortiz", "Dana Lee"])).toEqual([
      { text: "Hi ", tag: false },
      { text: "@Dana Lee", tag: true },
      { text: " and ", tag: false },
      { text: "@Dan Ortiz", tag: true },
      { text: ".", tag: false },
    ]);
    expect(splitMentions("Hi @Dana Lee", [])).toEqual([{ text: "Hi @Dana Lee", tag: false }]);
    expect(splitMentions("a (b) @C+ D", ["C+ D"])).toEqual([{ text: "a (b) ", tag: false }, { text: "@C+ D", tag: true }]);
  });
});

describe("room feed: reactions", () => {
  it("uses the server's reactions, or shows an older like count as hearts", () => {
    expect(reactionsOf({ reactions: [{ emoji: "🎉", count: 2, mine: true }], likes: 2, liked: true })).toEqual([{ emoji: "🎉", count: 2, mine: true }]);
    expect(reactionsOf({ likes: 3, liked: false })).toEqual([{ emoji: FEED_REACTIONS[0], count: 3, mine: false }]);
    expect(reactionsOf({ likes: 0, liked: false })).toEqual([]);
  });
});

describe("room feed: rendering", () => {
  const win: RoomWin = {
    id: 1,
    body: "Huge week, thank you @Dana Lee 🎉",
    headline: null,
    region: null,
    side: "team",
    by: "Sam Rep",
    createdAt: "2026-11-10T12:00:00Z",
    likes: 3,
    liked: true,
    images: ["/api/storage/objects/uploads/a", "/api/storage/objects/uploads/b"],
    mentions: ["Dana Lee"],
    reactions: [
      { emoji: "❤️", count: 1, mine: false },
      { emoji: "🎉", count: 2, mine: true },
    ],
    comments: [{ id: 5, body: "Well done @Sam Rep", mentions: ["Sam Rep"], side: "customer", by: "Dana Lee", createdAt: "2026-11-10T13:00:00Z" }],
  };
  const snapshot = { status: "ready", viewer: { email: "x@y.com", name: "X" }, wins: [win], people: PEOPLE } as unknown as RoomSnapshot;
  const html = renderToStaticMarkup(createElement(WinsView, { snapshot, store: null, isEditor: false, onNeedEmail: () => {}, display: "serif" }));

  it("shows the composer's photo, emoji and mention tools", () => {
    expect(html).toContain("data-room-win-compose");
    expect(html).toContain("data-room-add-photo");
    expect(html).toContain('data-room-emoji="write"');
    expect(html).toContain("data-room-add-mention");
  });

  it("shows a post's photos, highlighted tags and reaction counts", () => {
    expect(html).toContain('data-room-photos="2"');
    expect(html.match(/data-room-mention/g)).toHaveLength(2);
    expect(html).toContain("@Dana Lee</span>");
    expect(html).toContain('data-room-reaction="🎉"');
    expect(html).toMatch(/data-room-reaction="🎉"[^>]*>.*?2/);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-room-emoji="react"');
  });

  it("renders a photo-only post without an empty text block", () => {
    const only = renderToStaticMarkup(createElement(WinsView, { snapshot: { ...snapshot, wins: [{ ...win, body: "", mentions: [], comments: [] }] } as RoomSnapshot, store: null, isEditor: false, onNeedEmail: () => {}, display: "serif" }));
    expect(only).not.toContain('class="wb"');
    expect(only).toContain('data-room-photos="2"');
  });
});
