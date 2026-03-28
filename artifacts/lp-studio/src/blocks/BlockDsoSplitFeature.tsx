import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import type { DsoSplitFeatureBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

interface Props {
  props: DsoSplitFeatureBlockProps;
}

const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

export function BlockDsoSplitFeature({ props }: Props) {
  const {
    eyebrow,
    headline,
    body,
    bullets = [],
    ctaText,
    ctaUrl,
    imageUrl,
    imagePosition = "right",
    backgroundStyle = "white",
  } = props;

  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const bodyC     = dark ? "rgba(255,255,255,0.6)" : "#4b5563";
  const bulletC   = dark ? "rgba(255,255,255,0.75)" : "#374151";
  const checkC    = dark ? LIME : BRAND;
  const imgBg     = dark ? "rgba(255,255,255,0.05)" : `${BRAND}08`;
  const imgBor    = dark ? "rgba(255,255,255,0.08)" : `${BRAND}15`;

  const textCol = (
    <motion.div
      initial={{ opacity: 0, x: imagePosition === "left" ? 30 : -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.25rem" }}
    >
      {eyebrow && (
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: eyebrowC }}>
          {eyebrow}
        </p>
      )}

      {headline && (
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: "clamp(1.875rem,3.5vw,2.75rem)",
            lineHeight: 1.15,
            fontWeight: 600,
            color: headlineC,
            letterSpacing: "-0.015em",
          }}
        >
          {headline}
        </h2>
      )}

      {body && (
        <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, color: bodyC }}>
          {body}
        </p>
      )}

      {bullets.length > 0 && (
        <ul style={{ display: "flex", flexDirection: "column", gap: "0.625rem", listStyle: "none", padding: 0, margin: 0 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
              <CheckCircle2 style={{ width: 18, height: 18, color: checkC, flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: "0.9375rem", color: bulletC, lineHeight: 1.55 }}>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {ctaText && (
        <div style={{ paddingTop: "0.5rem" }}>
          <a
            href={ctaUrl || "#"}
            style={{
              display: "inline-block",
              background: LIME,
              color: BRAND,
              fontWeight: 700,
              fontSize: "0.9375rem",
              borderRadius: "0.6rem",
              padding: "0.75rem 1.75rem",
              textDecoration: "none",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            {ctaText}
          </a>
        </div>
      )}
    </motion.div>
  );

  const imageCol = (
    <motion.div
      initial={{ opacity: 0, x: imagePosition === "left" ? -30 : 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.65 }}
      style={{
        borderRadius: "1.25rem",
        overflow: "hidden",
        background: imgBg,
        border: `1px solid ${imgBor}`,
        aspectRatio: "4/3",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            minHeight: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="64" height="64" rx="16" fill={dark ? "rgba(255,255,255,0.06)" : `${BRAND}10`} />
            <path d="M20 44 C20 32 32 20 44 20" stroke={dark ? LIME : BRAND} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
            <circle cx="32" cy="32" r="8" fill={dark ? LIME : BRAND} opacity="0.2" />
          </svg>
          <p style={{ fontSize: "0.8125rem", color: dark ? "rgba(255,255,255,0.25)" : `${BRAND}40` }}>Add image URL in properties</p>
        </div>
      )}
    </motion.div>
  );

  return (
    <section style={sectionBg} className="py-20 md:py-28">
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "3.5rem",
            alignItems: "center",
          }}
        >
          {imagePosition === "left" ? (
            <>
              {imageCol}
              {textCol}
            </>
          ) : (
            <>
              {textCol}
              {imageCol}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
