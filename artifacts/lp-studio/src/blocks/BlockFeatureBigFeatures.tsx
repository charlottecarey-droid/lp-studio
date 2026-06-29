import type { BrandConfig } from "@/lib/brand-config";
import type {
  FeatureBigFeaturesBlockProps,
  SectionFeatureItem,
} from "@/lib/block-types";
import { cn } from "@/lib/utils";
import { BRAND_BODY_FONT } from "@/lib/brand-fonts";
import { InlineText } from "@/components/InlineText";
import {
  alignItemsClass,
  alignTextClass,
  sectionRadiusClass,
  useSectionTheme,
  SectionHeader,
  SectionItemMedia,
  SectionItemTitle,
  SectionItemBody,
  SectionCtas,
} from "./shared/section-kit";

interface Props {
  props: FeatureBigFeaturesBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FeatureBigFeaturesBlockProps) => void;
  pageId?: number;
  variantId?: number;
  onCtaClick?: (url: string) => void;
}

/**
 * Feature — big features.
 *
 * Large alternating feature rows: copy on one side, a full-bleed visual on the
 * other, alternating sides per index. Each row carries the section's primary CTA
 * plus an optional per-item note. Two image treatments: "card" (default — the
 * row is a contained, shadowed card with the image as a full side panel) and
 * "blended" (the image melts into the section with soft corners, no card
 * chrome). When an item has no photo (the AI generator is icon-led and never
 * emits image URLs) the visual degrades to a premium accent-tinted panel with
 * the item's icon — never an empty image box. Every color, type style,
 * alignment, radius, and CTA decision flows through the shared `section-kit`
 * toolkit so all siblings read and edit identically.
 */
export function BlockFeatureBigFeatures({
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
  const isCard = (props.imageTreatment ?? "card") === "card";

  const titleColor = isCard ? theme.cardInk : theme.ink;
  const bodyColor = isCard ? theme.cardMuted : theme.muted;
  const mediaAccent = isCard ? theme.cardAccent : theme.accent;

  const update = (patch: Partial<FeatureBigFeaturesBlockProps>) =>
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
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
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
          <div className="mt-12 flex flex-col gap-8 sm:mt-16">
            {items.map((item, i) => {
              const imageRight = i % 2 === 0;

              const textSide = (
                <div
                  className={cn(
                    "flex flex-col justify-center",
                    isCard ? "p-8 sm:p-12" : "",
                    alignItemsClass(align),
                    alignTextClass(align),
                    imageRight ? "" : "lg:order-2",
                  )}
                >
                  <SectionItemTitle
                    value={item.title}
                    onUpdate={isBuilder ? (v) => updateItem(i, { title: v }) : undefined}
                    color={titleColor}
                    size="lg"
                  />
                  <SectionItemBody
                    value={item.description}
                    onUpdate={
                      isBuilder ? (v) => updateItem(i, { description: v }) : undefined
                    }
                    color={bodyColor}
                    className="mt-4 max-w-xl"
                  />
                  <SectionCtas
                    props={props}
                    brand={brand}
                    theme={theme}
                    align={align}
                    isBuilder={isBuilder}
                    onUpdate={update}
                    pageId={pageId}
                    variantId={variantId}
                    source="feature-big-features"
                    onCtaClick={onCtaClick}
                    primaryOnly
                    className="mt-7"
                  />
                  {(isBuilder || !!(item.note && item.note.trim())) && (
                    <InlineText
                      as="p"
                      value={item.note ?? ""}
                      onUpdate={isBuilder ? (v) => updateItem(i, { note: v }) : undefined}
                      className={cn("mt-3 text-sm font-medium", alignTextClass(align))}
                      style={{ color: bodyColor, fontFamily: BRAND_BODY_FONT }}
                    />
                  )}
                </div>
              );

              if (isCard) {
                return (
                  <div
                    key={i}
                    className={cn("grid grid-cols-1 overflow-hidden lg:grid-cols-2", radius)}
                    style={{
                      backgroundColor: theme.cardBg,
                      boxShadow: "0 10px 40px -16px rgba(0,0,0,0.18)",
                    }}
                  >
                    {textSide}
                    <div
                      className={cn(
                        "relative h-full min-h-[280px] w-full overflow-hidden",
                        imageRight ? "lg:order-2" : "",
                      )}
                    >
                      <SectionItemMedia
                        image={item.image}
                        icon={item.icon}
                        accent={mediaAccent}
                        base={theme.surface.base}
                        alt={item.title}
                        imgClassName="transition-transform duration-700 hover:scale-105"
                        iconClassName="h-16 w-16"
                      />
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16"
                >
                  {textSide}
                  <div
                    className={cn(
                      "relative min-h-[280px] w-full overflow-hidden",
                      radius,
                      imageRight ? "lg:order-2" : "",
                    )}
                  >
                    <SectionItemMedia
                      image={item.image}
                      icon={item.icon}
                      accent={mediaAccent}
                      base={theme.surface.base}
                      alt={item.title}
                      imgClassName="transition-transform duration-700 hover:scale-105"
                      iconClassName="h-16 w-16"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
