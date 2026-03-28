import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { DsoPromoCardsBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

interface Props {
  props: DsoPromoCardsBlockProps;
}

const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

const BADGE_PALETTE: Record<string, { bg: string; text: string }> = {
  CREDIT: { bg: LIME, text: BRAND },
  FREE:   { bg: "#fff", text: BRAND },
  NEW:    { bg: "#3b82f6", text: "#fff" },
  HOT:    { bg: "#ef4444", text: "#fff" },
};

export function BlockDsoPromoCards({ props }: Props) {
  const { eyebrow, headline, subheadline, cards = [], backgroundStyle = "dark" } = props;
  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg    = dark ? "rgba(255,255,255,0.05)" : "#fff";
  const cardBor   = dark ? "1px solid rgba(255,255,255,0.10)" : "1px solid #e5e7eb";
  const titleC    = dark ? "#fff" : BRAND;
  const descC     = dark ? "rgba(255,255,255,0.58)" : "#6b7280";

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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", maxWidth: 680, gap: "1.5rem" }}>
          {cards.map((card, i) => {
            const badge = card.badge ? (BADGE_PALETTE[card.badge.toUpperCase()] ?? { bg: LIME, text: BRAND }) : null;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.09, duration: 0.5 }}
                style={{
                  background: cardBg,
                  border: cardBor,
                  borderRadius: "1.25rem",
                  padding: "1.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.875rem",
                  backdropFilter: dark ? "blur(12px)" : "none",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {badge && (
                  <div
                    style={{
                      position: "absolute",
                      top: "1rem",
                      right: "1rem",
                      background: badge.bg,
                      color: badge.text,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      padding: "3px 8px",
                      borderRadius: "0.375rem",
                    }}
                  >
                    {card.badge}
                  </div>
                )}

                <div style={{ paddingRight: badge ? "3.5rem" : 0 }}>
                  <p style={{ fontFamily: DISPLAY, fontSize: "1.25rem", fontWeight: 700, color: titleC, letterSpacing: "-0.015em", lineHeight: 1.2 }}>{card.title}</p>
                </div>
                <p style={{ fontSize: "0.9375rem", color: descC, lineHeight: 1.65 }}>{card.desc}</p>

                {card.ctaText && (
                  <a
                    href={card.ctaUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: dark ? LIME : BRAND,
                      textDecoration: "none",
                      marginTop: "auto",
                    }}
                  >
                    {card.ctaText}
                    <ArrowRight style={{ width: 14, height: 14 }} />
                  </a>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
