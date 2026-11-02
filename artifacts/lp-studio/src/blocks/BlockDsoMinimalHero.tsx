import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useAnimInitial, useRevealFallback } from "@/lib/reveal-fallback";
import type { DsoMinimalHeroBlockProps } from "@/lib/block-types";
import { getBgStyle, resolveSectionSurface } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { CtaButton } from "@/components/CtaButton";
import { BrandLogo } from "@/components/BrandLogo";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "../lib/brand-fonts";

/**
 * DSO — Minimal hero (Nov 2026).
 *
 * The Apple / Ramp opening: a light page, a slim full-width nav (logo at one
 * edge, one pill at the other), a centred two-tone headline set very large,
 * one quiet line of support copy, a pill and a text link, then a single
 * large rounded media card (muted looping video or image) and, optionally,
 * a hairline row of up to four numbers. No gradients, no scrims, no cards.
 *
 * Reveal contract: copy uses useAnimInitial + useRevealFallback; the media
 * card and numbers are plain markup under static render.
 */

const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_STACK;
const NUMBERS = BRAND_NUMBERS_STACK;
const P = "var(--brand-primary, #0f172a)";
const AW = "var(--brand-accent, hsl(68,60%,52%))";

export const DSO_MINIMAL_HERO_DEFAULT_PROPS: DsoMinimalHeroBlockProps = {
  showNav: true,
  navGutter: 20,
  eyebrow: "For multi-location groups",
  headline: "One partner for every location.",
  headlineMuted: "Built for the enterprise.",
  subheadline: "Standardize quality, see every provider's results in one place, and grow same-store revenue without adding headcount.",
  ctaText: "Schedule a demo",
  ctaUrl: "#",
  ctaAction: "url",
  ctaSecondaryText: "See how it works",
  ctaSecondaryUrl: "#",
  ctaSecondaryAction: "url",
  mediaVideoUrl: "",
  mediaImageUrl: "",
  mediaImageAlt: "",
  mediaAspect: "16/9",
  stats: [],
  backgroundStyle: "white",
};

interface Props {
  props: DsoMinimalHeroBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: DsoMinimalHeroBlockProps) => void;
}

/** Embeds (YouTube / Vimeo / Wistia / Loom) go in an iframe; anything else —
 *  library uploads on any host, bundled /videos, plain mp4/webm — is a native
 *  <video> that can autoplay muted. */
function isNativeVideo(url: string): boolean {
  return !/(youtube\.com|youtu\.be|vimeo\.com|wistia\.(com|net)|loom\.com)/i.test(url);
}

export function BlockDsoMinimalHero({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const merged = { ...DSO_MINIMAL_HERO_DEFAULT_PROPS, ...props };
  const {
    showNav = true, eyebrow, headline, headlineMuted, subheadline, ctaText, ctaSecondaryText,
    mediaVideoUrl, mediaImageUrl, mediaImageAlt, mediaAspect = "16/9", backgroundStyle = "white",
  } = merged;
  const stats = (merged.stats ?? []).filter((s) => s.value?.trim()).slice(0, 4);
  const navGutter = Math.max(8, Math.min(96, Number(merged.navGutter ?? 20) || 20));
  const navCtaText = merged.navCtaText?.trim() || ctaText || "";
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const anim = useAnimInitial();

  const field = (key: keyof DsoMinimalHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v } as DsoMinimalHeroBlockProps) : undefined;
  const updateStat = onFieldChange
    ? (i: number, patch: Partial<{ value: string; label: string }>) =>
        onFieldChange({ ...props, stats: (merged.stats ?? []).map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;

  const dark = resolveSectionSurface({ backgroundStyle }, "#ffffff", brand).isDark;
  const ink = dark ? "#FFFFFF" : P;
  const muted = dark ? "rgba(255,255,255,0.55)" : "rgb(var(--brand-primary-rgb, 15 23 42) / 0.50)";
  const quiet = dark ? "rgba(255,255,255,0.78)" : "rgb(var(--brand-primary-rgb, 15 23 42) / 0.72)";
  const hairline = dark ? "rgba(255,255,255,0.12)" : "rgb(var(--brand-primary-rgb, 15 23 42) / 0.10)";
  const ctaBg = merged.ctaButtonColor || AW;
  const ctaFg = merged.ctaButtonTextColor || "#0B1410";

  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-40px" });
  const force = useRevealFallback(inView);
  const show = inView || force;
  const rise = (delay: number) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 16 }),
    animate: reduced ? undefined : show ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] as const },
  });
  const modalCfg = pickCtaModalConfig(merged);
  const native = !!mediaVideoUrl && isNativeVideo(mediaVideoUrl);
  const aspect = mediaAspect === "21/9" ? "21 / 9" : mediaAspect === "3/2" ? "3 / 2" : "16 / 9";

  return (
    <section
      ref={sectionRef}
      data-block="dso-minimal-hero"
      style={{ ...getBgStyle(backgroundStyle), color: ink, position: "relative", overflow: "hidden" }}
    >
      {showNav && (
        <nav
          aria-label="Page"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `1.1rem ${navGutter}px`, borderBottom: `1px solid ${hairline}` }}
        >
          <BrandLogo brand={brand} tone={dark ? "onDark" : "onLight"} alt={brand.brandName || "Logo"} style={{ height: 24, display: "block" }} />
          {navCtaText && (
            <CtaButton
              ctaAction={merged.ctaAction || "url"}
              ctaUrl={merged.ctaUrl}
              chilipiperUrl={merged.chilipiperUrl}
              videoUrl={merged.videoUrl}
              videoPosterUrl={merged.videoPosterUrl}
              {...modalCfg}
              onClick={(merged.ctaAction || "url") === "url" ? onCtaClick : undefined}
              brand={brand}
              pageId={pageId}
              variantId={variantId}
              source="dso-minimal-hero-nav"
              className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-semibold"
              style={{ background: ctaBg, color: ctaFg, padding: "0.55rem 1.1rem", fontFamily: BODY }}
            >
              <InlineText as="span" value={navCtaText} onUpdate={field("navCtaText")} style={{ fontFamily: BODY }} />
              <ArrowRight className="w-3.5 h-3.5" aria-hidden />
            </CtaButton>
          )}
        </nav>
      )}

      <div style={{ maxWidth: "var(--lp-page-max)", margin: "0 auto", padding: "clamp(4rem, 9vw, 8.5rem) 1.5rem 0", textAlign: "center" }}>
        {(eyebrow || isEditor) && (
          <motion.p {...rise(0)} style={{ fontFamily: BODY, fontSize: 13, fontWeight: 500, letterSpacing: "0.02em", color: quiet, margin: 0 }}>
            <InlineText as="span" value={eyebrow ?? ""} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }} />
          </motion.p>
        )}
        <motion.h1
          {...rise(0.05)}
          style={{
            fontFamily: DISPLAY,
            fontSize: "clamp(2.75rem, 6.4vw, 6rem)",
            lineHeight: 1.02,
            fontWeight: 500,
            letterSpacing: "-0.035em",
            margin: "1.25rem auto 0",
            maxWidth: "14ch",
            textWrap: "balance",
          } as React.CSSProperties}
        >
          <InlineText as="span" value={headline} onUpdate={field("headline")} multiline style={{ fontFamily: DISPLAY, color: ink }} />
          {(headlineMuted || isEditor) && (
            <>
              {" "}
              <InlineText as="span" value={headlineMuted ?? ""} onUpdate={field("headlineMuted")} multiline style={{ fontFamily: DISPLAY, color: muted }} />
            </>
          )}
        </motion.h1>
        {(subheadline || isEditor) && (
          <motion.p {...rise(0.12)} style={{ fontFamily: BODY, fontSize: "clamp(1.0625rem, 1.3vw, 1.25rem)", lineHeight: 1.55, color: quiet, maxWidth: "52ch", margin: "1.75rem auto 0" }}>
            <InlineText as="span" value={subheadline ?? ""} onUpdate={field("subheadline")} multiline style={{ fontFamily: BODY }} />
          </motion.p>
        )}
        {(ctaText || ctaSecondaryText || isEditor) && (
          <motion.div {...rise(0.18)} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "1.25rem", marginTop: "2.25rem" }}>
            {(ctaText || isEditor) && (
              <CtaButton
                ctaAction={merged.ctaAction || "url"}
                ctaUrl={merged.ctaUrl}
                chilipiperUrl={merged.chilipiperUrl}
                videoUrl={merged.videoUrl}
                videoPosterUrl={merged.videoPosterUrl}
                {...modalCfg}
                onClick={(merged.ctaAction || "url") === "url" ? onCtaClick : undefined}
                brand={brand}
                pageId={pageId}
                variantId={variantId}
                source="dso-minimal-hero-primary"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full text-[15px] font-semibold"
                style={{ background: ctaBg, color: ctaFg, padding: "0.85rem 1.75rem", fontFamily: BODY }}
              >
                <InlineText as="span" value={ctaText ?? ""} onUpdate={field("ctaText")} style={{ fontFamily: BODY }} />
              </CtaButton>
            )}
            {(ctaSecondaryText || isEditor) && (
              <CtaButton
                ctaAction={merged.ctaSecondaryAction || "url"}
                ctaUrl={merged.ctaSecondaryUrl}
                chilipiperUrl={merged.secondaryChilipiperUrl}
                videoUrl={merged.secondaryVideoUrl}
                {...modalCfg}
                onClick={(merged.ctaSecondaryAction || "url") === "url" ? onCtaClick : undefined}
                brand={brand}
                pageId={pageId}
                variantId={variantId}
                source="dso-minimal-hero-secondary"
                className="inline-flex items-center gap-2 text-[15px] font-medium hover:opacity-70 transition-opacity"
                style={{ background: "transparent", color: ink, fontFamily: BODY, padding: 0 }}
              >
                <InlineText as="span" value={ctaSecondaryText ?? ""} onUpdate={field("ctaSecondaryText")} style={{ fontFamily: BODY }} />
                <ArrowRight className="w-4 h-4" aria-hidden />
              </CtaButton>
            )}
          </motion.div>
        )}

        {(mediaVideoUrl || mediaImageUrl || isEditor) && (
          <motion.div
            initial={reduced ? false : anim({ opacity: 0, y: 28 })}
            animate={reduced ? undefined : show ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "relative",
              marginTop: "clamp(3rem, 6vw, 5.5rem)",
              aspectRatio: aspect,
              borderRadius: 24,
              overflow: "hidden",
              background: dark ? "rgba(255,255,255,0.04)" : "rgb(var(--brand-primary-rgb, 15 23 42) / 0.04)",
              boxShadow: dark ? "0 40px 100px -40px rgba(0,0,0,0.8)" : "0 40px 90px -42px rgb(var(--brand-primary-rgb, 15 23 42) / 0.35)",
              border: `1px solid ${hairline}`,
            }}
          >
            {native ? (
              <video
                src={mediaVideoUrl}
                poster={mediaImageUrl || undefined}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={mediaImageAlt || undefined}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : mediaVideoUrl ? (
              <iframe
                src={mediaVideoUrl}
                allow="autoplay; fullscreen"
                allowFullScreen
                title={mediaImageAlt || "Video"}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              />
            ) : mediaImageUrl ? (
              <img src={mediaImageUrl} alt={mediaImageAlt ?? ""} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: muted, fontFamily: BODY, fontSize: 13 }}>
                Add a video or image
              </div>
            )}
          </motion.div>
        )}

        {stats.length > 0 && (
          <div
            className={`grid grid-cols-2 ${stats.length >= 4 ? "md:grid-cols-4" : stats.length === 3 ? "md:grid-cols-3" : ""} gap-x-8 gap-y-8`}
            style={{ marginTop: "clamp(3rem, 5vw, 4.5rem)", paddingTop: "2rem", borderTop: `1px solid ${hairline}`, textAlign: "left" }}
          >
            {stats.map((s, i) => (
              <motion.div key={i} {...rise(0.3 + i * 0.06)}>
                <p style={{ fontFamily: NUMBERS, fontSize: "clamp(1.75rem, 2.4vw, 2.5rem)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1, color: ink, margin: 0 }}>
                  <InlineText as="span" value={s.value} onUpdate={updateStat ? (v) => updateStat(i, { value: v }) : undefined} style={{ fontFamily: NUMBERS }} />
                </p>
                <p style={{ marginTop: 10, fontFamily: BODY, fontSize: 14, lineHeight: 1.4, color: muted, margin: "10px 0 0" }}>
                  <InlineText as="span" value={s.label} onUpdate={updateStat ? (v) => updateStat(i, { label: v }) : undefined} style={{ fontFamily: BODY }} />
                </p>
              </motion.div>
            ))}
          </div>
        )}
        <div style={{ height: "clamp(3.5rem, 7vw, 6.5rem)" }} />
      </div>
    </section>
  );
}
