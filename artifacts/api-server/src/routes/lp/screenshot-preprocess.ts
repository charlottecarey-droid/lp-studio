// May 2026 audit follow-up — preprocess uploaded screenshot data URLs before
// shipping them to GPT-4o vision. A user pasting a 4 MB iPhone screenshot
// otherwise costs ~2.5× more per inference call and is noticeably slower for
// no perceived quality gain. We resize the long edge to 2048px and re-encode
// as JPEG q85, which is the OpenAI vision sweet-spot for marketing pages.
//
// Returns the original input if anything fails — preprocessing is a
// best-effort optimisation, not a correctness requirement.

import sharp from "sharp";

const MAX_LONG_EDGE = 2048;
const JPEG_QUALITY = 85;
// Only touch data: URLs above this raw-byte threshold — small screenshots
// (e.g. a 300 KB crop) round-trip more cleanly through GPT vision than a
// re-encoded JPEG would, and the savings aren't worth the latency.
const MIN_BYTES_TO_PREPROCESS = 600 * 1024;

interface DecodedDataUrl {
  mime: string;
  buffer: Buffer;
}

function decodeDataUrl(dataUrl: string): DecodedDataUrl | null {
  const m = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!m) return null;
  try {
    return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}

/**
 * Returns a (possibly resized) data: URL suitable for OpenAI vision parts.
 * Always returns *some* data URL — falls back to the original on any error
 * so the call site doesn't need to handle a null case.
 */
export async function preprocessScreenshotDataUrl(input: string): Promise<string> {
  const decoded = decodeDataUrl(input);
  if (!decoded) return input;
  if (decoded.buffer.length < MIN_BYTES_TO_PREPROCESS) return input;
  try {
    const out = await sharp(decoded.buffer, { failOn: "none" })
      .rotate() // honour EXIF orientation
      .resize({
        width: MAX_LONG_EDGE,
        height: MAX_LONG_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return input;
  }
}
