/**
 * Pre-publish checks — the static "ready to publish?" pass the builder runs
 * when the user hits Publish. Pure function over the page's current blocks +
 * settings so it's unit-testable and costs nothing to run.
 *
 * Severity contract:
 *   warning — likely broken for visitors (dead CTA, empty form, noindex,
 *             placeholder copy). Publish is never blocked; the user can
 *             always "Publish anyway".
 *   note    — conversion/SEO hygiene worth a look (missing meta, no lead
 *             capture path).
 *
 * CTA detection reuses the canonical alias lists in lib/cta/ctaConfig so a
 * new block family that registers its aliases there is covered here for free.
 */
import {
  legacyBlockPropsToCtaConfig,
  toLogicalAction,
  ctaConfigHasValue,
  type CtaConfig,
} from "@/lib/cta/ctaConfig";

export interface PrePublishFinding {
  id: string;
  severity: "warning" | "note";
  title: string;
  detail?: string;
  /** Set when the finding points at a specific block ("Go to block"). */
  blockId?: string;
  blockType?: string;
}

/** Structural block shape — decoupled from the PageBlock union so container
 *  children (plain objects off the wire) walk the same way. */
export interface CheckableBlock {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  blockSettings?: { useCustomCta?: boolean } | null;
  children?: CheckableBlock[] | null;
}

export interface PrePublishInput {
  blocks: CheckableBlock[];
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  /** lp_pages.allow_indexing — false means robots are told to stay out. */
  allowIndexing: boolean | null;
  pageCta: CtaConfig | null;
}

const FORM_BLOCK_TYPES = new Set(["form", "id-form", "dandy-form-right-alt"]);
const LEAD_CAPTURE_TYPES = new Set([...FORM_BLOCK_TYPES, "chat-capture"]);

// Placeholder markers that should never ship: filler copy, bracketed slots,
// and stock placeholder-image hosts. TODO stays case-sensitive — "todo list"
// is legitimate copy, an all-caps TODO is a leftover.
const PLACEHOLDER_TEXT = /lorem\s+ipsum|\[(?:placeholder|todo|tbd)\]/i;
const PLACEHOLDER_TODO = /\bTODO\b/;
const PLACEHOLDER_IMAGE = /placehold\.co|via\.placeholder|placekitten|placeimg\.com/i;

function walk(blocks: CheckableBlock[], visit: (b: CheckableBlock) => void): void {
  for (const b of blocks) {
    if (!b || typeof b !== "object" || typeof b.id !== "string") continue;
    visit(b);
    if (Array.isArray(b.children)) walk(b.children, visit);
  }
}

/** First placeholder-looking string in a props tree (depth-first), or null. */
function findPlaceholder(val: unknown): string | null {
  if (typeof val === "string") {
    if (PLACEHOLDER_TEXT.test(val) || PLACEHOLDER_TODO.test(val) || PLACEHOLDER_IMAGE.test(val)) {
      return val.length > 80 ? `${val.slice(0, 80)}…` : val;
    }
    return null;
  }
  if (Array.isArray(val)) {
    for (const item of val) {
      const hit = findPlaceholder(item);
      if (hit) return hit;
    }
    return null;
  }
  if (val && typeof val === "object") {
    for (const v of Object.values(val as Record<string, unknown>)) {
      const hit = findPlaceholder(v);
      if (hit) return hit;
    }
  }
  return null;
}

/** True when a form block has neither a linked global form nor inline fields. */
function formBlockIsEmpty(props: Record<string, unknown> | undefined): boolean {
  const p = props ?? {};
  if (typeof p.formId === "number" && Number.isFinite(p.formId)) return false;
  const steps = Array.isArray(p.steps) ? p.steps : [];
  const fieldCount = steps.reduce((sum: number, s: unknown) => {
    const fields = (s as { fields?: unknown })?.fields;
    return sum + (Array.isArray(fields) ? fields.length : 0);
  }, 0);
  return fieldCount === 0;
}

/** A dead primary CTA: a labeled button whose resolved action leads nowhere. */
function deadCtaReason(cfg: CtaConfig): string | null {
  const label = (cfg.label ?? "").trim();
  if (!label) return null;
  // Inline email-capture CTAs submit in place — no destination needed.
  if ((cfg as Record<string, unknown>).ctaStyle === "email-capture") return null;

  const url = (cfg.url ?? "").trim();
  const logical = toLogicalAction(cfg.action, url);
  if (logical === "chilipiper") {
    const chili = (cfg.chilipiper ?? "").trim();
    const modalChili =
      typeof (cfg as Record<string, unknown>).modalChilipiperUrl === "string"
        ? ((cfg as Record<string, unknown>).modalChilipiperUrl as string).trim()
        : "";
    return chili || modalChili ? null : "set to open a scheduler but no Chili Piper URL is configured";
  }
  if (logical === "video-modal") {
    return (cfg.videoUrl ?? "").trim() ? null : "set to play a video but no video URL is configured";
  }
  if (logical === "open-form") {
    // Modal-form config is too varied to judge statically (inline fields,
    // global forms, per-source shims) — never flag it.
    return null;
  }
  if (logical === "url" && url === "") return "has no destination URL";
  if (logical === "anchor" && url === "#") return "links to \"#\" (goes nowhere)";
  return null;
}

export function runPrePublishChecks(input: PrePublishInput): PrePublishFinding[] {
  const warnings: PrePublishFinding[] = [];
  const notes: PrePublishFinding[] = [];

  const pageCtaActive = ctaConfigHasValue(input.pageCta);
  let hasLeadCapture = false;
  const placeholderFlagged = new Set<string>();

  walk(input.blocks, (b) => {
    const props = (b.props && typeof b.props === "object" ? b.props : {}) as Record<string, unknown>;

    // Lead-capture presence (forms with content, chat bot, scheduler/modal CTAs).
    if (LEAD_CAPTURE_TYPES.has(b.type)) {
      if (b.type === "chat-capture" || !formBlockIsEmpty(props)) hasLeadCapture = true;
    }

    // Empty form blocks.
    if (FORM_BLOCK_TYPES.has(b.type) && formBlockIsEmpty(props)) {
      warnings.push({
        id: `empty-form:${b.id}`,
        severity: "warning",
        title: "Form has no fields",
        detail: "This form block has no linked global form and no fields of its own — visitors will see an empty form.",
        blockId: b.id,
        blockType: b.type,
      });
    }

    // Dead CTAs. Blocks following an active Page CTA get their button from
    // the page level at render time, so their own empty URL is fine.
    const followsPageCta = pageCtaActive && b.blockSettings?.useCustomCta !== true;
    const cfg = legacyBlockPropsToCtaConfig(b.type, props);
    const logical = toLogicalAction(cfg.action, (cfg.url ?? "").trim());
    if (logical === "chilipiper" || logical === "open-form") hasLeadCapture = true;
    if (!followsPageCta) {
      const reason = deadCtaReason(cfg);
      if (reason) {
        warnings.push({
          id: `dead-cta:${b.id}`,
          severity: "warning",
          title: `"${(cfg.label ?? "").trim()}" button ${reason}`,
          detail: "Visitors who click it will get nothing. Set a destination in the block's panel, or configure a Page CTA.",
          blockId: b.id,
          blockType: b.type,
        });
      }
    }

    // Placeholder copy / stock placeholder images.
    if (!placeholderFlagged.has(b.id)) {
      const hit = findPlaceholder(props);
      if (hit) {
        placeholderFlagged.add(b.id);
        warnings.push({
          id: `placeholder:${b.id}`,
          severity: "warning",
          title: "Placeholder content left in",
          detail: `Found: "${hit}"`,
          blockId: b.id,
          blockType: b.type,
        });
      }
    }
  });

  if (pageCtaActive) {
    const action = input.pageCta?.action;
    if (action === "chilipiper" || action === "modal-form" || action === "modal-chilipiper") {
      hasLeadCapture = true;
    }
  }

  // Page-level hygiene.
  if (input.allowIndexing === false) {
    warnings.push({
      id: "noindex",
      severity: "warning",
      title: "Search engines are blocked",
      detail: "Indexing is set to deny in Page Settings. Fine for private campaigns — but organic search will never find this page.",
    });
  }
  if (!hasLeadCapture) {
    notes.push({
      id: "no-lead-capture",
      severity: "note",
      title: "No way to capture leads",
      detail: "No form, chat bot, scheduler, or form-opening CTA on this page. If that's not intentional, add one before driving traffic.",
    });
  }
  if (!input.metaTitle.trim()) {
    notes.push({
      id: "no-meta-title",
      severity: "note",
      title: "No meta title",
      detail: "Search results and shares fall back to a generic title. Page Settings → SEO can auto-fill it.",
    });
  }
  if (!input.metaDescription.trim()) {
    notes.push({
      id: "no-meta-description",
      severity: "note",
      title: "No meta description",
      detail: "Search engines will improvise one from page copy.",
    });
  }
  if (!input.ogImage.trim()) {
    notes.push({
      id: "no-og-image",
      severity: "note",
      title: "No social share image",
      detail: "Links shared to Slack/LinkedIn/iMessage show no preview card. Page Settings → SEO can capture one from the page.",
    });
  }

  return [...warnings, ...notes];
}
