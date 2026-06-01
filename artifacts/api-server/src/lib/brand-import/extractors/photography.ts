import type OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type * as cheerio from "cheerio";
import type { Evidence, DimensionResult, PhotographyData, PhotographyProfile } from "../types";
import { withOpenAIConcurrency } from "../openai-semaphore";

// OpenAI vision only accepts JPEG/PNG/WEBP/GIF. SVG (which appears as
// "og-image.svg" on webflow.com, among others) is rejected with HTTP 400
// "unsupported image". We additionally drop ICO since it's almost always
// a favicon, not a photographic asset.
function isVisionUnsupportedImage(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (/\.(svg|svgz|ico|tiff?|bmp|avif|heic|heif)$/.test(path)) return true;
    // Some CDNs serve SVG via a "format=svg" query param even with a generic path
    const fmt = u.searchParams.get("format") ?? u.searchParams.get("fm") ?? "";
    if (/^(svg|tiff?|bmp|avif|heic|heif)$/i.test(fmt)) return true;
    return false;
  } catch {
    return false;
  }
}

// Lazy-loading / responsive-image attributes that modern + ecommerce
// themes (Shopify, Webflow, WordPress lazy plugins, etc.) use INSTEAD of
// a plain `src`. Reading only `src/data-src/data-lazy-src` returned zero
// images on those sites; widening this list is what makes image-rich
// Shopify homepages actually yield photos to mirror.
const LAZY_SRC_ATTRS = [
  "src",
  "data-src",
  "data-lazy-src",
  "data-original",
  "data-image",
  "data-lazy",
  "data-fallback-src",
  "data-srcset-fallback",
];

/**
 * Pick the largest candidate URL out of a `srcset` / `data-srcset`
 * descriptor list (`"a.jpg 320w, b.jpg 1024w"` or `"a.jpg 1x, b.jpg 2x"`).
 * Returns the URL with the highest width (`w`) or density (`x`) descriptor,
 * falling back to the last entry when descriptors are absent.
 */
function pickLargestFromSrcset(srcset: string): string | null {
  const candidates = srcset
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [url, descriptor] = part.split(/\s+/, 2);
      let weight = 0;
      if (descriptor) {
        const w = descriptor.match(/^(\d+(?:\.\d+)?)w$/);
        const x = descriptor.match(/^(\d+(?:\.\d+)?)x$/);
        if (w) weight = parseFloat(w[1]);
        else if (x) weight = parseFloat(x[1]) * 1000; // density: prefer over small w
      }
      return { url, weight };
    })
    .filter((c) => c.url);
  if (!candidates.length) return null;
  // Stable pick: highest weight wins; ties resolve to the last (usually
  // the highest-res entry in author order).
  let best = candidates[0];
  for (const c of candidates) {
    if (c.weight >= best.weight) best = c;
  }
  return best.url;
}

/** Extract the first `url(...)` out of an inline `background-image` style. */
function urlFromBackgroundStyle(style: string): string | null {
  const m = style.match(/background(?:-image)?\s*:[^;]*url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  return m ? m[2] : null;
}

/**
 * Extract candidate content-image URLs from an already-parsed DOM. Shared by
 * the Brand Import photography extractor (which has a Cheerio `Evidence`) and
 * page-create reference scraping (which loads raw Firecrawl HTML), so both use
 * identical quality heuristics: largest `srcset`, lazy-load attributes, and CSS
 * background images, while skipping header/nav/footer chrome, icon/sprite/
 * favicon/logo assets, and vision-unsupported formats (SVG/ICO/etc). Capped at 8.
 */
export function pickImagesFromDom($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const abs = (u: string | undefined | null): string | null => {
    if (!u) return null;
    const trimmed = u.trim();
    if (!trimmed || trimmed.startsWith("data:")) return null;
    try { return new URL(trimmed, baseUrl).toString(); } catch { return null; }
  };
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string | null): void => {
    if (!u) return;
    if (seen.has(u)) return;
    if (isVisionUnsupportedImage(u)) return;
    if (/sprite|icon|favicon|logo/i.test(u)) return;
    seen.add(u);
    out.push(u);
  };

  // OG image first
  push(abs($('meta[property="og:image"]').attr("content")));
  push(abs($('meta[name="twitter:image"]').attr("content")));

  // Widened element search: themes without semantic <main>/<section>/
  // <article> wrappers (common on Shopify/Squarespace) still keep their
  // hero/product imagery inside generic <div>s, so we scan all <img>
  // (and <picture><source>) on the page and only exclude the header/nav/
  // footer chrome explicitly.
  $("img, picture source").each((_, el) => {
    if (out.length >= 8) return;
    const $el = $(el);
    if ($el.closest("header,nav,footer").length) return;
    const w = parseInt($el.attr("width") ?? "0", 10) || 0;
    const h = parseInt($el.attr("height") ?? "0", 10) || 0;
    if (w > 0 && h > 0 && (w < 200 || h < 200)) return;

    // Responsive sources: prefer the largest srcset candidate.
    const srcset = $el.attr("srcset") ?? $el.attr("data-srcset");
    if (srcset) push(abs(pickLargestFromSrcset(srcset)));

    // Plain / lazy src attributes. Keep scanning until one resolves to a
    // real http(s) image — do NOT break on a merely-present attribute.
    // Lazy-loaders (Shopify, WP plugins) put a placeholder in `src`
    // (a 1×1 gif, an inline `data:` URI, or a blank string) while the
    // real asset lives in `data-src`/`data-original`. `abs()` returns
    // null for `data:`/blank, so breaking on the first present attr would
    // skip the real image entirely (the exact atown-class failure).
    for (const attr of LAZY_SRC_ATTRS) {
      const v = $el.attr(attr);
      if (!v) continue;
      const resolved = abs(v);
      if (resolved) { push(resolved); break; }
    }
  });

  // Inline CSS background-image URLs (hero sections frequently use these
  // instead of an <img>). Scan a bounded number of styled elements.
  if (out.length < 8) {
    $("[style*='background']").each((_, el) => {
      if (out.length >= 8) return;
      const $el = $(el);
      if ($el.closest("header,nav,footer").length) return;
      const style = $el.attr("style") ?? "";
      push(abs(urlFromBackgroundStyle(style)));
    });
  }

  return out.slice(0, 8);
}

export function pickImages(evidence: Evidence): string[] {
  const $ = evidence.$home;
  if (!$) return [];
  return pickImagesFromDom($, evidence.homeUrl);
}

export async function extractPhotography(
  evidence: Evidence,
  openai: OpenAI,
): Promise<DimensionResult<PhotographyData>> {
  const errors: string[] = [];
  const images = pickImages(evidence);
  // If we have NO images at all but DO have a screenshot, use the screenshot
  // as the lone evidence so we still produce something.
  // Prefer the inlined data: URL so the OpenAI fetcher isn't blocked/
  // throttled by some firecrawl screenshot hosts (same reason colors/
  // buttons/typography all use screenshotDataUrl).
  const screenshotFallback = evidence.screenshotDataUrl ?? evidence.screenshotUrl;
  const visionTargets = images.length > 0 ? images : screenshotFallback ? [screenshotFallback] : [];

  // Images that should reach the mirror step regardless of whether vision
  // classification succeeds (task #592). When the page yielded no <img>
  // URLs, fall back to the homepage screenshot so the tenant's media
  // library still gets *something* mirrorable. Prefer the hosted
  // screenshot URL over the (potentially huge) data: URL for mirroring —
  // assets-uploader can fetch either, but the URL keeps the payload small.
  const mirrorableScreenshot = evidence.screenshotUrl ?? evidence.screenshotDataUrl;
  const referenceImageUrls = images.length > 0
    ? images
    : mirrorableScreenshot
      ? [mirrorableScreenshot]
      : [];

  const emptyProfile: PhotographyProfile = {
    medium: "unknown",
    paletteTemperature: "unknown",
    lightness: "unknown",
    subject: "unknown",
    mood: "",
    summary: "",
  };

  if (!visionTargets.length) {
    return {
      status: "failed",
      data: { profile: emptyProfile, referenceImageUrls },
      confidence: "low",
      errors: ["no images found"],
    };
  }

  const userParts: ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `You are a brand-image stylist. Look at the ${visionTargets.length} image(s) attached (sampled from a brand's homepage). Classify the imagery style as JSON:
{
  "medium": "photographic" | "illustrated" | "mixed" | "abstract",
  "palette_temperature": "warm" | "cool" | "neutral",
  "lightness": "light" | "dark" | "mid",
  "subject": "people" | "product" | "environment" | "abstract" | "mixed",
  "mood": "string (2-4 evocative adjectives, comma-separated)",
  "summary": "string (one sentence describing the imagery style as a brief for an AI image generator)"
}
Return strict JSON only.`,
    },
  ];
  for (const url of visionTargets.slice(0, 6)) {
    userParts.push({ type: "image_url", image_url: { url } });
  }

  let raw = "{}";
  try {
    const c = await withOpenAIConcurrency(() => openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 500,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: userParts }],
    }));
    raw = c.choices[0]?.message?.content ?? "{}";
  } catch (e) {
    errors.push(`vision call failed: ${String(e)}`);
    // Vision failed, but we may still have real image URLs to mirror —
    // return them so the orchestrator's mirror step can populate lp_media.
    return {
      status: "failed",
      data: { profile: emptyProfile, referenceImageUrls },
      confidence: "low",
      errors,
    };
  }

  let parsed: Partial<PhotographyProfile> = {};
  try { parsed = JSON.parse(raw); } catch { errors.push("JSON parse failed"); }

  const validMedium: PhotographyProfile["medium"][] = ["photographic", "illustrated", "mixed", "abstract", "unknown"];
  const validTemp: PhotographyProfile["paletteTemperature"][] = ["warm", "cool", "neutral", "unknown"];
  const validLight: PhotographyProfile["lightness"][] = ["light", "dark", "mid", "unknown"];
  const validSubject: PhotographyProfile["subject"][] = ["people", "product", "environment", "abstract", "mixed", "unknown"];

  const pick = <T extends string>(v: unknown, allowed: readonly T[]): T => {
    if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as T;
    return "unknown" as T;
  };

  const profile: PhotographyProfile = {
    medium: pick(parsed.medium, validMedium),
    paletteTemperature: pick(parsed.paletteTemperature ?? (parsed as Record<string, unknown>).palette_temperature, validTemp),
    lightness: pick(parsed.lightness, validLight),
    subject: pick(parsed.subject, validSubject),
    mood: typeof parsed.mood === "string" ? parsed.mood.slice(0, 200) : "",
    summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 400) : "",
  };

  const allKnown = profile.medium !== "unknown" && profile.subject !== "unknown" && profile.summary.length > 0;
  return {
    status: allKnown ? "ok" : "partial",
    data: { profile, referenceImageUrls },
    confidence: allKnown ? "medium" : "low",
    errors,
  };
}
