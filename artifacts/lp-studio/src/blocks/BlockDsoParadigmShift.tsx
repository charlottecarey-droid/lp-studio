import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import type { DsoParadigmShiftBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { BlockDsoCta } from "@/components/BlockDsoCta";

interface Props {
  props: DsoParadigmShiftBlockProps;
  brand: BrandConfig;
}

const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

export function BlockDsoParadigmShift({ props, brand }: Props) {
  const {
    eyebrow, headline, subheadline,
    oldWayLabel = "The Old Way",
    newWayLabel = "The Dandy Way",
    oldWayItems = [],
    newWayItems = [],
    ctaText, ctaUrl, ctaMode = "link", ctaVariant = "primary",
    backgroundStyle = "dark",
  } = props;

  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC    = dark ? LIME : BRAND;
  const headlineC   = dark ? "#fff" : BRAND;
  const subC        = dark ? "rgba(255,255,255,0.65)" : "#6b7280";

  // Old Way card — subtle border for balance
  const oldCardBg   = dark ? "rgba(255,255,255,0.03)" : "#f9fafb";
  const oldCardBor  = dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e5e7eb";
  const oldLabelC   = dark ? "rgba(255,255,255,0.55)" : "#9ca3af";
  const oldItemC    = dark ? "rgba(255,255,255,0.50)" : "#9ca3af";

  // New Way card — prominent lime/brand outline
  const newCardBg   = dark ? "rgba(199,231,56,0.06)" : "rgba(0,58,48,0.04)";
  const newCardBor  = dark ? "2px solid rgba(199,231,56,0.55)" : `2px solid rgba(0,58,48,0.30)`;
  const newLabelC   = dark ? LIME : BRAND;
  const newItemC    = dark ? "rgba(255,255,255,0.90)" : BRAND;

  return (
    <section style={sectionBg} className="py-24 md:py-32">
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 1.5rem" }}>

        {/* Header */}
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

        {/* Cards */}
        <div style={{ display: "grid", gap: "1.25rem" }} className="grid-cols-1 md:grid-cols-2">

          {/* ── Old Way ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            style={{
              background: oldCardBg,
              border: oldCardBor,
              borderRadius: "1.5rem",
              padding: "2rem",
            }}
          >
            {/* Card label */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.75rem" }}>
              <div
                aria-hidden="true"
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "rgba(239,68,68,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <X style={{ width: 15, height: 15, color: "#ef4444", strokeWidth: 2.5 }} />
              </div>
              <span style={{ fontFamily: DISPLAY, fontSize: "1rem", fontWeight: 700, color: oldLabelC }}>
                {oldWayLabel}
              </span>
            </div>

            {/* Items */}
            <ul style={{ display: "flex", flexDirection: "column", gap: "1rem" }} aria-label={oldWayLabel}>
              {oldWayItems.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 + i * 0.06 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: "rgba(239,68,68,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, marginTop: 1,
                    }}
                  >
                    <X style={{ width: 12, height: 12, color: "#ef4444", strokeWidth: 2.5 }} />
                  </div>
                  <span style={{ fontSize: "0.9375rem", color: oldItemC, lineHeight: 1.6 }}>{item}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* ── New Way ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
            style={{
              background: newCardBg,
              border: newCardBor,
              borderRadius: "1.5rem",
              padding: "2rem",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Subtle glow */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute", top: -40, right: -40,
                width: 160, height: 160, borderRadius: "50%",
                background: dark ? `${LIME}18` : `${BRAND}10`,
                filter: "blur(40px)",
                pointerEvents: "none",
              }}
            />

            {/* Card label */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.75rem", position: "relative" }}>
              <div
                aria-hidden="true"
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: dark ? `${LIME}28` : `${BRAND}18`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Check style={{ width: 15, height: 15, color: dark ? LIME : BRAND, strokeWidth: 2.5 }} />
              </div>
              <span style={{ fontFamily: DISPLAY, fontSize: "1rem", fontWeight: 700, color: newLabelC }}>
                {newWayLabel}
              </span>
            </div>

            {/* Items */}
            <ul style={{ display: "flex", flexDirection: "column", gap: "1rem", position: "relative" }} aria-label={newWayLabel}>
              {newWayItems.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: dark ? `${LIME}28` : `${BRAND}18`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, marginTop: 1,
                    }}
                  >
                    <Check style={{ width: 12, height: 12, color: dark ? LIME : BRAND, strokeWidth: 2.5 }} />
                  </div>
                  <span style={{ fontSize: "0.9375rem", color: newItemC, lineHeight: 1.6, fontWeight: 500 }}>{item}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* CTA */}
        {ctaText && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            style={{ textAlign: "center", marginTop: "3rem" }}
          >
            <BlockDsoCta ctaText={ctaText} ctaUrl={ctaUrl} ctaMode={ctaMode} ctaVariant={ctaVariant} brand={brand} dark={dark} />
          </motion.div>
        )}
      </div>
    </section>
  );
}
