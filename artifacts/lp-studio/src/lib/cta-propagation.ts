import type { PageBlock } from "@/lib/block-types";
import {
  CTA_MODAL_KEYS,
  CTA_STYLE_KEYS,
} from "@/lib/cta/ctaConfig";

/**
 * cta-propagation — "configure one CTA, copy it to every CTA on the page".
 *
 * Sales reps building ABM microsites want every CTA on the page to do the same
 * thing and look the same ("Book a meeting" → the same Chili Piper link + the
 * same button fill). This module is the REUSABLE, pure, fully-unit-testable
 * core of that feature: extract the canonical CTA config from one block, then
 * apply it to every other CTA-bearing block.
 *
 * ── What counts as "CTA config" ──────────────────────────────────────────────
 * We copy ONLY the fields that the shared CTA mixins define — never a block's
 * own copy (headline/body/eyebrow), layout, palette, or content rows. The
 * canonical field set is the union of the three shared shapes used app-wide:
 *
 *   • HeroCtaConfig / CtaSuiteFields (src/lib/block-types, src/lib/cta-modal):
 *       action  → ctaText, ctaUrl, ctaAction, chilipiperUrl, videoUrl,
 *                 videoPosterUrl
 *       style   → ctaButtonColor, ctaButtonTextColor
 *   • CtaModalConfig (src/lib/block-types/common.ts): the 19 `modal*` fields
 *       that configure the email-capture / Marketo / Chili-Piper-handoff modal
 *       a CTA can open. (Mirrors pickCtaModalConfig.)
 *
 * The button STYLE on the shared shape is just the two per-block fill/label
 * overrides (`ctaButtonColor`, `ctaButtonTextColor`). Radius / button-style /
 * text-case are brand-level (BrandConfig.buttonRadius / buttonStyleRaw), NOT
 * per-CTA props, so they are intentionally out of scope here.
 *
 * Label aliasing: HeroCtaConfig calls the button label `ctaText`, but many
 * CtaModalConfig-only blocks (PAS / nav / final-CTA families) expose it as
 * `ctaLabel`. We treat the label as one logical field and write whichever key
 * the target block actually has, so propagation works across the whole family
 * without renaming anyone's props.
 */

/** Action-config keys from HeroCtaConfig / CtaSuiteFields (excluding the label,
 *  which is aliased — see CTA_LABEL_KEYS). */
const CTA_ACTION_KEYS = [
  "ctaUrl",
  "ctaAction",
  "chilipiperUrl",
  "videoUrl",
  "videoPosterUrl",
] as const;

/** The button label may live under either of these keys depending on block
 *  family. We read/write the first one a block actually exposes. */
const CTA_LABEL_KEYS = ["ctaText", "ctaLabel"] as const;

// Per-block style overrides (CTA_STYLE_KEYS) and the 19 modal-config keys
// (CTA_MODAL_KEYS) are imported from the canonical list in
// src/lib/cta/ctaConfig.ts so the propagation contract, the legacy shim, and
// pickCtaModalConfig can never drift apart.

/** "all" copies action + style + modal; "style" copies only the button-style
 *  overrides (and leaves each CTA's own text/url/mode/modal alone). */
export type CtaPropagationFields = "all" | "style";

type Props = Record<string, unknown>;

/** A normalized, block-agnostic snapshot of a block's CTA config. The label is
 *  stored under the logical `ctaText` key regardless of which alias the source
 *  block used; applyCtaConfig writes it back to whichever key the target has. */
export interface CtaConfig {
  /** Logical button label (source's ctaText or ctaLabel). undefined if neither. */
  ctaText?: string;
  /** Action-config fields actually present on the source block. */
  action: Props;
  /** Style-override fields actually present on the source block. */
  style: Props;
  /** Modal-config fields actually present on the source block. */
  modal: Props;
}

/** True when `key` is an own-enumerable property of `props` (the block type
 *  declares it — so it is part of that block's CTA contract). */
function has(props: Props, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(props, key);
}

/** Copy the subset of `keys` that exist on `props` into a fresh object. */
function pickPresent(props: Props, keys: readonly string[]): Props {
  const out: Props = {};
  for (const k of keys) {
    if (has(props, k)) out[k] = props[k];
  }
  return out;
}

/**
 * blockHasCta — does this block expose the shared CTA fields, so we should
 * target it for propagation? True when it has the label key, any action key,
 * or any style key. (A block with only `modal*` fields but no label/action is
 * not a standalone CTA, so it is excluded.)
 *
 * `blockType` is accepted for signature stability / future type-specific rules,
 * but presence on `props` is the source of truth (props shapes are per-type).
 */
export function blockHasCta(_blockType: string, props: unknown): boolean {
  if (!props || typeof props !== "object") return false;
  const p = props as Props;
  return (
    CTA_LABEL_KEYS.some((k) => has(p, k)) ||
    CTA_ACTION_KEYS.some((k) => has(p, k)) ||
    CTA_STYLE_KEYS.some((k) => has(p, k))
  );
}

/**
 * extractCtaConfig — pull the canonical CTA-config fields out of a block's
 * props into a plain, block-agnostic object. Only fields the block actually
 * declares are captured (so we never invent fields or copy `undefined`s onto
 * blocks that don't have them). The block's own copy/layout/palette is ignored.
 */
export function extractCtaConfig(props: unknown): CtaConfig {
  const p = (props && typeof props === "object" ? props : {}) as Props;
  let ctaText: string | undefined;
  for (const k of CTA_LABEL_KEYS) {
    if (has(p, k)) {
      ctaText = p[k] as string | undefined;
      break;
    }
  }
  return {
    ctaText,
    action: pickPresent(p, CTA_ACTION_KEYS),
    style: pickPresent(p, CTA_STYLE_KEYS),
    modal: pickPresent(p, CTA_MODAL_KEYS),
  };
}

/**
 * applyCtaConfig — return a NEW props object with the CTA-config fields
 * overwritten from `ctaConfig`. Every non-CTA prop (headline, body, layout,
 * palette, content rows, …) is preserved untouched.
 *
 * - Only writes a field if the TARGET block declares it (so we don't pollute a
 *   target with fields its block type doesn't understand).
 * - The label is written to whichever alias the target uses (ctaText/ctaLabel).
 * - `fields: "style"` copies only the style overrides; "all" (default) copies
 *   the label + action + style + modal config.
 */
export function applyCtaConfig(
  props: unknown,
  ctaConfig: CtaConfig,
  fields: CtaPropagationFields = "all",
): Props {
  const base = (props && typeof props === "object" ? props : {}) as Props;
  const next: Props = { ...base };

  // Style overrides apply in both modes.
  for (const k of CTA_STYLE_KEYS) {
    if (has(base, k) && has(ctaConfig.style, k)) next[k] = ctaConfig.style[k];
  }

  if (fields === "style") return next;

  // Label → whichever alias the target declares.
  if (ctaConfig.ctaText !== undefined) {
    for (const k of CTA_LABEL_KEYS) {
      if (has(base, k)) {
        next[k] = ctaConfig.ctaText;
        break;
      }
    }
  }

  // Action + modal config.
  for (const k of CTA_ACTION_KEYS) {
    if (has(base, k) && has(ctaConfig.action, k)) next[k] = ctaConfig.action[k];
  }
  for (const k of CTA_MODAL_KEYS) {
    if (has(base, k) && has(ctaConfig.modal, k)) next[k] = ctaConfig.modal[k];
  }

  return next;
}

/**
 * propagateCtaToAll — pure, undoable-friendly. Returns a NEW blocks array where
 * every CTA-bearing block (recursing into container `children`) EXCEPT the
 * source has the source block's CTA config applied. Recurses into children so
 * CTAs nested inside columns / grids / sections are covered too.
 *
 * Reference-stable: blocks (and the array) that don't change keep their
 * identity, so React/dnd reconciliation and the builder's undo snapshots stay
 * minimal. If the source has no CTA, or no other CTA-bearing block exists, the
 * original array is returned unchanged (caller can no-op + message).
 *
 * @param blocks  the page's block tree
 * @param sourceBlockId  the block whose CTA config is the source of truth
 * @param opts.fields  "all" (default: text+url+mode+modal+style) | "style"
 */
export function propagateCtaToAll(
  blocks: PageBlock[],
  sourceBlockId: string,
  opts: { fields?: CtaPropagationFields } = {},
): PageBlock[] {
  const fields = opts.fields ?? "all";
  const source = findBlockById(blocks, sourceBlockId);
  if (!source || !blockHasCta(source.type, source.props)) return blocks;

  const ctaConfig = extractCtaConfig(source.props);

  const applyToBlock = (b: PageBlock): PageBlock => {
    let nextProps = b.props as Props;
    let changed = false;

    if (b.id !== sourceBlockId && blockHasCta(b.type, b.props)) {
      const applied = applyCtaConfig(b.props, ctaConfig, fields);
      if (!shallowEqual(applied, nextProps)) {
        nextProps = applied;
        changed = true;
      }
    }

    const kids = (b as PageBlock & { children?: PageBlock[] }).children;
    let nextChildren = kids;
    if (Array.isArray(kids)) {
      const mapped = kids.map(applyToBlock);
      if (mapped.some((c, i) => c !== kids[i])) {
        nextChildren = mapped;
        changed = true;
      }
    }

    if (!changed) return b;
    const next = { ...b, props: nextProps } as PageBlock;
    if (nextChildren !== kids) {
      (next as PageBlock & { children?: PageBlock[] }).children = nextChildren;
    }
    return next;
  };

  const mapped = blocks.map(applyToBlock);
  return mapped.some((b, i) => b !== blocks[i]) ? mapped : blocks;
}

/**
 * countCtaTargets — how many OTHER CTA-bearing blocks would receive the config
 * (recursing into children). Lets the UI show "Applied to N sections" and
 * disable/no-op when there are none. Pure.
 */
export function countCtaTargets(blocks: PageBlock[], sourceBlockId: string): number {
  let n = 0;
  const walk = (b: PageBlock) => {
    if (b.id !== sourceBlockId && blockHasCta(b.type, b.props)) n += 1;
    const kids = (b as PageBlock & { children?: PageBlock[] }).children;
    if (Array.isArray(kids)) kids.forEach(walk);
  };
  blocks.forEach(walk);
  return n;
}

/** Depth-first lookup of a block by id, recursing into container children. */
export function findBlockById(blocks: PageBlock[], id: string): PageBlock | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    const kids = (b as PageBlock & { children?: PageBlock[] }).children;
    if (Array.isArray(kids)) {
      const found = findBlockById(kids, id);
      if (found) return found;
    }
  }
  return null;
}

/** Shallow equality over own keys — used to preserve reference identity when a
 *  block's CTA config is already identical to the source. */
function shallowEqual(a: Props, b: Props): boolean {
  if (a === b) return true;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k) || a[k] !== b[k]) return false;
  }
  return true;
}
