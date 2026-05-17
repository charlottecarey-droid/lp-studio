import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoParticleMeshBlockProps } from "@/lib/block-types";
import { getBgStyle } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";

const DISPLAY_FONT = "var(--brand-font-display, var(--app-font-display, 'Bagoss Standard')), 'Inter', system-ui, sans-serif";
const PFG   = "hsl(48,100%,96%)";
const AW    = "var(--brand-accent, hsl(68,60%,52%))";
const ACCENT_FALLBACK = "hsl(68,60%,52%)";
const MUTED = "hsla(48,100%,96%,0.42)";
const BG    = "#001a13";

/** Resolve a CSS var on `el` (or document.body) to a concrete color string for canvas use. */
function resolveCssVar(varName: string, fallback: string, el?: Element | null): string {
  if (typeof window === "undefined") return fallback;
  const target = el || document.body;
  const v = getComputedStyle(target).getPropertyValue(varName).trim();
  return v || fallback;
}

/* ── Particle engine ── */
interface Particle { x: number; y: number; vx: number; vy: number; r: number; opacity: number }

function makeParticles(W: number, H: number, n: number): Particle[] {
  return Array.from({ length: n }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
    r: Math.random() * 1.5 + 0.6, opacity: Math.random() * 0.55 + 0.25,
  }));
}

interface Props {
  props: DsoParticleMeshBlockProps;
  onFieldChange?: (updated: DsoParticleMeshBlockProps) => void;
}

export function BlockDsoParticleMesh({ props, onFieldChange }: Props) {
  const {
    eyebrow    = "AI-Driven Intelligence",
    headline   = "Every workflow,\nconnected.",
    body       = "A unified infrastructure that routes, validates, and delivers with machine precision — connecting every team, every site, every outcome.",
    stat1Value = "500+", stat1Label = "Locations",
    stat2Value = "96%",  stat2Label = "Quality Pass",
    stat3Value = "< 4d", stat3Label = "Avg Turnaround",
    imageUrl   = "",
    imagePosition = "right",
    backgroundStyle = "dark",
  } = props;
  const field = (key: keyof DsoParticleMeshBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as DsoParticleMeshBlockProps[typeof key] }) : undefined;

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const animRef    = useRef<number>(0);
  const pRef       = useRef<Particle[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: false, margin: "-5%" });

  // Track the resolved brand accent color reactively. The published page sets
  // `--brand-accent` on a [data-lp-page] wrapper *after* React mounts (it's
  // populated from an async /api/lp/brand fetch). If we read the var only
  // once at mount we capture the neutral default (blue) and the canvas keeps
  // painting blue forever even after the wrapper switches to the tenant's
  // real palette. Watch the wrapper's style attribute via MutationObserver
  // so a re-paint in the tenant's accent is automatic. Same hook also covers
  // live brand edits in the builder.
  const [accent, setAccent] = useState<string>(ACCENT_FALLBACK);
  useEffect(() => {
    const update = () => {
      setAccent(resolveCssVar("--brand-accent", ACCENT_FALLBACK, sectionRef.current));
    };
    update();
    const wrapper =
      sectionRef.current?.closest("[data-lp-page], [data-lp-builder-canvas]") ?? document.body;
    const obs = new MutationObserver(update);
    obs.observe(wrapper, { attributes: true, attributeFilter: ["style", "class"] });
    return () => obs.disconnect();
  }, []);

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
      if (!canvas) return;
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
      if (!canvas || !ctx) return;
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
            ctx.strokeStyle = accent;
            ctx.lineWidth   = 0.7;
            ctx.beginPath();
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(ps[j].x, ps[j].y);
            ctx.stroke();
          }
        }
      }

      ctx.shadowColor = accent;
      ctx.shadowBlur  = 8;
      for (const p of ps) {
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle   = accent;
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
  }, [accent]);

  const hasImage   = Boolean(imageUrl);
  const imgOnLeft  = imagePosition === "left";

  const stats: Array<{ value: string; label: string; valueKey: keyof DsoParticleMeshBlockProps; labelKey: keyof DsoParticleMeshBlockProps }> = [
    { value: stat1Value, label: stat1Label, valueKey: "stat1Value", labelKey: "stat1Label" },
    { value: stat2Value, label: stat2Label, valueKey: "stat2Value", labelKey: "stat2Label" },
    { value: stat3Value, label: stat3Label, valueKey: "stat3Value", labelKey: "stat3Label" },
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
            <InlineText as="span" value={eyebrow} onUpdate={field("eyebrow")} />
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
            <InlineText as="span" value={headline} onUpdate={field("headline")} multiline />
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.2 }}
            style={{ fontSize: "1.0625rem", lineHeight: 1.72, color: MUTED, maxWidth: 440 }}
          >
            <InlineText as="span" value={body} onUpdate={field("body")} multiline />
          </motion.p>

          {/* Stat strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.32 }}
            style={{
              display: "flex", gap: "3rem", marginTop: "3.5rem",
              borderTop: "1px solid rgb(var(--brand-accent-rgb, 199 231 56) / 0.18)",
              paddingTop: "2rem",
            }}
            className="dspm-stats"
          >
            {stats.map((s, i) => (
              <div key={i}>
                <InlineText as="p" value={s.value} onUpdate={field(s.valueKey)} style={{ fontFamily: DISPLAY_FONT, fontSize: "2.25rem", fontWeight: 800, color: AW, letterSpacing: "-0.04em", lineHeight: 1 }} />
                <InlineText as="p" value={s.label} onUpdate={field(s.labelKey)} style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginTop: "0.4rem" }} />
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
