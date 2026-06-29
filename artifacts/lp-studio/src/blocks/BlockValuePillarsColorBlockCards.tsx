import type { BrandConfig } from "@/lib/brand-config";
import type {
  ValuePillarsColorBlockCardsBlockProps,
  SectionFeatureItem,
} from "@/lib/block-types";
import { cn } from "@/lib/utils";
import { isValidHex } from "@/lib/brand-config";
import { BRAND_BODY_FONT } from "@/lib/brand-fonts";
import {
  alignItemsClass,
  alignTextClass,
  sectionRadiusClass,
  sectionIconVisualSize,
  useSectionTheme,
  SectionHeader,
  SectionIconVisual,
  SectionItemMedia,
  sectionItemHasImage,
  SectionItemTitle,
  SectionItemBody,
  SectionItemLink,
  SectionCtas,
} from "./shared/section-kit";

interface Props {
  props: ValuePillarsColorBlockCardsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: ValuePillarsColorBlockCardsBlockProps) => void;
  pageId?: number;
  variantId?: number;
  onCtaClick?: (url: string) => void;
}

/**
 * Value pillars — color block cards.
 *
 * Accent-tinted cards each topped by an optional 16:9 photo, with a white icon
 * chip, title, and body below. When a card has no photo (the AI generator only
 * ever emits Lucide icon names, never image URLs) the photo band is omitted and
 * the icon chip carries the visual — so AI pages degrade to a clean, premium
 * icon layout instead of an empty image box. Every color, type style,
 * alignment, radius, and CTA decision flows through the shared `section-kit`
 * toolkit so all nine siblings read and edit identically.
 */
export function BlockValuePillarsColorBlockCards({
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

  // Honor an explicit card color when the author sets one: resolve the card's
  // ink / accent / icon-chip against it. Otherwise keep the signature accent
  // wash over the section base (derived, never a baked literal).
  const hasCardColor = isValidHex(props.cardBgColor ?? "");
  const cardSurface = hasCardColor
    ? theme.cardBg
    : `color-mix(in srgb, ${theme.accent} 8%, ${theme.surface.base})`;
  const cardTitleInk = hasCardColor ? theme.cardInk : theme.ink;
  const cardBodyInk = hasCardColor ? theme.cardMuted : theme.muted;
  const cardAccent = hasCardColor ? theme.cardAccent : theme.accent;
  const chipBg = hasCardColor
    ? `color-mix(in srgb, ${theme.cardAccent} 14%, ${theme.cardBg})`
    : theme.surface.base;

  const update = (patch: Partial<ValuePillarsColorBlockCardsBlockProps>) =>
    onFieldChange?.({ ...props, ...patch });
  const updateHeader = (key: "eyebrow" | "heading" | "subhead", value: string) =>
    update({ [key]: value });
  const updateItem = (i: number, patch: Partial<SectionFeatureItem>) =>
    update({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });

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
            {items.map((item, i) => {
              const hasImage = sectionItemHasImage(item);
              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col overflow-hidden shadow-sm transition-all duration-300 motion-safe:hover:-translate-y-1 hover:shadow-md",
                    radius,
                  )}
                  style={{ backgroundColor: cardSurface }}
                >
                  {hasImage && (
                    <div className="aspect-[16/9] w-full overflow-hidden">
                      <SectionItemMedia
                        image={item.image}
                        icon={item.icon}
                        accent={cardAccent}
                        base={cardSurface}
                        alt={item.title}
                        imgClassName="transition-transform duration-700 hover:scale-105"
                      />
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex flex-1 flex-col p-6 sm:p-8",
                      alignItemsClass(align),
                      alignTextClass(align),
                    )}
                  >
                    <div className="mb-6">
                      <SectionIconVisual
                        value={item.icon}
                        color={cardAccent}
                        tileClassName={cn(sz?.tile ?? "h-12 w-12", "shadow-sm")}
                        tileBg={chipBg}
                        radiusClass="rounded-xl"
                        iconClassName={sz?.icon ?? "h-6 w-6"}
                        imageClassName={sz?.image}
                        alt={item.title}
                      />
                    </div>
                    <SectionItemTitle
                      value={item.title}
                      onUpdate={isBuilder ? (v) => updateItem(i, { title: v }) : undefined}
                      color={cardTitleInk}
                    />
                    <SectionItemBody
                      value={item.description}
                      onUpdate={
                        isBuilder ? (v) => updateItem(i, { description: v }) : undefined
                      }
                      color={cardBodyInk}
                      className="mt-3 flex-1"
                    />
                    <SectionItemLink
                      label={item.linkLabel}
                      url={item.linkUrl}
                      color={cardAccent}
                    />
                  </div>
                </div>
              );
            })}
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
          source="value-pillars-color-block-cards"
          onCtaClick={onCtaClick}
        />
      </div>
    </section>
  );
}
