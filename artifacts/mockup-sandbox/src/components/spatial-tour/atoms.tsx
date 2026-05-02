import type { CSSProperties, ReactNode } from "react";

export const FOREST = "#003A30";
export const FOREST_DEEP = "#00231D";
export const KELLY = "#158915";
export const MINT = "#C5F1C5";
export const CREAM = "#ECEAE6";
export const WHITE = "#FFFFFF";
export const INK2 = "#5A6862";

export const SERIF = "'Bagoss Standard', 'EB Garamond', Georgia, serif";
export const SANS = "'Inter', system-ui, sans-serif";

export function Eyebrow({
  children,
  color = KELLY,
  style = {},
}: {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
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

export function PrimaryCTA({
  label,
  href,
  dark = false,
  style = {},
}: {
  label: string;
  href?: string;
  dark?: boolean;
  style?: CSSProperties;
}) {
  return (
    <a
      href={href || "#"}
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
    </a>
  );
}

export function SecondaryCTA({
  label,
  href,
  style = {},
}: {
  label: string;
  href?: string;
  style?: CSSProperties;
}) {
  return (
    <a
      href={href || "#"}
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
    </a>
  );
}

export function VisionGlyph({
  width = 90,
  color = MINT,
  style = {},
}: {
  width?: number;
  color?: string;
  style?: CSSProperties;
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

export function DotGrid({
  opacity = 0.4,
  color = "rgba(197,241,197,0.10)",
  size = 32,
  style = {},
}: {
  opacity?: number;
  color?: string;
  size?: number;
  style?: CSSProperties;
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

export function Glow({
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
  style?: CSSProperties;
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

export function CornerFrame({
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
  style?: CSSProperties;
}) {
  const w = `${thickness}px solid ${color}`;
  const base: CSSProperties = {
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

export function TelemetryStrip({
  items,
  liveLabel = "LIVE",
  color = "rgba(255,255,255,0.55)",
  liveColor = MINT,
  livePulse = false,
  style = {},
  bootText,
}: {
  items: ReactNode[];
  liveLabel?: string;
  color?: string;
  liveColor?: string;
  livePulse?: boolean;
  style?: CSSProperties;
  bootText?: string | null;
}) {
  return (
    <div
      aria-hidden
      style={{
        display: "grid",
        gridTemplateColumns: bootText
          ? `1fr auto`
          : `repeat(${items.length}, 1fr) auto`,
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
      {bootText ? (
        <span style={{ color: MINT, opacity: 0.85 }}>{bootText}</span>
      ) : (
        items.map((it, i) => <span key={i}>{it}</span>)
      )}
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
          className={livePulse ? "st-pulse-dot" : undefined}
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

export function FileCode({
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
  style?: CSSProperties;
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

export function BracketPill({
  children,
  color = MINT,
  bracketColor,
  size = 11,
  style = {},
}: {
  children: ReactNode;
  color?: string;
  bracketColor?: string;
  size?: number;
  style?: CSSProperties;
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

export function MintEmphasis({
  children,
  italic = true,
  style = {},
}: {
  children: ReactNode;
  italic?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontStyle: italic ? "italic" : "normal",
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

export function Wordmark({
  color = WHITE,
  height = 20,
  alt = "Dandy",
}: {
  color?: string;
  height?: number;
  alt?: string;
}) {
  return (
    <span
      style={{
        fontFamily: SERIF,
        fontWeight: 500,
        fontSize: Math.round(height * 0.95),
        lineHeight: 1,
        color,
        letterSpacing: "-0.02em",
        display: "inline-block",
      }}
    >
      {alt}
    </span>
  );
}

export const NAV_LINKS = [
  { label: "The tour", href: "#tour" },
  { label: "Inside Dandy", href: "#inside" },
  { label: "Calendar", href: "#calendar" },
];

export const HERO_HEADSET_SRC = "/__mockup/images/spatial-headset.png";
