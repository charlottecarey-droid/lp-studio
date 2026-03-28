import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { DsoActivationStepsBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";

interface Props {
  props: DsoActivationStepsBlockProps;
}

const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

export function BlockDsoActivationSteps({ props }: Props) {
  const {
    eyebrow, headline, subheadline, steps = [],
    ctaText, ctaUrl, ctaMode = "link", backgroundStyle = "dark",
  } = props;
  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg    = dark ? "rgba(255,255,255,0.04)" : "#fff";
  const cardBor   = dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb";
  const stepNumC  = dark ? LIME : BRAND;
  const titleC    = dark ? "#fff" : BRAND;
  const descC     = dark ? "rgba(255,255,255,0.60)" : "#6b7280";
  const connLine  = dark ? "rgba(255,255,255,0.10)" : "#e5e7eb";

  return (
    <section style={sectionBg} className="py-24 md:py-32">
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          {eyebrow && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: eyebrowC, marginBottom: "1.25rem" }}
            >
              {eyebrow}
            </motion.p>
          )}
          {headline && (
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              style={{ fontFamily: DISPLAY, fontSize: "clamp(1.875rem,3.5vw,2.75rem)", lineHeight: 1.15, fontWeight: 600, color: headlineC, letterSpacing: "-0.015em" }}
            >
              {headline}
            </motion.h2>
          )}
          {subheadline && (
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              style={{ marginTop: "1.25rem", fontSize: "1.0625rem", color: subC, lineHeight: 1.7, maxWidth: 560, margin: "1.25rem auto 0" }}
            >
              {subheadline}
            </motion.p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", position: "relative" }}>
          {/* Vertical connector */}
          <div
            style={{
              position: "absolute",
              left: 27,
              top: 24,
              bottom: 24,
              width: 2,
              background: connLine,
              zIndex: 0,
            }}
          />

          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.55 }}
              style={{ display: "flex", gap: "1.25rem", position: "relative", zIndex: 1 }}
            >
              {/* Step number badge */}
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  background: dark ? `${LIME}18` : `${BRAND}10`,
                  border: `2px solid ${dark ? `${LIME}50` : `${BRAND}30`}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontFamily: DISPLAY, fontSize: "0.875rem", fontWeight: 700, color: stepNumC }}>{step.step}</span>
              </div>

              {/* Card */}
              <div
                style={{
                  flex: 1,
                  background: cardBg,
                  border: cardBor,
                  borderRadius: "1rem",
                  padding: "1.5rem 1.75rem",
                  backdropFilter: dark ? "blur(12px)" : "none",
                }}
              >
                <p style={{ fontFamily: DISPLAY, fontSize: "1.0625rem", fontWeight: 600, color: titleC, letterSpacing: "-0.01em" }}>{step.title}</p>
                <p style={{ fontSize: "0.9375rem", color: descC, marginTop: "0.5rem", lineHeight: 1.65 }}>{step.desc}</p>
              </div>
            </motion.div>
          ))}
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
                  gap: 8,
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: dark ? BRAND : "#fff",
                  background: dark ? LIME : BRAND,
                  padding: "0.875rem 2rem",
                  borderRadius: "0.625rem",
                  border: "none",
                }}
              >
                {ctaText}
                <ArrowRight style={{ width: 16, height: 16 }} />
              </ChiliPiperButton>
            ) : (
              <a
                href={ctaUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: dark ? BRAND : "#fff",
                  background: dark ? LIME : BRAND,
                  padding: "0.875rem 2rem",
                  borderRadius: "0.625rem",
                  textDecoration: "none",
                }}
              >
                {ctaText}
                <ArrowRight style={{ width: 16, height: 16 }} />
              </a>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}
