/**
 * Shared helpers for extracting and verifying `/assets/*` references in
 * prerendered landing-page HTML (task #374).
 *
 * Both the publish-time presence check (`triggerPublishedRender`) and
 * the scheduled audit/health/GC jobs need the same answers:
 *   - "which Vite-hashed asset paths does this HTML reference?"
 *   - "does R2 currently have that asset?"
 *
 * Centralized here so the regex + the R2 key derivation can't drift
 * between writers and readers (a drift that would silently re-introduce
 * the hash-mismatch bug we're fixing).
 */
import { HeadObjectCommand, NotFound, S3Client } from "@aws-sdk/client-s3";

// Match Vite's default output layout `/assets/<hashed-name>.<ext>`. We
// intentionally accept any extension; the GC/audit jobs need to see
// fonts/images too, not just js/css. The capture group is the *basename*
// (possibly with sub-path), because R2 keys are
// `_studio-assets/assets/<basename>` (flat by Vite default; we walk
// subdirectories on the uploader side just in case).
//
// Two safety rails — both are load-bearing and have a dedicated test:
//
//   1. Negative lookbehind on URL-path-ish characters: prevents matching
//      inside cross-origin URLs (`https://cdn.example.com/assets/x.js`)
//      and protocol-relative URLs (`//cdn.example.com/assets/x.css`).
//      The char immediately before `/assets/` must be a string boundary,
//      whitespace, attribute `=`, `(`, comma, etc. — anything that can't
//      legally appear inside a URL path. The original regex only allowed
//      `["'(]` here, which silently dropped the second+ candidate in an
//      `srcset` list (preceded by ", ", not a quote).
//
//   2. Restricted basename character class: only filename-safe chars,
//      which both (a) bounds the match cleanly at the next non-filename
//      char (quote, space, comma, `?`, `#`) without us having to
//      enumerate every terminator, and (b) rejects the `/assets/*`
//      literal that appears in an HTML comment in the real lp-studio
//      build (would otherwise be a phantom basename that fails the
//      publish gate).
//
// Lookbehind needs Node 10+; we're on Node 22.
const ASSET_REF_RE = /(?<![A-Za-z0-9_\-./])\/assets\/([A-Za-z0-9._\-/]+)/g;

export function extractAssetPaths(html: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  // Reset state — RegExp with `g` flag is stateful.
  ASSET_REF_RE.lastIndex = 0;
  while ((m = ASSET_REF_RE.exec(html)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found);
}

export const STUDIO_ASSETS_PREFIX = "_studio-assets/assets/";

export function r2KeyForAsset(basename: string): string {
  return `${STUDIO_ASSETS_PREFIX}${basename}`;
}

/**
 * HEAD an R2 asset object. Returns `true` if present, `false` on 404,
 * throws on other errors so callers can distinguish "definitely absent"
 * from "couldn't tell."
 */
export async function r2AssetExists(
  client: S3Client,
  bucket: string,
  basename: string,
): Promise<boolean> {
  try {
    await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: r2KeyForAsset(basename) }),
    );
    return true;
  } catch (err) {
    if (err instanceof NotFound) return false;
    if (err && typeof err === "object" && "name" in err) {
      const n = (err as { name: string }).name;
      if (n === "NotFound" || n === "NoSuchKey") return false;
      const meta = (err as { $metadata?: { httpStatusCode?: number } }).$metadata;
      if (meta?.httpStatusCode === 404) return false;
    }
    throw err;
  }
}
