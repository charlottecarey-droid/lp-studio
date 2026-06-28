import type { BrandConfig } from "@/lib/brand-config";
import type {
  ValuePillarsCardColumnsBlockProps,
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
  props: ValuePillarsCardColumnsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: ValuePillarsCardColumnsBlockProps) => void;
  pageId?: number;
  variantId?: number;
  onCtaClick?: (url: string) => void;
}

/**
 * Value pillars — card columns.
 *
 * Three (or more) icon-led pillars rendered as soft, lifted cards under a
 * shared header. Same contract as the IconTrio reference — every color, type
 * style, alignment, radius, and CTA decision flows through the shared
 * `section-kit` toolkit. Card contents resolve against the card surface
 * (cardBg + cardInk/cardMuted/cardAccent) so they stay legible on any
 * background.
 */
export function BlockValuePillarsCardColumns({
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

  const hairline = theme.surface.isDark
    ? "rgba(255,255,255,0.10)"
    : "rgba(15,23,42,0.08)";

  const update = (patch: Partial<ValuePillarsCardColumnsBlockProps>) =>
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
          <div className="mx-auto mt-12 grid max-w-xl grid-cols-1 gap-6 sm:mt-16 sm:gap-8 md:grid-cols-3 lg:max-w-none">
            {items.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "flex flex-col p-8 border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                  radius,
                  alignItemsClass(align),
                  alignTextClass(align),
                )}
                style={{ backgroundColor: theme.cardBg, borderColor: hairline }}
              >
                <div className="mb-6">
                  <SectionIconVisual
                    value={item.icon}
                    color={theme.cardAccent}
                    tileClassName="h-14 w-14"
                    tileBg={`color-mix(in srgb, ${theme.cardAccent} 12%, ${theme.cardBg})`}
                    radiusClass={radius}
                    alt={item.title}
                  />
                </div>
                <SectionItemTitle
                  value={item.title}
                  onUpdate={isBuilder ? (v) => updateItem(i, { title: v }) : undefined}
                  color={theme.cardInk}
                />
                <SectionItemBody
                  value={item.description}
                  onUpdate={isBuilder ? (v) => updateItem(i, { description: v }) : undefined}
                  color={theme.cardMuted}
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
          source="value-pillars-card-columns"
          onCtaClick={onCtaClick}
        />
      </div>
    </section>
  );
}
