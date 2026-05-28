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
// Per-extractor launch stagger. Five of the six extractors (everything
// but logos) make at least one OpenAI call as their first action; if all
// six kick off in the same tick, the AI proxy 429s the back half of the
// burst and voice — being the last in the launch order with two
// sequential calls — loses every time. A 150ms gap between launches
// spreads the first call from each extractor across ~900ms total, which
// is well within the proxy's per-minute window and below the noise
// threshold against the 25s master budget.
const LAUNCH_STAGGER_MS = 150;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function staggered<T>(index: number, fn: () => Promise<T>): Promise<T> {
  if (index <= 0) return fn();
  return delay(LAUNCH_STAGGER_MS * index).then(fn);
}

// Per-extractor budget. Voice gets the lion's share because it makes
// the most sequential LLM calls (profile + optional rewrite + score) and
// is the one most likely to be rate-limited by the AI proxy. The others
// at 20s have always landed comfortably.
function budgetFor(name: DimensionName): number {
  if (name === "voice") return 23_000;
  return PER_EXTRACTOR_BUDGET_MS;
}

// Wrap a staggered launch so the timeout clock starts AFTER the stagger
// resolves — otherwise the late-stagger extractors eat their headroom
// just waiting in line. Total time bounded by stagger + budget, but
// because launches are <1s apart this stays well under the 25s master.
function launchWithBudget<T>(
  index: number,
  name: DimensionName,
  fn: () => Promise<T>,
): Promise<T> {
  if (index <= 0) return withTimeout(fn(), budgetFor(name), name);
  return delay(LAUNCH_STAGGER_MS * index).then(() => withTimeout(fn(), budgetFor(name), name));
}

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

  // Kick off all six extractors with a small launch stagger (see
  // LAUNCH_STAGGER_MS above). logos goes first with zero stagger since
  // it's deterministic-only — no OpenAI hit, no rate-limit concern.
  // voice goes last because it makes the most LLM calls (profile +
  // optional rewrite + optional score), so it benefits most from
  // landing after the earlier burst has released its slots.
  const tasks: { name: DimensionName; promise: Promise<DimensionResult<unknown>> }[] = [
    { name: "logos", promise: launchWithBudget(0, "logos", () => extractLogos(evidence)) },
    { name: "colors", promise: launchWithBudget(1, "colors", () => extractColors(evidence, openai)) },
    { name: "typography", promise: launchWithBudget(2, "typography", () => extractTypography(evidence, openai)) },
    { name: "buttons", promise: launchWithBudget(3, "buttons", () => extractButtons(evidence, openai)) },
    { name: "photography", promise: launchWithBudget(4, "photography", () => extractPhotography(evidence, openai)) },
    { name: "voice", promise: launchWithBudget(5, "voice", () => extractVoice(evidence, openai)) },
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
