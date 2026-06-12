/**
 * Sanity coverage for the logo dominant-color extractor that feeds the
 * brand-import colors hint (see colors.ts logo post-validation). Uses real
 * sharp-generated buffers so the rasterize/resize/histogram path is exercised
 * for raster, composite, all-white, SVG, and garbage inputs.
 */
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { dominantColorOfImage } from "./logo-color";

describe("dominantColorOfImage sanity", () => {
  it("reads a solid navy raster", async () => {
    const navy = await sharp({ create: { width: 120, height: 60, channels: 4, background: { r: 0, g: 44, b: 102, alpha: 1 } } }).png().toBuffer();
    expect(await dominantColorOfImage(navy)).toBe("#002C66");
  });
  it("ignores white background regions (dominant stays the navy band, within resize-blend tolerance)", async () => {
    const band = await sharp({ create: { width: 120, height: 30, channels: 4, background: { r: 0, g: 44, b: 102, alpha: 1 } } }).png().toBuffer();
    const composite = await sharp({ create: { width: 120, height: 60, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([{ input: band, top: 0, left: 0 }]).png().toBuffer();
    const hex = await dominantColorOfImage(composite);
    expect(hex).not.toBeNull();
    // Downsampling blends band edges into the bucket average — allow a small
    // per-channel tolerance around the authored navy (#002C66).
    const n = parseInt((hex as string).slice(1), 16);
    const [r, g, b] = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
    expect(Math.abs(r - 0)).toBeLessThanOrEqual(8);
    expect(Math.abs(g - 44)).toBeLessThanOrEqual(8);
    expect(Math.abs(b - 102)).toBeLessThanOrEqual(8);
  });
  it("returns null for an all-white image", async () => {
    const white = await sharp({ create: { width: 40, height: 40, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
    expect(await dominantColorOfImage(white)).toBeNull();
  });
  it("rasterizes an SVG logo", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="#002C66"/></svg>');
    expect(await dominantColorOfImage(svg)).toBe("#002C66");
  });
  it("returns null on undecodable bytes", async () => {
    expect(await dominantColorOfImage(Buffer.from("not an image"))).toBeNull();
  });
});
