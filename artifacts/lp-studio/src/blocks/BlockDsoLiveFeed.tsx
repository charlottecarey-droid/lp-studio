import { useRef, useState, useEffect } from "react";
import { motion, useInView, animate } from "framer-motion";
import type { DsoLiveFeedBlockProps } from "@/lib/block-types";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";
const P     = "#003A30";
const PFG   = "hsl(48,100%,96%)";
const AW    = "hsl(68,60%,52%)";
const MUTED = "hsla(48,100%,96%,0.45)";
const ROW_BORDER = "rgba(255,255,255,0.07)";
const CARD  = "rgba(0,0,0,0.25)";

interface Metric {
  label: string;
  value: number;
  unit: string;
  direction: "up" | "down";
  sparkline: number[];
  good: "high" | "low";
}

const BASE_METRICS: Metric[] = [
  { label: "First-Time Right Rate",   value: 96.4, unit: "%",  direction: "up",   good: "high", sparkline: [90,92,93,91,94,95,96.4] },
  { label: "Avg Turnaround Time",     value: 3.8,  unit: "d",  direction: "down", good: "low",  sparkline: [5.1,4.8,4.6,4.3,4.1,3.9,3.8] },
  { label: "Remake Rate",             value: 2.1,  unit: "%",  direction: "down", good: "low",  sparkline: [5.8,5.0,4.2,3.5,3.0,2.5,2.1] },
  { label: "Cases Submitted Today",   value: 847,  unit: "",   direction: "up",   good: "high", sparkline: [610,680,710,750,790,822,847] },
  { label: "Provider Adoption",       value: 91,   unit: "%",  direction: "up",   good: "high", sparkline: [67,71,76,80,84,88,91] },
  { label: "Avg Satisfaction Score",  value: 4.7,  unit: "/5", direction: "up",   good: "high", sparkline: [4.1,4.2,4.3,4.4,4.5,4.6,4.7] },
];

/* ── Sparkline SVG ── */
function Sparkline({ data, good }: { data: number[]; good: "high" | "low" }) {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const W = 56, H = 20;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={AW} strokeWidth="1.5" strokeOpacity="0.6" strokeLinejoin="round" />
      {/* End dot */}
      {(() => {
        const last = data[data.length - 1];
        const x = W;
        const y = H - ((last - min) / range) * H;
        return <circle cx={x} cy={y} r={2.5} fill={AW} />;
      })()}
    </svg>
  );
}

/* ── Single metric row ── */
function MetricRow({ metric, idx, inView }: { metric: Metric; idx: number; inView: boolean }) {
  const [display, setDisplay] = useState(metric.value);
  const [flash, setFlash] = useState(false);
  const [localDir, setLocalDir] = useState(metric.direction);

  useEffect(() => {
    if (!inView) return;
    const TICK_MIN = 3500 + idx * 800;
    const TICK_MAX = 8000 + idx * 600;
    let timeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      const delta = metric.unit === "%" || metric.unit === "/5"
        ? (Math.random() - 0.48) * 0.3
        : Math.random() > 0.4 ? Math.ceil(Math.random() * 8) : -Math.ceil(Math.random() * 3);

      const newVal = Math.max(0, parseFloat((display + delta).toFixed(metric.unit === "" ? 0 : 1)));
      setLocalDir(newVal >= display ? "up" : "down");
      setFlash(true);
      setTimeout(() => setFlash(false), 700);

      const controls = animate(display, newVal, {
        duration: 0.6,
        ease: "easeOut",
        onUpdate: v => setDisplay(parseFloat(v.toFixed(metric.unit === "" ? 0 : 1))),
      });

      const next = TICK_MIN + Math.random() * (TICK_MAX - TICK_MIN);
      timeout = setTimeout(tick, next);
      return controls.stop;
    };

    const initial = TICK_MIN * 0.4 + Math.random() * TICK_MIN;
    timeout = setTimeout(tick, initial);
    return () => clearTimeout(timeout);
  }, [inView, idx]);

  const isGood = (metric.good === "high" && localDir === "up") || (metric.good === "low" && localDir === "down");

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.4 + idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto",
        alignItems: "center",
        gap: "1.5rem",
        padding: "1rem 1.5rem",
        borderTop: `1px solid ${ROW_BORDER}`,
        background: flash ? "rgba(199,231,56,0.04)" : "transparent",
        transition: "background 0.4s",
      }}
    >
      {/* Label */}
      <p style={{ fontSize: "0.875rem", color: MUTED, fontWeight: 500 }}>{metric.label}</p>

      {/* Sparkline */}
      <div className="hidden md:block">
        <Sparkline data={metric.sparkline} good={metric.good} />
      </div>

      {/* Direction arrow */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.75rem", color: isGood ? AW : "hsl(4,80%,60%)", fontWeight: 700, lineHeight: 1 }}>
          {localDir === "up" ? "↑" : "↓"}
        </span>
      </div>

      {/* Value */}
      <p style={{
        fontFamily: DISPLAY_FONT,
        fontSize: "1.25rem",
        fontWeight: 700,
        color: flash ? AW : PFG,
        letterSpacing: "-0.03em",
        minWidth: "4rem",
        textAlign: "right",
        transition: "color 0.3s",
      }}>
        {display.toLocaleString(undefined, { maximumFractionDigits: 1 })}{metric.unit}
      </p>
    </motion.div>
  );
}

/* ── Main block ── */
interface Props { props: DsoLiveFeedBlockProps }

export function BlockDsoLiveFeed({ props }: Props) {
  const {
    eyebrow = "Platform Intelligence",
    headline = "Dandy sees everything.\nYour team acts on what matters.",
    body = "Every metric from every location, streaming in real time. The Dandy dashboard transforms raw case data into executive-ready intelligence — automatically.",
    footerNote = "Live data from 127 DSO locations across 14 states",
  } = props;

  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-10%" });
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 1200);
    return () => clearInterval(id);
  }, []);

  return (
    <section ref={sectionRef} style={{ background: P, padding: "6rem 1.5rem", position: "relative", overflow: "hidden" }}>
      {/* Background radial glow */}
      <div style={{ position: "absolute", top: "30%", right: "-5%", width: "40%", aspectRatio: "1", background: "radial-gradient(circle, hsla(68,60%,52%,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* 2-col layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "5rem", alignItems: "start" }}
          className="dsolf-grid"
        >
          {/* Left: text */}
          <div style={{ paddingTop: "2rem" }}>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: AW, marginBottom: "1.5rem" }}
            >
              {eyebrow}
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.08 }}
              style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(1.875rem,3.5vw,3rem)", fontWeight: 700, color: PFG, letterSpacing: "-0.04em", lineHeight: 1.05, marginBottom: "1.5rem", whiteSpace: "pre-line" }}
            >
              {headline}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.16 }}
              style={{ fontSize: "1rem", lineHeight: 1.72, color: "hsla(48,100%,96%,0.5)" }}
            >
              {body}
            </motion.p>

            {/* Live indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.35 }}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "2.5rem" }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: pulse ? AW : "transparent",
                boxShadow: pulse ? `0 0 8px ${AW}` : "none",
                border: `1.5px solid ${AW}`,
                transition: "all 0.4s ease",
              }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: AW }}>
                Live Feed Active
              </span>
            </motion.div>
          </div>

          {/* Right: terminal */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            style={{
              background: CARD,
              border: `1px solid rgba(255,255,255,0.10)`,
              borderRadius: "1.25rem",
              overflow: "hidden",
            }}
          >
            {/* Terminal header bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1.5rem", borderBottom: `1px solid ${ROW_BORDER}` }}>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {["#B45309", "#6B7280", AW].map((c, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: c, opacity: 0.7 }} />
                ))}
              </div>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED }}>
                DSO Insights — Live
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: pulse ? AW : "transparent",
                  border: `1.5px solid ${AW}`,
                  boxShadow: pulse ? `0 0 6px ${AW}` : "none",
                  transition: "all 0.4s",
                }} />
                <span style={{ fontSize: "0.625rem", color: AW, fontWeight: 700, letterSpacing: "0.1em" }}>LIVE</span>
              </div>
            </div>

            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "1.5rem", padding: "0.6rem 1.5rem", borderBottom: `1px solid ${ROW_BORDER}` }}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>Metric</p>
              <p className="hidden md:block" style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>Trend</p>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}></p>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textAlign: "right" }}>Value</p>
            </div>

            {/* Rows */}
            <div>
              {BASE_METRICS.map((m, i) => (
                <MetricRow key={i} metric={m} idx={i} inView={inView} />
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: "0.75rem 1.5rem", borderTop: `1px solid ${ROW_BORDER}`, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: AW, opacity: 0.6 }} />
              <p style={{ fontSize: "0.6875rem", color: MUTED, fontStyle: "italic" }}>{footerNote}</p>
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .dsolf-grid { grid-template-columns: 1fr !important; gap: 3rem !important; }
        }
      `}</style>
    </section>
  );
}
