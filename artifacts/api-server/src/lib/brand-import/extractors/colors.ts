import type OpenAI from "openai";
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
function isNearGrey(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return saturation(rgb) < 0.12;
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
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userParts },
      ],
    });
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

  // Find a likely primary from CSS vars if LLM whiffed
  const primaryVar = cssVars.find((v) => /primary|brand(?!-bg)/i.test(v.name) && !isNearGrey(v.value));
  const accentVar = cssVars.find((v) => /accent/i.test(v.name) && !isNearGrey(v.value));
  const saturated = palette.filter((h) => !isNearGrey(h));
  const fallbackPrimary = primaryVar?.value ?? saturated[0] ?? darkest;
  const fallbackAccent = accentVar?.value ?? saturated[1] ?? saturated[0] ?? fallbackPrimary;

  let primary = safe(slots.primary, fallbackPrimary);
  let accent = safe(slots.accent, fallbackAccent);
  // Deterministic post-filter: refuse near-grey primary/accent
  if (isNearGrey(primary)) {
    errors.push(`LLM proposed near-grey primary (${primary}); using saturated fallback`);
    primary = saturated[0] ?? primary;
  }
  if (isNearGrey(accent)) {
    accent = saturated.find((h) => h.toUpperCase() !== primary.toUpperCase()) ?? accent;
  }

  const ctaBg = safe(slots.ctaBackground, primary);
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

export { isNearGrey, luminance, hexToRgb, rgbToHex };
