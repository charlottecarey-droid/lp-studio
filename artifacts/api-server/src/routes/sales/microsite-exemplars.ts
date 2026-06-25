/**
 * Microsite exemplars used as few-shot examples in the AI microsite generation
 * prompt. Exemplars are the "gold standard" of what a great generated microsite
 * looks like — the AI is asked to study them and match the register, specificity
 * and structure (not copy them verbatim).
 *
 * The built-in (hardcoded) exemplars have been removed. Tenants now supply their
 * own exemplars from Brand Settings ("Your microsite exemplars"), stored on
 * `salesConsole.customMicrositeExemplars` and handled by parseCustomExemplars /
 * formatExemplarsSection below. `EXEMPLARS` is intentionally an empty array and
 * is kept only so the selector + formatter signatures stay stable for callers.
 */

export interface MicrositeExemplarPage {
  title: string;
  slug: string;
  blocks: Array<{ type: string; props: Record<string, unknown> }>;
}

export interface MicrositeExemplar {
  /** Stable id used for logging which exemplars were sent for a given run. */
  id: string;
  /** Audience segment id this exemplar applies to (matched against the live `segment.id`). */
  audience: string;
  /**
   * Lowercase substrings to match against the account's `segment` field.
   * The selector boosts exemplars whose hints appear in the segment
   * string (case-insensitive). Empty array = no segment-specific boost.
   */
  segmentHints: string[];
  /** Human-readable scenario label inserted into the prompt header. */
  scenario: string;
  /** The example microsite payload (matches the Block[] return shape). */
  page: MicrositeExemplarPage;
}

/**
 * Built-in exemplars were removed — tenants supply their own via Brand Settings.
 * Kept as an (empty) export so pickExemplars and any callers keep compiling.
 */
export const EXEMPLARS: MicrositeExemplar[] = [];

/**
 * Pick the exemplars most relevant to a given audience + account segment.
 *
 * With the built-in exemplars removed, EXEMPLARS is empty, so this returns an
 * empty array — callers fall back gracefully (the EXEMPLARS section is omitted,
 * and any tenant-authored custom exemplars are added separately). The signature
 * is preserved so existing callers don't need to change.
 */
export function pickExemplars(
  segmentId: string,
  accountSegment: string | null | undefined,
  max = 2,
  opts: { useBuiltIn?: boolean } = {},
): MicrositeExemplar[] {
  if (opts.useBuiltIn === false) return [];
  const eligible = EXEMPLARS.filter(e => e.audience === segmentId);
  if (eligible.length === 0) return [];

  const seg = (accountSegment ?? "").trim().toLowerCase();
  if (!seg) return eligible.slice(0, max);

  const matches = (e: MicrositeExemplar) =>
    e.segmentHints.some(h => {
      const hint = h.trim().toLowerCase();
      return hint.length > 0 && (seg.includes(hint) || hint.includes(seg));
    });

  const boosted = eligible.filter(matches);
  const others = eligible.filter(e => !matches(e));
  return [...boosted, ...others].slice(0, max);
}

/**
 * A tenant-authored microsite reference page (free-form text) used as a few-shot
 * style example. This is the generic, white-label path: any tenant can supply
 * their own exemplars from Brand Settings. Stored on
 * `salesConsole.customMicrositeExemplars`.
 */
export interface CustomMicrositeExemplar {
  /** Short scenario/audience label shown in the prompt header. */
  label: string;
  /** The example microsite copy or a detailed description of a great page. */
  content: string;
}

/**
 * Parse + validate tenant-authored custom exemplars off the brand config blob.
 * Drops entries with no usable `content`. Capped at 3 to keep token usage in
 * check.
 */
export function parseCustomExemplars(v: unknown): CustomMicrositeExemplar[] {
  if (!Array.isArray(v)) return [];
  // Bound per-exemplar size so a tenant pasting a huge document can't blow up
  // the prompt token budget (or get silently truncated by the model).
  const MAX_LABEL = 200;
  const MAX_CONTENT = 4000;
  const out: CustomMicrositeExemplar[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const label = typeof obj.label === "string" ? obj.label.trim().slice(0, MAX_LABEL) : "";
    const content = typeof obj.content === "string" ? obj.content.trim().slice(0, MAX_CONTENT) : "";
    if (!content) continue;
    out.push({ label, content });
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * Format the picked exemplars as a prompt section. Built-in exemplars are
 * emitted as page JSON; tenant `custom` exemplars are emitted as free-form text.
 * Returns "" when both inputs are empty so the prompt builder can drop the
 * section cleanly via filter(Boolean).
 */
export function formatExemplarsSection(
  exemplars: MicrositeExemplar[],
  custom: CustomMicrositeExemplar[] = [],
  // When TRUE, this page's block lineup + order are fixed by a configured
  // outline (a segment/brand page outline in Brand Settings) or a template.
  // In that case the exemplars must NOT carry the "don't reproduce this layout /
  // choose your own lineup" framing — that contradicts the authored outline and
  // pushes the model to drift off the configured structure. The outline is
  // authoritative for structure; the exemplars are then voice/quality refs only.
  opts: { layoutIsAuthored?: boolean } = {},
): string {
  if (exemplars.length === 0 && custom.length === 0) return "";

  const intro = [
    opts.layoutIsAuthored
      ? "EXEMPLARS — these are the gold standard for the QUALITY of a great microsite: voice, register, level of specificity, and information density. Study them for THOSE qualities and match them. This page's block lineup and section order are already set by the configured outline below — follow that outline exactly. The exemplars are voice and quality references only, not a competing layout. Do NOT copy their words — write something equally good, in the brand's own voice, for the new account."
      : "EXEMPLARS — these are the gold standard for the QUALITY of a great microsite: voice, register, level of specificity, and information density. Study them for THOSE qualities. Their block selection and section order are just ONE example, NOT a layout to reproduce — choose the section lineup and order that best fit THIS account (follow the LAYOUT rules below). Do NOT copy their words OR their structure — write something equally good, but structurally its own, for the new account.",
    "",
  ].join("\n");

  const builtInBlocks = exemplars.map((e, i) => {
    const json = JSON.stringify(e.page, null, 2);
    return `EXAMPLE ${i + 1} — ${e.scenario}:\n${json}`;
  });

  const customBlocks = custom.map((e, i) => {
    const n = exemplars.length + i + 1;
    const label = e.label || "Reference microsite";
    return `EXAMPLE ${n} — ${label}:\n${e.content}`;
  });

  const blocks = [...builtInBlocks, ...customBlocks].join("\n\n");

  const outro = [
    "",
    "The microsite you generate should feel like it belongs alongside these. If yours doesn't measure up, rewrite it before returning.",
  ].join("\n");

  return [intro, blocks, outro].join("\n");
}
