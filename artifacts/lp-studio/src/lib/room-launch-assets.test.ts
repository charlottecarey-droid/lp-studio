import { describe, expect, it } from "vitest";
import { LAUNCH_ASSETS, containBox, graphicSurface, layoutKitCopy, shade, socialLayout } from "./room-launch-assets";

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
