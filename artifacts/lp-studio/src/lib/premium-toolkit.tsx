import type { CSSProperties, ReactNode } from "react";
import { motion, type Variants } from "framer-motion";

/**
 * Premium visual toolkit — reusable primitives extracted from the flagship hero
 * blocks (Aurora, Spotlight Glow, Parallax Layers) so section blocks can adopt
 * the same scroll-reveal motion and decorative layers without re-deriving them.
 *
 * Everything here is presentational and dependency-light (framer-motion + CSS).
 * Decorative layers are `pointer-events: none` and meant to sit behind content
 * inside a `position: relative; overflow: hidden` container.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Motion variants
// ─────────────────────────────────────────────────────────────────────────────

/** Container that staggers its children in. Mirrors the Aurora hero entry. */
export function staggerContainer(stagger = 0.12, delayChildren = 0.1): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: stagger, delayChildren },
    },
  };
}

/** Child item: rises + fades in on a spring. Pair with `staggerContainer`. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 20 },
  },
};

/** Gentle perpetual float for accent chips / cards (Aurora floating chips). */
export const floatVariants: Variants = {
  initial: { y: 0 },
  animate: {
    y: [-10, 10, -10],
    transition: { duration: 6, repeat: Infinity, ease: "easeInOut" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Scroll reveal
// ─────────────────────────────────────────────────────────────────────────────

export interface RevealProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Seconds before the reveal begins once in view. */
  delay?: number;
  /** Travel distance (px) for the upward rise. */
  y?: number;
  /** Re-animate every time it enters the viewport (default: once). */
  repeat?: boolean;
  /**
   * Render statically (a plain div) with no motion. Pass the block's builder
   * flag here so live editing stays snappy and content is never stranded at
   * opacity 0 inside the builder canvas, where editors need content visible
   * and stable while editing rather than fading in on scroll.
   */
  disabled?: boolean;
}

/**
 * Reveal-on-scroll wrapper: fades + rises its children when they enter the
 * viewport. Uses `whileInView` so it works for any section without a scroll
 * controller.
 */
export function Reveal({ children, className, style, delay = 0, y = 24, repeat = false, disabled = false, isBuilder = false }: RevealProps & { isBuilder?: boolean }) {
  // In the builder canvas the content must render immediately at its natural
  // state — a `whileInView` wrapper would leave freshly-inserted blocks blank.
  // `disabled` and `isBuilder` are aliases for this static render mode.
  if (disabled || isBuilder) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: !repeat, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered reveal group: animates a container and its direct children in
 * sequence when scrolled into view. Children should be wrapped in
 * `<motion.div variants={staggerItem}>` (or use {@link RevealItem}).
 */
export function RevealStagger({
  children,
  className,
  style,
  stagger = 0.12,
  delayChildren = 0.1,
  repeat = false,
  disabled = false,
}: RevealProps & { stagger?: number; delayChildren?: number }) {
  if (disabled) {
    return <div className={className} style={style}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      style={style}
      variants={staggerContainer(stagger, delayChildren)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: !repeat, amount: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

/** A single staggered child for use inside {@link RevealStagger}. */
export function RevealItem({ children, className, style, disabled = false }: { children: ReactNode; className?: string; style?: CSSProperties; disabled?: boolean }) {
  if (disabled) {
    return <div className={className} style={style}>{children}</div>;
  }
  return (
    <motion.div className={className} style={style} variants={staggerItem}>
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Decorative layers
// ─────────────────────────────────────────────────────────────────────────────

export interface GlowOrbsProps {
  /** One CSS color per orb. Each renders as a soft, blurred radial blob. */
  colors?: string[];
  /** Blur radius in px (default 120). */
  blur?: number;
  /** Layer opacity 0–1 (default 0.5). */
  opacity?: number;
  /** Blend mode for the orbs (default `screen` — ideal on dark surfaces; pass
   *  `normal` (or `multiply`) for soft tinted washes on light surfaces where
   *  `screen` against white renders invisible). */
  blend?: CSSProperties["mixBlendMode"];
  className?: string;
}

/**
 * Soft animated glow orbs — the blurred radial blobs from the Aurora / Parallax
 * heroes. Place inside a `relative overflow-hidden` container behind content.
 */
export function GlowOrbs({
  colors = ["var(--brand-primary, #6366f1)", "var(--brand-accent, #9333ea)"],
  blur = 120,
  opacity = 0.5,
  blend = "screen",
  className,
}: GlowOrbsProps) {
  const positions = [
    { top: "8%", left: "16%", size: "46%", anim: "premium-orb-1 26s" },
    { top: "44%", left: "62%", size: "40%", anim: "premium-orb-2 30s" },
    { top: "62%", left: "8%", size: "44%", anim: "premium-orb-3 28s" },
    { top: "18%", left: "44%", size: "56%", anim: "premium-orb-4 34s" },
  ];
  return (
    <div className={className} aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <style>{`
        @keyframes premium-orb-1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(8%,-12%) scale(1.15)} }
        @keyframes premium-orb-2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-12%,10%) scale(0.9)} }
        @keyframes premium-orb-3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-8%,-10%) scale(1.2)} }
        @keyframes premium-orb-4 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(14%,12%) scale(0.85)} }
      `}</style>
      {colors.map((color, i) => {
        const p = positions[i % positions.length];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              opacity,
              filter: `blur(${blur}px)`,
              mixBlendMode: blend,
              animation: `${p.anim} infinite ease-in-out`,
              background: `radial-gradient(circle, color-mix(in srgb, ${color} 80%, transparent) 0%, transparent 70%)`,
            }}
          />
        );
      })}
    </div>
  );
}

export interface AccentGlowProps {
  /** Brand/accent color the glows are tinted with. */
  color: string;
  /** True when the host surface reads dark (boosts opacity + uses screen blend). */
  isDark?: boolean;
  /** Layer opacity multiplier override (0–1). Defaults are surface-aware. */
  opacity?: number;
  className?: string;
}

/**
 * Surface-aware decorative glows — two soft, blurred accent-tinted blobs anchored
 * to opposite corners. Unlike {@link GlowOrbs} (screen-blend, dark-only) this
 * reads correctly on light *and* dark surfaces: on light it stays a faint tint;
 * on dark it brightens and uses a screen blend. Place inside a
 * `relative overflow-hidden` container behind content (it sits at `zIndex: 0`).
 */
export function AccentGlow({ color, isDark = false, opacity, className }: AccentGlowProps) {
  const topOpacity = opacity ?? (isDark ? 0.32 : 0.1);
  const bottomOpacity = opacity ?? (isDark ? 0.22 : 0.07);
  const blend: CSSProperties["mixBlendMode"] = isDark ? "screen" : "normal";
  return (
    <div className={className} aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: "-12%",
          right: "-6%",
          width: "46%",
          height: "58%",
          borderRadius: "50%",
          opacity: topOpacity,
          filter: "blur(90px)",
          mixBlendMode: blend,
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-16%",
          left: "-8%",
          width: "42%",
          height: "52%",
          borderRadius: "50%",
          opacity: bottomOpacity,
          filter: "blur(100px)",
          mixBlendMode: blend,
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}

export interface GridOverlayProps {
  /** Line color (default subtle white for dark surfaces). */
  color?: string;
  /** Cell size in px (default 64). */
  size?: number;
  /** Layer opacity 0–1 (default 0.5). */
  opacity?: number;
  /** Fade the grid out toward the edges with a radial mask. */
  fade?: boolean;
  className?: string;
}

/** Faint blueprint grid overlay (Spotlight Glow hero). */
export function GridOverlay({
  color = "rgba(255,255,255,0.06)",
  size = 64,
  opacity = 0.5,
  fade = true,
  className,
}: GridOverlayProps) {
  const mask = fade
    ? "radial-gradient(ellipse 80% 80% at 50% 40%, #000 40%, transparent 100%)"
    : undefined;
  return (
    <div
      className={className}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity,
        backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    />
  );
}

export interface NoiseOverlayProps {
  /** Layer opacity 0–1 (default 0.05). */
  opacity?: number;
  className?: string;
}

/** Fine film-grain noise overlay (Aurora hero) to add texture over flat fills. */
export function NoiseOverlay({ opacity = 0.05, className }: NoiseOverlayProps) {
  return (
    <div
      className={className}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        opacity,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

export interface SectionDecorProps {
  /** Brand accent driving the glow tint. */
  accent: string;
  /** Whether the host surface is dark (drives blend mode + intensity). */
  isDark: boolean;
  /** Render nothing — pass `true` in the builder canvas to keep editing crisp. */
  disabled?: boolean;
  /** Also lay down a faint blueprint grid behind content. */
  grid?: boolean;
}

/**
 * Surface-adaptive decorative backdrop — the one-line atmosphere layer for
 * section blocks. Composes {@link GlowOrbs} (+ optional {@link GridOverlay} /
 * {@link NoiseOverlay}) tuned to the host surface: bright `screen`-blend orbs
 * and a faint grid on dark/gradient surfaces, soft `normal`-blend brand washes
 * on light ones. Place as the first child of a `relative overflow-hidden`
 * section, then lift the content with `relative z-10`.
 */
export function SectionDecor({ accent, isDark, disabled = false, grid = false }: SectionDecorProps) {
  if (disabled) return null;
  if (isDark) {
    return (
      <>
        <GlowOrbs colors={[accent, accent, accent]} opacity={0.3} blur={130} />
        {grid && <GridOverlay opacity={0.5} />}
        <NoiseOverlay opacity={0.04} />
      </>
    );
  }
  return (
    <>
      <GlowOrbs colors={[accent, accent, accent]} opacity={0.09} blur={150} blend="normal" />
      {grid && (
        <GridOverlay
          color={`color-mix(in srgb, ${accent} 12%, transparent)`}
          opacity={0.6}
          size={56}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gradient helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clipped-text gradient style for highlighted headline words (Aurora hero). The
 * text is painted with a left→right gradient and clipped to the glyphs.
 */
export function headlineGradientStyle(
  from = "currentColor",
  to = "var(--brand-accent, #9333ea)",
  angle = "to right",
): CSSProperties {
  return {
    background: `linear-gradient(${angle}, ${from}, ${to})`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
  };
}

/** Glassmorphism panel style (Aurora floating chips) for cards on dark surfaces. */
export function glassPanelStyle(): CSSProperties {
  return {
    background: "rgba(255, 255, 255, 0.03)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    boxShadow: "0 30px 60px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
  };
}
