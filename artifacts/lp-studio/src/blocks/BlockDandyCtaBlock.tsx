import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandyCtaBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";

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

  const normalizeAction = (mode: string | undefined): "url" | "chilipiper" | "modal-form" | "modal-chilipiper" =>
    mode === "chilipiper" || mode === "modal-form" || mode === "modal-chilipiper" ? mode : "url";

  const modalCfg = {
    modalChilipiperUrl: props.modalChilipiperUrl,
    modalFormSource: props.modalFormSource,
    modalFormId: props.modalFormId,
    modalMarketoBaseUrl: props.modalMarketoBaseUrl,
    modalMarketoMunchkinId: props.modalMarketoMunchkinId,
    modalMarketoFormId: props.modalMarketoFormId,
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
          <p className="text-xs font-bold uppercase tracking-widest text-[#006651]">
            <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
          </p>
        )}
        <h2 className="text-4xl md:text-5xl font-bold text-[var(--brand-primary)] leading-[1.1] tracking-tight">
          <InlineText value={props.headline} onUpdate={field("headline")} />
        </h2>
        {props.subheadline && (
          <p className="text-lg text-slate-600 leading-relaxed">
            <InlineText value={props.subheadline} onUpdate={field("subheadline")} />
          </p>
        )}
        <div className={cn("flex flex-wrap gap-4 mt-2", btnAlignClass)}>
          {props.primaryCtaText && (
            <CtaButton
              ctaAction={normalizeAction(props.primaryCtaAction)}
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
              ctaAction={normalizeAction(props.secondaryCtaAction)}
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
          <p className="text-sm text-slate-400 mt-1">
            <InlineText value={props.disclaimer} onUpdate={field("disclaimer")} />
          </p>
        )}
      </div>
    </section>
  );
}
