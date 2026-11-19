import { describe, expect, it } from "vitest";
import { parseRoomCover, roomCoverInfo, setRoomCover } from "./partnerRoom";

const blocks = [
  { id: "a", type: "hero", props: { title: "x" } },
  { id: "w", type: "room-workspace", props: { partnerName: "MB2 Dental", eyebrow: "Partner Hub", planGroups: [{ title: "P", rows: [] }] } },
];

describe("partner hub cover, edited from the pop-up", () => {
  it("reads the stored cover with the default style", () => {
    expect(roomCoverInfo(blocks)).toEqual({ headline: "", eyebrow: "Partner Hub", coverStyle: "fade", coverPhotoScrolls: false });
    expect(roomCoverInfo([{ id: "a", type: "hero", props: {} }])).toBeNull();
  });
  it("cleans what was typed and refuses text that is too long", () => {
    expect(parseRoomCover({ headline: "  {{account}}   and us ", eyebrow: "", coverStyle: "nope", coverPhotoScrolls: "yes" })).toEqual({
      ok: true,
      cover: { headline: "{{account}} and us", eyebrow: "", coverStyle: "fade", coverPhotoScrolls: false },
    });
    expect(parseRoomCover({ headline: "x".repeat(161) }).ok).toBe(false);
    expect(parseRoomCover({ eyebrow: "x".repeat(81) }).ok).toBe(false);
  });
  it("writes only the cover fields and leaves the rest of the page alone", () => {
    const next = setRoomCover(blocks, { headline: "{{account}} × Us", eyebrow: "", coverStyle: "split", coverPhotoScrolls: true })!;
    expect(next[0]).toBe(blocks[0]);
    expect((next[1] as { props: Record<string, unknown> }).props).toEqual({ partnerName: "MB2 Dental", eyebrow: "", headline: "{{account}} × Us", coverStyle: "split", coverPhotoScrolls: true, planGroups: [{ title: "P", rows: [] }] });
    expect(setRoomCover([{ id: "a", type: "hero", props: {} }], { headline: "", eyebrow: "", coverStyle: "fade", coverPhotoScrolls: false })).toBeNull();
  });
});
