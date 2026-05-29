import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BottomCtaBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY, getButtonClasses, getHeadingWeightClass, getHeadingLetterSpacingClass, getBodySizeClass, pickCtaButtonColors, contrastTextColor, isValidHex, DEFAULT_BRAND } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { getHeadlineSizeClass } from "@/lib/typography";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

const DISPLAY = BRAND_DISPLAY_FONT;
const BODY = BRAND_BODY_FONT;

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
  // The section paints `var(--brand-primary)`, so the actual background hex is
  // the brand primary. Resolve text + button colors against it so a brand
  // whose accent ≈ primary (e.g. Zoom blue on Zoom blue) never renders an
  // invisible button or illegible copy.
  const sectionBg = isValidHex(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
  const onBg = contrastTextColor(sectionBg);
  const onBgMuted = onBg === "#ffffff" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)";
  const cta = pickCtaButtonColors(brand, sectionBg);
  const field = (key: keyof BottomCtaBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  // Normalise the action mode so the CtaButton receives one of its 4 known values.
  const action: "url" | "chilipiper" | "modal-form" | "modal-chilipiper" =
    props.ctaAction === "chilipiper" || props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper"
      ? props.ctaAction
      : "url";

  return (
    <section className={cn("w-full bg-[var(--brand-primary)] px-6 text-center", sectionPy)} style={{ color: onBg }}>
      <div className="max-w-3xl mx-auto">
        <InlineText as="h2" value={props.headline} onUpdate={field("headline")} className={cn(getHeadlineSizeClass(props.headlineSize, brand.h2Size ?? "lg"), "font-display mb-6", getHeadingWeightClass(brand), getHeadingLetterSpacingClass(brand))} style={{ fontFamily: DISPLAY, color: onBg }} />
        {props.subheadline && <InlineText as="p" value={props.subheadline} onUpdate={field("subheadline")} className={cn(getBodySizeClass(brand), "mb-10")} style={{ fontFamily: BODY, color: onBgMuted }} multiline />}
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
          style={{ backgroundColor: cta.bg, color: cta.text }}
          brand={brand}
          pageId={pageId}
          variantId={variantId}
          source="bottom-cta"
          animationsEnabled={animationsEnabled}
        >
          <InlineText value={props.ctaText} onUpdate={field("ctaText")} style={{ fontFamily: BODY }}/>
          <ArrowRight className="w-4 h-4 ml-2" />
        </CtaButton>
      </div>
    </section>
  );
}
