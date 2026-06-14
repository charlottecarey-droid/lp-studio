import { ArrowUpRight, ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import type { MagazineHeroBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { pickCtaButtonColors } from "@/lib/brand-config";

interface Props {
  props: MagazineHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MagazineHeroBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

const SERIF_FAMILY: Record<NonNullable<MagazineHeroBlockProps["serifStyle"]>, string> = {
  modern: "'Instrument Serif', 'Cormorant Garamond', Georgia, serif",
  editorial: "'Fraunces', Georgia, serif",
  classic: "'Playfair Display', Georgia, serif",
};

const ASPECT_CLASS: Record<NonNullable<MagazineHeroBlockProps["imageAspect"]>, string> = {
  portrait: "aspect-[4/5]",
  square: "aspect-square",
  landscape: "aspect-[5/4]",
  wide: "aspect-[16/10]",
};

/** Fixed near-black surface the "cover" layout renders its section on. */
const COVER_SURFACE = "#0A0A0A";

const WEIGHT: Record<NonNullable<MagazineHeroBlockProps["headlineWeight"]>, number> = {
  light: 300,
  regular: 400,
  bold: 700,
};

export function BlockMagazineHero({ props, brand, onCtaClick, onFieldChange, pageId, variantId }: Props) {
  const field = (key: keyof MagazineHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const accent = props.accentColor || brand.accentColor || "#FF6B35";
  const bg = props.bgColor || "#FAF7F2";
  const text = props.textColor || "#0A0A0A";
  const layout = props.layout || "split";
  const aspect = ASPECT_CLASS[props.imageAspect || "portrait"];
  const serifStyle = props.serifStyle || "modern";
  const serifFamily = SERIF_FAMILY[serifStyle];
  const headlineWeight = WEIGHT[props.headlineWeight || (serifStyle === "modern" ? "regular" : "bold")];

  // Per-block font overrides — load any selected catalog font (Google Fonts)
  // so the choice actually renders instead of silently falling back.
  useBlockFonts(props.headlineFont, props.bodyFont);
  // Headline: explicit pick → brand display font (e.g. Bagoss for Dandy) →
  // chosen serif preset. The brand-token CSS var is set by `getBrandStyle`
  // when the tenant has a `displayFont` configured; otherwise it's absent
  // and the serif preset takes over via the var() fallback chain.
  const headlineFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || serifFamily
    : `var(--brand-font-display, ${serifFamily})`;
  // Body / eyebrow / byline / CTAs: explicit pick → brand body font →
  // system sans-serif. Applied via inline style on the section root so it
  // cascades to every nested element that doesn't carry its own font.
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") ||
      "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)"
    : "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)";
  const rotation = props.imageRotation ?? 0;
  const showRule = !!props.showRule;
  const issueLabel = props.issueLabel;

  const primaryAction: "url" | "chilipiper" | "modal-form" | "modal-chilipiper" =
    props.ctaAction === "chilipiper" || props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper"
      ? props.ctaAction
      : "url";
  const secondaryAction: "url" | "chilipiper" | "modal-form" | "modal-chilipiper" | "video-modal" =
    props.ctaSecondaryAction === "chilipiper" || props.ctaSecondaryAction === "modal-form" || props.ctaSecondaryAction === "modal-chilipiper" || props.ctaSecondaryAction === "video-modal"
      ? props.ctaSecondaryAction
      : "url";

  const headlineStyle: CSSProperties = {
    fontFamily: headlineFamily,
    fontWeight: headlineWeight,
    fontSize: "clamp(2.5rem, 7vw, 6rem)",
    letterSpacing: serifStyle === "modern" ? "-0.015em" : "-0.03em",
    lineHeight: serifStyle === "modern" ? 1.02 : 0.95,
  };

  const issueStrip = (issueLabel || onFieldChange) ? (
    <div
      className="flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] font-medium"
      style={{ opacity: 0.55 }}
    >
      <span className="inline-block w-6 h-px" style={{ backgroundColor: text, opacity: 0.4 }} />
      <InlineText
        as="span"
        value={issueLabel ?? ""}
        onUpdate={field("issueLabel")}
      />
    </div>
  ) : null;

  const eyebrow = (props.eyebrow || onFieldChange) ? (
    <div
      className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] font-semibold"
      style={{ color: accent }}
    >
      <span className="inline-block w-8 h-px" style={{ backgroundColor: accent }} />
      <InlineText as="span" value={props.eyebrow ?? ""} onUpdate={field("eyebrow")} />
    </div>
  ) : null;

  const subheadline = (props.subheadline || onFieldChange) ? (
    <InlineText
      as="p"
      multiline
      value={props.subheadline ?? ""}
      onUpdate={field("subheadline")}
      className="text-base lg:text-lg max-w-xl leading-relaxed"
      style={{ color: text, opacity: 0.72 }}
    />
  ) : null;

  // Pass-through modal config props (shared between primary + secondary CTAs).
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

  // Build the CTA row for a given section surface. On the light "split" /
  // "stacked" layouts the primary CTA fills with the body `text` color (dark
  // ink on a light page). On the dark "cover" layout that same `text` default
  // (`#0A0A0A`) would render a black button on the near-black cover surface, so
  // resolve a surface-aware fill via `pickCtaButtonColors` and use a legible
  // secondary link color.
  const renderCtas = (
    primaryBg: string,
    primaryText: string,
    secondaryText: string,
  ) => (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
      <CtaButton
        ctaAction={primaryAction}
        ctaUrl={props.ctaUrl}
        chilipiperUrl={props.chilipiperUrl}
        {...modalCfg}
        // Only forward the host's navigation callback for plain URL actions —
        // for modal-form / modal-chilipiper / chilipiper modes, the CtaButton
        // handles the click itself (opens modal / popup) and the host's
        // navigator would otherwise also open `ctaUrl` in a new tab on top
        // of the modal.
        onClick={primaryAction === "url" ? onCtaClick : undefined}
        className="inline-flex items-center gap-2 px-7 py-3.5 font-medium rounded-full text-sm tracking-wide"
        style={{ backgroundColor: primaryBg, color: primaryText }}
        brand={brand}
        pageId={pageId}
        variantId={variantId}
        source="magazine-hero-primary"
      >
        <InlineText as="span" value={props.ctaText} onUpdate={field("ctaText")} />
        <ArrowUpRight className="w-4 h-4" />
      </CtaButton>
      {(props.ctaSecondaryText || onFieldChange) && (
        <CtaButton
          ctaAction={secondaryAction}
          ctaUrl={props.ctaSecondaryUrl}
          chilipiperUrl={props.secondaryChilipiperUrl}
          videoUrl={props.secondaryVideoUrl}
          {...modalCfg}
          className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline bg-transparent"
          style={{ color: secondaryText, opacity: 0.85 }}
          brand={brand}
          pageId={pageId}
          variantId={variantId}
          source="magazine-hero-secondary"
        >
          <InlineText as="span" value={props.ctaSecondaryText ?? ""} onUpdate={field("ctaSecondaryText")} />
          <ArrowRight className="w-3.5 h-3.5" />
        </CtaButton>
      )}
    </div>
  );

  // Light layouts: dark ink button on the light page, dark secondary link.
  const ctas = renderCtas(text, bg, text);

  const byline = (props.bylineLabel || props.bylineValue || onFieldChange) ? (
    <div className="text-[10px] uppercase tracking-[0.28em] font-medium" style={{ opacity: 0.55 }}>
      <InlineText
        as="span"
        value={props.bylineLabel ?? ""}
        onUpdate={field("bylineLabel")}
      />
      {(props.bylineValue || onFieldChange) && (
        <div
          className="text-sm normal-case tracking-normal mt-1.5 font-medium"
          style={{ opacity: 1.4 }}
        >
          <InlineText
            as="span"
            value={props.bylineValue ?? ""}
            onUpdate={field("bylineValue")}
          />
        </div>
      )}
    </div>
  ) : null;

  if (layout === "cover") {
    const scrim = props.coverScrim ?? 0.55;
    // The cover surface is near-black; resolve a CTA fill that clears WCAG UI
    // contrast against it (with a legible label) instead of the dark `text`
    // ink that the light layouts use. The secondary link sits on the same dark
    // surface, so render it white.
    const coverCta = pickCtaButtonColors(brand, COVER_SURFACE);
    const coverCtas = renderCtas(coverCta.bg, coverCta.text, "#FFFFFF");
    return (
      <section className="relative overflow-hidden isolate" style={{ backgroundColor: COVER_SURFACE, color: "#FFFFFF", fontFamily: bodyFamily }}>
        <div className="relative w-full min-h-[640px] lg:min-h-[760px]">
          {props.imageUrl ? (
            <InlineImage
              src={props.imageUrl}
              alt=""
              wrapperClassName="absolute inset-0"
              className="absolute inset-0 w-full h-full object-cover"
              onUpdate={field("imageUrl")}
            />
          ) : (
            <div className="absolute inset-0" style={{ backgroundColor: accent, opacity: 0.4 }} />
          )}
          <div
            aria-hidden
            className="absolute inset-0 z-10"
            style={{
              background: `linear-gradient(180deg, rgba(0,0,0,${scrim * 0.6}) 0%, rgba(0,0,0,${scrim * 0.3}) 35%, rgba(0,0,0,${scrim}) 100%)`,
            }}
          />
          <div className="relative z-20 max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-20 lg:pt-20 lg:pb-28 min-h-[640px] lg:min-h-[760px] flex flex-col">
            {issueStrip && <div className="text-white/70">{issueStrip}</div>}
            <div className="flex-1" />
            <div className="max-w-3xl space-y-6 text-white">
              {eyebrow}
              <InlineText
                as="h1"
                value={props.headline}
                onUpdate={field("headline")}
                className=""
                style={{ ...headlineStyle, color: "#FFFFFF" }}
              />
              {subheadline && (
                <div className="text-white/85">{subheadline}</div>
              )}
              <div className="text-white">{coverCtas}</div>
              {byline && <div className="pt-4 text-white/80">{byline}</div>}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (layout === "stacked") {
    return (
      <section className="relative overflow-hidden" style={{ backgroundColor: bg, color: text, fontFamily: bodyFamily }}>
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
          {showRule && (
            <div className="border-t mb-10" style={{ borderColor: text, opacity: 0.12 }} />
          )}
          <div className="text-center space-y-6 max-w-3xl mx-auto">
            {issueStrip && <div className="flex justify-center">{issueStrip}</div>}
            {eyebrow && <div className="flex justify-center">{eyebrow}</div>}
            <InlineText
              as="h1"
              value={props.headline}
              onUpdate={field("headline")}
              style={headlineStyle}
            />
            {subheadline && (
              <div className="flex justify-center">{subheadline}</div>
            )}
            <div className="flex justify-center">{ctas}</div>
            {byline && <div className="flex justify-center pt-2">{byline}</div>}
          </div>

          {(props.imageUrl || onFieldChange) && (
            <div className="mt-14 lg:mt-20">
              {props.imageUrl ? (
                <InlineImage
                  src={props.imageUrl}
                  alt=""
                  wrapperClassName="block w-full"
                  className={`w-full ${aspect} object-cover rounded-lg shadow-2xl`}
                  onUpdate={field("imageUrl")}
                />
              ) : (
                <div
                  className={`w-full ${aspect} rounded-lg`}
                  style={{ backgroundColor: accent, opacity: 0.3 }}
                />
              )}
            </div>
          )}
          {showRule && (
            <div className="border-t mt-16" style={{ borderColor: text, opacity: 0.12 }} />
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: bg, color: text, fontFamily: bodyFamily }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-20 pb-20 lg:pb-28">
        {showRule && (
          <div className="border-t mb-12 lg:mb-16" style={{ borderColor: text, opacity: 0.12 }} />
        )}
        {issueStrip && <div className="mb-10">{issueStrip}</div>}

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-7 space-y-6">
            {eyebrow}
            <InlineText
              as="h1"
              value={props.headline}
              onUpdate={field("headline")}
              style={headlineStyle}
            />
            {subheadline && (
              <div className="pl-5 border-l-2 pt-1" style={{ borderColor: accent }}>
                {subheadline}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-3">
              {ctas}
              {byline}
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div
              aria-hidden
              className="absolute -top-8 -left-6 w-40 h-40 rounded-full blur-3xl"
              style={{ backgroundColor: accent, opacity: 0.18 }}
            />
            {props.imageUrl ? (
              <InlineImage
                src={props.imageUrl}
                alt=""
                wrapperClassName="block w-full"
                className={`relative ${aspect} w-full object-cover rounded-lg`}
                style={{
                  transform: rotation ? `rotate(${rotation}deg)` : undefined,
                  boxShadow: "0 30px 80px -30px rgba(0,0,0,0.35)",
                }}
                onUpdate={field("imageUrl")}
              />
            ) : (
              <div
                className={`relative ${aspect} w-full rounded-lg`}
                style={{
                  backgroundColor: accent,
                  opacity: 0.35,
                  transform: rotation ? `rotate(${rotation}deg)` : undefined,
                }}
              />
            )}
          </div>
        </div>

        {showRule && (
          <div className="border-t mt-16 lg:mt-20" style={{ borderColor: text, opacity: 0.12 }} />
        )}
      </div>
    </section>
  );
}
