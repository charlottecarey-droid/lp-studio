---
name: Edge WAF blocks email-HTML request bodies
description: Why superadmin email shell/template preview+test-send POSTs 403 in prod, and the base64-wrap fix pattern
---

The production edge (Cloudflare managed WAF) blocks POST/PATCH request bodies that
contain certain email-HTML patterns — confirmed trigger: a template token inside an
href attribute, e.g. `<a href="{{unsubscribeUrl}}">` / `<a href="{{workspaceUrl}}">`.
The block is a minimal HTML page (`<title>403</title>403 Forbidden` + Cloudflare's
`window.__CF$cv$params` script), NOT the app's JSON errors — it never reaches the origin.

**Why this is subtle:**
- The app's own auth/CSRF errors are JSON (401 / `{"error":"Invalid or missing CSRF token"}` 403). A *minimal HTML* 403 means a layer in FRONT of Express blocked it.
- Single benign fragments pass; it's roughly anomaly-score / pattern based, so only the *real* shell/footer markup trips it. Non-shell emails (welcome, wrapInShell:false) happened not to contain the tripping pattern, which is why they "worked".
- Repro WITHOUT auth: POST raw tripping HTML to `https://app.lpstudio.ai/api/admin/email-shell/preview` → 403 (WAF runs before origin auth). Same content base64-wrapped → 401 (passes edge). Dev (`$REPLIT_DEV_DOMAIN`) has NO such WAF — everything reaches origin — so this only reproduces against prod.

**Fix pattern (in repo, since we don't control Cloudflare):** base64-wrap the JSON body so raw HTML never appears on the wire.
- Client: when the request body is a JSON string, send `{ "__encoded": "<base64-utf8-json>" }` instead. This now happens GLOBALLY in the shared CSRF fetch interceptor (`lp-studio/src/lib/api-fetch.ts`): a `WAF_TRIPPING_BODY` regex (`href=…{{`) gates `encodeBodyForWaf()` so every same-origin /api POST with an href-token body is wrapped automatically — no per-callsite apiFetch needed (covers sales send-test-email, save/clone template, quick-campaign wizard at once). The encoded body must be reused on the CSRF-retry path. Won't double-wrap already-base64 bodies (base64 can't match the regex); skips FormData/non-string bodies.
- Server: a global middleware after `express.json` and BEFORE csrf/routes detects `req.body.__encoded` (string), decodes it back into `req.body` (must be a plain object), 400 on malformed. Strict no-op when the marker is absent and for multipart (express.json doesn't parse multipart). CSRF is unaffected (it reads the `x-csrf-token` header, not the body).

**How to apply:** any new admin surface that POSTs user/operator-authored HTML (email shells, templates, rich content) to the API must route through an apiFetch that encodes, OR expect intermittent prod-only 403s with no origin log. Don't chase it as an app auth/CSRF bug — check whether the body carries HTML and whether the request reached the origin at all.

**Binary uploads also trip it (PDF):** the same prod-only WAF 403s multipart POSTs carrying raw PDF binary (the spinner never completes; works in dev). Fix is the same family — send the file as a base64 TEXT field instead of raw multipart bytes. Client: `buildPdfUploadFormData(file)` (lp-studio/src/lib/pdf-upload.ts) puts `fileBase64`/`filename`/`contentType` into FormData. Server (`/lp/pdf/upload` in api-server/src/routes/storage.ts) accepts EITHER raw `file` OR `fileBase64` (backward-compatible); for the base64 path it must STRICTLY validate before decode — `Buffer.from(b64,"base64")` silently drops invalid chars, so gate on `len%4===0` + `^[A-Za-z0-9+/]+={0,2}$` AND a decode→re-encode round-trip equality, then re-check the `%PDF-` magic + decoded-size cap (multer's mime fileFilter is bypassed on this path). multer `fieldSize` must be raised (~70MB) since the base64 text is ~33% larger than the 50MB binary cap.
