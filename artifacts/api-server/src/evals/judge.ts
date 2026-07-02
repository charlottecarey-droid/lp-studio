/**
 * Optional thin LLM judge for the generation evals — OFF by default, enabled
 * with EVAL_LLM_JUDGE=1 (checked by run.ts, not here).
 *
 * The deterministic scorers in scorers.ts are the gate; the judge only adds a
 * soft copy-quality reading (specificity, voice, fabrication smell) that is
 * recorded in the report but NEVER fails a run on its own. It reuses the AI
 * proxy conventions from generate-page.ts (AI_INTEGRATIONS_OPENAI_BASE_URL /
 * AI_INTEGRATIONS_OPENAI_API_KEY) and the same generation model family.
 */
import OpenAI from "openai";
import type { EvalBlock, GenerationResultLike } from "./types";

export interface JudgeVerdict {
  /** 0–10 overall copy quality (10 = ship it). */
  score: number;
  /** One-paragraph rationale. */
  verdict: string;
  /** Concrete problems the judge saw (fabricated-sounding claims, generic
   *  filler, tone mismatches). */
  issues: string[];
}

const JUDGE_MODEL = process.env["EVAL_LLM_JUDGE_MODEL"] || "gpt-4o";
const MAX_COPY_CHARS = 12_000;

function getJudgeClient(): OpenAI {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    throw new Error(
      "EVAL_LLM_JUDGE=1 requires AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY.",
    );
  }
  return new OpenAI({ baseURL, apiKey, timeout: 60_000 });
}

/** Flatten a page's human-visible copy into a compact text digest. */
export function flattenPageCopy(result: GenerationResultLike): string {
  const lines: string[] = [];
  if (typeof result.title === "string" && result.title) lines.push(`TITLE: ${result.title}`);
  const blocks = Array.isArray(result.blocks) ? result.blocks : [];
  const walk = (node: unknown, depth: number): void => {
    if (depth > 6 || lines.join("\n").length > MAX_COPY_CHARS) return;
    if (typeof node === "string") {
      const t = node.trim();
      // Skip URLs/ids/hex colors — the judge reads copy, not plumbing.
      if (t && !/^https?:\/\//.test(t) && !/^#[0-9a-f]{3,8}$/i.test(t) && t.length > 2) lines.push(t);
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) walk(child, depth + 1);
      return;
    }
    if (node && typeof node === "object") {
      for (const v of Object.values(node as Record<string, unknown>)) walk(v, depth + 1);
    }
  };
  for (const b of blocks) {
    const type = typeof (b as EvalBlock).type === "string" ? (b as EvalBlock).type : "block";
    lines.push(`--- ${String(type)} ---`);
    walk((b as EvalBlock).props, 0);
  }
  return lines.join("\n").slice(0, MAX_COPY_CHARS);
}

const JUDGE_SYSTEM_PROMPT = [
  "You are a strict landing-page copy reviewer for an AI page generator.",
  "You receive the brief that produced a page and the page's flattened copy.",
  "Score 0-10 for shippable quality. Penalize: fabricated-sounding statistics or customer stories,",
  "generic buzzword filler, copy that ignores the brief's audience, placeholder text, and tone drift.",
  "Reward: specific, brand-grounded, audience-aware copy.",
  'Respond with ONLY a JSON object: {"score": number, "verdict": string, "issues": string[]}.',
].join(" ");

export async function judgeGeneration(input: {
  briefId: string;
  briefDescription: string;
  prompt: string;
  result: GenerationResultLike;
}): Promise<JudgeVerdict> {
  const client = getJudgeClient();
  const completion = await client.chat.completions.create({
    model: JUDGE_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: JUDGE_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `BRIEF (${input.briefId}): ${input.briefDescription}`,
          `USER PROMPT: ${input.prompt}`,
          "",
          "GENERATED PAGE COPY:",
          flattenPageCopy(input.result),
        ].join("\n"),
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: { score?: unknown; verdict?: unknown; issues?: unknown };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    parsed = {};
  }
  const score = typeof parsed.score === "number" && Number.isFinite(parsed.score)
    ? Math.min(10, Math.max(0, parsed.score))
    : 0;
  return {
    score,
    verdict: typeof parsed.verdict === "string" ? parsed.verdict : "judge returned no verdict",
    issues: Array.isArray(parsed.issues) ? parsed.issues.filter((i): i is string => typeof i === "string") : [],
  };
}
