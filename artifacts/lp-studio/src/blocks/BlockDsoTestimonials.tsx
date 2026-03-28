import { motion } from "framer-motion";
import { Quote, User } from "lucide-react";
import type { DsoTestimonialsBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

interface Props {
  props: DsoTestimonialsBlockProps;
}

const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

export function BlockDsoTestimonials({ props }: Props) {
  const { eyebrow, headline, subheadline, testimonials = [], backgroundStyle = "dark" } = props;
  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg    = dark ? "rgba(255,255,255,0.05)" : "#fff";
  const cardBor   = dark ? "1px solid rgba(255,255,255,0.09)" : "1px solid #e5e7eb";
  const quoteC    = dark ? "rgba(255,255,255,0.85)" : BRAND;
  const authorC   = dark ? "#fff" : BRAND;
  const locC      = dark ? LIME : "#6b7280";
  const divC      = dark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  return (
    <section style={sectionBg} className="py-24 md:py-32">
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.09, duration: 0.55 }}
              style={{
                background: cardBg,
                border: cardBor,
                borderRadius: "1.25rem",
                padding: "1.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
                backdropFilter: dark ? "blur(12px)" : "none",
              }}
            >
              <Quote style={{ width: 24, height: 24, color: dark ? `${LIME}80` : `${BRAND}40`, flexShrink: 0 }} />

              <p
                style={{
                  fontSize: "0.9375rem",
                  color: quoteC,
                  lineHeight: 1.7,
                  fontStyle: "italic",
                  flex: 1,
                }}
              >
                "{t.quote}"
              </p>

              <div style={{ borderTop: `1px solid ${divC}`, paddingTop: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: dark ? "rgba(255,255,255,0.10)" : `${BRAND}10`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <User style={{ width: 16, height: 16, color: dark ? "rgba(255,255,255,0.5)" : `${BRAND}70` }} />
                </div>
                <div>
                  <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: authorC, lineHeight: 1.2 }}>{t.author}</p>
                  {t.location && (
                    <p style={{ fontSize: "0.8125rem", color: locC, marginTop: 2 }}>{t.location}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
