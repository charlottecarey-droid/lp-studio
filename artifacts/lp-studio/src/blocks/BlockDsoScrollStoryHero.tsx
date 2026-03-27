import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoScrollStoryHeroBlockProps } from "@/lib/block-types";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const P      = "hsl(152,42%,12%)";
const PFG    = "hsl(48,100%,96%)";
const AW     = "hsl(68,60%,52%)";
const MUTED  = "hsla(48,100%,96%,0.55)";

const DEFAULT_CHAPTERS: DsoScrollStoryHeroBlockProps["chapters"] = [
  {
    headline: "One lab partner. Every location.",
    body: "Dandy becomes your single lab relationship — standardizing quality, pricing, and reporting across every practice in your network. One contract. Zero silos.",
    imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=1400&h=1000&fit=crop",
  },
  {
    headline: "AI that catches problems before they happen.",
    body: "AI Scan Review validates every case in real time — before it leaves the chair. The result: a 96% first-time right rate and fewer costly remakes across your entire footprint.",
    imageUrl: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=1400&h=1000&fit=crop",
  },
  {
    headline: "Executive visibility into every practice.",
    body: "Real-time dashboards give DSO leadership insight into remake rates, case volumes, and turnaround times — by location, region, and brand. Manage by exception, not by spreadsheet.",
    imageUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=1400&h=1000&fit=crop",
  },
  {
    headline: "Prove ROI at 10 offices. Scale to 500.",
    body: "Our Pilot Program validates impact at a small number of locations first — measuring revenue lift, remake reduction, and chair time recovered — before you commit to a full rollout.",
    imageUrl: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=1400&h=1000&fit=crop",
  },
];

interface Props {
  props: DsoScrollStoryHeroBlockProps;
}

export function BlockDsoScrollStoryHero({ props }: Props) {
  const {
    eyebrow = "The Dandy Advantage",
    chapters,
    ctaText = "Request a Custom Demo",
    ctaUrl = "#",
  } = props;
  const displayChapters = chapters && chapters.length > 0 ? chapters.slice(0, 4) : DEFAULT_CHAPTERS;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const sectionInView = useInView(sectionRef, { margin: "-10%" });

  useEffect(() => {
    if (!sectionInView || paused) return;
    const id = setInterval(() => {
      setActive(prev => (prev + 1) % displayChapters.length);
    }, 4000);
    return () => clearInterval(id);
  }, [sectionInView, paused, displayChapters.length]);

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
        background: P,
      }}
    >
      {/* ── Left panel — text ── */}
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
          background: P,
          flexShrink: 0,
        }}
      >
        {/* Eyebrow */}
        <p style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: AW,
          marginBottom: "2.5rem",
        }}>
          {eyebrow}
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
                y: active === i ? 0 : active > i ? -20 : 20,
                pointerEvents: active === i ? "auto" : "none",
              }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
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
                {ch.headline}
              </h1>
              <p style={{
                fontSize: "clamp(0.9375rem, 1.1vw, 1.0625rem)",
                lineHeight: 1.72,
                color: MUTED,
                maxWidth: 460,
              }}>
                {ch.body}
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
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, marginBottom: "2.5rem" }}>
          {String(active + 1).padStart(2, "0")} / {String(displayChapters.length).padStart(2, "0")}
        </p>

        {/* CTA */}
        {ctaText && (
          <div>
            <a
              href={ctaUrl || "#"}
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
                textDecoration: "none",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              {ctaText}
            </a>
          </div>
        )}
      </div>

      {/* ── Right panel — crossfading image ── */}
      <div className="dsosh-right" style={{ position: "relative", flex: 1, minHeight: "100%" }}>
        {displayChapters.map((ch, i) => (
          <motion.div
            key={i}
            style={{ position: "absolute", inset: 0 }}
            animate={{ opacity: active === i ? 1 : 0, scale: active === i ? 1 : 1.04 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          >
            <img
              src={ch.imageUrl}
              alt={ch.headline}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              loading={i === 0 ? "eager" : "lazy"}
            />
            {/* Gradient overlays */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(9,41,30,0.55) 0%, rgba(0,0,0,0) 40%)" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)" }} />
            {/* Watermark number */}
            <div style={{
              position: "absolute",
              bottom: "2rem",
              right: "2rem",
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
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${AW}00, ${AW}, ${AW}00)` }} />
          </motion.div>
        ))}
      </div>

      {/* ── Mobile overlay — stacked, image behind ── */}
      <style>{`
        @media (max-width: 767px) {
          .dsosh-layout { flex-direction: column !important; }
          .dsosh-left { width: 100% !important; min-height: unset !important; padding: 2.5rem 1.25rem 2.5rem !important; }
          .dsosh-right { position: relative !important; height: 45vw !important; min-height: 180px !important; flex: unset !important; width: 100% !important; }
        }
      `}</style>
    </section>
  );
}
