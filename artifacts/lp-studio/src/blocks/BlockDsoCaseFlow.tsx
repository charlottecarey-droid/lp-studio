import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoCaseFlowBlockProps } from "@/lib/block-types";
import { getBgStyle } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";

const DISPLAY_FONT = "var(--brand-font-display, var(--app-font-display, system-ui)), 'Inter', system-ui, sans-serif";
const P     = "var(--brand-primary, #003A30)";
const PFG   = "hsl(48,100%,96%)";
const AW    = "var(--brand-accent, hsl(68,60%,52%))";
const CARD  = "rgba(255,255,255,0.05)";
const BORDER = "rgba(255,255,255,0.10)";
const MUTED = "hsla(48,100%,96%,0.48)";

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
  onFieldChange?: (updated: DsoCaseFlowBlockProps) => void;
}

export function BlockDsoCaseFlow({ props, onFieldChange }: Props) {
  const {
    eyebrow = "How it works",
    headline = "From request to delivery, in days.",
    subheadline = "Every workflow follows the same precise, validated path — regardless of which location submits it.",
    stages,
    backgroundStyle = "muted",
  } = props;
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
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: AW, marginBottom: "1rem" }}
          >
            <InlineText as="span" value={eyebrow} onUpdate={field("eyebrow")} />
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.08 }}
            style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(2rem,4.5vw,3.5rem)", fontWeight: 700, color: PFG, letterSpacing: "-0.04em", lineHeight: 1.05, marginBottom: "1rem" }}
          >
            <InlineText as="span" value={headline} onUpdate={field("headline")} multiline />
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.15 }}
            style={{ fontSize: "1.0625rem", color: MUTED, lineHeight: 1.68, maxWidth: 540, margin: "0 auto" }}
          >
            <InlineText as="span" value={subheadline} onUpdate={field("subheadline")} multiline />
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
              style={{ height: "100%", background: `linear-gradient(90deg, rgb(var(--brand-accent-rgb, 199 231 56) / 0.376), ${AW}, rgb(var(--brand-accent-rgb, 199 231 56) / 0.376))`, transformOrigin: "left" }}
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : {}}
              transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
            {/* Glow overlay */}
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, rgb(var(--brand-accent-rgb, 199 231 56) / 0.188), rgb(var(--brand-accent-rgb, 199 231 56) / 0.376), rgb(var(--brand-accent-rgb, 199 231 56) / 0.188))`, filter: "blur(4px)" }} />
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
                    background: AW,
                    top: 1,
                    filter: `drop-shadow(0 0 4px ${AW})`,
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
                  background: CARD,
                  border: `1px solid ${BORDER}`,
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
                  style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: AW, transformOrigin: "left" }}
                  initial={{ scaleX: 0 }}
                  animate={inView ? { scaleX: 1 } : {}}
                  transition={{ duration: 0.6, delay: 0.8 + i * 0.18, ease: "easeOut" }}
                />

                {/* Stage number + icon row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: DISPLAY_FONT, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", color: AW }}>
                    {stage.number ?? String(i + 1).padStart(2, "0")}
                  </span>
                  <div style={{ color: AW, opacity: 0.85 }}>
                    {stage.icon ?? (
                      <svg viewBox="0 0 28 28" width={28} height={28} fill="none">
                        <circle cx="14" cy="14" r="8" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Metric */}
                <div>
                  <p style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(1.75rem,3vw,2.5rem)", fontWeight: 800, color: AW, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: "0.25rem" }}>
                    <InlineText as="span" value={stage.metric} onUpdate={updateStage ? (v) => updateStage(i, { metric: v }) : undefined} />
                  </p>
                  <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>
                    <InlineText as="span" value={stage.metricLabel} onUpdate={updateStage ? (v) => updateStage(i, { metricLabel: v }) : undefined} />
                  </p>
                </div>

                {/* Label */}
                <p style={{ fontFamily: DISPLAY_FONT, fontSize: "1.0625rem", fontWeight: 600, color: PFG, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                  <InlineText as="span" value={stage.label} onUpdate={updateStage ? (v) => updateStage(i, { label: v }) : undefined} />
                </p>

                {/* Body */}
                <p style={{ fontSize: "0.875rem", lineHeight: 1.65, color: MUTED, flexGrow: 1 }}>
                  <InlineText as="span" value={stage.body} onUpdate={updateStage ? (v) => updateStage(i, { body: v }) : undefined} multiline />
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
