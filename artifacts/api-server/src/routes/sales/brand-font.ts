import { Router } from "express";

/**
 * Brand-font resolver for PDF one-pagers.
 *
 * jsPDF can only embed TrueType/OpenType (TTF/OTF) bytes. The modern Google
 * Fonts CSS API serves browsers woff2, which jsPDF cannot read — so the client
 * cannot fetch an embeddable face directly. This endpoint resolves the exact
 * TTF for a brand font SERVER-SIDE, where we control the request:
 *
 *   1. Hit Google's CSS v1 API with a non-modern User-Agent. Google then
 *      returns `src: url(...ttf)` pointing at fonts.gstatic.com (a modern
 *      browser UA would get woff2 instead).
 *   2. Parse each @font-face block → weight/style → gstatic TTF URL.
 *   3. Fetch each TTF (host-locked to fonts.gstatic.com to prevent SSRF) and
 *      return it base64-encoded so the client can embed it via jsPDF.addFont.
 *
 * The result is best-effort: any failure (font not on Google Fonts, network
 * error, non-TTF response) yields an empty `faces` map and the PDF generators
 * fall back to their built-in helvetica/Bagoss faces.
 */
const router = Router();

const GOOGLE_CSS_HOST = "fonts.googleapis.com";
const GSTATIC_HOST = "fonts.gstatic.com";
// A non-modern UA so Google's CSS v1 API returns TTF (not woff2) src URLs.
const TTF_UA = "curl/7.64.1";

const FONT_MAGIC = new Set(["00010000", "4f54544f", "74727565", "74746366"]);
const MAX_TTF_BYTES = 2_000_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type FontStyle = "normal" | "bold" | "italic" | "bolditalic";
type Faces = Partial<Record<FontStyle, string>>;

const cache = new Map<string, { at: number; value: Faces }>();

/**
 * Validate a requested family into a Google CSS `family=` segment. Only allow
 * the characters that appear in real family names so the value can never inject
 * extra query params, path segments, or a different host.
 */
function normalizeFamily(raw: string): string | null {
  const trimmed = raw.trim().replace(/^['"]+|['"]+$/g, "").trim();
  if (!trimmed || trimmed.length > 60) return null;
  if (!/^[A-Za-z0-9 +\-]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Fetch a gstatic TTF and return it base64-encoded, or null. Host-locked to
 * fonts.gstatic.com and following redirects manually so a redirect can never
 * bounce the fetch to a private/internal host (SSRF guard).
 */
async function fetchTtfBase64(url: string): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop < 3; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:" || parsed.host !== GSTATIC_HOST) return null;
    const r = await fetch(current, { redirect: "manual" });
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location");
      if (!loc) return null;
      current = new URL(loc, current).toString();
      continue;
    }
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_TTF_BYTES) return null;
    if (!FONT_MAGIC.has(buf.subarray(0, 4).toString("hex"))) return null;
    return buf.toString("base64");
  }
  return null;
}

/** Resolve a family's regular/bold/italic/bolditalic faces (base64 TTF). */
async function resolveFaces(family: string): Promise<Faces> {
  const key = family.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const faces: Faces = {};
  try {
    const param = encodeURIComponent(family).replace(/%20/g, "+");
    const cssUrl = `https://${GOOGLE_CSS_HOST}/css?family=${param}:400,400italic,700,700italic`;
    const r = await fetch(cssUrl, { headers: { "User-Agent": TTF_UA }, redirect: "manual" });
    if (r.ok) {
      const css = await r.text();
      // The v1 API returns one @font-face block per weight/style variant.
      for (const block of css.split("@font-face").slice(1)) {
        const m = /url\((https:\/\/[^)]+\.ttf)\)/.exec(block);
        if (!m) continue;
        const italic = /font-style:\s*italic/i.test(block);
        const weightMatch = /font-weight:\s*(\d+)/i.exec(block);
        const bold = weightMatch ? parseInt(weightMatch[1], 10) >= 600 : false;
        const style: FontStyle = bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal";
        if (faces[style]) continue;
        const b64 = await fetchTtfBase64(m[1]);
        if (b64) faces[style] = b64;
      }
    }
  } catch {
    /* graceful: leave faces empty so the client falls back to built-ins */
  }
  cache.set(key, { at: Date.now(), value: faces });
  return faces;
}

router.get("/brand-font", async (req, res): Promise<void> => {
  const familyRaw = typeof req.query.family === "string" ? req.query.family : "";
  const family = normalizeFamily(familyRaw);
  if (!family) {
    res.status(400).json({ error: "invalid font family" });
    return;
  }
  try {
    const faces = await resolveFaces(family);
    res.json({ family, faces });
  } catch {
    res.json({ family, faces: {} });
  }
});

export default router;
