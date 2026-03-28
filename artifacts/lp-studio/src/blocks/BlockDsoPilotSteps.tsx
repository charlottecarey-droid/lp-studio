import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ScanDown, FlickerDot } from "./SectionAmbient";
import { Rocket, BarChart3, TrendingUp, CheckCircle2, Star, Zap, Target, Layers } from "lucide-react";
import type { DsoPilotStepsBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg, getImageBgSectionStyle } from "@/lib/bg-styles";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";

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
  const { eyebrow, headline, subheadline, backgroundStyle = "muted", backgroundImage, backgroundOverlay, overlayColor = "#000000", ctaText, ctaUrl, ctaMode = "link" } = props;
  const dark = isDarkBg(backgroundStyle) || !!backgroundImage;
  const sectionBgStyle = backgroundImage ? getImageBgSectionStyle(backgroundImage) : getBgStyle(backgroundStyle);

  const pilotRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: pilotRef,
    offset: ["start 80%", "end 60%"],
  });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  const eyebrowColor  = dark ? AW : P;
  const headlineColor = dark ? "#fff" : FG;
  const subColor      = dark ? "rgba(255,255,255,0.60)" : MU;
  const titleColor    = dark ? "#fff" : FG;
  const subtitleColor = dark ? `${AW}cc` : `${P}b3`;
  const descColor     = dark ? "rgba(255,255,255,0.58)" : MU;
  const trackGhost    = dark ? "rgba(255,255,255,0.10)" : `${P}18`;
  const trackActive   = dark ? AW : P;

  const stepCardBg    = dark ? "rgba(255,255,255,0.04)" : "#fff";
  const stepCardBorder = dark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.05)";
  const stepCardShadow = dark ? "none" : "0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.05)";

  return (
    <section style={{ ...sectionBgStyle, position: "relative", overflow: "hidden" }} className="py-24 md:py-32">
      {backgroundImage && <div style={{ position: "absolute", inset: 0, backgroundColor: overlayColor, opacity: backgroundOverlay ?? 0.55, zIndex: 0, pointerEvents: "none" }} />}
      {dark && (
        <>
          <ScanDown duration={11} delay={0} repeatDelay={10} />
          <FlickerDot top="25%" left="6%" delay={0.5} />
          <FlickerDot top="60%" right="5%" delay={2.5} />
          <FlickerDot top="80%" left="45%" delay={5} />
        </>
      )}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto", padding: "0 1.5rem" }}>
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
              letterSpacing: "-0.015em",
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
                fontSize: "1.0625rem",
                color: subColor,
                lineHeight: 1.7,
                maxWidth: 560,
                margin: "1.5rem auto 0",
              }}
            >
              {subheadline}
            </motion.p>
          )}
        </div>

        <div className="relative" ref={pilotRef}>
          {/* Track ghost */}
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
          {/* Track active fill */}
          <motion.div
            style={{
              position: "absolute",
              left: 24,
              top: 0,
              width: 2,
              background: `linear-gradient(to bottom, ${trackActive}, ${trackActive}88)`,
              height: lineHeight,
              transformOrigin: "top",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
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
                        boxShadow: dark
                          ? `0 0 0 4px ${AW}18, 0 8px 24px ${AW}40`
                          : `0 0 0 4px ${P}12, 0 8px 24px ${P}35`,
                      }}
                    >
                      <Icon style={{ width: 20, height: 20, color: dark ? "hsl(152,40%,13%)" : "hsl(48,100%,96%)" }} />
                    </div>
                  </div>

                  {/* Content card */}
                  <div
                    style={{
                      flex: 1,
                      padding: "1.75rem 2rem 2rem",
                      borderRadius: "1.25rem",
                      background: stepCardBg,
                      backdropFilter: dark ? "blur(12px)" : "none",
                      border: stepCardBorder,
                      boxShadow: stepCardShadow,
                      marginTop: -4,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: dark ? AW : P,
                        textTransform: "uppercase",
                        letterSpacing: "0.15em",
                        marginBottom: 6,
                      }}
                    >
                      Step 0{i + 1}
                    </p>
                    <h3
                      style={{
                        fontFamily: DISPLAY_FONT,
                        fontSize: "1.25rem",
                        fontWeight: 600,
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
                        lineHeight: 1.7,
                      }}
                    >
                      {step.desc}
                    </p>
                    <ul style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: 8 }}>
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
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: dark ? `${AW}20` : `${P}12`,
                              border: dark ? `1px solid ${AW}35` : `1px solid ${P}25`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          >
                            <CheckCircle2
                              style={{ width: 11, height: 11, color: dark ? AW : P }}
                            />
                          </div>
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

        {ctaText && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            style={{ textAlign: "center", marginTop: "3rem" }}
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
      </div>
    </section>
  );
}
