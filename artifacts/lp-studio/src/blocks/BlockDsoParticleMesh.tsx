import { useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoParticleMeshBlockProps } from "@/lib/block-types";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";
const PFG  = "hsl(48,100%,96%)";
const AW   = "hsl(68,60%,52%)";
const MUTED = "hsla(48,100%,96%,0.42)";

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number; opacity: number;
}

function makeParticles(W: number, H: number, n: number): Particle[] {
  return Array.from({ length: n }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35,
    r: Math.random() * 1.5 + 0.6,
    opacity: Math.random() * 0.55 + 0.25,
  }));
}

interface Props { props: DsoParticleMeshBlockProps }

export function BlockDsoParticleMesh({ props }: Props) {
  const {
    eyebrow = "AI-Driven Intelligence",
    headline = "Every case,\nconnected.",
    body = "Dandy's neural lab infrastructure routes, validates, and delivers with machine precision — connecting every practice, every provider, every outcome.",
    stat1Value = "500+",
    stat1Label = "Locations",
    stat2Value = "96%",
    stat2Label = "First-Time Right",
    stat3Value = "< 4d",
    stat3Label = "Avg Turnaround",
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const pRef      = useRef<Particle[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: false, margin: "-5%" });

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

      /* background */
      ctx.fillStyle = "#001a13";
      ctx.fillRect(0, 0, W, H);

      /* update positions */
      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0)  p.x = W;
        if (p.x > W)  p.x = 0;
        if (p.y < 0)  p.y = H;
        if (p.y > H)  p.y = 0;
      }

      /* connections */
      ctx.shadowBlur = 0;
      const DIST2 = DIST * DIST;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const dx = ps[i].x - ps[j].x;
          const dy = ps[i].y - ps[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < DIST2) {
            const alpha = (1 - Math.sqrt(d2) / DIST) * 0.22;
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = "#C7E738";
            ctx.lineWidth   = 0.7;
            ctx.beginPath();
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(ps[j].x, ps[j].y);
            ctx.stroke();
          }
        }
      }

      /* particles with glow */
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
    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, []);

  const stats = [
    { value: stat1Value, label: stat1Label },
    { value: stat2Value, label: stat2Label },
    { value: stat3Value, label: stat3Label },
  ];

  return (
    <section
      ref={sectionRef}
      style={{ position: "relative", overflow: "hidden", minHeight: "100vh", display: "flex", alignItems: "center" }}
    >
      {/* live canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      />

      {/* radial vignette */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 110% 90% at 30% 50%, rgba(0,26,19,0) 0%, rgba(0,10,7,0.72) 100%)",
      }} />

      {/* content */}
      <div style={{ position: "relative", zIndex: 2, maxWidth: 1200, margin: "0 auto", padding: "7rem 2rem", width: "100%" }}>
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

        {/* stat strip */}
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
              <p style={{ fontFamily: DISPLAY_FONT, fontSize: "2.375rem", fontWeight: 800, color: AW, letterSpacing: "-0.04em", lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginTop: "0.45rem" }}>
                {s.label}
              </p>
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
