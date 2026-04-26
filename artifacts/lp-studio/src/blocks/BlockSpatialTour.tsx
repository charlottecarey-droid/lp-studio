import { useMemo, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import type { SpatialTourBlockProps, SpatialTourStation } from "@/lib/block-types";
import spatialHeadsetImg from "@assets/image_1777179519607.png";

// ─── Brand palette ──────────────────────────────────────────────
const FOREST = "#003A30";
const FOREST_DEEP = "#00231D";
const KELLY = "#158915";
const MINT = "#C5F1C5";
const CREAM = "#ECEAE6";
const WHITE = "#FFFFFF";
const INK2 = "#5A6862";

// Bagoss Standard + Inter are loaded globally via `index.css` @font-face,
// so no runtime font injection is needed here.
const SERIF = "'Bagoss Standard', 'EB Garamond', Georgia, serif";
const SANS = "'Inter', system-ui, sans-serif";

// ─── Atoms ─────────────────────────────────────────────────────
function Eyebrow({
  children,
  color = KELLY,
  style = {},
}: {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: SANS,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function PrimaryCTA({
  label,
  href,
  dark = false,
  style = {},
}: {
  label: string;
  href?: string;
  dark?: boolean;
  style?: React.CSSProperties;
}) {
  const Tag = href ? "a" : "button";
  return (
    <Tag
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "16px 28px",
        borderRadius: 999,
        border: "none",
        background: dark ? WHITE : KELLY,
        color: dark ? FOREST : WHITE,
        fontFamily: SANS,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        cursor: "pointer",
        textDecoration: "none",
        ...style,
      }}
    >
      {label}
      <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
    </Tag>
  );
}

function SecondaryCTA({
  label,
  href,
  style = {},
}: {
  label: string;
  href?: string;
  style?: React.CSSProperties;
}) {
  const Tag = href ? "a" : "button";
  return (
    <Tag
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "15px 26px",
        borderRadius: 999,
        background: "transparent",
        color: WHITE,
        border: "1px solid rgba(255,255,255,0.40)",
        fontFamily: SANS,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        cursor: "pointer",
        textDecoration: "none",
        ...style,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: MINT,
          color: FOREST,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          paddingLeft: 1,
        }}
      >
        ▶
      </span>
      {label}
    </Tag>
  );
}

function VisionGlyph({
  width = 90,
  color = MINT,
  style = {},
}: {
  width?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 120 56"
      width={width}
      style={{ display: "block", ...style }}
      fill="none"
      stroke={color}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M 8 28 Q 8 10, 32 10 L 88 10 Q 112 10, 112 28 Q 112 46, 88 46 L 32 46 Q 8 46, 8 28 Z" />
      <ellipse cx="36" cy="28" rx="18" ry="11" />
      <ellipse cx="84" cy="28" rx="18" ry="11" />
      <path d="M 54 28 Q 60 23, 66 28" />
      <path d="M 8 28 L 2 26" />
      <path d="M 112 28 L 118 26" />
    </svg>
  );
}

function DotGrid({
  opacity = 0.4,
  color = "rgba(197,241,197,0.10)",
  size = 32,
  style = {},
}: {
  opacity?: number;
  color?: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `radial-gradient(circle at 1px 1px, ${color} 1px, transparent 0)`,
        backgroundSize: `${size}px ${size}px`,
        opacity,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

function Glow({
  size = 700,
  x = -200,
  y = -200,
  opacity = 0.22,
  color = "197,241,197",
  style = {},
}: {
  size?: number;
  x?: number;
  y?: number;
  opacity?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${color},${opacity}) 0%, transparent 65%)`,
        pointerEvents: "none",
        filter: "blur(40px)",
        ...style,
      }}
    />
  );
}

function NumberBadge({
  n,
  size = 44,
  bg = KELLY,
  color = WHITE,
}: {
  n: string;
  size?: number;
  bg?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: SERIF,
        fontSize: size * 0.36,
        letterSpacing: "0.02em",
        flexShrink: 0,
      }}
    >
      {n}
    </div>
  );
}

// ─── Tech-HUD atoms ────────────────────────────────────────────
// Four small "⌐ ⌐ ⌐ ⌐" L-shaped corner brackets that frame a section or an
// image. Renders absolutely-positioned inside its nearest positioned ancestor.
function CornerFrame({
  color = "rgba(197,241,197,0.55)",
  size = 18,
  thickness = 1,
  inset = 14,
  style = {},
}: {
  color?: string;
  size?: number;
  thickness?: number;
  inset?: number | string;
  style?: React.CSSProperties;
}) {
  const w = `${thickness}px solid ${color}`;
  const base: React.CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    pointerEvents: "none",
  };
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset,
        pointerEvents: "none",
        ...style,
      }}
    >
      <div style={{ ...base, top: 0, left: 0, borderTop: w, borderLeft: w }} />
      <div style={{ ...base, top: 0, right: 0, borderTop: w, borderRight: w }} />
      <div style={{ ...base, bottom: 0, left: 0, borderBottom: w, borderLeft: w }} />
      <div style={{ ...base, bottom: 0, right: 0, borderBottom: w, borderRight: w }} />
    </div>
  );
}

// Mono-caps telemetry row: "LAT 42.36° N · LON 71.05° W · ALT — DENTAL LAB · ● LIVE"
function TelemetryStrip({
  items = ["LAT 42.36° N", "LON 71.05° W", "ALT — DENTAL LAB"],
  liveLabel = "LIVE",
  color = "rgba(255,255,255,0.55)",
  liveColor = MINT,
  style = {},
}: {
  items?: string[];
  liveLabel?: string;
  color?: string;
  liveColor?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, 1fr) auto`,
        alignItems: "center",
        gap: 24,
        fontFamily: SANS,
        fontSize: 10.5,
        letterSpacing: "0.20em",
        textTransform: "uppercase",
        color,
        fontWeight: 500,
        ...style,
      }}
    >
      {items.map((it, i) => (
        <span key={i}>{it}</span>
      ))}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          color: liveColor,
          justifySelf: "end",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: liveColor,
            boxShadow: `0 0 6px ${liveColor}`,
          }}
        />
        {liveLabel}
      </span>
    </div>
  );
}

// Tiny mono-caps file-code line, e.g. "● ID-LP-01 · LANDING / HERO / REV 2026.07"
function FileCode({
  text,
  color = "rgba(197,241,197,0.7)",
  dotColor = MINT,
  showDot = true,
  style = {},
}: {
  text: string;
  color?: string;
  dotColor?: string;
  showDot?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontFamily: SANS,
        fontSize: 10.5,
        letterSpacing: "0.20em",
        textTransform: "uppercase",
        color,
        fontWeight: 500,
        ...style,
      }}
    >
      {showDot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: dotColor,
          }}
        />
      )}
      <span>{text}</span>
    </div>
  );
}

// "[ INSIDE / DANDY ]" style bracket pill — the recurring brand chip
function BracketPill({
  children,
  color = MINT,
  bracketColor,
  size = 11,
  style = {},
}: {
  children: React.ReactNode;
  color?: string;
  bracketColor?: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  const bc = bracketColor ?? color;
  return (
    <span
      style={{
        fontFamily: SANS,
        fontSize: size,
        fontWeight: 600,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color,
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        ...style,
      }}
    >
      <span style={{ color: bc, opacity: 0.85 }}>[</span>
      <span>{children}</span>
      <span style={{ color: bc, opacity: 0.85 }}>]</span>
    </span>
  );
}

// Italic Bagoss span with a soft mint→white gradient — used for emphasis
// words inside dark-section serif headlines (e.g. "dental lab", "End to end.")
function MintEmphasis({
  children,
  italic = true,
  style = {},
}: {
  children: React.ReactNode;
  italic?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        fontStyle: italic ? "italic" : "normal",
        // inline-block + small right padding prevents italic glyphs (e.g. the
        // trailing "b" in "lab") from being clipped by background-clip: text.
        display: "inline-block",
        paddingRight: italic ? "0.12em" : 0,
        backgroundImage: `linear-gradient(180deg, ${WHITE} 0%, ${MINT} 55%, ${MINT} 100%)`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function DandyWordmark({ color = FOREST, height = 22 }: { color?: string; height?: number }) {
  // On the dark spatial-tour chrome we use the white logo; everywhere else
  // (e.g. on a CREAM section) we use the default dark logo.
  const isDarkBg = color === WHITE;
  const src = isDarkBg ? "/dandy-logo-white.svg" : "/dandy-logo.svg";
  return (
    <img
      src={src}
      alt="Dandy"
      style={{ height, width: "auto", display: "block" }}
    />
  );
}

function QRPlaceholder({ size = 84, bg = WHITE, fg = FOREST }: { size?: number; bg?: string; fg?: string }) {
  // Simple static QR-like grid as a visual placeholder
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" style={{ display: "block", background: bg }}>
      {Array.from({ length: 21 * 21 }).map((_, i) => {
        const x = i % 21;
        const y = Math.floor(i / 21);
        // Pseudo-deterministic checker for QR look
        const fill = (x * 7 + y * 13 + ((x ^ y) * 3)) % 5 < 2;
        // Always draw the three position markers
        const inMarker =
          (x < 7 && y < 7) ||
          (x > 13 && y < 7) ||
          (x < 7 && y > 13);
        const isBorder =
          inMarker &&
          ((x === 0 || x === 6 || y === 0 || y === 6) ||
            (x === 14 || x === 20 || y === 14 || y === 20));
        const isCenter =
          (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
          (x >= 16 && x <= 18 && y >= 2 && y <= 4) ||
          (x >= 2 && x <= 4 && y >= 16 && y <= 18);
        if (inMarker) {
          if (isBorder || isCenter) return <rect key={i} x={x} y={y} width={1} height={1} fill={fg} />;
          return null;
        }
        return fill ? <rect key={i} x={x} y={y} width={1} height={1} fill={fg} /> : null;
      })}
    </svg>
  );
}

// ─── Section: Nav ──────────────────────────────────────────────
function Nav({ p }: { p: SpatialTourBlockProps }) {
  return (
    <div
      style={{
        background: FOREST_DEEP,
        color: WHITE,
        padding: "20px 56px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <DandyWordmark color={WHITE} height={20} />
        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.18)" }} />
        <BracketPill color={MINT}>{p.navBrand}</BracketPill>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          fontSize: 13,
          color: "rgba(255,255,255,0.7)",
          fontFamily: SANS,
        }}
      >
        {p.navLinks.map((l) => (
          <a key={l.label} href={l.href} style={{ color: "inherit", textDecoration: "none" }}>
            {l.label}
          </a>
        ))}
        <PrimaryCTA label={p.navCtaText} href={p.navCtaUrl} />
      </div>
    </div>
  );
}

// ─── Section: Hero ─────────────────────────────────────────────
function Hero({ p }: { p: SpatialTourBlockProps }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.4]);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        background: FOREST,
        color: WHITE,
        padding: "120px 56px 140px",
        overflow: "hidden",
        minHeight: 820,
      }}
    >
      {p.heroImageUrl && (
        <motion.img
          src={p.heroImageUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 40%",
            filter: "brightness(0.55) saturate(0.85)",
            y,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(100deg, rgba(0,35,29,0.92) 0%, rgba(0,58,48,0.78) 35%, rgba(0,58,48,0.40) 70%, rgba(0,58,48,0.20) 100%)",
        }}
      />
      <DotGrid opacity={0.6} />
      <Glow size={900} x={-300} y={-200} opacity={0.18} />
      <Glow size={500} x={1080} y={400} opacity={0.1} />

      {/* Tech-HUD frame around the whole hero */}
      <CornerFrame color="rgba(197,241,197,0.45)" size={22} inset={28} />

      {/* Telemetry strip pinned to the top */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 56,
          right: 56,
          zIndex: 2,
        }}
      >
        <TelemetryStrip />
      </div>

      <div
        style={{
          position: "absolute",
          top: 110,
          right: 56,
          padding: "10px 16px",
          background: "rgba(0,0,0,0.40)",
          border: "1px solid rgba(197,241,197,0.40)",
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          gap: 12,
          backdropFilter: "blur(8px)",
          zIndex: 2,
        }}
      >
        <VisionGlyph width={28} color={MINT} />
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: MINT,
          }}
        >
          {p.heroVisionChipText}
        </span>
      </div>

      <motion.div
        style={{ position: "relative", maxWidth: 1180, margin: "0 auto", opacity, paddingTop: 60 }}
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      >
        <FileCode text="FILE / 01 — THE HOOK" style={{ marginBottom: 18 }} />
        <Eyebrow color={MINT} style={{ marginBottom: 28 }}>
          {p.heroEyebrow}
        </Eyebrow>

        <h1
          style={{
            fontFamily: SERIF,
            fontSize: "clamp(56px, 9vw, 124px)",
            lineHeight: 0.92,
            letterSpacing: "-0.045em",
            fontWeight: 400,
            margin: 0,
            color: WHITE,
            maxWidth: 1100,
          }}
        >
          {p.heroHeadlineLine1}
          <br />
          {p.heroHeadlineLine2}
          <br />
          <MintEmphasis italic={p.headlineEmphasisItalic ?? true}>{p.heroHeadlineEmphasis}</MintEmphasis>
          {p.heroHeadlineLine3 && (
            <>
              {" "}
              <br />
              {p.heroHeadlineLine3}
            </>
          )}
        </h1>

        <p
          style={{
            marginTop: 40,
            marginBottom: 0,
            fontSize: 19,
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.82)",
            maxWidth: 540,
            fontFamily: SANS,
          }}
        >
          {p.heroBody}
        </p>

        <div style={{ marginTop: 44, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <PrimaryCTA label={p.heroPrimaryCta} href={p.navCtaUrl} />
          <SecondaryCTA label={p.heroSecondaryCta} />
        </div>
      </motion.div>

      {/* File-code stamp, bottom-left */}
      <div
        style={{
          position: "absolute",
          left: 56,
          bottom: 40,
          zIndex: 2,
        }}
      >
        <FileCode text="ID-LP-01 · LANDING / HERO / REV 2026.07" />
      </div>

      <div
        style={{
          position: "absolute",
          right: 56,
          bottom: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 14,
          opacity: 0.85,
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: MINT,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {p.heroScrollLabel} <span>↓</span>
        </div>
        <div style={{ width: 1, height: 36, background: `linear-gradient(180deg, ${MINT}, transparent)` }} />
      </div>
    </div>
  );
}

// ─── Section: Marquee ──────────────────────────────────────────
function Marquee({ p }: { p: SpatialTourBlockProps }) {
  return (
    <div
      style={{
        background: FOREST_DEEP,
        color: WHITE,
        padding: "36px 56px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        position: "relative",
      }}
    >
      <DotGrid opacity={0.25} />
      <div
        style={{
          position: "relative",
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(p.marqueeItems.length, 1)}, 1fr)`,
          gap: 32,
        }}
      >
        {p.marqueeItems.map((it, i) => (
          <div
            key={i}
            style={{
              borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.10)",
              paddingLeft: i === 0 ? 0 : 28,
              display: "flex",
              alignItems: "baseline",
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 30,
                color: MINT,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              {it.value}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.65)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                fontWeight: 600,
              }}
            >
              {it.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section: Manifesto ────────────────────────────────────────
function Manifesto({ p }: { p: SpatialTourBlockProps }) {
  return (
    <div style={{ background: CREAM, color: FOREST, padding: "140px 56px", position: "relative" }}>
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 80,
          alignItems: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <Eyebrow color={KELLY} style={{ marginBottom: 22 }}>
            {p.manifestoEyebrow}
          </Eyebrow>
          <h2
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(40px, 5vw, 64px)",
              lineHeight: 0.96,
              letterSpacing: "-0.04em",
              fontWeight: 400,
              margin: 0,
              color: FOREST,
            }}
          >
            {p.manifestoHeadlineLine1}
            <br />
            <span style={{ fontStyle: (p.headlineEmphasisItalic ?? true) ? "italic" : "normal", color: KELLY }}>{p.manifestoHeadlineEmphasis}</span>
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: FOREST,
              margin: "32px 0 0",
              maxWidth: 460,
              fontFamily: SANS,
            }}
          >
            {p.manifestoBody1}
          </p>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: INK2,
              margin: "20px 0 0",
              maxWidth: 460,
              fontFamily: SANS,
            }}
          >
            {p.manifestoBody2}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
            position: "relative",
            aspectRatio: "4 / 5",
            overflow: "visible",
            borderRadius: 4,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              overflow: "hidden",
              borderRadius: 4,
              boxShadow: "0 30px 80px rgba(0,58,48,0.25)",
            }}
          >
            {p.manifestoImageUrl && (
              <img
                src={p.manifestoImageUrl}
                alt="Dandy lab facility"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
              />
            )}
            <div
              style={{
                position: "absolute",
                bottom: 20,
                left: 20,
                padding: "10px 14px",
                background: FOREST,
                color: MINT,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: KELLY } } />
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  fontFamily: SANS,
                }}
              >
                {p.manifestoCaption}
              </span>
            </div>
          </div>
          <CornerFrame color="rgba(0,58,48,0.55)" size={16} inset={-10} />
        </motion.div>
      </div>
    </div>
  );
}

// ─── Section: Tour intro + stations ────────────────────────────
function StationCard({ station, flip = false, isLast = false }: { station: SpatialTourStation; flip?: boolean; isLast?: boolean }) {
  return (
    <div
      style={{
        background: flip ? WHITE : CREAM,
        padding: "120px 56px",
        position: "relative",
        borderBottom: isLast ? "none" : "1px solid rgba(0,58,48,0.06)",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 70,
          alignItems: "center",
          direction: flip ? "rtl" : "ltr",
        }}
      >
        <motion.div
          initial={{ opacity: 0, x: flip ? 40 : -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
            direction: "ltr",
            position: "relative",
            aspectRatio: "4 / 3",
            overflow: "visible",
            borderRadius: 4,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              borderRadius: 4,
              boxShadow: "0 24px 60px rgba(0,58,48,0.18)",
            }}
          >
          {station.imageUrl && (
            <img
              src={station.imageUrl}
              alt={`${station.label} — Inside Dandy spatial experience`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: station.objectPosition || "center",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              background: "rgba(0,35,29,0.90)",
              color: WHITE,
              padding: "14px 18px",
              borderRadius: 4,
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(197,241,197,0.30)",
              maxWidth: 240,
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                color: MINT,
                fontWeight: 600,
                marginBottom: 6,
                fontFamily: SANS,
              }}
            >
              In the experience · {station.insetDuration}
            </div>
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.4,
                color: "rgba(255,255,255,0.85)",
                fontFamily: SANS,
              }}
            >
              {station.insetDetail}
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              padding: "6px 10px",
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(197,241,197,0.30)",
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              gap: 8,
              backdropFilter: "blur(6px)",
            }}
          >
            <VisionGlyph width={18} color={MINT} />
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: MINT,
                fontFamily: SANS,
              }}
            >
              Spatial · 1:1 scale
            </span>
          </div>
          </div>
          <CornerFrame color="rgba(0,58,48,0.55)" size={16} inset={-10} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: flip ? -40 : 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
          style={{ direction: "ltr" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22 }}>
            <span
              style={{
                fontFamily: SERIF,
                fontSize: 38,
                lineHeight: 1,
                letterSpacing: "-0.03em",
                color: KELLY,
                display: "inline-flex",
                alignItems: "baseline",
                gap: 4,
              }}
            >
              <span style={{ opacity: 0.55, fontWeight: 400 }}>[</span>
              <span style={{ fontWeight: 400 }}>{station.number}</span>
              <span style={{ opacity: 0.55, fontWeight: 400 }}>]</span>
            </span>
            <div style={{ height: 1, background: "rgba(0,58,48,0.20)", flex: 1 }} />
            <span
              style={{
                fontFamily: SANS,
                fontSize: 10.5,
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                color: KELLY,
                fontWeight: 600,
              }}
            >
              Station / {station.number} of 05
            </span>
          </div>

          <div
            style={{
              fontFamily: SERIF,
              fontSize: 14,
              color: INK2,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            {station.label}
          </div>

          <h3
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(34px, 4vw, 52px)",
              lineHeight: 1.0,
              letterSpacing: "-0.04em",
              fontWeight: 400,
              margin: 0,
              color: FOREST,
            }}
          >
            {station.headline}
          </h3>

          <p
            style={{
              fontSize: 16.5,
              lineHeight: 1.65,
              color: INK2,
              margin: "28px 0 0",
              fontFamily: SANS,
            }}
          >
            {station.body}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function TourIntro({ p }: { p: SpatialTourBlockProps }) {
  return (
    <div
      style={{
        background: FOREST,
        color: WHITE,
        padding: "120px 56px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <DotGrid opacity={0.6} />
      <Glow size={900} x={880} y={-300} opacity={0.2} />
      <div style={{ position: "relative", maxWidth: 1180, margin: "0 auto" }}>
        <Eyebrow color={MINT} style={{ marginBottom: 28 }}>
          {p.tourEyebrow}
        </Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 60, alignItems: "center" }}>
          <h2
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(48px, 7vw, 84px)",
              lineHeight: 0.94,
              letterSpacing: "-0.045em",
              fontWeight: 400,
              margin: 0,
              color: WHITE,
            }}
          >
            {p.tourHeadlineLine1}
            <br />
            <span style={{ fontStyle: (p.headlineEmphasisItalic ?? true) ? "italic" : "normal", color: MINT }}>{p.tourHeadlineEmphasis}</span>
            <br />
            {p.tourHeadlineLine3}
          </h2>
          <div>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: "rgba(255,255,255,0.78)", margin: 0, fontFamily: SANS }}>
              {p.tourBody}
            </p>
            <div
              style={{
                position: "relative",
                marginTop: 32,
                background: "rgba(0,0,0,0.30)",
                border: "1px solid rgba(197,241,197,0.22)",
                borderRadius: 4,
                padding: "18px 22px 22px",
              }}
            >
              <CornerFrame color={MINT} size={12} inset={-6} />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: 12,
                  marginBottom: 10,
                  borderBottom: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <span
                  style={{
                    fontFamily: SANS,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: MINT,
                  }}
                >
                  // MANIFEST
                </span>
                <span
                  style={{
                    fontFamily: SANS,
                    fontSize: 9.5,
                    letterSpacing: "0.20em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  {p.tourStations.length.toString().padStart(2, "0")} STATIONS
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {p.tourStations.map((s, i) => (
                  <div
                    key={s.number}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "26px 1fr auto",
                      alignItems: "center",
                      gap: 14,
                      padding: "10px 0",
                      borderBottom:
                        i === p.tourStations.length - 1
                          ? "none"
                          : "1px solid rgba(255,255,255,0.06)",
                      fontFamily: SANS,
                      fontSize: 12.5,
                      color: "rgba(255,255,255,0.85)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: SERIF,
                        fontSize: 14,
                        color: MINT,
                        letterSpacing: "0.02em",
                      }}
                    >
                      <span style={{ opacity: 0.55 }}>[</span>
                      {s.number}
                      <span style={{ opacity: 0.55 }}>]</span>
                    </span>
                    <span>{s.label}</span>
                    <span
                      style={{
                        fontSize: 10.5,
                        color: "rgba(255,255,255,0.55)",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        fontWeight: 500,
                      }}
                    >
                      T+{s.insetDuration}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Spatial callout ──────────────────────────────────
function SpatialCallout({ p }: { p: SpatialTourBlockProps }) {
  return (
    <div
      style={{
        background: FOREST_DEEP,
        color: WHITE,
        padding: "140px 56px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <DotGrid opacity={0.5} size={28} />
      <Glow size={700} x={-200} y={-100} opacity={0.18} />
      <CornerFrame color="rgba(197,241,197,0.30)" size={20} inset={36} />

      <div style={{ position: "relative", maxWidth: 1180, margin: "0 auto" }}>
        <FileCode text="FILE / 03 — WHY SPATIAL" style={{ marginBottom: 32 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <div
            style={{
              position: "relative",
              aspectRatio: "5 / 4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CornerFrame color="rgba(197,241,197,0.45)" size={14} inset={-8} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(circle at center, rgba(197,241,197,0.18) 0%, transparent 60%)",
              }}
            />
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <img
                src={spatialHeadsetImg}
                alt="Spatial capture headset with 4K per eye, spatial audio, and 1:1 scale capture HUD callouts"
                style={{
                  width: "100%",
                  maxWidth: 560,
                  height: "auto",
                  display: "block",
                  filter: "drop-shadow(0 24px 60px rgba(0,0,0,0.45))",
                }}
              />
            </motion.div>
          </div>

          <div>
            <Eyebrow color={MINT} style={{ marginBottom: 22 }}>
              {p.calloutEyebrow}
            </Eyebrow>
            <h2
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(36px, 4.5vw, 56px)",
                lineHeight: 0.98,
                letterSpacing: "-0.04em",
                fontWeight: 400,
                margin: 0,
                color: WHITE,
              }}
            >
              {p.calloutHeadlineLine1}
              <br />
              {p.calloutHeadlineLine2}
              <br />
              <span style={{ color: MINT, fontStyle: (p.headlineEmphasisItalic ?? true) ? "italic" : "normal" }}>{p.calloutHeadlineEmphasis}</span>
            </h2>
            <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              {p.calloutPoints.map((pt) => (
                <div
                  key={pt.title}
                  style={{
                    padding: 18,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(197,241,197,0.18)",
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      fontFamily: SERIF,
                      fontSize: 17,
                      color: MINT,
                      letterSpacing: "-0.02em",
                      marginBottom: 6,
                    }}
                  >
                    {pt.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "rgba(255,255,255,0.70)",
                      lineHeight: 1.55,
                      fontFamily: SANS,
                    }}
                  >
                    {pt.body}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Four Ways ────────────────────────────────────────
function FourWays({ p }: { p: SpatialTourBlockProps }) {
  return (
    <div style={{ background: WHITE, color: FOREST, padding: "140px 56px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ marginBottom: 60 }}>
          <Eyebrow color={KELLY} style={{ marginBottom: 22 }}>
            {p.waysEyebrow}
          </Eyebrow>
          <h2
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(40px, 5vw, 64px)",
              lineHeight: 0.98,
              letterSpacing: "-0.04em",
              fontWeight: 400,
              margin: 0,
              color: FOREST,
              maxWidth: 780,
            }}
          >
            {p.waysHeadlineLine1}
            <br />
            <span style={{ fontStyle: (p.headlineEmphasisItalic ?? true) ? "italic" : "normal", color: KELLY }}>{p.waysHeadlineEmphasis}</span>
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {p.ways.map((w, i) => (
            <motion.div
              key={w.number}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
              whileHover={{ y: -4, transition: { duration: 0.25 } }}
              style={{
                background: CREAM,
                borderRadius: 6,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                cursor: "pointer",
              }}
            >
              <div style={{ position: "relative", aspectRatio: "16 / 9", overflow: "hidden" }}>
                {w.imageUrl && (
                  <img
                    src={w.imageUrl}
                    alt={w.label}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: w.objectPosition || "center",
                    }}
                  />
                )}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(180deg, rgba(0,58,48,0.0) 50%, rgba(0,58,48,0.55) 100%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 18,
                    left: 18,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <NumberBadge n={w.number} size={36} bg={KELLY} color={WHITE} />
                  <div
                    style={{
                      padding: "6px 10px",
                      background: "rgba(0,35,29,0.8)",
                      borderRadius: 4,
                      fontSize: 9.5,
                      fontWeight: 600,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: MINT,
                      backdropFilter: "blur(6px)",
                      fontFamily: SANS,
                    }}
                  >
                    {w.eyebrow}
                  </div>
                </div>
              </div>
              <div style={{ padding: 32, flex: 1, display: "flex", flexDirection: "column" }}>
                <h3
                  style={{
                    fontFamily: SERIF,
                    fontSize: 30,
                    lineHeight: 1.05,
                    letterSpacing: "-0.03em",
                    fontWeight: 400,
                    margin: 0,
                    color: FOREST,
                  }}
                >
                  {w.label}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: INK2,
                    margin: "14px 0 0",
                    flex: 1,
                    fontFamily: SANS,
                  }}
                >
                  {w.body}
                </p>
                <div
                  style={{
                    marginTop: 24,
                    paddingTop: 20,
                    borderTop: "1px solid rgba(0,58,48,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontFamily: SERIF, fontSize: 16, color: KELLY, letterSpacing: "-0.02em" }}>
                    {w.ctaText}
                  </span>
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: KELLY,
                      color: WHITE,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                    }}
                  >
                    →
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Section: Calendar / RSVP ──────────────────────────────────
function Calendar({ p }: { p: SpatialTourBlockProps }) {
  return (
    <div
      id="rsvp"
      style={{
        background: FOREST,
        color: WHITE,
        padding: "140px 56px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <DotGrid opacity={0.55} />
      <Glow size={800} x={-250} y={-150} opacity={0.16} />

      <div
        style={{
          position: "relative",
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1.1fr",
          gap: 80,
          alignItems: "center",
        }}
      >
        <div>
          <Eyebrow color={MINT} style={{ marginBottom: 22 }}>
            {p.calendarEyebrow}
          </Eyebrow>
          <h2
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(44px, 5.5vw, 68px)",
              lineHeight: 0.96,
              letterSpacing: "-0.045em",
              fontWeight: 400,
              margin: 0,
              color: WHITE,
            }}
          >
            {p.calendarHeadlineLine1}
            <br />
            <span style={{ color: MINT, fontStyle: (p.headlineEmphasisItalic ?? true) ? "italic" : "normal" }}>{p.calendarHeadlineEmphasis}</span>
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.78)",
              margin: "32px 0 0",
              maxWidth: 460,
              fontFamily: SANS,
            }}
          >
            {p.calendarBody}
          </p>
          <div style={{ marginTop: 36, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <PrimaryCTA label={p.calendarPrimaryCta} href={p.navCtaUrl} />
            <SecondaryCTA label={p.calendarSecondaryCta} />
          </div>
          <div style={{ marginTop: 32, display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                background: WHITE,
                padding: 6,
                borderRadius: 4,
                boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              }}
            >
              <QRPlaceholder size={84} bg={WHITE} fg={FOREST} />
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.55,
                letterSpacing: "0.04em",
                fontFamily: SANS,
              }}
            >
              Scan to reserve from your phone.
              <br />
              {p.calendarUrlText}
            </div>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(197,241,197,0.18)",
            borderRadius: 8,
            padding: 32,
          }}
        >
          <CornerFrame color={MINT} size={14} inset={-8} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
              paddingBottom: 18,
              borderBottom: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontFamily: SANS,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: MINT,
                }}
              >
                // TOUR.SCHEDULE
              </span>
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 22,
                  color: WHITE,
                  letterSpacing: "-0.02em",
                }}
              >
                {p.calendarPanelTitle}
              </div>
            </div>
            <Eyebrow color="rgba(255,255,255,0.50)">{p.calendarPanelEyebrow}</Eyebrow>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {p.calendarDates.map((d, i) => {
              const statusColor =
                d.status === "Filling fast"
                  ? MINT
                  : d.status === "Limited"
                  ? "#FFC857"
                  : d.status === "Always open"
                  ? MINT
                  : "rgba(255,255,255,0.55)";
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: i * 0.06, ease: "easeOut" }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "110px 1fr 110px",
                    gap: 18,
                    padding: "18px 0",
                    borderBottom:
                      i === p.calendarDates.length - 1 ? "none" : "1px solid rgba(255,255,255,0.08)",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: SERIF,
                        fontSize: 22,
                        color: MINT,
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                      }}
                    >
                      {d.date}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.5)",
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                        marginTop: 4,
                        fontFamily: SANS,
                      }}
                    >
                      {d.city}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: WHITE, fontFamily: SANS }}>{d.event}</div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 8,
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor }} />
                    <span
                      style={{
                        fontSize: 11,
                        color: statusColor,
                        letterSpacing: "0.04em",
                        fontFamily: SANS,
                      }}
                    >
                      {d.status}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Footer ───────────────────────────────────────────
function Footer({ p }: { p: SpatialTourBlockProps }) {
  // Best-effort split of `footerInfo` into `addresses · © line`. Falls back
  // to placing the whole string on the left if no clear split is present.
  const info = (p.footerInfo || "").trim();
  const copyMatch = info.match(/(©[^·•|]*)$/);
  const copyright = copyMatch ? copyMatch[1].trim() : "© Dandy 2026";
  const addresses = copyMatch ? info.slice(0, copyMatch.index).replace(/[·•|]\s*$/, "").trim() : info;

  return (
    <div
      style={{
        background: FOREST_DEEP,
        color: WHITE,
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Telemetry strip at the very top of the footer */}
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "24px 56px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <TelemetryStrip />
      </div>

      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "28px 56px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <DandyWordmark color={WHITE} height={20} />
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.18)" }} />
          <BracketPill color="rgba(255,255,255,0.75)" bracketColor="rgba(197,241,197,0.55)">
            {p.footerEyebrow}
          </BracketPill>
        </div>
        <FileCode
          text="ID-LP-01 · LANDING / REV 2026.07 · BUILT IN-HOUSE"
          color="rgba(255,255,255,0.55)"
        />
      </div>

      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "0 56px 36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          fontFamily: SANS,
          fontSize: 12,
          color: "rgba(255,255,255,0.45)",
        }}
      >
        <div>{addresses}</div>
        <div style={{ letterSpacing: "0.04em" }}>{copyright}</div>
      </div>
    </div>
  );
}

// ─── Mega-block entry ──────────────────────────────────────────
export function BlockSpatialTour({ props }: { props: SpatialTourBlockProps }) {
  // Memoize stations so the alternating layout is stable
  const stations = useMemo(() => props.tourStations || [], [props.tourStations]);

  return (
    <div style={{ width: "100%", position: "relative", fontFamily: SANS, background: WHITE, color: FOREST }}>
      <Nav p={props} />
      <Hero p={props} />
      <Marquee p={props} />
      <Manifesto p={props} />
      <TourIntro p={props} />
      {stations.map((s, i) => (
        <StationCard
          key={s.number || i}
          station={s}
          flip={i % 2 === 1}
          isLast={i === stations.length - 1}
        />
      ))}
      <SpatialCallout p={props} />
      <FourWays p={props} />
      <Calendar p={props} />
      <Footer p={props} />
    </div>
  );
}
