import { useState, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Play, X, Microscope, Cpu, Users, MapPin } from "lucide-react";
import type { DsoLabTourBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

interface Props {
  props: DsoLabTourBlockProps;
  onCtaClick?: () => void;
}

const P   = "hsl(152,42%,12%)";
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
  } = props;
  const dark = isDarkBg(backgroundStyle);

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
  const bodyColor = dark ? "rgba(255,255,255,0.65)" : MU;
  const quoteBorderColor = dark ? `${AW}4d` : `${P}4d`;
  const quoteTextColor = dark ? "rgba(255,255,255,0.65)" : `${FG}b3`;
  const quoteAttrColor = dark ? "rgba(255,255,255,0.45)" : MU;
  const tileBg = dark ? "rgba(255,255,255,0.08)" : SEC;
  const tileIconColor = dark ? AW : P;
  const tileTextColor = dark ? "#fff" : FG;

  return (
    <>
      <section ref={sectionRef} style={getBgStyle(backgroundStyle)} className="py-24 md:py-32">
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}>
          <div className="grid md:grid-cols-2 gap-14 lg:gap-24 items-center">

            {/* ── Image / Video ── */}
            <motion.div
              style={{
                y: imageY,
                boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
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
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
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

                {/* Overlay tint */}
                <div
                  className="absolute inset-0 transition-colors duration-500"
                  style={{ background: "rgba(0,0,0,0.20)" }}
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
                        width: 64,
                        height: 64,
                        borderRadius: "50%",
                        background: `${P}e6`,
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 20px 48px rgba(0,0,0,0.30)",
                      }}
                    >
                      <Play style={{ width: 24, height: 24, color: "hsl(48,100%,96%)", marginLeft: 2 }} fill="hsl(48,100%,96%)" />
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
                    padding: "1.5rem",
                    background: "linear-gradient(to top,rgba(0,0,0,0.70),transparent)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.70)",
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
                  letterSpacing: 0,
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
                    marginTop: "1.5rem",
                    paddingLeft: "1rem",
                    borderLeft: `2px solid ${quoteBorderColor}`,
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.875rem",
                      color: quoteTextColor,
                      fontStyle: "italic",
                      lineHeight: 1.65,
                    }}
                  >
                    "{quote}"
                  </p>
                  {quoteAttribution && (
                    <p style={{ fontSize: "0.75rem", color: quoteAttrColor, marginTop: 8 }}>
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
                  gap: "1rem",
                }}
              >
                {LAB_HIGHLIGHTS.map((h) => (
                  <div
                    key={h.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "1rem",
                      borderRadius: "0.75rem",
                      background: tileBg,
                    }}
                  >
                    <h.icon style={{ width: 20, height: 20, color: tileIconColor, flexShrink: 0 }} />
                    <span style={{ fontSize: "0.875rem", fontWeight: 500, color: tileTextColor }}>{h.label}</span>
                  </div>
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
                    transition: "opacity 0.2s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
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
              background: "rgba(15,48,36,0.85)",
              backdropFilter: "blur(12px)",
              padding: "1rem",
            }}
            onClick={() => setVideoOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 896,
                aspectRatio: "16/9",
                borderRadius: "1rem",
                overflow: "hidden",
                boxShadow: "0 50px 100px rgba(0,0,0,0.4)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setVideoOpen(false)}
                style={{
                  position: "absolute",
                  top: -40,
                  right: 0,
                  zIndex: 10,
                  color: "#fff",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
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
