import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ScanDown, PulseGlow } from "./SectionAmbient";
import {
  AlertTriangle, BarChart3, Users2, TrendingDown,
  Clock, Shield, Microscope, Layers, Zap, Target,
  DollarSign, Network, Activity, Scale,
} from "lucide-react";
import type { DsoProblemBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const P    = "#003A30";
const AW   = "hsl(68,60%,52%)";

const DEFAULT_IMG_A = "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=900&h=660&fit=crop";
const DEFAULT_IMG_B = "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=640&h=440&fit=crop";

const ICON_MAP: Record<string, React.ComponentType<{ style?: React.CSSProperties; className?: string }>> = {
  "alert-triangle": AlertTriangle,
  "bar-chart": BarChart3,
  "users": Users2,
  "trending-down": TrendingDown,
  "clock": Clock,
  "shield": Shield,
  "microscope": Microscope,
  "layers": Layers,
  "zap": Zap,
  "target": Target,
  "dollar": DollarSign,
  "network": Network,
  "activity": Activity,
  "scale": Scale,
};

const DEFAULT_PANELS: DsoProblemBlockProps["panels"] = [
  { icon: "alert-triangle", title: "Fragmented Networks",   desc: "No centralized visibility or control across your lab relationships." },
  { icon: "bar-chart",      title: "Scattered Data",        desc: "Performance tracking impossible across disconnected systems." },
  { icon: "users",          title: "Provider Resistance",   desc: "Inconsistent quality erodes provider confidence and slows adoption." },
  { icon: "trending-down",  title: "Revenue Leakage",       desc: "Remakes, wasted chair time, and inefficiency drain profitability silently." },
];

interface Props {
  props: DsoProblemBlockProps;
}

export function BlockDsoProblem({ props }: Props) {
  const {
    eyebrow = "The Problem",
    headline = "Lab consolidation shouldn't mean compromise.",
    body = "",
    panels,
    imageUrls = [],
    statValue = "96%",
    statLabel = "First-time right rate",
    backgroundStyle = "dandy-green",
    ctaText,
    ctaUrl,
    ctaMode = "link",
  } = props;

  const dark = isDarkBg(backgroundStyle);
  const fg   = dark ? "hsl(48,100%,96%)"      : P;
  const mu   = dark ? "rgba(255,255,255,0.52)" : "rgba(0,58,48,0.55)";
  const dividerColor = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const iconBg     = dark ? `${AW}14` : `${AW}22`;
  const iconBorder = dark ? `${AW}28` : `${AW}44`;

  const imgA = imageUrls[0] || DEFAULT_IMG_A;
  const imgB = imageUrls[1] || DEFAULT_IMG_B;

  const displayPanels = panels && panels.length > 0 ? panels.slice(0, 4) : DEFAULT_PANELS;

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });

  const imgAY = useTransform(scrollYProgress, [0, 1], ["50px", "-50px"]);
  const imgBY = useTransform(scrollYProgress, [0, 1], ["-20px", "60px"]);
  const textY  = useTransform(scrollYProgress, [0, 1], ["20px", "-20px"]);

  return (
    <section
      ref={sectionRef}
      style={{ ...getBgStyle(backgroundStyle), color: fg, position: "relative", overflow: "hidden" }}
      className="py-24 md:py-36"
    >
      {dark && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.025,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundSize: "200px 200px",
            pointerEvents: "none",
          }}
        />
      )}
      {dark && (
        <>
          <ScanDown duration={10} delay={2} repeatDelay={8} />
          <PulseGlow top="15%" left="80%" size={320} duration={6} delay={0} />
          <PulseGlow top="70%" left="12%" size={260} duration={7} delay={3} />
        </>
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}>
        <div className="grid md:grid-cols-[5fr_6fr] gap-16 lg:gap-24 items-center">

          {/* ── Left: Stacked photography ── */}
          <motion.div style={{ position: "relative", minHeight: 500, paddingBottom: 120 }}>

            <div style={{
              position: "absolute",
              top: "5%",
              left: "-8%",
              width: "90%",
              height: "75%",
              borderRadius: "50%",
              background: `radial-gradient(ellipse, ${AW}09 0%, transparent 70%)`,
              pointerEvents: "none",
              zIndex: 0,
            }} />

            {/* Primary image */}
            <motion.div
              style={{
                y: imgAY,
                borderRadius: "1.25rem",
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(0,0,0,0.25), 0 32px 72px rgba(0,0,0,0.55)",
                position: "relative",
                zIndex: 1,
                outline: "1.5px solid rgba(255,255,255,0.07)",
              }}
              initial={{ opacity: 0, x: -32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <img
                src={imgA}
                alt="Dandy lab manufacturing"
                style={{ width: "100%", height: 340, objectFit: "cover", display: "block" }}
                loading="lazy"
              />
              <div style={{ height: 3, background: `linear-gradient(90deg, ${AW}, transparent)` }} />
            </motion.div>

            {/* Secondary image */}
            <motion.div
              style={{
                y: imgBY,
                position: "absolute",
                bottom: 0,
                right: -16,
                width: "56%",
                zIndex: 2,
                borderRadius: "0.875rem",
                overflow: "hidden",
                boxShadow: "0 20px 56px rgba(0,0,0,0.60), 0 4px 16px rgba(0,0,0,0.40)",
                outline: "1.5px solid rgba(255,255,255,0.10)",
                rotate: -2,
                transformOrigin: "bottom right",
              }}
              initial={{ opacity: 0, x: 28, rotate: -4 }}
              whileInView={{ opacity: 1, x: 0, rotate: -2 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <img
                src={imgB}
                alt="Precision dental work"
                style={{ width: "100%", height: 210, objectFit: "cover", display: "block" }}
                loading="lazy"
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(160deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.62) 100%)",
                  display: "flex",
                  alignItems: "flex-end",
                  padding: "1rem 1.25rem",
                }}
              >
                <div>
                  <p style={{ fontFamily: DISPLAY_FONT, fontSize: "1.75rem", fontWeight: 700, color: "#fff", lineHeight: 1, letterSpacing: "-0.03em" }}>{statValue}</p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 3 }}>{statLabel}</p>
                </div>
              </div>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${AW}00, ${AW}, ${AW}00)` }} />
            </motion.div>
          </motion.div>

          {/* ── Right: Copy + problem list ── */}
          <motion.div style={{ y: textY }}>
            {eyebrow && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: AW,
                  marginBottom: "1.25rem",
                }}
              >
                {eyebrow}
              </motion.p>
            )}

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: "clamp(1.875rem,3.5vw,2.875rem)",
                lineHeight: 1.1,
                fontWeight: 600,
                color: fg,
                letterSpacing: "-0.015em",
                marginBottom: body ? "1.25rem" : "2.75rem",
              }}
            >
              {headline}
            </motion.h2>

            {body && (
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 }}
                style={{ fontSize: "1rem", lineHeight: 1.7, color: mu, marginBottom: "2.75rem" }}
              >
                {body}
              </motion.p>
            )}

            <div>
              {displayPanels.map((panel, i) => {
                const Icon = ICON_MAP[panel.icon] ?? AlertTriangle;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                    className="group"
                    style={{
                      display: "flex",
                      gap: "1.25rem",
                      padding: "1.375rem 0",
                      borderTop: `1px solid ${dividerColor}`,
                      cursor: "default",
                    }}
                  >
                    <div style={{ flexShrink: 0, paddingTop: 2 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          background: iconBg,
                          border: `1px solid ${iconBorder}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "background 0.3s, border-color 0.3s",
                        }}
                        className="group-hover:!bg-[hsl(68,60%,52%)]/20 group-hover:!border-[hsl(68,60%,52%)]/50"
                      >
                        <Icon style={{ width: 16, height: 16, color: AW }} />
                      </div>
                    </div>

                    <div>
                      <p
                        style={{
                          fontFamily: DISPLAY_FONT,
                          fontSize: "1rem",
                          fontWeight: 600,
                          color: fg,
                          marginBottom: "0.4rem",
                          letterSpacing: "-0.01em",
                          transition: "color 0.2s",
                        }}
                      >
                        {panel.title}
                      </p>
                      <p style={{ fontSize: "0.9rem", lineHeight: 1.65, color: mu }}>
                        {panel.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
              <div style={{ height: 1, background: dividerColor }} />
            </div>

            {ctaText && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.25 }}
                style={{ marginTop: "2.25rem" }}
              >
                {ctaMode === "chilipiper" ? (
                  <ChiliPiperButton
                    url={ctaUrl ?? ""}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.75rem 2rem",
                      borderRadius: "0.5rem",
                      background: AW,
                      color: P,
                      fontWeight: 600,
                      fontSize: "0.9375rem",
                      cursor: "pointer",
                      border: "none",
                    }}
                  >
                    {ctaText}
                  </ChiliPiperButton>
                ) : (
                  <a
                    href={ctaUrl || "#"}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.75rem 2rem",
                      borderRadius: "0.5rem",
                      background: AW,
                      color: P,
                      fontWeight: 600,
                      fontSize: "0.9375rem",
                      textDecoration: "none",
                    }}
                  >
                    {ctaText}
                  </a>
                )}
              </motion.div>
            )}
          </motion.div>

        </div>
      </div>
    </section>
  );
}
