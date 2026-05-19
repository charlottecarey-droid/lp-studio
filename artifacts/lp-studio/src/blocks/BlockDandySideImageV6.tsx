import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import type { DandySideImageV6BlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

const PLACEHOLDER = "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=1200&h=900&fit=crop";

interface Props {
  props: DandySideImageV6BlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DandySideImageV6BlockProps) => void;
}

export function BlockDandySideImageV6({ props, brand, onFieldChange }: Props) {
  const reversed = props.imagePosition === "left";
  const bg = props.bgColor ?? "#FDFCFA";

  const field = (key: keyof DandySideImageV6BlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const updateBullet = (i: number, v: string) => {
    if (!onFieldChange) return;
    const bullets = [...(props.bullets ?? [])];
    bullets[i] = v;
    onFieldChange({ ...props, bullets });
  };

  const textCol = (
    <div className="flex flex-col justify-center gap-6 py-4">
      {props.eyebrow && (
        <p className="text-xs font-bold uppercase tracking-widest text-[#006651]" style={{ fontFamily: BODY }}>
          <InlineText value={props.eyebrow} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }}/>
        </p>
      )}
      <h2 className="text-4xl md:text-5xl font-bold text-[var(--brand-primary)] leading-[1.1] tracking-tight" style={{ fontFamily: DISPLAY }}>
        <InlineText value={props.headline} onUpdate={field("headline")} style={{ fontFamily: BODY }}/>
      </h2>
      {props.subheadline && (
        <p className="text-lg text-slate-600 leading-relaxed" style={{ fontFamily: BODY }}>
          <InlineText value={props.subheadline} onUpdate={field("subheadline")} style={{ fontFamily: BODY }}/>
        </p>
      )}
      {(props.bullets ?? []).length > 0 && (
        <ul className="space-y-4 mt-1">
          {(props.bullets ?? []).map((b, i) => (
            <li key={i} className="flex items-start gap-4 text-base text-slate-700" style={{ fontFamily: BODY }}>
              <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-[var(--brand-accent)] flex items-center justify-center" style={{ fontFamily: BODY }}>
                <Check className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
              </span>
              <InlineText value={b} onUpdate={onFieldChange ? (v) => updateBullet(i, v) : undefined} style={{ fontFamily: BODY }}/>
            </li>
          ))}
        </ul>
      )}
      {props.ctaText && (
        <div className="flex flex-wrap gap-4 mt-3">
          <CtaButton
            ctaAction={props.ctaAction ?? "url"}
            ctaUrl={props.ctaUrl}
            chilipiperUrl={props.chilipiperUrl}
            modalChilipiperUrl={props.modalChilipiperUrl}
            modalFormSource={props.modalFormSource}
            modalFormId={props.modalFormId}
            modalMarketoBaseUrl={props.modalMarketoBaseUrl}
            modalMarketoMunchkinId={props.modalMarketoMunchkinId}
            modalMarketoFormId={props.modalMarketoFormId}
            modalChiliPiperHandoffUrl={props.modalChiliPiperHandoffUrl}
            modalChiliPiperHandoffMode={props.modalChiliPiperHandoffMode}
            modalChiliPiperHandoffFieldMap={props.modalChiliPiperHandoffFieldMap}
            modalHeadline={props.modalHeadline}
            modalSubheadline={props.modalSubheadline}
            modalSubmitText={props.modalSubmitText}
            modalSuccessMessage={props.modalSuccessMessage}
            modalDisclaimer={props.modalDisclaimer}
            modalShowFirstName={props.modalShowFirstName}
            modalShowLastName={props.modalShowLastName}
            modalShowPhone={props.modalShowPhone}
            modalShowCompany={props.modalShowCompany}
            brand={brand}
            source="dandy-side-image-v6-primary"
            className="bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold px-8 py-4 rounded-xl text-base hover:brightness-105 transition-all"
          >
            <InlineText value={props.ctaText} onUpdate={field("ctaText")} style={{ fontFamily: BODY }}/>
          </CtaButton>
          {props.secondaryCtaText && (
            <CtaButton
              ctaAction={props.secondaryCtaAction ?? "url"}
              ctaUrl={props.secondaryCtaUrl}
              chilipiperUrl={props.secondaryChilipiperUrl}
              modalChilipiperUrl={props.modalChilipiperUrl}
              modalFormSource={props.modalFormSource}
              modalFormId={props.modalFormId}
              modalMarketoBaseUrl={props.modalMarketoBaseUrl}
              modalMarketoMunchkinId={props.modalMarketoMunchkinId}
              modalMarketoFormId={props.modalMarketoFormId}
              modalChiliPiperHandoffUrl={props.modalChiliPiperHandoffUrl}
              modalChiliPiperHandoffMode={props.modalChiliPiperHandoffMode}
              modalChiliPiperHandoffFieldMap={props.modalChiliPiperHandoffFieldMap}
              modalHeadline={props.modalHeadline}
              modalSubheadline={props.modalSubheadline}
              modalSubmitText={props.modalSubmitText}
              modalSuccessMessage={props.modalSuccessMessage}
              modalDisclaimer={props.modalDisclaimer}
              modalShowFirstName={props.modalShowFirstName}
              modalShowLastName={props.modalShowLastName}
              modalShowPhone={props.modalShowPhone}
              modalShowCompany={props.modalShowCompany}
              brand={brand}
              source="dandy-side-image-v6-secondary"
              className="border-2 border-[var(--brand-primary)] text-[var(--brand-primary)] font-semibold px-8 py-4 rounded-xl text-base hover:bg-[var(--brand-primary)] hover:text-white transition-all"
            >
              <InlineText value={props.secondaryCtaText} onUpdate={field("secondaryCtaText")} style={{ fontFamily: BODY }}/>
            </CtaButton>
          )}
        </div>
      )}
    </div>
  );

  const imageCol = (
    <div className="relative h-full">
      <div className="rounded-3xl overflow-hidden shadow-2xl aspect-[4/3] bg-slate-100">
        <img
          src={props.imageUrl || PLACEHOLDER}
          alt={props.headline}
          className="w-full h-full object-cover"
        />
      </div>
      {props.badgeText && (
        <div className="absolute -bottom-5 -right-5 bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold text-base px-6 py-3.5 rounded-2xl shadow-lg">
          <InlineText value={props.badgeText} onUpdate={field("badgeText")} style={{ fontFamily: BODY }}/>
        </div>
      )}
    </div>
  );

  return (
    <section className="w-full py-20 md:py-28" style={{ backgroundColor: bg }}>
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="grid md:grid-cols-2 gap-14 md:gap-20 items-center">
          {reversed ? (
            <>
              <div className="order-2 md:order-1">{imageCol}</div>
              <div className="order-1 md:order-2">{textCol}</div>
            </>
          ) : (
            <>
              <div>{textCol}</div>
              <div>{imageCol}</div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
