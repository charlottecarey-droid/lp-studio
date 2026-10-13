import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { BlendMedia, type MediaAspect, type MediaPlayMode } from "@/lib/glow-media";
import { ABM_BODY, ABM_CONTAINER, ABM_CSS, AbmKicker, displayStyle, resolveAbmPalette, type AbmStyleProps } from "@/lib/abm-theme";
import { AbmCtaButtons, ABM_CTA_DEFAULTS, type AbmCtaProps } from "./abm/AbmCta";
import { AbmNavBar, type AbmNavLink } from "./abm/AbmNavBar";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * ABM Split Hero — type "abm-split-hero"
 *
 * The account page's opener: the page's OWN site-style top bar (logo × account,
 * nav links, a utility link, the CTA), then a dark split hero — an accent-dot
 * kicker, a large display headline, a short paragraph and the CTA pair on the
 * left; a photo or an ambient clip on the right. Content-sized (no viewport
 * height). Renders its own nav — never precede it with a nav block.
 * -------------------------------------------------------------------------- */

export interface AbmSplitHeroBlockProps extends AbmCtaProps, AbmStyleProps {
  showNav?: boolean;
  navTheme?: "light" | "dark";
  navLinks?: AbmNavLink[];
  /** Plain text link in the top bar ("Log in"). Not a CTA alias. */
  navLinkText?: string;
  navLinkUrl?: string;
  hideNavCta?: boolean;
  hideBrandLogo?: boolean;
  /** The target account, shown after the brand mark as "Brand × Account". */
  companyName?: string;
  companyLogoUrl?: string;
  companyLogoAlt?: string;
  kicker?: string;
  showKickerDot?: boolean;
  headline?: string;
  subheadline?: string;
  /** Hero media. Named mediaVideoUrl because `videoUrl` is the CTA's video-modal slot. */
  mediaImageUrl?: string;
  mediaImageAlt?: string;
  mediaImageFocal?: string;
  mediaVideoUrl?: string;
  mediaPlayMode?: MediaPlayMode;
  mediaAspect?: MediaAspect;
  mediaSide?: "left" | "right";
  /** Corner radius (px) of the media frame. Default 4 (the reference page is square). */
  mediaRadius?: number;
  anchorId?: string;
}

interface Props {
  props: AbmSplitHeroBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: AbmSplitHeroBlockProps) => void;
}

export const ABM_SPLIT_HERO_DEFAULT_PROPS: AbmSplitHeroBlockProps = {
  ...ABM_CTA_DEFAULTS,
  showNav: true,
  navTheme: "light",
  navLinks: [
    { label: "Platform", href: "#platform" },
    { label: "Solutions", href: "#solutions" },
    { label: "Proof", href: "#proof" },
    { label: "Your team", href: "#team" },
  ],
  navLinkText: "Log in",
  navLinkUrl: "#",
  hideNavCta: false,
  companyName: "",
  kicker: "Operations. Finance. Field teams",
  showKickerDot: true,
  headline: "One company, one platform",
  subheadline: "Connect every team, region and workflow in a single system of record to drive predictable performance and operational excellence across the business.",
  ctaText: "Contact your account team",
  ctaUrl: "#team",
  mediaImageUrl: "",
  mediaImageAlt: "",
  mediaVideoUrl: "",
  mediaPlayMode: "inview",
  mediaAspect: "4/3",
  mediaSide: "right",
  mediaRadius: 4,
  backgroundStyle: "black",
};

export function BlockAbmSplitHero({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAbmPalette(props, brand, "#000000");
  const isEditor = !!onFieldChange;
  const links = props.navLinks ?? [];
  const mediaRight = (props.mediaSide ?? "right") === "right";

  const field = (key: keyof AbmSplitHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as AbmSplitHeroBlockProps[typeof key] }) : undefined;
  const label = onFieldChange ? (key: "ctaText" | "ctaSecondaryText", v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const rise = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 14 }),
    animate: reduced ? undefined : { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  const media = (
    <motion.div {...rise(0.18)} className={cn("w-full", mediaRight ? "lg:col-span-6" : "lg:col-span-6 lg:order-first")}>
      <BlendMedia
        videoUrl={props.mediaVideoUrl}
        imageUrl={props.mediaImageUrl}
        imageAlt={props.mediaImageAlt}
        imageFocal={props.mediaImageFocal}
        blend="none"
        edgeFade={false}
        aspect={props.mediaAspect ?? "4/3"}
        fit="cover"
        playMode={props.mediaPlayMode ?? "inview"}
        palette={{ dark: pal.dark, accent: pal.accentDeco, glow: pal.accentDeco }}
        placeholder="board"
        className="w-full"
        style={{ borderRadius: props.mediaRadius ?? 4, boxShadow: pal.dark ? "0 30px 60px -30px rgba(0,0,0,0.8)" : "0 30px 60px -36px rgba(0,0,0,0.35)" }}
        title={props.mediaImageAlt || "Hero media"}
        onImageUpdate={onFieldChange ? (v) => onFieldChange({ ...props, mediaImageUrl: v }) : undefined}
        onAltUpdate={onFieldChange ? (v) => onFieldChange({ ...props, mediaImageAlt: v }) : undefined}
        onFocalUpdate={onFieldChange ? (v) => onFieldChange({ ...props, mediaImageFocal: v }) : undefined}
      />
    </motion.div>
  );

  return (
    <section id={props.anchorId || undefined} className="abm-hero relative" style={{ background: pal.bg, color: pal.text, fontFamily: ABM_BODY }}>
      <style>{ABM_CSS}</style>
      {props.showNav !== false && (
        <AbmNavBar
          brand={brand}
          theme={props.navTheme ?? "light"}
          links={links}
          companyName={props.companyName}
          companyLogoUrl={props.companyLogoUrl}
          companyLogoAlt={props.companyLogoAlt}
          hideBrandLogo={props.hideBrandLogo}
          utilityText={props.navLinkText}
          utilityUrl={props.navLinkUrl}
          cta={props}
          hideCta={props.hideNavCta}
          palette={pal}
          pageId={pageId}
          variantId={variantId}
          onCtaClick={onCtaClick}
          onUtilityChange={field("navLinkText")}
          onCtaLabelChange={label}
        />
      )}

      <div className={cn(ABM_CONTAINER, "grid grid-cols-1 items-center gap-10 py-14 lg:grid-cols-12 lg:gap-14 lg:py-20")}>
        <div className="flex flex-col items-start lg:col-span-6">
          {(props.kicker || isEditor) && (
            <motion.div {...rise(0)} className="mb-7">
              <AbmKicker palette={pal} dot={props.showKickerDot !== false}>
                <InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} />
              </AbmKicker>
            </motion.div>
          )}
          <motion.h1 {...rise(0.06)} className="max-w-[16ch] whitespace-pre-line" style={displayStyle("clamp(2.4rem, 4.6vw, 3.6rem)", pal.heading, 700)}>
            <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
          </motion.h1>
          {(props.subheadline || isEditor) && (
            <motion.p {...rise(0.12)} className="mt-6 max-w-[52ch] text-[17px] leading-relaxed" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </motion.p>
          )}
          <motion.div {...rise(0.18)} className="mt-9 w-full">
            <AbmCtaButtons props={props} brand={brand} palette={pal} pageId={pageId} variantId={variantId} onCtaClick={onCtaClick} onLabelChange={label} source="abm-hero" />
          </motion.div>
        </div>
        {media}
      </div>
    </section>
  );
}
