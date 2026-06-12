import sharp from "sharp";
import { fetchAsset } from "../assets-uploader";
import { isWeakColor, rgbToHex } from "./colors";

// ── Logo dominant-color extraction (brand-import colors hint) ───────────────
//
// Promo-heavy homepages (seasonal-sale retail, campaign landing pages) flood
// the pixel sampler with campaign colors, so the colors extractor's LLM pass
// happily returns e.g. PINK as "primary" while the brand's actual mark is
// navy. The logo is the single most reliable statement of the brand color, so
// we compute its dominant non-background color and thread it into the colors
// extractor as a high-weight signal + deterministic post-validation (see
// extractColors). Best-effort throughout: any failure resolves to null and the
// colors extractor behaves exactly as before.

/** Downsample size for the histogram — a logo's palette is tiny, so 48x48 is
 *  plenty and keeps the pixel walk trivial. */
const SAMPLE_SIZE = 48;
/** Raster density for vector (SVG) input so thin strokes survive the
 *  downsample. Ignored for raster formats. */
const VECTOR_DENSITY = 150;

/**
 * Dominant non-transparent, non-near-white color of an image buffer as
 * #RRGGBB, or null when the image can't be decoded or is entirely
 * white/transparent (e.g. a white wordmark for dark navbars).
 *
 * Buckets pixels at 3 bits/channel and returns the average color of the
 * winning bucket. When the most frequent bucket is a WEAK color (near-grey /
 * black outline) but a reasonably frequent saturated bucket exists (>= 25% of
 * the winner's count), the saturated one is preferred — outlines and drop
 * shadows must not beat the actual brand fill.
 */
export async function dominantColorOfImage(buffer: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(buffer, { density: VECTOR_DENSITY })
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = info.channels; // 4 after ensureAlpha
    const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
    for (let i = 0; i + channels <= data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 128) continue; // transparent padding
      if (r > 240 && g > 240 && b > 240) continue; // near-white background / knockout text
      const key = ((r >> 5) << 10) | ((g >> 5) << 5) | (b >> 5);
      const e = buckets.get(key);
      if (e) {
        e.count += 1;
        e.r += r;
        e.g += g;
        e.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }
    if (buckets.size === 0) return null;
    const ranked = [...buckets.values()].sort((x, y) => y.count - x.count);
    const hexOf = (e: { count: number; r: number; g: number; b: number }): string =>
      rgbToHex(e.r / e.count, e.g / e.count, e.b / e.count);
    const top = ranked[0];
    const saturated = ranked.find(
      (e) => e.count >= top.count * 0.25 && !isWeakColor(hexOf(e)),
    );
    return hexOf(saturated ?? top);
  } catch {
    return null;
  }
}

/**
 * Fetch a logo (http(s) or data: URL — both shapes the logos extractor emits)
 * and return its dominant color. Reuses the asset mirror's SSRF-guarded,
 * size-capped fetch. Never throws; resolves null on any failure.
 */
export async function extractLogoDominantColor(logoUrl: string): Promise<string | null> {
  try {
    const fetched = await fetchAsset(logoUrl);
    if (!fetched.ok) return null;
    return await dominantColorOfImage(fetched.asset.buffer);
  } catch {
    return null;
  }
}
