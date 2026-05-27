import type * as cheerio from "cheerio";
import type { Evidence, DimensionResult, LogoCandidate, LogosData } from "../types";

// cheerio re-exports node types from domhandler which isn't a direct dep here;
// using `cheerio.AnyNode` (re-exported in cheerio 1.x) keeps us off that path.
type CheerioNode = ReturnType<cheerio.CheerioAPI>[number];

function inferFormat(url: string): LogoCandidate["format"] {
  const u = url.toLowerCase().split("?")[0];
  if (u.endsWith(".svg")) return "svg";
  if (u.endsWith(".png")) return "png";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "jpg";
  if (u.endsWith(".ico")) return "ico";
  if (u.endsWith(".webp")) return "webp";
  if (u.includes("data:image/svg")) return "svg";
  if (u.includes("data:image/png")) return "png";
  return "unknown";
}

function parseDim(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function extractLogos(evidence: Evidence): Promise<DimensionResult<LogosData>> {
  const errors: string[] = [];
  const $ = evidence.$home;
  if (!$) {
    return { status: "failed", data: null, confidence: "low", errors: ["no parsed HTML"] };
  }

  const base = evidence.homeUrl;
  const candidates: LogoCandidate[] = [];
  const seen = new Set<string>();
  const push = (c: LogoCandidate): void => {
    if (seen.has(c.url)) return;
    seen.add(c.url);
    candidates.push(c);
  };
  const abs = (u: string | undefined): string | null => {
    if (!u) return null;
    try {
      return new URL(u, base).toString();
    } catch {
      return null;
    }
  };

  // 1. <link rel="icon"|"shortcut icon"|"apple-touch-icon"> + OG image
  $('link[rel~="icon"], link[rel~="shortcut"], link[rel~="apple-touch-icon"], link[rel~="mask-icon"]').each((_, el) => {
    const href = abs($(el).attr("href"));
    if (!href) return;
    const rel = ($(el).attr("rel") ?? "").toLowerCase();
    const sizesAttr = $(el).attr("sizes") ?? "";
    const sizeMatch = sizesAttr.match(/(\d+)x(\d+)/);
    const area = sizeMatch ? Number(sizeMatch[1]) * Number(sizeMatch[2]) : null;
    push({
      url: href,
      source: rel.includes("apple-touch") ? "apple-touch-icon" : "favicon",
      format: inferFormat(href),
      estimatedArea: area,
      transparent: null,
      score: 0,
    });
  });
  const og = abs($('meta[property="og:image"]').attr("content"))
    ?? abs($('meta[name="og:image"]').attr("content"))
    ?? abs($('meta[name="twitter:image"]').attr("content"));
  if (og) {
    push({ url: og, source: "og", format: inferFormat(og), estimatedArea: null, transparent: null, score: 0 });
  }

  // 2. Header logos: <img>/<svg> inside <header> or first <nav>, alt/src/class matching logo
  const containerSelector = "header, nav, [class*='header' i], [class*='navbar' i], [class*='nav-bar' i], [id*='header' i]";
  const footerSelector = "footer, [class*='footer' i], [id*='footer' i]";
  const inspect = (root: cheerio.Cheerio<CheerioNode>, src: "header" | "footer"): void => {
    root.find("img").each((_: number, el: CheerioNode) => {
      const $el = $(el);
      const altRaw = $el.attr("alt") ?? "";
      const srcRaw = $el.attr("src") ?? $el.attr("data-src") ?? "";
      const clsRaw = $el.attr("class") ?? "";
      const haystack = `${altRaw} ${srcRaw} ${clsRaw}`.toLowerCase();
      const looksLogo = /logo|wordmark|brand|mark/.test(haystack);
      const url = abs(srcRaw);
      if (!url || !looksLogo) return;
      const w = parseDim($el.attr("width"));
      const h = parseDim($el.attr("height"));
      const area = w && h ? w * h : null;
      push({
        url,
        source: src,
        format: inferFormat(url),
        estimatedArea: area,
        transparent: null,
        score: 0,
      });
    });
    // Inline SVGs (we can't easily extract them, but if there's a <use href> or
    // <image href> pointing at an external file, use that)
    root.find("svg image, svg use").each((_: number, el: CheerioNode) => {
      const href = $(el).attr("href") ?? $(el).attr("xlink:href");
      const url = abs(href);
      if (!url) return;
      const parent = $(el).closest("[class],[id]");
      const haystack = `${parent.attr("class") ?? ""} ${parent.attr("id") ?? ""}`.toLowerCase();
      if (!/logo|wordmark|brand|mark/.test(haystack)) return;
      push({ url, source: src === "header" ? "svg-alt" : src, format: inferFormat(url), estimatedArea: null, transparent: true, score: 0 });
    });
  };
  inspect($(containerSelector).first(), "header");
  inspect($(footerSelector).first(), "footer");

  // 3. Any IMG with class/alt explicitly containing "logo" anywhere in the doc
  $('img[alt*="logo" i], img[class*="logo" i], img[src*="logo" i]').each((_, el) => {
    const $el = $(el);
    const url = abs($el.attr("src") ?? $el.attr("data-src"));
    if (!url) return;
    const w = parseDim($el.attr("width"));
    const h = parseDim($el.attr("height"));
    push({
      url,
      source: "svg-alt",
      format: inferFormat(url),
      estimatedArea: w && h ? w * h : null,
      transparent: null,
      score: 0,
    });
  });

  // Score: header strongly preferred; SVG bonus; favicons get a small score
  // so they always rank last but stay as alternates.
  const sourceWeight: Record<LogoCandidate["source"], number> = {
    header: 100,
    "svg-alt": 60,
    og: 40,
    footer: 35,
    "apple-touch-icon": 20,
    favicon: 10,
  };
  const formatBonus: Record<LogoCandidate["format"], number> = {
    svg: 30,
    png: 20,
    webp: 18,
    jpg: 10,
    ico: 0,
    unknown: 5,
  };
  for (const c of candidates) {
    const area = c.estimatedArea ?? 0;
    const areaBonus = area > 0 ? Math.min(40, Math.log2(area + 1) * 3) : 0;
    c.score = sourceWeight[c.source] + formatBonus[c.format] + areaBonus;
  }
  candidates.sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    return {
      status: "failed",
      data: null,
      confidence: "low",
      errors: ["no logo candidates found"],
    };
  }

  const def = candidates[0];
  const status: DimensionResult<LogosData>["status"] =
    def.source === "favicon" && candidates.length === 1 ? "partial" : "ok";
  const confidence =
    def.source === "header" || def.source === "svg-alt"
      ? "high"
      : def.source === "footer" || def.source === "og"
      ? "medium"
      : "low";

  return {
    status,
    data: { defaultLogoUrl: def.url, alternates: candidates.slice(0, 8) },
    confidence,
    errors,
  };
}
