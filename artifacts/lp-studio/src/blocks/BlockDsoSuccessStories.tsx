import { motion } from "framer-motion";
import type { DsoSuccessStoriesBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg, getImageBgSectionStyle } from "@/lib/bg-styles";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";

interface Props {
  props: DsoSuccessStoriesBlockProps;
  onCtaClick?: () => void;
}

const P   = "hsl(152,42%,12%)";
const PFG = "hsl(48,100%,96%)";
const AW  = "hsl(68,60%,52%)";
const FG  = "hsl(152,40%,13%)";
const MU  = "hsl(152,8%,48%)";
const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const DEFAULT_CASES = [
  {
    name: "APEX Dental Partners",
    stat: "12.5%",
    label: "annualized revenue potential increase",
    quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.",
    author: "Dr. Layla Lohmann, Founder",
    image: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?q=80&w=800&h=480&fit=crop",
  },
  {
    name: "Smile Brands",
    stat: "2–3 min",
    label: "saved per crown appointment",
    quote: "The efficiency gains were immediate. Our doctors noticed the difference from the very first case.",
    author: "VP of Clinical Operations",
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=800&h=480&fit=crop",
  },
  {
    name: "Tend",
    stat: "40%",
    label: "faster lab turnaround",
    quote: "Speed matters when you're growing fast. Dandy keeps pace with our expansion without sacrificing quality.",
    author: "Head of Operations",
    image: "https://images.unsplash.com/photo-1588776814546-daab30f310ce?q=80&w=800&h=480&fit=crop",
  },
];

export function BlockDsoSuccessStories({ props }: Props) {
  const { eyebrow, headline, cases, backgroundStyle = "muted", backgroundImage, backgroundOverlay, overlayColor = "#000000", ctaText, ctaUrl, ctaMode = "link" } = props;
  const dark = isDarkBg(backgroundStyle) || !!backgroundImage;
  const sectionBgStyle = backgroundImage ? getImageBgSectionStyle(backgroundImage) : getBgStyle(backgroundStyle);
  const displayCases = (cases && cases.length > 0) ? cases.slice(0, 3) : DEFAULT_CASES;

  const eyebrowColor  = dark ? AW : P;
  const headlineColor = dark ? PFG : FG;

  const statColor    = dark ? "#fff" : FG;
  const labelColor   = dark ? "rgba(255,255,255,0.55)" : MU;
  const quoteColor   = dark ? "rgba(255,255,255,0.70)" : `${FG}cc`;
  const authorColor  = dark ? AW : P;
  const dividerColor = dark ? `rgba(255,255,255,0.12)` : `rgba(0,58,48,0.10)`;

  const cardBg     = dark ? "rgba(255,255,255,0.04)" : "#fff";
  const cardBorder = dark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(0,0,0,0.06)";
  const cardShadow = dark ? "none" : "0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.07), 0 32px 64px rgba(0,0,0,0.08)";

  return (
    <section style={sectionBgStyle} className="py-24 md:py-32">
      {backgroundImage && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: overlayColor, opacity: backgroundOverlay ?? 0.55, zIndex: 0, pointerEvents: "none" }} />
      )}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
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
              color: headlineColor,
              letterSpacing: "-0.015em",
            }}
          >
            {headline || "DSOs that switched and never looked back."}
          </motion.h2>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {displayCases.map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.7 }}
              whileHover={{ y: -6 }}
              style={{
                borderRadius: "1.25rem",
                background: cardBg,
                backdropFilter: dark ? "blur(16px)" : "none",
                border: cardBorder,
                boxShadow: cardShadow,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                transition: "box-shadow 0.3s ease",
                cursor: "default",
              }}
              onMouseEnter={e => {
                if (!dark) (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 4px 8px rgba(0,0,0,0.05), 0 16px 40px rgba(0,0,0,0.10), 0 48px 96px rgba(0,0,0,0.11)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = cardShadow;
              }}
            >
              {/* ── Image panel ── */}
              {s.image ? (
                <div
                  style={{
                    position: "relative",
                    height: 180,
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={s.image}
                    alt={s.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transition: "transform 0.7s cubic-bezier(0.16,1,0.3,1)",
                    }}
                    className="group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* Gradient overlay */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%)",
                    }}
                  />
                  {/* Company name on image */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: "1rem 1.375rem 1rem",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.18em",
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      {s.name}
                    </p>
                  </div>
                  {/* Lime accent line at bottom of image */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: `linear-gradient(90deg, ${AW}00, ${AW}, ${AW}00)`,
                    }}
                  />
                </div>
              ) : (
                /* No-image fallback: colored top bar + company name */
                <div>
                  <div
                    style={{
                      height: 3,
                      background: dark
                        ? `linear-gradient(90deg, ${AW}00, ${AW}80, ${AW}00)`
                        : `linear-gradient(90deg, ${P}00, ${P}50, ${P}00)`,
                    }}
                  />
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.18em",
                      color: dark ? "rgba(255,255,255,0.40)" : MU,
                      padding: "1.5rem 2rem 0",
                    }}
                  >
                    {s.name}
                  </p>
                </div>
              )}

              {/* ── Content ── */}
              <div
                style={{
                  padding: s.image ? "1.625rem 1.75rem 2rem" : "1.25rem 2rem 2rem",
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                }}
              >
                {/* Stat */}
                <p
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: "clamp(2.25rem,4vw,3rem)",
                    fontWeight: 700,
                    color: statColor,
                    letterSpacing: "-0.04em",
                    lineHeight: 1,
                  }}
                >
                  {s.stat}
                </p>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: labelColor,
                    marginTop: "0.5rem",
                    marginBottom: "1.5rem",
                    lineHeight: 1.4,
                  }}
                >
                  {s.label}
                </p>

                {/* Divider */}
                <div style={{ height: 1, background: dividerColor, marginBottom: "1.375rem" }} />

                {/* Quote */}
                <div style={{ position: "relative", flex: 1 }}>
                  <span
                    style={{
                      position: "absolute",
                      top: -20,
                      left: -4,
                      fontFamily: "Georgia, serif",
                      fontSize: "4rem",
                      lineHeight: 1,
                      color: dark ? "rgba(154,184,54,0.20)" : "rgba(22,51,34,0.08)",
                      userSelect: "none",
                      pointerEvents: "none",
                    }}
                  >
                    {"\u201C"}
                  </span>
                  <p
                    style={{
                      fontSize: "0.9rem",
                      color: quoteColor,
                      lineHeight: 1.65,
                      fontStyle: "italic",
                      position: "relative",
                    }}
                  >
                    {s.quote}
                  </p>
                </div>

                {/* Author */}
                <p
                  style={{
                    marginTop: "1.25rem",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: authorColor,
                  }}
                >
                  — {s.author}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {ctaText && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            style={{ textAlign: "center", marginTop: "3rem" }}
          >
            {ctaMode === "chilipiper" ? (
              <ChiliPiperButton
                url={ctaUrl ?? ""}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 2rem",
                  borderRadius: "0.5rem",
                  background: AW,
                  color: "hsl(152,42%,12%)",
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                {ctaText}
              </ChiliPiperButton>
            ) : (
              <a
                href={ctaUrl || "#"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 2rem",
                  borderRadius: "0.5rem",
                  background: AW,
                  color: "hsl(152,42%,12%)",
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  textDecoration: "none",
                }}
              >
                {ctaText}
              </a>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}
