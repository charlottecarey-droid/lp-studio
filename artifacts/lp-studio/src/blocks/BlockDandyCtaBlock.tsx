import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandyCtaBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: DandyCtaBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyCtaBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

export function BlockDandyCtaBlock({ props, brand, onFieldChange, pageId, variantId }: Props) {
  const bg = props.bgColor ?? "#FDFCFA";
  const alignment = props.alignment ?? "center";

  const field = (key: keyof DandyCtaBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const alignClass = {
    left: "items-start text-left",
    center: "items-center text-center",
    right: "items-end text-right",
  }[alignment];

  const btnAlignClass = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  }[alignment];

  // Resolve the runtime CTA mode with a legacy fallback. The current panel
  // writes `{primary,secondary}CtaAction`, but the "Apply CTA to All Sections"
  // helper in BuilderEditor still writes the legacy `primaryCtaMode` field on
  // every block that has a `primaryCtaUrl` — including this one. Without the
  // fallback, primary silently reverts to URL mode (and the modal never
  // opens) after the user runs Apply-to-all from a modal-mode source block,
  // while secondary keeps working because Apply-to-all only touches primary.
  const resolveAction = (
    action: string | undefined,
    legacyMode: string | undefined,
  ): "url" | "chilipiper" | "modal-form" | "modal-chilipiper" => {
    const v = action ?? legacyMode;
    return v === "chilipiper" || v === "modal-form" || v === "modal-chilipiper" ? v : "url";
  };

  const modalCfg = {
    modalChilipiperUrl: props.modalChilipiperUrl,
    modalFormSource: props.modalFormSource,
    modalFormId: props.modalFormId,
    modalMarketoBaseUrl: props.modalMarketoBaseUrl,
    modalMarketoMunchkinId: props.modalMarketoMunchkinId,
    modalMarketoFormId: props.modalMarketoFormId,
    modalChiliPiperHandoffUrl: props.modalChiliPiperHandoffUrl,
    modalChiliPiperHandoffMode: props.modalChiliPiperHandoffMode,
    modalChiliPiperHandoffFieldMap: props.modalChiliPiperHandoffFieldMap,
    modalHeadline: props.modalHeadline,
    modalSubheadline: props.modalSubheadline,
    modalSubmitText: props.modalSubmitText,
    modalSuccessMessage: props.modalSuccessMessage,
    modalDisclaimer: props.modalDisclaimer,
    modalShowFirstName: props.modalShowFirstName,
    modalShowLastName: props.modalShowLastName,
    modalShowPhone: props.modalShowPhone,
    modalShowCompany: props.modalShowCompany,
  };

  return (
    <section className="w-full py-20 md:py-28" style={{ backgroundColor: bg }}>
      <div className={cn("max-w-3xl mx-auto px-6 md:px-10 flex flex-col gap-6", alignClass)}>
        {props.eyebrow && (
          <p className="text-xs font-bold uppercase tracking-widest text-[#006651]" style={{ fontFamily: BODY }}>
            <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
          </p>
        )}
        <h2 className="text-4xl md:text-5xl font-bold text-[var(--brand-primary)] leading-[1.1] tracking-tight" style={{ fontFamily: DISPLAY }}>
          <InlineText value={props.headline} onUpdate={field("headline")} />
        </h2>
        {props.subheadline && (
          <p className="text-lg text-slate-600 leading-relaxed" style={{ fontFamily: BODY }}>
            <InlineText value={props.subheadline} onUpdate={field("subheadline")} />
          </p>
        )}
        <div className={cn("flex flex-wrap gap-4 mt-2", btnAlignClass)}>
          {props.primaryCtaText && (
            <CtaButton
              ctaAction={resolveAction(
                props.primaryCtaAction,
                (props as unknown as Record<string, unknown>).primaryCtaMode as string | undefined,
              )}
              ctaUrl={props.primaryCtaUrl}
              chilipiperUrl={props.primaryChilipiperUrl}
              {...modalCfg}
              className="bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold px-10 py-4 rounded-xl text-base hover:brightness-105 transition-all"
              brand={brand}
              pageId={pageId}
              variantId={variantId}
              source="dandy-cta-block-primary"
            >
              <InlineText value={props.primaryCtaText} onUpdate={field("primaryCtaText")} />
            </CtaButton>
          )}
          {props.secondaryCtaText && (
            <CtaButton
              ctaAction={resolveAction(
                props.secondaryCtaAction,
                (props as unknown as Record<string, unknown>).secondaryCtaMode as string | undefined,
              )}
              ctaUrl={props.secondaryCtaUrl}
              chilipiperUrl={props.secondaryChilipiperUrl}
              {...modalCfg}
              className="border-2 border-[var(--brand-primary)] text-[var(--brand-primary)] font-semibold px-10 py-4 rounded-xl text-base hover:bg-[var(--brand-primary)] hover:text-white transition-all"
              brand={brand}
              pageId={pageId}
              variantId={variantId}
              source="dandy-cta-block-secondary"
            >
              <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} />
            </CtaButton>
          )}
        </div>
        {props.disclaimer && (
          <p className="text-sm text-slate-400 mt-1" style={{ fontFamily: BODY }}>
            <InlineText value={props.disclaimer} onUpdate={field("disclaimer")} />
          </p>
        )}
      </div>
    </section>
  );
}
