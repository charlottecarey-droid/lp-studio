import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { EventLandingHeroBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: EventLandingHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
}

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

/** Pick a readable foreground color for the CTA pill given its background. */
function readableOn(hex: string): string {
  const m = hex.replace("#", "").trim();
  const full = m.length === 3 ? m.split("").map(c => c + c).join("") : m;
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return "#ffffff";
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  // Per WCAG relative-luminance approximation
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0f172a" : "#ffffff";
}

export function BlockEventLandingHero({ props, brand, onCtaClick }: Props) {
  const {
    backgroundImage,
    backgroundImageAlt,
    overlayColor = "#000000",
    eyebrow,
    headline,
    dateText,
    locationText,
    ctaText,
    ctaUrl,
    showScrollIndicator = true,
    scrollLabel = "SCROLL DOWN",
    scrollTargetId,
  } = props;
  // Runtime normalization — defends against malformed persisted JSON.
  const overlayRaw = props.backgroundOverlay;
  const backgroundOverlay = typeof overlayRaw === "number"
    ? Math.max(0, Math.min(1, overlayRaw))
    : 0.5;
  const align: "center" | "left" = props.align === "left" ? "left" : "center";
  const minHeight = typeof props.minHeight === "string" && props.minHeight.trim().length > 0
    ? props.minHeight
    : "100vh";

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  // Subtle parallax on the bg image and gentle fade on the foreground.
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  // Brand-aware CTA palette.
  const P = `var(--brand-primary, ${brand.primaryColor})`;
  const A = `var(--brand-accent, ${brand.accentColor})`;
  const ctaFg = readableOn(brand.primaryColor);
  const accentFg = readableOn(brand.accentColor);

  const handleCtaClick = () => {
    if (onCtaClick) { onCtaClick(); return; }
    if (ctaUrl && ctaUrl !== "#") safeNavigate(ctaUrl, "_blank");
  };

  const handleScrollClick = () => {
    if (scrollTargetId) {
      const el = document.getElementById(scrollTargetId);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    }
    window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
  };

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        minHeight,
        width: "100%",
        overflow: "hidden",
        backgroundColor: "#000",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        justifyContent: "center",
        textAlign: align === "center" ? "center" : "left",
      }}
    >
      {/* Background image with parallax. Uses a real <img> when alt text is
          provided so screen readers can announce it; otherwise rendered as a
          decorative aria-hidden background div. */}
      {backgroundImage && (backgroundImageAlt ? (
        <motion.img
          src={backgroundImage}
          alt={backgroundImageAlt}
          loading="eager"
          decoding="async"
          style={{
            position: "absolute",
            inset: "-10% 0 -10% 0",
            width: "100%",
            height: "120%",
            objectFit: "cover",
            objectPosition: "center",
            y: bgY,
            zIndex: 0,
          }}
        />
      ) : (
        <motion.div
          aria-hidden
          style={{
            position: "absolute",
            inset: "-10% 0 -10% 0",
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            y: bgY,
            zIndex: 0,
          }}
        />
      ))}

      {/* Dark overlay */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: overlayColor,
          opacity: backgroundOverlay,
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* Foreground content */}
      <motion.div
        style={{
          position: "relative",
          zIndex: 2,
          opacity: contentOpacity,
          width: "100%",
          maxWidth: 1100,
          padding: "clamp(5rem, 12vh, 9rem) clamp(1.25rem, 5vw, 3rem) clamp(6rem, 14vh, 9rem)",
          display: "flex",
          flexDirection: "column",
          alignItems: align === "center" ? "center" : "flex-start",
          gap: "clamp(1.25rem, 3vh, 2rem)",
        }}
      >
        {eyebrow && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{
              margin: 0,
              fontSize: "clamp(0.75rem, 1.4vw, 0.875rem)",
              fontStyle: "italic",
              fontWeight: 500,
              letterSpacing: "0.04em",
              color: A,
              textShadow: "0 1px 12px rgba(0,0,0,0.4)",
            }}
          >
            {eyebrow}
          </motion.p>
        )}

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{
            margin: 0,
            fontFamily: DISPLAY_FONT,
            fontSize: "clamp(2.5rem, 7.5vw, 5.75rem)",
            lineHeight: 1.05,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "#fff",
            textShadow: "0 2px 24px rgba(0,0,0,0.35)",
            maxWidth: "18ch",
          }}
        >
          {headline}
        </motion.h1>

        {(dateText || locationText) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
              alignItems: align === "center" ? "center" : "flex-start",
            }}
          >
            {dateText && (
              <p
                style={{
                  margin: 0,
                  fontSize: "clamp(1rem, 2.2vw, 1.375rem)",
                  fontWeight: 400,
                  color: "rgba(255,255,255,0.92)",
                  textShadow: "0 1px 8px rgba(0,0,0,0.4)",
                }}
              >
                {dateText}
              </p>
            )}
            {locationText && (
              <p
                style={{
                  margin: 0,
                  fontSize: "clamp(0.875rem, 1.6vw, 1rem)",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.78)",
                }}
              >
                {locationText}
              </p>
            )}
          </motion.div>
        )}

        {ctaText && (
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            onClick={handleCtaClick}
            whileHover={{ y: -2 }}
            style={{
              marginTop: "clamp(0.5rem, 2vh, 1rem)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 9999,
              background: P,
              color: ctaFg,
              padding: "0.95rem 2rem",
              fontSize: "clamp(0.8125rem, 1.4vw, 0.9375rem)",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
              transition: "background-color 0.25s ease, box-shadow 0.25s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = A;
              e.currentTarget.style.color = accentFg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = P;
              e.currentTarget.style.color = ctaFg;
            }}
          >
            {ctaText}
          </motion.button>
        )}
      </motion.div>

      {/* Scroll-down indicator */}
      {showScrollIndicator && (
        <motion.button
          type="button"
          onClick={handleScrollClick}
          aria-label={scrollLabel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          style={{
            position: "absolute",
            bottom: "clamp(1.5rem, 5vh, 3rem)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            background: "transparent",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            padding: "0.5rem 1rem",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textShadow: "0 1px 8px rgba(0,0,0,0.4)",
            }}
          >
            {scrollLabel}
          </span>
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            style={{ display: "inline-flex" }}
          >
            <ChevronDown style={{ width: 18, height: 18 }} />
          </motion.span>
        </motion.button>
      )}
    </section>
  );
}
