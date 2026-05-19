import { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ScanAcross, ScanDown, FlickerDot, PulseGlow } from "./SectionAmbient";
import { ArrowRight } from "lucide-react";
import type { DsoFinalCtaBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { getBgStyle, isDarkBg, getImageBgSectionStyle } from "@/lib/bg-styles";
import { safeNavigate } from "@/lib/safe-url";
import { InlineText } from "@/components/InlineText";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { ChiliPiperModal } from "./ChiliPiperModal";

interface Props {
  props: DsoFinalCtaBlockProps;
  onCtaClick?: () => void;
  onFieldChange?: (updated: DsoFinalCtaBlockProps) => void;
  brand?: BrandConfig;
  pageId?: number;
  variantId?: number;
  sessionId?: string;
}

const P     = "hsl(152,42%,12%)";
const PFG   = "hsl(48,100%,96%)";
const AW    = "var(--brand-accent, hsl(68,60%,52%))";
const DISPLAY_FONT = "var(--brand-font-display, var(--app-font-display, system-ui)), 'Inter', system-ui, sans-serif";

export function BlockDsoFinalCta({ props, onCtaClick, onFieldChange, brand, pageId, variantId, sessionId }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [cpOpen, setCpOpen] = useState(false);
  const isModalCta = props.primaryCtaMode === "modal-form" || props.primaryCtaMode === "modal-chilipiper";
  const isChiliPiperCta = props.primaryCtaMode === "chilipiper" && !!props.primaryChilipiperUrl;
  const field = (key: keyof DsoFinalCtaBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as DsoFinalCtaBlockProps[typeof key] }) : undefined;

  const {
    eyebrow = "Next Steps",
    headline = "Prove ROI. Then scale.",
    subheadline = "Validate impact with a focused pilot across a handful of teams. Measure efficiency gains and revenue lift in real time — then scale across your network with confidence.",
    primaryCtaText = "Get Pricing",
    primaryCtaUrl = "#",
    secondaryCtaText = "Calculate ROI",
    secondaryCtaUrl = "#",
    backgroundStyle = "muted",
    backgroundImage,
    backgroundOverlay,
    overlayColor = "#000000",
  } = props;
  const dark = isDarkBg(backgroundStyle) || !!backgroundImage;
  const sectionBgStyle = backgroundImage ? { ...getImageBgSectionStyle(backgroundImage), overflow: "hidden" as const } : { position: "relative" as const, overflow: "hidden" as const, ...getBgStyle(backgroundStyle) };

  const ctaRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ctaRef, offset: ["start end", "end start"] });
  const orb1Y = useTransform(scrollYProgress, [0, 1], ["80px", "-80px"]);
  const orb2Y = useTransform(scrollYProgress, [0, 1], ["-50px", "50px"]);
  const orb3Y = useTransform(scrollYProgress, [0, 1], ["30px", "-30px"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["30px", "-15px"]);

  const handlePrimary = () => {
    if (isModalCta) { onCtaClick?.(); setModalOpen(true); return; }
    if (isChiliPiperCta) { onCtaClick?.(); setCpOpen(true); return; }
    if (onCtaClick) { onCtaClick(); return; }
    if (primaryCtaUrl && primaryCtaUrl !== "#") safeNavigate(primaryCtaUrl, "_blank");
  };

  const handleSecondary = () => {
    if (secondaryCtaUrl && secondaryCtaUrl !== "#") safeNavigate(secondaryCtaUrl, "_blank");
  };

  const headlineLines = headline.includes(". ")
    ? [headline.split(". ")[0] + ".", headline.split(". ").slice(1).join(". ")]
    : [headline];

  return (
    <section
      ref={ctaRef}
      style={sectionBgStyle}
      className="py-28 md:py-36"
    >
      {backgroundImage && <div style={{ position: "absolute", inset: 0, backgroundColor: overlayColor, opacity: backgroundOverlay ?? 0.55, zIndex: 0, pointerEvents: "none" }} />}
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
          background: dark ? `rgb(var(--brand-accent-rgb, 199 231 56) / 0.094)` : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.071)`,
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
          background: dark ? `rgb(var(--brand-accent-rgb, 199 231 56) / 0.063)` : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.031)`,
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      {dark && (
        <>
          <ScanAcross duration={12} delay={3} repeatDelay={10} />
          <ScanDown duration={14} delay={7} repeatDelay={12} />
          <PulseGlow top="50%" left="50%" size={500} duration={9} delay={1} />
          <FlickerDot top="18%" left="8%" delay={0} />
          <FlickerDot top="72%" right="6%" delay={1.8} />
          <FlickerDot top="40%" right="12%" delay={4} />
        </>
      )}

      {/* Thin top border accent */}
      <div
        style={{
          position: "absolute",
          top: 0, left: "50%",
          transform: "translateX(-50%)",
          width: 120, height: 1,
          background: dark
            ? `linear-gradient(90deg, transparent, rgb(var(--brand-accent-rgb, 199 231 56) / 0.376), transparent)`
            : `linear-gradient(90deg, transparent, rgb(var(--brand-primary-rgb, 0 58 48) / 0.251), transparent)`,
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
              <InlineText as="span" value={eyebrow} onUpdate={field("eyebrow")} />
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
          {onFieldChange ? (
            <InlineText as="span" value={headline} onUpdate={field("headline")} multiline />
          ) : (
            headlineLines.length > 1 ? (<>{headlineLines[0]}<br />{headlineLines[1]}</>) : headline
          )}
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
            <InlineText as="span" value={subheadline} onUpdate={field("subheadline")} multiline />
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
                boxShadow: `0 4px 20px rgb(var(--brand-accent-rgb, 199 231 56) / 0.314)`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = `0 8px 36px rgb(var(--brand-accent-rgb, 199 231 56) / 0.396)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = `0 4px 20px rgb(var(--brand-accent-rgb, 199 231 56) / 0.314)`;
              }}
            >
              <InlineText as="span" value={primaryCtaText} onUpdate={field("primaryCtaText")} /> <ArrowRight style={{ width: 16, height: 16 }} />
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
                color: dark ? `${PFG}90` : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.6)`,
                cursor: "pointer",
                border: dark ? `1px solid ${PFG}30` : `1px solid rgb(var(--brand-primary-rgb, 0 58 48) / 0.188)`,
                transition: "all 0.25s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = dark ? PFG : P;
                e.currentTarget.style.borderColor = dark ? `${PFG}50` : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.333)`;
                e.currentTarget.style.background = dark ? `${PFG}08` : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.024)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = dark ? `${PFG}90` : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.6)`;
                e.currentTarget.style.borderColor = dark ? `${PFG}30` : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.188)`;
                e.currentTarget.style.background = "transparent";
              }}
            >
              <InlineText as="span" value={secondaryCtaText} onUpdate={field("secondaryCtaText")} />
            </button>
          )}
        </motion.div>
      </motion.div>
      {isChiliPiperCta && cpOpen && props.primaryChilipiperUrl && (
        <ChiliPiperModal
          url={props.primaryChilipiperUrl}
          pageId={pageId}
          variantId={variantId}
          sessionId={sessionId}
          onClose={() => setCpOpen(false)}
        />
      )}
      {isModalCta && (
        <EmailCaptureModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          email=""
          mode={props.primaryCtaMode === "modal-chilipiper" ? "chilipiper" : "form"}
          chilipiperUrl={props.modalChilipiperUrl}
          formSource={props.modalFormSource}
          linkedFormId={props.modalFormId}
          marketoBaseUrl={props.modalMarketoBaseUrl}
          marketoMunchkinId={props.modalMarketoMunchkinId}
          marketoFormId={props.modalMarketoFormId}
          chiliPiperConfig={props.modalChiliPiperHandoffUrl ? { url: props.modalChiliPiperHandoffUrl, mode: props.modalChiliPiperHandoffMode ?? "modal", fieldMap: props.modalChiliPiperHandoffFieldMap } : null}
          formConfig={{
            headline: props.modalHeadline,
            subheadline: props.modalSubheadline,
            submitText: props.modalSubmitText,
            successMessage: props.modalSuccessMessage,
            disclaimer: props.modalDisclaimer,
            showFirstName: props.modalShowFirstName,
            showLastName: props.modalShowLastName,
            showPhone: props.modalShowPhone,
            showCompany: props.modalShowCompany,
          }}
          brand={brand}
          pageId={pageId}
          variantId={variantId}
          source="dso-final-cta"
        />
      )}
    </section>
  );
}
