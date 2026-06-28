import type { BrandConfig } from "@/lib/brand-config";
import type {
  FeatureCardGridBlockProps,
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
  props: FeatureCardGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FeatureCardGridBlockProps) => void;
  pageId?: number;
  variantId?: number;
  onCtaClick?: (url: string) => void;
}

/**
 * Feature card grid.
 *
 * A four-up grid of carded features under a shared header. Each card lifts on
 * hover with a brand-tinted hairline + shadow emphasis, and leads with an
 * icon-or-image visual sitting in a tinted tile. Like every graduated section
 * block, all color / type / alignment / radius / CTA decisions flow through the
 * shared `section-kit` toolkit so the family reads and edits identically.
 */
export function BlockFeatureCardGrid({
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

  const update = (patch: Partial<FeatureCardGridBlockProps>) =>
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
          <div className="mx-auto mt-12 grid grid-cols-1 gap-8 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "flex flex-col p-6 transition-all duration-300 ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-xl",
                  alignItemsClass(align),
                  alignTextClass(align),
                  radius,
                )}
                style={{
                  backgroundColor: theme.cardBg,
                  border: `1px solid color-mix(in srgb, ${theme.cardAccent} 14%, transparent)`,
                }}
              >
                <div className="mb-5">
                  <SectionIconVisual
                    value={item.icon}
                    color={theme.cardAccent}
                    tileClassName="h-14 w-14"
                    tileBg={`color-mix(in srgb, ${theme.cardAccent} 12%, ${theme.cardBg})`}
                    radiusClass={radius}
                    alt={item.title}
                  />
                </div>
                <InlineText
                  as="h3"
                  value={item.title ?? ""}
                  onUpdate={isBuilder ? (v) => updateItem(i, { title: v }) : undefined}
                  className="text-lg font-bold tracking-tight"
                  style={{ color: theme.cardInk, fontFamily: BRAND_DISPLAY_FONT }}
                />
                <InlineText
                  as="p"
                  value={item.description ?? ""}
                  onUpdate={isBuilder ? (v) => updateItem(i, { description: v }) : undefined}
                  className="mt-2 text-sm leading-6"
                  style={{ color: theme.cardMuted, fontFamily: BRAND_BODY_FONT }}
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
          source="feature-card-grid"
          onCtaClick={onCtaClick}
        />
      </div>
    </section>
  );
}
