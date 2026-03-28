import { useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoFlowCanvasBlockProps } from "@/lib/block-types";
import { getBgStyle } from "@/lib/bg-styles";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";
const PFG   = "hsl(48,100%,96%)";
const AW    = "hsl(68,60%,52%)";
const MUTED = "hsla(48,100%,96%,0.48)";
const BG    = "#050e08";

/* ── Orbs: much more subtle now — atmospheric depth, not hero feature ── */
const ORBS = [
  { bx: 0.15, by: 0.35, rx: 0.20, ry: 0.18, sx: 0.19, sy: 0.24, rad: 0.70, rgb: [0,  46, 28],  a: 0.22 },
  { bx: 0.82, by: 0.60, rx: 0.14, ry: 0.13, sx:-0.16, sy: 0.20, rad: 0.58, rgb: [20, 68, 16],  a: 0.18 },
  { bx: 0.50, by: 0.90, rx: 0.12, ry: 0.10, sx: 0.22, sy:-0.14, rad: 0.44, rgb: [55, 98,  8],  a: 0.14 },
  { bx: 0.68, by: 0.20, rx: 0.13, ry: 0.11, sx:-0.20, sy: 0.27, rad: 0.46, rgb: [ 5, 55, 30],  a: 0.16 },
];

interface Props { props: DsoFlowCanvasBlockProps }

export function BlockDsoFlowCanvas({ props }: Props) {
  const {
    eyebrow     = "The Dandy Standard",
    quote       = "We didn't just digitize the lab workflow.\nWe rebuilt it from the ground up.",
    attribution = "Dandy Engineering Team",
    stat        = "99.2%",
    statLabel   = "First-Time Fit Rate — Network-Wide",
    imageUrl    = "",
    backgroundStyle = "dandy-green",
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
      const t = (ts - start) / 1000;
      const W = canvas.width, H = canvas.height;
      const mx = Math.max(W, H);

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = "screen";
      for (const o of ORBS) {
        const x = (o.bx + Math.sin(t * o.sx) * o.rx) * W;
        const y = (o.by + Math.cos(t * o.sy) * o.ry) * H;
        const r = o.rad * mx * 0.85;
        const [R, G, B] = o.rgb;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0,    `rgba(${R},${G},${B},${o.a})`);
        g.addColorStop(0.45, `rgba(${R},${G},${B},${o.a * 0.4})`);
        g.addColorStop(1,    `rgba(${R},${G},${B},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalCompositeOperation = "source-over";
      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, []);

  const hasImage = Boolean(imageUrl);

  return (
    <section
      ref={sectionRef}
      style={{ position: "relative", overflow: "hidden", minHeight: "100vh", display: "flex", alignItems: "stretch", ...getBgStyle(backgroundStyle) }}
    >
      {/* Canvas — atmospheric background */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      />

      {/* Film grain */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundRepeat: "repeat", backgroundSize: "256px 256px",
      }} />

      {/* Full-bleed left-column image */}
      {hasImage && (
        <>
          <div style={{
            position: "absolute", left: 0, top: 0,
            width: "50%", height: "100%",
            overflow: "hidden", zIndex: 1,
          }}>
            <img
              src={imageUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
            />
            {/* Fade-to-right edge so image bleeds into canvas/content */}
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(to right, transparent 55%, ${BG} 100%)`,
            }} />
            {/* Subtle top/bottom edge fade */}
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(to bottom, ${BG} 0%, transparent 12%, transparent 88%, ${BG} 100%)`,
            }} />
          </div>
          {/* Vignette from the right side covering canvas area */}
          <div style={{
            position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
            background: `linear-gradient(to left, transparent 40%, ${BG} 100%)`,
          }} />
        </>
      )}

      {/* Content grid */}
      <div
        className="dfc-grid"
        style={{
          position: "relative", zIndex: 2,
          maxWidth: 1200, margin: "0 auto",
          padding: "8rem 2.5rem", width: "100%",
          display: "grid",
          gridTemplateColumns: hasImage ? "1fr 1fr" : "1fr",
          alignItems: "center",
          gap: "5rem",
        }}
      >
        {/* Left spacer when image present */}
        {hasImage && <div />}

        {/* Right (or only) column: editorial content */}
        <motion.div
          initial={{ opacity: 0, x: hasImage ? 32 : 0, y: hasImage ? 0 : 20 }}
          animate={inView ? { opacity: 1, x: 0, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Eyebrow */}
          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.20em",
            textTransform: "uppercase", color: AW, marginBottom: "2.5rem",
          }}>
            {eyebrow}
          </p>

          {/* Stat block */}
          <div style={{
            paddingBottom: "2.5rem",
            marginBottom: "2.5rem",
            borderBottom: "1px solid rgba(199,231,56,0.14)",
          }}>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.75, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: "clamp(4rem, 9vw, 8.5rem)",
                fontWeight: 900, color: PFG,
                letterSpacing: "-0.055em", lineHeight: 0.88,
                marginBottom: "0.85rem",
              }}
            >
              {stat}
            </motion.p>
            <p style={{
              fontSize: "0.75rem", fontWeight: 700,
              letterSpacing: "0.18em", textTransform: "uppercase",
              color: AW,
            }}>
              {statLabel}
            </p>
          </div>

          {/* Quote */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.28 }}
          >
            <p style={{
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(1.125rem, 2vw, 1.5rem)",
              fontWeight: 500, color: MUTED,
              letterSpacing: "-0.02em", lineHeight: 1.45,
              whiteSpace: "pre-line",
              marginBottom: "2rem",
            }}>
              {"\u201C"}{quote}{"\u201D"}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
              <div style={{ width: 24, height: 1, background: AW, opacity: 0.35, flexShrink: 0 }} />
              <p style={{
                fontSize: "0.6875rem", fontWeight: 700,
                letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED,
              }}>
                {attribution}
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dfc-grid { grid-template-columns: 1fr !important; gap: 2.5rem !important; }
        }
      `}</style>
    </section>
  );
}
