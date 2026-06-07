import type { CtaModalConfig, HeroCtaActionMode } from "@/lib/block-types";

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
  return {
    modalChilipiperUrl: p.modalChilipiperUrl,
    modalFormSource: p.modalFormSource,
    modalFormId: p.modalFormId,
    modalMarketoBaseUrl: p.modalMarketoBaseUrl,
    modalMarketoMunchkinId: p.modalMarketoMunchkinId,
    modalMarketoFormId: p.modalMarketoFormId,
    modalChiliPiperHandoffUrl: p.modalChiliPiperHandoffUrl,
    modalChiliPiperHandoffMode: p.modalChiliPiperHandoffMode,
    modalChiliPiperHandoffFieldMap: p.modalChiliPiperHandoffFieldMap,
    modalHeadline: p.modalHeadline,
    modalSubheadline: p.modalSubheadline,
    modalSubmitText: p.modalSubmitText,
    modalSuccessMessage: p.modalSuccessMessage,
    modalDisclaimer: p.modalDisclaimer,
    modalShowFirstName: p.modalShowFirstName,
    modalShowLastName: p.modalShowLastName,
    modalShowPhone: p.modalShowPhone,
    modalShowCompany: p.modalShowCompany,
  };
}
