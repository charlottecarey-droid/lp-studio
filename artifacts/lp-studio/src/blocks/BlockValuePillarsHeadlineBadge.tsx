import type { BrandConfig } from "@/lib/brand-config";
import { contrastTextColor } from "@/lib/brand-config";
import type {
  ValuePillarsHeadlineBadgeBlockProps,
  SectionFeatureItem,
} from "@/lib/block-types";
import { cn } from "@/lib/utils";
import { BRAND_BODY_FONT } from "@/lib/brand-fonts";
import {
  alignTextClass,
  sectionRadiusClass,
  useSectionTheme,
  SectionHeader,
  SectionIconVisual,
  SectionItemMedia,
  sectionItemHasImage,
  SectionItemTitle,
  SectionItemBody,
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
 * Cards with an optional photo, an accent-colored header bar carrying the icon
 * + title, and a body below — set against a section with a top gradient hairline
 * and a soft accent corner glow. The header-bar text picks white/dark by
 * contrast against the accent. When a card has no photo (AI pages are icon-led,
 * never image URLs) the photo band is omitted and the colored bar becomes the
 * card top — a clean, premium fallback, never an empty image box. Every color,
 * type style, alignment, radius, and CTA decision flows through the shared
 * `section-kit` toolkit so all nine siblings read and edit identically.
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

  // Header-bar ink: white or dark, whichever contrasts the accent fill.
  const barInk = contrastTextColor(theme.accent);
  // Decorative section chrome — derived from the accent, no baked literals.
  const hairline = `color-mix(in srgb, ${theme.accent} 45%, transparent)`;

  const update = (patch: Partial<ValuePillarsHeadlineBadgeBlockProps>) =>
    onFieldChange?.({ ...props, ...patch });
  const updateHeader = (key: "eyebrow" | "heading" | "subhead", value: string) =>
    update({ [key]: value });
  const updateItem = (i: number, patch: Partial<SectionFeatureItem>) =>
    update({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });

  return (
    <section
      className="relative w-full overflow-hidden py-16 sm:py-24"
      style={{
        background: theme.surface.background,
        color: theme.ink,
        fontFamily: BRAND_BODY_FONT,
      }}
    >
      {/* Top gradient hairline. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${hairline}, transparent)` }}
      />
      {/* Soft accent corner glow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full blur-3xl"
        style={{ background: theme.accent, opacity: 0.12 }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
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
          <div className="mt-12 grid grid-cols-1 gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, i) => {
              const hasImage = sectionItemHasImage(item);
              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col overflow-hidden shadow-lg transition-all duration-300 motion-safe:hover:-translate-y-1 hover:shadow-xl",
                    radius,
                  )}
                  style={{ backgroundColor: theme.cardBg }}
                >
                  {hasImage && (
                    <div className="relative h-40 w-full overflow-hidden">
                      <SectionItemMedia
                        image={item.image}
                        icon={item.icon}
                        accent={theme.accent}
                        base={theme.surface.base}
                        alt={item.title}
                        imgClassName="transition-transform duration-700 hover:scale-105"
                      />
                    </div>
                  )}
                  <div
                    className="relative flex items-center gap-3 overflow-hidden p-4"
                    style={{ backgroundColor: theme.accent }}
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-black/10 mix-blend-overlay"
                    />
                    <span className="relative z-10 inline-flex shrink-0">
                      <SectionIconVisual
                        value={item.icon}
                        color={barInk}
                        iconClassName="h-5 w-5"
                        imageClassName="h-8 w-8"
                        alt={item.title}
                        withTile={false}
                      />
                    </span>
                    <SectionItemTitle
                      value={item.title}
                      onUpdate={isBuilder ? (v) => updateItem(i, { title: v }) : undefined}
                      color={barInk}
                      className="relative z-10"
                    />
                  </div>
                  <div className={cn("flex flex-1 flex-col p-6 md:p-8", alignTextClass(align))}>
                    <SectionItemBody
                      value={item.description}
                      onUpdate={
                        isBuilder ? (v) => updateItem(i, { description: v }) : undefined
                      }
                      color={theme.cardMuted}
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
          source="value-pillars-headline-badge"
          onCtaClick={onCtaClick}
        />
      </div>
    </section>
  );
}
