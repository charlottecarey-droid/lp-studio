import { describe, expect, it } from "vitest";
import { buildRoomPeople, countReactions, feedAlertEmail, feedAlertsFor, parseReaction, parseWinImages, personKey, resolveMentions, teamPeopleFromBlocks } from "./partnerRoomFeed";

const IMG = (n: number) => `/api/storage/objects/uploads/0000000${n}-aaaa-bbbb-cccc-0123456789ab`;

describe("wins feed: reactions", () => {
  it("defaults to the heart and refuses anything we don't offer", () => {
    expect(parseReaction(undefined)).toBe("❤️");
    expect(parseReaction("🎉")).toBe("🎉");
    expect(parseReaction("💩")).toBeNull();
    expect(parseReaction(7)).toBeNull();
  });

  it("counts per emoji, marks the viewer's own, and skips unused ones", () => {
    const rows = [
      { emoji: "🎉", email: "a@x.com" },
      { emoji: "🎉", email: "b@x.com" },
      { emoji: "❤️", email: "b@x.com" },
    ];
    expect(countReactions(rows, "a@x.com")).toEqual([
      { emoji: "❤️", count: 1, mine: false },
      { emoji: "🎉", count: 2, mine: true },
    ]);
    expect(countReactions(rows, null).every((r) => !r.mine)).toBe(true);
  });
});

describe("wins feed: photos", () => {
  it("keeps only files we host, at most four, no repeats", () => {
    expect(parseWinImages([IMG(1), IMG(1), "https://evil.example/x.png", "/api/storage/objects/room-uploads/00000001-aaaa-bbbb-cccc-0123456789ab", "javascript:alert(1)", 5, IMG(2)])).toEqual([IMG(1), IMG(2)]);
    expect(parseWinImages([IMG(1), IMG(2), IMG(3), IMG(4), IMG(5)])).toHaveLength(4);
    expect(parseWinImages("nope")).toEqual([]);
  });
});

describe("wins feed: tagging people", () => {
  const people = buildRoomPeople(9, [
    { name: "Dana Lee", email: "Dana@Partner.com" },
    { name: "Someone Else", email: "dana@partner.com" },
    { name: "", email: "noname@partner.com" },
    { name: "No Address", email: "" },
    { name: "Sam Rep", email: "sam@vendor.com" },
  ]);

  it("builds one entry per address with a key that hides the address", () => {
    expect(people.map((p) => p.name)).toEqual(["Dana Lee", "Sam Rep"]);
    expect(people[0].key).toMatch(/^[0-9a-f]{16}$/);
    expect(people[0].key).toBe(personKey(9, "dana@partner.com"));
    expect(personKey(10, "dana@partner.com")).not.toBe(people[0].key);
  });

  it("tags only people in this room whose @name is still in the text", () => {
    const [dana, sam] = people;
    expect(resolveMentions("Great work @Dana Lee!", [dana.key, sam.key, "made-up", dana.key], people)).toEqual([dana]);
    expect(resolveMentions("Great work @dana lee and @Sam Rep", [dana.key, sam.key], people)).toEqual([dana, sam]);
    expect(resolveMentions("@Dana Lee", "not-a-list", people)).toEqual([]);
  });

  it("reads named people with an address from the Team module, skipping hidden ones", () => {
    const blocks = [
      { type: "hero", props: {} },
      {
        type: "room-workspace",
        props: {
          team: [
            { title: "Us", members: [{ name: "Sam Rep", email: "sam@vendor.com" }, { name: "Hidden", email: "h@vendor.com", hidden: true }, { name: "No email" }] },
            { title: "Off", hidden: true, members: [{ name: "Nope", email: "n@vendor.com" }] },
          ],
        },
      },
    ];
    expect(teamPeopleFromBlocks(blocks)).toEqual([{ name: "Sam Rep", email: "sam@vendor.com" }]);
    expect(teamPeopleFromBlocks(null)).toEqual([]);
  });
});

describe("wins feed: alerts", () => {
  const dana = { key: "k1", name: "Dana Lee", email: "dana@partner.com" };
  const sam = { key: "k2", name: "Sam Rep", email: "sam@vendor.com" };

  it("emails everyone tagged in a post except the writer", () => {
    expect(feedAlertsFor({ authorEmail: "Sam@vendor.com", mentioned: [dana, sam], comment: false })).toEqual([{ email: "dana@partner.com", kind: "mention_post" }]);
  });

  it("a comment also tells the person who shared the win, once, and never the commenter", () => {
    expect(feedAlertsFor({ authorEmail: "sam@vendor.com", mentioned: [], comment: true, winAuthorEmail: "dana@partner.com" })).toEqual([{ email: "dana@partner.com", kind: "comment_on_yours" }]);
    expect(feedAlertsFor({ authorEmail: "sam@vendor.com", mentioned: [dana], comment: true, winAuthorEmail: "dana@partner.com" })).toEqual([{ email: "dana@partner.com", kind: "mention_comment" }]);
    expect(feedAlertsFor({ authorEmail: "dana@partner.com", mentioned: [], comment: true, winAuthorEmail: "dana@partner.com" })).toEqual([]);
  });

  it("writes an email that escapes what people typed", () => {
    const e = feedAlertEmail({ kind: "mention_post", byName: "Sam <b>Rep</b>", room: "MB2 & Dandy", text: "<script>x</script> nice work", url: "https://rooms.example.com/mb2?a=1&b=2" });
    expect(e.subject).toBe("Sam <b>Rep</b> mentioned you in a win · MB2 & Dandy");
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("Sam &lt;b&gt;Rep&lt;/b&gt; mentioned you in a win");
    expect(e.html).toContain("MB2 &amp; Dandy");
    expect(e.html).toContain('href="https://rooms.example.com/mb2?a=1&amp;b=2"');
    expect(feedAlertEmail({ kind: "comment_on_yours", byName: "", room: "R", text: "t", url: "u" }).subject).toBe("Someone commented on your win · R");
  });
});
