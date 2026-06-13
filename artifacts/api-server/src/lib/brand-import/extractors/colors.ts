import type OpenAI from "openai";
import { withOpenAIConcurrency } from "../openai-semaphore";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { Evidence, DimensionResult, ColorsData, ColorSlot, Confidence, DarkModePalette, DesignTokens } from "../types";

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

/**
 * Build a dark-theme palette (P0-2) deterministically from the dark-scope CSS
 * custom properties the evidence builder harvested. No extra LLM call: a dark
 * theme either declared named tokens or it didn't. Role-matches each dark token
 * name to a slot. Returns undefined (zero regression) when there isn't enough
 * dark signal to be useful — we require at least a dark background OR a dark
 * primary/accent so we never surface a half-empty palette.
 */
function buildDarkModePalette(
  darkHints: { name: string; value: string }[],
  lightPrimary: string,
  lightAccent: string,
): DarkModePalette | undefined {
  if (!darkHints.length) return undefined;
  const hexRe = /^#[0-9a-fA-F]{6}$/;
  const pickByName = (matcher: RegExp, exclude?: RegExp, wantSaturated?: boolean): string | undefined => {
    const cands = darkHints.filter((h) => matcher.test(h.name) && (!exclude || !exclude.test(h.name)) && hexRe.test(h.value));
    if (!cands.length) return undefined;
    if (wantSaturated) {
      const sat = cands.filter((c) => !isWeakColor(c.value)).sort((a, b) => chromaSalience(b.value) - chromaSalience(a.value));
      if (sat.length) return sat[0].value.toUpperCase();
    }
    return cands[0].value.toUpperCase();
  };
  const isDarkHex = (hex: string): boolean => luminance(hexToRgb(hex) ?? [255, 255, 255]) < 0.4;

  const primary = pickByName(/(?:^|-)(?:brand|primary)/i, /(?:brand|primary)-?(?:surface|card)/i, true)
    ?? (!isWeakColor(lightPrimary) ? lightPrimary.toUpperCase() : undefined);
  const accent = pickByName(/accent/i, undefined, true)
    ?? (!isWeakColor(lightAccent) ? lightAccent.toUpperCase() : undefined);
  // Background/text: prefer a DARK declared bg + a LIGHT declared text.
  const bgCands = darkHints.filter((h) => /(?:bg|background|surface)/i.test(h.name) && hexRe.test(h.value));
  const pageBackground = bgCands.find((c) => isDarkHex(c.value))?.value.toUpperCase() ?? bgCands[0]?.value.toUpperCase();
  const cardCands = darkHints.filter((h) => /(?:card|surface)/i.test(h.name) && hexRe.test(h.value));
  const cardBackground = cardCands.find((c) => isDarkHex(c.value))?.value.toUpperCase() ?? pageBackground;
  const textCands = darkHints.filter((h) => /(?:text|fg|foreground)/i.test(h.name) && hexRe.test(h.value));
  const text = textCands.find((c) => !isDarkHex(c.value))?.value.toUpperCase() ?? textCands[0]?.value.toUpperCase();

  // Require a meaningful dark background or a dark brand color, else skip.
  if (!pageBackground && !primary && !accent) return undefined;
  if (pageBackground && !isDarkHex(pageBackground) && !primary && !accent) return undefined;

  const out: DarkModePalette = {};
  if (primary) out.primary = primary;
  if (accent) out.accent = accent;
  if (pageBackground) out.pageBackground = pageBackground;
  if (cardBackground) out.cardBackground = cardBackground;
  if (text) out.text = text;
  return Object.keys(out).length ? out : undefined;
}

/** Circular hue distance (degrees, 0–180) between two hex colors. Only
 *  meaningful when both colors carry real chroma — callers gate on
 *  !isWeakColor for both sides. */
function hueDistanceDeg(aHex: string, bHex: string): number {
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  if (!a || !b) return 0;
  const d = Math.abs(hue(a) - hue(b));
  return d > 180 ? 360 - d : d;
}

/** Hue distance beyond which the chosen primary is considered to CLASH with
 *  the logo's dominant color (vs merely being a neighboring/harmonizing hue).
 *  Pink (~330°) vs navy (~215°) is ~115° — well past this; blue vs teal
 *  (~40°) is well inside it. */
const LOGO_HUE_CONFLICT_DEG = 75;

/** How long extractColors waits for the (concurrently computed) logo
 *  dominant-color hint before proceeding without it. The logos extractor is
 *  usually done in 2–5s; its Playwright fallback can run longer, in which
 *  case we just skip the hint rather than eat the colors budget. */
const LOGO_HINT_WAIT_MS = 8_000;

/**
 * Harvest additive design tokens (P1-5) from the page CSS: a representative
 * primary gradient, a border-radius scale, and a representative shadow. Pulled
 * from CSS custom properties first (design-system sites namespace these as
 * `--radius-*`, `--shadow-*`, `--gradient-*`), then from plain rule values as a
 * fallback. Deterministic + fail-open — returns undefined when nothing useful
 * is found, so non-design-system sites see zero change.
 */
function harvestDesignTokens(evidence: Evidence): DesignTokens | undefined {
  const cssSources: string[] = [];
  if (evidence.$home) evidence.$home("style").each((_, el) => { cssSources.push(evidence.$home!(el).text() ?? ""); });
  for (const s of evidence.stylesheets) cssSources.push(s.css);
  if (!cssSources.length) return undefined;
  const css = cssSources.join("\n").replace(/\/\*[\s\S]*?\*\//g, "");

  const out: DesignTokens = {};

  // Primary gradient: prefer a `--gradient*`/`--brand*gradient` custom prop, else
  // the first reasonable linear/radial-gradient value in the CSS.
  const gradVar = css.match(/--[a-z0-9-]*(?:gradient|brand)[a-z0-9-]*\s*:\s*((?:linear|radial)-gradient\([^;]+)/i)?.[1];
  const gradAny = css.match(/(?:linear|radial)-gradient\(\s*[^;{}]*(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))[^;{}]*\)/i)?.[0];
  const gradient = (gradVar ?? gradAny)?.trim();
  // Only keep gradients that actually carry color stops (skip transparent fades).
  if (gradient && /#[0-9a-fA-F]{3,8}|rgb/.test(gradient) && gradient.length < 400) {
    out.primaryGradient = gradient;
  }

  // Radius scale: harvest named `--radius*` / `--rounded*` vars; map to sm/md/lg/full.
  const radiusVars: { name: string; value: string }[] = [];
  const rVarRe = /(--[a-z0-9-]*(?:radius|rounded|corner)[a-z0-9-]*)\s*:\s*([^;{}]+)/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rVarRe.exec(css))) {
    const val = rm[2].trim();
    if (/^\d|^var\(|^9999|^calc/.test(val) || /px|rem|em|%/.test(val)) radiusVars.push({ name: rm[1].toLowerCase(), value: val.slice(0, 40) });
  }
  if (radiusVars.length) {
    const radiusScale: { sm?: string; md?: string; lg?: string; full?: string } = {};
    const pick = (re: RegExp): string | undefined => radiusVars.find((v) => re.test(v.name))?.value;
    radiusScale.sm = pick(/(sm|small|xs|1)\b/) ?? radiusVars[0]?.value;
    radiusScale.md = pick(/(md|medium|base|default|2)\b/);
    radiusScale.lg = pick(/(lg|large|xl|3|4)\b/);
    radiusScale.full = pick(/(full|pill|round|9999|max)\b/) ?? radiusVars.find((v) => /9999|100%|50%/.test(v.value))?.value;
    const filled: { sm?: string; md?: string; lg?: string; full?: string } = {};
    for (const [k, v] of Object.entries(radiusScale)) if (v) (filled as Record<string, string>)[k] = v;
    if (Object.keys(filled).length) out.radiusScale = filled;
  }

  // Representative shadow: prefer a `--shadow*` var, else the first multi-part
  // box-shadow rule value (skip `none`).
  const shadowVar = css.match(/--[a-z0-9-]*shadow[a-z0-9-]*\s*:\s*([^;{}]+)/i)?.[1]?.trim();
  const shadowRule = css.match(/box-shadow\s*:\s*([^;{}]+)/i)?.[1]?.trim();
  const shadow = (shadowVar && !/^none$/i.test(shadowVar) ? shadowVar : null) ?? (shadowRule && !/^none$/i.test(shadowRule) ? shadowRule : null);
  if (shadow && /\d/.test(shadow) && shadow.length < 300) out.shadow = shadow;

  return Object.keys(out).length ? out : undefined;
}

export async function extractColors(
  evidence: Evidence,
  openai: OpenAI,
  /** Dominant color of the extracted brand logo (see
   *  logo-color.ts/extractLogoDominantColor), as a hex string or a promise of
   *  one — the orchestrator threads the logos extractor's output through
   *  without serializing the two extractors. Optional and best-effort. */
  logoColorHint?: string | null | Promise<string | null>,
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

  // Resolve the logo dominant-color hint, bounded so a slow logos extractor
  // (Playwright fallback) can't starve the colors budget.
  let logoColor: string | null = null;
  if (logoColorHint != null) {
    try {
      let resolved: string | null;
      if (typeof logoColorHint === "string") {
        resolved = logoColorHint;
      } else {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<null>((r) => {
          timer = setTimeout(() => r(null), LOGO_HINT_WAIT_MS);
          if (typeof timer.unref === "function") timer.unref();
        });
        resolved = await Promise.race([logoColorHint, timeout]);
        if (timer) clearTimeout(timer);
      }
      if (typeof resolved === "string" && /^#[0-9a-fA-F]{6}$/.test(resolved)) {
        logoColor = resolved.toUpperCase();
      }
    } catch {
      logoColor = null;
    }
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
  const logoNote = logoColor
    ? `\n\nThe brand LOGO's dominant color is ${logoColor} — after named CSS tokens this is the strongest brand signal. "primary" should usually match or harmonize with the logo color; a promotional/seasonal campaign color that clashes with the logo hue belongs in "accent", NOT "primary" (promo-heavy homepages flood the pixel palette with campaign colors). If the pixel-sampled palette conflicts with the logo color, report confidence "low" for primary.`
    : "";

  const systemPrompt = `You are a brand color extractor. Given a list of CSS custom properties and pixel-sampled colors from a homepage, return JSON mapping these slots to hex codes. Prefer CSS-var values when their name clearly indicates the slot (e.g. --color-primary → primary). Use pixel-sampled values as confirmation or when no CSS var exists. Avoid near-grey colors for primary/accent (use them only for text/background/border).

Return JSON:
{
  "slots": { "primary": "#RRGGBB", "accent": "#RRGGBB", "pageBackground": "#RRGGBB", "cardBackground": "#RRGGBB", "text": "#RRGGBB", "textMuted": "#RRGGBB", "ctaBackground": "#RRGGBB", "ctaText": "#RRGGBB", "navBgColor": "#RRGGBB", "navText": "#RRGGBB", "borderColor": "#RRGGBB" },
  "secondary": ["#RRGGBB", ...],   // up to 5 secondary brand colors
  "confidence": { "primary": "high|medium|low", ... }
}
All values must be 6-digit hex starting with #. Use solid colors only (no rgba). Omit any slot you cannot determine.${candidateNote}${paletteNote}${logoNote}`;

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
  // signal we have, so prefer it over any pixel-sampled color. We exclude
  // only --brand-surface / --brand-card tokens (genuine component fills) and
  // skip weak (near-grey / brown-beige) values. We deliberately do NOT
  // exclude --brand-bg / --brand-background tokens: a SATURATED *-bg brand
  // token is almost always the brand color used as a button/background fill
  // (e.g. Linear's brand purple lives in --color-brand-bg #5E6AD2), not a
  // neutral page fill — those are already dropped by isWeakColor. When a
  // design-system site exposes a whole brand scale, rank the candidates by
  // salience so we land the vivid mid-scale shade rather than a pale tint or
  // near-black extreme; salience also naturally demotes low-chroma semantic
  // slot tokens (--text-primary, --border-primary) below the real brand hue.
  const brandVar = cssVars
    .filter((v) =>
      /(?:^|-)(?:brand|primary)/i.test(v.name)
      && !/(?:brand|primary)-?(?:surface|card)/i.test(v.name)
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

  // Logo-dominant post-validation (June 2026). Promo-heavy homepages (e.g. a
  // fashion brand mid-sale) flood the pixel sampler with CAMPAIGN colors, so
  // the LLM returns e.g. pink as primary while the brand's mark is navy. When
  // we have a USABLE logo dominant (not near-grey/near-white — those say
  // nothing about the brand hue) and the chosen primary either clashes with
  // it on hue or is itself weak, prefer the logo dominant for `primary` and
  // demote the LLM/palette pick to `accent`. Confidence is capped at "medium"
  // below so the review UI surfaces the call. A primary pinned to a NAMED
  // --brand/--primary CSS token is left alone — the site's own declared token
  // outranks our pixel read of the logo.
  let logoOverrodePrimary = false;
  if (logoColor && !isWeakColor(logoColor) && primary.toUpperCase() !== logoColor) {
    const primaryPinnedToBrandVar =
      !!brandVar && brandVar.value.toUpperCase() === primary.toUpperCase();
    const clashes =
      isWeakColor(primary) || hueDistanceDeg(primary, logoColor) > LOGO_HUE_CONFLICT_DEG;
    if (!primaryPinnedToBrandVar && clashes) {
      errors.push(
        `primary (${primary}) conflicts with the logo's dominant color (${logoColor}); preferring the logo dominant and demoting the sampled pick to accent`,
      );
      if (!isWeakColor(primary)) accent = primary;
      primary = logoColor;
      logoOverrodePrimary = true;
    }
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
  // A logo-dominant override caps confidence at "medium": the pixel-sampled
  // palette and the logo disagreed, so a human should confirm the call in the
  // review UI.
  const evidenceConf: Confidence =
    cssVars.length > 0 ? "high" : palette.length > 0 ? "medium" : "low";
  const overallConf: Confidence =
    logoOverrodePrimary && evidenceConf === "high" ? "medium" : evidenceConf;

  // Dark-mode palette (P0-2): deterministic from the dark-scope CSS vars the
  // evidence builder harvested. Undefined → site has no dark theme → no field.
  const darkModePalette = buildDarkModePalette(evidence.darkCssVarHints ?? [], primary, accent);
  // Design tokens (P1-5): gradient / radius scale / shadow. Additive + fail-open.
  const designTokens = harvestDesignTokens(evidence);

  const data: ColorsData = {
    primary, accent, pageBackground: pageBg, cardBackground: cardBg,
    text, textMuted, ctaBackground: ctaBg, ctaText, navBgColor: navBg,
    navText, borderColor, secondary, swatches, rawCssVars: cssVars,
    ...(darkModePalette ? { darkModePalette } : {}),
    ...(designTokens ? { designTokens } : {}),
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
