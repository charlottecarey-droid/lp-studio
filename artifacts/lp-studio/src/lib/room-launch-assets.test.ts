import { describe, expect, it } from "vitest";
import { LAUNCH_ASSETS, containBox, graphicSurface, shade, socialLayout } from "./room-launch-assets";

describe("launch asset graphics: layout and colour", () => {
  it("fits a logo inside its box, centred, without stretching", () => {
    expect(containBox(400, 100, { x: 0, y: 0, w: 200, h: 200 })).toEqual({ x: 0, y: 75, w: 200, h: 50 });
    expect(containBox(100, 400, { x: 10, y: 10, w: 200, h: 200 })).toEqual({ x: 85, y: 10, w: 50, h: 200 });
    const box = { x: 1, y: 2, w: 3, h: 4 };
    expect(containBox(0, 0, box)).toBe(box);
  });
  it("lays out both sizes with the lockup inside the canvas and the photo only on the wide one", () => {
    for (const v of ["wide", "square"] as const) {
      const L = socialLayout(v);
      for (const b of [L.brandLogo, L.partnerLogo]) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(L.w);
        expect(b.y + b.h).toBeLessThanOrEqual(L.h);
      }
      expect(L.brandLogo.y + L.brandLogo.h).toBeLessThan(L.cross.cy - L.cross.r);
      expect(L.cross.cy + L.cross.r).toBeLessThan(L.partnerLogo.y);
    }
    expect([socialLayout("wide").w, socialLayout("wide").h]).toEqual([1200, 627]);
    expect([socialLayout("square").w, socialLayout("square").h]).toEqual([1080, 1080]);
    expect(socialLayout("square").photo).toBeNull();
    // The lockup sits clear of the photo on the wide graphic.
    expect(socialLayout("wide").partnerLogo.x).toBeGreaterThanOrEqual(socialLayout("wide").photo!.w - 2);
  });
  it("uses the brand colour only when white logos will read on it", () => {
    expect(graphicSurface({ primaryColor: "#003A30" })).toBe("#003A30");
    expect(graphicSurface({ primaryColor: "#C7E738" })).toBe("#0F1F1B");
    expect(graphicSurface({ primaryColor: "nope" })).toBe("#0F1F1B");
    expect(shade("#000000", 0.5)).toBe("#808080");
    expect(shade("#ffffff", -1)).toBe("#000000");
  });
  it("names the generated assets with the keys the room's launch kit uses", () => {
    expect(LAUNCH_ASSETS.map((a) => a.key)).toEqual(["partnership-one-pager", "social-image-1", "social-image-2", "media-kit"]);
  });
});
