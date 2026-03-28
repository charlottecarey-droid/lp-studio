import { useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoParticleMeshBlockProps } from "@/lib/block-types";
import { getBgStyle } from "@/lib/bg-styles";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";
const PFG   = "hsl(48,100%,96%)";
const AW    = "hsl(68,60%,52%)";
const MUTED = "hsla(48,100%,96%,0.42)";
const BG    = "#001a13";

/* ── Particle engine ── */
interface Particle { x: number; y: number; vx: number; vy: number; r: number; opacity: number }

function makeParticles(W: number, H: number, n: number): Particle[] {
  return Array.from({ length: n }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
    r: Math.random() * 1.5 + 0.6, opacity: Math.random() * 0.55 + 0.25,
  }));
}

interface Props { props: DsoParticleMeshBlockProps }

export function BlockDsoParticleMesh({ props }: Props) {
  const {
    eyebrow    = "AI-Driven Intelligence",
    headline   = "Every case,\nconnected.",
    body       = "Dandy's neural lab infrastructure routes, validates, and delivers with machine precision — connecting every practice, every provider, every outcome.",
    stat1Value = "500+", stat1Label = "Locations",
    stat2Value = "96%",  stat2Label = "First-Time Right",
    stat3Value = "< 4d", stat3Label = "Avg Turnaround",
    imageUrl   = "",
    imagePosition = "right",
    backgroundStyle = "dandy-green",
  } = props;

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const animRef    = useRef<number>(0);
  const pRef       = useRef<Particle[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: false, margin: "-5%" });

  /* ── Canvas particle animation ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.innerWidth < 768;
    const N    = isMobile ? 45 : 85;
    const DIST = isMobile ? 95 : 130;

    function resize() {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width  = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
      pRef.current  = makeParticles(canvas.width, canvas.height, N);
    }
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    function loop() {
      if (!ctx || !canvas) return;
      const W = canvas.width, H = canvas.height;
      const ps = pRef.current;

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      for (const p of ps) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      }

      ctx.shadowBlur = 0;
      const D2 = DIST * DIST;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < D2) {
            ctx.globalAlpha = (1 - Math.sqrt(d2) / DIST) * 0.22;
            ctx.strokeStyle = "#C7E738";
            ctx.lineWidth   = 0.7;
            ctx.beginPath();
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(ps[j].x, ps[j].y);
            ctx.stroke();
          }
        }
      }

      ctx.shadowColor = "#C7E738";
      ctx.shadowBlur  = 8;
      for (const p of ps) {
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle   = "#C7E738";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;

      animRef.current = requestAnimationFrame(loop);
    }

    loop();
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, []);

  const hasImage   = Boolean(imageUrl);
  const imgOnLeft  = imagePosition === "left";

  const stats = [
    { value: stat1Value, label: stat1Label },
    { value: stat2Value, label: stat2Label },
    { value: stat3Value, label: stat3Label },
  ];

  return (
    <section
      ref={sectionRef}
      style={{ position: "relative", overflow: "hidden", minHeight: "100vh", display: "flex", alignItems: "stretch", ...getBgStyle(backgroundStyle) }}
    >
      {/* Particle canvas — fills entire section */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      />

      {/* Full-bleed image column */}
      {hasImage && (
        <>
          <div style={{
            position: "absolute",
            left:  imgOnLeft ? 0 : "50%",
            right: imgOnLeft ? "50%" : 0,
            top: 0, bottom: 0,
            overflow: "hidden", zIndex: 1,
          }}>
            <motion.img
              src={imageUrl}
              alt=""
              animate={{
                scale:  [1.06, 1.10, 1.07, 1.06],
                x:      [0, 10, -8, 0],
                y:      [0, -12, 8, 0],
              }}
              transition={{
                duration: 22,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block", transformOrigin: "center center" }}
            />
            {/* Gradient fade toward the content side */}
            <div style={{
              position: "absolute", inset: 0,
              background: imgOnLeft
                ? `linear-gradient(to right, transparent 55%, ${BG} 100%)`
                : `linear-gradient(to left,  transparent 55%, ${BG} 100%)`,
            }} />
            {/* Top/bottom edge fades */}
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(to bottom, ${BG} 0%, transparent 10%, transparent 90%, ${BG} 100%)`,
            }} />
          </div>
          {/* Vignette on the content side to keep particles readable */}
          <div style={{
            position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
            background: imgOnLeft
              ? `linear-gradient(to left,  transparent 40%, ${BG} 100%)`
              : `linear-gradient(to right, transparent 40%, ${BG} 100%)`,
          }} />
        </>
      )}

      {/* Content grid */}
      <div
        className="dspm-grid"
        style={{
          position: "relative", zIndex: 2,
          maxWidth: 1200, margin: "0 auto",
          padding: "8rem 2.5rem", width: "100%",
          display: "grid",
          gridTemplateColumns: hasImage ? "1fr 1fr" : "1fr",
          alignItems: "center",
          gap: hasImage ? "5rem" : "0",
        }}
      >
        {/* Image-side spacer (or nothing when no image) */}
        {hasImage && imgOnLeft && <div />}

        {/* Editorial text — always on the side opposite to the image */}
        <motion.div
          initial={{ opacity: 0, x: hasImage ? (imgOnLeft ? 32 : -32) : 0, y: hasImage ? 0 : 20 }}
          animate={inView ? { opacity: 1, x: 0, y: 0 } : {}}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.05 }}
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: AW, marginBottom: "1.75rem" }}
          >
            {eyebrow}
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.1 }}
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(2.5rem,5.5vw,5.5rem)",
              fontWeight: 800, color: PFG,
              letterSpacing: "-0.05em", lineHeight: 0.92,
              marginBottom: "2rem", whiteSpace: "pre-line",
            }}
          >
            {headline}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.2 }}
            style={{ fontSize: "1.0625rem", lineHeight: 1.72, color: MUTED, maxWidth: 440 }}
          >
            {body}
          </motion.p>

          {/* Stat strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.32 }}
            style={{
              display: "flex", gap: "3rem", marginTop: "3.5rem",
              borderTop: "1px solid rgba(199,231,56,0.18)",
              paddingTop: "2rem",
            }}
            className="dspm-stats"
          >
            {stats.map((s, i) => (
              <div key={i}>
                <p style={{ fontFamily: DISPLAY_FONT, fontSize: "2.25rem", fontWeight: 800, color: AW, letterSpacing: "-0.04em", lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginTop: "0.4rem" }}>{s.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Image-side spacer when image is on the right */}
        {hasImage && !imgOnLeft && <div />}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dspm-grid  { grid-template-columns: 1fr !important; gap: 0 !important; }
          .dspm-stats { gap: 1.75rem !important; flex-wrap: wrap !important; }
        }
      `}</style>
    </section>
  );
}
