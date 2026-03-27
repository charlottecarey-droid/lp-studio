import { motion } from "framer-motion";
import {
  AlertTriangle, BarChart3, Users2, TrendingDown,
  Clock, Shield, Microscope, Layers, Zap, Target,
  DollarSign, Network, Activity, Scale,
} from "lucide-react";
import type { DsoProblemBlockProps } from "@/lib/block-types";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const LIME   = "hsl(72,55%,48%)";
const TEAL   = "hsl(192,30%,10%)";
const MUTED  = "hsl(192,10%,40%)";

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
  } = props;

  const displayPanels = panels && panels.length > 0 ? panels.slice(0, 4) : DEFAULT_PANELS;

  return (
    <section
      style={{ background: "hsl(0,0%,98%)", color: TEAL }}
      className="py-24 md:py-32 relative overflow-hidden"
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }} className="md:px-10 relative z-10">

        <div className="text-center mb-16">
          {eyebrow && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: LIME, marginBottom: "1.25rem" }}
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
              fontSize: "clamp(2rem,4vw,3.25rem)",
              lineHeight: 1.1,
              fontWeight: 600,
              color: TEAL,
              letterSpacing: 0,
              maxWidth: 800,
              margin: "0 auto",
            }}
          >
            {headline}
          </motion.h2>
          {body && (
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              style={{ marginTop: "1.5rem", fontSize: "1.0625rem", lineHeight: 1.7, maxWidth: 640, margin: "1.5rem auto 0", color: MUTED }}
            >
              {body}
            </motion.p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {displayPanels.map((panel, i) => {
            const Icon = ICON_MAP[panel.icon] ?? AlertTriangle;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group rounded-2xl p-8"
                style={{
                  background: "white",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `${LIME}14`,
                    marginBottom: "1.5rem",
                  }}
                  className="group-hover:opacity-80 transition-opacity"
                >
                  <Icon style={{ width: 20, height: 20, color: LIME }} />
                </div>
                <h3
                  style={{
                    fontSize: "1.0625rem",
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    color: TEAL,
                    marginBottom: "0.75rem",
                  }}
                >
                  {panel.title}
                </h3>
                <p style={{ fontSize: "0.9375rem", lineHeight: 1.65, color: MUTED }}>{panel.desc}</p>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
