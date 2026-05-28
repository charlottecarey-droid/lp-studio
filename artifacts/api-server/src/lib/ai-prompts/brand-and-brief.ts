/**
 * Shared brand + brief prompt builders for AI copy endpoints.
 *
 * Used by:
 *   - POST /lp/copy-generate            (block refresh + field Sparkle)
 *   - POST /lp/custom-blocks/generate   (custom-block AI draft)
 *   - POST /lp/seo-meta-generate        (per-page SEO metadata)
 *
 * The goal is a single brand serializer that reads BOTH the legacy flat
 * voice fields (toneOfVoice / toneKeywords / avoidPhrases / copyExamples)
 * AND the new structured `voiceProfile.profile.*` block populated by the
 * URL brand-importer. Endpoints that built their own narrow brand prompts
 * were silently dropping the highest-signal voice fields.
 */
import { db } from "@workspace/db";
import { lpBrandSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────

export interface ProductLine {
  name: string;
  description: string;
  valueProps: string[];
  claims: string[];
  keywords: string[];
}

export interface MessagingPillar {
  label: string;
  description: string;
}

/** Structured voice profile populated by the URL brand-importer. Mirrors
 *  `ImportedVoiceProfile.profile` in `lp-studio/src/lib/brand-config.ts`. */
export interface VoiceProfileBlock {
  tone?: string[];
  formality?: 1 | 2 | 3 | 4 | 5;
  sentenceLengthAvg?: "short" | "medium" | "long";
  vocabularyRegister?: "everyday" | "industry" | "specialist";
  signaturePhrases?: string[];
  forbiddenPhrases?: string[];
  summary?: string;
}

export interface VoiceProfileWrapper {
  profile?: VoiceProfileBlock;
}

/** Backend mirror of the subset of `BrandConfig` we read for prompts. */
export interface BrandConfig {
  brandName?: string;
  companyDescription?: string;
  taglines?: string[];
  toneOfVoice?: string;
  toneKeywords?: string[];
  avoidPhrases?: string[];
  copyExamples?: string[];
  copyInstructions?: string;
  targetAudience?: string;
  messagingPillars?: MessagingPillar[];
  productLines?: ProductLine[];
  defaultCtaText?: string;
  voiceProfile?: VoiceProfileWrapper;
}

export interface SegmentContext {
  id?: string;
  name?: string;
  description?: string;
  messagingAngle?: string;
  uniqueContext?: string;
  valueProps?: string[];
  personas?: { role: string; painPoints: string[] }[];
  challenges?: { title: string; desc: string }[];
}

export interface BriefContext {
  company?: string;
  objective?: string;
  valueProps?: string[];
  toneGuidance?: string;
  suggestedHeadline?: string;
  segmentContext?: SegmentContext;
}

// ── DB load ───────────────────────────────────────────────────────────────

export async function fetchBrand(tenantId: number): Promise<BrandConfig> {
  try {
    const rows = await db
      .select()
      .from(lpBrandSettingsTable)
      .where(eq(lpBrandSettingsTable.tenantId, tenantId))
      .limit(1);
    if (rows.length === 0) return {};
    return (rows[0].config as BrandConfig) ?? {};
  } catch {
    return {};
  }
}

// ── Brand prompt ──────────────────────────────────────────────────────────

const FORMALITY_LABEL: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "very casual / conversational",
  2: "casual",
  3: "balanced",
  4: "professional",
  5: "very formal / corporate",
};

const SENTENCE_LEN_LABEL: Record<"short" | "medium" | "long", string> = {
  short: "short, punchy sentences",
  medium: "medium-length sentences",
  long: "long, flowing sentences",
};

const VOCAB_LABEL: Record<"everyday" | "industry" | "specialist", string> = {
  everyday: "everyday vocabulary accessible to non-experts",
  industry: "industry-standard vocabulary, light jargon ok",
  specialist: "specialist vocabulary, expert audience",
};

/** True iff the brand has any signal worth serializing. */
export function hasBrandSignal(brand: BrandConfig): boolean {
  return Boolean(
    brand.brandName ||
      brand.toneOfVoice ||
      (brand.toneKeywords?.length ?? 0) > 0 ||
      (brand.avoidPhrases?.length ?? 0) > 0 ||
      (brand.copyExamples?.length ?? 0) > 0 ||
      (brand.messagingPillars?.length ?? 0) > 0 ||
      (brand.productLines?.length ?? 0) > 0 ||
      brand.voiceProfile?.profile,
  );
}

export function hasStructuredVoiceProfile(brand: BrandConfig): boolean {
  const p = brand.voiceProfile?.profile;
  if (!p) return false;
  return Boolean(
    (p.tone?.length ?? 0) > 0 ||
      p.formality ||
      p.sentenceLengthAvg ||
      p.vocabularyRegister ||
      (p.signaturePhrases?.length ?? 0) > 0 ||
      (p.forbiddenPhrases?.length ?? 0) > 0 ||
      p.summary,
  );
}

/**
 * Build the brand voice system prompt. Reads both legacy flat fields
 * and the new structured `voiceProfile.profile.*` block. Returns "" when
 * the brand has no usable signal — callers fall back to a generic preamble.
 */
export function buildBrandSystemPrompt(brand: BrandConfig): string {
  if (!hasBrandSignal(brand)) return "";

  const parts: string[] = [];

  if (brand.brandName) {
    parts.push(`You are writing copy for ${brand.brandName}.`);
  }
  if (brand.companyDescription) {
    parts.push(`About the company: ${brand.companyDescription}`);
  }
  if (brand.taglines?.length) {
    parts.push(`Taglines: ${brand.taglines.join(" | ")}`);
  }

  // ── Structured voice profile (new, from URL importer) ──────────────────
  const vp = brand.voiceProfile?.profile;
  if (vp) {
    const voiceLines: string[] = [];
    if (vp.summary) voiceLines.push(`Voice summary: ${vp.summary}`);
    if (vp.tone?.length) voiceLines.push(`Tone tags: ${vp.tone.join(", ")}`);
    if (vp.formality) voiceLines.push(`Formality: ${FORMALITY_LABEL[vp.formality]} (${vp.formality}/5)`);
    if (vp.sentenceLengthAvg) voiceLines.push(`Cadence: ${SENTENCE_LEN_LABEL[vp.sentenceLengthAvg]}`);
    if (vp.vocabularyRegister) voiceLines.push(`Vocabulary: ${VOCAB_LABEL[vp.vocabularyRegister]}`);
    if (vp.signaturePhrases?.length) {
      voiceLines.push(`Signature phrases (use naturally, do not over-use): ${vp.signaturePhrases.join(", ")}`);
    }
    if (vp.forbiddenPhrases?.length) {
      voiceLines.push(`Forbidden phrases (NEVER use these or close variants): ${vp.forbiddenPhrases.join(", ")}`);
    }
    if (voiceLines.length) {
      parts.push(`BRAND VOICE PROFILE — match this voice in every sentence:\n${voiceLines.join("\n")}`);
    }
  }

  // ── Legacy flat voice fields ───────────────────────────────────────────
  if (brand.toneOfVoice) parts.push(`Tone of voice: ${brand.toneOfVoice}.`);
  if (brand.toneKeywords?.length) parts.push(`Style keywords: ${brand.toneKeywords.join(", ")}.`);
  if (brand.avoidPhrases?.length && !vp?.forbiddenPhrases?.length) {
    parts.push(`Never use: ${brand.avoidPhrases.join(", ")}.`);
  }
  if (brand.targetAudience) parts.push(`Audience: ${brand.targetAudience}.`);
  if (brand.copyInstructions?.trim()) parts.push(brand.copyInstructions.trim());

  if (brand.messagingPillars?.length) {
    const themes = brand.messagingPillars
      .map((p) => `${p.label}: ${p.description}`)
      .join("; ");
    parts.push(`Always reflect one of these themes: ${themes}.`);
  }

  // Voice anchor — exemplar headlines/CTAs are the single highest-leverage
  // tone signal. Phrasing mirrored from custom-blocks-generate.ts.
  if (brand.copyExamples?.length) {
    parts.push(
      `WRITE IN THIS VOICE — match the rhythm, sentence length, vocabulary, and specificity of these example headlines and CTAs from the brand's existing marketing. Treat them as the gold standard your output is compared against:\n${brand.copyExamples
        .map((e) => `- ${e}`)
        .join("\n")}`,
    );
  }

  if (brand.productLines?.length) {
    const productInfo = brand.productLines
      .filter((p) => p.name)
      .map((p) => {
        const bits = [`- ${p.name}`];
        if (p.description) bits.push(`  Description: ${p.description}`);
        if (p.valueProps?.length) bits.push(`  Value props: ${p.valueProps.join(", ")}`);
        if (p.claims?.length) bits.push(`  Claims: ${p.claims.join(", ")}`);
        if (p.keywords?.length) bits.push(`  Keywords: ${p.keywords.join(", ")}`);
        return bits.join("\n");
      })
      .join("\n");
    if (productInfo) {
      parts.push(`Product lines:\n${productInfo}\nUse relevant product details when generating copy.`);
    }
  }

  if (brand.defaultCtaText) {
    parts.push(`Default CTA style: "${brand.defaultCtaText}"`);
  }

  parts.push(
    'CAPITALIZATION: Always use sentence casing. Capitalize only the first word of each sentence and proper nouns / official product names. NEVER title-case headlines or subheadlines. BAD: "More Cases, Less Drama" — GOOD: "More cases, less drama".',
  );

  return parts.join("\n");
}

// ── Brief prompt ──────────────────────────────────────────────────────────

export function hasBriefSignal(brief: BriefContext | null | undefined): boolean {
  if (!brief) return false;
  return Boolean(
    brief.company ||
      brief.objective ||
      brief.suggestedHeadline ||
      (brief.valueProps?.length ?? 0) > 0 ||
      brief.toneGuidance ||
      brief.segmentContext?.name,
  );
}

export function buildBriefContextPrompt(brief: BriefContext): string {
  if (!hasBriefSignal(brief)) return "";

  const parts: string[] = [];
  if (brief.company) parts.push(`This copy is for: ${brief.company}`);
  if (brief.objective) parts.push(`Campaign objective: ${brief.objective}`);
  if (brief.suggestedHeadline) parts.push(`Suggested headline direction: "${brief.suggestedHeadline}"`);
  if (brief.valueProps?.length) {
    parts.push(`Key value props to emphasize:\n${brief.valueProps.map((v) => `- ${v}`).join("\n")}`);
  }
  if (brief.toneGuidance) parts.push(`Tone guidance: ${brief.toneGuidance}`);

  const seg = brief.segmentContext;
  if (seg?.name) {
    const segParts: string[] = [`Audience segment: ${seg.name}`];
    if (seg.description) segParts.push(`Description: ${seg.description}`);
    if (seg.messagingAngle) segParts.push(`Messaging angle: ${seg.messagingAngle}`);
    if (seg.uniqueContext) segParts.push(`Unique context: ${seg.uniqueContext}`);
    if (seg.valueProps?.length) {
      segParts.push(`Segment value props:\n${seg.valueProps.map((v) => `- ${v}`).join("\n")}`);
    }
    if (seg.personas?.length) {
      const ps = seg.personas
        .map((p) => `${p.role} (pain points: ${p.painPoints.join(", ")})`)
        .join("; ");
      segParts.push(`Key personas: ${ps}`);
    }
    if (seg.challenges?.length) {
      const cs = seg.challenges.map((c) => `${c.title}: ${c.desc}`).join("; ");
      segParts.push(`Challenges to address: ${cs}`);
    }
    parts.push(segParts.join("\n"));
  }

  return [
    "ACTIVE CAMPAIGN BRIEF — Use this as voice, audience, and tone guidance.",
    parts.join("\n"),
    "IMPORTANT: This brief is supporting context, not topic direction. If the field being rewritten already has copy, your job is to rewrite THAT copy in the brief's voice — keep the original topic, intent, and concrete specifics intact. Do not replace specific content with generic segment messaging.",
  ].join("\n");
}

// ── Missing-voice-profile observability ───────────────────────────────────
//
// One-time log per tenant when the brand has no structured voice profile
// (so we know which tenants would benefit from running the URL brand
// importer). In-memory only — re-logs after a process restart, which is
// the intent (a deploy is a good time to re-surface the list).

const _loggedMissingVoice = new Set<number>();

export function noteMissingVoiceProfile(opts: {
  tenantId: number;
  endpoint: string;
  brand: BrandConfig;
}): void {
  if (hasStructuredVoiceProfile(opts.brand)) return;
  if (_loggedMissingVoice.has(opts.tenantId)) return;
  _loggedMissingVoice.add(opts.tenantId);
  console.warn(
    `[ai-copy] tenant ${opts.tenantId} has no structured voice profile (endpoint=${opts.endpoint}). Run URL brand importer to populate voiceProfile.profile.*`,
  );
}

// ── Per-call observability ────────────────────────────────────────────────

export interface CopyCallLog {
  endpoint: string;
  tenantId: number;
  briefPresent: boolean;
  blockType?: string;
  sparkleMode?: string;
  promptTokens?: number;
  completionTokens?: number;
  success: boolean;
  errorMessage?: string;
}

export function logCopyCall(log: CopyCallLog): void {
  // Single-line JSON so it's easy to grep / parse out of structured logs.
  try {
    console.log(`[ai-copy] ${JSON.stringify(log)}`);
  } catch {
    // never let logging crash the request
  }
}
