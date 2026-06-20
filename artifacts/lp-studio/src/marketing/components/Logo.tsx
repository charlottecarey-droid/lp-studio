// LP Studio logo — inline SVG so the mark themes correctly without swapping
// image files. Mirrors the brand assets in /public/brand/ (which are the
// canonical files for favicons, OG images, email signatures, etc.). Three
// rendered variants:
//
//   • `icon` / `mark` — rounded-square brand mark only: indigo-gradient tile
//                       with white LP letterform + coral dot. Use as an
//                       avatar, favicon-style placement, or beside content
//                       that already carries the brand name in text.
//   • `wordmark`     — mark + horizontal "LP STUDIO" lockup beside it. The
//                      default for nav / footer placements.
//
// Tones:
//   • `color` (default) — indigo gradient mark + dark ink wordmark text.
//                         For cream / light surfaces.
//   • `light`           — indigo gradient mark + cream wordmark text. For
//                         dark surfaces (final CTA, sales console chrome).
//   • `dark`            — monochrome ink mark (knocked-out LP + dot). Use
//                         when a single-tone mark fits the surrounding
//                         design better than the gradient.
//
// Per-render unique gradient IDs (useId) so multiple Logo instances on the
// same page don't collide on the gradient `<defs>`.

import { useId } from "react";
import type { CSSProperties } from "react";

const INDIGO = "#2E2A8C";
const INDIGO_LIGHT = "#6A66F0";
const CORAL = "#E26B4F";
const INK = "#1A1815";
const CREAM = "#F4EFE3";

interface LogoProps {
  variant?: "icon" | "wordmark" | "mark";
  /** Height in pixels. Width scales to maintain aspect ratio. */
  height?: number;
  /** Color treatment — see file header for tone semantics. */
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
  if (variant === "icon" || variant === "mark") {
    return (
      <LogoMark
        size={height}
        tone={tone}
        className={className}
        style={style}
        label={label}
      />
    );
  }
  return (
    <LogoWordmark
      height={height}
      tone={tone}
      className={className}
      style={style}
      label={label}
    />
  );
}

// ── mark (rounded-square LP + dot) ────────────────────────────────────────

function LogoMark({
  size,
  tone,
  className,
  style,
  label,
}: {
  size: number;
  tone: "color" | "light" | "dark";
  className?: string;
  style?: CSSProperties;
  label: string;
}) {
  const id = useId();
  const gradientId = `lp-mark-grad-${id.replace(/:/g, "")}`;
  const maskId = `lp-mark-mask-${id.replace(/:/g, "")}`;

  if (tone === "dark") {
    // Monochrome ink mark — knocked-out LP + dot using a mask.
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label={label}
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      >
        <mask id={maskId}>
          <rect x="4" y="4" width="92" height="92" rx="26" fill="#fff" />
          <text
            x="46.5"
            y="66"
            textAnchor="middle"
            fontFamily="'DM Sans','Helvetica Neue',Arial,sans-serif"
            fontWeight="700"
            fontSize="46"
            letterSpacing="-3"
            fill="#000"
          >
            LP
          </text>
          <circle cx="74" cy="62" r="5.5" fill="#000" />
        </mask>
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="26"
          fill={INK}
          mask={`url(#${maskId})`}
        />
      </svg>
    );
  }

  // color + light — indigo gradient tile with white LP letterform + coral dot.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={INDIGO_LIGHT} />
          <stop offset="1" stopColor={INDIGO} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="26" fill={`url(#${gradientId})`} />
      <text
        x="46.5"
        y="66"
        textAnchor="middle"
        fontFamily="'DM Sans','Helvetica Neue',Arial,sans-serif"
        fontWeight="700"
        fontSize="46"
        letterSpacing="-3"
        fill="#FFFFFF"
      >
        LP
      </text>
      <circle cx="71" cy="65" r="7" fill={CORAL} />
    </svg>
  );
}

// ── wordmark (horizontal mark + "LP STUDIO" lockup) ───────────────────────

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
  const id = useId();
  const gradientId = `lp-word-grad-${id.replace(/:/g, "")}`;

  // Source viewBox is 300×80, so width auto-scales as height shrinks.
  // Text color picks for the "LP STUDIO" lockup beside the mark:
  //   color → dark ink on cream surfaces
  //   light → cream on dark surfaces (matches lockup-wordmark-light.svg)
  //   dark  → dark ink (same as color; the dark tone is rarely used for
  //           wordmarks since the mark itself is the knocked-out variant)
  const lpFill = tone === "light" ? CREAM : INK;
  const studioFill =
    tone === "light" ? "rgba(244,239,227,0.74)" : INK;

  return (
    <svg
      height={height}
      viewBox="0 0 300 80"
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={INDIGO_LIGHT} />
          <stop offset="1" stopColor={INDIGO} />
        </linearGradient>
      </defs>
      {/* Brand mark (rounded indigo tile + LP + dot) — scaled to lockup height */}
      <g transform="translate(2,10) scale(0.6)">
        <rect x="4" y="4" width="92" height="92" rx="26" fill={`url(#${gradientId})`} />
        <text
          x="46.5"
          y="66"
          textAnchor="middle"
          fontFamily="'DM Sans','Helvetica Neue',Arial,sans-serif"
          fontWeight="700"
          fontSize="46"
          letterSpacing="-3"
          fill="#FFFFFF"
        >
          LP
        </text>
        <circle cx="71" cy="65" r="7" fill={CORAL} />
      </g>
      {/* LP STUDIO lockup */}
      <text
        x="78"
        y="50"
        fontFamily="'DM Sans','Helvetica Neue',Arial,sans-serif"
        fontSize="30"
        fill={lpFill}
      >
        <tspan fontWeight="700" letterSpacing="-0.3">LP</tspan>
        <tspan fontWeight="500" letterSpacing="3.4" dx="10" fill={studioFill}>
          STUDIO
        </tspan>
      </text>
    </svg>
  );
}

export default Logo;
