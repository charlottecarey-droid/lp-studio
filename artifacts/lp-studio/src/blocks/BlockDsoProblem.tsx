import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  AlertTriangle, BarChart3, Users2, TrendingDown,
  Clock, Shield, Microscope, Layers, Zap, Target,
  DollarSign, Network, Activity, Scale,
} from "lucide-react";
import type { DsoProblemBlockProps } from "@/lib/block-types";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const P    = "hsl(152,42%,12%)";
const PFG  = "hsl(48,100%,96%)";
const AW   = "hsl(68,60%,52%)";
const MU   = "rgba(255,255,255,0.52)";

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
  } = props;

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
      style={{ background: P, color: PFG, position: "relative", overflow: "hidden" }}
      className="py-24 md:py-36"
    >
      {/* Subtle noise/texture overlay */}
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

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}>
        <div className="grid md:grid-cols-[5fr_6fr] gap-16 lg:gap-24 items-center">

          {/* ── Left: Stacked photography ── */}
          <motion.div style={{ position: "relative", minHeight: 480, paddingBottom: 100 }}>
            {/* Primary image */}
            <motion.div
              style={{
                y: imgAY,
                borderRadius: "1.25rem",
                overflow: "hidden",
                boxShadow: "0 8px 24px rgba(0,0,0,0.35), 0 40px 80px rgba(0,0,0,0.40)",
                position: "relative",
                zIndex: 1,
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
              {/* Lime accent bottom strip */}
              <div style={{ height: 3, background: `linear-gradient(90deg, ${AW}, transparent)` }} />
            </motion.div>

            {/* Secondary image — offset lower-right */}
            <motion.div
              style={{
                y: imgBY,
                position: "absolute",
                bottom: 0,
                right: -24,
                width: "58%",
                zIndex: 2,
                borderRadius: "1rem",
                overflow: "hidden",
                boxShadow: "0 16px 48px rgba(0,0,0,0.50), 0 4px 16px rgba(0,0,0,0.35)",
              }}
              initial={{ opacity: 0, x: 28 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <img
                src={imgB}
                alt="Precision dental work"
                style={{ width: "100%", height: 210, objectFit: "cover", display: "block" }}
                loading="lazy"
              />
              {/* Dark overlay with stat */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(160deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.55) 100%)",
                  display: "flex",
                  alignItems: "flex-end",
                  padding: "1rem 1.25rem",
                }}
              >
                <div>
                  <p style={{ fontFamily: DISPLAY_FONT, fontSize: "1.75rem", fontWeight: 700, color: "#fff", lineHeight: 1, letterSpacing: "-0.03em" }}>96%</p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 3 }}>First-time right rate</p>
                </div>
              </div>
              {/* Lime corner */}
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
                color: PFG,
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
                style={{ fontSize: "1rem", lineHeight: 1.7, color: MU, marginBottom: "2.75rem" }}
              >
                {body}
              </motion.p>
            )}

            {/* Problem list — vertical with dividers */}
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
                      borderTop: `1px solid rgba(255,255,255,0.07)`,
                      cursor: "default",
                    }}
                  >
                    {/* Icon */}
                    <div style={{ flexShrink: 0, paddingTop: 2 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          background: `${AW}14`,
                          border: `1px solid ${AW}28`,
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

                    {/* Text */}
                    <div>
                      <p
                        style={{
                          fontFamily: DISPLAY_FONT,
                          fontSize: "1rem",
                          fontWeight: 600,
                          color: PFG,
                          marginBottom: "0.4rem",
                          letterSpacing: "-0.01em",
                          transition: "color 0.2s",
                        }}
                        className="group-hover:text-white"
                      >
                        {panel.title}
                      </p>
                      <p style={{ fontSize: "0.9rem", lineHeight: 1.65, color: MU }}>
                        {panel.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
              {/* Bottom divider */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
