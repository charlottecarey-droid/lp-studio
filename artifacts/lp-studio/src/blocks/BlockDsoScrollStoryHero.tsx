import { useRef, useState, useEffect, useCallback } from "react";
import { MuteToggleButton } from "@/components/MuteToggleButton";
import { motion, useInView } from "framer-motion";
import type { DsoScrollStoryHeroBlockProps } from "@/lib/block-types";
import { getBgStyle } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import type { BrandConfig } from "@/lib/brand-config";

import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
const DISPLAY_FONT = `${BRAND_DISPLAY_FONT}, 'Inter', system-ui, sans-serif`;

const P      = "var(--brand-primary, #0f172a)";
const PFG    = "hsl(48,100%,96%)";
const AW     = "var(--brand-accent, hsl(68,60%,52%))";
const MUTED  = "hsla(48,100%,96%,0.55)";

const BG_PANEL_MAP: Record<string, string> = {
  "white":       "#ffffff",
  "light-gray":  "#f3f4f6",
  "muted":       "hsl(48,100%,96%)",
  "dark":        "#1a1a1a",
  "dandy-green": "var(--brand-primary)",
  "black":       "#000000",
  "gradient":    "#001a14",
};

const BG_OVERLAY_MAP: Record<string, string> = {
  "white":       "rgba(255,255,255,0.70)",
  "light-gray":  "rgba(243,244,246,0.70)",
  "muted":       "rgba(255,250,230,0.70)",
  "dark":        "rgba(26,26,26,0.70)",
  "dandy-green": "rgb(var(--brand-primary-rgb, 15 23 42) / 0.60)",
  "black":       "rgba(0,0,0,0.70)",
  "gradient":    "rgba(0,26,20,0.70)",
};

// Neutral component-level fallback. Catalog default_props (industry='generic')
// supplies richer chapters; this fallback only fires for isolated previews or
// when no catalog row matches. Previously this leaked Dandy/dental copy and
// Unsplash dental imagery into every generic-tenant page that didn't override.
const DEFAULT_CHAPTERS: DsoScrollStoryHeroBlockProps["chapters"] = [
  {
    headline: "One platform. Every location.",
    body: "Become your single source of truth — standardizing quality, pricing, and reporting across every site in your network.",
    imageUrl: "",
  },
  {
    headline: "Catch problems before they happen.",
    body: "Real-time checks validate every workflow before issues become costly downstream.",
    imageUrl: "",
  },
  {
    headline: "Executive visibility, by site and region.",
    body: "Dashboards give leadership insight into the metrics that matter, in real time. Manage by exception, not by spreadsheet.",
    imageUrl: "",
  },
  {
    headline: "Prove ROI, then scale.",
    body: "Validate impact at a small number of locations first, then expand with confidence.",
    imageUrl: "",
  },
];

interface Props {
  props: DsoScrollStoryHeroBlockProps;
  brand?: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: DsoScrollStoryHeroBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

export function BlockDsoScrollStoryHero({ props, brand, onCtaClick, onFieldChange, pageId, variantId }: Props) {
  const {
    eyebrow = "Why teams choose us",
    chapters,
    ctaText = "Request a Demo",
    ctaUrl = "#",
    imagePosition = "right",
    backgroundStyle = "dark",
  } = props;
  const field = (key: keyof DsoScrollStoryHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as DsoScrollStoryHeroBlockProps[typeof key] }) : undefined;
  const updateChapter = onFieldChange
    ? (idx: number, patch: Partial<NonNullable<DsoScrollStoryHeroBlockProps["chapters"]>[number]>) => {
        const list = (chapters && chapters.length > 0) ? chapters : DEFAULT_CHAPTERS;
        onFieldChange({ ...props, chapters: list.map((c, i) => i === idx ? { ...c, ...patch } : c) });
      }
    : undefined;
  const imageRight = imagePosition !== "left";
  const panelBg = BG_PANEL_MAP[backgroundStyle] ?? P;
  const panelOverlay = BG_OVERLAY_MAP[backgroundStyle] ?? "rgb(var(--brand-primary-rgb, 15 23 42) / 0.60)";
  const displayChapters = chapters && chapters.length > 0 ? chapters.slice(0, 4) : DEFAULT_CHAPTERS;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const [bgVideoMuted, setBgVideoMuted] = useState(true);

  const attachBgVideo = useCallback((el: HTMLVideoElement | null) => {
    bgVideoRef.current = el;
    if (!el) return;
    el.muted = true;
  }, []);

  const toggleBgMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = bgVideoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setBgVideoMuted(el.muted);
  };

  const sectionRef = useRef<HTMLElement>(null);
  const sectionInView = useInView(sectionRef, { margin: "-10%" });

  useEffect(() => {
    if (!sectionInView || paused) return;
    const id = setInterval(() => {
      setActive(prev => (prev + 1) % displayChapters.length);
    }, 4000);
    return () => clearInterval(id);
  }, [sectionInView, paused, displayChapters.length]);

  const textPanel = (
      <div
        className="dsosh-left"
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "clamp(340px, 46%, 640px)",
          minWidth: 0,
          padding: "clamp(2.5rem,6vw,5.5rem) clamp(1.5rem,5vw,4.5rem)",
          background: panelBg,
          flexShrink: 0,
          order: imageRight ? 0 : 1,
        }}
      >
        {/* Eyebrow */}
        <p style={{ ...{fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: AW, marginBottom: "2.5rem",}, ...{fontFamily: BODY} }}>
          <InlineText as="span" value={eyebrow} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }}/>
        </p>

        {/* Animated headline + body */}
        <div style={{ position: "relative", minHeight: "clamp(200px, 32vh, 340px)", marginBottom: "2.5rem" }}>
          {displayChapters.map((ch, i) => (
            <motion.div
              key={i}
              style={{
                position: i === 0 ? "relative" : "absolute",
                top: 0,
                width: "100%",
              }}
              animate={{
                opacity: active === i ? 1 : 0,
                y: active === i ? 0 : active > i ? -36 : 28,
                pointerEvents: active === i ? "auto" : "none",
              }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 style={{
                fontFamily: DISPLAY_FONT,
                fontSize: "clamp(1.875rem, 4.5vw, 3.75rem)",
                fontWeight: 700,
                color: PFG,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                marginBottom: "1.25rem",
              }}>
                <InlineText as="span" value={ch.headline} onUpdate={updateChapter ? (v) => updateChapter(i, { headline: v }) : undefined} multiline style={{ fontFamily: BODY }}/>
              </h1>
              <p style={{ ...{fontSize: "clamp(0.9375rem, 1.1vw, 1.0625rem)", lineHeight: 1.72, color: MUTED, maxWidth: 460,}, ...{fontFamily: BODY} }}>
                <InlineText as="span" value={ch.body} onUpdate={updateChapter ? (v) => updateChapter(i, { body: v }) : undefined} multiline style={{ fontFamily: BODY }}/>
              </p>
            </motion.div>
          ))}
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 8, marginBottom: "2.25rem" }}>
          {displayChapters.map((_, i) => (
            <button
              key={i}
              onClick={() => { setActive(i); setPaused(false); }}
              aria-label={`Chapter ${i + 1}`}
              style={{
                position: "relative",
                height: 3,
                width: active === i ? 40 : 12,
                borderRadius: 2,
                background: "rgba(255,255,255,0.12)",
                border: "none",
                padding: 0,
                cursor: "pointer",
                overflow: "hidden",
                transition: "width 0.4s cubic-bezier(0.16,1,0.3,1)",
                flexShrink: 0,
              }}
            >
              {active === i && !paused ? (
                <motion.div
                  key={`fill-${i}-${active}`}
                  style={{ position: "absolute", inset: 0, borderRadius: 2, background: AW, originX: 0 }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 4, ease: "linear" }}
                />
              ) : (
                <div style={{ position: "absolute", inset: 0, borderRadius: 2, background: active === i ? AW : "rgba(255,255,255,0.25)" }} />
              )}
            </button>
          ))}
        </div>

        {/* Chapter counter */}
        <p style={{ ...{fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, marginBottom: "2.5rem"}, ...{fontFamily: BODY} }}>
          {String(active + 1).padStart(2, "0")} / {String(displayChapters.length).padStart(2, "0")}
        </p>

        {/* CTA */}
        {ctaText && (
          <div>
            <CtaButton
              ctaAction={(() => {
                const a = props.ctaAction ?? props.ctaMode;
                if (a === "chilipiper" || a === "modal-form" || a === "modal-chilipiper") return a;
                return "url";
              })()}
              ctaUrl={ctaUrl}
              chilipiperUrl={props.chilipiperUrl}
              modalChilipiperUrl={props.modalChilipiperUrl}
              modalFormSource={props.modalFormSource}
              modalFormId={props.modalFormId}
              modalMarketoBaseUrl={props.modalMarketoBaseUrl}
              modalMarketoMunchkinId={props.modalMarketoMunchkinId}
              modalMarketoFormId={props.modalMarketoFormId}
              modalChiliPiperHandoffUrl={props.modalChiliPiperHandoffUrl}
              modalChiliPiperHandoffMode={props.modalChiliPiperHandoffMode}
              modalChiliPiperHandoffFieldMap={props.modalChiliPiperHandoffFieldMap}
              modalHeadline={props.modalHeadline}
              modalSubheadline={props.modalSubheadline}
              modalSubmitText={props.modalSubmitText}
              modalSuccessMessage={props.modalSuccessMessage}
              modalDisclaimer={props.modalDisclaimer}
              modalShowFirstName={props.modalShowFirstName}
              modalShowLastName={props.modalShowLastName}
              modalShowPhone={props.modalShowPhone}
              modalShowCompany={props.modalShowCompany}
              onClick={onCtaClick}
              style={{
                display: "inline-block",
                padding: "0.875rem 2rem",
                background: AW,
                color: P,
                fontFamily: DISPLAY_FONT,
                fontSize: "0.9375rem",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                borderRadius: "0.5rem",
                cursor: "pointer",
                border: "none",
              }}
              brand={brand}
              pageId={pageId}
              variantId={variantId}
              source="dso-scroll-story-hero"
            >
              {ctaText}
            </CtaButton>
          </div>
        )}
      </div>
  );

  const imagePanel = (
    <div className="dsosh-right" style={{ position: "relative", flex: 1, minHeight: "100%", order: imageRight ? 1 : 0 }}>
      {displayChapters.map((ch, i) => (
        <motion.div
          key={i}
          style={{ position: "absolute", inset: 0 }}
          animate={{ opacity: active === i ? 1 : 0, scale: active === i ? 1 : 1.04 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          <img
            src={ch.imageUrl}
            alt={ch.headline}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            loading={i === 0 ? "eager" : "lazy"}
          />
          {/* Gradient overlays — flip direction when image is on the left */}
          <div style={{ position: "absolute", inset: 0, background: imageRight
            ? `linear-gradient(90deg, ${panelOverlay} 0%, rgba(0,0,0,0) 45%)`
            : `linear-gradient(270deg, ${panelOverlay} 0%, rgba(0,0,0,0) 45%)`
          }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)" }} />
          {/* Watermark number */}
          <div style={{
            position: "absolute",
            bottom: "2rem",
            ...(imageRight ? { right: "2rem" } : { left: "2rem" }),
            fontFamily: DISPLAY_FONT,
            fontSize: "clamp(5rem,10vw,9rem)",
            fontWeight: 800,
            color: "rgba(255,255,255,0.09)",
            lineHeight: 1,
            letterSpacing: "-0.06em",
            userSelect: "none",
          }}>
            {String(i + 1).padStart(2, "0")}
          </div>
          {/* Lime bottom accent */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, rgb(var(--brand-accent-rgb, 59 130 246) / 0), ${AW}, rgb(var(--brand-accent-rgb, 59 130 246) / 0))` }} />
        </motion.div>
      ))}
    </div>
  );

  return (
    <section
      ref={sectionRef}
      className="dsosh-layout"
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "row",
        overflow: "hidden",
        ...getBgStyle(backgroundStyle),
      }}
    >
      {props.backgroundVideoUrl && (
        <>
          <video
            ref={attachBgVideo}
            src={props.backgroundVideoUrl}
            autoPlay
            loop
            playsInline
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 0,
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background: panelOverlay,
              zIndex: 1,
            }}
          />
          <MuteToggleButton muted={bgVideoMuted} onClick={toggleBgMute} className="absolute bottom-4 right-4 z-20" />
        </>
      )}
      {textPanel}
      {imagePanel}

      {/* ── Mobile overlay — stacked, image behind ── */}
      <style>{`
        @media (max-width: 767px) {
          .dsosh-layout { flex-direction: column !important; }
          .dsosh-left { width: 100% !important; min-height: unset !important; padding: 2.5rem 1.25rem 2.5rem !important; order: 0 !important; }
          .dsosh-right { position: relative !important; height: 45vw !important; min-height: 180px !important; flex: unset !important; width: 100% !important; order: 1 !important; }
        }
      `}</style>
    </section>
  );
}
