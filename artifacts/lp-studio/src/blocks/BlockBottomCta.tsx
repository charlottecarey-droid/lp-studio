import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BottomCtaBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getButtonClasses, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { getHeadlineSizeClass } from "@/lib/typography";
import { CtaButton } from "@/components/CtaButton";

interface Props {
  props: BottomCtaBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: BottomCtaBlockProps) => void;
  pageId?: number;
  variantId?: number;
  animationsEnabled?: boolean;
}

export function BlockBottomCta({ props, brand, onCtaClick, onFieldChange, pageId, variantId, animationsEnabled = true }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const LIME = brand.accentColor;
  const FOREST = brand.primaryColor;
  const field = (key: keyof BottomCtaBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  // Normalise the action mode so the CtaButton receives one of its 4 known values.
  const action: "url" | "chilipiper" | "modal-form" | "modal-chilipiper" =
    props.ctaAction === "chilipiper" || props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper"
      ? props.ctaAction
      : "url";

  return (
    <section className={cn("w-full bg-[var(--brand-primary)] text-white px-6 text-center", sectionPy)}>
      <div className="max-w-3xl mx-auto">
        <InlineText as="h2" value={props.headline} onUpdate={field("headline")} className={cn(getHeadlineSizeClass(props.headlineSize, brand.h2Size ?? "lg"), "font-display mb-6", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} />
        {props.subheadline && <InlineText as="p" value={props.subheadline} onUpdate={field("subheadline")} className={cn(getBodySizeClass(brand), "text-white/80 mb-10")} multiline />}
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
          source="bottom-cta"
          animationsEnabled={animationsEnabled}
        >
          <InlineText value={props.ctaText} onUpdate={field("ctaText")} />
          <ArrowRight className="w-4 h-4 ml-2" />
        </CtaButton>
      </div>
    </section>
  );
}
