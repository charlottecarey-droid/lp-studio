import { useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoParticleMeshBlockProps } from "@/lib/block-types";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";
const PFG   = "hsl(48,100%,96%)";
const AW    = "hsl(68,60%,52%)";
const MUTED = "hsla(48,100%,96%,0.42)";

/* ── Particle engine ── */
interface Particle { x: number; y: number; vx: number; vy: number; r: number; opacity: number }

function makeParticles(W: number, H: number, n: number): Particle[] {
  return Array.from({ length: n }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
    r: Math.random() * 1.5 + 0.6, opacity: Math.random() * 0.55 + 0.25,
  }));
}

/* ── Single large floating image config ── */
const FLOAT_CFG = {
  left: 52, top: 8, w: 520,
  opacity: 0.72,
  dx: [0, 18, -12, 0],
  dy: [0, -20, 14, 0],
  rot: [0, 3, -2, 0],
  dur: 18,
};

interface Props { props: DsoParticleMeshBlockProps }

export function BlockDsoParticleMesh({ props }: Props) {
  const {
    eyebrow    = "AI-Driven Intelligence",
    headline   = "Every case,\nconnected.",
    body       = "Dandy's neural lab infrastructure routes, validates, and delivers with machine precision — connecting every practice, every provider, every outcome.",
    stat1Value = "500+", stat1Label = "Locations",
    stat2Value = "96%",  stat2Label = "First-Time Right",
    stat3Value = "< 4d", stat3Label = "Avg Turnaround",
    imageUrls  = [],
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

      ctx.fillStyle = "#001a13";
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

  const stats = [
    { value: stat1Value, label: stat1Label },
    { value: stat2Value, label: stat2Label },
    { value: stat3Value, label: stat3Label },
  ];

  const floatUrl = imageUrls.length > 0 ? imageUrls[0] : null;

  return (
    <section
      ref={sectionRef}
      style={{ position: "relative", overflow: "hidden", minHeight: "100vh", display: "flex", alignItems: "center" }}
    >
      {/* Particle canvas — bottom layer */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      />

      {/* Single large floating image — above particles, below content */}
      {floatUrl && (
        <motion.img
          src={floatUrl}
          alt=""
          draggable={false}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, FLOAT_CFG.opacity, FLOAT_CFG.opacity],
            x:      FLOAT_CFG.dx as number[],
            y:      FLOAT_CFG.dy as number[],
            rotate: FLOAT_CFG.rot as number[],
            scale:  [1, 1.03, 0.98, 1],
          }}
          transition={{
            opacity: { duration: 1.4 },
            x:       { duration: FLOAT_CFG.dur, repeat: Infinity, ease: "easeInOut" },
            y:       { duration: FLOAT_CFG.dur * 0.85, repeat: Infinity, ease: "easeInOut" },
            rotate:  { duration: FLOAT_CFG.dur * 1.1, repeat: Infinity, ease: "easeInOut" },
            scale:   { duration: FLOAT_CFG.dur * 0.9, repeat: Infinity, ease: "easeInOut" },
          }}
          style={{
            position: "absolute",
            left: `${FLOAT_CFG.left}%`,
            top:  `${FLOAT_CFG.top}%`,
            width: `${FLOAT_CFG.w}px`,
            maxWidth: "48vw",
            zIndex: 1,
            pointerEvents: "none",
            filter: "drop-shadow(0 0 40px rgba(199,231,56,0.25)) drop-shadow(0 0 12px rgba(199,231,56,0.12))",
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* Radial vignette — pulls edges dark so text is always readable */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
        background: "radial-gradient(ellipse 110% 90% at 30% 50%, rgba(0,26,19,0) 0%, rgba(0,10,7,0.72) 100%)",
      }} />

      {/* Editorial content */}
      <div style={{ position: "relative", zIndex: 3, maxWidth: 1200, margin: "0 auto", padding: "7rem 2rem", width: "100%" }}>
        <div style={{ maxWidth: 660 }}>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: AW, marginBottom: "1.5rem" }}
          >
            {eyebrow}
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 28 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.08 }}
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(3rem,7.5vw,6.5rem)",
              fontWeight: 800, color: PFG,
              letterSpacing: "-0.05em", lineHeight: 0.92,
              marginBottom: "2.25rem", whiteSpace: "pre-line",
            }}
          >
            {headline}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.2 }}
            style={{ fontSize: "1.125rem", lineHeight: 1.72, color: MUTED, maxWidth: 460 }}
          >
            {body}
          </motion.p>
        </div>

        {/* Stat strip */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.34 }}
          style={{
            display: "flex", gap: "3rem", marginTop: "4.5rem",
            borderTop: "1px solid rgba(199,231,56,0.18)",
            paddingTop: "2.25rem",
          }}
          className="dspm-stats"
        >
          {stats.map((s, i) => (
            <div key={i}>
              <p style={{ fontFamily: DISPLAY_FONT, fontSize: "2.375rem", fontWeight: 800, color: AW, letterSpacing: "-0.04em", lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginTop: "0.45rem" }}>{s.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .dspm-stats { gap: 1.75rem !important; flex-wrap: wrap !important; }
        }
      `}</style>
    </section>
  );
}
