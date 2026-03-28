import { motion } from "framer-motion";
import type { DsoPracticeHeroBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses, getSecondaryButtonClasses } from "@/lib/brand-config";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props {
  props: DsoPracticeHeroBlockProps;
  brand: BrandConfig;
}

const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

export function BlockDsoPracticeHero({ props, brand }: Props) {
  const {
    eyebrow,
    headline,
    subheadline,
    primaryCtaText,
    primaryCtaUrl,
    primaryCtaMode = "link",
    secondaryCtaText,
    secondaryCtaUrl,
    secondaryCtaMode = "link",
    trustLine,
    backgroundStyle = "dark",
    layout = "centered",
    imageUrl,
    imageAlt = "",
    imageShadow = true,
  } = props;

  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.6)" : "#4b5563";
  const trustC    = dark ? "rgba(255,255,255,0.35)" : "#9ca3af";
  const divC      = dark ? "rgba(255,255,255,0.12)" : "#d1fae5";

  const eyebrowEl = eyebrow ? (
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
  ) : null;

  const headlineEl = (
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
  );

  const subEl = (align: "center" | "left") => subheadline ? (
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
        maxWidth: align === "center" ? 600 : undefined,
        marginLeft: align === "center" ? "auto" : undefined,
        marginRight: align === "center" ? "auto" : undefined,
      }}
    >
      {subheadline}
    </motion.p>
  ) : null;

  const ctasEl = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.18 }}
      style={{ display: "flex", gap: "0.875rem", flexWrap: "wrap" }}
    >
      {primaryCtaText && (
        primaryCtaMode === "chilipiper" ? (
          <ChiliPiperButton
            url={primaryCtaUrl || ""}
            className={getButtonClasses(brand, "inline-flex items-center")}
            style={{ backgroundColor: brand.accentColor, color: brand.primaryColor }}
          >
            {primaryCtaText}
          </ChiliPiperButton>
        ) : (
          <motion.a
            href={primaryCtaUrl || "#"}
            className={getButtonClasses(brand, "inline-flex items-center")}
            style={{ backgroundColor: brand.accentColor, color: brand.primaryColor, textDecoration: "none" }}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
          >
            {primaryCtaText}
          </motion.a>
        )
      )}

      {secondaryCtaText && (
        secondaryCtaMode === "chilipiper" ? (
          <ChiliPiperButton
            url={secondaryCtaUrl || ""}
            className={getSecondaryButtonClasses(brand)}
            style={{ borderColor: dark ? "hsl(42,18%,96%)" : BRAND, color: dark ? "hsl(42,18%,96%)" : BRAND, background: "transparent" }}
          >
            {secondaryCtaText}
          </ChiliPiperButton>
        ) : (
          <motion.a
            href={secondaryCtaUrl || "#"}
            className={getSecondaryButtonClasses(brand)}
            style={{ borderColor: dark ? "hsl(42,18%,96%)" : BRAND, color: dark ? "hsl(42,18%,96%)" : BRAND, background: "transparent", textDecoration: "none" }}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
          >
            {secondaryCtaText}
          </motion.a>
        )
      )}
    </motion.div>
  );

  const trustEl = trustLine ? (
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
        gap: "0.5rem",
      }}
    >
      <span style={{ display: "inline-block", width: 32, height: 1, background: divC }} />
      {trustLine}
      <span style={{ display: "inline-block", width: 32, height: 1, background: divC }} />
    </motion.p>
  ) : null;

  if (layout === "bg-image" && imageUrl) {
    return (
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        className="py-24 md:py-36"
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: dark
              ? "rgba(0,0,0,0.62)"
              : "rgba(255,255,255,0.78)",
            pointerEvents: "none",
          }}
        />
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 1.5rem", textAlign: "center", position: "relative" }}>
          {eyebrowEl}
          {headlineEl}
          {subEl("center")}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {ctasEl}
            {trustEl && <div style={{ display: "flex", justifyContent: "center" }}>{trustEl}</div>}
          </div>
        </div>
      </section>
    );
  }

  if (layout === "split") {
    return (
      <section
        style={{ ...sectionBg, position: "relative", overflow: "hidden" }}
        className="py-20 md:py-28"
      >
        {dark && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(ellipse 80% 60% at 20% -10%, rgba(199,231,56,0.09) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
        )}
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 1.5rem",
            display: "grid",
            gridTemplateColumns: imageUrl ? "1fr 1fr" : "1fr",
            gap: "3.5rem",
            alignItems: "center",
            position: "relative",
          }}
          className="md:grid-cols-2 grid-cols-1"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {eyebrowEl}
            {headlineEl}
            {subEl("left")}
            {ctasEl}
            {trustEl}
          </div>

          {imageUrl && (
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 }}
              style={{
                borderRadius: "1.25rem",
                overflow: "hidden",
                boxShadow: imageShadow
                  ? (dark
                    ? "0 32px 64px rgba(0,0,0,0.45)"
                    : "0 24px 48px rgba(0,58,48,0.12)")
                  : "none",
                aspectRatio: "4/3",
              }}
            >
              <img
                src={imageUrl}
                alt={imageAlt}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </motion.div>
          )}
        </div>
      </section>
    );
  }

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
        {eyebrowEl}
        {headlineEl}
        {subEl("center")}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "0.875rem", justifyContent: "center", flexWrap: "wrap" }}>
            {ctasEl}
          </div>
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
      </div>
    </section>
  );
}
