import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Headset, Package } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial, useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { INVITE_BODY, INVITE_CSS, INVITE_PILL_CLASS, Kicker, displayStyle, pillStyle, resolveInvitePalette } from "@/lib/invite-theme";
import { KIT_TILE_DEFAULT, KitProductTile, type KitTileFit } from "./kit/KitProductTile";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Kit Hero — type "kit-hero"
 *
 * The landing a physical kit's QR code opens on a phone: a brand-dark
 * surface, the kit's own kicker ("— LAB TOUR IN A BOX —"), a large light
 * display headline, the card's paragraph, a pill CTA that jumps to the setup
 * steps plus a ghost "what's in the box", three micro-facts, and a product
 * stage: a big light tile with the device (studio shot multiplied onto the
 * tile so its white backdrop vanishes) and a smaller, slightly rotated tile
 * with the box, both floating gently. Renders its OWN top bar (logo + a
 * "Need help?" pill) — never precede it with a nav block.
 * -------------------------------------------------------------------------- */

export interface KitFact {
  label: string;
}

export interface KitHeroBlockProps {
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
  facts?: KitFact[];
  /** The device (studio shot, white backdrop works best). */
  heroImageUrl?: string;
  heroImageAlt?: string;
  heroImageFit?: KitTileFit;
  /** The box / packaging, shown on the smaller offset tile. */
  secondaryImageUrl?: string;
  secondaryImageAlt?: string;
  secondaryImageFit?: KitTileFit;
  /** Light tile surface. Default off-white. */
  tileColor?: string;
  /** Viewport height of the hero in vh. Default 88. */
  minHeightVh?: number;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: KitHeroBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: KitHeroBlockProps) => void;
}

export const KIT_HERO_DEFAULT_PROPS: KitHeroBlockProps = {
  logoText: "",
  logoUrl: "",
  navCtaText: "Need help?",
  navCtaUrl: "#help",
  kicker: "Your kit has arrived",
  headline: "Everything you need\nis in the box.",
  subheadline: "Put on the headset, follow five short steps, and you're inside the experience in about ten minutes. Then pass it around the team.",
  ctaText: "Set up the headset",
  ctaUrl: "#steps",
  secondaryText: "What's in the box",
  secondaryUrl: "#inside",
  facts: [{ label: "About 10 minutes" }, { label: "Wi-Fi required" }, { label: "Share it with your team" }],
  heroImageUrl: "",
  heroImageAlt: "",
  heroImageFit: "contain",
  secondaryImageUrl: "",
  secondaryImageAlt: "",
  secondaryImageFit: "cover",
  tileColor: KIT_TILE_DEFAULT,
  minHeightVh: 88,
};

export function BlockKitHero({ props, brand, onCtaClick, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const anim = useAnimInitial();
  const pal = resolveInvitePalette(props, brand);
  const isEditor = !!onFieldChange;
  const facts = props.facts ?? [];
  const logo = props.logoUrl || brand.logoUrlDark || brand.logoUrl || "";
  const logoText = props.logoText || brand.brandName || "";
  const tile = props.tileColor && /^#[0-9a-f]{6}$/i.test(props.tileColor) ? props.tileColor : KIT_TILE_DEFAULT;
  const float = !reduced && !staticRender;

  const field = (key: keyof KitHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as KitHeroBlockProps[typeof key] }) : undefined;
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
      className="kit-hero relative overflow-hidden flex flex-col"
      style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY, minHeight: `${props.minHeightVh ?? 88}vh` }}
    >
      <style>{INVITE_CSS}</style>

      {/* Ambient glow — a warm accent halo behind the stage, nothing that depends on an asset. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: `radial-gradient(70% 55% at 78% 62%, color-mix(in srgb, ${pal.accent} 16%, transparent) 0%, transparent 70%)` }} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 70%, ${pal.bg} 100%)` }} />
      </div>

      {/* Sticky top bar */}
      <div className="sticky top-0 z-30" style={{ background: `linear-gradient(180deg, ${pal.bg}e6, ${pal.bg}00)`, backdropFilter: "blur(6px)" }}>
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-6 py-4 lg:px-10">
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
            <a href={props.navCtaUrl || "#help"} onClick={go(props.navCtaUrl || "#help")} className={cn(INVITE_PILL_CLASS, "!min-h-[38px] !px-4 !py-2 !text-[13px]")} style={pillStyle(pal, "ghost")}>
              <InlineText as="span" value={props.navCtaText ?? ""} onUpdate={field("navCtaText")} />
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto grid w-full max-w-[1240px] flex-1 grid-cols-1 items-center gap-12 px-6 pb-16 pt-6 lg:grid-cols-12 lg:gap-10 lg:px-10 lg:pb-24 lg:pt-10">
        <div className="flex flex-col items-center text-center lg:col-span-6 lg:items-start lg:text-left">
          {(props.kicker || isEditor) && (
            <motion.div {...rise(0)} className="mb-6 self-center lg:self-start">
              <Kicker palette={pal}>
                <InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} />
              </Kicker>
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
            <a href={props.ctaUrl || "#steps"} onClick={go(props.ctaUrl || "#steps")} className={INVITE_PILL_CLASS} style={pillStyle(pal)}>
              <InlineText as="span" value={props.ctaText || "Set up the headset"} onUpdate={field("ctaText")} />
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            {(props.secondaryText || isEditor) && (
              <a href={props.secondaryUrl || "#inside"} onClick={go(props.secondaryUrl || "#inside")} className={INVITE_PILL_CLASS} style={pillStyle(pal, "ghost")}>
                <InlineText as="span" value={props.secondaryText ?? ""} onUpdate={field("secondaryText")} />
              </a>
            )}
          </motion.div>
          {facts.length > 0 && (
            <motion.ul {...rise(0.3)} className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.22em] lg:justify-start" style={{ color: pal.faint }}>
              {facts.map((f, i) => (
                <li key={i} className="flex items-center gap-5">
                  {i > 0 && <span aria-hidden="true" className="block h-1 w-1 rounded-full" style={{ background: pal.accent }} />}
                  <InlineText as="span" value={f.label} onUpdate={updateFact ? (v) => updateFact(i, v) : undefined} />
                </li>
              ))}
            </motion.ul>
          )}
        </div>

        {/* Product stage */}
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
              fallback={<Headset className="h-1/2 w-1/2" strokeWidth={1.25} />}
              className="h-full w-full rounded-[28px]"
              style={{ boxShadow: `0 50px 100px -40px rgba(0,0,0,0.75), 0 0 0 1px ${pal.hairline}` }}
              onUpdate={field("heroImageUrl")}
              onAltUpdate={field("heroImageAlt")}
            />
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
              style={{ boxShadow: `0 40px 80px -30px rgba(0,0,0,0.8), 0 0 0 1px ${pal.hairline}` }}
              onUpdate={field("secondaryImageUrl")}
              onAltUpdate={field("secondaryImageAlt")}
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
