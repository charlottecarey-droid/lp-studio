import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoCaseFlowBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg, type BackgroundStyle } from "@/lib/bg-styles";
import {
  DEFAULT_BRAND,
  isValidHex,
  pickContrastingColor,
  relativeLuminance,
  type BrandConfig,
} from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";

import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
const DISPLAY_FONT = BRAND_DISPLAY_STACK;
const DISPLAY = DISPLAY_FONT;

// ── Dark-background treatment (the block's original premium look) ──────────
// Light heading, lime/brand accent, translucent-white cards. Read via CSS
// variables so the tenant's brand tokens (and Dandy's lime/forest defaults)
// flow through. Used verbatim whenever the resolved section background is dark.
const HEADING_DARK = "var(--brand-heading-on-dark, hsl(48,100%,96%))";
const ACCENT_DARK  = "var(--brand-accent, hsl(68,60%,52%))";
const BODY_DARK    = "hsla(48,100%,96%,0.48)";
const CARD_DARK    = "rgba(255,255,255,0.05)";
const BORDER_DARK  = "rgba(255,255,255,0.10)";

/**
 * Resolve a representative solid hex for a section background preset, honoring
 * tenant per-preset color overrides. The legacy "dandy-green" preset resolves
 * via the brand primary; "gradient" fades into black so it is treated as a dark
 * surface. Falls back to the historical preset default.
 */
function resolveSectionBgHex(brand: BrandConfig, style: BackgroundStyle): string {
  const override = brand.backgroundPresetColors?.[style];
  if (override && isValidHex(override)) return override;
  switch (style) {
    case "white":       return "#ffffff";
    case "light-gray":  return "#f8fafc";
    case "muted":       return "#f6f4ef";
    case "dark":        return "#1a1a1a";
    case "black":       return "#000000";
    case "dandy-green": return isValidHex(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
    case "gradient":    return "#000000";
    default:            return "#ffffff";
  }
}

/**
 * Resolve every foreground color the block needs from its *actual* resolved
 * background, so the block is legible on any backgroundStyle (the default
 * "muted" off-white included). On dark surfaces it returns the original
 * light-on-dark treatment unchanged; on light surfaces it derives WCAG-safe
 * dark-on-light colors via the brand palette.
 */
function resolveCaseFlowColors(brand: BrandConfig, style: BackgroundStyle) {
  const bgHex = resolveSectionBgHex(brand, style);
  // Canonical dark presets stay dark; a light preset a tenant recolored dark
  // is also treated as dark (luminance check), so the fix is robust either way.
  const dark = isDarkBg(style) || relativeLuminance(bgHex) < 0.4;

  if (dark) {
    return {
      heading:    HEADING_DARK,
      body:       BODY_DARK,
      accentText: ACCENT_DARK,
      accentDeco: ACCENT_DARK,
      card:       CARD_DARK,
      border:     BORDER_DARK,
      dark,
    };
  }

  const primary = isValidHex(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
  const accent  = isValidHex(brand.accentColor) ? brand.accentColor : DEFAULT_BRAND.accentColor;
  return {
    heading:    pickContrastingColor(primary, bgHex, ["#0f172a", "#000000"], 4.5),
    body:       pickContrastingColor("#475569", bgHex, ["#334155", "#1e293b", "#0f172a"], 4.5),
    // Accent for text-sized elements (eyebrow, metric numbers, stage number,
    // icons) needs AA text contrast; decorative lines only need UI contrast.
    accentText: pickContrastingColor(accent, bgHex, [primary, "#0f172a"], 4.5),
    accentDeco: pickContrastingColor(accent, bgHex, [primary, "#0f172a"], 3.0),
    card:       "rgba(15,23,42,0.03)",
    border:     "rgba(15,23,42,0.12)",
    dark,
  };
}

// Neutral component-level fallback. Catalog default_props (industry='generic')
// supplies a richer 4-step flow; this is only used in isolated previews or
// when no catalog row matches. Previously this leaked Dandy/dental copy.
const DEFAULT_STAGES = [
  {
    number: "01",
    label: "Submit",
    metric: "< 1 min",
    metricLabel: "avg submission time",
    body: "Kick off a request from any location with a streamlined intake form.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" width={28} height={28}>
        <motion.path d="M4 16 C4 9.4 9.4 4 16 4 C22.6 4 28 9.4 28 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.5 }} />
        <motion.path d="M10 16 L13 21 L16 13 L19 19 L22 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.9 }} />
      </svg>
    ),
  },
  {
    number: "02",
    label: "Validate",
    metric: "Real-time",
    metricLabel: "automated checks",
    body: "Built-in validation catches issues before they propagate downstream.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" width={28} height={28}>
        <motion.circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="2"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 0.5 }} />
        <motion.path d="M4 16H9M23 16H28M16 4V9M16 23V28" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.8 }} />
        <motion.path d="M13 16l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 1.3 }} />
      </svg>
    ),
  },
  {
    number: "03",
    label: "Route",
    metric: "Auto",
    metricLabel: "routing",
    body: "Requests are routed to the right team based on rules you control.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" width={28} height={28}>
        <motion.path d="M16 4 L26 10 L26 22 L16 28 L6 22 L6 10 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.0, delay: 0.5 }} />
        <motion.path d="M16 4 L16 28M6 10 L26 10M6 22 L26 22" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 1.2 }} />
      </svg>
    ),
  },
  {
    number: "04",
    label: "Deliver",
    metric: "Days",
    metricLabel: "typical turnaround",
    body: "Track every step end-to-end with full visibility into status and SLA.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" width={28} height={28}>
        <motion.path d="M6 17 L12 23 L26 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.5 }} />
        <motion.circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.2 }} />
      </svg>
    ),
  },
];

interface Props {
  props: DsoCaseFlowBlockProps;
  brand?: BrandConfig;
  onFieldChange?: (updated: DsoCaseFlowBlockProps) => void;
}

export function BlockDsoCaseFlow({ props, brand, onFieldChange }: Props) {
  const {
    eyebrow = "How it works",
    headline = "From request to delivery, in days.",
    subheadline = "Every workflow follows the same precise, validated path — regardless of which location submits it.",
    stages,
    backgroundStyle = "muted",
  } = props;
  const colors = resolveCaseFlowColors(brand ?? DEFAULT_BRAND, (backgroundStyle ?? "muted") as BackgroundStyle);
  const field = (key: keyof DsoCaseFlowBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as DsoCaseFlowBlockProps[typeof key] }) : undefined;
  const baseStages = stages && stages.length > 0 ? stages : DEFAULT_STAGES;
  const displayStages = baseStages.slice(0, 4);
  const updateStage = onFieldChange
    ? (idx: number, patch: Partial<NonNullable<DsoCaseFlowBlockProps["stages"]>[number]>) => {
        const seeded: NonNullable<DsoCaseFlowBlockProps["stages"]> = baseStages.map(s => ({
          number: s.number,
          label: s.label,
          metric: s.metric,
          metricLabel: s.metricLabel,
          body: s.body,
        }));
        seeded[idx] = { ...seeded[idx], ...patch };
        onFieldChange({ ...props, stages: seeded });
      }
    : undefined;
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-12%" });

  return (
    <section ref={sectionRef} style={{ ...getBgStyle(backgroundStyle), padding: "6rem 1.5rem", overflow: "hidden", position: "relative" }}>
      {/* Background texture */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 80%, hsla(68,60%,52%,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsla(152,42%,30%,0.12) 0%, transparent 50%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }} style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: colors.accentText, marginBottom: "1rem", fontFamily: BODY }}>
            <InlineText as="span" value={eyebrow} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }}/>
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.08 }}
            style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(2rem,4.5vw,3.5rem)", fontWeight: 700, color: colors.heading, letterSpacing: "-0.04em", lineHeight: 1.05, marginBottom: "1rem" }}
          >
            <InlineText as="span" value={headline} onUpdate={field("headline")} multiline style={{ fontFamily: DISPLAY }}/>
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.55, delay: 0.15 }} style={{ fontSize: "1.0625rem", color: colors.body, lineHeight: 1.68, maxWidth: 540, margin: "0 auto", fontFamily: BODY }}>
            <InlineText as="span" value={subheadline} onUpdate={field("subheadline")} multiline style={{ fontFamily: BODY }}/>
          </motion.p>
        </div>

        {/* Pipeline track */}
        <div style={{ position: "relative" }}>
          {/* Connector line (desktop) */}
          <div
            className="hidden md:block"
            style={{ position: "absolute", top: "3.5rem", left: "calc(12.5% + 1rem)", right: "calc(12.5% + 1rem)", height: 2, overflow: "hidden", zIndex: 0 }}
          >
            <motion.div
              style={{ height: "100%", background: colors.dark
                ? `linear-gradient(90deg, rgb(var(--brand-accent-rgb, 199 231 56) / 0.376), ${ACCENT_DARK}, rgb(var(--brand-accent-rgb, 199 231 56) / 0.376))`
                : `linear-gradient(90deg, transparent, ${colors.accentDeco}, transparent)`, transformOrigin: "left" }}
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : {}}
              transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
            {/* Glow overlay */}
            <div style={{ position: "absolute", inset: 0, background: colors.dark
              ? `linear-gradient(90deg, rgb(var(--brand-accent-rgb, 199 231 56) / 0.188), rgb(var(--brand-accent-rgb, 199 231 56) / 0.376), rgb(var(--brand-accent-rgb, 199 231 56) / 0.188))`
              : `linear-gradient(90deg, transparent, ${colors.accentDeco}, transparent)`, filter: "blur(4px)" }} />
          </div>

          {/* Data packets on the line */}
          {inView && (
            <div className="hidden md:block" style={{ position: "absolute", top: "calc(3.5rem - 4px)", left: "calc(12.5% + 1rem)", right: "calc(12.5% + 1rem)", height: 10, zIndex: 2, overflow: "hidden" }}>
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  style={{
                    position: "absolute",
                    width: 8, height: 8, borderRadius: "50%",
                    background: colors.accentDeco,
                    top: 1,
                    filter: `drop-shadow(0 0 4px ${colors.accentDeco})`,
                  }}
                  animate={{ left: ["0%", "100%"] }}
                  transition={{ duration: 3.5, delay: i * 1.2, repeat: Infinity, ease: "linear" }}
                />
              ))}
            </div>
          )}

          {/* Stage cards grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.25rem", position: "relative", zIndex: 1 }}
            className="dsocf-grid"
          >
            {displayStages.map((stage, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 32 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.65, delay: 0.5 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "1.25rem",
                  padding: "2rem 1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Active lime top border */}
                <motion.div
                  style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: colors.accentDeco, transformOrigin: "left" }}
                  initial={{ scaleX: 0 }}
                  animate={inView ? { scaleX: 1 } : {}}
                  transition={{ duration: 0.6, delay: 0.8 + i * 0.18, ease: "easeOut" }}
                />

                {/* Stage number + icon row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: DISPLAY_FONT, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", color: colors.accentText }}>
                    {stage.number ?? String(i + 1).padStart(2, "0")}
                  </span>
                  <div style={{ color: colors.accentText, opacity: 0.85 }}>
                    {stage.icon ?? (
                      <svg viewBox="0 0 28 28" width={28} height={28} fill="none">
                        <circle cx="14" cy="14" r="8" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Metric */}
                <div>
                  <p style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(1.75rem,3vw,2.5rem)", fontWeight: 800, color: colors.accentText, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: "0.25rem" }}>
                    <InlineText as="span" value={stage.metric} onUpdate={updateStage ? (v) => updateStage(i, { metric: v }) : undefined} style={{ fontFamily: DISPLAY }}/>
                  </p>
                  <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: colors.body, fontFamily: BODY }}>
                    <InlineText as="span" value={stage.metricLabel} onUpdate={updateStage ? (v) => updateStage(i, { metricLabel: v }) : undefined} style={{ fontFamily: BODY }}/>
                  </p>
                </div>

                {/* Label */}
                <p style={{ fontFamily: DISPLAY_FONT, fontSize: "1.0625rem", fontWeight: 600, color: colors.heading, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                  <InlineText as="span" value={stage.label} onUpdate={updateStage ? (v) => updateStage(i, { label: v }) : undefined} style={{ fontFamily: DISPLAY }}/>
                </p>

                {/* Body */}
                <p style={{ fontSize: "0.875rem", lineHeight: 1.65, color: colors.body, flexGrow: 1, fontFamily: BODY }}>
                  <InlineText as="span" value={stage.body} onUpdate={updateStage ? (v) => updateStage(i, { body: v }) : undefined} multiline style={{ fontFamily: BODY }}/>
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .dsocf-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .dsocf-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </section>
  );
}
