import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { DsoFaqBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses } from "@/lib/brand-config";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { BlockDsoCta } from "@/components/BlockDsoCta";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props {
  props: DsoFaqBlockProps;
  brand: BrandConfig;
}

const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

export function BlockDsoFaq({ props, brand }: Props) {
  const { eyebrow, headline, subheadline, items = [], ctaText, ctaUrl, ctaMode = "link", ctaVariant = "secondary", backgroundStyle = "white" } = props;
  const [open, setOpen] = useState<number | null>(0);
  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const qC        = dark ? "#fff" : BRAND;
  const aC        = dark ? "rgba(255,255,255,0.65)" : "#4b5563";
  const rowBg     = dark ? "rgba(255,255,255,0.04)" : "#fff";
  const rowBor    = dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb";
  const chevC     = dark ? LIME : BRAND;

  return (
    <section style={sectionBg} className="py-24 md:py-32">
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
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
              style={{ marginTop: "1rem", fontSize: "1.0625rem", color: subC, lineHeight: 1.7 }}
            >
              {subheadline}
            </motion.p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: ctaText ? "3rem" : 0 }}>
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              style={{
                background: rowBg,
                border: rowBor,
                borderRadius: "0.875rem",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1.25rem 1.5rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  gap: "1rem",
                }}
              >
                <span
                  style={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: qC,
                    lineHeight: 1.4,
                    flex: 1,
                  }}
                >
                  {item.question}
                </span>
                <motion.span
                  animate={{ rotate: open === i ? 180 : 0 }}
                  transition={{ duration: 0.22 }}
                  style={{ flexShrink: 0 }}
                >
                  <ChevronDown style={{ width: 18, height: 18, color: chevC }} />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <p
                      style={{
                        padding: "0 1.5rem 1.25rem",
                        fontSize: "0.9375rem",
                        color: aC,
                        lineHeight: 1.75,
                      }}
                    >
                      {item.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {ctaText && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            style={{ textAlign: "center" }}
          >
            <BlockDsoCta ctaText={ctaText} ctaUrl={ctaUrl} ctaMode={ctaMode} ctaVariant={ctaVariant} brand={brand} dark={dark} />
          </motion.div>
        )}
      </div>
    </section>
  );
}
