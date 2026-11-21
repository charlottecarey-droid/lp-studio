import { describe, expect, it } from "vitest";
import { parseRoomLinks, roomLinksInfo, setRoomLinks } from "./partnerRoom";

const blocks = [
  { id: "a", type: "hero", props: {} },
  { id: "b", type: "room-workspace", props: { partnerName: "Acme", links: [{ key: "practice-site", title: "Sign-up page", url: "https://x.example/signup" }] } },
];

describe("hub Important links", () => {
  it("accepts a name and a web address, and adds https:// when it was left off", () => {
    const r = parseRoomLinks([{ title: "  Brand   folder ", url: "drive.example.com/folder", description: "" }, { key: "practice-site", title: "Sign-up", url: "https://x.example/s", hidden: true }]);
    expect(r).toEqual({ ok: true, links: [{ title: "Brand folder", url: "https://drive.example.com/folder" }, { key: "practice-site", title: "Sign-up", url: "https://x.example/s", hidden: true }] });
  });

  it("refuses a link with no name, no address, or an address that is not a web page", () => {
    expect(parseRoomLinks([{ title: "", url: "https://x.example" }]).ok).toBe(false);
    expect(parseRoomLinks([{ title: "A", url: "" }]).ok).toBe(false);
    expect(parseRoomLinks([{ title: "A", url: "javascript:alert(1)" }]).ok).toBe(false);
    expect(parseRoomLinks([{ title: "A", url: "notaurl" }]).ok).toBe(false);
    expect(parseRoomLinks("nope").ok).toBe(false);
    expect(parseRoomLinks(Array.from({ length: 31 }, () => ({ title: "A", url: "https://x.example" }))).ok).toBe(false);
  });

  it("reads and replaces only the links on the hub block", () => {
    expect(roomLinksInfo(blocks)).toEqual([{ key: "practice-site", title: "Sign-up page", url: "https://x.example/signup" }]);
    expect(roomLinksInfo([{ id: "a", type: "hero", props: {} }])).toBeNull();
    const next = setRoomLinks(blocks, [{ title: "B", url: "https://b.example" }]) as typeof blocks;
    expect(next[0]).toBe(blocks[0]);
    expect(next[1].props).toEqual({ partnerName: "Acme", links: [{ title: "B", url: "https://b.example" }] });
    expect(setRoomLinks([{ id: "a", type: "hero", props: {} }], [])).toBeNull();
  });
});
