import { getOpenAIClient } from "../../routes/lp/brand-import";
import { buildEvidence } from "./evidence";
import { extractLogos } from "./extractors/logos";
import { extractColors } from "./extractors/colors";
import { extractTypography } from "./extractors/typography";
import { extractButtons } from "./extractors/buttons";
import { extractPhotography } from "./extractors/photography";
import { extractVoice } from "./extractors/voice";
import { getCached, putCached } from "./cache";
import type {
  Confidence,
  DimensionName,
  DimensionResult,
  Evidence,
  OrchestratorPayload,
  StreamEvent,
} from "./types";

// Evidence build has its own 7s cap. Extractors then get their own
// 12s budget from the moment evidence is in hand — a vision call into
// GPT regularly costs 4-7s and we want all six dimensions to actually
// land in the streamed result, not race a shared 12s clock that
// evidence already half-consumed.
const EXTRACTOR_PHASE_BUDGET_MS = 25_000;
const PER_EXTRACTOR_BUDGET_MS = 20_000;
const CACHE_MAX_AGE_HOURS = 24;

interface Options {
  forceRefresh?: boolean;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race<T>([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

function failedResult<T>(error: string): DimensionResult<T> {
  return { status: "failed", data: null, confidence: "low", errors: [error] };
}

// Map per-dimension results onto the existing BrandConfig flat-field shape so
// the existing brand-settings review UI can pick them up as `proposed[field]`
// + `confidence[field]`. Anything that doesn't map to an existing field is
// surfaced via the new typed sub-objects on the payload.
function flattenForProposed(results: OrchestratorPayload["results"]): {
  proposed: Record<string, unknown>;
  confidence: Record<string, Confidence>;
} {
  const proposed: Record<string, unknown> = {};
  const confidence: Record<string, Confidence> = {};
  const put = (field: string, value: unknown, conf: Confidence): void => {
    proposed[field] = value;
    confidence[field] = conf;
  };

  if (results.logos.status !== "failed" && results.logos.data) {
    put("logoUrl", results.logos.data.defaultLogoUrl, results.logos.confidence);
    if (results.logos.data.alternates.length > 1) {
      put("logoAlternates", results.logos.data.alternates, results.logos.confidence);
    }
  }

  if (results.colors.status !== "failed" && results.colors.data) {
    const c = results.colors.data;
    const conf = results.colors.confidence;
    put("primaryColor", c.primary, conf);
    put("accentColor", c.accent, conf);
    put("pageBackground", c.pageBackground, conf);
    put("cardBackground", c.cardBackground, conf);
    put("textColor", c.text, conf);
    put("ctaBackground", c.ctaBackground, conf);
    put("ctaText", c.ctaText, conf);
    put("navBgColor", c.navBgColor, conf);
    put("navText", c.navText, conf);
    put("borderColor", c.borderColor, conf);
    c.secondary.slice(0, 5).forEach((hex, i) => put(`secondary${i + 1}`, hex, conf));
  }

  if (results.typography.status !== "failed" && results.typography.data) {
    const t = results.typography.data;
    const conf = results.typography.confidence;
    if (t.heading) {
      put("displayFont", t.heading.fallbackFamily ?? t.heading.family, conf);
      if (t.heading.googleFontUrl) put("displayFontUrl", t.heading.googleFontUrl, conf);
    }
    if (t.body) {
      put("bodyFont", t.body.fallbackFamily ?? t.body.family, conf);
      if (t.body.googleFontUrl) put("bodyFontUrl", t.body.googleFontUrl, conf);
    }
  }

  if (results.buttons.status !== "failed" && results.buttons.data?.primaryButton) {
    const b = results.buttons.data.primaryButton;
    const conf = results.buttons.confidence;
    // Map vision category → enum
    const radiusMap: Record<string, "pill" | "rounded" | "slight" | "square"> = {
      pill: "pill", "gradient-pill": "pill",
      rounded: "rounded", outline: "rounded", ghost: "rounded",
      square: "square",
    };
    put("buttonRadius", radiusMap[b.category] ?? "rounded", conf);
    if (b.boxShadow) {
      const shadow = /none/.test(b.boxShadow) ? "none"
        : /0\s*0\s*0/.test(b.boxShadow) ? "none"
        : /\d+px/.test(b.boxShadow) ? (b.boxShadow.length > 60 ? "lg" : b.boxShadow.length > 30 ? "md" : "sm")
        : "sm";
      put("buttonShadow", shadow, conf);
    }
    if (b.fontWeight !== null) {
      const wMap: [number, "normal" | "medium" | "semibold" | "bold"][] = [[450, "normal"], [550, "medium"], [650, "semibold"], [1000, "bold"]];
      const matched = wMap.find(([thr]) => b.fontWeight! < thr)?.[1] ?? "semibold";
      put("buttonFontWeight", matched, conf);
    }
    if (b.textTransform) {
      const tcase = b.textTransform.toLowerCase().includes("upper") ? "uppercase"
        : b.textTransform.toLowerCase().includes("capital") ? "capitalize"
        : "normal";
      put("buttonTextCase", tcase, conf);
    }
    if (b.category === "outline") put("secondaryButtonStyle", "outline", conf);
    else if (b.category === "ghost") put("secondaryButtonStyle", "ghost", conf);
    put("buttonStyleRaw", b, conf);
    if (results.buttons.data.surface) put("surfaceStyle", results.buttons.data.surface, conf);
  }

  if (results.photography.status !== "failed" && results.photography.data) {
    put("photographyProfile", results.photography.data, results.photography.confidence);
  }

  if (results.voice.status !== "failed" && results.voice.data) {
    const v = results.voice.data;
    const conf = results.voice.confidence;
    put("voiceProfile", v, conf);
    put("toneOfVoice", v.profile.summary, conf);
    if (v.profile.tone.length) put("toneKeywords", v.profile.tone, conf);
    if (v.profile.forbiddenPhrases.length) put("avoidPhrases", v.profile.forbiddenPhrases, conf);
  }

  return { proposed, confidence };
}

export async function* runOrchestrator(
  url: string,
  firecrawlApiKey: string,
  opts: Options = {},
): AsyncGenerator<StreamEvent, void, undefined> {
  const startedAt = Date.now();

  if (!opts.forceRefresh) {
    const cached = await getCached(url, CACHE_MAX_AGE_HOURS);
    if (cached) {
      yield { event: "start", sourceUrl: cached.sourceUrl, pagesScraped: cached.pagesScraped, hasScreenshot: cached.hasScreenshot, sampledPalette: cached.sampledPalette, robots: cached.robots };
      const dims: DimensionName[] = ["logos", "colors", "typography", "buttons", "photography", "voice"];
      for (const d of dims) yield { event: "dimension", dimension: d, result: cached.results[d] };
      yield { event: "done", payload: { ...cached, cached: true } };
      return;
    }
  }

  let evidence: Evidence;
  try {
    evidence = await withTimeout(buildEvidence(url, firecrawlApiKey), 7_000, "evidence");
  } catch (e) {
    yield { event: "error", error: `evidence build failed: ${String(e)}` };
    return;
  }

  yield {
    event: "start",
    sourceUrl: evidence.homeUrl,
    pagesScraped: evidence.pages.map((p) => p.url),
    hasScreenshot: !!evidence.screenshotUrl,
    sampledPalette: evidence.sampledPalette,
    robots: evidence.robots,
  };

  let openai;
  try {
    openai = getOpenAIClient();
  } catch (e) {
    yield { event: "error", error: `openai client unavailable: ${String(e)}` };
    return;
  }

  // Kick off all six extractors in parallel. We stream each result as it
  // lands; whichever haven't landed at master-budget time emit `failed`.
  const tasks: { name: DimensionName; promise: Promise<DimensionResult<unknown>> }[] = [
    { name: "logos", promise: withTimeout(extractLogos(evidence), PER_EXTRACTOR_BUDGET_MS, "logos") },
    { name: "colors", promise: withTimeout(extractColors(evidence, openai), PER_EXTRACTOR_BUDGET_MS, "colors") },
    { name: "typography", promise: withTimeout(extractTypography(evidence, openai), PER_EXTRACTOR_BUDGET_MS, "typography") },
    { name: "buttons", promise: withTimeout(extractButtons(evidence, openai), PER_EXTRACTOR_BUDGET_MS, "buttons") },
    { name: "photography", promise: withTimeout(extractPhotography(evidence, openai), PER_EXTRACTOR_BUDGET_MS, "photography") },
    { name: "voice", promise: withTimeout(extractVoice(evidence, openai), PER_EXTRACTOR_BUDGET_MS, "voice") },
  ];

  const remaining = new Map<DimensionName, Promise<DimensionResult<unknown>>>();
  for (const t of tasks) {
    remaining.set(t.name, t.promise.catch((e) => failedResult<unknown>(String(e))));
  }

  const results: OrchestratorPayload["results"] = {
    logos: failedResult("not yet run"),
    colors: failedResult("not yet run"),
    typography: failedResult("not yet run"),
    buttons: failedResult("not yet run"),
    photography: failedResult("not yet run"),
    voice: failedResult("not yet run"),
  };

  // Wrap each remaining promise so we know which dimension settled.
  const settle = (name: DimensionName, p: Promise<DimensionResult<unknown>>): Promise<{ name: DimensionName; result: DimensionResult<unknown> }> =>
    p.then((r) => ({ name, result: r }));

  const queue: Promise<{ name: DimensionName; result: DimensionResult<unknown> }>[] = [];
  for (const [name, p] of remaining) queue.push(settle(name, p));

  const masterDeadline = Date.now() + EXTRACTOR_PHASE_BUDGET_MS;

  while (queue.length > 0) {
    const remainingMs = masterDeadline - Date.now();
    if (remainingMs <= 0) {
      for (const name of remaining.keys()) {
        const r = failedResult<unknown>("timeout: master budget exceeded");
        (results as Record<DimensionName, DimensionResult<unknown>>)[name] = r;
        yield { event: "dimension", dimension: name, result: r };
      }
      break;
    }
    const timeoutPromise = new Promise<{ __timeout: true }>((resolve) =>
      setTimeout(() => resolve({ __timeout: true }), remainingMs),
    );
    const next = await Promise.race([Promise.race(queue), timeoutPromise]);
    if ("__timeout" in next) {
      for (const name of remaining.keys()) {
        const r = failedResult<unknown>("timeout: master budget exceeded");
        (results as Record<DimensionName, DimensionResult<unknown>>)[name] = r;
        yield { event: "dimension", dimension: name, result: r };
      }
      break;
    }
    const { name, result } = next;
    (results as Record<DimensionName, DimensionResult<unknown>>)[name] = result;
    remaining.delete(name);
    // Remove the resolved promise from queue
    const idx = queue.findIndex(async (q) => (await q).name === name);
    if (idx >= 0) queue.splice(idx, 1);
    // Actually simpler/safer: rebuild queue from remaining
    queue.length = 0;
    for (const [n, p] of remaining) queue.push(settle(n, p));
    yield { event: "dimension", dimension: name, result };
  }

  const { proposed, confidence } = flattenForProposed(results);

  const payload: OrchestratorPayload = {
    sourceUrl: evidence.homeUrl,
    pagesScraped: evidence.pages.map((p) => p.url),
    sampledPalette: evidence.sampledPalette,
    hasScreenshot: !!evidence.screenshotUrl,
    robots: evidence.robots,
    results,
    proposed,
    confidence,
    unparsed: [],
    durationMs: Date.now() - startedAt,
    cached: false,
  };

  // Best-effort cache write (failures non-fatal, already swallowed in cache.ts)
  void putCached(evidence.homeUrl, payload);

  yield { event: "done", payload };
}
