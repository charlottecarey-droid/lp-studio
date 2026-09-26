import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial, useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { isEmbedVideoUrl } from "@/lib/glow-media";
import { INVITE_BODY, INVITE_CSS, INVITE_PILL_CLASS, Kicker, displayStyle, pillStyle, resolveInvitePalette } from "@/lib/invite-theme";
import { InviteLeadForm, type InviteFormConfig } from "./invite/InviteLeadForm";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Invite Demo Hero — type "invite-demo-hero"
 *
 * Full-viewport invitation hero on the brand-dark surface: an ambient
 * background clip or photo under a deep tint, a sticky top bar (logo + CTA),
 * a centered "— YOU'RE INVITED —" kicker, a very large light-weight display
 * headline, a two-line subheadline, a pill CTA that jumps to the reservation
 * form (or, with `heroForm: "inline"`, a compact form right here), a row of
 * three micro-facts ("30 minutes · Enterprise team · Your numbers") and a
 * scroll cue. Renders its OWN nav.
 * -------------------------------------------------------------------------- */

export interface InviteFact {
  label: string;
}

export interface InviteDemoHeroBlockProps extends InviteFormConfig {
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
  facts?: InviteFact[];
  /** "cta" (default) = single pill to the form; "inline" = compact form in the hero. */
  heroForm?: "cta" | "inline";
  backgroundVideoUrl?: string;
  backgroundImageUrl?: string;
  backgroundImageAlt?: string;
  /** 0–100 darkness of the tint over the background asset. Default 62. */
  overlayOpacity?: number;
  /** Viewport height of the hero in vh. Default 92. */
  minHeightVh?: number;
  showScrollCue?: boolean;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
}

interface Props {
  props: InviteDemoHeroBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: InviteDemoHeroBlockProps) => void;
}

export const INVITE_DEMO_HERO_DEFAULT_PROPS: InviteDemoHeroBlockProps = {
  logoText: "",
  logoUrl: "",
  navCtaText: "Reserve a session",
  navCtaUrl: "#reserve",
  kicker: "You're invited",
  headline: "Bring us your numbers.\nLeave with a plan.",
  subheadline: "A private thirty-minute working session with our specialists, run on your own data — not a demo deck.",
  ctaText: "Reserve my session",
  ctaUrl: "#reserve",
  secondaryText: "See the agenda",
  secondaryUrl: "#agenda",
  facts: [{ label: "30 minutes" }, { label: "Senior team only" }, { label: "Your numbers, not ours" }],
  heroForm: "cta",
  backgroundVideoUrl: "",
  backgroundImageUrl: "",
  overlayOpacity: 62,
  minHeightVh: 92,
  showScrollCue: true,
  fields: ["name", "email", "phone", "locations"],
  riskLine: "30 minutes. No commitment.",
};

export function BlockInviteDemoHero({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const anim = useAnimInitial();
  const pal = resolveInvitePalette(props, brand);
  const isEditor = !!onFieldChange;
  const facts = props.facts ?? [];
  const logo = props.logoUrl || brand.logoUrlDark || brand.logoUrl || "";
  const logoText = props.logoText || brand.brandName || "";
  const tint = Math.max(0, Math.min(100, props.overlayOpacity ?? 62)) / 100;
  const nativeVideo = !!props.backgroundVideoUrl && !isEmbedVideoUrl(props.backgroundVideoUrl);

  const field = (key: keyof InviteDemoHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as InviteDemoHeroBlockProps[typeof key] }) : undefined;
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
      className="inv-hero relative overflow-hidden flex flex-col"
      style={{ background: pal.bg, color: pal.text, fontFamily: INVITE_BODY, minHeight: `${props.minHeightVh ?? 92}vh` }}
    >
      <style>{INVITE_CSS}</style>

      {/* Background asset + tint. Visibility never depends on the asset. */}
      <div className="absolute inset-0" aria-hidden="true">
        {nativeVideo ? (
          <video src={props.backgroundVideoUrl} className="absolute inset-0 h-full w-full object-cover" autoPlay={!staticRender} muted loop playsInline preload="metadata" poster={props.backgroundImageUrl || undefined} />
        ) : props.backgroundImageUrl || isEditor ? (
          <InlineImage src={props.backgroundImageUrl || ""} alt={props.backgroundImageAlt ?? ""} wrapperClassName="absolute inset-0" className="absolute inset-0 h-full w-full object-cover" onUpdate={field("backgroundImageUrl")} onAltUpdate={field("backgroundImageAlt")} />
        ) : null}
        {(props.backgroundVideoUrl || props.backgroundImageUrl) && (
          <div className="absolute inset-0" style={{ background: pal.bg, opacity: tint }} />
        )}
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${pal.bg}cc 0%, transparent 30%, transparent 60%, ${pal.bg} 100%)` }} />
        {!props.backgroundVideoUrl && !props.backgroundImageUrl && (
          <div className="absolute inset-0" style={{ background: `radial-gradient(60% 50% at 50% 35%, color-mix(in srgb, ${pal.accent} 10%, transparent) 0%, transparent 70%)` }} />
        )}
      </div>

      {/* Sticky top bar */}
      <div className="sticky top-0 z-30" style={{ background: `linear-gradient(180deg, ${pal.bg}e6, ${pal.bg}00)`, backdropFilter: "blur(6px)" }}>
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-6 py-4 lg:px-10">
          <a href="#" className="flex items-center" aria-label={logoText || "Home"}>
            {logo ? (
              <img src={logo} alt={logoText || "Logo"} className="h-6 w-auto" />
            ) : (
              <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: INVITE_BODY }}>
                <InlineText as="span" value={logoText || "Brand"} onUpdate={field("logoText")} />
              </span>
            )}
          </a>
          {(props.navCtaText || isEditor) && (
            <a href={props.navCtaUrl || "#reserve"} onClick={go(props.navCtaUrl || "#reserve")} className={cn(INVITE_PILL_CLASS, "!min-h-[38px] !px-4 !py-2 !text-[13px]")} style={pillStyle(pal)}>
              <InlineText as="span" value={props.navCtaText ?? ""} onUpdate={field("navCtaText")} />
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-10 text-center lg:px-10">
        {(props.kicker || isEditor) && (
          <motion.div {...rise(0)} className="mb-7">
            <Kicker palette={pal}><InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} /></Kicker>
          </motion.div>
        )}
        <motion.h1 {...rise(0.08)} className="max-w-[14ch] whitespace-pre-line" style={displayStyle("clamp(2.9rem, 7.2vw, 6.4rem)")}>
          <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
        </motion.h1>
        {(props.subheadline || isEditor) && (
          <motion.p {...rise(0.16)} className="mt-7 max-w-[46ch] text-base leading-relaxed lg:text-lg" style={{ color: pal.muted }}>
            <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
          </motion.p>
        )}

        {props.heroForm === "inline" ? (
          <motion.div {...rise(0.22)} className="mt-9 w-full max-w-md rounded-2xl p-6 text-left" style={{ background: `${pal.panel}f2`, border: `1px solid ${pal.hairline}`, backdropFilter: "blur(10px)" }}>
            <InviteLeadForm
              config={props}
              palette={pal}
              brand={brand}
              pageId={pageId}
              variantId={variantId}
              source="invite-demo-hero"
              compact
              onConfigChange={onFieldChange ? (patch) => onFieldChange({ ...props, ...patch }) : undefined}
            />
          </motion.div>
        ) : (
          <motion.div {...rise(0.22)} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href={props.ctaUrl || "#reserve"} onClick={go(props.ctaUrl || "#reserve")} className={INVITE_PILL_CLASS} style={pillStyle(pal)}>
              <InlineText as="span" value={props.ctaText || "Reserve my session"} onUpdate={field("ctaText")} />
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            {(props.secondaryText || isEditor) && (
              <a href={props.secondaryUrl || "#agenda"} onClick={go(props.secondaryUrl || "#agenda")} className={INVITE_PILL_CLASS} style={pillStyle(pal, "ghost")}>
                <InlineText as="span" value={props.secondaryText ?? ""} onUpdate={field("secondaryText")} />
              </a>
            )}
          </motion.div>
        )}

        {facts.length > 0 && (
          <motion.ul {...rise(0.3)} className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: pal.faint }}>
            {facts.map((f, i) => (
              <li key={i} className="flex items-center gap-6">
                {i > 0 && <span aria-hidden="true" className="block h-1 w-1 rounded-full" style={{ background: pal.accent }} />}
                <InlineText as="span" value={f.label} onUpdate={updateFact ? (v) => updateFact(i, v) : undefined} />
              </li>
            ))}
          </motion.ul>
        )}
      </div>

      {props.showScrollCue !== false && (
        <div className="absolute bottom-6 right-8 z-10 hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] md:flex" style={{ color: pal.faint }} aria-hidden="true">
          Scroll <ArrowDown className="h-3 w-3" />
        </div>
      )}
    </section>
  );
}
