/**
 * Screenshot attachment helpers (June 2026).
 *
 * Shared by the Create Page modal and the New Microsite modal's "paste / drop
 * a screenshot of a page you like" input. The backend accepts a
 * `screenshotDataUrl` (data:image/*) on POST /api/lp/generate-page and
 * preprocesses/resizes it server-side — but raw retina screenshots are
 * routinely 5–15 MB as PNG, so we downscale client-side first to keep the
 * request payload sane:
 *
 *   • max 1600 px on the long edge (never upscaled),
 *   • re-encoded as JPEG at quality 0.85 (flattened onto white — JPEG has no
 *     alpha channel and a transparent PNG would otherwise go black).
 *
 * `computeDownscaleDims` is a pure function, unit-tested in
 * screenshotAttachment.test.ts; the canvas work lives in
 * `downscaleImageFile`, which is DOM-dependent and exercised manually.
 */

export interface AttachedScreenshot {
  /** data:image/jpeg;base64,… — ready to send as `screenshotDataUrl`. */
  dataUrl: string;
  /** Original filename ("Pasted image.png" for clipboard pastes). */
  name: string;
  /** Approximate encoded size in bytes (derived from the dataURL). */
  size: number;
  width: number;
  height: number;
}

export const SCREENSHOT_MAX_EDGE = 1600;
export const SCREENSHOT_JPEG_QUALITY = 0.85;

/** Hard cap on the source file we'll even try to decode (corrupt/absurd
 *  inputs) — generous because we downscale before sending. */
export const SCREENSHOT_MAX_SOURCE_BYTES = 30 * 1024 * 1024;

/**
 * Target dimensions for a downscale to `maxEdge` on the long side,
 * preserving aspect ratio. Images already within bounds come back unchanged
 * (we never upscale). Dimensions are rounded and floored at 1px.
 */
export function computeDownscaleDims(
  width: number,
  height: number,
  maxEdge: number = SCREENSHOT_MAX_EDGE,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: Math.max(1, Math.round(width) || 1), height: Math.max(1, Math.round(height) || 1) };
  }
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Approximate decoded byte size of a base64 dataURL payload. */
export function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return 0;
  const b64 = dataUrl.slice(comma + 1);
  // 4 base64 chars encode 3 bytes; padding chars encode nothing.
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

/** "184 KB" / "1.2 MB" — chip caption next to the filename. */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * First image file in a DataTransfer (drop) or clipboard event's data.
 * Pasted clipboard bitmaps surface as a File named "image.png" in
 * `items`/`files`; we check both for cross-browser coverage.
 */
export function imageFileFromDataTransfer(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  if (dt.items) {
    for (const item of Array.from(dt.items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) return f;
      }
    }
  }
  for (const f of Array.from(dt.files ?? [])) {
    if (f.type.startsWith("image/")) return f;
  }
  return null;
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image — try a PNG or JPEG."));
    };
    img.src = url;
  });
}

/**
 * Downscale an image File to the screenshot payload format. Rejects with a
 * user-presentable Error message for non-images / undecodable files.
 */
export async function downscaleImageFile(
  file: File,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<AttachedScreenshot> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image — paste or drop a screenshot (PNG/JPEG).");
  }
  if (file.size > SCREENSHOT_MAX_SOURCE_BYTES) {
    throw new Error("That image is too large (max 30 MB).");
  }

  const img = await loadImageElement(file);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) {
    throw new Error("Couldn't read that image — try a PNG or JPEG.");
  }

  const { width, height } = computeDownscaleDims(srcW, srcH, opts.maxEdge ?? SCREENSHOT_MAX_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Couldn't process the image in this browser.");
  }
  // JPEG has no alpha — flatten transparent PNGs onto white instead of black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", opts.quality ?? SCREENSHOT_JPEG_QUALITY);
  return {
    dataUrl,
    name: file.name || "Pasted screenshot",
    size: dataUrlByteSize(dataUrl),
    width,
    height,
  };
}
