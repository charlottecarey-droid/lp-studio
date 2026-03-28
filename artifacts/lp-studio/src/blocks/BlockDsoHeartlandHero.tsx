import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import type { DsoHeartlandHeroBlockProps } from "@/lib/block-types";
import { getBgStyle } from "@/lib/bg-styles";

interface Props {
  props: DsoHeartlandHeroBlockProps;
  onCtaClick?: () => void;
}

const PRIMARY  = "hsl(72, 55%, 48%)";
const BG       = "hsl(192, 30%, 5%)";
const MUTED_FG = "hsl(192, 10%, 55%)";
const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

/* ── Dandy wordmark (inline SVG "D" letterform) ─────────── */
function DandyMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect width="20" height="20" rx="5" fill={PRIMARY} />
      <path
        d="M6 5h4.5C13.538 5 16 7.238 16 10s-2.462 5-5.5 5H6V5z"
        fill="hsl(192,30%,6%)"
      />
    </svg>
  );
}

export function BlockDsoHeartlandHero({ props: p, onCtaClick }: Props) {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const contentY    = useTransform(scrollYProgress, [0, 1], ["0px", "60px"]);

  const company = p.companyName?.trim() ?? "";

  const renderHeadline = () => {
    const text = p.headline ?? "";

    // Support {highlighted text} syntax for accent coloring
    if (text.includes("{") && text.includes("}")) {
      const parts: React.ReactNode[] = [];
      const regex = /\{([^}]+)\}/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let key = 0;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(text.slice(lastIndex, match.index));
        }
        parts.push(
          <span key={key++} style={{ color: PRIMARY }}>{match[1]}</span>
        );
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) parts.push(text.slice(lastIndex));
      return <>{parts}</>;
    }

    // Fallback: highlight companyName if it appears literally in the headline
    if (company && text.includes(company)) {
      const [before, ...rest] = text.split(company);
      const after = rest.join(company);
      return (
        <>
          {before}
          <span style={{ color: PRIMARY }}>{company}</span>
          {after}
        </>
      );
    }

    return text;
  };

  return (
    <div style={{ ...getBgStyle(p.backgroundStyle ?? "dandy-green") }}>
      <section
        ref={heroRef}
        className="relative flex flex-col overflow-hidden"
        style={{ minHeight: "100vh" }}
      >
        {/* ── Background ──────────────────────────────────── */}
        {p.backgroundImageUrl ? (
          <div className="absolute inset-0">
            <img
              src={p.backgroundImageUrl}
              alt=""
              className="w-full h-full object-cover"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, hsl(192 30% 5% / 0.55) 0%, hsl(192 30% 5% / 0.65) 40%, hsl(192 25% 8% / 0.90) 100%)",
              }}
            />
          </div>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 55% at 50% 50%, hsl(152 35% 7% / 0.85), transparent),
                radial-gradient(ellipse 45% 35% at 25% 70%, hsl(72 45% 10% / 0.25), transparent),
                #000000
              `,
            }}
          />
        )}

        {/* ── Nav ─────────────────────────────────────────── */}
        <motion.nav
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute top-0 left-0 right-0 z-20"
          style={{
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(to bottom, rgba(8,22,20,0.70) 0%, transparent 100%)",
          }}
        >
          {/* Left — Dandy × Company */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <DandyMark />
            <span
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "#fff",
                letterSpacing: "-0.01em",
              }}
            >
              Dandy
            </span>
            {company && (
              <>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.30)",
                    margin: "0 0.125rem",
                    userSelect: "none",
                  }}
                >
                  ×
                </span>
                <span
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.75)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {company}
                </span>
              </>
            )}
          </div>

          {/* Right — primary CTA */}
          {p.primaryCtaText && (
            <a
              href={p.primaryCtaUrl || "#"}
              onClick={onCtaClick ? (e) => { e.preventDefault(); onCtaClick(); } : undefined}
              className="inline-flex items-center gap-1.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-85"
              style={{
                background: PRIMARY,
                color: "hsl(192, 30%, 6%)",
                padding: "0.5rem 1.125rem",
              }}
            >
              {p.primaryCtaText}
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          )}
        </motion.nav>

        {/* ── Hero content — pinned to lower half ─────────── */}
        <motion.div
          style={{
            opacity: heroOpacity,
            y: contentY,
          }}
          className="relative z-10 flex flex-col justify-center flex-1 w-full pt-20"
        >
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 w-full">
            {p.eyebrow && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  color: PRIMARY,
                  marginBottom: "1.25rem",
                }}
              >
                {p.eyebrow}
              </motion.p>
            )}

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: "clamp(2.75rem, 7vw, 5rem)",
                fontWeight: 600,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                color: "#fff",
                maxWidth: 760,
                textShadow: "0 2px 40px rgba(0,0,0,0.35)",
              }}
            >
              {renderHeadline()}
            </motion.h1>

            {p.subheadline && (
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                style={{
                  marginTop: "1.5rem",
                  fontSize: "1.0625rem",
                  color: MUTED_FG,
                  lineHeight: 1.7,
                  maxWidth: 520,
                }}
              >
                {p.subheadline}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex flex-col sm:flex-row gap-3"
              style={{ marginTop: "2.5rem" }}
            >
              {p.primaryCtaText && (
                <a
                  href={p.primaryCtaUrl || "#"}
                  onClick={onCtaClick ? (e) => { e.preventDefault(); onCtaClick(); } : undefined}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{
                    background: PRIMARY,
                    color: "hsl(192, 30%, 6%)",
                  }}
                >
                  {p.primaryCtaText}
                  <ArrowRight className="w-4 h-4" />
                </a>
              )}

              {p.secondaryCtaText && (
                <a
                  href={p.secondaryCtaUrl || "#"}
                  className="inline-flex items-center justify-center gap-2 rounded-full border px-8 py-3.5 text-sm font-semibold transition-all hover:bg-white/10"
                  style={{
                    borderColor: "rgba(255,255,255,0.20)",
                    color: "rgba(255,255,255,0.90)",
                  }}
                >
                  {p.secondaryCtaText}
                </a>
              )}
            </motion.div>
          </div>

          {/* Scroll indicator */}
          {p.showScrollIndicator !== false && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="flex justify-center mt-12"
            >
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-5 h-8 rounded-full border flex items-start justify-center pt-1.5"
                style={{ borderColor: "rgba(255,255,255,0.18)" }}
              >
                <div
                  className="w-1 h-1.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.35)" }}
                />
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </section>
    </div>
  );
}
