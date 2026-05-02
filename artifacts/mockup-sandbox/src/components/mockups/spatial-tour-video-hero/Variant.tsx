import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import "./_group.css";
import {
  BracketPill,
  CornerFrame,
  CREAM,
  DotGrid,
  Eyebrow,
  FileCode,
  FOREST,
  FOREST_DEEP,
  HERO_HEADSET_SRC,
  INK2,
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
} from "../../spatial-tour/atoms";

function Nav() {
  return (
    <div
      style={{
        background: FOREST_DEEP,
        color: WHITE,
        padding: "20px 56px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Wordmark color={WHITE} height={22} alt="Dandy" />
        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.18)" }} />
        <BracketPill color={MINT}>INSIDE / DANDY</BracketPill>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          fontSize: 13,
          color: "rgba(255,255,255,0.7)",
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

// "Video" background, simulated with a Ken-Burns-zooming hero image plus two
// drifting mint glow blobs and a subtle scanline. Real footage would slot into
// the same <div> as a <video autoPlay muted loop /> with the same vignette + ducking.
function VideoStage() {
  return (
    <>
      {/* Ken-Burns image standing in for the video frame */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
        }}
      >
        <img
          src={HERO_HEADSET_SRC}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 40%",
            filter: "brightness(0.6) saturate(0.95) contrast(1.05)",
            animation: "st-ken-burns 18s ease-in-out infinite",
          }}
        />
        {/* Drifting mint glow — gives the still image visible motion */}
        <div
          style={{
            position: "absolute",
            top: "-15%",
            left: "10%",
            width: "60%",
            height: "80%",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(197,241,197,0.32) 0%, transparent 65%)",
            filter: "blur(60px)",
            animation: "st-glow-drift 12s ease-in-out infinite",
            mixBlendMode: "screen",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-10%",
            right: "8%",
            width: "50%",
            height: "70%",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(21,137,21,0.28) 0%, transparent 60%)",
            filter: "blur(70px)",
            animation: "st-glow-drift 16s ease-in-out infinite reverse",
            mixBlendMode: "screen",
          }}
        />
        {/* Faint vertical scanline drifting top→bottom */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, transparent 0%, rgba(197,241,197,0.05) 50%, transparent 100%)",
            backgroundSize: "100% 200px",
            animation: "st-scanline 9s linear infinite",
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      </div>
      {/* Vignette — heavy edges, clean center */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.35) 75%, rgba(0,0,0,0.65) 100%)",
          pointerEvents: "none",
        }}
      />
      {/* Color wash on top of the video */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(100deg, rgba(0,35,29,0.55) 0%, rgba(0,58,48,0.30) 45%, rgba(0,58,48,0.10) 100%)",
        }}
      />
      <DotGrid opacity={0.45} />
    </>
  );
}

function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  // "Scroll-ducking": video stage fades + scales down as user scrolls past hero
  const stageOpacity = useTransform(scrollYProgress, [0, 0.55, 0.9], [1, 0.65, 0.15]);
  const stageScale = useTransform(scrollYProgress, [0, 1], [1, 1.06]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.35]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  return (
    <div
      ref={heroRef}
      style={{
        position: "relative",
        background: FOREST_DEEP,
        color: WHITE,
        padding: "120px 56px 140px",
        overflow: "hidden",
        minHeight: 820,
      }}
    >
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          opacity: stageOpacity,
          scale: stageScale,
          transformOrigin: "center 40%",
        }}
      >
        <VideoStage />
      </motion.div>

      {/* Tech-HUD frame */}
      <CornerFrame color="rgba(197,241,197,0.55)" size={22} inset={28} />

      {/* REC indicator — signals this is a live video frame */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 56,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.42)",
          border: "1px solid rgba(255,255,255,0.18)",
          backdropFilter: "blur(8px)",
          fontFamily: SANS,
          fontSize: 10.5,
          letterSpacing: "0.24em",
          fontWeight: 600,
          textTransform: "uppercase",
          color: WHITE,
          zIndex: 2,
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "#ff4d4f",
            boxShadow: "0 0 10px #ff4d4f",
            animation: "st-rec-blink 1.4s ease-in-out infinite",
          }}
        />
        REC · TOUR LIVE-FEED
      </div>

      {/* Telemetry pinned right */}
      <div
        style={{
          position: "absolute",
          top: 80,
          right: 56,
          zIndex: 2,
          minWidth: 320,
        }}
      >
        <TelemetryStrip
          items={["LAT 42.36° N", "LON 71.05° W"]}
          liveColor={MINT}
        />
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
        style={{
          position: "relative",
          maxWidth: 1180,
          margin: "0 auto",
          opacity: contentOpacity,
          y: contentY,
          paddingTop: 100,
        }}
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
            textShadow: "0 2px 24px rgba(0,0,0,0.35)",
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
            color: "rgba(255,255,255,0.92)",
            maxWidth: 540,
            fontFamily: SANS,
            textShadow: "0 1px 12px rgba(0,0,0,0.45)",
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

      {/* File-code bottom-left */}
      <div style={{ position: "absolute", left: 56, bottom: 40, zIndex: 2 }}>
        <FileCode text="ID-LP-01 · LANDING / HERO / REV 2026.07" />
      </div>

      {/* Frame-rate stamp bottom-right */}
      <div
        style={{
          position: "absolute",
          right: 56,
          bottom: 40,
          fontFamily: SANS,
          fontSize: 10.5,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(197,241,197,0.7)",
          fontWeight: 500,
          zIndex: 2,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{ width: 6, height: 6, borderRadius: "50%", background: MINT }}
          className="st-pulse-dot"
        />
        2160P · 60FPS · LOOP
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
    <div style={{ background: CREAM, color: FOREST, padding: "120px 56px" }}>
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
          Real lab footage would slot into the hero in place of the still. Scroll-ducking pulls the
          motion out of the way the moment your eye moves on.
        </p>
      </div>
    </div>
  );
}

export default function Variant() {
  return (
    <div style={{ background: WHITE, fontFamily: SANS, color: FOREST }}>
      <Nav />
      <Hero />
      <Marquee />
      <ManifestoTeaser />
    </div>
  );
}
