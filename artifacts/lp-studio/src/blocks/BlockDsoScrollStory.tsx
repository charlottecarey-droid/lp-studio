import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useMotionValueEvent, useInView } from "framer-motion";
import type { DsoScrollStoryBlockProps } from "@/lib/block-types";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const AW    = "hsl(68,60%,52%)";
const FG    = "hsl(152,30%,10%)";
const FG_MU = "hsl(192,10%,42%)";
const LIGHT_BG = "hsl(0,0%,99%)";

const DEFAULT_CHAPTERS: DsoScrollStoryBlockProps["chapters"] = [
  {
    headline: "One lab relationship across every location.",
    body: "Fragmented lab networks create inconsistency, data silos, and zero negotiating leverage. Dandy becomes your single lab partner — standardizing quality, pricing, and reporting across every practice in your network.",
    imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=900&h=700&fit=crop",
  },
  {
    headline: "AI that catches problems before they become remakes.",
    body: "Dandy's AI Scan Review validates every case in real time — before it ever leaves the chair. The result: a 96% first-time right rate and dramatically fewer costly remakes across your entire footprint.",
    imageUrl: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=900&h=700&fit=crop",
  },
  {
    headline: "Executive visibility into every practice, instantly.",
    body: "The Dandy Insights dashboard gives DSO leadership a real-time view of remake rates, case volumes, turnaround times, and provider adoption — by location, by region, by brand.",
    imageUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=900&h=700&fit=crop",
  },
  {
    headline: "Prove ROI at 10 offices. Scale to 500.",
    body: "Dandy's Pilot Program validates impact at a small number of locations first — measuring same-store revenue lift, remake reduction, and chair time recovered — before you commit to a full rollout.",
    imageUrl: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=900&h=700&fit=crop",
  },
];

interface Props {
  props: DsoScrollStoryBlockProps;
}

export function BlockDsoScrollStory({ props }: Props) {
  const { eyebrow = "The Dandy Advantage", chapters } = props;
  const displayChapters = chapters && chapters.length > 0 ? chapters.slice(0, 4) : DEFAULT_CHAPTERS;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const sectionInView = useInView(sectionRef, { margin: "-20%" });

  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const idx = Math.min(
      Math.floor(latest * displayChapters.length),
      displayChapters.length - 1,
    );
    setActive(Math.max(0, idx));
  });

  // Autoplay: advance chapter every 4 s while section is on-screen and not paused
  useEffect(() => {
    if (!sectionInView || paused) return;
    const id = setInterval(() => {
      setActive(prev => (prev + 1) % displayChapters.length);
    }, 4000);
    return () => clearInterval(id);
  }, [sectionInView, paused, displayChapters.length]);

  return (
    <section ref={sectionRef} style={{ background: LIGHT_BG }}>
      {/* Section header */}
      <div style={{ textAlign: "center", padding: "5rem 1.5rem 0", maxWidth: 1200, margin: "0 auto" }}>
        {eyebrow && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: AW,
              marginBottom: "1rem",
            }}
          >
            {eyebrow}
          </motion.p>
        )}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.06 }}
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: "clamp(2.25rem,4.5vw,3.75rem)",
            fontWeight: 700,
            color: FG,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            maxWidth: 720,
            margin: "0 auto 1.25rem",
          }}
        >
          How Dandy transforms your lab strategy
        </motion.p>
        <p style={{ fontSize: "1.125rem", color: FG_MU, lineHeight: 1.65, maxWidth: 560, margin: "0 auto" }}>
          Scroll to explore each pillar of the Dandy platform.
        </p>
      </div>

      {/* ── Desktop sticky scroll (md+) ── */}
      <div className="hidden md:block">
        <div
          ref={containerRef}
          style={{ position: "relative", height: `${displayChapters.length * 100}vh` }}
        >
          <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                maxWidth: 1200,
                margin: "0 auto",
                padding: "0 1.5rem",
                alignItems: "center",
                gap: "4rem",
              }}
            >
              {/* Left: Text */}
              <div style={{ position: "relative" }}>
                {/* Progress dots — clickable, animate active */}
                <div style={{ display: "flex", gap: 8, marginBottom: "2.5rem" }}>
                  {displayChapters.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setActive(i); setPaused(false); }}
                      style={{
                        position: "relative",
                        height: 3,
                        width: active === i ? 36 : 10,
                        borderRadius: 2,
                        background: active === i ? "rgba(0,58,48,0.12)" : "rgba(0,58,48,0.12)",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        overflow: "hidden",
                        transition: "width 0.4s cubic-bezier(0.16,1,0.3,1)",
                        flexShrink: 0,
                      }}
                      aria-label={`Go to chapter ${i + 1}`}
                    >
                      {/* Animated fill for active dot */}
                      {active === i && !paused ? (
                        <motion.div
                          key={`fill-${i}-${active}`}
                          style={{ position: "absolute", inset: 0, borderRadius: 2, background: AW, originX: 0 }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 4, ease: "linear" }}
                        />
                      ) : (
                        <div style={{ position: "absolute", inset: 0, borderRadius: 2, background: active === i ? AW : "rgba(0,58,48,0.20)" }} />
                      )}
                    </button>
                  ))}
                </div>

                {/* Chapter counter */}
                <p style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: AW,
                  marginBottom: "1.25rem",
                }}>
                  {String(active + 1).padStart(2, "0")} / {String(displayChapters.length).padStart(2, "0")}
                </p>

                {/* Animated chapter text */}
                <div style={{ position: "relative", minHeight: 300, perspective: "900px" }}>
                  {displayChapters.map((ch, i) => (
                    <motion.div
                      key={i}
                      style={{ position: i === 0 ? "relative" : "absolute", top: 0, transformOrigin: "50% 110%" }}
                      animate={{
                        opacity: active === i ? 1 : 0,
                        y: active === i ? 0 : active > i ? -36 : 28,
                        rotateX: active === i ? 0 : active > i ? -14 : 12,
                        pointerEvents: active === i ? "auto" : "none",
                      }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <h3
                        style={{
                          fontFamily: DISPLAY_FONT,
                          fontSize: "clamp(2rem,3.5vw,3rem)",
                          fontWeight: 700,
                          color: FG,
                          letterSpacing: "-0.03em",
                          lineHeight: 1.08,
                          marginBottom: "1.5rem",
                        }}
                      >
                        {ch.headline}
                      </h3>
                      <p style={{ fontSize: "1.0625rem", lineHeight: 1.72, color: FG_MU, maxWidth: 440 }}>
                        {ch.body}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Right: Image */}
              <div style={{ position: "relative", height: "70vh", borderRadius: "1.5rem", overflow: "hidden" }}>
                {displayChapters.map((ch, i) => (
                  <motion.div
                    key={i}
                    style={{ position: "absolute", inset: 0 }}
                    animate={{
                      opacity: active === i ? 1 : 0,
                      y: active === i ? "0%" : active > i ? "-6%" : "6%",
                      scale: active === i ? 1 : 1.03,
                    }}
                    transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <img
                      src={ch.imageUrl}
                      alt={ch.headline}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      loading="lazy"
                    />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(0,58,48,0.05) 0%, rgba(0,0,0,0.35) 100%)" }} />
                    <div style={{
                      position: "absolute",
                      bottom: "1.75rem",
                      right: "1.75rem",
                      fontFamily: DISPLAY_FONT,
                      fontSize: "5rem",
                      fontWeight: 800,
                      color: "rgba(255,255,255,0.12)",
                      lineHeight: 1,
                      letterSpacing: "-0.06em",
                      userSelect: "none",
                    }}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
                      background: `linear-gradient(90deg, ${AW}00, ${AW}, ${AW}00)`,
                    }} />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: stacked chapters ── */}
      <div className="md:hidden" style={{ padding: "3rem 1.25rem 4rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
          {displayChapters.map((ch, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Image */}
              <div style={{ borderRadius: "1rem", overflow: "hidden", height: 240, marginBottom: "1.5rem", position: "relative" }}>
                <img src={ch.imageUrl} alt={ch.headline} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(0,58,48,0.05) 0%, rgba(0,0,0,0.35) 100%)" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${AW}00, ${AW}, ${AW}00)` }} />
              </div>
              {/* Chapter index */}
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: AW, marginBottom: "0.75rem" }}>
                {String(i + 1).padStart(2, "0")} / {String(displayChapters.length).padStart(2, "0")}
              </p>
              <h3 style={{ fontFamily: DISPLAY_FONT, fontSize: "1.375rem", fontWeight: 600, color: FG, letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: "0.875rem" }}>
                {ch.headline}
              </h3>
              <p style={{ fontSize: "0.9375rem", lineHeight: 1.68, color: FG_MU }}>
                {ch.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
