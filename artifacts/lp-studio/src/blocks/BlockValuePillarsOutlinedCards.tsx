import type { CSSProperties } from "react";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex } from "@/lib/brand-config";
import type {
  ValuePillarsOutlinedCardsBlockProps,
  SectionFeatureItem,
} from "@/lib/block-types";
import { OUTLINED_CARDS_SHOWCASE_DEFAULTS } from "@/lib/block-types";
import { cn } from "@/lib/utils";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { InlineText } from "@/components/InlineText";
import {
  alignItemsClass,
  alignTextClass,
  sectionRadiusClass,
  sectionIconVisualSize,
  useSectionTheme,
  SectionHeader,
  SectionIconVisual,
  SectionItemMedia,
  SectionItemTitle,
  SectionItemBody,
  SectionItemLink,
  SectionCtas,
} from "./shared/section-kit";

interface Props {
  props: ValuePillarsOutlinedCardsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: ValuePillarsOutlinedCardsBlockProps) => void;
  pageId?: number;
  variantId?: number;
  onCtaClick?: (url: string) => void;
}

/**
 * Value pillars — outlined cards.
 *
 * Icon-led pillars laid out as transparent, outlined cards under a shared
 * header. The cards carry NO fill — only a visible hairline border — so the
 * section background shows through. Icons, titles, and body copy use the
 * section ink/accent (the cards are transparent), and the outline width/color
 * are author-customisable. Everything else flows through the shared
 * `section-kit` toolkit so it reads and edits identically to its siblings.
 */
export function BlockValuePillarsOutlinedCards({
  props,
  brand,
  onFieldChange,
  pageId,
  variantId,
  onCtaClick,
}: Props) {
  const isBuilder = !!onFieldChange;
  const theme = useSectionTheme(props, brand);
  const align = props.align ?? "center";
  const items = props.items ?? [];
  const radius = sectionRadiusClass(props.cardRadius);
  const sz = sectionIconVisualSize(props.mediaSize);

  const update = (patch: Partial<ValuePillarsOutlinedCardsBlockProps>) =>
    onFieldChange?.({ ...props, ...patch });
  const updateHeader = (key: "eyebrow" | "heading" | "subhead", value: string) =>
    update({ [key]: value });
  const updateItem = (i: number, patch: Partial<SectionFeatureItem>) =>
    update({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });

  const borderWidth = props.cardBorderWidth ?? 1;
  const borderColor = isValidHex(props.cardBorderColor ?? "")
    ? (props.cardBorderColor as string)
    : theme.surface.isDark
      ? "rgba(255,255,255,0.18)"
      : "rgba(15,23,42,0.14)";

  /* ------------------------------------------------ showcase variant */
  const isShowcase = props.variant === "showcase";
  const D = OUTLINED_CARDS_SHOWCASE_DEFAULTS;

  const cardChrome: CSSProperties = {
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderWidth: `${borderWidth}px`,
    borderColor,
  };
  const eyebrowClass = "text-sm font-bold uppercase tracking-widest";
  const t = (v: string | undefined, fallback: string) =>
    v === undefined ? fallback : v;

  return (
    <section
      className="w-full py-16 sm:py-24"
      style={{
        background: theme.surface.background,
        color: theme.ink,
        fontFamily: BRAND_BODY_FONT,
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          eyebrow={props.eyebrow}
          heading={props.heading}
          subhead={props.subhead}
          align="center"
          theme={theme}
          brand={brand}
          isBuilder={isBuilder}
          onUpdate={updateHeader}
        />

        {items.length > 0 && (
          <div className="mx-auto mt-12 grid max-w-xl grid-cols-1 gap-6 sm:mt-16 sm:max-w-none sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "flex flex-col p-8 transition-all duration-300 hover:-translate-y-1",
                  alignItemsClass(align),
                  alignTextClass(align),
                  radius,
                )}
                style={{
                  backgroundColor: "transparent",
                  borderStyle: "solid",
                  borderWidth: `${borderWidth}px`,
                  borderColor,
                }}
              >
                <div className="mb-5">
                  <SectionIconVisual
                    value={item.icon}
                    color={theme.accent}
                    iconClassName={sz?.icon ?? "h-9 w-9"}
                    imageClassName={sz?.image}
                    radiusClass={radius}
                    alt={item.title}
                    withTile={false}
                  />
                </div>
                <SectionItemTitle
                  value={item.title}
                  onUpdate={isBuilder ? (v) => updateItem(i, { title: v }) : undefined}
                  color={theme.ink}
                />
                <SectionItemBody
                  value={item.description}
                  onUpdate={isBuilder ? (v) => updateItem(i, { description: v }) : undefined}
                  color={theme.muted}
                  className="mt-3 flex-1"
                />
                <SectionItemLink
                  label={item.linkLabel}
                  url={item.linkUrl}
                  color={theme.accent}
                />
              </div>
            ))}
          </div>
        )}

        {isShowcase && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Big-image feature card */}
            <div className={cn("flex flex-col p-8 sm:p-10", radius)} style={cardChrome}>
              <div className={cn("aspect-[16/10] w-full overflow-hidden", radius)}>
                <SectionItemMedia
                  value={props.showcaseFeatureImage || "Layers"}
                  alt={t(props.showcaseFeatureTitle, D.showcaseFeatureTitle)}
                  accent={theme.accent}
                  base={theme.surface.base}
                />
              </div>
              <div className="mt-auto pt-8 text-left">
                <InlineText
                  as="p"
                  value={t(props.showcaseFeatureEyebrow, D.showcaseFeatureEyebrow)}
                  onUpdate={isBuilder ? (v) => update({ showcaseFeatureEyebrow: v }) : undefined}
                  className={eyebrowClass}
                  style={{ color: theme.accent, fontFamily: BRAND_DISPLAY_FONT }}
                />
                <SectionItemTitle
                  value={t(props.showcaseFeatureTitle, D.showcaseFeatureTitle)}
                  onUpdate={isBuilder ? (v) => update({ showcaseFeatureTitle: v }) : undefined}
                  color={theme.ink}
                  size="lg"
                  className="mt-3 text-balance"
                />
                <SectionItemBody
                  value={t(props.showcaseFeatureBody, D.showcaseFeatureBody)}
                  onUpdate={isBuilder ? (v) => update({ showcaseFeatureBody: v }) : undefined}
                  color={theme.muted}
                  className="mt-3"
                />
              </div>
            </div>

            {/* Customer story card */}
            <div className={cn("flex flex-col p-8 sm:p-10", radius)} style={cardChrome}>
              <div className={cn("aspect-[16/10] w-full overflow-hidden", radius)}>
                <SectionItemMedia
                  value={props.showcaseStoryImage || "Quote"}
                  alt={t(props.showcaseStoryName, D.showcaseStoryName)}
                  accent={theme.accent}
                  base={theme.surface.base}
                />
              </div>
              <div className="mt-4">
                <InlineText
                  as="p"
                  value={t(props.showcaseStoryName, D.showcaseStoryName)}
                  onUpdate={isBuilder ? (v) => update({ showcaseStoryName: v }) : undefined}
                  className="text-base font-bold"
                  style={{ color: theme.ink, fontFamily: BRAND_DISPLAY_FONT }}
                />
                <InlineText
                  as="p"
                  value={t(props.showcaseStoryRole, D.showcaseStoryRole)}
                  onUpdate={isBuilder ? (v) => update({ showcaseStoryRole: v }) : undefined}
                  className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: theme.muted, fontFamily: BRAND_BODY_FONT }}
                />
                <InlineText
                  as="p"
                  value={t(props.showcaseStoryCompany, D.showcaseStoryCompany)}
                  onUpdate={isBuilder ? (v) => update({ showcaseStoryCompany: v }) : undefined}
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: theme.muted, fontFamily: BRAND_BODY_FONT }}
                />
              </div>
              <div className="mt-auto pt-8 text-left">
                <InlineText
                  as="p"
                  value={t(props.showcaseStoryEyebrow, D.showcaseStoryEyebrow)}
                  onUpdate={isBuilder ? (v) => update({ showcaseStoryEyebrow: v }) : undefined}
                  className={eyebrowClass}
                  style={{ color: theme.accent, fontFamily: BRAND_DISPLAY_FONT }}
                />
                <SectionItemTitle
                  value={t(props.showcaseStoryQuote, D.showcaseStoryQuote)}
                  onUpdate={isBuilder ? (v) => update({ showcaseStoryQuote: v }) : undefined}
                  color={theme.ink}
                  size="lg"
                  className="mt-3 text-balance"
                />
                <SectionItemBody
                  value={t(props.showcaseStoryBody, D.showcaseStoryBody)}
                  onUpdate={isBuilder ? (v) => update({ showcaseStoryBody: v }) : undefined}
                  color={theme.muted}
                  className="mt-3"
                />
              </div>
            </div>
          </div>
        )}

        <SectionCtas
          props={props}
          brand={brand}
          theme={theme}
          align="center"
          isBuilder={isBuilder}
          onUpdate={update}
          pageId={pageId}
          variantId={variantId}
          source="value-pillars-outlined-cards"
          onCtaClick={onCtaClick}
        />
      </div>
    </section>
  );
}
