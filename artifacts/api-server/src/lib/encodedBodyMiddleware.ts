import type { Request, Response, NextFunction } from "express";

/**
 * Encoded-body unwrapper. Some payloads (the superadmin email-shell / template
 * editor, plus any same-origin /api request whose body carries the WAF-tripping
 * href-token pattern) are base64-wrapped client-side as
 * `{ "__encoded": "<base64-utf8-json>" }`. The production edge WAF (Cloudflare
 * managed rules) 403s raw bodies that contain template tokens inside an href
 * (`<a href="{{unsubscribe_url}}">`) BEFORE they reach the origin, so the client
 * hides the raw HTML behind base64 (see lp-studio's api-fetch.ts).
 *
 * This middleware decodes `__encoded` back into `req.body` before CSRF and the
 * route handlers run, so the wrapping is fully transparent to every endpoint.
 * It is a no-op for normal (unwrapped) requests and for multipart uploads
 * (express.json leaves those bodies untouched). Mount it AFTER express.json().
 */
export function decodeEncodedBody(req: Request, res: Response, next: NextFunction): void {
  const body = req.body as { __encoded?: unknown } | undefined;
  if (body && typeof body.__encoded === "string") {
    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(body.__encoded, "base64").toString("utf8"));
    } catch {
      res.status(400).json({ error: "Malformed encoded request body" });
      return;
    }
    // Decoded payload must be a plain object so downstream handlers keep their
    // `req.body.<field>` assumptions; reject arrays/primitives/null.
    if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
      res.status(400).json({ error: "Malformed encoded request body" });
      return;
    }
    req.body = decoded;
  }
  next();
}
