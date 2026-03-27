import { motion } from "framer-motion";
import type { DsoSuccessStoriesBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

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
  },
  {
    name: "Open & Affordable Dental",
    stat: "96%",
    label: "reduction in remakes",
    quote: "Reduced crown appointments by 2–3 minutes per case. That adds up to hours of saved chair time per month.",
    author: "Clinical Director",
  },
  {
    name: "Dental Care Alliance",
    stat: "99%",
    label: "practices still using Dandy after one year",
    quote: "The training you guys give is incredible. The onboarding has been incredible. The whole experience has been incredible.",
    author: "Dr. Trey Mueller, Chief Clinical Officer",
  },
];

export function BlockDsoSuccessStories({ props, onCtaClick }: Props) {
  const { eyebrow, headline, cases, backgroundStyle = "dandy-green" } = props;
  const dark = isDarkBg(backgroundStyle);
  const displayCases = (cases && cases.length > 0) ? cases.slice(0, 3) : DEFAULT_CASES;

  const eyebrowColor  = dark ? AW : P;
  const headlineColor = dark ? PFG : FG;

  const cardBg       = dark ? "rgba(255,255,255,0.05)" : "#fff";
  const cardBorder   = dark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(0,0,0,0.06)";
  const cardShadow   = dark ? "none" : "0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06), 0 32px 64px rgba(0,0,0,0.07)";
  const hoverBg      = dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.01)";

  const companyColor = dark ? "rgba(255,255,255,0.40)" : MU;
  const statColor    = dark ? "#fff" : FG;
  const labelColor   = dark ? "rgba(255,255,255,0.55)" : MU;
  const quoteColor   = dark ? "rgba(255,255,255,0.65)" : `${FG}b3`;
  const authorColor  = dark ? AW : P;
  const dividerColor = dark ? `${AW}55` : `${P}28`;

  return (
    <section style={getBgStyle(backgroundStyle)} className="py-24 md:py-32">
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}>
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
            {headline || "DSOs that switched\nand never looked back."}
          </motion.h2>
        </div>

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
                transition: "background 0.3s, box-shadow 0.35s ease",
                cursor: "default",
                position: "relative",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = hoverBg;
                if (!dark) (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 4px 8px rgba(0,0,0,0.05), 0 16px 40px rgba(0,0,0,0.09), 0 48px 96px rgba(0,0,0,0.10)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = cardBg;
                (e.currentTarget as HTMLElement).style.boxShadow = cardShadow;
              }}
            >
              {/* Decorative top accent line */}
              <div
                style={{
                  height: 2,
                  background: dark
                    ? `linear-gradient(90deg, ${AW}00, ${AW}80, ${AW}00)`
                    : `linear-gradient(90deg, ${P}00, ${P}50, ${P}00)`,
                }}
              />

              <div
                style={{
                  padding: "2.25rem 2.25rem 2.5rem",
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  position: "relative",
                }}
              >
                {/* Company name */}
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: companyColor,
                    marginBottom: "1.5rem",
                  }}
                >
                  {s.name}
                </p>

                {/* Stat */}
                <p
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: "clamp(2.75rem,5vw,3.5rem)",
                    fontWeight: 600,
                    color: statColor,
                    letterSpacing: "-0.04em",
                    lineHeight: 1,
                  }}
                >
                  {s.stat}
                </p>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: labelColor,
                    marginTop: "0.625rem",
                    marginBottom: "2rem",
                    lineHeight: 1.5,
                  }}
                >
                  {s.label}
                </p>

                {/* Divider */}
                <div
                  style={{
                    height: 1,
                    background: dividerColor,
                    marginBottom: "1.75rem",
                  }}
                />

                {/* Quote with decorative mark */}
                <div style={{ position: "relative", flex: 1 }}>
                  <span
                    style={{
                      position: "absolute",
                      top: -28,
                      left: -6,
                      fontFamily: "Georgia, serif",
                      fontSize: "5rem",
                      lineHeight: 1,
                      color: dark ? `${AW}18` : `${P}12`,
                      userSelect: "none",
                      pointerEvents: "none",
                    }}
                  >
                    "
                  </span>
                  <blockquote
                    style={{
                      fontSize: "0.9375rem",
                      color: quoteColor,
                      lineHeight: 1.65,
                      fontStyle: "italic",
                      position: "relative",
                    }}
                  >
                    {s.quote}
                  </blockquote>
                </div>

                {/* Author */}
                <p
                  style={{
                    marginTop: "1.75rem",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: authorColor,
                    letterSpacing: "0.005em",
                  }}
                >
                  — {s.author}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
