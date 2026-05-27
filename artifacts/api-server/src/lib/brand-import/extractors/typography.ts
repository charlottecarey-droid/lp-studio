import type * as cheerio from "cheerio";
import type OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { Evidence, DimensionResult, TypographyData, TypographyFont } from "../types";
import { matchFont } from "../font-catalog";
import { withOpenAIConcurrency } from "../openai-semaphore";

interface FontEvidence {
  family: string;
  weights: number[];
  source: TypographyFont["source"];
}

function parseGoogleFontsUrl(url: string): FontEvidence[] {
  // css?family=Inter:wght@400;600;700|Playfair+Display:ital,wght@0,400;1,700&display=swap
  // css2?family=Inter:wght@400;600;700&family=Playfair+Display:wght@400;700&display=swap
  const out: FontEvidence[] = [];
  try {
    const u = new URL(url);
    const families = u.searchParams.getAll("family");
    if (families.length === 0) return out;
    for (const f of families) {
      const [namePart, ...specs] = f.split(":");
      const family = decodeURIComponent(namePart).replace(/\+/g, " ").trim();
      if (!family) continue;
      const weights: number[] = [];
      for (const spec of specs) {
        const wghtMatch = spec.match(/wght@([\d;,]+)/);
        if (wghtMatch) {
          for (const w of wghtMatch[1].split(/[;,]/)) {
            const n = parseInt(w, 10);
            if (Number.isFinite(n)) weights.push(n);
          }
        }
        // older syntax `Inter:400,600,700`
        if (/^[\d,]+$/.test(spec)) {
          for (const w of spec.split(",")) {
            const n = parseInt(w, 10);
            if (Number.isFinite(n)) weights.push(n);
          }
        }
      }
      out.push({ family, weights: [...new Set(weights)], source: "google-link" });
    }
  } catch {
    /* noop */
  }
  return out;
}

async function parseTypekitUrl(url: string): Promise<FontEvidence[]> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    let body = "";
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) return [];
      body = await res.text();
    } finally {
      clearTimeout(t);
    }
    const families = new Set<string>();
    const ffRe = /font-family\s*:\s*["']([^"';]+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = ffRe.exec(body))) {
      const fam = m[1].trim();
      if (fam && !/^tk-/i.test(fam)) families.add(fam);
    }
    return [...families].map((family) => ({ family, weights: [], source: "typekit-link" as const }));
  } catch {
    return [];
  }
}

// Family names that indicate an icon/emoji/symbol font, not a text font.
// Anthropic and webflow.com both load `webflow-icons` as a `@font-face`
// with many weights, which beat the actual body font in the assignRoles
// heuristic. Exclude these from typography candidates entirely.
const ICON_FONT_RE = /icon|emoji|symbol|glyphicons?|fontawesome|font[-_ ]?awesome|webflow-icons|material[-_ ]?icons|tabler[-_ ]?icons|feather[-_ ]?icons|lucide/i;

function isIconFontFamily(family: string): boolean {
  return ICON_FONT_RE.test(family);
}

// Family names that indicate a monospace / code font. These should NOT be
// assigned to the heading or body role even if they're the only candidate
// with a heavy weight — they belong in the `mono` slot. Webflow.com loads
// `Inconsolata` for its inline code snippets and the heading-weight
// heuristic ends up picking it as the H1 face; this filter prevents that.
// Family names that indicate a monospace / code font. Strategy:
//   • generic `mono` / `monospace` is gated on a separator-or-boundary on
//     BOTH sides so it doesn't fire on "Monorail"-style brand names;
//   • known multi-word combos use optional separators (`fira[-_ ]?code`)
//     so "Fira Code" and "FiraCode" both match;
//   • known one-word brand names of code fonts are listed literally.
// The literal-camelCase entries (e.g. `sourcecodepro`) catch the
// no-separator form that the separator-gated rules miss.
const MONO_FONT_RE = /(?:(?:^|[\s_\-])mono(?:space)?(?:$|[\s_\-])|inconsolata|jetbrains[-_ ]?mono|fira[-_ ]?(?:code|mono)|source[-_ ]?code|ibm[-_ ]?plex[-_ ]?mono|roboto[-_ ]?mono|space[-_ ]?mono|courier|consolas|menlo|monaco|cascadia|anonymous[-_ ]?pro|ubuntu[-_ ]?mono|liberation[-_ ]?mono|dejavu[-_ ]?sans[-_ ]?mono|pt[-_ ]?mono|nova[-_ ]?mono|noto[-_ ]?(?:sans[-_ ]?)?mono|geist[-_ ]?mono|wfvisualsans[-_ ]?mono|sourcecodepro|jetbrainsmono|ibmplexmono|robotomono|firacode|firamono|spacemono|geistmono|ptmono|notomono|notosansmono|cascadiacode|cascadiamono|monolisa|operatormono|berkeleymono|commitmono|courierprime|inputmono)/i;

function isMonoFontFamily(family: string): boolean {
  return MONO_FONT_RE.test(family);
}

function parseFontFaceBlocks(css: string): FontEvidence[] {
  const out: FontEvidence[] = [];
  const blockRe = /@font-face\s*\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(css))) {
    const body = m[1];
    const famMatch = body.match(/font-family\s*:\s*["']?([^"';]+)["']?/);
    if (!famMatch) continue;
    const family = famMatch[1].trim();
    if (isIconFontFamily(family)) continue;
    const wMatch = body.match(/font-weight\s*:\s*([\d ]+)/);
    const weights = wMatch
      ? wMatch[1].split(/\s+/).map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n))
      : [];
    out.push({ family, weights, source: "fontface-custom" });
  }
  return out;
}

function detectComputedFamilies($: cheerio.CheerioAPI): { heading: string | null; body: string | null; mono: string | null } {
  // We can't run getComputedStyle, but inline styles + tailwind/utility classes
  // sometimes hint. Best-effort: look at the first <h1> and <p> for `style=`
  // declarations, and the <body>/<html> for fallback families.
  const grabFam = (sel: string): string | null => {
    const el = $(sel).first();
    const style = el.attr("style") ?? "";
    const m = style.match(/font-family\s*:\s*([^;]+)/i);
    if (!m) return null;
    const first = m[1].split(",")[0].trim().replace(/^['"]+|['"]+$/g, "");
    return first || null;
  };
  return {
    heading: grabFam("h1") ?? grabFam("h2"),
    body: grabFam("p") ?? grabFam("body"),
    mono: grabFam("code") ?? grabFam("pre"),
  };
}

function assignRoles(
  candidates: FontEvidence[],
  hints: { heading: string | null; body: string | null; mono: string | null },
): { heading: FontEvidence | null; body: FontEvidence | null; mono: FontEvidence | null } {
  if (!candidates.length) return { heading: null, body: null, mono: null };

  const norm = (s: string): string => s.toLowerCase().trim();
  const byName = new Map<string, FontEvidence>();
  for (const c of candidates) {
    if (!byName.has(norm(c.family))) byName.set(norm(c.family), c);
  }

  const findByHint = (hint: string | null): FontEvidence | null => {
    if (!hint) return null;
    const h = norm(hint);
    return byName.get(h)
      ?? [...byName.values()].find((c) => norm(c.family).includes(h) || h.includes(norm(c.family)))
      ?? null;
  };

  let heading = findByHint(hints.heading);
  let body = findByHint(hints.body);
  // Pull mono out via the strict family-name list, falling back to any
  // candidate matching the same pattern. If the hint resolves to something
  // that IS a mono font, accept it for mono only — never as heading/body.
  let mono = findByHint(hints.mono) ?? [...byName.values()].find((c) => isMonoFontFamily(c.family)) ?? null;
  // If we accidentally picked a mono-family for heading/body, throw it back.
  if (heading && isMonoFontFamily(heading.family)) { mono = mono ?? heading; heading = null; }
  if (body && isMonoFontFamily(body.family)) { mono = mono ?? body; body = null; }

  // Heuristic fallback when no hints land:
  // - heading = candidate with heaviest weight loaded (>=600), else first non-mono
  // - body = candidate with regular weight loaded (300-500), preferring different family from heading
  const nonMono = candidates.filter((c) => !isMonoFontFamily(c.family));
  if (!heading) {
    heading = nonMono.find((c) => c.weights.some((w) => w >= 600))
      ?? nonMono[0]
      ?? null;
  }
  if (!body) {
    body = nonMono.find((c) => c.family !== heading?.family && c.weights.some((w) => w >= 300 && w <= 500))
      ?? nonMono.find((c) => c.family !== heading?.family)
      ?? heading; // single-font sites: body = heading
  }
  // Degenerate case: the only loaded font(s) are mono-family. Better to
  // surface them as heading/body (with the visual penalty of mono text)
  // than to return both as null and downgrade the whole dimension to
  // "failed". This happens on code-heavy / dev-tool sites that only
  // include their syntax-highlighting font in the bundled stylesheet.
  if (!heading && candidates.length) heading = candidates[0];
  if (!body) body = heading;
  return { heading: heading ?? null, body: body ?? null, mono: mono ?? null };
}

function toTypographyFont(ev: FontEvidence | null): TypographyFont | null {
  if (!ev) return null;
  const match = matchFont(ev.family, ev.weights);
  return {
    family: ev.family,
    weights: ev.weights,
    source: ev.source,
    googleFontUrl: match.googleFontUrl,
    fallbackFamily: match.fallbackFamily,
    flag: match.flag,
  };
}

export async function extractTypography(
  evidence: Evidence,
  openai: OpenAI,
): Promise<DimensionResult<TypographyData>> {
  const errors: string[] = [];
  const $ = evidence.$home;
  const candidates: FontEvidence[] = [];

  if ($) {
    // Google Fonts links
    $('link[href*="fonts.googleapis.com" i]').each((_, el) => {
      const href = $(el).attr("href");
      if (href) candidates.push(...parseGoogleFontsUrl(href).filter((c) => !isIconFontFamily(c.family)));
    });
    // Typekit (fetch + parse) — gather URLs, fetch in parallel below
    const typekitUrls: string[] = [];
    $('link[href*="use.typekit.net" i]').each((_, el) => {
      const href = $(el).attr("href");
      if (href) typekitUrls.push(href);
    });
    if (typekitUrls.length) {
      const results = await Promise.all(typekitUrls.map(parseTypekitUrl));
      for (const r of results) candidates.push(...r);
    }
    // @font-face blocks
    $("style").each((_, el) => { candidates.push(...parseFontFaceBlocks($(el).text() ?? "")); });
  }
  for (const s of evidence.stylesheets) candidates.push(...parseFontFaceBlocks(s.css));

  const hints = $ ? detectComputedFamilies($) : { heading: null, body: null, mono: null };

  // If we have ZERO candidates, fall back to LLM on screenshot
  if (!candidates.length) {
    if (!evidence.screenshotUrl) {
      return {
        status: "failed",
        data: null,
        confidence: "low",
        errors: ["no font links, no @font-face, no screenshot"],
      };
    }
    const userParts: ChatCompletionContentPart[] = [
      { type: "text", text: "Identify the heading and body font families used on this homepage. Return JSON: {\"heading\":\"...\",\"body\":\"...\",\"mono\":\"...\"}. Use the canonical family name. If you can't tell, omit." },
      { type: "image_url", image_url: { url: evidence.screenshotDataUrl ?? evidence.screenshotUrl } },
    ];
    let raw = "{}";
    try {
      const c = await withOpenAIConcurrency(() => openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 200,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: userParts }],
      }));
      raw = c.choices[0]?.message?.content ?? "{}";
    } catch (e) {
      errors.push(`LLM fallback failed: ${String(e)}`);
    }
    let parsed: { heading?: string; body?: string; mono?: string } = {};
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }
    const heading = parsed.heading ? toTypographyFont({ family: parsed.heading, weights: [], source: "llm" }) : null;
    const body = parsed.body ? toTypographyFont({ family: parsed.body, weights: [], source: "llm" }) : null;
    const mono = parsed.mono ? toTypographyFont({ family: parsed.mono, weights: [], source: "llm" }) : null;
    if (!heading && !body) {
      return { status: "failed", data: null, confidence: "low", errors: ["LLM fallback returned no families"] };
    }
    return { status: "partial", data: { heading, body, mono }, confidence: "low", errors };
  }

  const roles = assignRoles(candidates, hints);
  const heading = toTypographyFont(roles.heading);
  const body = toTypographyFont(roles.body);
  const mono = toTypographyFont(roles.mono);

  const hasDirect = [heading, body].some((f) => f?.flag === "google-direct");
  const overallConf = hasDirect ? "high" : (heading || body) ? "medium" : "low";
  const status = heading || body ? "ok" : "failed";

  return {
    status,
    data: { heading, body, mono },
    confidence: overallConf as TypographyData extends infer _T ? "high" | "medium" | "low" : never,
    errors,
  };
}
