import { motion } from "framer-motion";
import { Check, Minus, ArrowRight } from "lucide-react";
import type { DsoComparisonBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

interface Props {
  props: DsoComparisonBlockProps;
  onCtaClick?: () => void;
}

const P     = "hsl(152,42%,12%)";
const PFG   = "hsl(48,100%,96%)";
const SEC   = "hsl(42,18%,96%)";
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

export function BlockDsoComparison({ props, onCtaClick }: Props) {
  const {
    eyebrow = "The Dandy Difference",
    headline = "Built for DSO scale.\nDesigned for provider trust.",
    subheadline = "Dandy combines the lab providers choose with advanced manufacturing, AI-driven quality control, and network-wide insights — a model traditional labs simply can't match.",
    companyName = "Your DSO",
    ctaText = "Request a Demo",
    ctaUrl = "#",
    rows,
    backgroundStyle = "muted",
  } = props;
  const dark = isDarkBg(backgroundStyle);

  const displayRows = (rows && rows.length > 0) ? rows : DEFAULT_ROWS;

  const handleCta = () => {
    if (onCtaClick) { onCtaClick(); return; }
    if (ctaUrl && ctaUrl !== "#") window.open(ctaUrl, "_blank");
  };

  const headlineParts = headline.includes("\n") ? headline.split("\n") : [headline];

  return (
    <section style={getBgStyle(backgroundStyle)} className="py-24 md:py-32">
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
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
                color: dark ? "hsl(68,60%,52%)" : P,
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
              color: dark ? "#fff" : FG,
              letterSpacing: 0,
            }}
          >
            {headlineParts.length > 1 ? (
              <>{headlineParts[0]}<br />{headlineParts.slice(1).join("\n")}</>
            ) : headline}
          </motion.h2>
          {subheadline && (
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              style={{
                marginTop: "1.5rem",
                fontSize: "1.125rem",
                color: MU,
                lineHeight: 1.65,
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
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.7 }}
          style={{
            borderRadius: "1rem",
            overflow: "hidden",
            background: "#fff",
            boxShadow: "0 25px 60px rgba(0,0,0,0.10),0 8px 16px rgba(0,0,0,0.06)",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              background: P,
            }}
          >
            <div
              style={{
                padding: "1.25rem",
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: `${PFG}99`,
              }}
            >
              What {companyName} Needs
            </div>
            <div
              style={{
                padding: "1.25rem",
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: AW,
              }}
            >
              Dandy
            </div>
            <div
              style={{
                padding: "1.25rem",
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: `${PFG}99`,
              }}
            >
              Traditional Labs
            </div>
          </div>

          {/* Data rows */}
          {displayRows.map((row, i) => (
            <motion.div
              key={row.need}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                borderTop: "1px solid hsl(40,10%,90%)",
              }}
              className="hover:bg-[hsl(42,18%,96%)]/40 transition-colors duration-200"
            >
              <div
                style={{
                  padding: "1.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: FG,
                }}
              >
                {row.need}
              </div>
              <div
                style={{
                  padding: "1.25rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <Check style={{ width: 16, height: 16, color: P, marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: "0.875rem", color: `${FG}cc`, lineHeight: 1.5 }}>{row.dandy}</span>
              </div>
              <div
                style={{
                  padding: "1.25rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <Minus style={{ width: 16, height: 16, color: `${MU}4d`, marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: "0.875rem", color: `${MU}80`, lineHeight: 1.5 }}>{row.traditional}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        {ctaText && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
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
                padding: "1rem 2rem",
                fontSize: 14,
                fontWeight: 600,
                color: PFG,
                cursor: "pointer",
                border: "none",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              {ctaText} <ArrowRight style={{ width: 16, height: 16 }} />
            </button>
          </motion.div>
        )}
      </div>
    </section>
  );
}
