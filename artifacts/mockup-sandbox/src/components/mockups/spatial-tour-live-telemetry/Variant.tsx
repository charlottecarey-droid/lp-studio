import { useEffect, useRef, useState } from "react";
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
  Glow,
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

const BOOT_LINES = [
  "▌ INIT_LINK",
  "▌ INIT_LINK · HANDSHAKE",
  "▌ INIT_LINK · HANDSHAKE · OK",
  "▌ STREAM 60FPS · LOCKED",
];

function useBootSequence() {
  const [stage, setStage] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 380);
    const t2 = setTimeout(() => setStage(2), 880);
    const t3 = setTimeout(() => setStage(3), 1380);
    const t4 = setTimeout(() => setDone(true), 2200);
    return () => {
      [t1, t2, t3, t4].forEach(clearTimeout);
    };
  }, []);
  return { line: BOOT_LINES[stage], done };
}

// Latitude/longitude with the trailing decimals jittering every ~1.4s to imply
// a live spatial telemetry feed.
function useJitteredCoords() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1400);
    return () => clearInterval(id);
  }, []);
  // pseudo-random but stable per tick
  const seed = (tick * 9301 + 49297) % 233280;
  const r1 = (seed % 1000) / 1000; // 0..1
  const r2 = ((seed * 7) % 1000) / 1000;
  const r3 = ((seed * 13) % 100) / 100;
  const lat = (42.3601 + (r1 - 0.5) * 0.0006).toFixed(4);
  const lon = (-71.0589 + (r2 - 0.5) * 0.0006).toFixed(4);
  const fps = (60 + Math.round(r3 * 4 - 2)).toString();
  return { lat, lon, fps };
}

function useUptime() {
  const start = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.floor((now - start.current) / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

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

function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.4]);

  const boot = useBootSequence();
  const coords = useJitteredCoords();
  const uptime = useUptime();

  return (
    <div
      ref={heroRef}
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

      {/* Telemetry strip — boot sequence first, then live coords */}
      <div style={{ position: "absolute", top: 80, left: 56, right: 56, zIndex: 2 }}>
        {!boot.done ? (
          <TelemetryStrip
            items={[]}
            bootText={boot.line}
            livePulse
            liveLabel="BOOTING"
            liveColor={MINT}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <TelemetryStrip
              items={[
                <>
                  LAT <span style={{ color: WHITE, opacity: 0.85 }}>{coords.lat}</span>° N
                </>,
                <>
                  LON <span style={{ color: WHITE, opacity: 0.85 }}>{coords.lon}</span>° W
                </>,
                <>
                  STREAM <span style={{ color: WHITE, opacity: 0.85 }}>{coords.fps}</span> FPS
                </>,
              ]}
              livePulse
              liveLabel="LIVE"
            />
          </motion.div>
        )}
      </div>

      {/* Uptime stamp under the telemetry */}
      <div
        style={{
          position: "absolute",
          top: 116,
          left: 56,
          fontFamily: SANS,
          fontSize: 9.5,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(197,241,197,0.55)",
          fontWeight: 500,
          zIndex: 2,
        }}
      >
        UPTIME {uptime} · NODE BOS-01
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
        style={{ position: "relative", maxWidth: 1180, margin: "0 auto", opacity, paddingTop: 100 }}
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

function FooterTelemetry() {
  const coords = useJitteredCoords();
  return (
    <div style={{ background: FOREST_DEEP, color: WHITE }}>
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "24px 56px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <TelemetryStrip
          items={[
            <>
              LAT <span style={{ color: WHITE, opacity: 0.85 }}>{coords.lat}</span>° N
            </>,
            <>
              LON <span style={{ color: WHITE, opacity: 0.85 }}>{coords.lon}</span>° W
            </>,
            <>ALT — DENTAL LAB</>,
          ]}
          livePulse
          liveLabel="LIVE"
        />
      </div>
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "28px 56px 36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          fontFamily: SANS,
          fontSize: 12,
          color: "rgba(255,255,255,0.45)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Wordmark color={WHITE} height={20} alt="Dandy" />
          <BracketPill color="rgba(255,255,255,0.75)" bracketColor="rgba(197,241,197,0.55)">
            INSIDE / DANDY
          </BracketPill>
        </div>
        <FileCode text="ID-LP-01 · LANDING / REV 2026.07" color="rgba(255,255,255,0.55)" />
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
          Watch the boot sequence resolve to live coordinates. The page reads like a piece of
          production gear, not a marketing brochure.
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
      <FooterTelemetry />
    </div>
  );
}
