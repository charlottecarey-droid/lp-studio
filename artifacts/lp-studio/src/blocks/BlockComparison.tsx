import { XCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComparisonBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getButtonClasses, getHeadingWeightClass, getHeadingLetterSpacingClass } from "@/lib/brand-config";
import { getHeadlineSizeClass } from "@/lib/typography";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

interface Props {
  props: ComparisonBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ComparisonBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

export function BlockComparison({ props, brand, onCtaClick, onFieldChange, pageId, variantId }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const LIME = brand.accentColor;
  const FOREST = brand.primaryColor;

  const action: "url" | "chilipiper" | "modal-form" | "modal-chilipiper" =
    props.ctaAction === "chilipiper" || props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper"
      ? props.ctaAction
      : "url";

  const oldCardBg = props.oldCardBg ?? "#f1f5f9";
  const newCardBg = props.newCardBg ?? "var(--brand-primary)";

  const updateOldBullet = (index: number, value: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, oldWayBullets: props.oldWayBullets.map((b, i) => (i === index ? value : b)) });
  };

  const updateNewBullet = (index: number, value: string) => {
    if (!onFieldChange) return;
    onFieldChange({ ...props, newWayBullets: props.newWayBullets.map((b, i) => (i === index ? value : b)) });
  };

  return (
    <section className={cn("w-full bg-slate-50 px-6", sectionPy)}>
      <div className="max-w-7xl mx-auto">
        {props.headline && (
          <InlineText as="h2" value={props.headline} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, headline: v }) : undefined} className={cn(getHeadlineSizeClass(undefined, brand.h2Size ?? "lg"), "font-display text-center text-[var(--brand-primary)] mb-12 lg:mb-16", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} style={{ fontFamily: DISPLAY }} />
        )}
        <div className="grid md:grid-cols-2 gap-8 items-stretch mb-16">
          <div className="rounded-3xl p-8 md:p-12 opacity-80 flex flex-col" style={{ backgroundColor: oldCardBg }}>
            <div className="mb-8">
              <span className="text-sm font-bold tracking-widest text-slate-500 uppercase mb-2 block">OLD WAY</span>
              <InlineText as="h3" value={props.oldWayLabel} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, oldWayLabel: v }) : undefined} className={cn(getHeadlineSizeClass(undefined, brand.h3Size ?? "sm"), "text-[var(--brand-primary)]", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} style={{ fontFamily: DISPLAY }} />
            </div>
            <ul className="space-y-6 flex-1">
              {props.oldWayBullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-4">
                  <XCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                  <InlineText as="span" value={bullet} onUpdate={onFieldChange ? (v) => updateOldBullet(i, v) : undefined} className="text-[#4A6358] font-medium leading-relaxed" multiline style={{ fontFamily: BODY }} />
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl p-8 md:p-12 flex flex-col ring-2 ring-[rgb(var(--brand-accent-rgb)/0.2)] shadow-xl relative overflow-hidden" style={{ backgroundColor: newCardBg }}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--brand-accent)] opacity-[0.03] blur-3xl rounded-full" />
            <div className="mb-8 relative z-10">
              <span className="text-sm font-bold tracking-widest text-[var(--brand-accent)] uppercase mb-2 block">NEW WAY</span>
              <InlineText as="h3" value={props.newWayLabel} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, newWayLabel: v }) : undefined} className={cn(getHeadlineSizeClass(undefined, brand.h3Size ?? "sm"), "text-white", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} style={{ fontFamily: DISPLAY }} />
            </div>
            <ul className="space-y-6 flex-1 relative z-10">
              {props.newWayBullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-4">
                  <CheckCircle2 className="w-6 h-6 text-[var(--brand-accent)] shrink-0 mt-0.5" />
                  <InlineText as="span" value={bullet} onUpdate={onFieldChange ? (v) => updateNewBullet(i, v) : undefined} className="text-white/90 font-medium leading-relaxed" multiline style={{ fontFamily: BODY }} />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="text-center">
          <CtaButton
            ctaAction={action}
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
            onClick={onCtaClick}
            className={getButtonClasses(brand, "inline-flex items-center")}
            style={{ backgroundColor: LIME, color: FOREST }}
            brand={brand}
            pageId={pageId}
            variantId={variantId}
            source="comparison-cta"
          >
            <InlineText value={props.ctaText} onUpdate={onFieldChange ? (v) => onFieldChange({ ...props, ctaText: v }) : undefined} />
            <ArrowRight className="w-4 h-4 ml-2" />
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
