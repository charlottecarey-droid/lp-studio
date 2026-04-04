import { motion } from "framer-motion";
import { Check, Minus, ArrowRight } from "lucide-react";
import type { DsoComparisonBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg, getImageBgSectionStyle } from "@/lib/bg-styles";
import { safeNavigate } from "@/lib/safe-url";

interface Props {
  props: DsoComparisonBlockProps;
  onCtaClick?: () => void;
  animationsEnabled?: boolean;
}

const P     = "hsl(152,42%,12%)";
const PFG   = "hsl(48,100%,96%)";
const FG    = "hsl(152,40%,13%)";
const MU    = "hsl(152,8%,48%)";
const AW    = "hsl(68,60%,52%)";
const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const DEFAULT_ROWS = [
  { need: "Patient Volume Growth", dandy: "30% higher case acceptance, expanded services like Aligners", traditional: "No growth enablement" },
  { need: "Multi-Brand Consistency", dandy: "One standard across all your brands and locations", traditional: "Varies by location and vendor" },
  { need: "Waste Prevention", dandy: "AI Scan Review catches issues before they cost you", traditional: "Remakes discovered after the fact" },
  { need: "Executive Visibility", dandy: "Real-time, actionable data across your entire network", traditional: "Fragmented, non-actionable reports" },
  { need: "Capital Efficiency", dandy: "Premium scanners included — no CAPEX required", traditional: "Heavy CAPEX, scanner bottlenecks" },
  { need: "Change Management", dandy: "Hands-on training that respects provider autonomy", traditional: "Minimal onboarding, slow rollout" },
];

export function BlockDsoComparison({ props, onCtaClick, animationsEnabled = true }: Props) {
  const {
    eyebrow = "The Dandy Difference",
    headline = "Built for DSO scale.\nDesigned for provider trust.",
    subheadline = "Dandy combines the lab providers choose with advanced manufacturing, AI-driven quality control, and network-wide insights — a model traditional labs simply can't match.",
    companyName = "Your DSO",
    ctaText = "Request a Demo",
    ctaUrl = "#",
    rows,
    backgroundStyle = "muted",
    tableNeedColor,
    tableDandyColor,
    tableTraditionalColor,
    headerDandyColor,
    backgroundImage,
    backgroundOverlay,
    overlayColor = "#000000",
  } = props;
  const dark = isDarkBg(backgroundStyle) || !!backgroundImage;
  const sectionBgStyle = backgroundImage ? getImageBgSectionStyle(backgroundImage) : getBgStyle(backgroundStyle);

  const anim = animationsEnabled;
  const eyebrowAnim = anim ? { initial: { opacity: 0, y: 10 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } } : {};
  const headlineAnim = anim ? { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.7 } } : {};
  const subAnim = anim ? { initial: { opacity: 0, y: 15 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay: 0.1 } } : {};
  const tableAnim = anim ? { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay: 0.1, duration: 0.7 } } : {};
  const ctaAnim = anim ? { initial: { opacity: 0, y: 15 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay: 0.2 } } : {};

  const displayRows = (rows && rows.length > 0) ? rows : DEFAULT_ROWS;

  const handleCta = () => {
    if (onCtaClick) { onCtaClick(); return; }
    if (ctaUrl && ctaUrl !== "#") safeNavigate(ctaUrl, "_blank");
  };

  const headlineParts = headline.includes("\n") ? headline.split("\n") : [headline];

  return (
    <section style={sectionBgStyle} className="py-24 md:py-32">
      {backgroundImage && <div style={{ position: "absolute", inset: 0, backgroundColor: overlayColor, opacity: backgroundOverlay ?? 0.55, zIndex: 0, pointerEvents: "none" }} />}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          {eyebrow && (
            <motion.p
              {...eyebrowAnim}
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: dark ? AW : P,
                marginBottom: "1.25rem",
              }}
            >
              {eyebrow}
            </motion.p>
          )}
          <motion.h2
            {...headlineAnim}
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(2rem,4vw,3.25rem)",
              lineHeight: 1.1,
              fontWeight: 600,
              color: dark ? "#fff" : FG,
              letterSpacing: "-0.015em",
            }}
          >
            {headlineParts.length > 1 ? (
              <>{headlineParts[0]}<br />{headlineParts.slice(1).join("\n")}</>
            ) : headline}
          </motion.h2>
          {subheadline && (
            <motion.p
              {...subAnim}
              style={{
                marginTop: "1.5rem",
                fontSize: "1.0625rem",
                color: dark ? "rgba(255,255,255,0.60)" : MU,
                lineHeight: 1.7,
                maxWidth: 640,
                margin: "1.5rem auto 0",
              }}
            >
              {subheadline}
            </motion.p>
          )}
        </div>

        {/* Table */}
        <motion.div
          {...tableAnim}
          style={{
            borderRadius: "1.25rem",
            overflow: "hidden",
            background: "#fff",
            boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.07), 0 40px 80px rgba(0,0,0,0.10)",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              background: `linear-gradient(135deg, ${P} 0%, hsl(152,45%,16%) 100%)`,
            }}
          >
            <div
              style={{
                padding: "1.375rem 1.5rem",
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "hsla(48,100%,96%,0.5)",
              }}
            >
              What {companyName} Needs
            </div>
            <div
              style={{
                padding: "1.375rem 1.5rem",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: headerDandyColor ?? AW,
                borderLeft: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              Dandy
            </div>
            <div
              style={{
                padding: "1.375rem 1.5rem",
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "hsla(48,100%,96%,0.5)",
                borderLeft: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              Traditional Labs
            </div>
          </div>

          {/* Data rows */}
          {displayRows.map((row, i) => (
            <motion.div
              key={row.need}
              {...(anim ? { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true }, transition: { delay: i * 0.04 } } : {})}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                borderTop: "1px solid hsl(40,10%,92%)",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "hsl(42,18%,97%)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div
                style={{
                  padding: "1.25rem 1.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: tableNeedColor ?? FG,
                  letterSpacing: "-0.005em",
                }}
              >
                {row.need}
              </div>
              <div
                style={{
                  padding: "1.25rem 1.5rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  borderLeft: `2px solid ${P}18`,
                  background: `${P}04`,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: `${P}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <Check style={{ width: 11, height: 11, color: P }} strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: "0.875rem", color: tableDandyColor ?? FG, lineHeight: 1.55 }}>{row.dandy}</span>
              </div>
              <div
                style={{
                  padding: "1.25rem 1.5rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  borderLeft: "1px solid hsl(40,10%,92%)",
                }}
              >
                <Minus style={{ width: 16, height: 16, color: "hsla(152,8%,48%,0.25)", marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: "0.875rem", color: tableTraditionalColor ?? MU, lineHeight: 1.55 }}>{row.traditional}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        {ctaText && (
          <motion.div
            {...ctaAnim}
            style={{ marginTop: "3rem", textAlign: "center" }}
          >
            <button
              onClick={handleCta}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                borderRadius: 9999,
                background: P,
                padding: "1rem 2.25rem",
                fontSize: 14,
                fontWeight: 600,
                color: PFG,
                cursor: "pointer",
                border: "none",
                transition: "transform 0.25s ease, box-shadow 0.25s ease",
                boxShadow: `0 4px 16px ${P}40`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = `0 8px 32px ${P}55`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = `0 4px 16px ${P}40`;
              }}
            >
              {ctaText} <ArrowRight style={{ width: 16, height: 16 }} />
            </button>
          </motion.div>
        )}
      </div>
    </section>
  );
}
