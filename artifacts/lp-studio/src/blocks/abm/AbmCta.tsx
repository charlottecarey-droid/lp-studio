import type { BrandConfig } from "@/lib/brand-config";
import type { CtaModalConfig } from "@/lib/block-types/common";
import type { HeroCtaActionMode } from "@/lib/block-types/generic-blocks";
import { isValidHex, pickContrastingColor, contrastTextColor } from "@/lib/brand-config";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { CtaButton } from "@/components/CtaButton";
import { InlineText } from "@/components/InlineText";
import { ABM_BUTTON_CLASS, type AbmPalette } from "@/lib/abm-theme";
import { cn } from "@/lib/utils";

/**
 * The CTA field set every abm-* block with buttons carries: the shared
 * CtaButton suite (label + action + per-action destination + modal config) for
 * the PRIMARY, the canonical secondary keys, and per-block button colour
 * overrides. `ctaText` / `ctaUrl` are the Page-CTA aliases on purpose — the
 * page-level CTA follows these buttons.
 */
export interface AbmCtaProps extends CtaModalConfig {
  ctaText?: string;
  ctaUrl?: string;
  ctaAction?: HeroCtaActionMode;
  chilipiperUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  ctaButtonColor?: string;
  ctaButtonTextColor?: string;
  ctaSecondaryText?: string;
  ctaSecondaryUrl?: string;
  ctaSecondaryAction?: HeroCtaActionMode;
  secondaryChilipiperUrl?: string;
  secondaryVideoUrl?: string;
}

export const ABM_CTA_DEFAULTS: AbmCtaProps = {
  ctaText: "",
  ctaUrl: "#",
  ctaAction: "url",
  ctaSecondaryText: "",
  ctaSecondaryUrl: "#",
  ctaSecondaryAction: "url",
};

export type AbmCtaVariant = "accent" | "ink";

interface Props {
  props: AbmCtaProps;
  brand: BrandConfig;
  palette: AbmPalette;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  /** Inline-edit hook for the two labels (editor only). */
  onLabelChange?: (key: "ctaText" | "ctaSecondaryText", value: string) => void;
  source: string;
  /** "accent" (default) fills with the brand CTA colour; "ink" fills with the section's text ink (the reference page's black button on stone). */
  variant?: AbmCtaVariant;
  align?: "start" | "center";
  className?: string;
  /** Hide the secondary button even in the editor (nav bar use). */
  primaryOnly?: boolean;
  size?: "md" | "sm";
}

/** Resolve the primary button fill + label colours for a surface, honouring per-block overrides. */
export function resolveAbmButtonColors(props: AbmCtaProps, palette: AbmPalette, variant: AbmCtaVariant = "accent"): { bg: string; text: string } {
  const override = props.ctaButtonColor && isValidHex(props.ctaButtonColor) ? props.ctaButtonColor : undefined;
  const bg = override ?? (variant === "ink" ? palette.text : palette.cta.bg);
  const textPref = props.ctaButtonTextColor && isValidHex(props.ctaButtonTextColor) ? props.ctaButtonTextColor : undefined;
  const anchor = isValidHex(bg) ? bg : palette.base;
  const text = pickContrastingColor(textPref, anchor, [variant === "ink" && !override ? palette.base : palette.cta.text, contrastTextColor(anchor)], 4.5);
  return { bg, text };
}

/** Primary (filled) + optional secondary (outline) CTA pair, wired through the shared CtaButton suite. */
export function AbmCtaButtons({ props, brand, palette, pageId, variantId, onCtaClick, onLabelChange, source, variant = "accent", align = "start", className, primaryOnly, size = "md" }: Props) {
  const isEditor = !!onLabelChange;
  const modalCfg = pickCtaModalConfig(props);
  const primary = resolveAbmButtonColors(props, palette, variant);
  const showPrimary = !!props.ctaText || isEditor;
  const showSecondary = !primaryOnly && (!!props.ctaSecondaryText || isEditor);
  if (!showPrimary && !showSecondary) return null;
  const sizeClass = size === "sm" ? "!min-h-[40px] !px-4 !py-2 !text-[14px]" : "";

  return (
    <div className={cn("flex flex-wrap items-center gap-3", align === "center" ? "justify-center" : "justify-start", className)}>
      {showPrimary && (
        <CtaButton
          ctaAction={props.ctaAction || "url"}
          ctaUrl={props.ctaUrl}
          chilipiperUrl={props.chilipiperUrl}
          videoUrl={props.videoUrl}
          videoPosterUrl={props.videoPosterUrl}
          {...modalCfg}
          onClick={(props.ctaAction || "url") === "url" ? onCtaClick : undefined}
          brand={brand}
          pageId={pageId}
          variantId={variantId}
          source={`${source}-primary`}
          modalTheme={palette.dark ? "dark" : "light"}
          className={cn(ABM_BUTTON_CLASS, sizeClass)}
          style={{ background: primary.bg, color: primary.text, boxShadow: "0 1px 2px rgba(0,0,0,0.12)" }}
        >
          <InlineText as="span" value={props.ctaText || "Request a demo"} onUpdate={onLabelChange ? (v) => onLabelChange("ctaText", v) : undefined} />
        </CtaButton>
      )}
      {showSecondary && (
        <CtaButton
          ctaAction={props.ctaSecondaryAction || "url"}
          ctaUrl={props.ctaSecondaryUrl}
          chilipiperUrl={props.secondaryChilipiperUrl}
          videoUrl={props.secondaryVideoUrl}
          {...modalCfg}
          onClick={(props.ctaSecondaryAction || "url") === "url" ? onCtaClick : undefined}
          brand={brand}
          pageId={pageId}
          variantId={variantId}
          source={`${source}-secondary`}
          modalTheme={palette.dark ? "dark" : "light"}
          className={cn(ABM_BUTTON_CLASS, sizeClass)}
          style={{ background: "transparent", color: palette.outline.text, border: `1.5px solid ${palette.outline.border}` }}
        >
          <InlineText as="span" value={props.ctaSecondaryText || "Learn more"} onUpdate={onLabelChange ? (v) => onLabelChange("ctaSecondaryText", v) : undefined} />
        </CtaButton>
      )}
    </div>
  );
}
