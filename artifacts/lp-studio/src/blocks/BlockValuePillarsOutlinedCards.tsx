import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex } from "@/lib/brand-config";
import type {
  ValuePillarsOutlinedCardsBlockProps,
  SectionFeatureItem,
} from "@/lib/block-types";
import { cn } from "@/lib/utils";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import {
  alignItemsClass,
  alignTextClass,
  sectionRadiusClass,
  useSectionTheme,
  SectionHeader,
  SectionIconVisual,
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
                    iconClassName="h-9 w-9"
                    radiusClass={radius}
                    alt={item.title}
                    withTile={false}
                  />
                </div>
                <InlineText
                  as="h3"
                  value={item.title ?? ""}
                  onUpdate={isBuilder ? (v) => updateItem(i, { title: v }) : undefined}
                  className="text-xl font-bold tracking-tight"
                  style={{ color: theme.ink, fontFamily: BRAND_DISPLAY_FONT }}
                />
                <InlineText
                  as="p"
                  value={item.description ?? ""}
                  onUpdate={isBuilder ? (v) => updateItem(i, { description: v }) : undefined}
                  className="mt-3 flex-1 text-base leading-7"
                  style={{ color: theme.muted, fontFamily: BRAND_BODY_FONT }}
                  multiline
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
          source="value-pillars-outlined-cards"
          onCtaClick={onCtaClick}
        />
      </div>
    </section>
  );
}
