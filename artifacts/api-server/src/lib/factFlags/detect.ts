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
const CLAIM_TRIGGER_RX =
  /\b(trusted by|partnered with|partners? with|backed by|featured (?:in|on)|as seen (?:in|on)|recognized by|certified by|accredited by|winner of|named (?:one of|the)?|ranked|rated|#1|number one)\b/i;
// A capitalised proper-noun entity (1-4 tokens), allowing & . and digits.
const ENTITY_RX = /\b([A-Z][A-Za-z0-9&.]+(?:\s+[A-Z][A-Za-z0-9&.]+){0,3})\b/;

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

function isClaim(value: string): boolean {
  const text = stripHtml(value);
  if (!CLAIM_TRIGGER_RX.test(text)) return false;
  // Require a capitalised entity that is NOT merely the first word of the
  // sentence (drop the leading word before testing) — keeps it conservative.
  const afterFirst = text.replace(/^\s*\S+\s*/, "");
  return ENTITY_RX.test(afterFirst);
}

/** Detect every candidate fact in a block list. Pure — no DB, no filtering. */
export function detectFacts(blocks: unknown): DetectedFact[] {
  const out: DetectedFact[] = [];
  if (!Array.isArray(blocks)) return out;

  for (const raw of blocks) {
    if (!raw || typeof raw !== "object") continue;
    const block = raw as Record<string, unknown>;
    const blockId = typeof block.id === "string" ? block.id : undefined;
    const blockType = typeof block.type === "string" ? block.type : undefined;
    const isQuoteBlock = !!blockType && QUOTE_BLOCK_TYPES.has(blockType);

    const push = (
      factKind: DetectedFact["factKind"],
      fieldPath: string,
      originalText: string,
      attribution?: QuoteAttribution,
    ): void => {
      out.push({
        factKind,
        blockId,
        blockType,
        fieldPath,
        originalText,
        normalizedForm: normalizedFormFor(factKind, originalText, attribution),
        attribution,
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

          // 2) Stat — number + unit, or a known stat field key.
          if (/\d/.test(text)) {
            const isStatField = STAT_FIELD_KEYS.has(lowerKey);
            if (isStatField || STAT_LIKE_RX.test(text)) {
              push("stat", childPath, text);
              continue;
            }
          }

          // 3) Claim — named-entity claim (conservative).
          if (isClaim(text)) {
            push("claim", childPath, text);
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
