import type OpenAI from "openai";
import { withOpenAIConcurrency } from "../openai-semaphore";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { Evidence, DimensionResult, ColorsData, ColorSlot, Confidence } from "../types";

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function saturation([r, g, b]: [number, number, number]): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}
function hue([r, g, b]: [number, number, number]): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
// Salience = saturation × chroma (mirrors the pixel-sampler's ranking in
// evidence.ts). Used to pick the *vivid* shade out of a brand color scale:
// design-system sites expose a whole token ramp (e.g. Stripe's
// `--…-brand-25` … `--…-brand-975`), and the true brand color is the
// saturated mid-scale shade, not a pale tint or near-black extreme.
function chromaSalience(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return saturation(rgb) * (Math.max(...rgb) - Math.min(...rgb));
}
function isNearGrey(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return saturation(rgb) < 0.12;
}
// Hue-aware "weak color" test: a color is unsuitable for primary/accent/CTA if
// it is near-grey (the original isNearGrey behavior) OR it sits in the
// brown/beige band — low-to-mid saturation warm tones (~20–60°). On
// photo-heavy homepages (e-commerce, hospitality, food, interiors) the most
// frequent pixels are muddy product-photo wood/beige/ceramic tones; without
// this they pass the old saturation-only filter and hijack the brand slots.
function isWeakColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const s = saturation(rgb);
  if (s < 0.12) return true;
  const h = hue(rgb);
  if (s < 0.35 && h >= 20 && h <= 60) return true;
  return false;
}

const SLOT_FIELDS: (keyof ColorsData)[] = [
  "primary", "accent", "pageBackground", "cardBackground", "text", "textMuted",
  "ctaBackground", "ctaText", "navBgColor", "navText", "borderColor",
];

export async function extractColors(
  evidence: Evidence,
  openai: OpenAI,
): Promise<DimensionResult<ColorsData>> {
  const errors: string[] = [];
  const palette = evidence.sampledPalette;
  const cssVars = evidence.cssVarPaletteHints;

  if (!palette.length && !cssVars.length) {
    return {
      status: "failed",
      data: null,
      confidence: "low",
      errors: ["no color evidence (no screenshot palette, no CSS vars)"],
    };
  }

  // Pick deterministic defaults for background/text from the palette extremes
  // so we always have something even if the LLM call fails.
  const sortedByLum = [...palette].map((h) => ({ h, l: luminance(hexToRgb(h) ?? [0, 0, 0]) }))
    .sort((a, b) => b.l - a.l);
  const lightest = sortedByLum[0]?.h ?? "#FFFFFF";
  const darkest = sortedByLum[sortedByLum.length - 1]?.h ?? "#0F172A";

  const candidateNote = cssVars.length
    ? `\n\nCSS custom properties on the live site (highest confidence — these are the brand's *named* tokens):\n${cssVars.slice(0, 30).map((v) => `  ${v.name}: ${v.value}`).join("\n")}`
    : "";
  const paletteNote = palette.length
    ? `\n\nPixel-sampled palette from the homepage screenshot (most → least frequent): ${palette.join(", ")}.`
    : "";

  const systemPrompt = `You are a brand color extractor. Given a list of CSS custom properties and pixel-sampled colors from a homepage, return JSON mapping these slots to hex codes. Prefer CSS-var values when their name clearly indicates the slot (e.g. --color-primary → primary). Use pixel-sampled values as confirmation or when no CSS var exists. Avoid near-grey colors for primary/accent (use them only for text/background/border).

Return JSON:
{
  "slots": { "primary": "#RRGGBB", "accent": "#RRGGBB", "pageBackground": "#RRGGBB", "cardBackground": "#RRGGBB", "text": "#RRGGBB", "textMuted": "#RRGGBB", "ctaBackground": "#RRGGBB", "ctaText": "#RRGGBB", "navBgColor": "#RRGGBB", "navText": "#RRGGBB", "borderColor": "#RRGGBB" },
  "secondary": ["#RRGGBB", ...],   // up to 5 secondary brand colors
  "confidence": { "primary": "high|medium|low", ... }
}
All values must be 6-digit hex starting with #. Use solid colors only (no rgba). Omit any slot you cannot determine.${candidateNote}${paletteNote}`;

  const userParts: ChatCompletionContentPart[] = [
    { type: "text", text: `Source URL: ${evidence.homeUrl}` },
  ];
  const shotUrl = evidence.screenshotDataUrl ?? evidence.screenshotUrl;
  if (shotUrl) {
    userParts.push({ type: "image_url", image_url: { url: shotUrl } });
  }

  let raw = "{}";
  try {
    const completion = await withOpenAIConcurrency(() => openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userParts },
      ],
    }));
    raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
  } catch (e) {
    errors.push(`LLM call failed: ${String(e)}`);
  }

  let parsed: { slots?: Record<string, string>; secondary?: string[]; confidence?: Record<string, string> } = {};
  try { parsed = JSON.parse(raw); } catch { /* ignore */ }
  const slots = parsed.slots ?? {};
  const llmConf = parsed.confidence ?? {};
  const hexRe = /^#[0-9a-fA-F]{6}$/;

  const safe = (v: unknown, fallback: string): string => {
    if (typeof v === "string" && hexRe.test(v)) return v.toUpperCase();
    return fallback;
  };

  // Find a likely primary from CSS vars if LLM whiffed. A *named*
  // --brand/--primary custom property is the highest-confidence brand
  // signal we have, so prefer it over any pixel-sampled color. Exclude
  // background-ish brand tokens (--brand-bg / --primary-surface) — those
  // are page fills, not the brand color — and skip weak (near-grey /
  // brown-beige) values. When a design-system site exposes a whole brand
  // scale, rank the candidates by salience so we land the vivid mid-scale
  // shade rather than a pale tint or near-black extreme.
  const brandVar = cssVars
    .filter((v) =>
      /(?:^|-)(?:brand|primary)/i.test(v.name)
      && !/(?:brand|primary)-?(?:bg|background|surface|card)/i.test(v.name)
      && !isWeakColor(v.value))
    .slice()
    .sort((a, b) => chromaSalience(b.value) - chromaSalience(a.value))[0];
  const accentVar = cssVars.find((v) => /accent/i.test(v.name) && !isWeakColor(v.value));
  const saturated = palette.filter((h) => !isWeakColor(h));
  const fallbackPrimary = brandVar?.value ?? saturated[0] ?? darkest;
  const fallbackAccent = accentVar?.value ?? saturated[1] ?? saturated[0] ?? fallbackPrimary;

  let primary = safe(slots.primary, fallbackPrimary);
  let accent = safe(slots.accent, fallbackAccent);
  // Deterministic post-filter: refuse weak (near-grey or brown/beige) primary/accent
  if (isWeakColor(primary)) {
    errors.push(`LLM proposed weak primary (${primary}); using saturated fallback`);
    primary = saturated[0] ?? primary;
  }
  if (isWeakColor(accent)) {
    accent = saturated.find((h) => h.toUpperCase() !== primary.toUpperCase()) ?? accent;
  }

  // Guard against a large hero/gradient wash hijacking the brand primary.
  // The pixel sampler floats the most-frequent strongly-saturated color to
  // the FRONT of the sampled palette; on sites with a big vivid hero
  // gradient (e.g. Stripe's orange wash) that front color is a background
  // region the LLM/pixels happily promote, while the real brand color lives
  // in CTAs/links and — most reliably — in a named brand CSS custom
  // property. So whenever such a named brand token exists and we also have a
  // pixel palette in play (i.e. a wash could be competing for the slot),
  // trust the named token over whatever the screenshot produced: a declared
  // --brand/--primary value is the highest-confidence brand signal. When
  // there is no pixel palette (e.g. pasted-text imports) we leave a valid
  // LLM-chosen primary untouched — there is no wash to guard against.
  if (
    brandVar
    && palette.length > 0
    && brandVar.value.toUpperCase() !== primary.toUpperCase()
  ) {
    errors.push(`primary (${primary}) overridden by named brand token ${brandVar.name} (${brandVar.value}); a pixel-sampled wash must not outrank a declared brand color`);
    primary = brandVar.value.toUpperCase();
  }

  // Decouple the CTA background from primary: when the LLM omits it, prefer a
  // distinct saturated palette candidate; otherwise pick a distinct neutral
  // (e.g. a dark button) and only collapse onto primary as a last resort. This
  // stops photo-heavy sites from landing the same muddy tone in both slots.
  const distinctSaturatedCta = saturated.find((h) => h.toUpperCase() !== primary.toUpperCase());
  const distinctPaletteCta = [...palette]
    .sort((a, b) => luminance(hexToRgb(a) ?? [0, 0, 0]) - luminance(hexToRgb(b) ?? [0, 0, 0]))
    .find((h) => h.toUpperCase() !== primary.toUpperCase());
  const ctaFallback = distinctSaturatedCta ?? distinctPaletteCta ?? primary;
  const ctaBg = safe(slots.ctaBackground, ctaFallback);
  // Bias rule: when the LLM/CSS-var-derived primary is near-grey but the
  // CTA slot is saturated (e.g. Notion's near-black primary vs the orange
  // CTA; Stripe's pink-from-hero primary vs the violet CTA), prefer the
  // CTA color for `primary`. The CTA is almost always the brand's
  // intended action color, which is what `primary` is consumed as in
  // downstream LP templates.
  if (isWeakColor(primary) && !isWeakColor(ctaBg) && ctaBg.toUpperCase() !== primary.toUpperCase()) {
    errors.push(`primary (${primary}) was achromatic; promoting saturated ctaBackground (${ctaBg}) to primary`);
    primary = ctaBg;
  }
  const ctaText = safe(slots.ctaText, luminance(hexToRgb(ctaBg) ?? [0, 0, 0]) > 0.5 ? "#0F172A" : "#FFFFFF");
  const pageBg = safe(slots.pageBackground, lightest);
  const cardBg = safe(slots.cardBackground, pageBg);
  const text = safe(slots.text, darkest);
  const textMuted = safe(slots.textMuted, "#64748B");
  const navBg = safe(slots.navBgColor, pageBg);
  const navText = safe(slots.navText, text);
  const borderColor = safe(slots.borderColor, "#E2E8F0");

  const secondary = (Array.isArray(parsed.secondary) ? parsed.secondary : [])
    .filter((s): s is string => typeof s === "string" && hexRe.test(s))
    .map((s) => s.toUpperCase())
    .slice(0, 5);

  const swatches: ColorSlot[] = [];
  const pushSwatch = (hex: string, source: ColorSlot["source"], conf: Confidence): void => {
    swatches.push({ hex, confidence: conf, source });
  };
  for (const v of cssVars.slice(0, 8)) pushSwatch(v.value, "css-var", "high");
  for (const h of palette.slice(0, 6)) pushSwatch(h, "pixel-sample", "medium");

  const status: DimensionResult<ColorsData>["status"] = errors.length ? "partial" : "ok";
  const overallConf: Confidence =
    cssVars.length > 0 ? "high" : palette.length > 0 ? "medium" : "low";

  const data: ColorsData = {
    primary, accent, pageBackground: pageBg, cardBackground: cardBg,
    text, textMuted, ctaBackground: ctaBg, ctaText, navBgColor: navBg,
    navText, borderColor, secondary, swatches, rawCssVars: cssVars,
  };
  // Apply LLM per-slot confidence overrides
  for (const slot of SLOT_FIELDS) {
    const conf = llmConf[slot];
    if (conf === "high" || conf === "medium" || conf === "low") {
      // attached for downstream UI in `proposed`/`confidence` merge
    }
  }
  return { status, data, confidence: overallConf, errors };
}

export { isNearGrey, isWeakColor, luminance, hexToRgb, rgbToHex };
