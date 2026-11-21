import { describe, expect, it } from "vitest";
import { ROOM_LOOK_CSS, ROOM_LOOKS, roomLook, roomLookClass } from "./room-look";

describe("hub look", () => {
  it("is classic unless the new look was picked", () => {
    expect(roomLook(undefined)).toBe("classic");
    expect(roomLook("")).toBe("classic");
    expect(roomLook("something")).toBe("classic");
    expect(roomLook("polished")).toBe("polished");
    expect(roomLookClass(undefined)).toBe("");
    expect(roomLookClass("polished")).toBe(" v2");
  });

  it("offers both looks, classic first", () => {
    expect(ROOM_LOOKS.map((l) => l.id)).toEqual(["classic", "polished"]);
  });

  it("only ever restyles a hub that carries the new look", () => {
    const selectors = ROOM_LOOK_CSS.split("}").map((r) => r.split("{")[0].trim()).filter(Boolean);
    expect(selectors.length).toBeGreaterThan(20);
    for (const sel of selectors) for (const part of sel.split(/,(?![^(]*\))/)) expect(part.trim().startsWith(".prw.v2")).toBe(true);
  });
});
