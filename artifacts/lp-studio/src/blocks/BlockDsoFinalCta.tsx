import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { DsoFinalCtaBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

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
    backgroundStyle = "dandy-green",
  } = props;
  const dark = isDarkBg(backgroundStyle);

  const ctaRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ctaRef, offset: ["start end", "end start"] });
  const orb1Y = useTransform(scrollYProgress, [0, 1], ["80px", "-80px"]);
  const orb2Y = useTransform(scrollYProgress, [0, 1], ["-50px", "50px"]);
  const orb3Y = useTransform(scrollYProgress, [0, 1], ["30px", "-30px"]);
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
      style={{ position: "relative", overflow: "hidden", ...getBgStyle(backgroundStyle) }}
      className="py-28 md:py-36"
    >
      {/* Orb 1 — top center */}
      <motion.div
        style={{
          y: orb1Y,
          position: "absolute",
          top: -80,
          left: "50%",
          transform: "translateX(-50%)",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: dark ? `${AW}18` : `${P}12`,
          filter: "blur(100px)",
          pointerEvents: "none",
        }}
      />
      {/* Orb 2 — bottom right */}
      <motion.div
        style={{
          y: orb2Y,
          position: "absolute",
          bottom: -60,
          right: "15%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: dark ? "hsl(152,38%,22%)40" : "hsl(152,30%,85%)60",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      {/* Orb 3 — left */}
      <motion.div
        style={{
          y: orb3Y,
          position: "absolute",
          top: "30%",
          left: "-5%",
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: dark ? `${AW}10` : `${P}08`,
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      {/* Thin top border accent */}
      <div
        style={{
          position: "absolute",
          top: 0, left: "50%",
          transform: "translateX(-50%)",
          width: 120, height: 1,
          background: dark
            ? `linear-gradient(90deg, transparent, ${AW}60, transparent)`
            : `linear-gradient(90deg, transparent, ${P}40, transparent)`,
        }}
      />

      <motion.div
        style={{
          y: contentY,
          maxWidth: 680,
          margin: "0 auto",
          padding: "0 1.5rem",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {eyebrow && (
          <>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
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
          </>
        )}

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: "clamp(2.25rem,5vw,3.75rem)",
            lineHeight: 1.05,
            fontWeight: 600,
            color: dark ? PFG : P,
            letterSpacing: "-0.025em",
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
              marginTop: "1.75rem",
              fontSize: "1.0625rem",
              color: dark ? `${PFG}99` : "hsl(152,8%,44%)",
              lineHeight: 1.7,
            }}
          >
            {subheadline}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.18 }}
          style={{
            marginTop: "2.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.875rem",
            maxWidth: 420,
            margin: "2.75rem auto 0",
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
                padding: "1rem 2.25rem",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: "hsl(152,40%,10%)",
                cursor: "pointer",
                border: "none",
                transition: "transform 0.25s ease, box-shadow 0.25s ease",
                boxShadow: `0 4px 20px ${AW}50`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = `0 8px 36px ${AW}65`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = `0 4px 20px ${AW}50`;
              }}
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
                padding: "1rem 2.25rem",
                fontSize: 14,
                fontWeight: 600,
                color: dark ? `${PFG}90` : `${P}99`,
                cursor: "pointer",
                border: dark ? `1px solid ${PFG}30` : `1px solid ${P}30`,
                transition: "all 0.25s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = dark ? PFG : P;
                e.currentTarget.style.borderColor = dark ? `${PFG}50` : `${P}55`;
                e.currentTarget.style.background = dark ? `${PFG}08` : `${P}06`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = dark ? `${PFG}90` : `${P}99`;
                e.currentTarget.style.borderColor = dark ? `${PFG}30` : `${P}30`;
                e.currentTarget.style.background = "transparent";
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
