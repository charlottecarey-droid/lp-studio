import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex } from "@/lib/brand-config";
import type {
  ValuePillarsDividedColumnsBlockProps,
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
  props: ValuePillarsDividedColumnsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: ValuePillarsDividedColumnsBlockProps) => void;
  pageId?: number;
  variantId?: number;
  onCtaClick?: (url: string) => void;
}

/**
 * Value pillars — divided columns.
 *
 * Three (or more) icon-led pillars laid out as equal columns separated by thin
 * divider lines: vertical hairlines between columns on desktop, horizontal
 * hairlines between stacked rows on mobile. Author-tunable divider width/color;
 * everything else (color, type, alignment, radius, CTA) flows through the shared
 * `section-kit` toolkit so it reads and edits identically to its siblings.
 */
export function BlockValuePillarsDividedColumns({
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

  const update = (patch: Partial<ValuePillarsDividedColumnsBlockProps>) =>
    onFieldChange?.({ ...props, ...patch });
  const updateHeader = (key: "eyebrow" | "heading" | "subhead", value: string) =>
    update({ [key]: value });
  const updateItem = (i: number, patch: Partial<SectionFeatureItem>) =>
    update({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });

  const dividerWidth = props.dividerWidth ?? 1;
  const dividerColor = isValidHex(props.dividerColor ?? "")
    ? (props.dividerColor as string)
    : theme.surface.isDark
      ? "rgba(255,255,255,0.18)"
      : "rgba(15,23,42,0.14)";
  const showDivider = dividerWidth > 0;

  const COLS = 3;
  const usedCols = Math.min(items.length, COLS);

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
          <div className="relative mt-12 grid grid-cols-1 sm:mt-16 md:grid-cols-3">
            {/* Vertical dividers between columns (desktop). */}
            {showDivider && (
              <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
                {Array.from({ length: COLS - 1 }).map((_, k) =>
                  k + 1 < usedCols ? (
                    <div
                      key={k}
                      className="absolute inset-y-0"
                      style={{
                        left: `${((k + 1) / COLS) * 100}%`,
                        borderLeftWidth: `${dividerWidth}px`,
                        borderColor: dividerColor,
                        borderStyle: "solid",
                      }}
                    />
                  ) : null,
                )}
              </div>
            )}

            {items.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "relative flex flex-col p-6 md:px-10 md:py-4 lg:px-12",
                  alignItemsClass(align),
                  alignTextClass(align),
                )}
              >
                <div className="mb-6">
                  <SectionIconVisual
                    value={item.icon}
                    color={theme.accent}
                    tileClassName="h-14 w-14 shadow-sm"
                    tileBg={`color-mix(in srgb, ${theme.accent} 12%, ${theme.surface.base})`}
                    radiusClass={radius}
                    alt={item.title}
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
                  className="mt-3"
                />

                {/* Horizontal divider between stacked rows (mobile). */}
                {showDivider && i < items.length - 1 && (
                  <div
                    aria-hidden
                    className="absolute inset-x-6 bottom-0 md:hidden"
                    style={{
                      borderTopWidth: `${dividerWidth}px`,
                      borderColor: dividerColor,
                      borderStyle: "solid",
                    }}
                  />
                )}
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
          source="value-pillars-divided-columns"
          onCtaClick={onCtaClick}
        />
      </div>
    </section>
  );
}
