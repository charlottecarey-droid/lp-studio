import { describe, expect, it } from "vitest";
import { LAUNCH_ASSETS, containBox, fitLogo, graphicSurface, inkBounds, launchAssetSignature, layoutKitCopy, logoSizeFactor, shade, socialLayout, staleLaunchAssets } from "./room-launch-assets";

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

describe("media kit copy layout", () => {
  // A stand-in for the PDF's text wrapper: break every 40 characters at a space.
  const wrap = (text: string, width: number) => {
    const max = Math.round(width / 10);
    const out: string[] = [];
    let cur = "";
    for (const w of text.split(" ")) {
      if (cur && (cur + " " + w).length > max) {
        out.push(cur);
        cur = w;
      } else cur = cur ? `${cur} ${w}` : w;
    }
    if (cur) out.push(cur);
    return out;
  };
  it("turns a subject line, paragraphs and bullets into set lines", () => {
    const body = ["Subject: Introducing our new partner", "", "Dear Partners,", "", "Practices gain access to:", "", "• Digital Workflows: End-to-end systems designed to reduce friction and increase predictability.", "• A plain bullet", "", "Sincerely,", "[Leadership Team]"].join("\n");
    const lines = layoutKitCopy(body, 400, wrap);
    expect(lines[0]).toEqual({ kind: "subject", text: "Introducing our new partner" });
    expect(lines[1]).toMatchObject({ kind: "text", text: "Dear Partners,", gap: 12 });
    const bullets = lines.filter((l) => l.kind === "bullet") as { label: string; text: string; first: boolean }[];
    // The label is bold on the bullet's first line only; continuation lines carry no dot and no label.
    expect(bullets[0]).toMatchObject({ label: "Digital Workflows: ", first: true });
    expect(bullets[0].text.startsWith("End-to-end")).toBe(true);
    expect(bullets[1]).toMatchObject({ label: "", first: false });
    expect(bullets.filter((b) => b.first)).toHaveLength(2);
    expect(bullets[bullets.length - 1]).toMatchObject({ label: "", text: "A plain bullet", first: true });
    // A line break inside a paragraph (the sign-off) keeps its lines together, with no gap between them.
    const last = lines.slice(-2);
    expect(last.map((l) => (l as { text: string }).text)).toEqual(["Sincerely,", "[Leadership Team]"]);
    expect((last[1] as { gap?: number }).gap).toBe(0);
  });
  it("only treats Subject as a header when it is the first line", () => {
    const lines = layoutKitCopy("Hello\nSubject: not a header", 400, wrap);
    expect(lines.every((l) => l.kind === "text")).toBe(true);
  });
});
});

describe("logo fitting", () => {
  /** A transparent w × h image with an opaque block of ink. */
  const image = (w: number, h: number, ink: { x: number; y: number; w: number; h: number }, opaqueBackground = false) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const on = x >= ink.x && x < ink.x + ink.w && y >= ink.y && y < ink.y + ink.h;
        if (opaqueBackground) data.set(on ? [20, 60, 40, 255] : [255, 255, 255, 255], i);
        else if (on) data.set([255, 255, 255, 255], i);
      }
    }
    return data;
  };

  it("finds the ink inside blank margins, transparent or flat", () => {
    const ink = { x: 30, y: 10, w: 20, h: 15 };
    expect(inkBounds(image(100, 60, ink), 100, 60)).toEqual(ink);
    expect(inkBounds(image(100, 60, ink, true), 100, 60)).toEqual(ink);
    expect(inkBounds(new Uint8ClampedArray(100 * 60 * 4), 100, 60)).toBeNull();
  });

  it("gives a stacked logo more room than fitting inside the slot did", () => {
    const slot = socialLayout("wide").partnerLogo;
    const before = containBox(140, 100, slot);
    const after = fitLogo(140, 100, slot, { grow: "down" });
    expect(after.w).toBeGreaterThan(before.w * 1.4);
    expect(after.y).toBe(slot.y);
    expect(after.x + after.w / 2).toBeCloseTo(slot.x + slot.w / 2);
    expect(after.y + after.h).toBeLessThan(socialLayout("wide").h - 20);
  });

  it("keeps a long wordmark inside its slot", () => {
    const slot = socialLayout("wide").partnerLogo;
    const b = fitLogo(900, 100, slot, { grow: "down" });
    expect(b.w).toBeLessThanOrEqual(slot.w);
    expect(b.y).toBeGreaterThan(slot.y);
  });

  it("applies the hub's size setting, within what the graphic has room for", () => {
    for (const variant of ["wide", "square"] as const) {
      const L = socialLayout(variant);
      const one = fitLogo(140, 100, L.partnerLogo, { grow: "down" });
      const bigger = fitLogo(140, 100, L.partnerLogo, { grow: "down", scale: 1.5 });
      expect(bigger.w).toBeCloseTo(one.w * 1.5);
      const most = fitLogo(140, 100, L.partnerLogo, { grow: "down", scale: 3 });
      expect(most.y + most.h).toBeLessThan(L.h);
      const brand = fitLogo(400, 120, L.brandLogo, { byWeight: false, grow: "up", scale: 3 });
      expect(brand.y).toBeGreaterThan(0);
      expect(brand.y + brand.h).toBeCloseTo(L.brandLogo.y + L.brandLogo.h);
    }
    expect(logoSizeFactor(undefined)).toBe(1);
    expect(logoSizeFactor(150)).toBe(1.5);
    expect(logoSizeFactor(900)).toBe(3);
  });
});

describe("stale launch assets", () => {
  const basis = { partnerName: "Acme Dental", partnerLogoUrl: "/api/storage/a.png", heroImageUrl: "/api/storage/h.jpg", partnerLogoScale: 100, brandLogoScale: 100 };
  const made = (key: "social-image-1" | "social-image-2" | "media-kit" | "partnership-one-pager", from = basis) => ({ key, hasFile: true, madeFrom: launchAssetSignature(key, from) });

  it("is empty while everything matches", () => {
    expect(staleLaunchAssets([made("social-image-1"), made("social-image-2"), made("media-kit")], basis)).toEqual([]);
  });

  it("names every generated file when a logo size changes", () => {
    expect(staleLaunchAssets([made("social-image-1"), made("social-image-2"), made("partnership-one-pager")], { ...basis, partnerLogoScale: 150 })).toEqual(["partnership-one-pager", "social-image-1", "social-image-2"]);
  });

  it("names only the link preview when the cover photo changes", () => {
    expect(staleLaunchAssets([made("social-image-1"), made("social-image-2")], { ...basis, heroImageUrl: "/api/storage/other.jpg" })).toEqual(["social-image-1"]);
  });

  it("never names an uploaded file, or one with no record of how it was made", () => {
    expect(staleLaunchAssets([{ key: "social-image-1", hasFile: true }, { key: "social-image-2", hasFile: true, madeFrom: "" }], { ...basis, partnerLogoScale: 200 })).toEqual([]);
  });
});
