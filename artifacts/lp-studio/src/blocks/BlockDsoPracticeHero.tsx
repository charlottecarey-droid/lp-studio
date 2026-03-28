import { motion } from "framer-motion";
import type { DsoPracticeHeroBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

interface Props {
  props: DsoPracticeHeroBlockProps;
}

const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

export function BlockDsoPracticeHero({ props }: Props) {
  const {
    eyebrow,
    headline,
    subheadline,
    primaryCtaText,
    primaryCtaUrl,
    secondaryCtaText,
    secondaryCtaUrl,
    trustLine,
    backgroundStyle = "dark",
  } = props;

  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC    = dark ? LIME : BRAND;
  const headlineC   = dark ? "#fff" : BRAND;
  const subC        = dark ? "rgba(255,255,255,0.6)" : "#4b5563";
  const trustC      = dark ? "rgba(255,255,255,0.35)" : "#9ca3af";
  const divC        = dark ? "rgba(255,255,255,0.12)" : "#d1fae5";

  return (
    <section style={{ ...sectionBg, position: "relative", overflow: "hidden" }} className="py-24 md:py-36">
      {dark && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(199,231,56,0.09) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
      )}

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 1.5rem", textAlign: "center", position: "relative" }}>
        {eyebrow && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ marginBottom: "1.5rem" }}
          >
            <span
              style={{
                display: "inline-block",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: eyebrowC,
                background: dark ? "rgba(199,231,56,0.1)" : `${BRAND}08`,
                border: `1px solid ${dark ? "rgba(199,231,56,0.2)" : `${BRAND}20`}`,
                borderRadius: "999px",
                padding: "0.35rem 1rem",
              }}
            >
              {eyebrow}
            </span>
          </motion.div>
        )}

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65 }}
          style={{
            fontFamily: DISPLAY,
            fontSize: "clamp(2.25rem,5.5vw,3.75rem)",
            lineHeight: 1.1,
            fontWeight: 600,
            color: headlineC,
            letterSpacing: "-0.02em",
            marginBottom: "1.25rem",
          }}
        >
          {headline || "Your practice. Elevated by Dandy."}
        </motion.h1>

        {subheadline && (
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.12 }}
            style={{
              fontSize: "1.125rem",
              lineHeight: 1.7,
              color: subC,
              marginBottom: "2.25rem",
              maxWidth: 600,
              margin: "0 auto 2.25rem",
            }}
          >
            {subheadline}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.18 }}
          style={{ display: "flex", gap: "0.875rem", justifyContent: "center", flexWrap: "wrap" }}
        >
          {primaryCtaText && (
            <a
              href={primaryCtaUrl || "#"}
              style={{
                display: "inline-block",
                background: LIME,
                color: BRAND,
                fontWeight: 700,
                fontSize: "0.9375rem",
                borderRadius: "0.6rem",
                padding: "0.875rem 2rem",
                textDecoration: "none",
                letterSpacing: "0.01em",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              {primaryCtaText}
            </a>
          )}

          {secondaryCtaText && (
            <a
              href={secondaryCtaUrl || "#"}
              style={{
                display: "inline-block",
                background: "transparent",
                color: dark ? "#fff" : BRAND,
                fontWeight: 600,
                fontSize: "0.9375rem",
                borderRadius: "0.6rem",
                padding: "0.875rem 1.75rem",
                textDecoration: "none",
                border: `1.5px solid ${dark ? "rgba(255,255,255,0.25)" : `${BRAND}30`}`,
                transition: "border-color 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = dark ? "rgba(255,255,255,0.5)" : BRAND)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = dark ? "rgba(255,255,255,0.25)" : `${BRAND}30`)}
            >
              {secondaryCtaText}
            </a>
          )}
        </motion.div>

        {trustLine && (
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.28 }}
            style={{
              marginTop: "1.75rem",
              fontSize: "0.8125rem",
              color: trustC,
              letterSpacing: "0.01em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ display: "inline-block", width: 32, height: 1, background: divC }} />
            {trustLine}
            <span style={{ display: "inline-block", width: 32, height: 1, background: divC }} />
          </motion.p>
        )}
      </div>
    </section>
  );
}
