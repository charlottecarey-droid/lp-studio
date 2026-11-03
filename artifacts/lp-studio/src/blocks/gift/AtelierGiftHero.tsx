import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import type { GiftHeroBlockProps } from "../BlockGiftHero";
import {
  ATELIER_BODY, ATELIER_BUTTON_CLASS, ATELIER_CSS, ATELIER_LINK_CLASS, ATELIER_SERIF,
  AtelierEyebrow, GiftBoxArt, LeatherTag, SatinBand, SatinBow, resolveAtelierPalette,
} from "./atelier-theme";
import { AtelierHeadline } from "./AtelierHeadline";

/**
 * gift-hero, layout "atelier": a luxury-retail opening. Ribbon-coloured
 * announcement strip, a centred wordmark bar, then a split — a large warm
 * stage on the left (the product photo on sand with a satin ribbon, bow
 * and leather tag, or the illustrated stack of ribboned gift boxes) and a
 * serif headline with an italic last line, a solid button + underlined
 * link and a numbered row of facts on the right.
 */
export function AtelierGiftHero({ props, brand, onCtaClick, onFieldChange }: { props: GiftHeroBlockProps; brand: BrandConfig; onCtaClick?: () => void; onFieldChange?: (u: GiftHeroBlockProps) => void }) {
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();
  const pal = resolveAtelierPalette(props, brand, "sand");
  const isEditor = !!onFieldChange;
  const facts = props.facts ?? [];
  const logo = props.logoUrlLight || brand.logoUrl || "";
  const logoText = props.logoText || brand.brandName || "";
  const art = props.heroArt ?? "auto";
  const showPhoto = art === "photo" || (art === "auto" && !!props.heroImageUrl);
  const showTag = !!(props.tagTo || props.tagFrom);

  const field = (key: keyof GiftHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as GiftHeroBlockProps[typeof key] }) : undefined;
  const updateFact = onFieldChange
    ? (i: number, v: string) => onFieldChange({ ...props, facts: facts.map((f, idx) => (idx === i ? { label: v } : f)) })
    : undefined;

  const rise = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 14 }),
    animate: reduced ? undefined : { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] as const },
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
    <section className="gift-hero relative flex flex-col" data-gift-layout="atelier" style={{ background: pal.bg, color: pal.ink, fontFamily: ATELIER_BODY }}>
      <style>{ATELIER_CSS}</style>

      {(props.announcement || isEditor) && (
        <div className="w-full px-6 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.3em]" style={{ background: pal.ribbon, color: pal.ivory }}>
          <InlineText as="span" value={props.announcement ?? ""} onUpdate={field("announcement")} />
        </div>
      )}

      {/* Centred wordmark bar */}
      <div className="sticky top-0 z-30" style={{ background: `${pal.bg}eb`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${pal.line}` }}>
        <div className="mx-auto grid w-full max-w-page grid-cols-3 items-center px-6 py-4 lg:px-10">
          <a href={props.ctaUrl || "#gifts"} onClick={go(props.ctaUrl || "#gifts")} className="hidden justify-self-start text-[11px] font-medium uppercase tracking-[0.28em] sm:block" style={{ color: pal.muted }}>
            The collection
          </a>
          <a href="#" className="col-start-2 justify-self-center" aria-label={logoText || "Home"}>
            {logo ? (
              <img src={logo} alt={logoText || "Logo"} className="h-6 w-auto" />
            ) : (
              <span className="text-[15px] font-semibold uppercase tracking-[0.42em]">
                <InlineText as="span" value={logoText || "Brand"} onUpdate={field("logoText")} />
              </span>
            )}
          </a>
          {(props.navCtaText || isEditor) && (
            <a href={props.navCtaUrl || "#redeem"} onClick={go(props.navCtaUrl || "#redeem")} className={`${ATELIER_LINK_CLASS} col-start-3 justify-self-end whitespace-nowrap !text-[10px] !tracking-[0.16em] sm:!text-[12px] sm:!tracking-[0.2em]`} style={{ color: pal.ink }}>
              <InlineText as="span" value={props.navCtaText ?? ""} onUpdate={field("navCtaText")} />
            </a>
          )}
        </div>
      </div>

      <div className="relative mx-auto grid w-full max-w-page grid-cols-1 items-center gap-12 px-6 pb-16 pt-10 lg:grid-cols-12 lg:gap-14 lg:px-10 lg:pb-24 lg:pt-14">
        {/* Stage */}
        <motion.div
          initial={reduced ? false : anim({ opacity: 0, y: 20 })}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[4px] lg:col-span-7"
          style={{ aspectRatio: "6 / 5", background: `radial-gradient(110% 90% at 35% 25%, ${pal.ivory} 0%, ${pal.sand} 58%, #E3D3C2 100%)`, boxShadow: `inset 0 0 0 1px ${pal.line}` }}
        >
          {showPhoto ? (
            <>
              <InlineImage
                src={props.heroImageUrl ?? ""}
                alt={props.heroImageAlt ?? ""}
                onUpdate={field("heroImageUrl")}
                onAltUpdate={field("heroImageAlt")}
                wrapperClassName="absolute inset-0"
                className={props.heroImageFit === "cover" ? "absolute inset-0 h-full w-full object-cover" : "absolute inset-0 h-full w-full object-contain p-[10%]"}
                style={props.heroImageFit === "cover" ? undefined : { mixBlendMode: "multiply" }}
              />
              {(props.showRibbon ?? true) && (
                <>
                  <SatinBand palette={pal} className="inset-y-0 right-[16%] w-[6.5%]" />
                  <SatinBow palette={pal} className="absolute right-[7%] top-[4%] w-[25%]" />
                </>
              )}
            </>
          ) : (
            <GiftBoxArt palette={pal} className="absolute inset-x-[6%] bottom-[4%] w-[88%]" />
          )}
          {(showTag || isEditor) && (
            <LeatherTag
              palette={pal}
              className="absolute left-[7%] top-0 z-10"
              line1={<InlineText as="span" value={props.tagTo ?? ""} onUpdate={field("tagTo")} />}
              line2={<InlineText as="span" value={props.tagFrom ?? ""} onUpdate={field("tagFrom")} />}
            />
          )}
        </motion.div>

        {/* Copy */}
        <div className="flex flex-col items-start gap-7 lg:col-span-5">
          {(props.kicker || isEditor) && (
            <motion.div {...rise(0.05)}>
              <AtelierEyebrow palette={pal}><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></AtelierEyebrow>
            </motion.div>
          )}
          <motion.div {...rise(0.12)}>
            <AtelierHeadline as="h1" value={props.headline ?? ""} size="clamp(3rem, 6vw, 5.6rem)" onUpdate={field("headline")} />
          </motion.div>
          {(props.subheadline || isEditor) && (
            <motion.p {...rise(0.2)} className="max-w-[40ch] text-[16px] leading-relaxed lg:text-[17px]" style={{ color: pal.muted }}>
              <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </motion.p>
          )}
          <motion.div {...rise(0.26)} className="flex w-full flex-col items-stretch gap-5 sm:w-auto sm:flex-row sm:items-center sm:gap-8">
            {(props.ctaText || isEditor) && (
              <a href={props.ctaUrl || "#gifts"} onClick={go(props.ctaUrl || "#gifts")} className={ATELIER_BUTTON_CLASS} style={{ background: pal.button, color: pal.onButton }}>
                <InlineText as="span" value={props.ctaText ?? ""} onUpdate={field("ctaText")} />
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
            {(props.secondaryText || isEditor) && (
              <a href={props.secondaryUrl || "#redeem"} onClick={go(props.secondaryUrl || "#redeem")} className={`${ATELIER_LINK_CLASS} self-center`} style={{ color: pal.ink }}>
                <InlineText as="span" value={props.secondaryText ?? ""} onUpdate={field("secondaryText")} />
              </a>
            )}
          </motion.div>
          {facts.length > 0 && (
            <motion.ul {...rise(0.34)} className="mt-4 grid w-full gap-5 pt-7 sm:grid-cols-3" style={{ borderTop: `1px solid ${pal.line}` }}>
              {facts.map((f, i) => (
                <li key={i} className="flex flex-col gap-1.5">
                  <span className="text-[20px] italic leading-none" style={{ fontFamily: ATELIER_SERIF, color: pal.ribbon }}>No. {String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[11px] font-medium uppercase leading-snug tracking-[0.22em]" style={{ color: pal.muted }}>
                    <InlineText as="span" value={f.label} onUpdate={updateFact ? (v) => updateFact(i, v) : undefined} />
                  </span>
                </li>
              ))}
            </motion.ul>
          )}
        </div>
      </div>
    </section>
  );
}
