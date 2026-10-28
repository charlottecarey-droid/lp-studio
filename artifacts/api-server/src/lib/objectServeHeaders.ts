/**
 * Response headers for serving a stored object (see ObjectStorageService.downloadObject).
 *
 * Content-Length is sent only when the size is known AND small enough. The deployment's
 * HTTP/1 front end (Cloud Run behind Replit) refuses a response over 32 MB that carries a
 * Content-Length — the client gets an empty 500 in about a second (Oct 2026: a 53 MB
 * print-ready brochure attached to a content hub was undownloadable). Chunked transfer has
 * no such cap, so large objects stream without a length.
 */
export const MAX_CONTENT_LENGTH_RESPONSE = 30 * 1024 * 1024;

export function objectServeHeaders(opts: { contentType?: string | null; size?: number | string | null; isPublic: boolean; cacheTtlSec: number }): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": opts.contentType || "application/octet-stream",
    "Cache-Control": `${opts.isPublic ? "public" : "private"}, max-age=${opts.cacheTtlSec}`,
  };
  const size = Number(opts.size ?? 0);
  if (Number.isFinite(size) && size > 0 && size <= MAX_CONTENT_LENGTH_RESPONSE) {
    headers["Content-Length"] = String(size);
  } else {
    headers["Transfer-Encoding"] = "chunked";
  }
  return headers;
}
