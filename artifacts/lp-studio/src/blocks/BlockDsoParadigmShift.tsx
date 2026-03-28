import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import type { DsoParadigmShiftBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

interface Props {
  props: DsoParadigmShiftBlockProps;
}

const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

export function BlockDsoParadigmShift({ props }: Props) {
  const {
    eyebrow, headline, subheadline,
    oldWayLabel = "The Old Way",
    newWayLabel = "The Dandy Way",
    oldWayItems = [],
    newWayItems = [],
    backgroundStyle = "dark",
  } = props;

  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const oldCardBg = dark ? "rgba(255,255,255,0.03)" : "#fafafa";
  const oldCardBor = dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb";
  const newCardBg = dark ? "rgba(194,229,58,0.06)" : "#f0fdf4";
  const newCardBor = dark ? `1px solid ${LIME}35` : `1px solid ${BRAND}30`;

  return (
    <section style={sectionBg} className="py-24 md:py-32">
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 1.5rem" }}>
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
              style={{ marginTop: "1.25rem", fontSize: "1.0625rem", color: subC, lineHeight: 1.7, maxWidth: 600, margin: "1.25rem auto 0" }}
            >
              {subheadline}
            </motion.p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="md:grid-cols-2 grid-cols-1">
          {/* Old Way */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              background: oldCardBg,
              border: oldCardBor,
              borderRadius: "1.25rem",
              padding: "2rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X style={{ width: 14, height: 14, color: "#ef4444" }} />
              </div>
              <span style={{ fontFamily: DISPLAY, fontSize: "1rem", fontWeight: 600, color: dark ? "rgba(255,255,255,0.7)" : "#6b7280" }}>
                {oldWayLabel}
              </span>
            </div>
            <ul style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {oldWayItems.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 + i * 0.06 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.9375rem", color: dark ? "rgba(255,255,255,0.50)" : "#9ca3af", lineHeight: 1.5 }}
                >
                  <X style={{ width: 14, height: 14, color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
                  <span style={{ textDecoration: "line-through", opacity: 0.8 }}>{item}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* New Way */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              background: newCardBg,
              border: newCardBor,
              borderRadius: "1.25rem",
              padding: "2rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: dark ? `${LIME}25` : `${BRAND}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Check style={{ width: 14, height: 14, color: dark ? LIME : BRAND }} />
              </div>
              <span style={{ fontFamily: DISPLAY, fontSize: "1rem", fontWeight: 600, color: dark ? LIME : BRAND }}>
                {newWayLabel}
              </span>
            </div>
            <ul style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {newWayItems.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.9375rem", color: dark ? "rgba(255,255,255,0.80)" : BRAND, lineHeight: 1.5, fontWeight: 500 }}
                >
                  <Check style={{ width: 14, height: 14, color: dark ? LIME : BRAND, flexShrink: 0, marginTop: 2 }} />
                  <span>{item}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
