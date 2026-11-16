import type { BrandConfig } from "@/lib/brand-config";
import type { FormBlockProps } from "@/lib/block-types/generic-blocks";
import { BlockForm } from "../BlockForm";

/* ----------------------------------------------------------------------------
 * The forest / mint close cards' "real form" slot. When a global form (or a
 * Marketo form) is linked, the card renders that form — its own fields,
 * validation, routing, Chili Piper hand-off and redirect — through the same
 * <BlockForm> shim the Glow / Event blocks use. BlockForm's section padding,
 * background and inner card chrome are stripped so it sits flush in the
 * close block's card under the header strip.
 * -------------------------------------------------------------------------- */

export interface ForestFormEmbedProps {
  formId?: number;
  formMode?: "native" | "marketo";
  marketoBaseUrl?: string;
  marketoMunchkinId?: string;
  marketoFormId?: number;
}

/** True when the close card should render a linked form instead of its built-in fields. */
export function hasEmbeddedForm(p: ForestFormEmbedProps): boolean {
  if (p.formMode === "marketo") return !!p.marketoBaseUrl && !!p.marketoMunchkinId && !!p.marketoFormId;
  return !!p.formId;
}

interface Props {
  embed: ForestFormEmbedProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  /** The card is dark (white-ish labels, translucent inputs) vs light. */
  dark: boolean;
  submitText?: string;
  successMessage?: string;
  buttonBg?: string;
  buttonText?: string;
}

export function ForestEmbeddedForm({ embed, brand, pageId, variantId, dark, submitText, successMessage, buttonBg, buttonText }: Props) {
  const formMode = embed.formMode === "marketo" ? "marketo" : "native";
  const formProps: FormBlockProps = {
    headline: "",
    subheadline: "",
    multiStep: false,
    steps: [],
    submitButtonText: submitText || "Submit",
    successMessage: successMessage || "Thanks — we'll be in touch shortly.",
    redirectUrl: "",
    backgroundStyle: dark ? "dark" : "white",
    formId: formMode === "native" ? embed.formId : undefined,
    cardStyle: "minimal",
    formMode,
    marketoBaseUrl: embed.marketoBaseUrl,
    marketoMunchkinId: embed.marketoMunchkinId,
    marketoFormId: embed.marketoFormId,
    submitButtonColor: buttonBg,
    submitButtonTextColor: buttonText,
  };
  return (
    <div className="forest-form-slot" data-forest-form="embedded">
      <style>{`
        .forest-form-slot > section { padding: 0 !important; background: transparent !important; }
        .forest-form-slot > section > .max-w-xl { max-width: none !important; }
        .forest-form-slot > section > .max-w-xl > div:last-child {
          padding: 0 !important; background: transparent !important; border: 0 !important;
          box-shadow: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
        }
      `}</style>
      <BlockForm props={formProps} brand={brand} pageId={pageId} variantId={variantId} />
    </div>
  );
}
