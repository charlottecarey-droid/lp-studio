import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import {
  getButtonClasses,
  getHeadingWeightClass,
  getHeadingLetterSpacingClass,
  getBodySizeClass,
  pickCtaButtonColors,
  pickOutlineButtonColors,
  pickContrastingColor,
  contrastTextColor,
  isValidHex,
  DEFAULT_BRAND,
} from "@/lib/brand-config";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { getHeadlineSizeClass } from "@/lib/typography";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { IconOrImage, isImageIcon } from "@/lib/icon-value";
import type {
  SectionAlign,
  SectionRadius,
  SectionMediaSize,
  SectionCtaVariant,
  SectionBlockBase,
} from "@/lib/block-types";

/**
 * Shared toolkit for the graduated "value pillars" + "feature" section blocks.
 *
 * Every one of these blocks shares the SAME contract:
 *  - One alignment knob (`align`, default centered).
 *  - One type style: the section heading and every per-card title use the brand
 *    display font + heading ink; the subhead and every per-card body use the
 *    brand body font + muted ink. (Requirement: consistent typography.)
 *  - BRAND colors only — a single accent for icons/eyebrows, never per-card.
 *  - A per-item icon-OR-image field where images render LARGER than icons.
 *  - One standard CTA (primary + optional secondary) that inherits the page CTA
 *    unless the author customises it, with a Button / Outline / Link style knob.
 *  - A per-block corner-radius knob applied to cards, icon tiles, and images.
 */

/* ------------------------------------------------------------------ align */

export const alignTextClass = (a?: SectionAlign): string =>
  a === "left" ? "text-left" : a === "right" ? "text-right" : "text-center";

export const alignItemsClass = (a?: SectionAlign): string =>
  a === "left" ? "items-start" : a === "right" ? "items-end" : "items-center";

export const alignJustifyClass = (a?: SectionAlign): string =>
  a === "left" ? "justify-start" : a === "right" ? "justify-end" : "justify-center";

/** Centers the header column for "center", pins it left/right otherwise. */
export const headerWrapClass = (a?: SectionAlign): string =>
  a === "left" ? "" : a === "right" ? "ml-auto" : "mx-auto";

/* ----------------------------------------------------------------- radius */

const RADIUS_CLASS: Record<SectionRadius, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
};

export const sectionRadiusClass = (r?: SectionRadius): string =>
  RADIUS_CLASS[r ?? "none"];

/* ------------------------------------------------------------- media size */

const ICON_VISUAL_SIZE: Record<
  SectionMediaSize,
  { tile: string; icon: string; image: string }
> = {
  sm: { tile: "h-12 w-12", icon: "h-6 w-6", image: "h-16 w-16" },
  md: { tile: "h-16 w-16", icon: "h-8 w-8", image: "h-24 w-24" },
  lg: { tile: "h-20 w-20", icon: "h-10 w-10", image: "h-32 w-32" },
};

/**
 * Resolve the per-item icon-visual sizing for the icon-led blocks. Returns the
 * tile / icon / image classes for an explicit `mediaSize`, or `null` when unset
 * so each block keeps its own built-in default sizing.
 */
export const sectionIconVisualSize = (
  size?: SectionMediaSize,
): { tile: string; icon: string; image: string } | null =>
  size ? ICON_VISUAL_SIZE[size] : null;

/* ------------------------------------------------------------------ theme */

export interface SectionTheme {
  surface: ReturnType<typeof resolveSectionSurface>;
  /** Heading + per-card title ink. */
  ink: string;
  /** Subhead + per-card body ink. */
  muted: string;
  /** Brand accent for icons + eyebrow, contrast-safe against the section bg. */
  accent: string;
  /** Card surface color for carded variants. */
  cardBg: string;
  /** Title ink resolved against the CARD bg. */
  cardInk: string;
  /** Body ink resolved against the CARD bg. */
  cardMuted: string;
  /** Accent resolved against the CARD bg. */
  cardAccent: string;
}

interface SectionThemeInput {
  backgroundStyle?: SectionBlockBase["backgroundStyle"];
  bgColor?: string;
  headingColor?: string;
  bodyColor?: string;
  cardBgColor?: string;
  accentColor?: string;
}

/**
 * Derive every color the section needs from the resolved surface + brand.
 * Author overrides (heading/body/card/accent) win when they are valid hex;
 * otherwise everything is derived to stay legible on the chosen background.
 */
export function useSectionTheme(props: SectionThemeInput, brand: BrandConfig): SectionTheme {
  const surface = resolveSectionSurface(
    { backgroundStyle: props.backgroundStyle, bgColor: props.bgColor },
    "#FFFFFF",
    brand,
  );
  const base = surface.base;

  const accentPref = isValidHex(props.accentColor ?? "")
    ? (props.accentColor as string)
    : isValidHex(brand.accentColor)
      ? brand.accentColor
      : DEFAULT_BRAND.accentColor;

  const ink = isValidHex(props.headingColor ?? "")
    ? (props.headingColor as string)
    : surface.color ?? (surface.isDark ? "#FFFFFF" : "#0F172A");

  const muted = isValidHex(props.bodyColor ?? "")
    ? (props.bodyColor as string)
    : surface.isDark
      ? "rgba(255,255,255,0.72)"
      : "rgba(15,23,42,0.70)";

  const accent = pickContrastingColor(accentPref, base, [ink], 3.0);

  // Card surface: explicit override, else a subtle lift off the section bg.
  const cardBg = isValidHex(props.cardBgColor ?? "")
    ? (props.cardBgColor as string)
    : surface.isDark
      ? "rgba(255,255,255,0.05)"
      : "#FFFFFF";

  // When the card bg is a translucent lift (not a hex), reuse the section base
  // for the contrast math — the lift is subtle, so legibility is preserved.
  const cardSolid = isValidHex(cardBg) ? cardBg : base;
  const cardIsDark = isValidHex(cardBg)
    ? contrastTextColor(cardSolid) === "#ffffff"
    : surface.isDark;

  const cardInk = isValidHex(props.headingColor ?? "")
    ? (props.headingColor as string)
    : pickContrastingColor(
        cardIsDark ? "#FFFFFF" : "#0F172A",
        cardSolid,
        [cardIsDark ? "#0F172A" : "#FFFFFF"],
        4.5,
      );

  const cardMuted = isValidHex(props.bodyColor ?? "")
    ? (props.bodyColor as string)
    : cardIsDark
      ? "rgba(255,255,255,0.72)"
      : "rgba(15,23,42,0.70)";

  const cardAccent = pickContrastingColor(accentPref, cardSolid, [cardInk], 3.0);

  return { surface, ink, muted, accent, cardBg, cardInk, cardMuted, cardAccent };
}

/* ----------------------------------------------------------------- header */

export function SectionHeader({
  eyebrow,
  heading,
  subhead,
  align,
  theme,
  brand,
  isBuilder,
  onUpdate,
  headingAs = "h2",
  maxWidthClass = "max-w-2xl",
  className,
}: {
  eyebrow?: string;
  heading?: string;
  subhead?: string;
  align?: SectionAlign;
  theme: SectionTheme;
  brand: BrandConfig;
  isBuilder: boolean;
  onUpdate?: (key: "eyebrow" | "heading" | "subhead", value: string) => void;
  headingAs?: "h2" | "h3";
  maxWidthClass?: string;
  className?: string;
}) {
  const f = (key: "eyebrow" | "heading" | "subhead") =>
    isBuilder && onUpdate ? (v: string) => onUpdate(key, v) : undefined;
  const showEyebrow = isBuilder || !!eyebrow;
  const showSub = isBuilder || !!subhead;
  return (
    <div className={cn(maxWidthClass, headerWrapClass(align), alignTextClass(align), className)}>
      {showEyebrow && (
        <InlineText
          as="p"
          value={eyebrow ?? ""}
          onUpdate={f("eyebrow")}
          className="text-sm font-bold uppercase tracking-widest mb-3"
          style={{ color: theme.accent, fontFamily: BRAND_DISPLAY_FONT }}
        />
      )}
      <InlineText
        as={headingAs}
        value={heading ?? ""}
        onUpdate={f("heading")}
        className={cn(
          getHeadlineSizeClass(undefined, brand.h2Size ?? "lg"),
          "leading-[1.1] tracking-tight text-balance",
          getHeadingWeightClass(brand),
          getHeadingLetterSpacingClass(brand),
        )}
        style={{ color: theme.ink, fontFamily: BRAND_DISPLAY_FONT }}
      />
      {showSub && (
        <InlineText
          as="p"
          value={subhead ?? ""}
          onUpdate={f("subhead")}
          className={cn(getBodySizeClass(brand), "mt-4 leading-8")}
          style={{ color: theme.muted, fontFamily: BRAND_BODY_FONT }}
          multiline
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ icon/image */

/**
 * Render a per-item visual. The field holds EITHER a Lucide icon name OR an
 * image URL. Images render LARGER than icons (and fill the optional frame),
 * icons sit inside a tinted tile.
 */
export function SectionIconVisual({
  value,
  color,
  iconClassName = "h-8 w-8",
  imageClassName = "h-24 w-24",
  tileClassName,
  tileBg,
  radiusClass,
  alt,
  withTile = true,
}: {
  value?: string;
  color?: string;
  iconClassName?: string;
  imageClassName?: string;
  tileClassName?: string;
  tileBg?: string;
  radiusClass?: string;
  alt?: string;
  withTile?: boolean;
}) {
  if (isImageIcon(value)) {
    return (
      <img
        src={value}
        alt={alt ?? ""}
        loading="lazy"
        className={cn("object-contain", imageClassName, radiusClass)}
      />
    );
  }
  const icon = <IconOrImage value={value} className={iconClassName} style={{ color }} />;
  if (!withTile) return <span style={{ color }}>{icon}</span>;
  return (
    <span
      className={cn("inline-flex items-center justify-center", tileClassName, radiusClass)}
      style={{ backgroundColor: tileBg, color }}
    >
      {icon}
    </span>
  );
}

/* ----------------------------------------------------------- item media */

/**
 * Render a per-item visual into the caller's frame. The unified `value` holds
 * EITHER an image URL OR a Lucide icon name (see `sectionItemVisualValue`). An
 * image fills the frame (object-cover); an icon name degrades to a premium
 * accent-tinted panel with the icon centered — so AI-generated pages (which only
 * ever emit icon names, never image URLs) never show an empty / broken image
 * box. The caller owns the aspect frame + corner radius; this fills it
 * (h-full w-full).
 */
export function SectionItemMedia({
  value,
  alt,
  accent,
  base,
  imgClassName,
  iconClassName = "h-10 w-10",
}: {
  /** Unified per-item visual: an image URL renders large, a Lucide icon name
   *  renders centered on a tinted panel. */
  value?: string;
  alt?: string;
  /** Accent for the fallback icon + wash (contrast-safe hex). */
  accent: string;
  /** Surface the media sits on, used as the fallback color-mix base (hex). */
  base: string;
  /** Extra classes applied to the <img> only (e.g. hover transforms). */
  imgClassName?: string;
  iconClassName?: string;
}) {
  if (isImageIcon(value)) {
    return (
      <img
        src={value}
        alt={alt ?? ""}
        loading="lazy"
        className={cn("h-full w-full object-cover", imgClassName)}
      />
    );
  }
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 18%, ${base}), color-mix(in srgb, ${accent} 6%, ${base}))`,
      }}
    >
      <IconOrImage value={value} className={iconClassName} style={{ color: accent }} />
    </div>
  );
}

/**
 * The unified per-item visual value. The `icon` field is the source of truth: it
 * holds EITHER a Lucide icon name OR (when an author picks a photo in the
 * builder) an image URL. A legacy `image` URL is honored only when `icon` is not
 * itself an image URL. AI output only ever emits icon names, so items render
 * icon-first.
 */
export const sectionItemVisualValue = (item: { icon?: string; image?: string }): string | undefined =>
  isImageIcon(item.icon) ? item.icon : isImageIcon(item.image) ? item.image : item.icon;

/** True when the item's unified visual is a usable photo URL (vs. a Lucide icon name). */
export const sectionItemHasImage = (item: { icon?: string; image?: string }): boolean =>
  isImageIcon(sectionItemVisualValue(item));

/* -------------------------------------------------------------- item text */

/**
 * Per-item TITLE. ONE centralized type contract for every graduated section so
 * the family reads identically (Requirement: consistent typography). The scale
 * lives HERE, not in the blocks: `md` (default) for the card / column / badge
 * layouts, `lg` for the large-format big-features rows. Callers pass only
 * LAYOUT classes (margins / width) via `className`, never a type scale.
 */
export function SectionItemTitle({
  value,
  onUpdate,
  color,
  as = "h3",
  size = "md",
  className,
}: {
  value?: string;
  onUpdate?: (v: string) => void;
  color?: string;
  as?: "h3" | "h4";
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <InlineText
      as={as}
      value={value ?? ""}
      onUpdate={onUpdate}
      className={cn(
        "font-bold tracking-tight",
        size === "lg" ? "text-2xl sm:text-3xl" : "text-xl",
        className,
      )}
      style={{ color, fontFamily: BRAND_DISPLAY_FONT }}
    />
  );
}

/**
 * Per-item BODY — the matching half of the centralized type contract: brand
 * body font + one base scale across every section. Callers pass only LAYOUT
 * classes (margins / width / flex) via `className`.
 */
export function SectionItemBody({
  value,
  onUpdate,
  color,
  className,
}: {
  value?: string;
  onUpdate?: (v: string) => void;
  color?: string;
  className?: string;
}) {
  return (
    <InlineText
      as="p"
      value={value ?? ""}
      onUpdate={onUpdate}
      className={cn("text-base leading-7", className)}
      style={{ color, fontFamily: BRAND_BODY_FONT }}
      multiline
    />
  );
}

/* ------------------------------------------------------------- item link */

/**
 * Optional per-card "Learn more →" link. Rendered on the carded section blocks
 * that carried a per-card link in their mockups. The label + URL are edited in
 * the property panel (not inline), so this renders straight from props: nothing
 * when the label is empty, a real <a> when a URL is set, otherwise a styled,
 * non-navigating span. Color is passed in already contrast-resolved.
 */
export function SectionItemLink({
  label,
  url,
  color,
  className,
}: {
  label?: string;
  url?: string;
  color: string;
  className?: string;
}) {
  if (!label || !label.trim()) return null;
  const cls = cn(
    "mt-5 inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80",
    className,
  );
  const inner = (
    <>
      <span>{label}</span>
      <ArrowRight className="h-4 w-4" />
    </>
  );
  if (url && url.trim()) {
    return (
      <a href={url} className={cls} style={{ color, fontFamily: BRAND_BODY_FONT }}>
        {inner}
      </a>
    );
  }
  return (
    <span className={cls} style={{ color, fontFamily: BRAND_BODY_FONT }}>
      {inner}
    </span>
  );
}

/* -------------------------------------------------------------------- cta */

function normalizeAction(
  a?: string,
): "url" | "chilipiper" | "modal-form" | "modal-chilipiper" {
  return a === "chilipiper" || a === "modal-form" || a === "modal-chilipiper" ? a : "url";
}

/**
 * Render the section's standard CTA row (primary + optional secondary). The
 * primary CTA inherits the page CTA unless the author customises it — that
 * inheritance is applied upstream in BlockRenderer, so here we just render the
 * resolved props. Each button has a Button / Outline / Link style knob.
 */
export function SectionCtas({
  props,
  brand,
  theme,
  align,
  isBuilder,
  onUpdate,
  pageId,
  variantId,
  source = "section",
  onCtaClick,
  className,
  primaryOnly = false,
}: {
  props: SectionBlockBase;
  brand: BrandConfig;
  theme: SectionTheme;
  align?: SectionAlign;
  isBuilder: boolean;
  onUpdate?: (patch: Partial<SectionBlockBase>) => void;
  pageId?: number;
  variantId?: number;
  source?: string;
  onCtaClick?: (url: string) => void;
  className?: string;
  /** Render ONLY the primary button (used by the per-card big-features CTA). */
  primaryOnly?: boolean;
}) {
  const hasPrimary = !!(props.ctaText && props.ctaText.trim());
  const hasSecondary = !primaryOnly && !!(props.ctaSecondaryText && props.ctaSecondaryText.trim());
  if (!hasPrimary && !hasSecondary) return null;

  const field = (key: "ctaText" | "ctaSecondaryText") =>
    isBuilder && onUpdate ? (v: string) => onUpdate({ [key]: v }) : undefined;

  const cta = pickCtaButtonColors(brand, theme.surface.base);
  const outline = pickOutlineButtonColors(brand, theme.surface.base);
  const linkColor = pickContrastingColor(
    isValidHex(brand.accentColor) ? brand.accentColor : DEFAULT_BRAND.accentColor,
    theme.surface.base,
    [theme.ink],
    4.5,
  );

  const modal = {
    modalChilipiperUrl: props.modalChilipiperUrl,
    modalFormSource: props.modalFormSource,
    modalFormId: props.modalFormId,
    modalMarketoBaseUrl: props.modalMarketoBaseUrl,
    modalMarketoMunchkinId: props.modalMarketoMunchkinId,
    modalMarketoFormId: props.modalMarketoFormId,
    modalChiliPiperHandoffUrl: props.modalChiliPiperHandoffUrl,
    modalChiliPiperHandoffMode: props.modalChiliPiperHandoffMode,
    modalChiliPiperHandoffFieldMap: props.modalChiliPiperHandoffFieldMap,
    modalHeadline: props.modalHeadline,
    modalSubheadline: props.modalSubheadline,
    modalSubmitText: props.modalSubmitText,
    modalSuccessMessage: props.modalSuccessMessage,
    modalDisclaimer: props.modalDisclaimer,
    modalShowFirstName: props.modalShowFirstName,
    modalShowLastName: props.modalShowLastName,
    modalShowPhone: props.modalShowPhone,
    modalShowCompany: props.modalShowCompany,
  };

  const renderBtn = (
    variant: SectionCtaVariant,
    label: string,
    onChange: ((v: string) => void) | undefined,
    action: "url" | "chilipiper" | "modal-form" | "modal-chilipiper",
    url?: string,
    chili?: string,
  ) => {
    let btnClass: string;
    let btnStyle: React.CSSProperties;
    if (variant === "link") {
      btnClass = "inline-flex items-center text-base font-semibold transition-opacity hover:opacity-80";
      btnStyle = { color: linkColor, fontFamily: BRAND_BODY_FONT };
    } else if (variant === "secondary") {
      btnClass = getButtonClasses(
        brand,
        "inline-flex items-center border-2 bg-transparent transition-all duration-200 ease-out motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        { imported: false },
      );
      btnStyle = { backgroundColor: "transparent", borderColor: outline.border, color: outline.text, outlineColor: outline.border };
    } else {
      btnClass = getButtonClasses(
        brand,
        "inline-flex items-center transition-all duration-200 ease-out hover:brightness-105 motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
      );
      btnStyle = { backgroundColor: cta.bg, color: cta.text, outlineColor: cta.bg };
    }
    return (
      <CtaButton
        ctaAction={action}
        ctaUrl={url}
        chilipiperUrl={chili}
        {...modal}
        onClick={
          onCtaClick
            ? () =>
                onCtaClick(
                  action === "chilipiper" && chili ? `chilipiper:${chili}` : url ?? "#",
                )
            : undefined
        }
        className={btnClass}
        style={btnStyle}
        brand={brand}
        pageId={pageId}
        variantId={variantId}
        source={source}
      >
        <InlineText value={label} onUpdate={onChange} style={{ fontFamily: BRAND_BODY_FONT }} />
        <ArrowRight className="ml-2 h-4 w-4" />
      </CtaButton>
    );
  };

  return (
    <div className={cn("mt-10 flex flex-wrap items-center gap-4", alignJustifyClass(align), className)}>
      {hasPrimary &&
        renderBtn(
          props.ctaVariant ?? "primary",
          props.ctaText ?? "",
          field("ctaText"),
          normalizeAction(props.ctaAction),
          props.ctaUrl,
          props.chilipiperUrl,
        )}
      {hasSecondary &&
        renderBtn(
          props.ctaSecondaryVariant ?? "secondary",
          props.ctaSecondaryText ?? "",
          field("ctaSecondaryText"),
          normalizeAction(props.ctaSecondaryAction),
          props.ctaSecondaryUrl,
          props.secondaryChilipiperUrl,
        )}
    </div>
  );
}
