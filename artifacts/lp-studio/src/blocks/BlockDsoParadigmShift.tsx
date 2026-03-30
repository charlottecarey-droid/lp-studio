import { motion } from "framer-motion";
import { XCircle, CheckCircle2 } from "lucide-react";
import type { DsoParadigmShiftBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { BlockDsoCta } from "@/components/BlockDsoCta";

interface Props {
  props: DsoParadigmShiftBlockProps;
  brand: BrandConfig;
}

const BRAND   = "#003A30";
const LIME    = "#C7E738";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

export function BlockDsoParadigmShift({ props, brand }: Props) {
  const {
    eyebrow, headline, subheadline,
    oldWayLabel = "Traditional Lab",
    newWayLabel = "Dandy",
    oldWayItems = [],
    newWayItems = [],
    ctaText, ctaUrl, ctaMode = "link", ctaVariant = "primary",
    backgroundStyle = "dark",
  } = props;

  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  // ── light-mode tokens ──────────────────────────────────────────
  // Section uses a very light mint tint so white cards pop
  const lightSectionBg = { backgroundColor: "#f2f5f2" };

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.60)" : "#6b7280";

  // Old Way
  const oldCardBg  = dark ? "rgba(255,255,255,0.04)" : "#e8ece8";
  const oldCardBor = dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #d4d9d4";
  const oldSubC    = dark ? "rgba(255,255,255,0.40)" : "#9ca3af";
  const oldHeadC   = dark ? "rgba(255,255,255,0.65)" : "#374151";
  const oldItemC   = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const oldIconC   = "#f87171"; // soft red

  // New Way
  const newCardBg  = dark ? BRAND : BRAND;
  const newCardBor = dark ? `2px solid rgba(199,231,56,0.55)` : "2px solid transparent";
  const newSubC    = LIME;
  const newHeadC   = "#ffffff";
  const newItemC   = "rgba(255,255,255,0.88)";
  const newIconC   = LIME;

  const effectiveSectionBg = dark ? sectionBg : lightSectionBg;

  return (
    <section style={effectiveSectionBg} className="py-24 md:py-32">
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 1.5rem" }}>

        {/* ── Header ── */}
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
              style={{ fontFamily: DISPLAY, fontSize: "clamp(2rem,4vw,3rem)", lineHeight: 1.1, fontWeight: 600, color: headlineC, letterSpacing: "-0.02em" }}
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
              style={{ marginTop: "1.25rem", fontSize: "1.0625rem", color: subC, lineHeight: 1.7, maxWidth: 580, margin: "1.25rem auto 0" }}
            >
              {subheadline}
            </motion.p>
          )}
        </div>

        {/* ── Cards ── */}
        <div style={{ display: "grid", gap: "1.25rem" }} className="grid-cols-1 md:grid-cols-2">

          {/* Old Way */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            style={{
              background: oldCardBg,
              border: oldCardBor,
              borderRadius: "1.25rem",
              padding: "2.25rem",
            }}
          >
            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: oldSubC, marginBottom: "0.5rem" }}>
                Old Way
              </p>
              <h3 style={{ fontFamily: DISPLAY, fontSize: "1.75rem", fontWeight: 600, color: oldHeadC, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                {oldWayLabel}
              </h3>
            </div>
            <ul style={{ display: "flex", flexDirection: "column", gap: "1rem" }} aria-label="Old Way">
              {oldWayItems.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 + i * 0.06 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
                >
                  <XCircle
                    aria-hidden="true"
                    style={{ width: 20, height: 20, color: oldIconC, flexShrink: 0, marginTop: 1 }}
                  />
                  <span style={{ fontSize: "0.9375rem", color: oldItemC, lineHeight: 1.6 }}>{item}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* New Way */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
            style={{
              background: newCardBg,
              border: newCardBor,
              borderRadius: "1.25rem",
              padding: "2.25rem",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Subtle top-right glow */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute", top: -60, right: -60,
                width: 200, height: 200, borderRadius: "50%",
                background: `${LIME}18`,
                filter: "blur(50px)",
                pointerEvents: "none",
              }}
            />
            <div style={{ marginBottom: "1.5rem", position: "relative" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: newSubC, marginBottom: "0.5rem" }}>
                New Way
              </p>
              <h3 style={{ fontFamily: DISPLAY, fontSize: "1.75rem", fontWeight: 600, color: newHeadC, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                {newWayLabel}
              </h3>
            </div>
            <ul style={{ display: "flex", flexDirection: "column", gap: "1rem", position: "relative" }} aria-label="New Way">
              {newWayItems.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
                >
                  <CheckCircle2
                    aria-hidden="true"
                    style={{ width: 20, height: 20, color: newIconC, flexShrink: 0, marginTop: 1 }}
                  />
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
