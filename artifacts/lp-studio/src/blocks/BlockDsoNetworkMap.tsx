import { useRef, useEffect, useState } from "react";
import { motion, useInView, animate, useMotionValue } from "framer-motion";
import type { DsoNetworkMapBlockProps } from "@/lib/block-types";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";
const P    = "#003A30";
const PFG  = "hsl(48,100%,96%)";
const AW   = "hsl(68,60%,52%)";
const MUTED = "hsla(48,100%,96%,0.5)";
const CARD  = "rgba(255,255,255,0.05)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

/* ── SVG layout ─────────────────────────────── */
const CX = 250, CY = 220;
const R  = 148;

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

/* ── Packet component (travels center→node→center) ── */
function Packet({ node, delay, inView }: {
  node: typeof OFFICES[0];
  delay: number;
  inView: boolean;
}) {
  const mx = useMotionValue(CX);
  const my = useMotionValue(CY);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const DURATION = 1.8;
    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        setOpacity(0);
        await new Promise(r => setTimeout(r, delay * 1000 + Math.random() * 800));
        if (cancelled) break;
        mx.set(CX);
        my.set(CY);
        setOpacity(1);
        await Promise.all([
          animate(mx, node.x, { duration: DURATION, ease: "easeIn" }),
          animate(my, node.y, { duration: DURATION, ease: "easeIn" }),
        ]);
        setOpacity(0.3);
        await new Promise(r => setTimeout(r, 180));
        setOpacity(1);
        await Promise.all([
          animate(mx, CX, { duration: DURATION, ease: "easeOut" }),
          animate(my, CY, { duration: DURATION, ease: "easeOut" }),
        ]);
        await new Promise(r => setTimeout(r, 600 + Math.random() * 500));
      }
    };
    run();
    return () => { cancelled = true; };
  }, [inView, node.x, node.y, delay]);

  return (
    <motion.circle
      r={3.5}
      fill={AW}
      style={{ x: mx, y: my, opacity }}
      filter="url(#glow-lime)"
    />
  );
}

/* ── Edge line (draws in when inView) ── */
function Edge({ node, idx, inView }: {
  node: typeof OFFICES[0];
  idx: number;
  inView: boolean;
}) {
  return (
    <motion.line
      x1={CX} y1={CY}
      x2={node.x} y2={node.y}
      stroke={AW}
      strokeWidth={1}
      strokeOpacity={0.25}
      strokeDasharray="4 4"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={inView ? { pathLength: 1, opacity: 1 } : {}}
      transition={{ duration: 0.8, delay: 0.3 + idx * 0.12, ease: "easeOut" }}
    />
  );
}

/* ── Office node ── */
function OfficeNode({ node, idx, inView }: {
  node: typeof OFFICES[0];
  idx: number;
  inView: boolean;
}) {
  const left = node.x < CX - 20;
  const anchor = left ? "end" : node.x > CX + 20 ? "start" : "middle";
  const labelX = anchor === "end" ? node.x - 14 : anchor === "start" ? node.x + 14 : node.x;
  const labelY = node.y > CY + 30 ? node.y + 22 : node.y < CY - 30 ? node.y - 14 : node.y;

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : {}}
      transition={{ duration: 0.5, delay: 0.8 + idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: `${node.x}px ${node.y}px` }}
    >
      {/* Outer ring */}
      <circle cx={node.x} cy={node.y} r={10} fill="none" stroke={AW} strokeWidth={1} strokeOpacity={0.35} />
      {/* Inner dot */}
      <circle cx={node.x} cy={node.y} r={5} fill={P} stroke={AW} strokeWidth={1.5} />
      {/* Label */}
      <text x={labelX} y={labelY + 4} textAnchor={anchor} fill={PFG} fontSize={9} fontWeight="600" fontFamily="Inter,system-ui,sans-serif" opacity={0.9}>
        {node.label}
      </text>
      <text x={labelX} y={labelY + 14} textAnchor={anchor} fill={AW} fontSize={7.5} fontFamily="Inter,system-ui,sans-serif" opacity={0.75}>
        {node.sub}
      </text>
    </motion.g>
  );
}

/* ── Stats strip that ticks up ── */
function TickStat({ target, suffix, label, delay, inView }: {
  target: number; suffix: string; label: string; delay: number; inView: boolean;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, target, {
      duration: 2,
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
      <p style={{ fontSize: "0.75rem", color: MUTED, marginTop: "0.3rem", letterSpacing: "0.04em" }}>{label}</p>
    </div>
  );
}

/* ── Main block ────────────────────────────────── */
interface Props { props: DsoNetworkMapBlockProps }

export function BlockDsoNetworkMap({ props }: Props) {
  const {
    eyebrow = "Dandy Network",
    headline = "One platform.\nEvery practice.",
    body = "Dandy connects your entire DSO into a single lab ecosystem — routing cases, surfacing insights, and standardizing outcomes across every location in real time.",
    ctaText = "See the Live Network",
    ctaUrl = "#",
  } = props;

  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-10%" });

  return (
    <section
      ref={sectionRef}
      style={{ background: P, padding: "0", overflow: "hidden", position: "relative" }}
    >
      {/* Subtle radial glow behind the SVG */}
      <div style={{
        position: "absolute",
        top: "50%", right: "-10%",
        width: "55%", aspectRatio: "1",
        background: `radial-gradient(circle, hsla(68,60%,52%,0.07) 0%, transparent 70%)`,
        transform: "translateY(-50%)",
        pointerEvents: "none",
      }} />

      <div style={{
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
            <TickStat target={500} suffix="+" label="DSO Locations" delay={0.5} inView={inView} />
            <TickStat target={96} suffix="%" label="First-Time Right" delay={0.65} inView={inView} />
            <TickStat target={4} suffix="d" label="Avg Turnaround" delay={0.8} inView={inView} />
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
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </a>
            </motion.div>
          )}
        </div>

        {/* ── Right: SVG network ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
          <svg
            viewBox="0 0 500 450"
            width="100%"
            style={{ maxWidth: 520, display: "block" }}
            overflow="visible"
          >
            <defs>
              {/* Glow filters */}
              <filter id="glow-lime" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-center" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <radialGradient id="center-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={AW} stopOpacity="0.22" />
                <stop offset="100%" stopColor={AW} stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Background radial halo */}
            <motion.circle
              cx={CX} cy={CY} r={175}
              fill="url(#center-grad)"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={inView ? { scale: 1, opacity: 1 } : {}}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
            />

            {/* Grid: subtle concentric rings */}
            {[60, 100, 148, 190].map((r, i) => (
              <motion.circle
                key={r}
                cx={CX} cy={CY} r={r}
                fill="none"
                stroke={AW}
                strokeWidth={0.5}
                strokeOpacity={0.08}
                initial={{ scale: 0, opacity: 0 }}
                animate={inView ? { scale: 1, opacity: 1 } : {}}
                transition={{ duration: 0.8, delay: i * 0.1 }}
                style={{ transformOrigin: `${CX}px ${CY}px` }}
              />
            ))}

            {/* Edges */}
            {OFFICES.map((node, i) => <Edge key={i} node={node} idx={i} inView={inView} />)}

            {/* Data packets */}
            {inView && OFFICES.map((node, i) => <Packet key={i} node={node} delay={i * 0.35} inView={inView} />)}

            {/* Office nodes */}
            {OFFICES.map((node, i) => <OfficeNode key={i} node={node} idx={i} inView={inView} />)}

            {/* Center: pulsing rings */}
            {inView && [1, 2, 3].map(i => (
              <motion.circle
                key={i}
                cx={CX} cy={CY}
                r={28}
                fill="none"
                stroke={AW}
                strokeWidth={1.5}
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 2.6 + i * 0.5, opacity: 0 }}
                transition={{ duration: 2, delay: i * 0.65, repeat: Infinity, ease: "easeOut" }}
                style={{ transformOrigin: `${CX}px ${CY}px` }}
              />
            ))}

            {/* Center hub */}
            <motion.g
              initial={{ scale: 0, opacity: 0 }}
              animate={inView ? { scale: 1, opacity: 1 } : {}}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
              filter="url(#glow-center)"
            >
              <circle cx={CX} cy={CY} r={30} fill={AW} opacity={0.15} />
              <circle cx={CX} cy={CY} r={22} fill={P} stroke={AW} strokeWidth={2} />
              {/* Dandy "D" logotype mark */}
              <text x={CX} y={CY + 5} textAnchor="middle" fill={AW} fontSize={16} fontWeight="800" fontFamily={DISPLAY_FONT}>
                D
              </text>
            </motion.g>

            {/* Center label */}
            <motion.text
              x={CX} y={CY + 48}
              textAnchor="middle"
              fill={PFG}
              fontSize={9}
              fontWeight="700"
              fontFamily="Inter,system-ui,sans-serif"
              letterSpacing="0.1em"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 0.85 } : {}}
              transition={{ duration: 0.5, delay: 0.9 }}
            >
              DANDY HUB
            </motion.text>
          </svg>
        </div>
      </div>

      {/* Mobile stack tweak */}
      <style>{`
        @media (max-width: 767px) {
          .dsomg-grid { grid-template-columns: 1fr !important; min-height: unset !important; }
        }
      `}</style>
    </section>
  );
}
