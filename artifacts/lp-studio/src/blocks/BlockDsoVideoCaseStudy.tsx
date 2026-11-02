import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Play } from "lucide-react";
import { useAnimInitial, useRevealFallback } from "@/lib/reveal-fallback";
import { PulseGlow } from "./SectionAmbient";
import type { DsoVideoCaseStudyBlockProps } from "@/lib/block-types";
import { getBgStyle, resolveSectionSurface } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { InlineText } from "@/components/InlineText";
import { extractWistiaId, wistiaIframeUrl } from "@/lib/wistia";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "../lib/brand-fonts";

/**
 * DSO — Video case study (Nov 2026).
 *
 * One customer story told the way an executive reads it: a large video
 * (Wistia or a hosted mp4) with a poster and a single play control, beside the
 * company, a headline, three outcome numbers, and the customer's own words
 * verbatim. Built for the enterprise DSO page's Enable Dental story; works for
 * any tenant with a filmed customer.
 *
 * Reveal contract: text and tiles use useAnimInitial + useRevealFallback; the
 * poster is plain markup, so static renders (thumbnails, builder) always show
 * the full section.
 */

const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_STACK;
const NUMBERS = BRAND_NUMBERS_STACK;
const P = "var(--brand-primary, #0f172a)";
const AW = "var(--brand-accent, hsl(68,60%,52%))";

export const DSO_VIDEO_CASE_STUDY_DEFAULT_PROPS: DsoVideoCaseStudyBlockProps = {
  eyebrow: "Customer story",
  company: "Northwind Health",
  companyMeta: "45 locations",
  headline: "A phased rollout that paid for itself in the first year",
  body: "Northwind standardized one workflow across every location, piloted it in ten, and scaled once the numbers held.",
  stats: [
    { value: "2x", label: "Faster cycle time" },
    { value: "$2.5M", label: "Hard cost savings" },
    { value: "90 days", label: "To first ROI review" },
  ],
  quote: "They gave us our schedule back.",
  quoteAuthor: "Jordan Lee",
  quoteRole: "Chief Clinical Officer",
  videoUrl: "",
  posterUrl: "",
  videoSide: "left",
  backgroundStyle: "dark",
};

interface Props {
  brand?: BrandConfig;
  props: DsoVideoCaseStudyBlockProps;
  onFieldChange?: (updated: DsoVideoCaseStudyBlockProps) => void;
}

function isNativeVideo(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) || url.startsWith("/api/storage/");
}

export function BlockDsoVideoCaseStudy({ props, brand, onFieldChange }: Props) {
  const merged = { ...DSO_VIDEO_CASE_STUDY_DEFAULT_PROPS, ...props };
  const {
    eyebrow, company, companyMeta, headline, body, quote, quoteAuthor, quoteRole,
    videoUrl, posterUrl, videoSide = "left", ctaText, ctaUrl, ctaMode = "link",
    backgroundStyle = "dark",
  } = merged;
  const stats = (merged.stats ?? []).slice(0, 4);

  const field = (key: keyof DsoVideoCaseStudyBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v } as DsoVideoCaseStudyBlockProps) : undefined;
  const updateStat = onFieldChange
    ? (i: number, patch: Partial<{ value: string; label: string }>) =>
        onFieldChange({ ...props, stats: stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;

  const dark = resolveSectionSurface({ backgroundStyle }, "#ffffff", brand).isDark;
  const fg = dark ? "#FFFFFF" : P;
  const mu = dark ? "rgba(255,255,255,0.62)" : "rgb(var(--brand-primary-rgb, 15 23 42) / 0.64)";
  const rule = dark ? "rgba(255,255,255,0.14)" : "rgb(var(--brand-primary-rgb, 15 23 42) / 0.12)";
  const frame = dark ? "rgba(255,255,255,0.10)" : "rgb(var(--brand-primary-rgb, 15 23 42) / 0.10)";
  const eyebrowFg = dark ? AW : P;

  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-60px" });
  const force = useRevealFallback(inView);
  const show = inView || force;
  const anim = useAnimInitial();

  const [playing, setPlaying] = useState(false);
  const wistiaId = videoUrl ? extractWistiaId(videoUrl) : null;
  const native = !!videoUrl && !wistiaId && isNativeVideo(videoUrl);
  const canPlay = !!wistiaId || native;

  const media = (
    <motion.div
      initial={anim({ opacity: 0, y: 24 })}
      animate={show ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "relative",
        aspectRatio: "16/9",
        borderRadius: 20,
        overflow: "hidden",
        background: "#000",
        boxShadow: dark ? "0 40px 90px -40px rgba(0,0,0,0.8)" : "0 30px 70px -36px rgba(0,0,0,0.35)",
        border: `1px solid ${frame}`,
      }}
    >
      {playing && wistiaId ? (
        <iframe
          src={wistiaIframeUrl(wistiaId, { autoPlay: true })}
          allow="autoplay; fullscreen"
          allowFullScreen
          title={`${company} story`}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      ) : playing && native ? (
        <video src={videoUrl} poster={posterUrl || undefined} controls autoPlay playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <button
          type="button"
          onClick={() => canPlay && setPlaying(true)}
          aria-label={canPlay ? `Play ${company} story` : undefined}
          disabled={!canPlay}
          style={{ all: "unset", position: "absolute", inset: 0, cursor: canPlay ? "pointer" : "default", display: "block" }}
          className="group"
        >
          {posterUrl ? (
            <img src={posterUrl} alt={`${company} story`} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 1.2s cubic-bezier(0.16,1,0.3,1)" }} className="group-hover:scale-[1.03]" loading="lazy" />
          ) : (
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 30% 20%, rgb(var(--brand-accent-rgb, 199 231 56) / 0.22), transparent 55%), linear-gradient(160deg, rgb(var(--brand-primary-rgb, 0 58 48)) 0%, #050F0D 100%)` }} />
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%)" }} />
          {canPlay && (
            <span
              style={{
                position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
                width: 84, height: 84, borderRadius: "50%", background: AW, color: "#0B1410",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 0 10px rgb(var(--brand-accent-rgb, 199 231 56) / 0.18), 0 20px 50px -20px rgba(0,0,0,0.6)",
                transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1)",
              }}
              className="group-hover:scale-105"
            >
              <Play style={{ width: 30, height: 30, marginLeft: 4 }} fill="currentColor" />
            </span>
          )}
          <span style={{ position: "absolute", left: 24, bottom: 20, fontFamily: BODY, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
            {canPlay ? `Watch ${company}'s story` : company}
          </span>
        </button>
      )}
    </motion.div>
  );

  const text = (
    <div>
      <motion.div initial={anim({ opacity: 0, y: 10 })} animate={show ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}
        style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: BODY, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: eyebrowFg }}>
        <span aria-hidden style={{ width: 28, height: 1, background: eyebrowFg, display: "inline-block" }} />
        <InlineText as="span" value={eyebrow ?? ""} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }} />
      </motion.div>
      <motion.p initial={anim({ opacity: 0, y: 10 })} animate={show ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.05 }}
        style={{ marginTop: 20, fontFamily: BODY, fontSize: 15, color: mu, display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <InlineText as="span" value={company} onUpdate={field("company")} style={{ fontFamily: BODY, fontWeight: 600, color: fg, fontSize: 17 }} />
        {(companyMeta || onFieldChange) && (
          <>
            <span aria-hidden style={{ opacity: 0.5 }}>·</span>
            <InlineText as="span" value={companyMeta ?? ""} onUpdate={field("companyMeta")} style={{ fontFamily: BODY }} />
          </>
        )}
      </motion.p>
      <motion.h2 initial={anim({ opacity: 0, y: 16 })} animate={show ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay: 0.1 }}
        style={{ marginTop: 14, fontFamily: DISPLAY, fontSize: "clamp(1.9rem, 3vw, 2.75rem)", lineHeight: 1.1, fontWeight: 500, letterSpacing: "-0.02em", color: fg }}>
        <InlineText as="span" value={headline} onUpdate={field("headline")} multiline style={{ fontFamily: DISPLAY }} />
      </motion.h2>
      {(body || onFieldChange) && (
        <motion.p initial={anim({ opacity: 0, y: 12 })} animate={show ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }}
          style={{ marginTop: 18, fontFamily: BODY, fontSize: 16, lineHeight: 1.65, color: mu, maxWidth: 520 }}>
          <InlineText as="span" value={body ?? ""} onUpdate={field("body")} multiline style={{ fontFamily: BODY }} />
        </motion.p>
      )}
      {stats.length > 0 && (
        <div className={`mt-9 grid gap-x-6 gap-y-6 ${stats.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {stats.map((s, i) => (
            <motion.div key={i} initial={anim({ opacity: 0, y: 16 })} animate={show ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.2 + i * 0.08 }}
              style={{ borderTop: `1px solid ${rule}`, paddingTop: 14, position: "relative" }}>
              <span aria-hidden style={{ position: "absolute", top: -1, left: 0, width: 28, height: 2, background: AW }} />
              <p style={{ fontFamily: NUMBERS, fontSize: "clamp(1.75rem, 2.6vw, 2.5rem)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1, color: fg }}>
                <InlineText as="span" value={s.value} onUpdate={updateStat ? (v) => updateStat(i, { value: v }) : undefined} style={{ fontFamily: NUMBERS }} />
              </p>
              <p style={{ marginTop: 8, fontFamily: BODY, fontSize: 13, lineHeight: 1.4, color: mu }}>
                <InlineText as="span" value={s.label} onUpdate={updateStat ? (v) => updateStat(i, { label: v }) : undefined} style={{ fontFamily: BODY }} />
              </p>
            </motion.div>
          ))}
        </div>
      )}
      {(quote || onFieldChange) && (
        <motion.figure initial={anim({ opacity: 0, y: 12 })} animate={show ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.45 }}
          style={{ marginTop: 36, paddingLeft: 18, borderLeft: `2px solid ${AW}` }}>
          <blockquote style={{ fontFamily: DISPLAY, fontSize: "clamp(1.05rem, 1.35vw, 1.25rem)", lineHeight: 1.45, color: fg, fontWeight: 400 }}>
            “<InlineText as="span" value={quote ?? ""} onUpdate={field("quote")} multiline style={{ fontFamily: DISPLAY }} />”
          </blockquote>
          {(quoteAuthor || quoteRole || onFieldChange) && (
            <figcaption style={{ marginTop: 12, fontFamily: BODY, fontSize: 13, color: mu }}>
              <InlineText as="span" value={quoteAuthor ?? ""} onUpdate={field("quoteAuthor")} style={{ fontFamily: BODY, fontWeight: 600, color: fg }} />
              {(quoteRole || onFieldChange) && <>, <InlineText as="span" value={quoteRole ?? ""} onUpdate={field("quoteRole")} style={{ fontFamily: BODY }} /></>}
            </figcaption>
          )}
        </motion.figure>
      )}
      {ctaText && (
        <motion.div initial={anim({ opacity: 0 })} animate={show ? { opacity: 1 } : {}} transition={{ duration: 0.5, delay: 0.55 }} style={{ marginTop: 32 }}>
          {ctaMode === "chilipiper" ? (
            <ChiliPiperButton url={ctaUrl ?? ""} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0.8rem 1.6rem", borderRadius: 999, background: AW, color: "#0B1410", fontWeight: 600, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", border: "none", cursor: "pointer", fontFamily: BODY }}>
              <InlineText as="span" value={ctaText} onUpdate={field("ctaText")} style={{ fontFamily: BODY }} />
            </ChiliPiperButton>
          ) : (
            <a href={ctaUrl || "#"} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: BODY, fontSize: 14, fontWeight: 600, color: fg, textDecoration: "none", borderBottom: `1px solid ${AW}`, paddingBottom: 3 }}>
              <InlineText as="span" value={ctaText} onUpdate={field("ctaText")} style={{ fontFamily: BODY }} />
              <span aria-hidden>→</span>
            </a>
          )}
        </motion.div>
      )}
    </div>
  );

  return (
    <section
      ref={sectionRef}
      data-block="dso-video-case-study"
      style={{ ...getBgStyle(backgroundStyle), color: fg, position: "relative", overflow: "hidden" }}
      className="py-24 md:py-32"
    >
      {dark && <PulseGlow top="20%" left={videoSide === "left" ? "12%" : "88%"} size={420} duration={10} delay={1} />}
      <div style={{ maxWidth: "var(--lp-page-max)", margin: "0 auto", padding: "0 1.5rem", position: "relative" }}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className={`lg:col-span-7 ${videoSide === "right" ? "lg:order-2" : ""}`}>{media}</div>
          <div className={`lg:col-span-5 ${videoSide === "right" ? "lg:order-1" : ""}`}>{text}</div>
        </div>
      </div>
    </section>
  );
}
