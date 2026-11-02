import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Play } from "lucide-react";
import { useAnimInitial, useRevealFallback } from "@/lib/reveal-fallback";
import type { DsoVideoCaseStudyBlockProps } from "@/lib/block-types";
import { getBgStyle, resolveSectionSurface } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { InlineText } from "@/components/InlineText";
import { extractWistiaId, wistiaIframeUrl } from "@/lib/wistia";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "../lib/brand-fonts";

/**
 * DSO — Video case study (Nov 2026, Ramp-style rebuild).
 *
 * The layout Charlotte pointed at on ramp.com: a large rounded portrait video
 * card with the customer's first name set enormous in the accent colour over
 * the poster, their role beneath it, and one translucent "Watch video" pill;
 * beside it a two-tone headline (ink, then muted), a quiet text link, open
 * space, and at the bottom the verbatim quote, name, role and "Read their
 * story". White by default, almost no chrome — the film and the words do the
 * work. Optional outcome numbers sit above the quote when provided.
 *
 * Reveal contract: copy uses useAnimInitial + useRevealFallback; the poster is
 * plain markup; the player (Wistia iframe or native mp4) mounts only on play.
 */

const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_STACK;
const NUMBERS = BRAND_NUMBERS_STACK;
const P = "var(--brand-primary, #0f172a)";
const AW = "var(--brand-accent, hsl(68,60%,52%))";

export const DSO_VIDEO_CASE_STUDY_DEFAULT_PROPS: DsoVideoCaseStudyBlockProps = {
  eyebrow: "",
  company: "Northwind Health",
  companyMeta: "",
  headline: "Keep your clinical team focused on patients.",
  headlineMuted: "Let one partner handle the rest.",
  linkText: "Learn about the platform",
  linkUrl: "#",
  body: "",
  stats: [],
  quote: "They gave us our schedule back. What used to take four visits now takes fewer than two, and our teams can finally plan around it.",
  quoteAuthor: "Jordan Lee",
  quoteRole: "Chief Clinical Officer, Northwind Health",
  overlayName: "Jordan",
  overlayRole: "Chief Clinical Officer, Northwind Health",
  watchLabel: "Watch video",
  storyLinkText: "Read their story",
  storyLinkUrl: "#",
  videoUrl: "",
  posterUrl: "",
  videoSide: "left",
  backgroundStyle: "white",
};

interface Props {
  brand?: BrandConfig;
  props: DsoVideoCaseStudyBlockProps;
  onFieldChange?: (updated: DsoVideoCaseStudyBlockProps) => void;
}

function isNativeVideo(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) || url.startsWith("/api/storage/");
}

function firstName(full?: string): string {
  const cleaned = (full ?? "").replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, "").trim();
  return cleaned.split(/\s+/)[0] ?? "";
}

export function BlockDsoVideoCaseStudy({ props, brand, onFieldChange }: Props) {
  const merged = { ...DSO_VIDEO_CASE_STUDY_DEFAULT_PROPS, ...props };
  const {
    company, headline, headlineMuted, linkText, linkUrl, body, quote, quoteAuthor, quoteRole,
    watchLabel, storyLinkText, storyLinkUrl, videoUrl, posterUrl, videoSide = "left",
    ctaText, ctaUrl, ctaMode = "link", backgroundStyle = "white",
  } = merged;
  const overlayName = merged.overlayName?.trim() || firstName(quoteAuthor) || company;
  const overlayScrim = merged.overlayScrim ?? "soft";
  // Long names ("Dr. Nathan Suter") step the type down so they still fit the
  // card on two lines at most; short first names keep the Ramp-size display.
  const nameLen = overlayName.length;
  const nameCqw = nameLen <= 7 ? 17 : nameLen <= 10 ? 14 : nameLen <= 14 ? 11.5 : nameLen <= 20 ? 9.5 : 8;
  const scrimLayer =
    overlayScrim === "none"
      ? "linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.28) 100%)"
      : overlayScrim === "strong"
        ? "linear-gradient(180deg, rgba(0,0,0,0) 28%, rgba(0,0,0,0.38) 58%, rgba(0,0,0,0.82) 100%)"
        : "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.22) 65%, rgba(0,0,0,0.62) 100%)";
  const overlayRole = merged.overlayRole?.trim() || quoteRole || "";
  const stats = (merged.stats ?? []).filter((s) => s.value?.trim()).slice(0, 3);

  const field = (key: keyof DsoVideoCaseStudyBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v } as DsoVideoCaseStudyBlockProps) : undefined;
  const updateStat = onFieldChange
    ? (i: number, patch: Partial<{ value: string; label: string }>) =>
        onFieldChange({ ...props, stats: (merged.stats ?? []).map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
    : undefined;

  const dark = resolveSectionSurface({ backgroundStyle }, "#ffffff", brand).isDark;
  const ink = dark ? "#FFFFFF" : P;
  const muted = dark ? "rgba(255,255,255,0.55)" : "rgb(var(--brand-primary-rgb, 15 23 42) / 0.50)";
  const quiet = dark ? "rgba(255,255,255,0.72)" : "rgb(var(--brand-primary-rgb, 15 23 42) / 0.70)";
  const hairline = dark ? "rgba(255,255,255,0.12)" : "rgb(var(--brand-primary-rgb, 15 23 42) / 0.10)";

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
      initial={anim({ opacity: 0, y: 20 })}
      animate={show ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        borderRadius: 18,
        overflow: "hidden",
        background: "#0B1410",
        containerType: "inline-size",
      } as React.CSSProperties}
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
        <>
          <button
            type="button"
            onClick={() => canPlay && setPlaying(true)}
            aria-label={canPlay ? `Play ${company} story` : undefined}
            disabled={!canPlay}
            style={{ all: "unset", position: "absolute", inset: 0, cursor: canPlay ? "pointer" : "default", display: "block" }}
            className="group"
          >
            {posterUrl ? (
              <img src={posterUrl} alt={`${company} story`} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 1.4s cubic-bezier(0.16,1,0.3,1)" }} className="group-hover:scale-[1.02]" loading="lazy" />
            ) : (
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 30% 20%, rgb(var(--brand-accent-rgb, 199 231 56) / 0.18), transparent 55%), linear-gradient(160deg, rgb(var(--brand-primary-rgb, 0 58 48)) 0%, #050F0D 100%)` }} />
            )}
            {/* Scrim behind the name so it reads on any poster (overlayScrim). */}
            <div aria-hidden data-overlay-scrim={overlayScrim} style={{ position: "absolute", inset: 0, background: scrimLayer }} />
          </button>
          <div style={{ position: "absolute", left: "7.5%", right: "7.5%", bottom: "6.5%", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, pointerEvents: "none" }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: DISPLAY, fontSize: `clamp(2.25rem, ${nameCqw}cqw, 9rem)`, lineHeight: 0.92, fontWeight: 500, letterSpacing: "-0.04em", color: AW, margin: 0, textWrap: "balance", pointerEvents: onFieldChange ? "auto" : "none" } as React.CSSProperties}>
                <InlineText as="span" value={overlayName} onUpdate={field("overlayName")} style={{ fontFamily: DISPLAY }} />
              </p>
              {(overlayRole || onFieldChange) && (
                <p style={{ fontFamily: BODY, fontSize: "clamp(0.95rem, 3.6cqw, 1.75rem)", fontWeight: 400, letterSpacing: "-0.01em", color: AW, margin: "0.45em 0 0", pointerEvents: onFieldChange ? "auto" : "none" }}>
                  <InlineText as="span" value={overlayRole} onUpdate={field("overlayRole")} style={{ fontFamily: BODY }} />
                </p>
              )}
            </div>
            {canPlay && (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                style={{
                  pointerEvents: "auto", flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 10,
                  padding: "0.9rem 1.5rem 0.9rem 1.25rem", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(20,20,20,0.62)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                  color: "#FFFFFF", fontFamily: BODY, fontSize: 14, fontWeight: 500, cursor: "pointer",
                  transition: "background 0.3s",
                }}
                className="hover:!bg-black/80"
              >
                <Play style={{ width: 12, height: 12 }} fill="currentColor" />
                <InlineText as="span" value={watchLabel ?? "Watch video"} onUpdate={field("watchLabel")} style={{ fontFamily: BODY }} />
              </button>
            )}
          </div>
        </>
      )}
    </motion.div>
  );

  const quoteBlock = (quote || onFieldChange) && (
    <motion.figure initial={anim({ opacity: 0, y: 12 })} animate={show ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay: 0.3 }} style={{ margin: 0 }}>
      <blockquote style={{ fontFamily: BODY, fontSize: "clamp(1rem, 1.15vw, 1.0625rem)", lineHeight: 1.55, color: ink, margin: 0, fontWeight: 400, letterSpacing: "-0.005em" }}>
        “<InlineText as="span" value={quote ?? ""} onUpdate={field("quote")} multiline style={{ fontFamily: BODY }} />”
      </blockquote>
      {(quoteAuthor || quoteRole || onFieldChange) && (
        <figcaption style={{ marginTop: 24, fontFamily: BODY, fontSize: 15, lineHeight: 1.45 }}>
          <span style={{ display: "block", color: ink, fontWeight: 500 }}>
            <InlineText as="span" value={quoteAuthor ?? ""} onUpdate={field("quoteAuthor")} style={{ fontFamily: BODY }} />
          </span>
          {(quoteRole || onFieldChange) && (
            <span style={{ display: "block", color: muted, fontSize: 14, marginTop: 2 }}>
              <InlineText as="span" value={quoteRole ?? ""} onUpdate={field("quoteRole")} style={{ fontFamily: BODY }} />
            </span>
          )}
        </figcaption>
      )}
      {(storyLinkText || onFieldChange) && (
        <a href={storyLinkUrl || "#"} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 20, fontFamily: BODY, fontSize: 15, color: quiet, textDecoration: "none" }} className="hover:opacity-70 transition-opacity">
          <InlineText as="span" value={storyLinkText ?? ""} onUpdate={field("storyLinkText")} style={{ fontFamily: BODY }} />
          <span aria-hidden>→</span>
        </a>
      )}
    </motion.figure>
  );

  const text = (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", gap: 40 }}>
      <div>
        <motion.h2 initial={anim({ opacity: 0, y: 14 })} animate={show ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay: 0.05 }}
          style={{ fontFamily: DISPLAY, fontSize: "clamp(1.5rem, 2.1vw, 1.95rem)", lineHeight: 1.3, fontWeight: 500, letterSpacing: "-0.015em", margin: 0, color: ink }}>
          <InlineText as="span" value={headline} onUpdate={field("headline")} multiline style={{ fontFamily: DISPLAY, color: ink }} />
          {(headlineMuted || onFieldChange) && (
            <>
              {" "}
              <InlineText as="span" value={headlineMuted ?? ""} onUpdate={field("headlineMuted")} multiline style={{ fontFamily: DISPLAY, color: muted }} />
            </>
          )}
        </motion.h2>
        {(linkText || onFieldChange) && (
          <motion.a initial={anim({ opacity: 0 })} animate={show ? { opacity: 1 } : {}} transition={{ duration: 0.6, delay: 0.15 }}
            href={linkUrl || "#"} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 28, fontFamily: BODY, fontSize: 15, color: quiet, textDecoration: "none" }} className="hover:opacity-70 transition-opacity">
            <InlineText as="span" value={linkText ?? ""} onUpdate={field("linkText")} style={{ fontFamily: BODY }} />
            <span aria-hidden>→</span>
          </motion.a>
        )}
        {(body || onFieldChange) && (
          <motion.p initial={anim({ opacity: 0 })} animate={show ? { opacity: 1 } : {}} transition={{ duration: 0.6, delay: 0.2 }}
            style={{ marginTop: 24, fontFamily: BODY, fontSize: 15, lineHeight: 1.6, color: quiet, maxWidth: 480 }}>
            <InlineText as="span" value={body ?? ""} onUpdate={field("body")} multiline style={{ fontFamily: BODY }} />
          </motion.p>
        )}
      </div>
      <div>
        {stats.length > 0 && (
          <div className="grid grid-cols-3 gap-6" style={{ marginBottom: 36, paddingBottom: 28, borderBottom: `1px solid ${hairline}` }}>
            {stats.map((s, i) => (
              <motion.div key={i} initial={anim({ opacity: 0, y: 10 })} animate={show ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.2 + i * 0.07 }}>
                <p style={{ fontFamily: NUMBERS, fontSize: "clamp(1.5rem, 2vw, 2rem)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1, color: ink, margin: 0 }}>
                  <InlineText as="span" value={s.value} onUpdate={updateStat ? (v) => updateStat(i, { value: v }) : undefined} style={{ fontFamily: NUMBERS }} />
                </p>
                <p style={{ marginTop: 8, fontFamily: BODY, fontSize: 13, lineHeight: 1.4, color: muted }}>
                  <InlineText as="span" value={s.label} onUpdate={updateStat ? (v) => updateStat(i, { label: v }) : undefined} style={{ fontFamily: BODY }} />
                </p>
              </motion.div>
            ))}
          </div>
        )}
        {quoteBlock}
        {ctaText && (
          <div style={{ marginTop: 28 }}>
            {ctaMode === "chilipiper" ? (
              <ChiliPiperButton url={ctaUrl ?? ""} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0.8rem 1.5rem", borderRadius: 999, background: AW, color: "#0B1410", fontWeight: 600, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", border: "none", cursor: "pointer", fontFamily: BODY }}>
                <InlineText as="span" value={ctaText} onUpdate={field("ctaText")} style={{ fontFamily: BODY }} />
              </ChiliPiperButton>
            ) : (
              <a href={ctaUrl || "#"} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0.8rem 1.5rem", borderRadius: 999, background: AW, color: "#0B1410", fontWeight: 600, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", textDecoration: "none", fontFamily: BODY }}>
                <InlineText as="span" value={ctaText} onUpdate={field("ctaText")} style={{ fontFamily: BODY }} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      data-block="dso-video-case-study"
      style={{ ...getBgStyle(backgroundStyle), color: ink, position: "relative", overflow: "hidden" }}
      className="py-16 md:py-24"
    >
      <div style={{ maxWidth: "var(--lp-page-max)", margin: "0 auto", padding: "0 1.5rem", position: "relative" }}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-stretch">
          <div className={`lg:col-span-7 ${videoSide === "right" ? "lg:order-2" : ""}`}>{media}</div>
          <div className={`lg:col-span-5 ${videoSide === "right" ? "lg:order-1 lg:pr-6" : "lg:pl-6"}`}>{text}</div>
        </div>
      </div>
    </section>
  );
}
