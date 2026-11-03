import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Gift, Package } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial, useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { INVITE_BODY, INVITE_PILL_CLASS, displayStyle, pillStyle } from "@/lib/invite-theme";
import { KitProductTile, type KitTileFit } from "./kit/KitProductTile";
import { GIFT_CSS, GIFT_TILE, GiftKicker, GiftTag, RibbonOverlay, Snowfall, SparkleField, resolveGiftPalette } from "./gift/gift-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Gift Hero — type "gift-hero"
 *
 * The opening of a holiday "pick your gift" page: own sticky top bar (logo +
 * a jump pill), a sparkle kicker, a big light-weight headline, the CTA pair
 * and a row of facts; on the right a floating stage — the hero product shot
 * on a light tile with a hanging cream gift tag ("To you · From the team"),
 * and a smaller tile wrapped in a gold ribbon with a bow. Slow snowfall over
 * the whole thing (optional). Dark surface from the brand primary.
 * -------------------------------------------------------------------------- */

export interface GiftFact {
  label: string;
}

export interface GiftHeroBlockProps {
  logoText?: string;
  logoUrl?: string;
  navCtaText?: string;
  navCtaUrl?: string;
  kicker?: string;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  ctaUrl?: string;
  secondaryText?: string;
  secondaryUrl?: string;
  facts?: GiftFact[];
  /** Hero product shot (studio backdrop multiplies away on the light tile). */
  heroImageUrl?: string;
  heroImageAlt?: string;
  heroImageFit?: KitTileFit;
  /** The smaller "wrapped" tile. */
  secondaryImageUrl?: string;
  secondaryImageAlt?: string;
  secondaryImageFit?: KitTileFit;
  /** Gold ribbon + bow over the smaller tile. */
  showRibbon?: boolean;
  /** Gift tag hanging off the hero tile; blank both lines to hide it. */
  tagTo?: string;
  tagFrom?: string;
  /** Snowflakes drifting over the section (0 = none). */
  snow?: number;
  tileColor?: string;
  minHeightVh?: number;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: GiftHeroBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: GiftHeroBlockProps) => void;
}

export const GIFT_HERO_DEFAULT_PROPS: GiftHeroBlockProps = {
  logoText: "",
  logoUrl: "",
  navCtaText: "Claim my gift",
  navCtaUrl: "#redeem",
  kicker: "Happy holidays",
  headline: "Pick the gift\nyou'd actually use.",
  subheadline: "A small thank-you from the team. Choose one of three, tell us where to send it, and we'll take care of the rest.",
  ctaText: "See the gifts",
  ctaUrl: "#gifts",
  secondaryText: "Skip to the form",
  secondaryUrl: "#redeem",
  facts: [{ label: "Three to choose from" }, { label: "Ships before the holidays" }, { label: "No strings attached" }],
  heroImageUrl: "",
  heroImageAlt: "",
  heroImageFit: "contain",
  secondaryImageUrl: "",
  secondaryImageAlt: "",
  secondaryImageFit: "cover",
  showRibbon: true,
  tagTo: "To you",
  tagFrom: "From all of us",
  snow: 26,
  tileColor: GIFT_TILE,
  minHeightVh: 88,
};

export function BlockGiftHero({ props, brand, onCtaClick, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const anim = useAnimInitial();
  const pal = resolveGiftPalette(props, brand);
  const isEditor = !!onFieldChange;
  const facts = props.facts ?? [];
  const logo = props.logoUrl || brand.logoUrlDark || brand.logoUrl || "";
  const logoText = props.logoText || brand.brandName || "";
  const tile = props.tileColor && /^#[0-9a-f]{6}$/i.test(props.tileColor) ? props.tileColor : GIFT_TILE;
  const float = !reduced && !staticRender;
  const showTag = !!(props.tagTo || props.tagFrom) || isEditor;
  const snow = Math.max(0, Math.min(60, props.snow ?? 26));

  const field = (key: keyof GiftHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as GiftHeroBlockProps[typeof key] }) : undefined;
  const updateFact = onFieldChange
    ? (i: number, v: string) => onFieldChange({ ...props, facts: facts.map((f, idx) => (idx === i ? { label: v } : f)) })
    : undefined;

  const rise = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 16 }),
    animate: reduced ? undefined : { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  const go = (url?: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    onCtaClick?.();
    if (url && url.startsWith("#")) {
      const el = document.getElementById(url.slice(1));
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      }
    }
  };

  return (
    <section
      className="gift-hero relative overflow-hidden flex flex-col"
      style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY, minHeight: `min(${props.minHeightVh ?? 88}vh, 860px)` }}
    >
      <style>{GIFT_CSS}</style>

      {/* Ambient: a warm gold halo behind the stage + a cool accent wash, then snow. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: `radial-gradient(60% 50% at 76% 58%, ${pal.goldSoft} 0%, transparent 70%)` }} />
        <div className="absolute inset-0" style={{ background: `radial-gradient(50% 40% at 18% 20%, color-mix(in srgb, ${pal.accent} 10%, transparent) 0%, transparent 70%)` }} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 72%, ${pal.bg} 100%)` }} />
      </div>
      {!staticRender && <Snowfall count={snow} />}
      {!reduced && !staticRender && <SparkleField palette={pal} count={6} />}

      {/* Sticky top bar */}
      <div className="sticky top-0 z-30" style={{ background: `linear-gradient(180deg, ${pal.bg}e6, ${pal.bg}00)`, backdropFilter: "blur(6px)" }}>
        <div className="flex w-full items-center justify-between px-6 py-4 md:px-8">
          <a href="#" className="flex items-center" aria-label={logoText || "Home"}>
            {logo ? (
              <img src={logo} alt={logoText || "Logo"} className="h-6 w-auto" />
            ) : (
              <span className="text-lg font-semibold tracking-tight">
                <InlineText as="span" value={logoText || "Brand"} onUpdate={field("logoText")} />
              </span>
            )}
          </a>
          {(props.navCtaText || isEditor) && (
            <a href={props.navCtaUrl || "#redeem"} onClick={go(props.navCtaUrl || "#redeem")} className={cn(INVITE_PILL_CLASS, "!min-h-[38px] !px-4 !py-2 !text-[13px]")} style={pillStyle(pal, "ghost")}>
              <Gift className="h-3.5 w-3.5" aria-hidden style={{ color: pal.gold }} />
              <InlineText as="span" value={props.navCtaText ?? ""} onUpdate={field("navCtaText")} />
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto grid w-full max-w-page flex-1 grid-cols-1 items-center gap-14 px-6 pb-16 pt-6 lg:grid-cols-12 lg:gap-10 lg:px-10 lg:pb-24 lg:pt-10">
        <div className="flex flex-col items-center text-center lg:col-span-6 lg:items-start lg:text-left">
          {(props.kicker || isEditor) && (
            <motion.div {...rise(0)} className="mb-6 self-center lg:self-start">
              <GiftKicker palette={pal}>
                <InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} />
              </GiftKicker>
            </motion.div>
          )}
          <motion.h1 {...rise(0.08)} className="max-w-[13ch] whitespace-pre-line" style={displayStyle("clamp(2.6rem, 6.4vw, 5.4rem)")}>
            <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
          </motion.h1>
          {(props.subheadline || isEditor) && (
            <motion.p {...rise(0.16)} className="mt-6 max-w-[46ch] text-[15px] leading-relaxed lg:text-[17px]" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </motion.p>
          )}
          <motion.div {...rise(0.22)} className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            {(props.ctaText || isEditor) && (
              <a href={props.ctaUrl || "#gifts"} onClick={go(props.ctaUrl || "#gifts")} className={INVITE_PILL_CLASS} style={pillStyle(pal)}>
                <InlineText as="span" value={props.ctaText ?? ""} onUpdate={field("ctaText")} />
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            )}
            {(props.secondaryText || isEditor) && (
              <a href={props.secondaryUrl || "#redeem"} onClick={go(props.secondaryUrl || "#redeem")} className={INVITE_PILL_CLASS} style={pillStyle(pal, "ghost")}>
                <InlineText as="span" value={props.secondaryText ?? ""} onUpdate={field("secondaryText")} />
              </a>
            )}
          </motion.div>
          {facts.length > 0 && (
            <motion.ul {...rise(0.3)} className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.22em] lg:justify-start" style={{ color: pal.faint }}>
              {facts.map((f, i) => (
                <li key={i} className="flex items-center gap-5">
                  {i > 0 && <span aria-hidden="true" className="block h-1 w-1 rounded-full" style={{ background: pal.gold }} />}
                  <InlineText as="span" value={f.label} onUpdate={updateFact ? (v) => updateFact(i, v) : undefined} />
                </li>
              ))}
            </motion.ul>
          )}
        </div>

        {/* Gift stage */}
        <motion.div
          initial={reduced ? false : anim({ opacity: 0, y: 28, scale: 0.98 })}
          animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto w-full max-w-[560px] lg:col-span-6 lg:max-w-none"
          style={{ aspectRatio: "5 / 4" }}
        >
          <motion.div
            className="absolute right-0 top-0 h-[84%] w-[84%]"
            animate={float ? { y: [0, -10, 0] } : undefined}
            transition={float ? { duration: 7, repeat: Infinity, ease: "easeInOut" } : undefined}
          >
            <KitProductTile
              src={props.heroImageUrl}
              alt={props.heroImageAlt}
              fit={props.heroImageFit ?? "contain"}
              tileColor={tile}
              palette={pal}
              fallback={<Gift className="h-1/2 w-1/2" strokeWidth={1.25} />}
              className="h-full w-full rounded-[28px]"
              style={{ boxShadow: `0 50px 100px -40px rgba(0,0,0,0.75), 0 0 0 1px ${pal.goldSoft}` }}
              onUpdate={field("heroImageUrl")}
              onAltUpdate={field("heroImageAlt")}
            />
            {showTag && (
              <GiftTag
                palette={pal}
                className="-left-3 top-[6%] z-10 lg:-left-6"
                to={<InlineText as="span" value={props.tagTo ?? ""} onUpdate={field("tagTo")} />}
                from={<InlineText as="span" value={props.tagFrom ?? ""} onUpdate={field("tagFrom")} />}
              />
            )}
          </motion.div>
          <motion.div
            className="absolute bottom-0 left-0 w-[46%]"
            style={{ aspectRatio: "5 / 4", rotate: "-4deg" }}
            animate={float ? { y: [0, 8, 0] } : undefined}
            transition={float ? { duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.6 } : undefined}
          >
            <KitProductTile
              src={props.secondaryImageUrl}
              alt={props.secondaryImageAlt}
              fit={props.secondaryImageFit ?? "cover"}
              tileColor={tile}
              palette={pal}
              fallback={<Package className="h-1/2 w-1/2" strokeWidth={1.25} />}
              className="h-full w-full rounded-[22px]"
              style={{ boxShadow: `0 40px 80px -30px rgba(0,0,0,0.8), 0 0 0 1px ${pal.goldSoft}` }}
              onUpdate={field("secondaryImageUrl")}
              onAltUpdate={field("secondaryImageAlt")}
            />
            {(props.showRibbon ?? true) && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]">
                <RibbonOverlay palette={pal} />
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
