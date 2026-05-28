/**
 * Workstream C — two-pass critique.
 *
 * After the main composer generates a page, the banned-phrase post-validator
 * (Workstream B) tells us which blocks carry the most clichés / brand-forbidden
 * phrases. This module makes a SECOND, tightly-scoped LLM call that rewrites the
 * copy of only the worst 1–2 blocks, then merges the rewritten text back into
 * the original blocks.
 *
 * Design constraints:
 *  - Non-destructive on failure. Any error, timeout, or malformed response
 *    leaves the original blocks completely untouched (fail-open). The page must
 *    always ship even if the critique pass is slow or the model misbehaves.
 *  - Structure-preserving. We never let the model add/remove keys or touch
 *    non-string values (colors, image URLs, layout enums, CTA links). Only
 *    human-readable *string leaves* that already exist are replaced.
 *  - Hard timeout (default 3s) so the critique never becomes a latency tax on
 *    generation.
 */

import type OpenAI from "openai";
import { rankBlocksByHits, findBannedPhrases, type BannedPhraseHit } from "./banned-phrase-validator";

/** Per-block summary of what the critique pass rewrote, surfaced in the editor. */
export interface CritiqueAnnotation {
  blockId: string;
  blockType: string;
  /** Banned/cliché phrases that were present before the rewrite. */
  removedPhrases: string[];
  /** Whether re-scanning the rewritten block found zero remaining hits. */
  resolved: boolean;
}

export interface CritiqueResult {
  /** The (possibly) rewritten blocks. Same array reference is mutated in place. */
  blocks: unknown[];
  annotations: CritiqueAnnotation[];
  /** True only if a critique LLM call actually ran and produced a merge. */
  critiqued: boolean;
}

export interface CritiqueBrandVoice {
  toneOfVoice?: string | null;
  toneKeywords?: string[] | null;
  avoidPhrases?: string[] | null;
}

interface CritiqueOptions {
  blocks: unknown[];
  bannedPhraseHits: BannedPhraseHit[];
  brand: CritiqueBrandVoice;
  openai: OpenAI | null;
  /** Max blocks to rewrite in one pass. */
  maxBlocks?: number;
  /** Hard timeout for the critique LLM call. */
  timeoutMs?: number;
}

const DEFAULT_MAX_BLOCKS = 2;
const DEFAULT_TIMEOUT_MS = 3000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Key names whose VALUES are never human-readable copy — colors, links, asset
 * paths, layout/theme enums, dimensions, ids. The critique pass must never let
 * the model rewrite these even if it returns a different string, because doing
 * so would silently break brand colors, CTA destinations, or images.
 */
const NON_COPY_KEY_RE =
  /(color|colour|url|href|src|image|img|icon|logo|slug|theme|variant|layout|mode|align|background|gradient|hex|width|height|ratio|position|target|anchor|link|cta|action|email|phone|tel|path|route|domain|host)/i;

function isCopyKey(key: string): boolean {
  if (key === "id" || key === "type") return false;
  return !NON_COPY_KEY_RE.test(key);
}

/**
 * Value-level defense in depth: a string that looks like a URL / link / contact
 * target is never copy, regardless of the key it sits under. This stops a
 * misbehaving model from turning visible copy into a redirect even if the key
 * name slipped past NON_COPY_KEY_RE.
 */
const URLISH_RE = /^\s*(https?:\/\/|\/\/|mailto:|tel:|#|\/[^\s]|www\.)/i;

function isUrlish(s: string): boolean {
  return URLISH_RE.test(s);
}

/**
 * Overlay only human-readable string leaves from `rewritten` onto `original`,
 * recursing through nested objects and arrays. Rules that guarantee the model
 * can only change copy — never structure, colors, links, or images:
 *  - Keys absent from `original` are ignored (no new keys).
 *  - Non-copy keys (see NON_COPY_KEY_RE) keep their original subtree entirely.
 *  - Non-string originals (numbers, booleans, null) are never replaced.
 */
function mergeStringLeaves(original: unknown, rewritten: unknown): unknown {
  if (typeof original === "string") {
    // Only replace plain copy strings; never a URL/link/contact-target value.
    if (typeof rewritten !== "string") return original;
    if (isUrlish(original) || isUrlish(rewritten)) return original;
    return rewritten;
  }
  if (Array.isArray(original)) {
    if (!Array.isArray(rewritten)) return original;
    return original.map((item, i) =>
      i < rewritten.length ? mergeStringLeaves(item, rewritten[i]) : item,
    );
  }
  if (isPlainObject(original)) {
    if (!isPlainObject(rewritten)) return original;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(original)) {
      // Absent in rewrite, or a protected non-copy field → keep original.
      if (!(key in rewritten) || !isCopyKey(key)) {
        out[key] = original[key];
        continue;
      }
      out[key] = mergeStringLeaves(original[key], rewritten[key]);
    }
    return out;
  }
  // numbers, booleans, null — never overwritten.
  return original;
}

function blockId(block: unknown): string | null {
  if (!isPlainObject(block)) return null;
  return typeof block.id === "string" ? block.id : null;
}

function blockType(block: unknown): string {
  if (!isPlainObject(block)) return "unknown";
  return typeof block.type === "string" ? block.type : "unknown";
}

function buildVoiceContext(brand: CritiqueBrandVoice): string {
  const parts: string[] = [];
  if (brand.toneOfVoice) parts.push(`Tone: ${brand.toneOfVoice}`);
  if (brand.toneKeywords?.length) parts.push(`Style keywords: ${brand.toneKeywords.join(", ")}`);
  return parts.join("\n");
}

const CRITIQUE_SYSTEM_PROMPT = [
  "You are a senior B2B copy editor. You are handed 1–2 landing-page content blocks whose copy leans on clichés or banned phrases.",
  "Rewrite the human-readable text so it is specific, concrete, vivid, and on-brand — replace vague hype with substance.",
  "HARD RULES:",
  "- Return ONLY valid JSON, no markdown fences, no commentary.",
  '- Shape: { "blocks": [ { "id": "<same id>", "props": { ...same shape... } } ] }.',
  "- Preserve the EXACT JSON structure of each block's props: keep every key, never add or remove keys.",
  "- Only change string values that are human-readable copy. NEVER change URLs, color hex values, image paths, layout/theme enum values, booleans, or numbers.",
  "- Do not reintroduce any of the banned phrases or their close variants.",
].join("\n");

/**
 * Run the critique pass. Selects the worst 1–2 blocks by banned-phrase hit
 * count, asks the model to rewrite their copy, and merges string leaves back.
 * Mutates `blocks` in place when a rewrite succeeds. Always fail-open.
 */
export async function critiqueAndRewriteBlocks(
  opts: CritiqueOptions,
): Promise<CritiqueResult> {
  const {
    blocks,
    bannedPhraseHits,
    brand,
    openai,
    maxBlocks = DEFAULT_MAX_BLOCKS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts;

  const empty: CritiqueResult = { blocks, annotations: [], critiqued: false };

  if (!openai || !Array.isArray(blocks) || blocks.length === 0) return empty;
  if (!Array.isArray(bannedPhraseHits) || bannedPhraseHits.length === 0) return empty;

  // Pick the worst blocks that still exist in the output.
  const ranked = rankBlocksByHits(bannedPhraseHits);
  const targetIds: string[] = [];
  for (const { blockId: id } of ranked) {
    if (blocks.some((b) => blockId(b) === id)) targetIds.push(id);
    if (targetIds.length >= maxBlocks) break;
  }
  if (targetIds.length === 0) return empty;

  const targets = targetIds
    .map((id) => blocks.find((b) => blockId(b) === id))
    .filter((b): b is Record<string, unknown> => isPlainObject(b));
  if (targets.length === 0) return empty;

  const phrasesByBlock = new Map<string, Set<string>>();
  for (const hit of bannedPhraseHits) {
    if (!targetIds.includes(hit.blockId)) continue;
    if (!phrasesByBlock.has(hit.blockId)) phrasesByBlock.set(hit.blockId, new Set());
    phrasesByBlock.get(hit.blockId)!.add(hit.phrase);
  }

  const voiceContext = buildVoiceContext(brand);
  const bannedList = [
    ...new Set(bannedPhraseHits.filter((h) => targetIds.includes(h.blockId)).map((h) => h.phrase)),
  ];
  const userPrompt = [
    voiceContext ? `BRAND VOICE:\n${voiceContext}\n` : "",
    `Banned/cliché phrases that MUST be removed (and not replaced with close variants): ${bannedList.join(", ")}.`,
    "",
    "Rewrite the copy in these blocks:",
    JSON.stringify({ blocks: targets.map((b) => ({ id: b.id, type: b.type, props: b.props })) }),
  ]
    .filter(Boolean)
    .join("\n");

  let rewritten: { blocks?: Array<{ id?: unknown; props?: unknown }> };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o",
        temperature: 0.7,
        max_completion_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CRITIQUE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      },
      { signal: controller.signal },
    );
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) return empty;
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    rewritten = JSON.parse(cleaned);
  } catch {
    // Timeout, abort, network error, or invalid JSON — ship the original page.
    return empty;
  } finally {
    clearTimeout(timer);
  }

  if (!rewritten || !Array.isArray(rewritten.blocks)) return empty;

  const rewrittenById = new Map<string, unknown>();
  for (const rb of rewritten.blocks) {
    if (isPlainObject(rb) && typeof rb.id === "string") {
      rewrittenById.set(rb.id, rb.props);
    }
  }

  const annotations: CritiqueAnnotation[] = [];
  let didRewrite = false;
  for (const target of targets) {
    const id = target.id as string;
    if (!rewrittenById.has(id)) continue;
    const mergedProps = mergeStringLeaves(target.props, rewrittenById.get(id));
    target.props = mergedProps;
    didRewrite = true;

    // Re-scan the merged block so the annotation reports whether the rewrite
    // actually cleared the phrases (vs. the model leaving some behind).
    const residual = findBannedPhrases([target], brand.avoidPhrases ?? []);
    annotations.push({
      blockId: id,
      blockType: blockType(target),
      removedPhrases: [...(phrasesByBlock.get(id) ?? [])],
      resolved: residual.length === 0,
    });
  }

  if (!didRewrite) return empty;
  return { blocks, annotations, critiqued: true };
}
