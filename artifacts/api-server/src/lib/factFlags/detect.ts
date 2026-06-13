// Task #1138 — surface-agnostic fact detection for the Strict Facts review flow.
//
// Detects three kinds of reviewable fact in AI-generated content:
//   • stat  — a numeric stat ("47%", "3,000+ patients", "2.5x ROI")
//   • claim — a named-entity claim ("Trusted by Fortune 500", "Featured in Forbes")
//   • quote — customer quotes (quoted text + attribution, and the contents of
//             Testimonial / PullQuote / QuoteBlock blocks)
//
// Detection is deliberately conservative — it errs toward NOT flagging on
// ambiguous quotes (only quoted text with a nearby attribution, or an explicit
// quote-bearing block, is treated as a quote). Approval filtering and regen
// memory happen later in write.ts; this module only finds candidates.
import type { DetectedFact, QuoteAttribution } from "./types";
import { normalizedFormFor } from "./normalize";

// Stat-shaped value: a number followed by a recognised unit/entity. Mirrors the
// long-standing STAT_LIKE_RX in generate-page.ts (word suffixes use \b; %/+ use
// a non-alnum lookahead since they aren't word chars).
const STAT_LIKE_RX =
  /\b\d[\d,]*(?:\.\d+)?\s*(?:%(?![A-Za-z0-9])|\+(?![A-Za-z0-9])|(?:x|k|m)\b|(?:million|billion|customers?|patients?|practices?|locations?|users?|members?|reviews?|stars?|days?|hours?|minutes?|years?|months?|weeks?)\b)/i;

const STAT_FIELD_KEYS = new Set([
  "value", "stat", "metric", "stat1value", "stat2value", "stat3value",
]);

// Numeric-looking text that is NOT a factual stat and must never be flagged:
//   • time / ratio shorthand — "24/7", "9-5", "1-5" (two small integers joined
//     by / or -, with NO decimal so ratings like "4.9/5" stay real stats).
//   • imperative UI-instruction copy — starts with an action verb
//     ("Select 1–5 locations", "Choose…", "Pick…", "Enter…").
//   • a numeric SELECTION range used as an instruction — "1–5 locations"
//     (low–high + a word, with no %/+/x/k/m strong-stat marker).
// Kept conservative: real stats ("$129/arch", "98%", "4.9/5", "8,000+ dentists")
// fall through. This guard is shared with generate-page.ts's telemetry scanner so
// the persisted flags and the telemetry warnings agree.
const TIME_RATIO_IDIOM_RX = /^\d{1,2}\s*[/\u2013\u2014-]\s*\d{1,2}$/;
// Unambiguous UI-action verbs only — kept narrow so a marketing headline that
// merely starts with a common verb (e.g. "Set a new record: 98% uptime") is not
// dropped as an instruction.
const IMPERATIVE_RX =
  /^(select|choose|pick|enter|click|tap|drag|toggle|upload|browse|filter|search)\b/i;
const SELECTION_RANGE_RX = /\b\d{1,3}\s*[\u2013\u2014-]\s*\d{1,3}\s+[a-z]/i;
const STRONG_STAT_MARKER_RX = /[%+]|\b(?:x|k|m)\b/i;
// Comparative / benefit qualifiers that turn an otherwise-everyday numeric range
// into a reviewable performance CLAIM. "3–5 business days" / "3–5 locations" are
// everyday ranges, but "3–5 more leads", "10–20 additional signups", or a bare
// "3–5" sitting under a label like "more revenue" are quantitative result claims
// product wants reviewed. We look at the value AND its sibling label/units so a
// range whose unit lives in the label (not the value) is still caught.
const RANGE_BENEFIT_RX =
  /\b(?:more|less|fewer|extra|additional|faster|slower|higher|lower|greater|better|bigger|stronger|double|triple|increase[ds]?|boost(?:ed|s)?|grow(?:th|s|n)?|leads?|sales|revenue|sign-?ups?|conversions?|roi|deals?)\b/i;

/** Concatenate any human-readable sibling label/heading values describing a
 *  numeric value, so range/idiom detection can read the units that often live in
 *  the label rather than the value itself (e.g. value "3–5", label "more leads").
 *  Shared by detect + generate-page telemetry so flags and warnings agree. */
export function siblingLabelText(siblings: Record<string, unknown> | undefined): string {
  if (!siblings) return "";
  const out: string[] = [];
  for (const [k, v] of Object.entries(siblings)) {
    if (typeof v !== "string") continue;
    if (!SIBLING_LABEL_KEYS.includes(k.toLowerCase())) continue;
    const s = stripHtml(v).trim();
    if (s && s.length <= 120) out.push(s);
  }
  return out.join(" ");
}

export function isNonStatIdiom(value: string, context?: string): boolean {
  const t = stripHtml(value).trim();
  if (!t) return true;
  const rangeLike = TIME_RATIO_IDIOM_RX.test(t) || SELECTION_RANGE_RX.test(t);
  // A numeric range chased by a comparative/benefit qualifier — in the value OR
  // its sibling label — is a performance claim, not an everyday range. Review it.
  if (rangeLike) {
    const combined = context ? `${t} ${stripHtml(context)}` : t;
    if (RANGE_BENEFIT_RX.test(combined)) return false;
  }
  if (TIME_RATIO_IDIOM_RX.test(t)) return true;
  if (IMPERATIVE_RX.test(t)) return true;
  if (SELECTION_RANGE_RX.test(t) && !STRONG_STAT_MARKER_RX.test(t)) return true;
  return false;
}

// Fields that carry a human-readable label/heading describing a sibling value.
const SIBLING_LABEL_KEYS = ["label", "caption", "title", "heading", "name", "description"];
const BLOCK_HEADING_KEYS = ["eyebrow", "headline", "heading", "title", "subheadline", "label"];

/** Best human-readable context for a detected value: a sibling descriptive
 *  field (e.g. `props.stats[].label`) or, failing that, the block's heading. */
function captureContext(
  siblings: Record<string, unknown>,
  blockProps: Record<string, unknown> | undefined,
  ownText: string,
): string {
  const own = stripHtml(ownText).trim().toLowerCase();
  const pick = (obj: Record<string, unknown>, keys: string[]): string => {
    const lower: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) lower[k.toLowerCase()] = v;
    for (const key of keys) {
      const v = lower[key];
      if (typeof v === "string") {
        const s = stripHtml(v).trim();
        if (s && s.length <= 120 && s.toLowerCase() !== own) return s;
      }
    }
    return "";
  };
  const sibling = pick(siblings, SIBLING_LABEL_KEYS);
  if (sibling) return sibling;
  return blockProps ? pick(blockProps, BLOCK_HEADING_KEYS) : "";
}

// Block types whose primary content is a customer quote.
const QUOTE_BLOCK_TYPES = new Set([
  "testimonial", "testimonials", "pull-quote", "pullquote", "quote",
  "quote-block", "quoteblock", "blockquote", "dso-case-study",
  "dso-success-stories",
]);

// Field keys that carry a quote body inside a quote-bearing block.
const QUOTE_FIELD_KEYS = new Set(["quote", "testimonial", "pullquote", "body", "text"]);
// Sibling field keys that carry the attribution for a quote.
const ATTR_NAME_KEYS = ["author", "name", "attribution", "person", "by"];
const ATTR_TITLE_KEYS = ["title", "role", "position"];
const ATTR_COMPANY_KEYS = ["company", "organization", "org", "practice"];

// Named-entity claim: a trigger phrase + a capitalised entity. Superlative /
// adjective claims ("fastest", "most reliable") are explicitly OUT of scope.
//
// The claim detector targets ONLY external-validation claims a tenant must prove
// ("Trusted by Fortune 500", "Featured in Forbes", "Partnered with Microsoft") —
// NOT imperative calls-to-action ("Partner with Dandy today") and NOT
// self-positioning about the selling brand itself ("Acme is your trusted lab").
//
// "partner" is matched in its DECLARATIVE forms — "partnered with", "in
// partnership with", "a partner of", or a third-party subject's "X partners
// with Y". The declarative "partners with" trigger is kept, but the bare
// sentence-initial imperative "Partner with <brand>" is a CTA and is removed by
// the imperative-CTA guard (CTA_IMPERATIVE_RX) inside isClaim, not by the
// trigger regex — so "Every practice partners with Acme" still fires while
// "Partner with Dandy today" does not.
const CLAIM_TRIGGER_RX =
  /\b(trusted by|partnered with|in partnership with|a partner of|partners with|backed by|featured (?:in|on)|as seen (?:in|on)|recognized by|certified by|accredited by|winner of|named (?:one of|the)?|ranked|rated|#1|number one)\b/i;
// A capitalised proper-noun entity (1-4 tokens), allowing & . and digits.
const ENTITY_RX = /\b([A-Z][A-Za-z0-9&.]+(?:\s+[A-Z][A-Za-z0-9&.]+){0,3})\b/;
const ENTITY_RX_G = /\b([A-Z][A-Za-z0-9&.]+(?:\s+[A-Z][A-Za-z0-9&.]+){0,3})\b/g;

// Imperative-CTA leading verbs. A clause that BEGINS with one of these is a
// call-to-action, not a factual claim: "Partner with Dandy", "Join the future",
// "Get started", "Book a demo", "Talk to sales", "Switch to us", "Sign up",
// "Schedule a call", "Start free". Distinct from the stat-side IMPERATIVE_RX
// (UI-instruction verbs) — these are marketing-CTA verbs.
const CTA_IMPERATIVE_RX =
  /^(partner|join|get|start|book|talk|switch|sign|schedule|try|see|discover|explore|request|claim|grab|unlock|reach|contact|call|learn|shop|order|subscribe|register|download|upgrade)\b/i;

/** Strip surrounding punctuation / brand-suffix tokens for a forgiving
 *  case-insensitive entity-equality test against the selling brand name. */
function normalizeEntity(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Split a string into clauses on sentence/segment boundaries so an imperative
 *  CTA tucked after an em-dash or sentence break ("Ready to transform? — Partner
 *  with Dandy today") is evaluated as its own clause. */
function splitClauses(text: string): string[] {
  return text
    .split(/[.!?;—–]|(?:\s[-]\s)|\n/)
    .map((c) => c.trim())
    .filter(Boolean);
}

// Quoted span with an em-dash / hyphen attribution right after it, e.g.
//   "Best decision we made." — Dr. Lopez, Smile Co.
const ATTRIBUTED_QUOTE_RX =
  /"([^"]{12,400})"\s*[\u2014\u2013-]+\s*([A-Z][^"<\n]{1,80})/;

function isAttribution(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return v.length > 0 && v.length <= 120 ? v : undefined;
}

function pickAttribution(siblings: Record<string, unknown>): QuoteAttribution {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(siblings)) lower[k.toLowerCase()] = v;
  const find = (keys: string[]): string | undefined => {
    for (const k of keys) {
      const got = isAttribution(lower[k]);
      if (got) return got;
    }
    return undefined;
  };
  return {
    name: find(ATTR_NAME_KEYS),
    title: find(ATTR_TITLE_KEYS),
    company: find(ATTR_COMPANY_KEYS),
  };
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isClaim(value: string, brandName?: string): boolean {
  const text = stripHtml(value);
  if (!CLAIM_TRIGGER_RX.test(text)) return false;
  const brandKey = brandName ? normalizeEntity(brandName) : "";

  // Evaluate per-clause so a CTA after a sentence break ("Ready to transform? —
  // Partner with Dandy today") is judged on the clause that holds the trigger,
  // and so the imperative test reads the verb that actually leads that clause.
  for (const clause of splitClauses(text)) {
    if (!CLAIM_TRIGGER_RX.test(clause)) continue;

    // 1) Imperative-CTA exclusion: a clause that begins with a CTA action verb
    //    ("Partner with…", "Join…", "Get…") is a call-to-action, not a claim.
    if (CTA_IMPERATIVE_RX.test(clause)) continue;

    // Require a capitalised entity that is NOT merely the first word of the
    // clause (drop the leading word before testing) — keeps it conservative.
    const afterFirst = clause.replace(/^\s*\S+\s*/, "");

    // 2) Self-positioning exclusion: when a selling-brand name is known, an
    //    entity that IS that brand does not count as external validation. The
    //    claim only stands if some OTHER capitalised entity is present.
    if (brandKey) {
      const entities = afterFirst.match(ENTITY_RX_G) ?? [];
      const hasExternalEntity = entities.some((e) => normalizeEntity(e) !== brandKey);
      if (hasExternalEntity) return true;
      continue;
    }

    if (ENTITY_RX.test(afterFirst)) return true;
  }
  return false;
}

/** Detect every candidate fact in a block list. Pure — no DB, no filtering.
 *
 * `brandName` (optional) is the SELLING brand's own name. When supplied, a claim
 * whose only capitalised entity is the selling brand itself is treated as
 * self-positioning (not external validation) and is NOT flagged. Optional and
 * back-compatible: existing callers that omit it keep prior behaviour. */
export function detectFacts(blocks: unknown, brandName?: string): DetectedFact[] {
  const out: DetectedFact[] = [];
  if (!Array.isArray(blocks)) return out;

  for (const raw of blocks) {
    if (!raw || typeof raw !== "object") continue;
    const block = raw as Record<string, unknown>;
    const blockId = typeof block.id === "string" ? block.id : undefined;
    const blockType = typeof block.type === "string" ? block.type : undefined;
    const isQuoteBlock = !!blockType && QUOTE_BLOCK_TYPES.has(blockType);
    const blockProps =
      block.props && typeof block.props === "object"
        ? (block.props as Record<string, unknown>)
        : undefined;

    const push = (
      factKind: DetectedFact["factKind"],
      fieldPath: string,
      originalText: string,
      attribution?: QuoteAttribution,
      contextLabel?: string,
    ): void => {
      out.push({
        factKind,
        blockId,
        blockType,
        fieldPath,
        originalText,
        normalizedForm: normalizedFormFor(factKind, originalText, attribution),
        attribution,
        contextLabel: contextLabel || undefined,
      });
    };

    const walk = (node: unknown, path: string): void => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach((child, i) => walk(child, `${path}[${i}]`));
        return;
      }
      if (typeof node !== "object") return;
      const obj = node as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        const childPath = path ? `${path}.${k}` : k;
        if (typeof v === "string") {
          const lowerKey = k.toLowerCase();
          const text = v;
          if (!text.trim()) continue;

          // 1) Quote — block-level quote field, OR an attributed quoted span.
          if (isQuoteBlock && QUOTE_FIELD_KEYS.has(lowerKey) && stripHtml(text).length >= 12) {
            push("quote", childPath, text, pickAttribution(obj));
            continue;
          }
          const aq = ATTRIBUTED_QUOTE_RX.exec(text);
          if (aq) {
            push("quote", childPath, aq[1], { name: aq[2].trim() });
            continue;
          }

          // 2) Stat — number + unit, or a known stat field key. Numeric idioms
          //    (time/ratio shorthand, imperative UI copy, selection ranges) are
          //    NOT factual stats and are skipped.
          if (/\d/.test(text) && !isNonStatIdiom(text, siblingLabelText(obj))) {
            const isStatField = STAT_FIELD_KEYS.has(lowerKey);
            if (isStatField || STAT_LIKE_RX.test(text)) {
              push("stat", childPath, text, undefined, captureContext(obj, blockProps, text));
              continue;
            }
          }

          // 3) Claim — named-entity claim (conservative).
          if (isClaim(text, brandName)) {
            push("claim", childPath, text, undefined, captureContext(obj, blockProps, text));
            continue;
          }
        } else if (v && typeof v === "object") {
          walk(v, childPath);
        }
      }
    };

    walk(block.props, "props");
  }

  return out;
}
