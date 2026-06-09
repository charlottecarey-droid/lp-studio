import type * as cheerio from "cheerio";
import type OpenAI from "openai";
import type { Evidence, DimensionResult, VoiceData, VoiceProfile } from "../types";
import { withOpenAIConcurrency } from "../openai-semaphore";

type CheerioNode = ReturnType<cheerio.CheerioAPI>[number];

interface CorpusEntry {
  source: string;
  text: string;
}

function buildCorpusFromHtml($: cheerio.CheerioAPI, sourceLabel: string, opts: { firstParagraphs: number }): CorpusEntry[] {
  const out: CorpusEntry[] = [];
  const clean = (s: string): string => s.replace(/\s+/g, " ").trim();
  const skipSel = "header, nav, footer, [class*='nav' i], [class*='footer' i], [class*='cookie' i], [class*='banner' i], [class*='blog' i], [class*='post' i], article time";

  // hero h1 / h2 / subhead
  const h1 = clean($("h1").first().text());
  if (h1) out.push({ source: `${sourceLabel}:h1`, text: h1 });
  const h2 = clean($("h2").first().text());
  if (h2 && h2 !== h1) out.push({ source: `${sourceLabel}:h2`, text: h2 });

  // first N <p> blocks in main/sections (skip nav/footer/blog)
  let count = 0;
  $("main p, section p, article p").each((_: number, el: CheerioNode) => {
    if (count >= opts.firstParagraphs) return;
    const $el = $(el);
    if ($el.closest(skipSel).length) return;
    const t = clean($el.text());
    if (t.length < 40) return;
    out.push({ source: `${sourceLabel}:p${count + 1}`, text: t });
    count++;
  });

  // primary CTA text
  const cta = clean($("a.btn, a.button, a.cta, button.primary, button.btn-primary, a[class*='cta' i]").first().text());
  if (cta && cta.length < 60) out.push({ source: `${sourceLabel}:cta`, text: cta });

  return out;
}

function corpusFromMarkdown(md: string, sourceLabel: string, maxParas: number): CorpusEntry[] {
  const out: CorpusEntry[] = [];
  const lines = md.split(/\n{2,}/).map((l) => l.trim()).filter(Boolean);
  let n = 0;
  for (const line of lines) {
    if (n >= maxParas) break;
    if (/^!\[|^\[!|^<|^[#>*-]/.test(line)) continue; // skip images/blockquotes/lists/headings
    const stripped = line.replace(/\[(.+?)\]\(.+?\)/g, "$1").replace(/[*_`]/g, "").trim();
    if (stripped.length < 40) continue;
    out.push({ source: `${sourceLabel}:md${n + 1}`, text: stripped });
    n++;
  }
  return out;
}

function corpusToWordCount(corpus: CorpusEntry[]): number {
  return corpus.reduce((n, e) => n + e.text.split(/\s+/).length, 0);
}

async function llmCall(openai: OpenAI, system: string, user: string, maxTokens: number): Promise<string> {
  const c = await withOpenAIConcurrency(() => openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  }));
  return c.choices[0]?.message?.content?.trim() ?? "{}";
}

async function extractProfile(openai: OpenAI, corpus: CorpusEntry[]): Promise<VoiceProfile | null> {
  const system = `You are a brand-voice analyst. Given a corpus of homepage / about / product copy from a single brand, return a structured voice profile as strict JSON:
{
  "tone": string[2-3]   // pick 2-3 from: authoritative, warm, playful, technical, clinical, urgent, reassuring, irreverent, friendly, confident, witty
  "formality": 1 | 2 | 3 | 4 | 5,   // 1=casual chat, 5=corporate formal
  "sentenceLengthAvg": "short" | "medium" | "long",
  "vocabularyRegister": "everyday" | "industry" | "specialist",
  "signaturePhrases": string[3-5],   // recurring phrases or tics observed in the corpus
  "forbiddenPhrases": string[0-5],   // corporate-speak the brand AVOIDS (inferred from absences — e.g. if every page says "tools" never "platform", "platform" is forbidden)
  "summary": "string (one sentence describing the voice)"
}
Return ONLY valid JSON. Do not include anything not directly supported by the corpus.`;

  const userPayload = corpus.map((e) => `[${e.source}] ${e.text}`).join("\n\n");
  // Profile call gets a single retry-with-backoff. The Replit AI proxy
  // 429s under burst load when all 6 extractors hit it within a few
  // hundred ms of each other; the orchestrator's launch stagger spreads
  // the initial calls, and this retry covers the residual case where
  // voice's call still lands on a saturated minute-window. 600ms is
  // long enough to clear the proxy's short rate-limit window without
  // eating significantly into the per-extractor budget.
  let raw = "{}";
  try {
    raw = await llmCall(openai, system, userPayload, 800);
  } catch (firstErr) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      raw = await llmCall(openai, system, userPayload, 800);
    } catch {
      // Surface the first error in logs even though we swallow it —
      // useful when debugging persistent proxy outages.
      void firstErr;
      return null;
    }
  }
  let parsed: Partial<VoiceProfile> = {};
  try { parsed = JSON.parse(raw); } catch { return null; }

  const validTones = new Set(["authoritative", "warm", "playful", "technical", "clinical", "urgent", "reassuring", "irreverent", "friendly", "confident", "witty"]);
  const tone = Array.isArray(parsed.tone)
    ? parsed.tone.filter((t): t is string => typeof t === "string" && validTones.has(t)).slice(0, 3)
    : [];
  const formality = (typeof parsed.formality === "number" && parsed.formality >= 1 && parsed.formality <= 5
    ? (Math.round(parsed.formality) as VoiceProfile["formality"])
    : 3);
  const sentenceLengthAvg = parsed.sentenceLengthAvg ?? "medium";
  const vocabularyRegister = parsed.vocabularyRegister ?? "industry";

  return {
    tone: tone.length ? tone : ["confident"],
    formality,
    sentenceLengthAvg: (["short", "medium", "long"].includes(sentenceLengthAvg) ? sentenceLengthAvg : "medium") as VoiceProfile["sentenceLengthAvg"],
    vocabularyRegister: (["everyday", "industry", "specialist"].includes(vocabularyRegister) ? vocabularyRegister : "industry") as VoiceProfile["vocabularyRegister"],
    signaturePhrases: Array.isArray(parsed.signaturePhrases)
      ? parsed.signaturePhrases.filter((s): s is string => typeof s === "string" && s.length < 100).slice(0, 5)
      : [],
    forbiddenPhrases: Array.isArray(parsed.forbiddenPhrases)
      ? parsed.forbiddenPhrases.filter((s): s is string => typeof s === "string" && s.length < 100).slice(0, 5)
      : [],
    summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 300) : "",
  };
}

async function selfCheck(
  openai: OpenAI,
  profile: VoiceProfile,
  source: string,
): Promise<{ score: number; rewrite: string }> {
  // 1. Ask LLM to rewrite source sentence in the extracted profile
  let rewrite = source;
  try {
    const sys = "You rewrite sentences in a specified brand voice. Return JSON {\"rewrite\":\"...\"}.";
    const user = `Voice profile:\n${JSON.stringify(profile)}\n\nRewrite this sentence in that voice, preserving the meaning:\n${source}`;
    const raw = await llmCall(openai, sys, user, 300);
    const p = JSON.parse(raw) as { rewrite?: string };
    if (typeof p.rewrite === "string" && p.rewrite.trim()) rewrite = p.rewrite.trim();
  } catch {
    return { score: 0, rewrite };
  }

  // 2. Ask a second LLM to score similarity 0-1
  try {
    const sys = "You score how well a rewrite matches a source's brand voice. Return JSON {\"score\":0..1,\"reasoning\":\"short\"}. 1.0 = indistinguishable from source. 0 = clearly different brand.";
    const user = `Source: ${source}\n\nRewrite: ${rewrite}`;
    const raw = await llmCall(openai, sys, user, 200);
    const p = JSON.parse(raw) as { score?: number };
    const score = typeof p.score === "number" ? Math.max(0, Math.min(1, p.score)) : 0;
    return { score, rewrite };
  } catch {
    return { score: 0, rewrite };
  }
}

export async function extractVoice(
  evidence: Evidence,
  openai: OpenAI,
): Promise<DimensionResult<VoiceData>> {
  const errors: string[] = [];

  // Build initial corpus from home + about + one product/feature page
  let corpus: CorpusEntry[] = [];
  if (evidence.$home) {
    corpus.push(...buildCorpusFromHtml(evidence.$home, "home", { firstParagraphs: 2 }));
  }
  for (const page of evidence.pages.slice(1)) {
    if (page.rawHtml) {
      try {
        const cheerioMod = await import("cheerio");
        const $$ = cheerioMod.load(page.rawHtml);
        const label = new URL(page.url).pathname.replace(/\//g, "") || "page";
        corpus.push(...buildCorpusFromHtml($$, label, { firstParagraphs: 2 }));
      } catch { /* fall back to markdown below */ }
    }
    if (!page.rawHtml && page.markdown) {
      const label = new URL(page.url).pathname.replace(/\//g, "") || "page";
      corpus.push(...corpusFromMarkdown(page.markdown, label, 2));
    }
  }
  // If we couldn't build any HTML corpus, fall back to home markdown
  if (corpus.length < 2 && evidence.pages[0]?.markdown) {
    corpus.push(...corpusFromMarkdown(evidence.pages[0].markdown, "home-md", 3));
  }

  // Deduplicate
  const seen = new Set<string>();
  corpus = corpus.filter((e) => {
    const k = e.text.slice(0, 80);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (!corpus.length) {
    return { status: "failed", data: null, confidence: "low", errors: ["no corpus could be built"] };
  }

  let profile = await extractProfile(openai, corpus);
  if (!profile) {
    return { status: "failed", data: null, confidence: "low", errors: ["LLM voice extraction failed"] };
  }

  // Self-check is best-effort under a tight subbudget. The 20s per-extractor
  // cap can't accommodate profile + rewrite + score sequentially against a
  // warm proxy 100% of the time, so we race the two-call self-check against
  // an 8s timer and degrade gracefully when it doesn't finish. Profile alone
  // is enough to return `ok` — the self-check is a confidence signal, not a
  // gating check.
  const sourceSentence = corpus.find((e) => e.text.split(/\s+/).length >= 8)?.text ?? corpus[0].text;
  const SELF_CHECK_BUDGET_MS = 8_000;
  let check: { score: number | null; rewrite: string } = { score: null, rewrite: sourceSentence };
  let timeoutHandle: NodeJS.Timeout | undefined;
  try {
    const timeoutPromise = new Promise<{ score: number | null; rewrite: string }>((resolve) => {
      timeoutHandle = setTimeout(() => resolve({ score: null, rewrite: sourceSentence }), SELF_CHECK_BUDGET_MS);
    });
    check = await Promise.race([
      selfCheck(openai, profile, sourceSentence).then((c) => ({ score: c.score as number | null, rewrite: c.rewrite })),
      timeoutPromise,
    ]);
  } catch {
    /* keep null/sourceSentence default */
  } finally {
    // Cancel the pending timer when the self-check wins the race so we don't
    // hold a live timer for up to 8s after the function returns.
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }

  if (check.score === null) {
    errors.push("self-check skipped (budget exceeded or call failed)");
  } else if (check.score < 0.6) {
    errors.push(`self-check score ${check.score.toFixed(2)} below 0.6 threshold`);
  }

  // Profile present ⇒ ok. Self-check failure only downgrades confidence.
  const confidence: "high" | "medium" | "low" =
    check.score !== null && check.score >= 0.6 ? "high"
    : check.score !== null ? "low"
    : "medium";

  return {
    status: "ok",
    data: {
      profile,
      selfCheckScore: check.score,
      selfCheckSourceSentence: sourceSentence,
      selfCheckRewrite: check.rewrite,
    },
    confidence,
    errors,
  };
}
