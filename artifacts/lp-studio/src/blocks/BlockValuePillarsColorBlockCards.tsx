import type { BrandConfig } from "@/lib/brand-config";
import { contrastTextColor, isValidHex } from "@/lib/brand-config";
import type {
  ValuePillarsColorBlockCardsBlockProps,
  SectionFeatureItem,
} from "@/lib/block-types";
import { cn } from "@/lib/utils";
import { BRAND_BODY_FONT } from "@/lib/brand-fonts";
import {
  alignItemsClass,
  alignTextClass,
  sectionRadiusClass,
  useSectionTheme,
  SectionHeader,
  SectionIconVisual,
  SectionItemTitle,
  SectionItemBody,
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
 * Each pillar sits inside a SOLID color block. Every card uses the SAME brand
 * color (never a per-card rainbow): the author's card surface when they set one
 * (`cardBgColor` → `theme.cardBg`), otherwise a confident brand-accent fill.
 * Title / body / icon colors are resolved to stay contrast-safe against that
 * fill — the toolkit's card ink when a card surface is set, or ink derived from
 * the accent fill via `contrastTextColor` otherwise. All color, type, radius,
 * alignment, and CTA decisions flow through the shared `section-kit` toolkit so
 * this block reads and edits identically to its siblings.
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

  // Solid color block: the author's card surface when set, else a brand-accent
  // fill. ALL cards share this single color — never per-card.
  const usingCardBg = isValidHex(props.cardBgColor ?? "");
  const cardFill = usingCardBg ? theme.cardBg : theme.accent;
  // Contrast-safe ink against the chosen fill.
  const cardInk = usingCardBg ? theme.cardInk : contrastTextColor(theme.accent);
  const cardMuted = usingCardBg
    ? theme.cardMuted
    : `color-mix(in srgb, ${cardInk} 78%, transparent)`;
  // Icon color: the card accent on a light card surface, else the contrast ink
  // (a brand accent on an accent fill would vanish).
  const iconColor = usingCardBg ? theme.cardAccent : cardInk;

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
          align={align}
          theme={theme}
          brand={brand}
          isBuilder={isBuilder}
          onUpdate={updateHeader}
        />

        {items.length > 0 && (
          <div className="mx-auto mt-12 grid max-w-xl grid-cols-1 gap-6 sm:mt-16 md:grid-cols-3 lg:max-w-none">
            {items.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "flex flex-col p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:p-8",
                  radius,
                  alignItemsClass(align),
                  alignTextClass(align),
                )}
                style={{ backgroundColor: cardFill }}
              >
                <div className="mb-6">
                  <SectionIconVisual
                    value={item.icon}
                    color={iconColor}
                    tileClassName="h-12 w-12"
                    tileBg={`color-mix(in srgb, ${iconColor} 16%, transparent)`}
                    radiusClass={radius}
                    alt={item.title}
                  />
                </div>
                <SectionItemTitle
                  value={item.title}
                  onUpdate={isBuilder ? (v) => updateItem(i, { title: v }) : undefined}
                  color={cardInk}
                />
                <SectionItemBody
                  value={item.description}
                  onUpdate={isBuilder ? (v) => updateItem(i, { description: v }) : undefined}
                  color={cardMuted}
                  className="mt-3"
                />
              </div>
            ))}
          </div>
        )}

        <SectionCtas
          props={props}
          brand={brand}
          theme={theme}
          align={align}
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
