import { useState, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Play, X, Microscope, Cpu, Users, MapPin } from "lucide-react";
import type { DsoLabTourBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg, getImageBgSectionStyle } from "@/lib/bg-styles";

interface Props {
  props: DsoLabTourBlockProps;
  onCtaClick?: () => void;
}

const P   = "#003A30";
const AW  = "hsl(68,60%,52%)";
const SEC = "hsl(42,18%,96%)";
const FG  = "hsl(152,40%,13%)";
const MU  = "hsl(152,8%,48%)";
const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const LAB_HIGHLIGHTS = [
  { icon: Microscope, label: "Advanced Materials Lab"  },
  { icon: Cpu,        label: "AI Quality Control"      },
  { icon: Users,      label: "U.S.-Based Technicians"  },
  { icon: MapPin,     label: "Multiple Locations"      },
];

export function BlockDsoLabTour({ props, onCtaClick }: Props) {
  const {
    eyebrow, headline, body,
    quote, quoteAttribution,
    imageUrl, videoUrl,
    ctaText, ctaUrl,
    backgroundStyle = "white",
    backgroundImage,
    backgroundOverlay,
    overlayColor = "#000000",
  } = props;
  const dark = isDarkBg(backgroundStyle) || !!backgroundImage;
  const sectionBgStyle = backgroundImage ? getImageBgSectionStyle(backgroundImage) : getBgStyle(backgroundStyle);

  const [videoOpen, setVideoOpen] = useState(false);

  const sectionRef  = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["40px", "-40px"]);
  const textY  = useTransform(scrollYProgress, [0, 1], ["20px", "-20px"]);

  const handleCtaClick = () => {
    if (onCtaClick) { onCtaClick(); return; }
    if (ctaUrl && ctaUrl !== "#") window.open(ctaUrl, "_blank");
  };

  const eyebrowColor = dark ? AW : P;
  const headlineColor = dark ? "#fff" : FG;
  const bodyColor = dark ? "rgba(255,255,255,0.60)" : MU;
  const quoteTextColor = dark ? "rgba(255,255,255,0.70)" : `${FG}b3`;
  const quoteAttrColor = dark ? AW : P;

  const tileBg = dark ? "rgba(255,255,255,0.05)" : "#fff";
  const tileBorder = dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)";
  const tileShadow = dark ? "none" : "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)";
  const tileIconBg = dark ? `${AW}18` : `${P}10`;
  const tileIconColor = dark ? AW : P;
  const tileTextColor = dark ? "rgba(255,255,255,0.85)" : FG;

  return (
    <>
      <section ref={sectionRef} style={sectionBgStyle} className="py-24 md:py-32">
        {backgroundImage && <div style={{ position: "absolute", inset: 0, backgroundColor: overlayColor, opacity: backgroundOverlay ?? 0.55, zIndex: 0, pointerEvents: "none" }} />}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}>
          <div className="grid md:grid-cols-2 gap-14 lg:gap-24 items-center">

            {/* ── Image / Video ── */}
            <motion.div
              style={{
                y: imageY,
                boxShadow: "0 4px 12px rgba(0,0,0,0.10), 0 24px 60px rgba(0,0,0,0.20), 0 60px 120px rgba(0,0,0,0.15)",
                borderRadius: "1.5rem",
                overflow: "hidden",
                position: "relative",
              }}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="group cursor-pointer"
              onClick={() => videoUrl ? setVideoOpen(true) : undefined}
            >
              <div style={{ position: "relative", aspectRatio: "4/3" }}>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Dandy lab manufacturing floor"
                    style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.8s cubic-bezier(0.16,1,0.3,1)" }}
                    className="group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: SEC,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Microscope style={{ width: 64, height: 64, color: `${P}33` }} />
                  </div>
                )}

                {/* Overlay */}
                <div
                  className="absolute inset-0 transition-opacity duration-500 group-hover:opacity-80"
                  style={{ background: "rgba(0,0,0,0.18)" }}
                />

                {/* Play button */}
                {videoUrl && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      className="group-hover:scale-110 transition-transform duration-500"
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: "50%",
                        background: `${P}ee`,
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: `0 8px 32px ${P}55, 0 24px 64px rgba(0,0,0,0.30)`,
                      }}
                    >
                      <Play style={{ width: 26, height: 26, color: "hsl(48,100%,96%)", marginLeft: 3 }} fill="hsl(48,100%,96%)" />
                    </div>
                  </div>
                )}

                {/* Caption bar */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: "2rem 1.5rem 1.5rem",
                    background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.40) 60%, transparent 100%)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.60)",
                      textTransform: "uppercase",
                      letterSpacing: "0.2em",
                    }}
                  >
                    Lab Tour
                  </p>
                  <p style={{ marginTop: 4, fontSize: "1rem", fontWeight: 500, color: "#fff" }}>
                    Inside Dandy's U.S. Manufacturing Facility
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ── Text side ── */}
            <motion.div style={{ y: textY }}>
              {eyebrow && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: eyebrowColor,
                    marginBottom: "1.25rem",
                  }}
                >
                  {eyebrow}
                </motion.p>
              )}

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontSize: "clamp(2rem,4vw,3.25rem)",
                  lineHeight: 1.1,
                  fontWeight: 600,
                  letterSpacing: "-0.015em",
                  color: headlineColor,
                }}
              >
                {headline}
              </motion.h2>

              {body && (
                <motion.p
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  style={{
                    marginTop: "1.5rem",
                    fontSize: "1.0625rem",
                    color: bodyColor,
                    lineHeight: 1.7,
                  }}
                >
                  {body}
                </motion.p>
              )}

              {quote && (
                <motion.blockquote
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.12 }}
                  style={{
                    marginTop: "2rem",
                    position: "relative",
                    paddingLeft: "1.25rem",
                    borderLeft: `3px solid ${dark ? AW : P}`,
                  }}
                >
                  {/* Large decorative quote mark */}
                  <span
                    style={{
                      position: "absolute",
                      top: -16,
                      left: 12,
                      fontFamily: "Georgia, serif",
                      fontSize: "4.5rem",
                      lineHeight: 1,
                      color: dark ? "rgba(154,184,54,0.18)" : "rgba(22,51,34,0.10)",
                      userSelect: "none",
                      pointerEvents: "none",
                    }}
                  >
                    {"\u201C"}
                  </span>
                  <p
                    style={{
                      fontSize: "0.9375rem",
                      color: quoteTextColor,
                      fontStyle: "italic",
                      lineHeight: 1.7,
                      position: "relative",
                    }}
                  >
                    {quote}
                  </p>
                  {quoteAttribution && (
                    <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: quoteAttrColor, marginTop: 10 }}>
                      — {quoteAttribution}
                    </p>
                  )}
                </motion.blockquote>
              )}

              {/* Lab highlight tiles */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 }}
                style={{
                  marginTop: "2.5rem",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.875rem",
                }}
              >
                {LAB_HIGHLIGHTS.map((h, i) => (
                  <motion.div
                    key={h.label}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.25 }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.875rem",
                      padding: "1rem 1.125rem",
                      borderRadius: "0.875rem",
                      background: tileBg,
                      backdropFilter: dark ? "blur(12px)" : "none",
                      border: tileBorder,
                      boxShadow: tileShadow,
                      transition: "box-shadow 0.25s ease",
                      cursor: "default",
                    }}
                    onMouseEnter={e => {
                      if (!dark) (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = tileShadow;
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: tileIconBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <h.icon style={{ width: 16, height: 16, color: tileIconColor }} />
                    </div>
                    <span style={{ fontSize: "0.875rem", fontWeight: 500, color: tileTextColor }}>{h.label}</span>
                  </motion.div>
                ))}
              </motion.div>

              {/* CTA */}
              {ctaText && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  onClick={handleCtaClick}
                  style={{
                    marginTop: "2.5rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    borderRadius: 9999,
                    background: dark ? AW : P,
                    padding: "1rem 2rem",
                    fontSize: 14,
                    fontWeight: 600,
                    color: dark ? "hsl(152,40%,13%)" : "hsl(48,100%,96%)",
                    border: "none",
                    cursor: "pointer",
                    transition: "transform 0.25s ease, box-shadow 0.25s ease",
                    boxShadow: dark ? `0 4px 16px ${AW}45` : `0 4px 16px ${P}40`,
                  }}
                  whileHover={{ y: -2 }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = dark
                      ? `0 8px 28px ${AW}60`
                      : `0 8px 28px ${P}55`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = dark
                      ? `0 4px 16px ${AW}45`
                      : `0 4px 16px ${P}40`;
                  }}
                >
                  <MapPin style={{ width: 16, height: 16 }} />
                  {ctaText}
                </motion.button>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Video lightbox ── */}
      <AnimatePresence>
        {videoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(8,20,16,0.90)",
              backdropFilter: "blur(16px)",
              padding: "1rem",
            }}
            onClick={() => setVideoOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 896,
                aspectRatio: "16/9",
                borderRadius: "1.25rem",
                overflow: "hidden",
                boxShadow: "0 60px 120px rgba(0,0,0,0.5)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setVideoOpen(false)}
                style={{
                  position: "absolute",
                  top: -44,
                  right: 0,
                  zIndex: 10,
                  color: "rgba(255,255,255,0.70)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "color 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.70)")}
                aria-label="Close video"
              >
                <X style={{ width: 24, height: 24 }} />
              </button>
              {videoUrl && (
                <iframe
                  src={`${videoUrl}${videoUrl.includes("?") ? "&" : "?"}autoplay=1&rel=0`}
                  title="Lab tour video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ width: "100%", height: "100%" }}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
