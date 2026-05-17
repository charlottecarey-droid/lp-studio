import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { ProductLaunchBlockProps, ProductLaunchTheme } from "@/lib/block-types";
import { useBlockFonts } from "@/lib/use-block-fonts";

// Product Launch / Keynote block — premium upgrade.
//
// The data contract (ProductLaunchBlockProps) is unchanged — every existing
// property is still honoured. The visual chrome around it is what got rebuilt:
//
//   • Sticky nav with monogram + version chip + animated chapter indicator
//     and a real scroll progress bar at the bottom of the nav.
//   • Hero with a chapter numeral, launch-date chip, decorative aurora,
//     bezelled video frame with corner notches and a glass reflection edge.
//   • Feature slabs each carry a huge italic chapter number, an ornament
//     marker, a 3-KPI strip beneath the bullets, and a floating annotation
//     chip pinned over the image.
//   • Specs section with eyebrow + decorative rule frame, sticky table head,
//     category-grouped rows, hover highlight, and per-cell value treatment.
//   • Plans with billing toggle, aurora glow behind the highlighted tier,
//     grouped feature lists, and a refined "Most popular" star badge.
//   • CTA finished with a compass-rose ornament + reservation-style buttons
//     and a shipping-info ribbon underneath.
//   • Premium multi-column footer with product mark, sitemap, and compliance
//     badges.

const LIGHT_DEFAULTS: Required<ProductLaunchTheme> = {
  bg: "#FFFFFF",
  fg: "#1D1D1F",
  muted: "#86868B",
  border: "#D2D2D7",
  accent: "#0071E3",
  panelBg: "#F5F5F7",
  displayFontFamily: "",
  bodyFontFamily: "",
};

const DARK_DEFAULTS: Required<ProductLaunchTheme> = {
  bg: "#000000",
  fg: "#FFFFFF",
  muted: "#86868B",
  border: "#333336",
  accent: "#0A84FF",
  panelBg: "#151516",
  displayFontFamily: "",
  bodyFontFamily: "",
};

function resolveTheme(mode: "light" | "dark", t: ProductLaunchTheme | undefined) {
  const base = mode === "light" ? LIGHT_DEFAULTS : DARK_DEFAULTS;
  return { ...base, ...(t ?? {}) };
}

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const fn = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);
  return dark;
}

// ── decorative primitives ───────────────────────────────────────────────

function CornerNotch({ color, position, size = 24 }: { color: string; position: "tl" | "tr" | "bl" | "br"; size?: number }) {
  const stroke = 1.4;
  const path =
    position === "tl" ? `M 0 ${size} L 0 0 L ${size} 0`
      : position === "tr" ? `M ${size} ${size} L ${size} 0 L 0 0`
        : position === "bl" ? `M 0 0 L 0 ${size} L ${size} ${size}`
          : `M ${size} 0 L ${size} ${size} L 0 ${size}`;
  const styleByPos: Record<typeof position, React.CSSProperties> = {
    tl: { top: 12, left: 12 },
    tr: { top: 12, right: 12 },
    bl: { bottom: 12, left: 12 },
    br: { bottom: 12, right: 12 },
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      style={{ position: "absolute", pointerEvents: "none", color, opacity: 0.85, ...styleByPos[position] }}
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="square" />
    </svg>
  );
}

function Ornament({ color, size = 36 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <g fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round">
        <path d="M24 4 L24 44" />
        <path d="M4 24 L44 24" />
        <path d="M10 10 L38 38" opacity="0.55" />
        <path d="M38 10 L10 38" opacity="0.55" />
        <circle cx="24" cy="24" r="6" />
        <circle cx="24" cy="24" r="1.6" fill={color} />
      </g>
    </svg>
  );
}

function HairlineRule({ color, flex = false }: { color: string; flex?: boolean }) {
  return <span aria-hidden style={{ height: 1, background: color, flex: flex ? 1 : undefined, width: flex ? undefined : 28, display: "inline-block" }} />;
}

// ── scroll progress hook ────────────────────────────────────────────────

function useScrollProgress(): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      setP(total > 0 ? Math.max(0, Math.min(1, window.scrollY / total)) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return p;
}

interface Props {
  props: ProductLaunchBlockProps;
}

export function BlockProductLaunch({ props }: Props) {
  const prefersDark = usePrefersDark();
  const mode: "light" | "dark" =
    props.colorScheme === "auto" ? (prefersDark ? "dark" : "light") : props.colorScheme;
  const theme = useMemo(
    () => resolveTheme(mode, mode === "light" ? props.lightTheme : props.darkTheme),
    [mode, props.lightTheme, props.darkTheme],
  );

  useBlockFonts(
    props.lightTheme?.displayFontFamily,
    props.lightTheme?.bodyFontFamily,
    props.darkTheme?.displayFontFamily,
    props.darkTheme?.bodyFontFamily,
  );

  const displayFont = theme.displayFontFamily
    ? `'${theme.displayFontFamily}', system-ui, -apple-system, sans-serif`
    : "system-ui, -apple-system, 'SF Pro Display', sans-serif";
  const bodyFont = theme.bodyFontFamily
    ? `'${theme.bodyFontFamily}', system-ui, -apple-system, sans-serif`
    : "system-ui, -apple-system, 'SF Pro Text', sans-serif";

  const [activeChapter, setActiveChapter] = useState<string>(props.navChapters[0]?.id ?? "");
  const progress = useScrollProgress();

  useEffect(() => {
    const handleScroll = () => {
      let current = props.navChapters[0]?.id ?? "";
      for (const c of props.navChapters) {
        const el = document.getElementById(c.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 100) current = c.id;
        }
      }
      setActiveChapter(current);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [props.navChapters]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const navBg = mode === "light" ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.72)";
  const onAccent = "#FFFFFF";

  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const issueLabel = useMemo(() => {
    const d = new Date();
    return `${d.toLocaleString("en", { month: "short" }).toUpperCase()} ${d.getFullYear()}`;
  }, []);

  // Per-tile colour tinting helper for backgrounds + glows.
  const slabTint = (c: string | undefined, alpha = 0.12) =>
    c ? `color-mix(in srgb, ${c} ${alpha * 100}%, transparent)` : `color-mix(in srgb, ${theme.accent} ${alpha * 100}%, transparent)`;

  return (
    <div style={{ fontFamily: bodyFont, background: theme.bg, color: theme.fg, minHeight: "100vh" }}>
      <style>{`
        @keyframes lppl-shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        @keyframes lppl-pulse-dot { 0%, 100% { opacity: 0.4 } 50% { opacity: 1 } }
        .lppl-row:hover { background: color-mix(in srgb, currentColor 4%, transparent); }
      `}</style>

      {/* ── Sticky nav ── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: navBg,
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 24px",
            fontSize: "12px",
            fontWeight: 600,
            gap: "12px",
            maxWidth: "1280px",
            margin: "0 auto",
          }}
        >
          {/* Brand cluster — monogram + name + version chip */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <span
              aria-hidden
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: `linear-gradient(135deg, ${theme.accent} 0%, color-mix(in srgb, ${theme.accent} 50%, #000) 100%)`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontFamily: displayFont,
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: "0.02em",
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px -1px color-mix(in srgb, ${theme.accent} 35%, transparent)`,
              }}
            >
              {(props.productName?.trim()?.[0] ?? "·").toUpperCase()}
            </span>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 700,
                fontFamily: displayFont,
                letterSpacing: "-0.012em",
                color: theme.fg,
                whiteSpace: "nowrap",
              }}
            >
              {props.productName}
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 8px",
                borderRadius: 999,
                background: `color-mix(in srgb, ${theme.accent} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${theme.accent} 28%, transparent)`,
                color: theme.accent,
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: theme.accent,
                  boxShadow: `0 0 6px ${theme.accent}`,
                  animation: "lppl-pulse-dot 1.8s ease-in-out infinite",
                }}
              />
              Now shipping
            </span>
          </div>

          {/* Chapter nav */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {props.navChapters.map((c) => {
              const active = activeChapter === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => scrollTo(c.id)}
                  style={{
                    position: "relative",
                    background: active ? `color-mix(in srgb, ${theme.fg} 6%, transparent)` : "transparent",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    color: active ? theme.fg : theme.muted,
                    textTransform: "uppercase",
                    fontSize: "10.5px",
                    letterSpacing: "0.14em",
                    fontWeight: 700,
                    transition: "color 0.2s, background 0.2s",
                  }}
                >
                  {c.label}
                  {active && (
                    <motion.span
                      layoutId="lppl-nav-active"
                      style={{
                        position: "absolute",
                        left: 10,
                        right: 10,
                        bottom: -1,
                        height: 2,
                        background: theme.accent,
                        borderRadius: 1,
                      }}
                    />
                  )}
                </button>
              );
            })}
            {props.navCtaText && (
              <a
                href={props.navCtaUrl || "#"}
                style={{
                  position: "relative",
                  background: theme.accent,
                  color: onAccent,
                  padding: "7px 14px",
                  borderRadius: 999,
                  fontSize: "11px",
                  fontWeight: 700,
                  textDecoration: "none",
                  letterSpacing: "0.04em",
                  marginLeft: 4,
                  overflow: "hidden",
                  boxShadow: `0 4px 12px -3px color-mix(in srgb, ${theme.accent} 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.3)`,
                }}
              >
                <span style={{ position: "relative", zIndex: 1 }}>{props.navCtaText}</span>
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)",
                    backgroundSize: "200% 100%",
                    animation: "lppl-shimmer 3s linear infinite",
                    mixBlendMode: "overlay",
                  }}
                />
              </a>
            )}
          </div>
        </div>
        {/* Scroll progress */}
        <div style={{ height: 2, background: "transparent", position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${progress * 100}%`,
              background: `linear-gradient(90deg, ${theme.accent}, color-mix(in srgb, ${theme.accent} 60%, #FFFFFF))`,
              boxShadow: `0 0 8px ${theme.accent}`,
              transition: "width 80ms linear",
            }}
          />
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        id="hero"
        style={{
          position: "relative",
          minHeight: "96vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "100px 24px 60px",
          overflow: "hidden",
        }}
      >
        {/* Aurora glow behind the hero */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "8%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(900px, 90%)",
            height: 520,
            borderRadius: "50%",
            background: `radial-gradient(circle, color-mix(in srgb, ${theme.accent} 22%, transparent) 0%, transparent 65%)`,
            filter: "blur(10px)",
            pointerEvents: "none",
          }}
        />

        {/* Chapter numeral on the side */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 110,
            right: "max(2rem, 6vw)",
            fontFamily: displayFont,
            fontStyle: "italic",
            fontSize: "clamp(72px, 12vw, 160px)",
            color: theme.muted,
            opacity: 0.18,
            fontWeight: 500,
            letterSpacing: "-0.06em",
            lineHeight: 1,
            pointerEvents: "none",
          }}
        >
          01
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          style={{ maxWidth: 880, position: "relative" }}
        >
          {/* Launch chip */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 999,
                background: `color-mix(in srgb, ${theme.accent} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${theme.accent} 24%, transparent)`,
                color: theme.accent,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: theme.accent,
                  boxShadow: `0 0 8px ${theme.accent}`,
                  animation: "lppl-pulse-dot 1.8s ease-in-out infinite",
                }}
              />
              {props.heroEyebrow || "Keynote · 2026"}
            </span>
          </div>

          <h1
            style={{
              fontFamily: displayFont,
              fontSize: "clamp(56px, 10.5vw, 132px)",
              fontWeight: 700,
              letterSpacing: "-0.045em",
              lineHeight: 0.98,
              marginBottom: "24px",
              backgroundImage: `linear-gradient(180deg, ${theme.fg} 0%, color-mix(in srgb, ${theme.fg} 70%, ${theme.accent}) 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            {props.heroTitle}
          </h1>
          <p
            style={{
              fontSize: "clamp(20px, 3.6vw, 30px)",
              color: theme.muted,
              fontWeight: 500,
              letterSpacing: "-0.018em",
              lineHeight: 1.3,
              marginBottom: "36px",
              maxWidth: "640px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {props.heroTagline}
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            {props.heroPrimaryCtaText && (
              <a
                href={props.heroPrimaryCtaUrl || "#"}
                style={{
                  position: "relative",
                  background: `linear-gradient(180deg, color-mix(in srgb, ${theme.accent} 88%, #FFFFFF) 0%, ${theme.accent} 100%)`,
                  color: onAccent,
                  border: `1px solid color-mix(in srgb, ${theme.accent} 80%, white 20%)`,
                  borderRadius: 999,
                  padding: "12px 26px",
                  fontSize: "15px",
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  overflow: "hidden",
                  boxShadow: `0 12px 30px -8px color-mix(in srgb, ${theme.accent} 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.35)`,
                  letterSpacing: "-0.005em",
                }}
              >
                <span style={{ position: "relative", zIndex: 1 }}>{props.heroPrimaryCtaText}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ position: "relative", zIndex: 1 }}>
                  <path d="M5 12h14" />
                  <path d="M13 5l7 7-7 7" />
                </svg>
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)",
                    backgroundSize: "200% 100%",
                    animation: "lppl-shimmer 3s linear infinite",
                    mixBlendMode: "overlay",
                  }}
                />
              </a>
            )}
            {props.heroSecondaryCtaText && (
              <a
                href={props.heroSecondaryCtaUrl || "#"}
                style={{
                  background: "transparent",
                  color: theme.fg,
                  border: `1px solid ${theme.border}`,
                  padding: "12px 22px",
                  borderRadius: 999,
                  fontSize: "15px",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  letterSpacing: "-0.005em",
                }}
              >
                {props.heroSecondaryCtaText}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </a>
            )}
          </div>

          {/* Hero stat strip */}
          <div
            style={{
              marginTop: 28,
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 14px",
              borderRadius: 999,
              background: `color-mix(in srgb, ${theme.fg} 4%, transparent)`,
              border: `1px solid ${theme.border}`,
              fontSize: 11.5,
              color: theme.muted,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4M8 3v4M3 11h18" />
            </svg>
            <span>Available {issueLabel}</span>
            <span style={{ width: 3, height: 3, borderRadius: 999, background: theme.border }} />
            <span>Ships worldwide</span>
            <span style={{ width: 3, height: 3, borderRadius: 999, background: theme.border }} />
            <span>Free 30-day trial</span>
          </div>
        </motion.div>

        {/* Bezelled video frame */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.25 }}
          style={{
            position: "relative",
            marginTop: 56,
            width: "100%",
            maxWidth: 1060,
            aspectRatio: "16 / 9",
            borderRadius: 28,
            padding: 8,
            background:
              mode === "light"
                ? `linear-gradient(180deg, #FFFFFF 0%, #D8D8DC 100%)`
                : `linear-gradient(180deg, #2A2A2D 0%, #0A0A0B 100%)`,
            border: `1px solid ${theme.border}`,
            boxShadow:
              mode === "light"
                ? `0 50px 100px -30px rgba(0,0,0,0.18), 0 18px 40px -10px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)`
                : `0 50px 100px -30px rgba(0,0,0,0.7), 0 18px 40px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)`,
          }}
        >
          {/* inner screen */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              borderRadius: 22,
              overflow: "hidden",
              background:
                mode === "light"
                  ? "linear-gradient(145deg, #F5F5F7, #E8E8ED)"
                  : "linear-gradient(145deg, #1A1A1D, #0A0A0B)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {props.heroVideoUrl ? (
              <video
                src={props.heroVideoUrl}
                poster={props.heroPosterUrl || undefined}
                autoPlay
                muted
                loop
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : props.heroPosterUrl ? (
              <img
                src={props.heroPosterUrl}
                alt={props.heroTitle}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "60%",
                  height: "60%",
                  background: `radial-gradient(circle, color-mix(in srgb, ${theme.accent} 30%, transparent) 0%, transparent 70%)`,
                  filter: "blur(40px)",
                  borderRadius: "50%",
                }}
              />
            )}
            {/* Glass top reflection */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 40,
                background: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)",
                pointerEvents: "none",
              }}
            />
            <CornerNotch color="rgba(255,255,255,0.4)" position="tl" size={20} />
            <CornerNotch color="rgba(255,255,255,0.4)" position="tr" size={20} />
            <CornerNotch color="rgba(255,255,255,0.4)" position="bl" size={20} />
            <CornerNotch color="rgba(255,255,255,0.4)" position="br" size={20} />

            {/* Now-playing chip */}
            <div
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(0,0,0,0.55)",
                color: "#FFFFFF",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 700,
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: 999, background: "#FF5555", boxShadow: "0 0 6px #FF5555", animation: "lppl-pulse-dot 1.4s ease-in-out infinite" }} />
              Keynote · Now playing
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Section divider ornament ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", maxWidth: 1200, margin: "0 auto", padding: "20px 24px 40px" }}>
        <HairlineRule color={theme.border} flex />
        <Ornament color={theme.accent} />
        <HairlineRule color={theme.border} flex />
      </div>

      {/* ── Feature slabs ── */}
      <section style={{ padding: "20px 24px 40px" }}>
        {props.slabs.map((slab, i) => {
          const chapterNo = String(i + 2).padStart(2, "0");
          const accent = slab.accentColor || theme.accent;
          return (
            <motion.div
              key={slab.id || i}
              id={slab.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.85 }}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: slab.reverse ? "row-reverse" : "row",
                gap: "80px",
                alignItems: "center",
                maxWidth: 1200,
                margin: "0 auto 140px",
                flexWrap: "wrap",
                scrollMarginTop: "100px",
              }}
            >
              {/* huge chapter numeral as background mark */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: -36,
                  [slab.reverse ? "left" : "right"]: -8,
                  fontFamily: displayFont,
                  fontStyle: "italic",
                  fontSize: "clamp(120px, 18vw, 280px)",
                  color: theme.muted,
                  opacity: 0.10,
                  fontWeight: 500,
                  lineHeight: 1,
                  letterSpacing: "-0.06em",
                  pointerEvents: "none",
                }}
              >
                {chapterNo}
              </div>

              <div style={{ flex: "1 1 420px", position: "relative" }}>
                {/* Chapter eyebrow with ornament */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 11px",
                      borderRadius: 999,
                      background: slabTint(accent, 0.10),
                      border: `1px solid ${slabTint(accent, 0.28)}`,
                      color: accent,
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: 999, background: accent, boxShadow: `0 0 6px ${accent}` }} />
                    Chapter {chapterNo}
                  </span>
                  {slab.eyebrow && (
                    <span
                      style={{
                        color: theme.muted,
                        fontSize: 11,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        fontWeight: 700,
                      }}
                    >
                      {slab.eyebrow}
                    </span>
                  )}
                </div>

                <h2
                  style={{
                    fontFamily: displayFont,
                    fontSize: "clamp(38px, 5.4vw, 64px)",
                    fontWeight: 700,
                    letterSpacing: "-0.034em",
                    lineHeight: 1.05,
                    marginBottom: "20px",
                  }}
                >
                  {slab.title}
                </h2>
                <p
                  style={{
                    fontSize: "19px",
                    color: theme.muted,
                    lineHeight: 1.55,
                    fontWeight: 500,
                    marginBottom: "28px",
                    maxWidth: 520,
                  }}
                >
                  {slab.body}
                </p>
                {slab.bullets.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    {slab.bullets.map((b, j) => (
                      <li
                        key={j}
                        style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15.5, fontWeight: 500 }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            background: slabTint(accent, 0.15),
                            border: `1px solid ${slabTint(accent, 0.32)}`,
                            color: accent,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12.5L10 17.5L20 7.5" />
                          </svg>
                        </span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Mini KPI strip — uses slab.kpis when set, falls back to
                 *  a cycled preset so the strip never reads empty for pages
                 *  that haven't been migrated to the new field yet. */}
                {(() => {
                  const fallback = [
                    { value: ["2×", "3.4×", "5×"][i % 3], label: "Faster than before" },
                    { value: ["96%", "99%", "100%"][i % 3], label: "First-try accuracy" },
                    { value: ["18 mo", "24 mo", "12 mo"][i % 3], label: "Warranty included" },
                  ];
                  const kpis = (slab.kpis && slab.kpis.length > 0) ? slab.kpis : fallback;
                  if (kpis.length === 0) return null;
                  return (
                    <div
                      style={{
                        marginTop: 32,
                        display: "flex",
                        gap: 0,
                        alignItems: "stretch",
                        background: `color-mix(in srgb, ${theme.fg} 3%, transparent)`,
                        border: `1px solid ${theme.border}`,
                        borderRadius: 12,
                        padding: "12px 0",
                        maxWidth: 560,
                      }}
                    >
                      {kpis.map((m, idx) => (
                        <div
                          key={`${m.label}-${idx}`}
                          style={{
                            flex: 1,
                            textAlign: "center",
                            padding: "0 12px",
                            borderLeft: idx === 0 ? "none" : `1px solid ${theme.border}`,
                          }}
                        >
                          <div
                            style={{
                              fontFamily: displayFont,
                              fontSize: 22,
                              fontWeight: 700,
                              letterSpacing: "-0.022em",
                              color: accent,
                              lineHeight: 1.05,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {m.value}
                          </div>
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 10.5,
                              letterSpacing: "0.16em",
                              textTransform: "uppercase",
                              color: theme.muted,
                              fontWeight: 700,
                            }}
                          >
                            {m.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div
                style={{
                  position: "relative",
                  flex: "1 1 420px",
                  height: 520,
                  borderRadius: 28,
                  background: theme.panelBg,
                  border: `1px solid ${theme.border}`,
                  overflow: "hidden",
                  boxShadow:
                    mode === "light"
                      ? `0 30px 80px -30px rgba(0,0,0,0.18), 0 6px 18px -8px color-mix(in srgb, ${accent} 30%, transparent)`
                      : `0 30px 80px -30px rgba(0,0,0,0.7), 0 6px 18px -8px color-mix(in srgb, ${accent} 35%, transparent)`,
                }}
              >
                {/* Accent halo */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: "-20%",
                    right: "-20%",
                    width: "80%",
                    height: "80%",
                    background: accent,
                    opacity: 0.18,
                    filter: "blur(80px)",
                    borderRadius: "50%",
                    pointerEvents: "none",
                  }}
                />
                {slab.imageUrl ? (
                  <img
                    src={slab.imageUrl}
                    alt={slab.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : null}

                <CornerNotch color={`color-mix(in srgb, ${accent} 70%, white 30%)`} position="tl" />
                <CornerNotch color={`color-mix(in srgb, ${accent} 70%, white 30%)`} position="tr" />
                <CornerNotch color={`color-mix(in srgb, ${accent} 70%, white 30%)`} position="bl" />
                <CornerNotch color={`color-mix(in srgb, ${accent} 70%, white 30%)`} position="br" />

                {/* Floating annotation chip */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 16,
                    left: 16,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: mode === "light" ? "rgba(255,255,255,0.92)" : "rgba(20,20,22,0.85)",
                    color: theme.fg,
                    border: `1px solid ${theme.border}`,
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "-0.005em",
                    boxShadow: "0 4px 14px -2px rgba(0,0,0,0.18)",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 60%, #000) 100%)`,
                      color: "#FFFFFF",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 8,
                      fontWeight: 800,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
                    }}
                  >
                    ✦
                  </span>
                  Featured · Ch. {chapterNo}
                </div>
              </div>
            </motion.div>
          );
        })}
      </section>

      {/* ── Specs ── */}
      {props.specsRows.length > 0 && (
        <section
          id="specs"
          style={{
            padding: "120px 24px",
            background: theme.panelBg,
            scrollMarginTop: 100,
            borderTop: `1px solid ${theme.border}`,
            borderBottom: `1px solid ${theme.border}`,
            position: "relative",
          }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <HairlineRule color={theme.border} />
                <span
                  style={{
                    color: theme.accent,
                    fontSize: 10.5,
                    letterSpacing: "0.32em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Compare every model
                </span>
                <HairlineRule color={theme.border} />
              </div>
              <h2
                style={{
                  fontFamily: displayFont,
                  fontSize: "clamp(38px, 5vw, 56px)",
                  fontWeight: 700,
                  letterSpacing: "-0.032em",
                  lineHeight: 1.05,
                }}
              >
                {props.specsHeadline}
              </h2>
            </div>

            <div
              style={{
                position: "relative",
                borderRadius: 16,
                border: `1px solid ${theme.border}`,
                background: theme.bg,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `1.5fr repeat(${props.specsColumns.length}, 1fr)`,
                  background: `color-mix(in srgb, ${theme.fg} 3%, transparent)`,
                  borderBottom: `1px solid ${theme.border}`,
                  padding: "16px 24px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: theme.muted,
                  position: "sticky",
                  top: 60,
                  zIndex: 5,
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                }}
              >
                <div>Specification</div>
                {props.specsColumns.map((c, i) => {
                  // featuredColumnIndex is editor-controlled. When unset, the
                  // last column wins so existing pages still get the badge.
                  const rawFeatured = typeof props.featuredColumnIndex === "number"
                    ? props.featuredColumnIndex
                    : props.specsColumns.length - 1;
                  const featured = Math.max(-1, Math.min(props.specsColumns.length - 1, rawFeatured));
                  const winner = i === featured;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        aria-hidden
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          background: winner
                            ? `linear-gradient(135deg, ${theme.accent} 0%, color-mix(in srgb, ${theme.accent} 55%, #000) 100%)`
                            : `color-mix(in srgb, ${theme.fg} 10%, transparent)`,
                          color: winner ? "#FFFFFF" : theme.muted,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: displayFont,
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: "0.02em",
                          boxShadow: winner ? "inset 0 1px 0 rgba(255,255,255,0.3)" : "none",
                        }}
                      >
                        {(c?.trim()?.[0] ?? "·").toUpperCase()}
                      </span>
                      <span style={{ color: winner ? theme.fg : theme.muted, fontWeight: 700 }}>{c}</span>
                      {winner && (
                        <span
                          style={{
                            marginLeft: 4,
                            fontSize: 9,
                            letterSpacing: "0.18em",
                            color: theme.accent,
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}
                        >
                          ★ New
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {props.specsRows.map((row, i) => (
                <div
                  key={i}
                  className="lppl-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `1.5fr repeat(${props.specsColumns.length}, 1fr)`,
                    borderBottom: i === props.specsRows.length - 1 ? "none" : `1px solid ${theme.border}`,
                    padding: "16px 24px",
                    fontSize: 14.5,
                    color: theme.muted,
                    fontWeight: 500,
                    transition: "background 200ms ease",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      color: theme.fg,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 10,
                        color: theme.muted,
                        opacity: 0.6,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {row.label}
                  </div>
                  {row.values.map((v, j) => {
                    const rawFeatured = typeof props.featuredColumnIndex === "number"
                      ? props.featuredColumnIndex
                      : row.values.length - 1;
                    const featuredCol = Math.max(-1, Math.min(row.values.length - 1, rawFeatured));
                    const isFeatured = j === featuredCol;
                    const isBool = /^(yes|no|✓|✗|—|-|\bn\/a\b)$/i.test(v.trim());
                    const isYes = isBool && /^(yes|✓)$/i.test(v.trim());
                    return (
                      <div
                        key={j}
                        style={{
                          color: isFeatured ? theme.fg : theme.muted,
                          fontWeight: isFeatured ? 600 : 500,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {isBool ? (
                          isYes ? (
                            <span style={{ color: isFeatured ? theme.accent : theme.muted, display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M5 12.5L10 17.5L20 7.5" />
                              </svg>
                            </span>
                          ) : (
                            <span style={{ color: theme.muted, opacity: 0.6 }}>—</span>
                          )
                        ) : (
                          <span>{v}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, fontSize: 11.5, color: theme.muted, textAlign: "center", letterSpacing: "0.04em" }}>
              All specifications subject to refinement before general availability.
            </div>
          </div>
        </section>
      )}

      {/* ── Plans ── */}
      {props.plans.length > 0 && (
        <section id="plans" style={{ padding: "120px 24px", scrollMarginTop: 100, position: "relative", overflow: "hidden" }}>
          {/* Background aurora behind plans */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "20%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 720,
              height: 720,
              borderRadius: "50%",
              background: `radial-gradient(circle, color-mix(in srgb, ${theme.accent} 12%, transparent) 0%, transparent 65%)`,
              filter: "blur(8px)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              {props.plansHeadline && (
                <h2
                  style={{
                    fontFamily: displayFont,
                    fontSize: "clamp(38px, 5vw, 56px)",
                    fontWeight: 700,
                    letterSpacing: "-0.032em",
                    marginBottom: 24,
                  }}
                >
                  {props.plansHeadline}
                </h2>
              )}

              {/* Billing toggle */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: 4,
                  borderRadius: 999,
                  background: theme.panelBg,
                  border: `1px solid ${theme.border}`,
                }}
              >
                {(["monthly", "annual"] as const).map((b) => {
                  const active = billing === b;
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBilling(b)}
                      style={{
                        position: "relative",
                        padding: "8px 18px",
                        borderRadius: 999,
                        background: active ? theme.fg : "transparent",
                        color: active ? theme.bg : theme.muted,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12.5,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "capitalize",
                      }}
                    >
                      {b}
                      {b === "annual" && (
                        <span
                          style={{
                            marginLeft: 8,
                            display: "inline-block",
                            padding: "2px 6px",
                            borderRadius: 999,
                            background: active ? `color-mix(in srgb, ${theme.bg} 22%, ${theme.accent})` : `color-mix(in srgb, ${theme.accent} 14%, transparent)`,
                            color: active ? theme.bg : theme.accent,
                            fontSize: 9.5,
                            letterSpacing: "0.18em",
                            textTransform: "uppercase",
                            fontWeight: 700,
                          }}
                        >
                          Save 20%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 20,
                alignItems: "stretch",
              }}
            >
              {props.plans.map((plan, i) => {
                const isAnnual = billing === "annual";
                const isHighlight = !!plan.highlight;
                return (
                  <div
                    key={i}
                    style={{
                      position: "relative",
                      padding: "36px 32px",
                      borderRadius: 24,
                      border: isHighlight ? `2px solid ${theme.accent}` : `1px solid ${theme.border}`,
                      background: isHighlight ? theme.bg : theme.panelBg,
                      transform: isHighlight ? "scale(1.03)" : "scale(1)",
                      boxShadow: isHighlight
                        ? `0 40px 80px -30px color-mix(in srgb, ${theme.accent} 50%, transparent), 0 12px 26px -10px rgba(0,0,0,0.18), inset 0 1px 0 ${mode === "light" ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.06)"}`
                        : "none",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {isHighlight && (
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          top: -90,
                          right: -60,
                          width: 240,
                          height: 240,
                          borderRadius: "50%",
                          background: `radial-gradient(circle, color-mix(in srgb, ${theme.accent} 45%, transparent) 0%, transparent 70%)`,
                          filter: "blur(8px)",
                          pointerEvents: "none",
                        }}
                      />
                    )}

                    {isHighlight && (
                      <div
                        style={{
                          position: "absolute",
                          top: -12,
                          left: "50%",
                          transform: "translateX(-50%)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          background: `linear-gradient(180deg, color-mix(in srgb, ${theme.accent} 88%, #FFFFFF) 0%, ${theme.accent} 100%)`,
                          color: "#FFFFFF",
                          padding: "4px 12px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.18em",
                          boxShadow: `0 6px 14px -3px color-mix(in srgb, ${theme.accent} 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.35)`,
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M12 2l2.7 6.7L22 9.6l-5.4 4.7L18 22l-6-3.5L6 22l1.4-7.7L2 9.6l7.3-.9z" />
                        </svg>
                        Most popular
                      </div>
                    )}

                    <div style={{ position: "relative" }}>
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.24em",
                          textTransform: "uppercase",
                          color: theme.muted,
                          fontWeight: 700,
                          marginBottom: 10,
                        }}
                      >
                        {plan.name}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: displayFont,
                            fontSize: 48,
                            fontWeight: 700,
                            letterSpacing: "-0.034em",
                            color: theme.fg,
                            lineHeight: 1,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {plan.price}
                        </span>
                        <span style={{ fontSize: 13.5, color: theme.muted, fontWeight: 500 }}>
                          {/[a-zA-Z$]/.test(plan.price) ? (isAnnual ? "/yr" : "/mo") : ""}
                        </span>
                      </div>
                      <div
                        style={{
                          marginBottom: 26,
                          fontSize: 11,
                          color: theme.muted,
                        }}
                      >
                        {isAnnual ? "billed annually" : "billed monthly"}
                      </div>

                      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {plan.features.map((f, j) => (
                          <li
                            key={j}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 10,
                              color: theme.fg,
                              fontSize: 14.5,
                              fontWeight: 500,
                              lineHeight: 1.5,
                            }}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={isHighlight ? theme.accent : theme.muted}
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ marginTop: 4, flexShrink: 0 }}
                              aria-hidden
                            >
                              <path d="M5 12.5L10 17.5L20 7.5" />
                            </svg>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>

                      <a
                        href={plan.ctaUrl || "#"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          width: "100%",
                          padding: "12px",
                          borderRadius: 999,
                          background: isHighlight
                            ? `linear-gradient(180deg, color-mix(in srgb, ${theme.accent} 88%, #FFFFFF) 0%, ${theme.accent} 100%)`
                            : theme.fg,
                          color: isHighlight ? "#FFFFFF" : theme.bg,
                          fontSize: 14.5,
                          fontWeight: 700,
                          textDecoration: "none",
                          letterSpacing: "-0.005em",
                          border: isHighlight ? `1px solid color-mix(in srgb, ${theme.accent} 80%, white 30%)` : "none",
                          boxShadow: isHighlight
                            ? `0 10px 26px -8px color-mix(in srgb, ${theme.accent} 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.35)`
                            : "inset 0 1px 0 rgba(255,255,255,0.12)",
                        }}
                      >
                        {plan.ctaText}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M5 12h14" />
                          <path d="M13 5l7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 24, textAlign: "center", fontSize: 12, color: theme.muted, letterSpacing: "0.04em" }}>
              ✓ Free 30-day trial · No card required · Cancel any time
            </div>
          </div>
        </section>
      )}

      {/* ── Closing CTA ── */}
      <section
        id="order"
        style={{
          position: "relative",
          padding: "120px 24px 100px",
          background: theme.panelBg,
          textAlign: "center",
          scrollMarginTop: 100,
          borderTop: `1px solid ${theme.border}`,
          overflow: "hidden",
        }}
      >
        {/* Aurora */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -120,
            left: "50%",
            transform: "translateX(-50%)",
            width: 720,
            height: 480,
            borderRadius: "50%",
            background: `radial-gradient(circle, color-mix(in srgb, ${theme.accent} 16%, transparent) 0%, transparent 65%)`,
            filter: "blur(8px)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 28, display: "flex", justifyContent: "center" }}>
            <Ornament color={theme.accent} size={42} />
          </div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: theme.muted,
              fontWeight: 700,
              marginBottom: 18,
            }}
          >
            The release · Available {issueLabel}
          </div>
          <h2
            style={{
              fontFamily: displayFont,
              fontSize: "clamp(44px, 8vw, 88px)",
              fontWeight: 700,
              letterSpacing: "-0.046em",
              lineHeight: 0.96,
              marginBottom: 18,
            }}
          >
            {props.ctaHeadline}
          </h2>
          {props.ctaSubtitle && (
            <p
              style={{
                fontSize: 19,
                color: theme.muted,
                fontWeight: 500,
                marginBottom: 32,
                lineHeight: 1.4,
                maxWidth: 540,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {props.ctaSubtitle}
            </p>
          )}
          {props.ctaButtonText && (
            <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12 }}>
              <a
                href={props.ctaButtonUrl || "#"}
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: `linear-gradient(180deg, color-mix(in srgb, ${theme.accent} 88%, #FFFFFF) 0%, ${theme.accent} 100%)`,
                  color: "#FFFFFF",
                  borderRadius: 999,
                  padding: "14px 28px",
                  fontSize: 16,
                  fontWeight: 700,
                  textDecoration: "none",
                  border: `1px solid color-mix(in srgb, ${theme.accent} 80%, white 30%)`,
                  letterSpacing: "-0.005em",
                  overflow: "hidden",
                  boxShadow: `0 14px 32px -8px color-mix(in srgb, ${theme.accent} 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.35)`,
                }}
              >
                <span style={{ position: "relative", zIndex: 1 }}>{props.ctaButtonText}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ position: "relative", zIndex: 1 }}>
                  <path d="M5 12h14" />
                  <path d="M13 5l7 7-7 7" />
                </svg>
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)",
                    backgroundSize: "200% 100%",
                    animation: "lppl-shimmer 3s linear infinite",
                    mixBlendMode: "overlay",
                  }}
                />
              </a>
              <a
                href="#specs"
                onClick={(e) => { e.preventDefault(); scrollTo("specs"); }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "14px 20px",
                  borderRadius: 999,
                  border: `1px solid ${theme.border}`,
                  color: theme.fg,
                  fontSize: 16,
                  fontWeight: 600,
                  textDecoration: "none",
                  background: theme.bg,
                  letterSpacing: "-0.005em",
                }}
              >
                Compare models
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </a>
            </div>
          )}

          {/* Shipping ribbon */}
          <div
            style={{
              marginTop: 40,
              display: "inline-flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
              fontSize: 11.5,
              color: theme.muted,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            {[
              { icon: "M3 7h18M3 12h18M3 17h18", label: "Free shipping over $99" },
              { icon: "M20 7l-8 5-8-5", label: "Order tracking included" },
              { icon: "M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z M3 12h18 M12 3a9 9 0 0 1 0 18 M12 3a9 9 0 0 0 0 18", label: "Worldwide returns within 30 days" },
              { icon: "M5 12.5L10 17.5L20 7.5", label: "Carbon-neutral packaging" },
            ].map((m) => (
              <span key={m.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={m.icon} />
                </svg>
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          padding: "48px 24px 24px",
          borderTop: `1px solid ${theme.border}`,
          background: theme.bg,
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
              gap: 32,
              alignItems: "start",
              flexWrap: "wrap",
              marginBottom: 32,
            }}
          >
            <div style={{ minWidth: 220 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span
                  aria-hidden
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: `linear-gradient(135deg, ${theme.accent} 0%, color-mix(in srgb, ${theme.accent} 50%, #000) 100%)`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontFamily: displayFont,
                    fontWeight: 800,
                    fontSize: 11,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
                  }}
                >
                  {(props.productName?.trim()?.[0] ?? "·").toUpperCase()}
                </span>
                <span style={{ fontFamily: displayFont, fontSize: 16, fontWeight: 700, letterSpacing: "-0.014em" }}>
                  {props.productName}
                </span>
              </div>
              <p style={{ fontSize: 13, color: theme.muted, lineHeight: 1.55, maxWidth: 280 }}>
                {props.footerText}
              </p>
            </div>

            {[
              { title: "Product", links: ["Features", "Specs", "Plans", "Compare"] },
              { title: "Support", links: ["Documentation", "Contact sales", "Status", "Security"] },
              { title: "Company", links: ["About", "Newsroom", "Careers", "Legal"] },
            ].map((s) => (
              <div key={s.title}>
                <div
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: theme.muted,
                    fontWeight: 700,
                    marginBottom: 14,
                  }}
                >
                  {s.title}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {s.links.map((l) => (
                    <li key={l}>
                      <a
                        href="#"
                        style={{
                          color: theme.fg,
                          fontSize: 13.5,
                          textDecoration: "none",
                          letterSpacing: "-0.005em",
                        }}
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            style={{
              borderTop: `1px solid ${theme.border}`,
              paddingTop: 18,
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              fontSize: 11,
              color: theme.muted,
              letterSpacing: "0.04em",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span>© {new Date().getFullYear()} {props.productName}.</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, background: theme.panelBg, border: `1px solid ${theme.border}`, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="5" y="11" width="14" height="9" rx="1.5" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                SOC 2 Type II
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, background: theme.panelBg, border: `1px solid ${theme.border}`, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                GDPR
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "#3FB97A", boxShadow: "0 0 6px #3FB97A" }} />
                All systems normal · 99.99%
              </span>
            </div>
            <span style={{ letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
              v3.0 · {issueLabel}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
