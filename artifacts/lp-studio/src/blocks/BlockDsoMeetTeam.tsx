import { motion } from "framer-motion";
import { Mail, Calendar, User } from "lucide-react";
import type { DsoMeetTeamBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses } from "@/lib/brand-config";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props {
  props: DsoMeetTeamBlockProps;
  brand: BrandConfig;
}

const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

export function BlockDsoMeetTeam({ props, brand }: Props) {
  const { eyebrow, headline, subheadline, ctaText, ctaUrl, ctaMode = "link", members = [], backgroundStyle = "dark" } = props;
  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.60)" : "#6b7280";
  const cardBg    = dark ? "rgba(255,255,255,0.05)" : "#fff";
  const cardBor   = dark ? "1px solid rgba(255,255,255,0.09)" : "1px solid #e5e7eb";
  const nameC     = dark ? "#fff" : BRAND;
  const roleC     = dark ? LIME : BRAND;
  const mutedC    = dark ? "rgba(255,255,255,0.45)" : "#9ca3af";

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
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              style={{ marginTop: "1.25rem", fontSize: "1.0625rem", color: subC, lineHeight: 1.7, maxWidth: 560, margin: "1.25rem auto 0" }}
            >
              {subheadline}
            </motion.p>
          )}
          {ctaText && ctaUrl && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              style={{ marginTop: "2rem" }}
            >
              {ctaMode === "chilipiper" ? (
                <ChiliPiperButton
                  url={ctaUrl}
                  className={getButtonClasses(brand, "inline-flex items-center gap-2")}
                  style={{ backgroundColor: brand.accentColor, color: brand.primaryColor }}
                >
                  <Calendar style={{ width: 16, height: 16 }} />
                  {ctaText}
                </ChiliPiperButton>
              ) : (
                <motion.a
                  href={ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={getButtonClasses(brand, "inline-flex items-center gap-2")}
                  style={{ backgroundColor: brand.accentColor, color: brand.primaryColor, textDecoration: "none" }}
                  whileHover={{ scale: 1.04, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING}
                >
                  <Calendar style={{ width: 16, height: 16 }} />
                  {ctaText}
                </motion.a>
              )}
            </motion.div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {members.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.55 }}
              style={{
                background: cardBg,
                border: cardBor,
                borderRadius: "1.25rem",
                padding: "1.75rem 1.5rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
                backdropFilter: dark ? "blur(12px)" : "none",
              }}
            >
              {m.photo ? (
                <img
                  src={m.photo}
                  alt={m.name}
                  style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: `2px solid ${dark ? "rgba(255,255,255,0.15)" : "#e5e7eb"}` }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: dark ? `${LIME}18` : `${BRAND}12`,
                    border: `2px solid ${dark ? `${LIME}40` : `${BRAND}25`}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <User style={{ width: 30, height: 30, color: dark ? LIME : BRAND, opacity: 0.7 }} />
                </div>
              )}

              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: DISPLAY, fontSize: "1.0625rem", fontWeight: 600, color: nameC, letterSpacing: "-0.01em" }}>{m.name}</p>
                <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: roleC, marginTop: 3 }}>{m.role}</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
                {m.email && (
                  <a
                    href={`mailto:${m.email}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: "0.8125rem",
                      color: mutedC,
                      textDecoration: "none",
                      transition: "color 0.2s",
                    }}
                  >
                    <Mail style={{ width: 13, height: 13, flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</span>
                  </a>
                )}
                {m.calendlyUrl && (
                  <a
                    href={m.calendlyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: dark ? BRAND : "#fff",
                      background: dark ? LIME : BRAND,
                      borderRadius: "0.5rem",
                      padding: "0.5rem 0.875rem",
                      textDecoration: "none",
                      marginTop: 4,
                    }}
                  >
                    <Calendar style={{ width: 13, height: 13 }} />
                    Book a call
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
