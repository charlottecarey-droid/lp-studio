import sharp from "sharp";
import { logger } from "./logger";

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Read an image's intrinsic pixel dimensions from its bytes using sharp.
 *
 * Best-effort: returns `null` on any decode failure, for non-raster assets
 * sharp cannot size (e.g. SVGs, whose dimensions are density-dependent and so
 * meaningless as a "is this big enough to go full-bleed" signal), or when the
 * reported size is non-positive. Callers store the result on `lp_media`
 * (width/height) and the AI page generator uses it to refuse undersized
 * images as full-bleed / parallax hero backgrounds.
 *
 * SVGs are deliberately treated as "unknown" (null) rather than reporting the
 * default 1-density raster size — a vector logo is not a valid hero photo and
 * must not be judged by a fabricated pixel count.
 */
export async function readImageDimensions(
  buffer: Buffer,
  mimeType?: string,
): Promise<ImageDimensions | null> {
  if ((mimeType ?? "").toLowerCase().includes("svg")) return null;
  try {
    const meta = await sharp(buffer).metadata();
    // EXIF orientation 5–8 swaps width/height when rendered. Report the
    // visually-rendered dimensions so the generator's "long edge" check
    // matches what the browser actually displays.
    const orientation = meta.orientation ?? 1;
    let w = meta.width ?? 0;
    let h = meta.height ?? 0;
    if (orientation >= 5 && orientation <= 8) {
      [w, h] = [h, w];
    }
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      return null;
    }
    return { width: w, height: h };
  } catch (err) {
    logger.debug({ err: String(err) }, "[imageDimensions] failed to read image metadata");
    return null;
  }
}
