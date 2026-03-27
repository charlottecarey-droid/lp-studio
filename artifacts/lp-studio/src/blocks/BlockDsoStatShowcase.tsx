import { useRef, useEffect, useState } from "react";
import { motion, useInView, useMotionValue, useMotionValueEvent, animate } from "framer-motion";
import type { DsoStatShowcaseBlockProps } from "@/lib/block-types";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const P   = "hsl(152,42%,12%)";
const PFG = "hsl(48,100%,96%)";
const AW  = "hsl(68,60%,52%)";
const MU  = "rgba(255,255,255,0.46)";

const DEFAULT_STATS: DsoStatShowcaseBlockProps["stats"] = [
  { value: "96%",     label: "First-time right rate",  description: "Industry-leading precision at enterprise scale" },
  { value: "12,000+", label: "Dental practices",       description: "Trust Dandy for their lab work" },
  { value: "4.2 days", label: "Average turnaround",   description: "Including AI review and quality control" },
  { value: "$0",      label: "CAPEX to start",         description: "All hardware included at no upfront cost" },
  { value: "30%",     label: "Case acceptance lift",   description: "On average across DSO partner networks" },
  { value: "100%",    label: "AI quality screened",    description: "Every scan reviewed before it leaves the chair" },
];

function parseValue(raw: string): { prefix: string; num: number; suffix: string; isDecimal: boolean } {
  const match = raw.match(/^([^0-9]*)(\d[\d,.]*)(.*)$/);
  if (!match) return { prefix: "", num: 0, suffix: raw, isDecimal: false };
  const numStr = match[2].replace(/,/g, "");
  const num = parseFloat(numStr);
  const isDecimal = numStr.includes(".");
  return { prefix: match[1], num, suffix: match[3], isDecimal };
}

function StatCard({ stat, index }: { stat: DsoStatShowcaseBlockProps["stats"][number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const { prefix, num, suffix, isDecimal } = parseValue(stat.value);
  const count = useMotionValue(0);
  const [display, setDisplay] = useState(`${prefix}0${suffix}`);

  useMotionValueEvent(count, "change", (latest) => {
    const formatted = isDecimal
      ? latest.toFixed(1)
      : Math.round(latest).toLocaleString();
    setDisplay(`${prefix}${formatted}${suffix}`);
  });

  useEffect(() => {
    if (isInView) {
      animate(count, num, {
        duration: 1.6,
        delay: index * 0.09,
        ease: [0.16, 1, 0.3, 1],
      });
    }
  }, [isInView, num, index, count]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      transition={{ duration: 0.75, delay: index * 0.09, ease: [0.16, 1, 0.3, 1] }}
      style={{
        padding: "2.25rem 1.75rem",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        position: "relative",
        cursor: "default",
      }}
      className="group"
    >
      {/* Animated numeric value */}
      <p
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: "clamp(2.25rem,4.5vw,3.5rem)",
          fontWeight: 700,
          color: PFG,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          marginBottom: "1rem",
        }}
      >
        {display}
      </p>

      {/* Lime accent line that grows in */}
      <motion.div
        style={{ height: 2, background: AW, marginBottom: "1rem", borderRadius: 1 }}
        initial={{ width: "0%" }}
        animate={isInView ? { width: "2.5rem" } : { width: "0%" }}
        transition={{ duration: 0.6, delay: index * 0.09 + 0.2 }}
      />

      {/* Label */}
      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: PFG, marginBottom: "0.5rem", letterSpacing: "-0.01em" }}>
        {stat.label}
      </p>

      {/* Description */}
      {stat.description && (
        <p style={{ fontSize: "0.8125rem", color: MU, lineHeight: 1.55 }}>
          {stat.description}
        </p>
      )}

      {/* Hover right-border accent */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: "25%",
          bottom: "25%",
          width: 2,
          background: AW,
          borderRadius: 1,
          opacity: 0,
          transition: "opacity 0.3s",
        }}
        className="group-hover:!opacity-100"
      />
    </motion.div>
  );
}

interface Props {
  props: DsoStatShowcaseBlockProps;
}

export function BlockDsoStatShowcase({ props }: Props) {
  const { eyebrow = "By the Numbers", headline = "Results that compound at scale.", stats } = props;
  const displayStats = stats && stats.length > 0 ? stats.slice(0, 6) : DEFAULT_STATS;

  const sectionRef = useRef<HTMLElement>(null);
  const headerInView = useInView(sectionRef, { once: true });

  return (
    <section
      ref={sectionRef}
      style={{ background: P, color: PFG, position: "relative", overflow: "hidden" }}
      className="py-24 md:py-32"
    >
      {/* Subtle decorative glow */}
      <div
        style={{
          position: "absolute",
          top: -200,
          left: "50%",
          transform: "translateX(-50%)",
          width: 800,
          height: 400,
          background: "radial-gradient(ellipse, rgba(154,184,54,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "4.5rem" }}>
          {eyebrow && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={headerInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: AW,
                marginBottom: "1.25rem",
              }}
            >
              {eyebrow}
            </motion.p>
          )}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={headerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.75, delay: 0.06 }}
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(2rem,4vw,3rem)",
              lineHeight: 1.1,
              fontWeight: 600,
              color: PFG,
              letterSpacing: "-0.02em",
              maxWidth: 640,
              margin: "0 auto",
            }}
          >
            {headline}
          </motion.h2>
        </div>

        {/* Responsive stat grid — 1 col mobile, 2 col tablet, 3 col desktop */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          style={{
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {displayStats.map((stat, i) => (
            <div
              key={i}
              style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }}
            >
              <StatCard stat={stat} index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
