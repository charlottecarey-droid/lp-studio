import { useRef } from "react";
import { motion, useInView, animate } from "framer-motion";
import { useEffect, useState } from "react";
import type { DsoNetworkMapBlockProps } from "@/lib/block-types";
import { getBgStyle } from "@/lib/bg-styles";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";
const P     = "#003A30";
const PFG   = "hsl(48,100%,96%)";
const AW    = "hsl(68,60%,52%)";
const MUTED = "hsla(48,100%,96%,0.5)";
const CARD  = "rgba(255,255,255,0.05)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

/* ── SVG layout ─────────────────────────────── */
const CX = 250, CY = 230;
const R  = 152;

const OFFICES = [
  { label: "Chicago",  sub: "127 locations", angle: -90  },
  { label: "Houston",  sub: "84 locations",  angle: -30  },
  { label: "Atlanta",  sub: "61 locations",  angle:  30  },
  { label: "Phoenix",  sub: "53 locations",  angle:  90  },
  { label: "Denver",   sub: "49 locations",  angle: 150  },
  { label: "Dallas",   sub: "72 locations",  angle: 210  },
].map(o => ({
  ...o,
  x: CX + Math.cos(o.angle * Math.PI / 180) * R,
  y: CY + Math.sin(o.angle * Math.PI / 180) * R,
}));

/* ── Edge — solid line that draws in ── */
function Edge({ node, idx, inView }: {
  node: typeof OFFICES[0];
  idx: number;
  inView: boolean;
}) {
  const len = Math.hypot(node.x - CX, node.y - CY);
  const gradId = `edge-grad-${idx}`;
  return (
    <>
      <defs>
        <linearGradient id={gradId} x1={CX} y1={CY} x2={node.x} y2={node.y} gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={AW} stopOpacity="0.55" />
          <stop offset="100%" stopColor={AW} stopOpacity="0.10" />
        </linearGradient>
      </defs>
      <motion.line
        x1={CX} y1={CY}
        x2={node.x} y2={node.y}
        stroke={`url(#${gradId})`}
        strokeWidth={1}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={inView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 1.1, delay: 0.4 + idx * 0.1, ease: "easeOut" }}
        style={{ "--len": len } as React.CSSProperties}
      />
    </>
  );
}

/* ── Office node — precision dot style ── */
function OfficeNode({ node, idx, inView }: {
  node: typeof OFFICES[0];
  idx: number;
  inView: boolean;
}) {
  const left   = node.x < CX - 20;
  const right  = node.x > CX + 20;
  const anchor = left ? "end" : right ? "start" : "middle";
  const dx     = left ? -18 : right ? 18 : 0;
  const dy     = node.y > CY + 30 ? 20 : node.y < CY - 30 ? -12 : 0;
  const lx     = node.x + dx;
  const ly     = node.y + dy;

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : {}}
      transition={{ duration: 0.5, delay: 1.0 + idx * 0.09, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: `${node.x}px ${node.y}px` }}
    >
      {/* Precision tick: 4 short lines from dot */}
      {[0, 90, 180, 270].map(a => (
        <line
          key={a}
          x1={node.x + Math.cos(a * Math.PI / 180) * 7}
          y1={node.y + Math.sin(a * Math.PI / 180) * 7}
          x2={node.x + Math.cos(a * Math.PI / 180) * 11}
          y2={node.y + Math.sin(a * Math.PI / 180) * 11}
          stroke={AW}
          strokeWidth={0.75}
          strokeOpacity={0.5}
        />
      ))}
      {/* Core dot */}
      <circle cx={node.x} cy={node.y} r={4} fill={PFG} />
      <circle cx={node.x} cy={node.y} r={4} fill="none" stroke={AW} strokeWidth={1} strokeOpacity={0.6} />
      {/* Labels */}
      <text
        x={lx} y={ly + 4}
        textAnchor={anchor}
        fill={PFG}
        fontSize={9.5}
        fontWeight="600"
        fontFamily="Inter,system-ui,sans-serif"
        opacity={0.92}
        letterSpacing="0.01em"
      >
        {node.label}
      </text>
      <text
        x={lx} y={ly + 15}
        textAnchor={anchor}
        fill={AW}
        fontSize={7.5}
        fontFamily="Inter,system-ui,sans-serif"
        opacity={0.65}
        letterSpacing="0.02em"
      >
        {node.sub}
      </text>
    </motion.g>
  );
}

/* ── Animated counter ── */
function TickStat({ target, suffix, label, delay, inView }: {
  target: number; suffix: string; label: string; delay: number; inView: boolean;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, target, {
      duration: 2.2,
      delay,
      ease: "easeOut",
      onUpdate: v => setVal(Math.round(v)),
    });
    return controls.stop;
  }, [inView, target, delay]);
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(1.5rem,3.5vw,2.25rem)", fontWeight: 700, color: AW, letterSpacing: "-0.03em", lineHeight: 1 }}>
        {val.toLocaleString()}{suffix}
      </p>
      <p style={{ fontSize: "0.75rem", color: MUTED, marginTop: "0.3rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</p>
    </div>
  );
}

/* ── Main block ────────────────────────────────── */
interface Props { props: DsoNetworkMapBlockProps }

export function BlockDsoNetworkMap({ props }: Props) {
  const {
    eyebrow    = "Dandy Network",
    headline   = "One platform.\nEvery practice.",
    body       = "Dandy connects your entire DSO into a single lab ecosystem — routing cases, surfacing insights, and standardizing outcomes across every location in real time.",
    ctaText    = "See the Live Network",
    ctaUrl     = "#",
    backgroundStyle = "dandy-green",
  } = props;

  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-10%" });

  return (
    <section
      ref={sectionRef}
      style={{ ...getBgStyle(backgroundStyle), padding: "0", overflow: "hidden", position: "relative" }}
    >
      {/* Ambient glow behind graphic */}
      <div style={{
        position: "absolute",
        top: "50%", right: "-5%",
        width: "50%", aspectRatio: "1",
        background: `radial-gradient(circle, hsla(68,60%,52%,0.06) 0%, transparent 68%)`,
        transform: "translateY(-50%)",
        pointerEvents: "none",
      }} />

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          alignItems: "center",
          minHeight: "100svh",
        }}
        className="dsomg-grid"
      >
        {/* ── Left: text ── */}
        <div style={{ padding: "clamp(3rem,8vw,7rem) clamp(1.5rem,5vw,4.5rem)" }}>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: AW, marginBottom: "1.5rem" }}
          >
            {eyebrow}
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.08 }}
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(2.25rem,5vw,4rem)",
              fontWeight: 700,
              color: PFG,
              letterSpacing: "-0.04em",
              lineHeight: 1.0,
              marginBottom: "1.5rem",
              whiteSpace: "pre-line",
            }}
          >
            {headline}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.16 }}
            style={{ fontSize: "clamp(0.9375rem,1.1vw,1.0625rem)", lineHeight: 1.72, color: MUTED, maxWidth: 440, marginBottom: "2.5rem" }}
          >
            {body}
          </motion.p>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.24 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1rem",
              background: CARD,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: "1rem",
              padding: "1.5rem 1rem",
              marginBottom: "2.5rem",
            }}
          >
            <TickStat target={500} suffix="+" label="DSO Locations"    delay={0.5}  inView={inView} />
            <TickStat target={96}  suffix="%" label="First-Time Right"  delay={0.65} inView={inView} />
            <TickStat target={4}   suffix="d" label="Avg Turnaround"    delay={0.8}  inView={inView} />
          </motion.div>

          {ctaText && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.32 }}
            >
              <a
                href={ctaUrl || "#"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.875rem 2rem",
                  background: AW,
                  color: P,
                  fontFamily: DISPLAY_FONT,
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  borderRadius: "0.5rem",
                  textDecoration: "none",
                  letterSpacing: "-0.01em",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                {ctaText}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </motion.div>
          )}
        </div>

        {/* ── Right: SVG network ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
          <svg
            viewBox="0 0 500 470"
            width="100%"
            style={{ maxWidth: 520, display: "block" }}
            overflow="visible"
          >
            <defs>
              {/* Hub glow */}
              <filter id="glow-hub" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              {/* Dot glow */}
              <filter id="glow-dot" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              {/* Radial ambient */}
              <radialGradient id="ambient" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor={AW} stopOpacity="0.14" />
                <stop offset="100%" stopColor={AW} stopOpacity="0"    />
              </radialGradient>
              {/* Hub face gradient */}
              <radialGradient id="hub-face" cx="38%" cy="35%" r="65%">
                <stop offset="0%"   stopColor="hsl(140,30%,28%)" />
                <stop offset="100%" stopColor={P} />
              </radialGradient>
            </defs>

            {/* Ambient radial field */}
            <motion.circle
              cx={CX} cy={CY} r={190}
              fill="url(#ambient)"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={inView ? { scale: 1, opacity: 1 } : {}}
              transition={{ duration: 1.4, ease: "easeOut" }}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
            />

            {/* Architecture rings — very faint */}
            {[70, 120, 170].map((r, i) => (
              <motion.circle
                key={r}
                cx={CX} cy={CY} r={r}
                fill="none"
                stroke={AW}
                strokeWidth={0.4}
                strokeOpacity={0.07}
                initial={{ scale: 0, opacity: 0 }}
                animate={inView ? { scale: 1, opacity: 1 } : {}}
                transition={{ duration: 1, delay: 0.2 + i * 0.1 }}
                style={{ transformOrigin: `${CX}px ${CY}px` }}
              />
            ))}

            {/* Edges (solid gradient lines) */}
            {OFFICES.map((node, i) => (
              <Edge key={i} node={node} idx={i} inView={inView} />
            ))}

            {/* Office nodes */}
            {OFFICES.map((node, i) => (
              <OfficeNode key={i} node={node} idx={i} inView={inView} />
            ))}

            {/* Single slow ambient pulse on center — restrained */}
            {inView && (
              <motion.circle
                cx={CX} cy={CY}
                r={36}
                fill="none"
                stroke={AW}
                strokeWidth={0.75}
                initial={{ scale: 1, opacity: 0.3 }}
                animate={{ scale: 2.8, opacity: 0 }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeOut", repeatDelay: 1.2 }}
                style={{ transformOrigin: `${CX}px ${CY}px` }}
              />
            )}

            {/* Center hub */}
            <motion.g
              initial={{ scale: 0, opacity: 0 }}
              animate={inView ? { scale: 1, opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
              filter="url(#glow-hub)"
            >
              {/* Outer ring */}
              <circle cx={CX} cy={CY} r={36} fill="none" stroke={AW} strokeWidth={0.75} strokeOpacity={0.3} />
              {/* Inner ring */}
              <circle cx={CX} cy={CY} r={28} fill="none" stroke={AW} strokeWidth={0.5} strokeOpacity={0.2} />
              {/* Hub face */}
              <circle cx={CX} cy={CY} r={24} fill="url(#hub-face)" stroke={AW} strokeWidth={1.25} strokeOpacity={0.7} />
              {/* Crosshair marks — precision instrument feel */}
              {[0, 90, 180, 270].map(a => (
                <line
                  key={a}
                  x1={CX + Math.cos(a * Math.PI / 180) * 10}
                  y1={CY + Math.sin(a * Math.PI / 180) * 10}
                  x2={CX + Math.cos(a * Math.PI / 180) * 16}
                  y2={CY + Math.sin(a * Math.PI / 180) * 16}
                  stroke={AW}
                  strokeWidth={1.25}
                  strokeOpacity={0.8}
                  strokeLinecap="round"
                />
              ))}
              {/* Center point */}
              <circle cx={CX} cy={CY} r={2.5} fill={AW} />
            </motion.g>

            {/* DANDY HUB label below hub */}
            <motion.text
              x={CX} y={CY + 52}
              textAnchor="middle"
              fill={PFG}
              fontSize={8}
              fontWeight="700"
              fontFamily="Inter,system-ui,sans-serif"
              letterSpacing="0.14em"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 0.6 } : {}}
              transition={{ duration: 0.6, delay: 1.1 }}
            >
              DANDY HUB
            </motion.text>
          </svg>
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .dsomg-grid { grid-template-columns: 1fr !important; min-height: unset !important; }
        }
      `}</style>
    </section>
  );
}
