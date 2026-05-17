// LP Studio logo — inline SVG so the wordmark themes correctly on cream
// and dark backgrounds without swapping image files. Three variants:
//
//   • `icon`     — square cream-tile app icon (LP. with coral dot + STUDIO).
//                  Matches the uploaded logo design exactly. Use as a
//                  brand mark on dark sections, an avatar, or a favicon.
//   • `wordmark` — horizontal lockup for inline placement (navbar, footer).
//                  Renders the LP. mark plus "Studio" alongside it in a
//                  letter-spaced sans, sized to fit a 32–44px line.
//   • `mark`     — the LP. with coral dot only, no background. Use when
//                  the surface already has its own card / pill chrome.
//
// All three render the indigo `LP`, the coral period dot, and the ink
// `STUDIO` text using the same color palette as the rest of the marketing
// site so they slot in without per-section overrides.

import type { CSSProperties } from "react";

const INDIGO = "#4B47E5";
const CORAL = "#E26B4F";
const INK = "#1A1815";
const CREAM_TILE = "#F4EAD9";

interface LogoProps {
  variant?: "icon" | "wordmark" | "mark";
  /** Height in pixels. Width scales to maintain aspect ratio. */
  height?: number;
  /**
   * Color of the "Studio" / "LP" text on dark surfaces. Defaults to the
   * full-color palette; pass "light" to render a single-tone version that
   * works on dark backgrounds.
   */
  tone?: "color" | "light" | "dark";
  className?: string;
  style?: CSSProperties;
  /** Accessible label for the logo. Defaults to "LP Studio". */
  label?: string;
}

export function Logo({
  variant = "wordmark",
  height = 28,
  tone = "color",
  className,
  style,
  label = "LP Studio",
}: LogoProps) {
  if (variant === "icon") return <LogoIcon size={height} className={className} style={style} label={label} />;
  if (variant === "mark") return <LogoMark height={height} tone={tone} className={className} style={style} label={label} />;
  return <LogoWordmark height={height} tone={tone} className={className} style={style} label={label} />;
}

// ── icon ──────────────────────────────────────────────────────────────────

function LogoIcon({
  size,
  className,
  style,
  label,
}: {
  size: number;
  className?: string;
  style?: CSSProperties;
  label: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <rect width="240" height="240" rx="52" fill={CREAM_TILE} />
      <g fontFamily="'DM Sans','Helvetica Neue','Inter',Arial,sans-serif">
        <text x="50" y="148" fontSize="110" fontWeight="800" letterSpacing="-4" fill={INDIGO}>LP</text>
        <circle cx="178" cy="136" r="10.5" fill={CORAL} />
        <text x="120" y="194" textAnchor="middle" fontSize="26" fontWeight="700" letterSpacing="6" fill={INK}>STUDIO</text>
      </g>
    </svg>
  );
}

// ── mark (no background, LP with coral dot only) ──────────────────────────

function LogoMark({
  height,
  tone,
  className,
  style,
  label,
}: {
  height: number;
  tone: "color" | "light" | "dark";
  className?: string;
  style?: CSSProperties;
  label: string;
}) {
  const indigo = tone === "light" ? "#FFFFFF" : tone === "dark" ? INK : INDIGO;
  const dot = tone === "light" ? CORAL : tone === "dark" ? CORAL : CORAL;
  // viewBox sized so width ≈ 1.6 × height
  return (
    <svg
      height={height}
      viewBox="0 0 144 88"
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    >
      <g fontFamily="'DM Sans','Helvetica Neue','Inter',Arial,sans-serif">
        <text x="0" y="70" fontSize="80" fontWeight="800" letterSpacing="-3" fill={indigo}>LP</text>
        <circle cx="116" cy="62" r="7.5" fill={dot} />
      </g>
    </svg>
  );
}

// ── wordmark (horizontal lockup) ──────────────────────────────────────────

function LogoWordmark({
  height,
  tone,
  className,
  style,
  label,
}: {
  height: number;
  tone: "color" | "light" | "dark";
  className?: string;
  style?: CSSProperties;
  label: string;
}) {
  const indigo = tone === "light" ? "#FFFFFF" : tone === "dark" ? INK : INDIGO;
  const studio = tone === "light" ? "rgba(255,255,255,0.78)" : tone === "dark" ? INK : INK;
  // Width is chosen so the lockup feels tight: LP. mark + Studio text.
  return (
    <svg
      height={height}
      viewBox="0 0 260 88"
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    >
      <g fontFamily="'DM Sans','Helvetica Neue','Inter',Arial,sans-serif">
        <text x="0" y="70" fontSize="80" fontWeight="800" letterSpacing="-3" fill={indigo}>LP</text>
        <circle cx="116" cy="62" r="7.5" fill={CORAL} />
        <text
          x="138"
          y="62"
          fontSize="22"
          fontWeight="700"
          letterSpacing="5"
          fill={studio}
        >
          STUDIO
        </text>
      </g>
    </svg>
  );
}

export default Logo;
