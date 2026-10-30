/**
 * Lead-form fallback (Oct 2026, Charlotte's decision).
 *
 * The dead-link pass (dead-links.ts) resolves every generated CTA to the
 * tenant's defaultCtaUrl, else to the page's form block, else it CLEARS the
 * CTA ("empty beats dead"). A tenant with no default CTA URL, no Chili Piper
 * link and a page with no form therefore shipped a sale page whose every
 * button was hidden — no way to convert at all (the HVAC page).
 *
 * This pass runs right BEFORE the dead-link pass on both page paths: when the
 * tenant has no CTA destination and the page has no form block, it inserts a
 * native lead-capture form ahead of the footer (anchor "get-started"), so the
 * dead-link pass anchors every CTA to it instead of clearing them. Pure,
 * deterministic, fail-open at the call site.
 */
import { FORM_BLOCK_TYPES } from "./dead-links";

export interface LeadFormBrand {
  brandName?: string | null;
  defaultCtaUrl?: string | null;
  chilipiperUrl?: string | null;
}

/** True when CTAs have somewhere real to point without a form. */
export function hasCtaDestination(brand: LeadFormBrand | null | undefined): boolean {
  const real = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0 && v.trim() !== "#";
  return real(brand?.defaultCtaUrl) || real(brand?.chilipiperUrl);
}

export const LEAD_FORM_ANCHOR = "get-started";
export const LEAD_FORM_BLOCK_ID = "block-form-lead-injected";

type Block = { id?: unknown; type?: unknown; props?: unknown; blockSettings?: unknown };

export function buildLeadCaptureForm(brandName: string | null | undefined): Record<string, unknown> {
  const name = (brandName ?? "").trim();
  return {
    id: LEAD_FORM_BLOCK_ID,
    type: "form",
    props: {
      headline: name ? `Talk to ${name}` : "Get in touch",
      subheadline: "Tell us a little about what you need and we'll get back to you within one business day.",
      multiStep: false,
      steps: [
        {
          title: "Get in touch",
          fields: [
            { id: "name", type: "text", label: "Name", placeholder: "Your name", required: true },
            { id: "email", type: "email", label: "Email", placeholder: "you@company.com", required: true },
            { id: "phone", type: "phone", label: "Phone", placeholder: "Optional", required: false },
            { id: "message", type: "textarea", label: "What can we help with?", placeholder: "A sentence or two is plenty", required: false },
          ],
        },
      ],
      submitButtonText: "Send my request",
      successMessage: "Thanks — we'll be in touch within one business day.",
      redirectUrl: "#",
      backgroundStyle: "light-gray",
    },
    blockSettings: { anchorId: LEAD_FORM_ANCHOR },
  };
}

/**
 * Mutates `blocks` in place. Inserts the fallback form before the first footer
 * (or appends) when: the brand has no CTA destination, the page is not a
 * single self-contained full-page block, and no form-type block exists yet.
 */
export function ensureLeadCaptureForm(
  blocks: Block[],
  opts: { brand: LeadFormBrand | null | undefined; isSingleFullPage?: boolean },
): { injected: boolean; reason: "destination" | "full-page" | "has-form" | "injected" } {
  if (!Array.isArray(blocks)) return { injected: false, reason: "has-form" };
  if (hasCtaDestination(opts.brand)) return { injected: false, reason: "destination" };
  if (opts.isSingleFullPage) return { injected: false, reason: "full-page" };
  if (blocks.some((b) => typeof b?.type === "string" && FORM_BLOCK_TYPES.has(b.type))) {
    return { injected: false, reason: "has-form" };
  }
  const form = buildLeadCaptureForm(opts.brand?.brandName);
  const footerIdx = blocks.findIndex((b) => b?.type === "footer");
  if (footerIdx >= 0) blocks.splice(footerIdx, 0, form);
  else blocks.push(form);
  return { injected: true, reason: "injected" };
}
