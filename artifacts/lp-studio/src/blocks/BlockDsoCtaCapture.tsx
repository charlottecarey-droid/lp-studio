import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoCtaCaptureBlockProps } from "@/lib/block-types";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";
const PFG   = "hsl(48,100%,96%)";
const AW    = "hsl(68,60%,52%)";
const MUTED = "hsla(48,100%,96%,0.50)";
const BG    = "#003A30";

interface Props { props: DsoCtaCaptureBlockProps }

export function BlockDsoCtaCapture({ props }: Props) {
  const {
    eyebrow       = "Get Started Today",
    headline      = "See what Dandy can\ndo for your group.",
    body          = "Join DSO leaders already running smarter, faster dental operations. Setup takes one call.",
    inputLabel    = "Work email",
    inputPlaceholder = "yourname@dsogroup.com",
    ctaLabel      = "Request a Demo",
    trust1        = "1,200+ DSO locations",
    trust2        = "No long-term contract",
    trust3        = "Live in 30 days",
    imageUrl      = "",
    imagePosition = "right",
  } = props;

  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-8%" });
  const [focused, setFocused] = useState(false);

  const hasImage  = Boolean(imageUrl);
  const imgOnLeft = imagePosition === "left";

  const trusts = [trust1, trust2, trust3].filter(Boolean);

  return (
    <section
      ref={sectionRef}
      style={{ position: "relative", overflow: "hidden", minHeight: "80vh", display: "flex", alignItems: "stretch", background: BG }}
    >
      {/* Atmospheric lime radial glow — content side */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: imgOnLeft
          ? "radial-gradient(ellipse 60% 70% at 80% 50%, rgba(60,90,10,0.18) 0%, transparent 70%)"
          : "radial-gradient(ellipse 60% 70% at 20% 50%, rgba(60,90,10,0.18) 0%, transparent 70%)",
      }} />

      {/* Film grain */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.035,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundRepeat: "repeat", backgroundSize: "256px 256px",
      }} />

      {/* Full-bleed image column */}
      {hasImage && (
        <div style={{
          position: "absolute",
          left:  imgOnLeft ? 0 : "50%",
          right: imgOnLeft ? "50%" : 0,
          top: 0, bottom: 0,
          overflow: "hidden", zIndex: 1,
        }}>
          <motion.img
            src={imageUrl}
            alt=""
            animate={{ scale: [1.06, 1.10, 1.07, 1.06], x: [0, 8, -6, 0], y: [0, -10, 7, 0] }}
            transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
          />
          {/* Gradient fade toward content */}
          <div style={{
            position: "absolute", inset: 0,
            background: imgOnLeft
              ? `linear-gradient(to right, transparent 52%, ${BG} 100%)`
              : `linear-gradient(to left,  transparent 52%, ${BG} 100%)`,
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(to bottom, ${BG} 0%, transparent 10%, transparent 90%, ${BG} 100%)`,
          }} />
        </div>
      )}

      {/* Content grid */}
      <div
        className="dcc-grid"
        style={{
          position: "relative", zIndex: 2,
          maxWidth: 1200, margin: "0 auto",
          padding: "8rem 2.5rem", width: "100%",
          display: "grid",
          gridTemplateColumns: hasImage ? "1fr 1fr" : "1fr",
          alignItems: "center",
          gap: "5rem",
        }}
      >
        {/* Spacer when image is on the left */}
        {hasImage && imgOnLeft && <div />}

        {/* CTA content */}
        <motion.div
          initial={{ opacity: 0, x: hasImage ? (imgOnLeft ? 32 : -32) : 0, y: hasImage ? 0 : 20 }}
          animate={inView ? { opacity: 1, x: 0, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45 }}
            style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "2rem" }}
          >
            {/* Lime pulse dot */}
            <span style={{
              display: "inline-block", width: 7, height: 7, borderRadius: "50%",
              background: AW, boxShadow: "0 0 0 3px rgba(199,231,56,0.18)",
              flexShrink: 0,
            }} />
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: AW, margin: 0 }}>
              {eyebrow}
            </p>
          </motion.div>

          {/* Headline */}
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(2.25rem, 5vw, 4.5rem)",
              fontWeight: 800, color: PFG,
              letterSpacing: "-0.045em", lineHeight: 0.95,
              marginBottom: "1.5rem", whiteSpace: "pre-line",
            }}
          >
            {headline}
          </motion.h2>

          {/* Body */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{ fontSize: "1.0625rem", lineHeight: 1.68, color: MUTED, maxWidth: 420, marginBottom: "2.5rem" }}
          >
            {body}
          </motion.p>

          {/* Input label */}
          {inputLabel && (
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(199,231,56,0.6)", marginBottom: "0.65rem" }}>
              {inputLabel}
            </p>
          )}

          {/* Pill input + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${focused ? "rgba(199,231,56,0.5)" : "rgba(199,231,56,0.2)"}`,
              borderRadius: 999,
              padding: "5px 5px 5px 22px",
              gap: 8,
              backdropFilter: "blur(12px)",
              boxShadow: focused ? "0 0 0 3px rgba(199,231,56,0.08), 0 0 24px rgba(199,231,56,0.06)" : "none",
              transition: "border-color 0.2s, box-shadow 0.2s",
              maxWidth: 480,
            }}
          >
            <input
              type="email"
              placeholder={inputPlaceholder}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{
                flex: 1, minWidth: 0,
                background: "none", border: "none", outline: "none",
                color: PFG, fontSize: "0.9375rem",
                fontFamily: "inherit",
              }}
            />
            <button
              style={{
                background: AW,
                color: "#050e08",
                border: "none", borderRadius: 999,
                padding: "13px 26px",
                fontWeight: 800, fontSize: "0.875rem",
                cursor: "pointer", whiteSpace: "nowrap",
                fontFamily: DISPLAY_FONT,
                letterSpacing: "-0.01em",
                flexShrink: 0,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              {ctaLabel}
            </button>
          </motion.div>

          {/* Trust strip */}
          {trusts.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.45 }}
              style={{
                display: "flex", flexWrap: "wrap", gap: "1.25rem 2rem",
                marginTop: "1.75rem", alignItems: "center",
              }}
            >
              {trusts.map((t, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="6" stroke="rgba(199,231,56,0.35)" strokeWidth="1" />
                    <path d="M3.5 6.5l2 2 4-4" stroke={AW} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: "0.8125rem", color: MUTED, fontWeight: 500 }}>{t}</span>
                </span>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Spacer when image is on the right */}
        {hasImage && !imgOnLeft && <div />}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dcc-grid { grid-template-columns: 1fr !important; gap: 2rem !important; }
        }
      `}</style>
    </section>
  );
}
