import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Rocket, BarChart3, TrendingUp, CheckCircle2, Star, Zap, Target, Layers } from "lucide-react";
import type { DsoPilotStepsBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

const STEP_ICONS = [Rocket, BarChart3, TrendingUp, CheckCircle2, Star, Zap, Target, Layers];

interface Props {
  props: DsoPilotStepsBlockProps;
}

const P     = "hsl(152,42%,12%)";
const FG    = "hsl(152,40%,13%)";
const MU    = "hsl(152,8%,48%)";
const AW    = "hsl(68,60%,52%)";
const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const DEFAULT_STEPS = [
  {
    icon: Rocket,
    title: "Launch a Pilot",
    subtitle: "Start with 5–10 offices",
    desc: "Dandy deploys premium scanners, onboards doctors with hands-on training, and integrates into existing workflows — no CAPEX, no disruption.",
    details: [
      "Premium hardware included for every operatory",
      "Dedicated field team manages change management",
      "Doctors trained and scanning within days",
    ],
  },
  {
    icon: BarChart3,
    title: "Validate Impact",
    subtitle: "Measure results in 60–90 days",
    desc: "Track remake reduction, chair time recovered, and same-store revenue lift in real time — proving ROI before you scale.",
    details: [
      "Live dashboard tracks pilot KPIs",
      "Compare pilot offices vs. control group",
      "Executive-ready reporting for leadership review",
    ],
  },
  {
    icon: TrendingUp,
    title: "Scale With Confidence",
    subtitle: "Roll out across the network",
    desc: "Expand across your entire network with the same standard, same playbook, and same results — predictable execution at enterprise scale.",
    details: [
      "Consistent onboarding across all locations",
      "One standard across every office and brand",
      "MSA ensures network-wide alignment at scale",
    ],
  },
];

export function BlockDsoPilotSteps({ props }: Props) {
  const { eyebrow, headline, subheadline, backgroundStyle = "muted" } = props;
  const dark = isDarkBg(backgroundStyle);

  const pilotRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: pilotRef,
    offset: ["start 80%", "end 60%"],
  });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  const eyebrowColor  = dark ? AW : P;
  const headlineColor = dark ? "#fff" : FG;
  const subColor      = dark ? "rgba(255,255,255,0.65)" : MU;
  const titleColor    = dark ? "#fff" : FG;
  const subtitleColor = dark ? `${AW}cc` : `${P}b3`;
  const descColor     = dark ? "rgba(255,255,255,0.60)" : MU;
  const trackGhost    = dark ? "rgba(255,255,255,0.12)" : `${P}22`;
  const trackActive   = dark ? AW : P;

  return (
    <section style={getBgStyle(backgroundStyle)} className="py-24 md:py-32">
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
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
                color: eyebrowColor,
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
              fontSize: "clamp(2rem,4vw,3.25rem)",
              lineHeight: 1.1,
              fontWeight: 600,
              color: headlineColor,
              letterSpacing: 0,
            }}
          >
            {headline || <>Start small. Prove it out.<br />Then scale.</>}
          </motion.h2>
          {subheadline && (
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              style={{
                marginTop: "1.5rem",
                fontSize: "1.125rem",
                color: subColor,
                lineHeight: 1.65,
                maxWidth: 560,
                margin: "1.5rem auto 0",
              }}
            >
              {subheadline}
            </motion.p>
          )}
        </div>

        <div className="relative" ref={pilotRef}>
          {/* Track line */}
          <div
            style={{
              position: "absolute",
              left: 24,
              top: 0,
              bottom: 0,
              width: 1,
              background: trackGhost,
            }}
          />
          <motion.div
            style={{
              position: "absolute",
              left: 24,
              top: 0,
              width: 1,
              background: trackActive,
              height: lineHeight,
              transformOrigin: "top",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "3.5rem" }}>
            {(props.steps && props.steps.length > 0 ? props.steps : DEFAULT_STEPS).map((step, i) => {
              const Icon = STEP_ICONS[i % STEP_ICONS.length];
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.6 }}
                  style={{ position: "relative", display: "flex", gap: "1.5rem" }}
                >
                  {/* Icon circle */}
                  <div style={{ position: "relative", zIndex: 10, flexShrink: 0 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: dark ? AW : P,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: dark ? `0 8px 24px ${AW}33` : `0 8px 24px ${P}33`,
                      }}
                    >
                      <Icon style={{ width: 20, height: 20, color: dark ? "hsl(152,40%,13%)" : "hsl(48,100%,96%)" }} />
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ paddingBottom: 8, marginTop: -2 }}>
                    <p
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: AW,
                        textTransform: "uppercase",
                        letterSpacing: "0.2em",
                        marginBottom: 4,
                      }}
                    >
                      Step 0{i + 1}
                    </p>
                    <h3
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 500,
                        color: titleColor,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {step.title}
                    </h3>
                    <p
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: subtitleColor,
                        marginTop: 4,
                      }}
                    >
                      {step.subtitle}
                    </p>
                    <p
                      style={{
                        marginTop: "1rem",
                        fontSize: "0.9375rem",
                        color: descColor,
                        lineHeight: 1.65,
                      }}
                    >
                      {step.desc}
                    </p>
                    <ul style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: 8 }}>
                      {step.details.map((d) => (
                        <li
                          key={d}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            fontSize: "0.9375rem",
                            color: descColor,
                          }}
                        >
                          <CheckCircle2
                            style={{ width: 16, height: 16, color: dark ? AW : P, flexShrink: 0, marginTop: 2 }}
                          />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
