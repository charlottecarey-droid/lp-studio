import type { BrandConfig } from "@/lib/brand-config";
import type {
  FeatureBigFeaturesBlockProps,
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
 * Alternating large feature rows: copy on one side, a big screenshot/visual on
 * the other, alternating sides per index. The per-item `icon` field holds the
 * large visual (rendered big via the shared toolkit). Two image treatments:
 * "blended" (default — the screenshot melts into the section, soft radius, no
 * chrome) and "card" (the visual sits inside a bordered, tinted card). Every
 * color, type style, alignment, radius, and CTA decision flows through the
 * shared `section-kit` toolkit so all siblings read and edit identically.
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
  const isCard = (props.imageTreatment ?? "blended") === "card";
  const hairline = `color-mix(in srgb, ${theme.cardInk} 12%, transparent)`;

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
          <div className="mt-12 flex flex-col gap-16 sm:mt-16 sm:gap-24">
            {items.map((item, i) => {
              const imageRight = i % 2 === 0;
              return (
                <div
                  key={i}
                  className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16"
                >
                  <div
                    className={cn(
                      "flex flex-col",
                      alignItemsClass(align),
                      alignTextClass(align),
                      imageRight ? "" : "lg:order-2",
                    )}
                  >
                    <SectionItemTitle
                      value={item.title}
                      onUpdate={isBuilder ? (v) => updateItem(i, { title: v }) : undefined}
                      color={theme.ink}
                      size="lg"
                    />
                    <SectionItemBody
                      value={item.description}
                      onUpdate={isBuilder ? (v) => updateItem(i, { description: v }) : undefined}
                      color={theme.muted}
                      className="mt-4 max-w-xl"
                    />
                  </div>

                  <div className={cn(imageRight ? "lg:order-2" : "")}>
                    {isCard ? (
                      <div
                        className={cn("overflow-hidden border", radius)}
                        style={{ background: theme.cardBg, borderColor: hairline }}
                      >
                        <SectionIconVisual
                          value={item.icon}
                          color={theme.cardAccent}
                          iconClassName="h-16 w-16 m-8"
                          imageClassName="w-full h-auto"
                          alt={item.title}
                          withTile={false}
                        />
                      </div>
                    ) : (
                      <SectionIconVisual
                        value={item.icon}
                        color={theme.accent}
                        iconClassName="h-16 w-16"
                        imageClassName="w-full h-auto"
                        radiusClass={radius}
                        alt={item.title}
                        withTile={false}
                      />
                    )}
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
          align={align}
          isBuilder={isBuilder}
          onUpdate={update}
          pageId={pageId}
          variantId={variantId}
          source="feature-big-features"
          onCtaClick={onCtaClick}
        />
      </div>
    </section>
  );
}
