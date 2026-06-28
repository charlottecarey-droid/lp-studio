import type { BrandConfig } from "@/lib/brand-config";
import type {
  ValuePillarsIconTrioBlockProps,
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
  props: ValuePillarsIconTrioBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: ValuePillarsIconTrioBlockProps) => void;
  pageId?: number;
  variantId?: number;
  onCtaClick?: (url: string) => void;
}

/**
 * Value pillars — icon trio.
 *
 * Three (or more) centered, icon-led pillars under a shared header. The
 * reference implementation for the graduated section blocks: every color,
 * type style, alignment, radius, and CTA decision flows through the shared
 * `section-kit` toolkit so all nine siblings read and edit identically.
 */
export function BlockValuePillarsIconTrio({
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

  const update = (patch: Partial<ValuePillarsIconTrioBlockProps>) =>
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
          <div className="mx-auto mt-12 grid max-w-xl grid-cols-1 gap-10 sm:mt-16 sm:gap-8 md:grid-cols-3 lg:max-w-none">
            {items.map((item, i) => (
              <div
                key={i}
                className={cn("flex flex-col", alignItemsClass(align), alignTextClass(align))}
              >
                <div className="mb-6">
                  <SectionIconVisual
                    value={item.icon}
                    color={theme.accent}
                    tileClassName="h-16 w-16"
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
                  className="mt-3 max-w-xs"
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
          source="value-pillars-icon-trio"
          onCtaClick={onCtaClick}
        />
      </div>
    </section>
  );
}
