import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoStatShowcaseBlockProps } from "@/lib/block-types";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const P   = "hsl(152,42%,12%)";
const PFG = "hsl(48,100%,96%)";
const AW  = "hsl(68,60%,52%)";
const MU  = "rgba(255,255,255,0.46)";

const DEFAULT_STATS: DsoStatShowcaseBlockProps["stats"] = [
  { value: "96%",    label: "First-time right rate",   desc: "Industry-leading precision at enterprise scale" },
  { value: "12,000+", label: "Dental practices",        desc: "Trust Dandy for their lab work" },
  { value: "4.2 days", label: "Average turnaround",     desc: "Including AI review and quality control" },
  { value: "$0",     label: "CAPEX to start",           desc: "All hardware included at no upfront cost" },
  { value: "30%",    label: "Case acceptance lift",     desc: "On average across DSO partner networks" },
  { value: "100%",   label: "AI quality screened",      desc: "Every scan reviewed before it leaves the chair" },
];

function StatCard({ stat, index }: { stat: DsoStatShowcaseBlockProps["stats"][number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      transition={{ duration: 0.75, delay: index * 0.09, ease: [0.16, 1, 0.3, 1] }}
      style={{
        padding: "2.25rem 2rem",
        borderTop: `1px solid rgba(255,255,255,0.08)`,
        position: "relative",
        cursor: "default",
      }}
      className="group"
    >
      {/* Value */}
      <motion.p
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: "clamp(2.5rem,5vw,3.75rem)",
          fontWeight: 700,
          color: PFG,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          marginBottom: "1rem",
        }}
        animate={isInView ? { filter: "blur(0px)" } : { filter: "blur(6px)" }}
        transition={{ duration: 0.6, delay: index * 0.09 + 0.1 }}
      >
        {stat.value}
      </motion.p>

      {/* Lime accent line */}
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
      {stat.desc && (
        <p style={{ fontSize: "0.8125rem", color: MU, lineHeight: 1.55 }}>
          {stat.desc}
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
  const {
    eyebrow = "By the Numbers",
    headline = "Results that compound at scale.",
    stats,
  } = props;

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
          background: `radial-gradient(ellipse, rgba(154,184,54,0.08) 0%, transparent 70%)`,
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

        {/* Stat grid — 3 cols desktop, 2 cols tablet, 1 col mobile */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            borderLeft: `1px solid rgba(255,255,255,0.08)`,
            borderBottom: `1px solid rgba(255,255,255,0.08)`,
          }}
          className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        >
          {displayStats.map((stat, i) => (
            <div
              key={i}
              style={{ borderRight: `1px solid rgba(255,255,255,0.08)` }}
            >
              <StatCard stat={stat} index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
