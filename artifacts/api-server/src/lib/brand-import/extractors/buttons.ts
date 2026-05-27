import type OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type {
  Evidence, DimensionResult, ButtonsData, ButtonStyleData, ButtonCategory, SurfaceStyleData,
} from "../types";
import { withOpenAIConcurrency } from "../openai-semaphore";

// Walk every rule body in every stylesheet (inline + linked) and keep the ones
// whose selector mentions btn/button/cta. Then we score candidates and pick
// the one most likely to be the *primary* CTA.
interface RuleHit {
  selector: string;
  declarations: Record<string, string>;
  score: number;
}

function parseRules(css: string): { selector: string; declarations: Record<string, string> }[] {
  // Strip comments + @-rules' bodies are messy; do a light pass that's good
  // enough for finding `.btn { ... }`-shaped rules. We tolerate nesting noise
  // by walking brace pairs.
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: { selector: string; declarations: Record<string, string> }[] = [];
  let i = 0;
  while (i < cleaned.length) {
    // Skip @media-style at-rules' header but recurse into the body
    if (cleaned[i] === "@") {
      const headerEnd = cleaned.indexOf("{", i);
      if (headerEnd < 0) break;
      // Find matching brace
      let depth = 1;
      let j = headerEnd + 1;
      while (j < cleaned.length && depth > 0) {
        if (cleaned[j] === "{") depth++;
        else if (cleaned[j] === "}") depth--;
        j++;
      }
      const inner = cleaned.slice(headerEnd + 1, j - 1);
      out.push(...parseRules(inner));
      i = j;
      continue;
    }
    const braceStart = cleaned.indexOf("{", i);
    if (braceStart < 0) break;
    const selector = cleaned.slice(i, braceStart).trim();
    let depth = 1;
    let j = braceStart + 1;
    while (j < cleaned.length && depth > 0) {
      if (cleaned[j] === "{") depth++;
      else if (cleaned[j] === "}") depth--;
      j++;
    }
    const body = cleaned.slice(braceStart + 1, j - 1);
    if (selector && !selector.startsWith("@")) {
      const declarations: Record<string, string> = {};
      for (const decl of body.split(/;(?![^()]*\))/)) {
        const colon = decl.indexOf(":");
        if (colon < 0) continue;
        const k = decl.slice(0, colon).trim();
        const v = decl.slice(colon + 1).trim();
        if (k && v && !k.startsWith("--")) declarations[k.toLowerCase()] = v;
      }
      if (Object.keys(declarations).length > 0) out.push({ selector, declarations });
    }
    i = j;
  }
  return out;
}

function scoreButtonSelector(selector: string): number {
  const s = selector.toLowerCase();
  let score = 0;
  if (/\bbtn-primary\b|\bbutton-primary\b|\bbtn--primary\b|\.cta\b|\bcta-primary\b/.test(s)) score += 100;
  if (/\bbtn\b|\bbutton\b/.test(s)) score += 30;
  if (/primary|brand/.test(s)) score += 25;
  if (/secondary|outline|ghost|link|text/.test(s)) score -= 25;
  if (/hover|focus|active|disabled/.test(s)) score -= 15;
  if (s.includes(":hover") || s.includes(":focus")) score -= 30;
  if (/,/.test(s)) score -= 5; // grouped selectors are usually broader
  // Penalize utility classes that obviously aren't buttons
  if (/icon|chip|tag|badge|nav-link/.test(s)) score -= 20;
  return score;
}

function scoreSurfaceSelector(selector: string): number {
  const s = selector.toLowerCase();
  let score = 0;
  if (/\bcard\b/.test(s)) score += 60;
  if (/\bpanel\b|\btile\b|\bsurface\b/.test(s)) score += 30;
  if (/primary|brand/.test(s)) score += 10;
  if (/hover|focus|active/.test(s)) score -= 20;
  if (/icon|chip|tag|badge/.test(s)) score -= 20;
  return score;
}

function parseRadiusToPx(value: string): number | null {
  if (!value) return null;
  const v = value.trim();
  if (/^9999px$/i.test(v) || /^999rem$/i.test(v) || /^50%$/i.test(v) || /^9999/.test(v)) return 9999;
  const m = v.match(/(-?\d+(?:\.\d+)?)\s*(px|rem|em)?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2] ?? "px";
  if (unit === "rem" || unit === "em") return n * 16;
  return n;
}

function categorize(radiusPx: number | null, bg: string | null): ButtonCategory {
  const isGradient = !!bg && /gradient/i.test(bg);
  const isTransparent = !!bg && /transparent|rgba\([^)]*,\s*0\s*\)/i.test(bg);
  if (isTransparent) return "ghost";
  if (radiusPx === null) return isGradient ? "rounded" : "rounded";
  if (radiusPx >= 100) return isGradient ? "gradient-pill" : "pill";
  if (radiusPx <= 2) return "square";
  return "rounded";
}

function buildButtonStyle(decls: Record<string, string>): ButtonStyleData {
  const radius = decls["border-radius"] ?? null;
  const radiusPx = radius ? parseRadiusToPx(radius) : null;
  const bg = decls["background"] ?? decls["background-color"] ?? null;
  const bgIsGradient = !!bg && /gradient/i.test(bg);
  const bgIsTransparent = !!bg && /transparent|rgba\([^)]*,\s*0\s*\)/i.test(bg);
  const fontWeightStr = decls["font-weight"] ?? null;
  const fontWeight = fontWeightStr ? (parseInt(fontWeightStr, 10) || ({ normal: 400, medium: 500, semibold: 600, bold: 700, black: 900 } as Record<string, number>)[fontWeightStr.toLowerCase()] || null) : null;
  return {
    category: categorize(radiusPx, bg),
    radiusPx,
    paddingX: decls["padding-inline"] ?? decls["padding-left"] ?? (decls["padding"] ? decls["padding"].split(/\s+/)[1] ?? decls["padding"] : null),
    paddingY: decls["padding-block"] ?? decls["padding-top"] ?? (decls["padding"] ? decls["padding"].split(/\s+/)[0] : null),
    fontWeight,
    textTransform: decls["text-transform"] ?? null,
    background: bg
      ? {
          type: bgIsGradient ? "gradient" : bgIsTransparent ? "transparent" : "solid",
          value: bg,
        }
      : null,
    boxShadow: decls["box-shadow"] ?? null,
    raw: decls,
    visionAgreed: false,
    visionNotes: "",
  };
}

function buildSurfaceStyle(decls: Record<string, string>): SurfaceStyleData {
  return {
    radiusPx: decls["border-radius"] ? parseRadiusToPx(decls["border-radius"]) : null,
    boxShadow: decls["box-shadow"] ?? null,
    border: decls["border"] ?? null,
    raw: decls,
  };
}

export async function extractButtons(
  evidence: Evidence,
  openai: OpenAI,
): Promise<DimensionResult<ButtonsData>> {
  const errors: string[] = [];
  const cssSources: string[] = [];
  if (evidence.$home) {
    evidence.$home("style").each((_, el) => { cssSources.push(evidence.$home!(el).text() ?? ""); });
  }
  for (const s of evidence.stylesheets) cssSources.push(s.css);

  if (!cssSources.length) {
    return { status: "failed", data: null, confidence: "low", errors: ["no CSS sources"] };
  }

  const buttonHits: RuleHit[] = [];
  const surfaceHits: RuleHit[] = [];
  for (const css of cssSources) {
    for (const r of parseRules(css)) {
      const btnScore = scoreButtonSelector(r.selector);
      if (btnScore > 0 && (r.declarations["border-radius"] || r.declarations["padding"] || r.declarations["background"] || r.declarations["background-color"])) {
        buttonHits.push({ ...r, score: btnScore });
      }
      const surfaceScore = scoreSurfaceSelector(r.selector);
      if (surfaceScore > 0 && r.declarations["border-radius"]) {
        surfaceHits.push({ ...r, score: surfaceScore });
      }
    }
  }
  buttonHits.sort((a, b) => b.score - a.score);
  surfaceHits.sort((a, b) => b.score - a.score);

  // Merge declarations across the top N hits (later ones override) so we
  // assemble a "composite" primary-button style. This handles cases where
  // `.btn` sets radius+padding and `.btn-primary` only overrides background.
  const top = buttonHits.slice(0, 5);
  const merged: Record<string, string> = {};
  for (const h of [...top].reverse()) Object.assign(merged, h.declarations);

  let primaryButton: ButtonStyleData | null = top.length ? buildButtonStyle(merged) : null;
  let surface: SurfaceStyleData | null = surfaceHits.length ? buildSurfaceStyle(surfaceHits[0].declarations) : null;

  // Vision pass: ONLY category + agreement check. No pixel estimates.
  if (evidence.screenshotUrl) {
    try {
      const parsedSummary = primaryButton
        ? `Primary button (parsed from CSS): radius=${primaryButton.radiusPx ?? "?"}px, background=${primaryButton.background?.value?.slice(0, 60) ?? "?"}, padding=${primaryButton.paddingX ?? "?"} ${primaryButton.paddingY ?? "?"}.`
        : "No CSS parsed for primary button.";
      const userParts: ChatCompletionContentPart[] = [
        {
          type: "text",
          text: `Look at the primary CTA button(s) in this homepage screenshot. Return strict JSON:
{
  "category": "pill" | "rounded" | "square" | "gradient-pill" | "outline" | "ghost",
  "looks_correct": boolean,    // does the CSS-parsed summary below match what you see?
  "notes": "string (≤120 chars, what you see or what disagrees)"
}
DO NOT estimate pixel values, radii, paddings, or weights — those come from the CSS parse. Your job is category + agreement only.

CSS-parsed summary: ${parsedSummary}`,
        },
        { type: "image_url", image_url: { url: evidence.screenshotDataUrl ?? evidence.screenshotUrl ?? "" } },
      ];
      const c = await withOpenAIConcurrency(() => openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 200,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: userParts }],
      }));
      const raw = c.choices[0]?.message?.content ?? "{}";
      const v = JSON.parse(raw) as { category?: ButtonCategory; looks_correct?: boolean; notes?: string };
      if (primaryButton) {
        const validCats: ButtonCategory[] = ["pill", "rounded", "square", "gradient-pill", "outline", "ghost"];
        if (v.category && validCats.includes(v.category)) {
          // Override category from vision (it's allowed to disagree on shape category)
          primaryButton.category = v.category;
        }
        primaryButton.visionAgreed = v.looks_correct === true;
        primaryButton.visionNotes = (v.notes ?? "").slice(0, 200);
      } else if (v.category) {
        primaryButton = {
          category: v.category,
          radiusPx: null, paddingX: null, paddingY: null, fontWeight: null,
          textTransform: null, background: null, boxShadow: null,
          raw: {}, visionAgreed: false, visionNotes: (v.notes ?? "").slice(0, 200),
        };
      }
    } catch (e) {
      errors.push(`vision agreement check failed: ${String(e)}`);
    }
  }

  if (!primaryButton) {
    return { status: "failed", data: null, confidence: "low", errors: ["no button selectors matched and no vision result"] };
  }

  const status: DimensionResult<ButtonsData>["status"] =
    primaryButton.radiusPx !== null && primaryButton.visionAgreed
      ? "ok"
      : primaryButton.radiusPx !== null || primaryButton.visionAgreed
      ? "partial"
      : "partial";
  const confidence =
    primaryButton.radiusPx !== null && primaryButton.visionAgreed ? "high"
    : primaryButton.radiusPx !== null ? "medium"
    : "low";

  return { status, data: { primaryButton, surface }, confidence, errors };
}
