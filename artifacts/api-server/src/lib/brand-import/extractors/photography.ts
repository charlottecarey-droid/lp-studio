import type OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { Evidence, DimensionResult, PhotographyData, PhotographyProfile } from "../types";

function pickImages(evidence: Evidence): string[] {
  const $ = evidence.$home;
  if (!$) return [];
  const base = evidence.homeUrl;
  const abs = (u: string | undefined): string | null => {
    if (!u) return null;
    try { return new URL(u, base).toString(); } catch { return null; }
  };
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string | null): void => {
    if (!u) return;
    if (seen.has(u)) return;
    if (/\.(svg|ico)(\?|$)/i.test(u)) return;
    if (/sprite|icon|favicon|logo/i.test(u)) return;
    seen.add(u);
    out.push(u);
  };

  // OG image first
  push(abs($('meta[property="og:image"]').attr("content")));
  push(abs($('meta[name="twitter:image"]').attr("content")));

  // First few <img> outside header/footer/nav
  $("main img, section img, article img, body > img").each((_, el) => {
    if (out.length >= 8) return;
    const $el = $(el);
    if ($el.closest("header,nav,footer").length) return;
    const w = parseInt($el.attr("width") ?? "0", 10) || 0;
    const h = parseInt($el.attr("height") ?? "0", 10) || 0;
    if (w > 0 && h > 0 && (w < 200 || h < 200)) return;
    const src = $el.attr("src") ?? $el.attr("data-src") ?? $el.attr("data-lazy-src");
    push(abs(src));
  });

  return out.slice(0, 8);
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
  if (!visionTargets.length) {
    return { status: "failed", data: null, confidence: "low", errors: ["no images found"] };
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
    const c = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 500,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: userParts }],
    });
    raw = c.choices[0]?.message?.content ?? "{}";
  } catch (e) {
    errors.push(`vision call failed: ${String(e)}`);
    return { status: "failed", data: null, confidence: "low", errors };
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
    data: { profile, referenceImageUrls: images },
    confidence: allKnown ? "medium" : "low",
    errors,
  };
}
