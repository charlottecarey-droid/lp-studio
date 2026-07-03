/**
 * pageCtaApply — the render-time Page CTA transform, made block-TYPE aware
 * (July 2026 coverage fix, phase 2).
 *
 * ctaConfig's shim is presence-based: it writes only keys the props INSTANCE
 * already declares. That's the right no-pollution rule for arbitrary props,
 * but it under-covers real pages: an AI-generated block often omits optional
 * CTA keys its block type fully supports (e.g. a hero that shipped with
 * `ctaUrl` but no `ctaText`), so the Page CTA's label had nowhere to land and
 * the block silently kept its own button.
 *
 * This wrapper consults the block type's registry `defaultProps()` — the
 * closest thing to a per-type schema — and lets the shim also target primary
 * CTA keys the TYPE declares even when this instance dropped them. Gating is
 * still instance-based on purpose: a block that renders no CTA at all (no
 * primary CTA key on its props) never sprouts a button from the Page CTA;
 * per-block buttons remain an explicit editor action. Unknown types (custom
 * schema blocks, retired types) degrade to the pure presence-based behavior.
 *
 * ctaConfig.ts stays a leaf module (no registry import) — the registry pulls
 * in every block thumbnail, which panels/tests that only need the shim
 * shouldn't pay for.
 */
import { getBlockDef } from "@/lib/block-types";
import {
  applyPageCtaToBlockProps,
  PRIMARY_CTA_KEYS,
  type CtaConfig,
} from "./ctaConfig";

type Props = Record<string, unknown>;

function has(props: Props, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(props, key);
}

/** Primary CTA keys a block TYPE declares in its registry defaultProps().
 *  Cached per type — defaultProps factories are cheap but this runs per block
 *  per render. Empty for unknown types. */
const typeKeysCache = new Map<string, readonly string[]>();
export function primaryCtaKeysForType(blockType: string): readonly string[] {
  const cached = typeKeysCache.get(blockType);
  if (cached) return cached;
  let keys: readonly string[] = [];
  try {
    const defaults = getBlockDef(blockType as never)?.defaultProps();
    if (defaults && typeof defaults === "object") {
      keys = PRIMARY_CTA_KEYS.filter((k) => has(defaults as Props, k));
    }
  } catch {
    /* a throwing defaultProps factory must never break rendering */
  }
  typeKeysCache.set(blockType, keys);
  return keys;
}

/**
 * Apply the Page CTA to a block's props, targeting both instance-declared AND
 * type-declared primary CTA keys. Returns a NEW props object. Render-only —
 * exactly like applyPageCtaToBlockProps, callers must restore via
 * restorePrimaryCtaProps before persisting (restore already strips every
 * PRIMARY_CTA_KEYS member, including any key this augmentation introduced).
 */
export function applyPageCtaToBlock(
  blockType: string,
  props: unknown,
  pageCta: CtaConfig | null | undefined,
): Props {
  const base = (props && typeof props === "object" ? props : {}) as Props;
  const typeKeys = primaryCtaKeysForType(blockType);
  if (typeKeys.length === 0) return applyPageCtaToBlockProps(blockType, base, pageCta);

  // Placeholders make type-declared keys visible to the shim's presence rule;
  // instance values win where both exist.
  const augmented: Props = {};
  for (const k of typeKeys) augmented[k] = undefined;
  Object.assign(augmented, base);

  const written = applyPageCtaToBlockProps(blockType, augmented, pageCta);
  // Drop placeholders nothing was written to, so the result carries no keys
  // the instance didn't have and the Page CTA didn't set.
  for (const k of typeKeys) {
    if (written[k] === undefined && !has(base, k)) delete written[k];
  }
  return written;
}
