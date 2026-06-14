import type { CtaModalConfig, HeroCtaActionMode } from "@/lib/block-types";
import { CTA_MODAL_KEYS } from "@/lib/cta/ctaConfig";

/**
 * The full set of CTA-button fields a block exposes when it uses the shared
 * CtaButton suite: a label, an action mode, the per-action destinations, and
 * the spread CtaModalConfig modal fields. Reused by the shared CTA panel
 * section so every CTA-bearing block edits the suite the same way.
 */
export interface CtaSuiteFields extends CtaModalConfig {
  ctaAction?: HeroCtaActionMode;
  ctaUrl?: string;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
}

/**
 * Extract just the shared modal-CTA fields from a block's props so they can be
 * spread onto a <CtaButton> without leaking unrelated block props (which would
 * be a type error). Any block whose props extend CtaModalConfig can do:
 *   <CtaButton {...pickCtaModalConfig(props)} ctaAction={props.ctaAction} … />
 */
export function pickCtaModalConfig(p: CtaModalConfig): CtaModalConfig {
  // Keys sourced from the single canonical list in src/lib/cta/ctaConfig.ts so
  // the modal contract can never drift between the shim, propagation, and here.
  const out: Record<string, unknown> = {};
  for (const k of CTA_MODAL_KEYS) {
    out[k] = (p as Record<string, unknown>)[k];
  }
  return out as CtaModalConfig;
}
