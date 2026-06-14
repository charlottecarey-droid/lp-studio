/**
 * ctaSource — editor-side plumbing for the Phase 1 resolver hierarchy.
 *
 * The shared CtaActionConfigSection can already RENDER a source indicator
 * ("Using tenant default / page override / block override") + the
 * inherit/override controls, but it needs a panel host to tell it which layer
 * is winning and to supply the override/reset writers. This module computes that
 * bundle for ONE block from the same inputs the renderer uses
 * ({@link brandDefaultCtaConfig} + the page CTA + the block's own props through
 * the legacy shim), so the editor and the runtime agree on the effective source.
 *
 * Phase 2 panels accept a {@link CtaSourceProps} and spread it straight into
 * CtaActionConfigSection — no per-panel logic.
 */

import type { BrandConfig } from "@/lib/brand-config";
import {
  brandDefaultCtaConfig,
  ctaConfigHasValue,
  ctaConfigToBlockProps,
  legacyBlockPropsToCtaConfig,
  resolveCtaConfig,
  CTA_LABEL_KEYS,
  CTA_ACTION_KEYS,
  type CtaConfig,
  type CtaSource,
} from "./ctaConfig";

/** The optional props a migrated block panel forwards to CtaActionConfigSection
 *  to surface the source indicator + inherit/override controls. The shape mirrors
 *  CtaActionConfigSection's optional props 1:1 so a panel can `{...ctaSource}`. */
export interface CtaSourceProps {
  source?: CtaSource;
  hasOwnOverride?: boolean;
  onOverride?: () => void;
  onResetToInherit?: () => void;
}

type Props = Record<string, unknown>;

/** Blank out the block's OWN primary CTA so it inherits page/tenant again.
 *  Only declared keys are touched (presence-based, like the shim) so we never
 *  add fields a block didn't have. */
function clearBlockCta(props: Props): Props {
  const next: Props = { ...props };
  for (const k of CTA_LABEL_KEYS) if (k in next) next[k] = "";
  for (const k of CTA_ACTION_KEYS) if (k in next) next[k] = "url";
  if ("ctaUrl" in next) next.ctaUrl = "";
  if ("chilipiperUrl" in next) next.chilipiperUrl = "";
  return next;
}

/**
 * Build the source-indicator bundle for one block. `onProps` writes the block's
 * next props (the panel host wraps this back into the PageBlock). Pure except
 * for the two callbacks.
 */
export function buildBlockCtaSource(args: {
  blockType: string;
  props: Props;
  onProps: (next: Props) => void;
  brand?: BrandConfig | null;
  pageCta?: CtaConfig | null;
}): CtaSourceProps {
  const { blockType, props, onProps, brand, pageCta } = args;

  const tenantDefault = brandDefaultCtaConfig(brand ?? null);
  const blockOverride = legacyBlockPropsToCtaConfig(blockType, props);
  const resolved = resolveCtaConfig({
    tenantDefault,
    pageOverride: pageCta ?? null,
    blockOverride,
  });

  return {
    source: resolved.source,
    hasOwnOverride: ctaConfigHasValue(blockOverride),
    // "Override for this block": copy the currently-inherited effective CTA onto
    // the block's own props (using whatever key names the block declares), so the
    // editor below becomes live and the source flips to "block".
    onOverride: () => onProps(ctaConfigToBlockProps(blockType, resolved, props)),
    // "Reset to inherit": clear the block's own CTA so it falls back to page/tenant.
    onResetToInherit: () => onProps(clearBlockCta(props)),
  };
}
