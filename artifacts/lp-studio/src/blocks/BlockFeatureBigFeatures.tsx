import type { BrandConfig } from "@/lib/brand-config";
import {
  isValidHex,
  pickContrastingColor,
  contrastTextColor,
  DEFAULT_BRAND,
} from "@/lib/brand-config";
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
  sectionItemHasImage,
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
 * Large horizontal feature cards: each item is a contained, shadowed card with
 * the copy (title, body, primary CTA, optional note) on one side and a
 * full-bleed photo filling the other. Sides alternate down the stack. The
 * section header is ALWAYS centered; the `align` prop controls only the copy
 * INSIDE each card. The card surface is always a solid, contrast-safe panel so
 * the cards stay visible on any section background (a brand-colored surface used
 * to wash the card out to an invisible translucent film).
 *
 * When an item has no photo (the AI generator is icon-led and never emits image
 * URLs) the card collapses to a clean full-width copy card — never an empty
 * image box or icon placeholder. The optional "blended" treatment drops the
 * card chrome and melts the image into the section.
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
  // Per-card copy alignment is author-editable; the section header is always centered.
  const align = props.align ?? "left";
  const items = props.items ?? [];
  const radius = sectionRadiusClass(props.cardRadius);
  const isCard = (props.imageTreatment ?? "card") === "card";

  // Solid, visible card surface (a brand-colored section washes the shared
  // translucent card-lift out to nothing, so resolve a concrete panel here).
  const cardSurface = isValidHex(props.cardBgColor ?? "")
    ? (props.cardBgColor as string)
    : "#FFFFFF";
  const cardIsDark = contrastTextColor(cardSurface) === "#ffffff";
  const cardInk = pickContrastingColor(
    cardIsDark ? "#FFFFFF" : "#0F172A",
    cardSurface,
    [cardIsDark ? "#0F172A" : "#FFFFFF"],
    4.5,
  );
  const cardMuted = cardIsDark ? "rgba(255,255,255,0.72)" : "rgba(15,23,42,0.70)";
  const accentPref = isValidHex(brand.accentColor)
    ? brand.accentColor
    : DEFAULT_BRAND.accentColor;
  const cardAccent = pickContrastingColor(accentPref, cardSurface, [cardInk], 3.0);

  const titleColor = isCard ? cardInk : theme.ink;
  const bodyColor = isCard ? cardMuted : theme.muted;
  const mediaAccent = isCard ? cardAccent : theme.accent;

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
          align="center"
          theme={theme}
          brand={brand}
          isBuilder={isBuilder}
          onUpdate={updateHeader}
        />

        {items.length > 0 && (
          <div className="mt-12 flex flex-col gap-8 sm:mt-16">
            {items.map((item, i) => {
              const hasImage = sectionItemHasImage(item);
              // "alternate" (default) flips sides down the stack; "left"/"right"
              // pin the photo to the same side on every card.
              const imageSide = props.imageSide ?? "alternate";
              const imageRight =
                imageSide === "alternate" ? i % 2 === 0 : imageSide === "right";

              const textSide = (
                <div
                  className={cn(
                    "flex flex-col justify-center",
                    isCard ? "p-8 sm:p-12" : "",
                    alignItemsClass(align),
                    alignTextClass(align),
                    hasImage && !imageRight ? "lg:order-2" : "",
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

              const mediaSide = hasImage ? (
                <div
                  className={cn(
                    "relative min-h-[280px] w-full overflow-hidden",
                    isCard ? "h-full" : radius,
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
              ) : null;

              if (isCard) {
                return (
                  <div
                    key={i}
                    className={cn(
                      "grid grid-cols-1 overflow-hidden",
                      hasImage ? "lg:grid-cols-2" : "",
                      radius,
                    )}
                    style={{
                      backgroundColor: cardSurface,
                      boxShadow: "0 10px 40px -16px rgba(0,0,0,0.18)",
                    }}
                  >
                    {textSide}
                    {mediaSide}
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  className={cn(
                    "grid grid-cols-1 items-center",
                    hasImage ? "gap-8 lg:grid-cols-2 lg:gap-16" : "",
                  )}
                >
                  {textSide}
                  {mediaSide}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
