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

  it("takes an uploaded file as a resource, and only from storage or https", () => {
    expect(parseRoomLinks([{ title: "Playbook", fileUrl: "/api/storage/objects/abc.pdf", url: "" }])).toEqual({ ok: true, links: [{ title: "Playbook", url: "/api/storage/objects/abc.pdf", fileUrl: "/api/storage/objects/abc.pdf", kind: "pdf" }] });
    const img = parseRoomLinks([{ title: "Map", fileUrl: "https://cdn.example/x.png", kind: "image" }]);
    expect(img.ok && img.links[0].kind).toBe("image");
    expect(parseRoomLinks([{ title: "Bad", fileUrl: "javascript:alert(1)" }]).ok).toBe(false);
    expect(parseRoomLinks([{ title: "Bad", fileUrl: "//evil.example/x.pdf" }]).ok).toBe(false);
    expect(parseRoomLinks([{ title: "Bad", fileUrl: "/api/admin/users" }]).ok).toBe(false);
    expect(roomLinksInfo([{ id: "b", type: "room-workspace", props: { links: [{ title: "Playbook", url: "/api/storage/a.pdf", fileUrl: "/api/storage/a.pdf", kind: "pdf" }] } }])).toEqual([{ title: "Playbook", url: "/api/storage/a.pdf", fileUrl: "/api/storage/a.pdf", kind: "pdf" }]);
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
