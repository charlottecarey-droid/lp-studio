import type { BrandConfig } from "@/lib/brand-config";
import type {
  ValuePillarsHeadlineBadgeBlockProps,
  SectionFeatureItem,
} from "@/lib/block-types";
import { cn } from "@/lib/utils";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import {
  alignJustifyClass,
  alignTextClass,
  sectionRadiusClass,
  useSectionTheme,
  SectionHeader,
  SectionIconVisual,
  SectionCtas,
} from "./shared/section-kit";

interface Props {
  props: ValuePillarsHeadlineBadgeBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: ValuePillarsHeadlineBadgeBlockProps) => void;
  pageId?: number;
  variantId?: number;
  onCtaClick?: (url: string) => void;
}

/**
 * Value pillars — headline badge.
 *
 * A big shared header above pillars whose titles ride inside prominent,
 * badge-style bars. Every badge uses ONE consistent accent tint
 * (color-mix(theme.accent 12%, surface.base)) with an inline icon and the
 * pillar title; the supporting copy sits beneath. Same contract as the
 * IconTrio reference — every color, type style, alignment, radius, and CTA
 * decision flows through the shared `section-kit` toolkit so all siblings read
 * and edit identically.
 */
export function BlockValuePillarsHeadlineBadge({
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

  const badgeBg = `color-mix(in srgb, ${theme.accent} 12%, ${theme.surface.base})`;

  const update = (patch: Partial<ValuePillarsHeadlineBadgeBlockProps>) =>
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
              <div key={i} className={cn("flex flex-col", alignTextClass(align))}>
                <div
                  className={cn(
                    "flex w-full items-center gap-3 px-5 py-4",
                    radius,
                    alignJustifyClass(align),
                  )}
                  style={{ backgroundColor: badgeBg }}
                >
                  <SectionIconVisual
                    value={item.icon}
                    color={theme.accent}
                    iconClassName="h-5 w-5"
                    radiusClass={radius}
                    alt={item.title}
                    withTile={false}
                  />
                  <InlineText
                    as="h3"
                    value={item.title ?? ""}
                    onUpdate={isBuilder ? (v) => updateItem(i, { title: v }) : undefined}
                    className="text-lg font-bold tracking-tight sm:text-xl"
                    style={{ color: theme.ink, fontFamily: BRAND_DISPLAY_FONT }}
                  />
                </div>
                <InlineText
                  as="p"
                  value={item.description ?? ""}
                  onUpdate={isBuilder ? (v) => updateItem(i, { description: v }) : undefined}
                  className="mt-4 text-base leading-7"
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
          source="value-pillars-headline-badge"
          onCtaClick={onCtaClick}
        />
      </div>
    </section>
  );
}
