import { motion } from "framer-motion";
import { MonitorPlay, Zap, CheckCircle2, Clock, BarChart3 } from "lucide-react";
import type { DsoSoftwareShowcaseBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses } from "@/lib/brand-config";

const SPRING = { type: "spring" as const, stiffness: 380, damping: 22 };
const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

const ICON_MAP: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  zap: Zap,
  check: CheckCircle2,
  clock: Clock,
  bar: BarChart3,
  monitor: MonitorPlay,
};

interface Props {
  props: DsoSoftwareShowcaseBlockProps;
  brand: BrandConfig;
}

export function BlockDsoSoftwareShowcase({ props, brand }: Props) {
  const {
    eyebrow,
    headline,
    body,
    imageUrl,
    videoUrl,
    features = [],
    ctaText,
    ctaUrl,
    ctaMode = "link",
    backgroundStyle = "dandy-green",
    layout = "centered",
  } = props;

  const VIDEO_EXTS = [".mp4", ".webm", ".ogg", ".mov"];
  const isNativeVideo = !!videoUrl && VIDEO_EXTS.some(ext => videoUrl.toLowerCase().split("?")[0].endsWith(ext));

  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME  : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const bodyC     = dark ? "rgba(255,255,255,0.65)" : "#4b5563";

  const defaultFeatures = [
    { icon: "zap",   label: "Real-time scan analysis" },
    { icon: "check", label: "AI-flagged margin errors" },
    { icon: "clock", label: "2–3 min saved per case" },
    { icon: "bar",   label: "Full-arch 3D crown prep" },
  ];
  const displayFeatures = features.length > 0 ? features : defaultFeatures;

  const renderCta = () => {
    if (!ctaText) return null;
    return (
      <div style={{ display: "flex", justifyContent: layout === "split" ? "flex-start" : "center", paddingTop: "0.25rem" }}>
        {ctaMode === "chilipiper" ? (
          <ChiliPiperButton
            url={ctaUrl || ""}
            className={getButtonClasses(brand, "inline-flex items-center")}
            style={{ backgroundColor: brand.accentColor, color: brand.primaryColor }}
          >
            {ctaText}
          </ChiliPiperButton>
        ) : (
          <motion.a
            href={ctaUrl || "#"}
            className={getButtonClasses(brand, "inline-flex items-center")}
            style={{ backgroundColor: brand.accentColor, color: brand.primaryColor, textDecoration: "none" }}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
          >
            {ctaText}
          </motion.a>
        )}
      </div>
    );
  };

  const renderImage = () => (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay: 0.1 }}
      style={{
        borderRadius: "0.875rem",
        overflow: "hidden",
        boxShadow: dark
          ? "0 40px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)"
          : "0 32px 64px rgba(0,58,48,0.18), 0 0 0 1px rgba(0,58,48,0.08)",
      }}
    >
      {/* Browser chrome */}
      <div
        style={{
          background: dark ? "#1a2e26" : "#f0f4f3",
          padding: "0.5rem 0.875rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          borderBottom: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,58,48,0.1)",
        }}
      >
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => (
            <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            maxWidth: 340,
            margin: "0 auto",
            background: dark ? "rgba(0,0,0,0.25)" : "rgba(0,58,48,0.07)",
            borderRadius: "0.3rem",
            padding: "0.2rem 0.6rem",
            fontSize: "0.6875rem",
            color: dark ? "rgba(255,255,255,0.3)" : "rgba(0,58,48,0.4)",
            fontFamily: "'Inter',system-ui,sans-serif",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          <MonitorPlay style={{ width: 10, height: 10 }} />
          app.meetdandy.com
        </div>
      </div>
      {/* Video, screenshot, or placeholder */}
      <div style={{ position: "relative", lineHeight: 0 }}>
        {videoUrl ? (
          isNativeVideo ? (
            <video
              src={videoUrl}
              style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover" }}
              autoPlay
              muted
              loop
              playsInline
              controls
              preload="metadata"
            />
          ) : (
            <div style={{ position: "relative", width: "100%", aspectRatio: "16/9" }}>
              <iframe
                src={videoUrl}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                title="Software Showcase"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt="Dandy Chairside Software"
            style={{ width: "100%", display: "block", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              aspectRatio: "16/9",
              background: dark ? "#0d1f18" : `${BRAND}10`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <MonitorPlay style={{ width: 48, height: 48, color: dark ? "rgba(255,255,255,0.15)" : `${BRAND}30` }} />
            <p style={{ fontSize: "0.8125rem", color: dark ? "rgba(255,255,255,0.2)" : `${BRAND}40`, fontFamily: "'Inter',system-ui,sans-serif" }}>
              Add a screenshot or video in properties
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );

  const renderFeatures = () => (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, delay: 0.25 }}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.625rem",
        justifyContent: layout === "split" ? "flex-start" : "center",
      }}
    >
      {displayFeatures.map((f, i) => {
        const IconComp = ICON_MAP[f.icon ?? "check"] ?? CheckCircle2;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              background: dark ? "rgba(255,255,255,0.07)" : `${BRAND}08`,
              border: dark ? "1px solid rgba(255,255,255,0.1)" : `1px solid ${BRAND}18`,
              borderRadius: "999px",
              padding: "0.35rem 0.875rem 0.35rem 0.5rem",
              fontSize: "0.8125rem",
              color: dark ? "rgba(255,255,255,0.8)" : BRAND,
              fontFamily: "'Inter',system-ui,sans-serif",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            <IconComp style={{ width: 13, height: 13, color: LIME, flexShrink: 0 }} />
            {f.label}
          </div>
        );
      })}
    </motion.div>
  );

  if (layout === "split") {
    return (
      <section style={{ ...sectionBg, position: "relative" }} className="py-20 md:py-28">
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "4rem", alignItems: "center" }}>
            {/* Text side */}
            <motion.div
              initial={{ opacity: 0, x: -28 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
            >
              {eyebrow && (
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: eyebrowC }}>
                  {eyebrow}
                </p>
              )}
              {headline && (
                <h2 style={{ fontFamily: DISPLAY, fontSize: "clamp(1.875rem,3.5vw,2.875rem)", lineHeight: 1.12, fontWeight: 600, color: headlineC, letterSpacing: "-0.02em", margin: 0 }}>
                  {headline}
                </h2>
              )}
              {body && (
                <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, color: bodyC, margin: 0 }}>
                  {body}
                </p>
              )}
              {renderFeatures()}
              {renderCta()}
            </motion.div>
            {/* Image side */}
            <div>{renderImage()}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ ...sectionBg, position: "relative" }} className="py-20 md:py-28">
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
        {/* Centered header */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 3rem" }}
        >
          {eyebrow && (
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: eyebrowC, marginBottom: "0.75rem" }}>
              {eyebrow}
            </p>
          )}
          {headline && (
            <h2 style={{ fontFamily: DISPLAY, fontSize: "clamp(2rem,4vw,3rem)", lineHeight: 1.1, fontWeight: 600, color: headlineC, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
              {headline}
            </h2>
          )}
          {body && (
            <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, color: bodyC, marginBottom: 0 }}>
              {body}
            </p>
          )}
        </motion.div>

        {/* Browser mockup */}
        {renderImage()}

        {/* Feature chips + CTA */}
        <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem", alignItems: "center" }}>
          {renderFeatures()}
          {renderCta()}
        </div>
      </div>
    </section>
  );
}
