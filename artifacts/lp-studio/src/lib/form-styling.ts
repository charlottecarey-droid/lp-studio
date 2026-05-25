/**
 * Per-form visual styling persisted in `lp_forms.styling` and surfaced on
 * the public form fetch. When set, BlockForm overrides its block-level
 * tokens so the linked global form renders with these colors / fonts on
 * every CTA that uses it — letting marketing ship a single "Inside Dandy
 * / Apple Vision Pro" lead form everywhere without re-styling each block.
 *
 * All fields are optional so an operator can theme just the parts they
 * care about and let the block defaults fill the rest. The AVP preset
 * below mirrors BlockIdForm's DEFAULTS so the visual is identical.
 */
export interface FormStyling {
  /** Section background (CSS color or gradient). Wraps the whole form. */
  background?: string;
  /** Card surface — the inner rounded panel that holds the fields. */
  surface?: string;
  /** Card border color (1px). Honored when `surface` is set. */
  border?: string;
  /** Headline text color (above the card). */
  headlineColor?: string;
  /** Subheadline / supporting copy color. */
  subheadlineColor?: string;
  /** Field-label text color. */
  labelColor?: string;
  /** Input background fill. */
  inputBg?: string;
  /** Input border color. */
  inputBorder?: string;
  /** Input text color (also drives the placeholder via opacity). */
  inputText?: string;
  /** Primary CTA / submit button background. */
  buttonBg?: string;
  /** Primary CTA / submit button text color. */
  buttonText?: string;
  /** Accent color — focus ring + multi-step progress bar fill. */
  accent?: string;
  /** Optional display-font CSS family (headline / submit button). */
  fontDisplay?: string;
  /** Optional body-font CSS family (labels / inputs / helper text). */
  fontBody?: string;
}

/**
 * "Inside Dandy / Apple Vision Pro" preset. Identical palette to
 * BlockIdForm DEFAULTS — deep teal stage, citron accent, glassy
 * translucent surface, white text. Reused as the one-click theming
 * option in the Forms editor's Style tab.
 */
export const FORM_STYLING_AVP_PRESET: Required<Omit<FormStyling, "fontDisplay" | "fontBody">> & Pick<FormStyling, "fontDisplay" | "fontBody"> = {
  background: "#001814",
  surface: "rgba(255,255,255,0.03)",
  border: "rgba(199,231,56,0.18)",
  headlineColor: "#ffffff",
  subheadlineColor: "rgba(255,255,255,0.65)",
  labelColor: "rgba(255,255,255,0.55)",
  inputBg: "rgba(255,255,255,0.02)",
  inputBorder: "rgba(255,255,255,0.12)",
  inputText: "#ffffff",
  buttonBg: "#C7E738",
  buttonText: "#001814",
  accent: "#C7E738",
  // Leave fonts unset so the rendered page's brand fonts win — the AVP
  // look reads correctly with Dandy's existing display/body pairing.
};

/**
 * True when the operator has actually configured any visual tokens.
 * Used by BlockForm to decide whether to take the styling-override
 * code path (which replaces background / surface / colors) instead
 * of the legacy block-level path.
 */
/**
 * Merge layered FormStyling objects, with later arguments overriding
 * earlier ones on a per-token basis. Returns `null` when every layer
 * is empty so callers can branch on truthiness the same way they do
 * with a single `FormStyling | null` value.
 *
 * Use to resolve the precedence chain
 *   brand-default → per-form → per-block override
 * by calling `mergeFormStyling(brand.formStyling, form.styling, blockOverride)`.
 *
 * Per-token merge (rather than "first non-null wins") is intentional:
 * an operator may set a brand-default button color and then override
 * just the input background on a single form without having to re-enter
 * every token.
 */
export function mergeFormStyling(
  ...layers: (FormStyling | null | undefined)[]
): FormStyling | null {
  const out: FormStyling = {};
  for (const layer of layers) {
    if (!layer) continue;
    for (const [k, v] of Object.entries(layer)) {
      if (v && typeof v === "string" && v.trim() !== "") {
        (out as Record<string, string>)[k] = v;
      }
    }
  }
  return hasFormStyling(out) ? out : null;
}

export function hasFormStyling(s: FormStyling | null | undefined): s is FormStyling {
  if (!s) return false;
  return Boolean(
    s.background || s.surface || s.border ||
    s.headlineColor || s.subheadlineColor || s.labelColor ||
    s.inputBg || s.inputBorder || s.inputText ||
    s.buttonBg || s.buttonText || s.accent ||
    s.fontDisplay || s.fontBody,
  );
}
