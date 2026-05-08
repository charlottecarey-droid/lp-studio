import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import type { DandyConversionPanel1BlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";

interface Props {
  props: DandyConversionPanel1BlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandyConversionPanel1BlockProps) => void;
  pageId?: number;
  variantId?: number;
}

export function BlockDandyConversionPanel1({ props, brand, onFieldChange, pageId, variantId }: Props) {
  const style = props.style ?? "teal";

  const field = (key: keyof DandyConversionPanel1BlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const bgMap: Record<string, string> = {
    teal: "var(--brand-primary)",
    lime: "var(--brand-accent)",
    medium: "#006651",
    white: "#FFFFFF",
  };
  const textMap: Record<string, { eyebrow: string; heading: string; sub: string; divider: string }> = {
    teal:   { eyebrow: "text-[var(--brand-accent)]", heading: "text-white",      sub: "text-green-100/70",   divider: "border-white/10" },
    lime:   { eyebrow: "text-[#006651]", heading: "text-[var(--brand-primary)]",  sub: "text-[#004d3f]/70",   divider: "border-[rgb(var(--brand-primary-rgb)/0.1)]" },
    medium: { eyebrow: "text-[var(--brand-accent)]", heading: "text-white",      sub: "text-green-100/70",   divider: "border-white/10" },
    white:  { eyebrow: "text-[#006651]", heading: "text-[var(--brand-primary)]",  sub: "text-slate-500",      divider: "border-slate-200" },
  };

  const bg = props.bgColor ?? bgMap[style] ?? bgMap.teal;
  const colors = textMap[style] ?? textMap.teal;

  const primaryBtnCls = style === "lime"
    ? "bg-[var(--brand-primary)] text-[var(--brand-accent)] hover:bg-[#004d3f]"
    : "bg-[var(--brand-accent)] text-[var(--brand-primary)] hover:brightness-105";

  const secondaryBtnCls = style === "lime" || style === "white"
    ? "border-2 border-[var(--brand-primary)] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white"
    : "border-2 border-white text-white hover:bg-white hover:text-[var(--brand-primary)]";

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
      <div className="max-w-4xl mx-auto px-6 md:px-10 text-center flex flex-col items-center gap-6">
        {props.eyebrow && (
          <p className={cn("text-xs font-bold uppercase tracking-widest", colors.eyebrow)}>
            <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} />
          </p>
        )}
        <h2 className={cn("text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight", colors.heading)}>
          <InlineText value={props.headline} onUpdate={field("headline")} />
        </h2>
        {props.subheadline && (
          <p className={cn("text-lg leading-relaxed max-w-2xl", colors.sub)}>
            <InlineText value={props.subheadline} onUpdate={field("subheadline")} />
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-4 mt-2">
          {props.primaryCtaText && (
            <CtaButton
              ctaAction={normalizeAction(props.primaryCtaAction)}
              ctaUrl={props.primaryCtaUrl}
              chilipiperUrl={props.primaryChilipiperUrl}
              {...modalCfg}
              className={cn("font-bold px-10 py-4 rounded-xl text-base transition-all", primaryBtnCls)}
              brand={brand}
              pageId={pageId}
              variantId={variantId}
              source="dandy-conversion-panel-primary"
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
              className={cn("font-semibold px-10 py-4 rounded-xl text-base transition-all", secondaryBtnCls)}
              brand={brand}
              pageId={pageId}
              variantId={variantId}
              source="dandy-conversion-panel-secondary"
            >
              <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} />
            </CtaButton>
          )}
        </div>

        {(props.stats ?? []).length > 0 && (
          <div className={cn("flex flex-wrap justify-center gap-x-14 gap-y-5 mt-8 pt-10 border-t w-full", colors.divider)}>
            {(props.stats ?? []).map((s, i) => (
              <div key={i} className="text-center">
                <div className={cn("text-3xl font-bold", colors.heading)}>{s.value}</div>
                <div className={cn("text-sm mt-0.5", colors.sub)}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
