import { useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoFlowCanvasBlockProps } from "@/lib/block-types";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";
const PFG  = "hsl(48,100%,96%)";
const AW   = "hsl(68,60%,52%)";
const MUTED = "hsla(48,100%,96%,0.45)";

/* ── Animated orb config: [r, g, b], base position, sinusoidal range & speed ── */
const ORBS = [
  { bx: 0.18, by: 0.30, rx: 0.22, ry: 0.20, sx: 0.21, sy: 0.28, rad: 0.62, rgb: [0,  58, 36] },   // deep green
  { bx: 0.80, by: 0.55, rx: 0.18, ry: 0.16, sx:-0.18, sy: 0.23, rad: 0.52, rgb: [30, 90, 22] },   // mid green
  { bx: 0.50, by: 0.85, rx: 0.15, ry: 0.12, sx: 0.26, sy:-0.17, rad: 0.42, rgb: [70,120, 10] },   // lime
  { bx: 0.72, by: 0.18, rx: 0.16, ry: 0.14, sx:-0.22, sy: 0.31, rad: 0.44, rgb: [ 8, 70, 38] },   // teal
  { bx: 0.30, by: 0.70, rx: 0.14, ry: 0.18, sx: 0.19, sy:-0.25, rad: 0.38, rgb: [20, 80, 25] },   // forest
];

interface Props { props: DsoFlowCanvasBlockProps }

export function BlockDsoFlowCanvas({ props }: Props) {
  const {
    eyebrow = "The Dandy Standard",
    quote = "We didn't just digitize the lab workflow.\nWe rebuilt it from the ground up.",
    attribution = "Dandy Engineering Team",
    stat = "99.2%",
    statLabel = "First-Time Fit Rate — Network-Wide",
  } = props;

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const animRef    = useRef<number>(0);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-10%" });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      const p = canvas.parentElement;
      if (!p) return;
      canvas.width  = p.offsetWidth;
      canvas.height = p.offsetHeight;
    }
    resize();

    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    let start: number | null = null;

    function loop(ts: number) {
      if (!start) start = ts;
      const t  = (ts - start) / 1000;
      const W  = canvas.width;
      const H  = canvas.height;
      const mx = Math.max(W, H);

      /* base: very dark */
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#000e09";
      ctx.fillRect(0, 0, W, H);

      /* additive orbs */
      ctx.globalCompositeOperation = "screen";
      for (const o of ORBS) {
        const x = (o.bx + Math.sin(t * o.sx) * o.rx) * W;
        const y = (o.by + Math.cos(t * o.sy) * o.ry) * H;
        const r = o.rad * mx * 0.9;
        const [R, G, B] = o.rgb;

        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0,   `rgba(${R},${G},${B},0.65)`);
        g.addColorStop(0.35,`rgba(${R},${G},${B},0.28)`);
        g.addColorStop(0.7, `rgba(${R},${G},${B},0.08)`);
        g.addColorStop(1,   `rgba(${R},${G},${B},0)`);

        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.globalCompositeOperation = "source-over";
      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{ position: "relative", overflow: "hidden", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {/* aurora canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      />

      {/* grain texture overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        opacity: 0.035,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundRepeat: "repeat",
        backgroundSize: "256px 256px",
      }} />

      {/* dark center vignette keeps text readable */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 70% 70% at 50% 50%, rgba(0,14,9,0.45) 0%, rgba(0,14,9,0.10) 100%)",
      }} />

      {/* centered editorial content */}
      <div style={{ position: "relative", zIndex: 2, maxWidth: 900, margin: "0 auto", padding: "7rem 2.5rem", width: "100%", textAlign: "center" }}>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: AW, marginBottom: "3rem" }}
        >
          {eyebrow}
        </motion.p>

        {/* Big stat */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: "3rem" }}
        >
          <p style={{
            fontFamily: DISPLAY_FONT,
            fontSize: "clamp(5rem, 16vw, 14rem)",
            fontWeight: 900, color: AW,
            letterSpacing: "-0.06em", lineHeight: 0.88,
            textShadow: `0 0 80px rgba(199,231,56,0.35), 0 0 160px rgba(199,231,56,0.15)`,
          }}>
            {stat}
          </p>
          <p style={{ fontSize: "0.8125rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "hsla(68,60%,52%,0.65)", marginTop: "0.75rem" }}>
            {statLabel}
          </p>
        </motion.div>

        {/* Quote */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.22 }}
          style={{ maxWidth: 700, margin: "0 auto" }}
        >
          {/* Decorative quote mark */}
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: "4rem", lineHeight: 0.5, color: AW, opacity: 0.3, marginBottom: "1.25rem" }}>
            {"\u201C"}
          </div>
          <p style={{
            fontFamily: DISPLAY_FONT,
            fontSize: "clamp(1.25rem,2.5vw,1.875rem)",
            fontWeight: 600, color: PFG,
            letterSpacing: "-0.025em", lineHeight: 1.28,
            whiteSpace: "pre-line",
          }}>
            {quote}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "2rem", justifyContent: "center" }}>
            <div style={{ width: 32, height: 1, background: AW, opacity: 0.4 }} />
            <p style={{ fontSize: "0.8125rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED }}>
              {attribution}
            </p>
            <div style={{ width: 32, height: 1, background: AW, opacity: 0.4 }} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
