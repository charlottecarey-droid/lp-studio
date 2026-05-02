import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import "./_group.css";
import {
  BracketPill,
  CornerFrame,
  DotGrid,
  Eyebrow,
  FileCode,
  FOREST,
  FOREST_DEEP,
  Glow,
  HERO_HEADSET_SRC,
  KELLY,
  MINT,
  MintEmphasis,
  NAV_LINKS,
  PrimaryCTA,
  SANS,
  SecondaryCTA,
  SERIF,
  TelemetryStrip,
  VisionGlyph,
  WHITE,
  Wordmark,
  CREAM,
  INK2,
} from "../../spatial-tour/atoms";

const SECTIONS = [
  { id: "hero", label: "HERO", num: "01" },
  { id: "marquee", label: "PROOF", num: "02" },
  { id: "manifesto", label: "MANIFESTO", num: "03" },
];

function DynamicNav({
  scrollProgress,
  activeSection,
}: {
  scrollProgress: number;
  activeSection: { num: string; label: string };
}) {
  // Nav cross-fades from transparent (over hero) → solid forest_deep (past hero).
  const navOpacity = Math.min(1, scrollProgress * 8);
  const navBlur = Math.min(14, scrollProgress * 60);
  const borderOpacity = Math.min(0.18, scrollProgress * 1.4);

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        color: WHITE,
        padding: "20px 56px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: `rgba(0, 35, 29, ${navOpacity * 0.92})`,
        backdropFilter: `blur(${navBlur}px) saturate(140%)`,
        WebkitBackdropFilter: `blur(${navBlur}px) saturate(140%)`,
        borderBottom: `1px solid rgba(255,255,255,${borderOpacity})`,
        transition: "background 120ms linear, border-color 120ms linear",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Wordmark color={WHITE} height={22} alt="Dandy" />
        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.18)" }} />
        <BracketPill color={MINT}>INSIDE / DANDY</BracketPill>
      </div>

      {/* Section-aware center chip */}
      <motion.div
        key={activeSection.num}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          borderRadius: 999,
          border: "1px solid rgba(197,241,197,0.32)",
          background: "rgba(0,0,0,0.32)",
          backdropFilter: "blur(8px)",
          fontFamily: SANS,
          fontSize: 10.5,
          letterSpacing: "0.22em",
          fontWeight: 600,
          textTransform: "uppercase",
          color: MINT,
        }}
      >
        <span style={{ opacity: 0.55 }}>[</span>
        {activeSection.num}
        <span style={{ opacity: 0.55 }}>/</span>
        <span style={{ color: WHITE, opacity: 0.92 }}>{activeSection.label}</span>
        <span style={{ opacity: 0.55 }}>]</span>
      </motion.div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          fontSize: 13,
          color: "rgba(255,255,255,0.72)",
          fontFamily: SANS,
        }}
      >
        {NAV_LINKS.map((l) => (
          <a key={l.label} href={l.href} style={{ color: "inherit", textDecoration: "none" }}>
            {l.label}
          </a>
        ))}
        <PrimaryCTA label="Reserve a tour" />
      </div>
    </div>
  );
}

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.4]);

  return (
    <div
      ref={ref}
      id="hero"
      style={{
        position: "relative",
        background: FOREST,
        color: WHITE,
        padding: "120px 56px 140px",
        overflow: "hidden",
        minHeight: 820,
      }}
    >
      <motion.img
        src={HERO_HEADSET_SRC}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 40%",
          filter: "brightness(0.55) saturate(0.85)",
          y,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(100deg, rgba(0,35,29,0.92) 0%, rgba(0,58,48,0.78) 35%, rgba(0,58,48,0.40) 70%, rgba(0,58,48,0.20) 100%)",
        }}
      />
      <DotGrid opacity={0.6} />
      <Glow size={900} x={-300} y={-200} opacity={0.18} />
      <Glow size={500} x={1080} y={400} opacity={0.1} />
      <CornerFrame color="rgba(197,241,197,0.45)" size={22} inset={28} />

      <div style={{ position: "absolute", top: 80, left: 56, right: 56, zIndex: 2 }}>
        <TelemetryStrip items={["LAT 42.36° N", "LON 71.05° W", "ALT — DENTAL LAB"]} />
      </div>

      <div
        style={{
          position: "absolute",
          top: 130,
          right: 56,
          padding: "10px 16px",
          background: "rgba(0,0,0,0.40)",
          border: "1px solid rgba(197,241,197,0.40)",
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          gap: 12,
          backdropFilter: "blur(8px)",
          zIndex: 2,
        }}
      >
        <VisionGlyph width={28} color={MINT} />
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: MINT,
          }}
        >
          Built for spatial
        </span>
      </div>

      <motion.div
        style={{ position: "relative", maxWidth: 1180, margin: "0 auto", opacity, paddingTop: 80 }}
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      >
        <FileCode text="FILE / 01 — THE HOOK" style={{ marginBottom: 18 }} />
        <Eyebrow color={MINT} style={{ marginBottom: 28 }}>
          A 1:1 walk-through of the Dandy lab
        </Eyebrow>
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: "clamp(56px, 9vw, 124px)",
            lineHeight: 0.92,
            letterSpacing: "-0.045em",
            fontWeight: 400,
            margin: 0,
            color: WHITE,
            maxWidth: 1100,
          }}
        >
          Step inside
          <br />
          a working
          <br />
          <MintEmphasis>dental lab.</MintEmphasis>
        </h1>
        <p
          style={{
            marginTop: 40,
            fontSize: 19,
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.82)",
            maxWidth: 540,
            fontFamily: SANS,
          }}
        >
          Five stations. Twenty-two minutes. The same room our designers, technicians, and shipping
          team work in every day — rendered at 1:1 in spatial.
        </p>
        <div style={{ marginTop: 44, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <PrimaryCTA label="Reserve a tour" />
          <SecondaryCTA label="Watch 60s preview" />
        </div>
      </motion.div>

      <div style={{ position: "absolute", left: 56, bottom: 40, zIndex: 2 }}>
        <FileCode text="ID-LP-01 · LANDING / HERO / REV 2026.07" />
      </div>
    </div>
  );
}

function Marquee() {
  const items = [
    { value: "5,200+", label: "Cases / day" },
    { value: "98.4%", label: "On-time ship" },
    { value: "22 min", label: "Tour length" },
    { value: "1:1", label: "Spatial scale" },
  ];
  return (
    <div
      id="marquee"
      style={{
        background: FOREST_DEEP,
        color: WHITE,
        padding: "36px 56px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        position: "relative",
      }}
    >
      <DotGrid opacity={0.25} />
      <div
        style={{
          position: "relative",
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: `repeat(${items.length}, 1fr)`,
          gap: 32,
        }}
      >
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.10)",
              paddingLeft: i === 0 ? 0 : 28,
              display: "flex",
              alignItems: "baseline",
              gap: 12,
            }}
          >
            <div style={{ fontFamily: SERIF, fontSize: 30, color: MINT, letterSpacing: "-0.03em" }}>
              {it.value}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.65)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                fontWeight: 600,
              }}
            >
              {it.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManifestoTeaser() {
  return (
    <div
      id="manifesto"
      style={{ background: CREAM, color: FOREST, padding: "120px 56px", position: "relative" }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <Eyebrow color={KELLY} style={{ marginBottom: 22 }}>
          Why we built this
        </Eyebrow>
        <h2
          style={{
            fontFamily: SERIF,
            fontSize: "clamp(40px, 5vw, 64px)",
            lineHeight: 0.96,
            letterSpacing: "-0.04em",
            fontWeight: 400,
            margin: 0,
            color: FOREST,
            maxWidth: 820,
          }}
        >
          Most labs are a black box.{" "}
          <span style={{ fontStyle: "italic", color: KELLY }}>This one isn't.</span>
        </h2>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: INK2,
            margin: "28px 0 0",
            maxWidth: 620,
            fontFamily: SANS,
          }}
        >
          Scroll on. Watch the nav re-tint and the section indicator update in real time —
          a quiet signal that you're moving through a designed sequence, not just a page.
        </p>
      </div>
    </div>
  );
}

export default function Variant() {
  // Use the document's natural scroll (no custom container) so the preview
  // shell's layout can control the scrollbar. This is more robust across hosts
  // than wrapping everything in a position:fixed scroller.
  const { scrollY } = useScroll();

  const [scrollProgress, setScrollProgress] = useState(0);
  const [active, setActive] = useState(SECTIONS[0]);

  useEffect(() => {
    return scrollY.on("change", (v) => {
      setScrollProgress(Math.min(1, v / 500));
    });
  }, [scrollY]);

  // Section observer — uses the viewport (root: null) since we scroll the page.
  useEffect(() => {
    const els = SECTIONS.map((s) => ({
      meta: s,
      el: document.getElementById(s.id),
    })).filter((x) => x.el);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const meta = els.find((x) => x.el === visible.target)?.meta;
          if (meta) setActive(meta);
        }
      },
      { threshold: [0.25, 0.5, 0.75] }
    );
    els.forEach((x) => x.el && io.observe(x.el!));
    return () => io.disconnect();
  }, []);

  const progressWidth = useSpring(useTransform(scrollY, [0, 1800], ["0%", "100%"]), {
    stiffness: 200,
    damping: 30,
    mass: 0.4,
  });

  return (
    <div
      style={{
        background: WHITE,
        fontFamily: SANS,
        color: FOREST,
      }}
    >
      {/* Scroll-progress hairline pinned to top of viewport */}
      <motion.div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: 2,
          width: progressWidth,
          background: `linear-gradient(90deg, ${MINT} 0%, ${KELLY} 100%)`,
          boxShadow: `0 0 8px rgba(197,241,197,0.55)`,
          zIndex: 100,
          pointerEvents: "none",
        }}
      />
      <DynamicNav scrollProgress={scrollProgress} activeSection={active} />
      <Hero />
      <Marquee />
      <ManifestoTeaser />
    </div>
  );
}
