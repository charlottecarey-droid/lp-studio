import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { DsoFinalCtaBlockProps } from "@/lib/block-types";

interface Props {
  props: DsoFinalCtaBlockProps;
  onCtaClick?: () => void;
}

const P     = "hsl(152,42%,12%)";
const PFG   = "hsl(48,100%,96%)";
const AW    = "hsl(68,60%,52%)";
const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

export function BlockDsoFinalCta({ props, onCtaClick }: Props) {
  const {
    eyebrow = "Next Steps",
    headline = "Prove ROI. Then scale.",
    subheadline = "Validate impact with a focused pilot at 5–10 offices. Measure remake reduction, chair time recovered, and same-store revenue lift in real time — then scale across your network with confidence.",
    primaryCtaText = "Get Pricing",
    primaryCtaUrl = "#",
    secondaryCtaText = "Calculate ROI",
    secondaryCtaUrl = "#",
  } = props;

  const ctaRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ctaRef, offset: ["start end", "end start"] });
  const orb1Y = useTransform(scrollYProgress, [0, 1], ["60px", "-60px"]);
  const orb2Y = useTransform(scrollYProgress, [0, 1], ["-40px", "40px"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["30px", "-15px"]);

  const handlePrimary = () => {
    if (onCtaClick) { onCtaClick(); return; }
    if (primaryCtaUrl && primaryCtaUrl !== "#") window.open(primaryCtaUrl, "_blank");
  };

  const handleSecondary = () => {
    if (secondaryCtaUrl && secondaryCtaUrl !== "#") window.open(secondaryCtaUrl, "_blank");
  };

  const headlineLines = headline.includes(". ")
    ? [headline.split(". ")[0] + ".", headline.split(". ").slice(1).join(". ")]
    : [headline];

  return (
    <section
      ref={ctaRef}
      style={{ position: "relative", overflow: "hidden", background: P }}
      className="py-24 md:py-32"
    >
      {/* Orb 1 */}
      <motion.div
        style={{
          y: orb1Y,
          position: "absolute",
          top: 0,
          left: "25%",
          width: 384,
          height: 384,
          borderRadius: "50%",
          background: `${AW}1a`,
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      {/* Orb 2 */}
      <motion.div
        style={{
          y: orb2Y,
          position: "absolute",
          bottom: 0,
          right: "25%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "hsl(152,38%,24%)33",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      <motion.div
        style={{
          y: contentY,
          maxWidth: 720,
          margin: "0 auto",
          padding: "0 1.5rem",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {eyebrow && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: AW,
              marginBottom: "1.5rem",
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
            color: PFG,
            letterSpacing: 0,
          }}
        >
          {headlineLines.length > 1 ? (
            <>{headlineLines[0]}<br />{headlineLines[1]}</>
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
              color: `${PFG}a6`,
              lineHeight: 1.65,
            }}
          >
            {subheadline}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          style={{
            marginTop: "2.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            maxWidth: 400,
            margin: "2.5rem auto 0",
            justifyContent: "center",
          }}
          className="sm:flex-row"
        >
          {primaryCtaText && (
            <button
              onClick={handlePrimary}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: 9999,
                background: AW,
                padding: "1rem 2rem",
                fontSize: 14,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "hsl(152,40%,13%)",
                cursor: "pointer",
                border: "none",
                transition: "filter 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.1)")}
              onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}
            >
              {primaryCtaText} <ArrowRight style={{ width: 16, height: 16 }} />
            </button>
          )}
          {secondaryCtaText && (
            <button
              onClick={handleSecondary}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: 9999,
                background: "transparent",
                padding: "1rem 2rem",
                fontSize: 14,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: `${PFG}80`,
                cursor: "pointer",
                border: `1px solid ${PFG}26`,
                transition: "all 0.2s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = PFG;
                e.currentTarget.style.borderColor = `${PFG}40`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = `${PFG}80`;
                e.currentTarget.style.borderColor = `${PFG}26`;
              }}
            >
              {secondaryCtaText}
            </button>
          )}
        </motion.div>
      </motion.div>
    </section>
  );
}
