// NOTE: This block is intentionally NOT exposed in the block catalog seed
// (`scripts/seed-block-catalog.cjs`). It was authored as a Dandy lab/manufacturing
// showcase and the registry default props still reference Dandy-specific copy
// (e.g. "vertical integration", U.S. lab images). Hardcoded fallbacks inside
// the component itself have been made neutral / prop-driven so that, if the
// block is ever surfaced to non-Dandy tenants, no Dandy branding leaks through
// when default_props are overridden.
import { useState, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Play, X, Microscope, Cpu, Users, MapPin } from "lucide-react";
import type { DsoLabTourBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg, getImageBgSectionStyle } from "@/lib/bg-styles";
import { safeNavigate } from "@/lib/safe-url";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: DsoLabTourBlockProps;
  onCtaClick?: () => void;
  onFieldChange?: (updated: DsoLabTourBlockProps) => void;
}

const P   = "var(--brand-primary, #003A30)";
const AW  = "var(--brand-accent, hsl(68,60%,52%))";
const SEC = "hsl(42,18%,96%)";
const FG  = "hsl(152,40%,13%)";
const MU  = "hsl(152,8%,48%)";
const DISPLAY_FONT = "var(--brand-font-display, var(--app-font-display, 'Bagoss Standard')), 'Inter', system-ui, sans-serif";

const LAB_HIGHLIGHTS = [
  { icon: Microscope, label: "Advanced Materials Lab"  },
  { icon: Cpu,        label: "AI Quality Control"      },
  { icon: Users,      label: "U.S.-Based Technicians"  },
  { icon: MapPin,     label: "Multiple Locations"      },
];

export function BlockDsoLabTour({ props, onCtaClick, onFieldChange }: Props) {
  const {
    eyebrow, headline, body,
    quote, quoteAttribution,
    imageUrl, imageAlt, imageEyebrow, imageCaption,
    videoUrl,
    ctaText, ctaUrl,
    backgroundStyle = "white",
    backgroundImage,
    backgroundOverlay,
    overlayColor = "#000000",
  } = props;
  const field = (key: keyof DsoLabTourBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as DsoLabTourBlockProps[typeof key] }) : undefined;
  const dark = isDarkBg(backgroundStyle) || !!backgroundImage;
  const sectionBgStyle = backgroundImage ? getImageBgSectionStyle(backgroundImage) : getBgStyle(backgroundStyle);

  const [videoOpen, setVideoOpen] = useState(false);

  const sectionRef  = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["40px", "-40px"]);
  const textY  = useTransform(scrollYProgress, [0, 1], ["20px", "-20px"]);

  const handleCtaClick = () => {
    if (onCtaClick) { onCtaClick(); return; }
    if (ctaUrl && ctaUrl !== "#") safeNavigate(ctaUrl, "_blank");
  };

  const eyebrowColor = dark ? AW : P;
  const headlineColor = dark ? "#fff" : FG;
  const bodyColor = dark ? "rgba(255,255,255,0.60)" : MU;
  const quoteTextColor = dark ? "rgba(255,255,255,0.70)" : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.702)`;
  const quoteAttrColor = dark ? AW : P;

  const tileBg = dark ? "rgba(255,255,255,0.05)" : "#fff";
  const tileBorder = dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)";
  const tileShadow = dark ? "none" : "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)";
  const tileIconBg = dark ? `rgb(var(--brand-accent-rgb, 199 231 56) / 0.094)` : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.063)`;
  const tileIconColor = dark ? AW : P;
  const tileTextColor = dark ? "rgba(255,255,255,0.85)" : FG;

  return (
    <>
      <section ref={sectionRef} style={sectionBgStyle} className="py-16 sm:py-20 md:py-24 lg:py-32">
        {backgroundImage && <div style={{ position: "absolute", inset: 0, backgroundColor: overlayColor, opacity: backgroundOverlay ?? 0.55, zIndex: 0, pointerEvents: "none" }} />}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "0 clamp(1rem, 3vw, 1.5rem)" }}>
          <div className="grid md:grid-cols-2 gap-10 md:gap-14 lg:gap-24 items-center">

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
                    alt={imageAlt ?? ""}
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
                    <Microscope style={{ width: 64, height: 64, color: `rgb(var(--brand-primary-rgb, 0 58 48) / 0.2)` }} />
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
                        width: "clamp(56px, 14vw, 72px)",
                        height: "clamp(56px, 14vw, 72px)",
                        borderRadius: "50%",
                        background: `rgb(var(--brand-primary-rgb, 0 58 48) / 0.933)`,
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: `0 8px 32px rgb(var(--brand-primary-rgb, 0 58 48) / 0.333), 0 24px 64px rgba(0,0,0,0.30)`,
                      }}
                    >
                      <Play style={{ width: "clamp(20px, 5vw, 26px)", height: "clamp(20px, 5vw, 26px)", color: "hsl(48,100%,96%)", marginLeft: 3 }} fill="hsl(48,100%,96%)" />
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
                    padding: "clamp(1.25rem, 4vw, 2rem) clamp(1rem, 3vw, 1.5rem) clamp(1rem, 3vw, 1.5rem)",
                    background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.40) 60%, transparent 100%)",
                  }}
                >
                  {(imageEyebrow || imageCaption) && (
                    <>
                      {imageEyebrow && (
                        <p
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.60)",
                            textTransform: "uppercase",
                            letterSpacing: "0.2em",
                          }}
                        >
                          <InlineText as="span" value={imageEyebrow} onUpdate={field("imageEyebrow")} />
                        </p>
                      )}
                      {imageCaption && (
                        <p style={{ marginTop: 4, fontSize: "1rem", fontWeight: 500, color: "#fff" }}>
                          <InlineText as="span" value={imageCaption} onUpdate={field("imageCaption")} multiline />
                        </p>
                      )}
                    </>
                  )}
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
                  <InlineText as="span" value={eyebrow} onUpdate={field("eyebrow")} />
                </motion.p>
              )}

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontSize: "clamp(1.75rem,5vw,3.25rem)",
                  lineHeight: 1.1,
                  fontWeight: 600,
                  letterSpacing: "-0.015em",
                  color: headlineColor,
                }}
              >
                <InlineText as="span" value={headline || ""} onUpdate={field("headline")} multiline />
              </motion.h2>

              {body && (
                <motion.p
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  style={{
                    marginTop: "clamp(1rem, 3vw, 1.5rem)",
                    fontSize: "clamp(1rem, 2.6vw, 1.0625rem)",
                    color: bodyColor,
                    lineHeight: 1.7,
                  }}
                >
                  <InlineText as="span" value={body} onUpdate={field("body")} multiline />
                </motion.p>
              )}

              {quote && (
                <motion.blockquote
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.12 }}
                  style={{
                    marginTop: "clamp(1.5rem, 4vw, 2rem)",
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
                    <InlineText as="span" value={quote} onUpdate={field("quote")} multiline />
                  </p>
                  {quoteAttribution && (
                    <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: quoteAttrColor, marginTop: 10 }}>
                      — <InlineText as="span" value={quoteAttribution} onUpdate={field("quoteAttribution")} />
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
                  marginTop: "clamp(1.5rem, 5vw, 2.5rem)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "clamp(0.5rem, 2vw, 0.875rem)",
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
                      gap: "clamp(0.625rem, 2vw, 0.875rem)",
                      padding: "clamp(0.75rem, 2.5vw, 1rem) clamp(0.75rem, 3vw, 1.125rem)",
                      borderRadius: "0.875rem",
                      background: tileBg,
                      backdropFilter: dark ? "blur(12px)" : "none",
                      border: tileBorder,
                      boxShadow: tileShadow,
                      transition: "box-shadow 0.25s ease",
                      cursor: "default",
                      minWidth: 0,
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
                        width: "clamp(28px, 8vw, 34px)",
                        height: "clamp(28px, 8vw, 34px)",
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
                    <span style={{ fontSize: "clamp(0.8125rem, 2.4vw, 0.875rem)", fontWeight: 500, color: tileTextColor, lineHeight: 1.3 }}>{h.label}</span>
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
                    marginTop: "clamp(1.75rem, 5vw, 2.5rem)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    borderRadius: 9999,
                    background: dark ? AW : P,
                    padding: "0.875rem 1.75rem",
                    fontSize: 14,
                    fontWeight: 600,
                    color: dark ? "hsl(152,40%,13%)" : "hsl(48,100%,96%)",
                    border: "none",
                    cursor: "pointer",
                    transition: "transform 0.25s ease, box-shadow 0.25s ease",
                    boxShadow: dark ? `0 4px 16px rgb(var(--brand-accent-rgb, 199 231 56) / 0.271)` : `0 4px 16px rgb(var(--brand-primary-rgb, 0 58 48) / 0.251)`,
                  }}
                  whileHover={{ y: -2 }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = dark
                      ? `0 8px 28px rgb(var(--brand-accent-rgb, 199 231 56) / 0.376)`
                      : `0 8px 28px rgb(var(--brand-primary-rgb, 0 58 48) / 0.333)`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = dark
                      ? `0 4px 16px rgb(var(--brand-accent-rgb, 199 231 56) / 0.271)`
                      : `0 4px 16px rgb(var(--brand-primary-rgb, 0 58 48) / 0.251)`;
                  }}
                >
                  <MapPin style={{ width: 16, height: 16 }} />
                  <InlineText as="span" value={ctaText} onUpdate={field("ctaText")} />
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
