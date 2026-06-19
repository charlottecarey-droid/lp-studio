import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { DsoActivationStepsBlockProps } from "@/lib/block-types";
import { getBgStyle, resolveSectionSurface } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";

interface Props {
  props: DsoActivationStepsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DsoActivationStepsBlockProps) => void;
}

const BRAND   = "var(--brand-primary, #0f172a)";
const LIME    = "var(--brand-accent, hsl(68,60%,52%))";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_STACK;

export function BlockDsoActivationSteps({ props, brand, onFieldChange }: Props) {
  const {
    eyebrow, headline, subheadline, steps = [],
    ctaText, ctaUrl, ctaMode = "link", chilipiperUrl, backgroundStyle = "dark",
  } = props;
  // Map legacy ctaMode ("link" | "chilipiper" | "modal-form" | "modal-chilipiper")
  // onto CtaButton's CtaActionMode ("url" | …).
  const ctaAction = ctaMode === "link" ? "url" : ctaMode;
  const dark = resolveSectionSurface({ backgroundStyle: backgroundStyle }, "#ffffff", brand).isDark;
  const sectionBg = getBgStyle(backgroundStyle);

  const field = (key: keyof DsoActivationStepsBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as DsoActivationStepsBlockProps[typeof key] }) : undefined;
  const updateStep = onFieldChange && steps.length > 0
    ? (idx: number, patch: Partial<DsoActivationStepsBlockProps["steps"][number]>) => {
        onFieldChange({ ...props, steps: steps.map((s, i) => i === idx ? { ...s, ...patch } : s) });
      }
    : undefined;

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg    = dark ? "rgba(255,255,255,0.04)" : "#fff";
  const cardBor   = dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb";
  const stepNumC  = dark ? LIME : BRAND;
  const titleC    = dark ? "#fff" : BRAND;
  const descC     = dark ? "rgba(255,255,255,0.60)" : "#6b7280";
  const connLine  = dark ? "rgba(255,255,255,0.10)" : "#e5e7eb";

  return (
    <section style={sectionBg} className="py-24 md:py-32">
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          {eyebrow && (
            <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: eyebrowC, marginBottom: "1.25rem", fontFamily: BODY }}>
              <InlineText as="span" value={eyebrow} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }}/>
            </motion.p>
          )}
          {headline && (
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              style={{ fontFamily: DISPLAY, fontSize: "clamp(1.875rem,3.5vw,2.75rem)", lineHeight: 1.15, fontWeight: 600, color: headlineC, letterSpacing: "-0.015em" }}
            >
              <InlineText as="span" value={headline} onUpdate={field("headline")} multiline style={{ fontFamily: DISPLAY }}/>
            </motion.h2>
          )}
          {subheadline && (
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }} style={{ marginTop: "1.25rem", fontSize: "1.0625rem", color: subC, lineHeight: 1.7, maxWidth: 560, margin: "1.25rem auto 0", fontFamily: BODY }}>
              <InlineText as="span" value={subheadline} onUpdate={field("subheadline")} multiline style={{ fontFamily: BODY }}/>
            </motion.p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", position: "relative" }}>
          {/* Vertical connector */}
          <div
            style={{
              position: "absolute",
              left: 27,
              top: 24,
              bottom: 24,
              width: 2,
              background: connLine,
              zIndex: 0,
            }}
          />

          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.55 }}
              style={{ display: "flex", gap: "1.25rem", position: "relative", zIndex: 1 }}
            >
              {/* Step number badge */}
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  background: dark ? `rgb(var(--brand-accent-rgb, 59 130 246) / 0.094)` : `rgb(var(--brand-primary-rgb, 15 23 42) / 0.063)`,
                  border: `2px solid ${dark ? `rgb(var(--brand-accent-rgb, 59 130 246) / 0.314)` : `rgb(var(--brand-primary-rgb, 15 23 42) / 0.188)`}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontFamily: DISPLAY, fontSize: "0.875rem", fontWeight: 700, color: stepNumC }}>{step.step}</span>
              </div>

              {/* Card */}
              <div
                style={{
                  flex: 1,
                  background: cardBg,
                  border: cardBor,
                  borderRadius: "1rem",
                  padding: "1.5rem 1.75rem",
                  backdropFilter: dark ? "blur(12px)" : "none",
                }}
              >
                <p style={{ fontFamily: DISPLAY, fontSize: "1.0625rem", fontWeight: 600, color: titleC, letterSpacing: "-0.01em" }}>
                  <InlineText as="span" value={step.title} onUpdate={updateStep ? (v) => updateStep(i, { title: v }) : undefined} style={{ fontFamily: DISPLAY }}/>
                </p>
                <p style={{ fontSize: "0.9375rem", color: descC, marginTop: "0.5rem", lineHeight: 1.65, fontFamily: BODY }}>
                  <InlineText as="span" value={step.desc} onUpdate={updateStep ? (v) => updateStep(i, { desc: v }) : undefined} multiline style={{ fontFamily: BODY }}/>
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
            <CtaButton
              ctaAction={ctaAction}
              ctaUrl={ctaUrl}
              chilipiperUrl={chilipiperUrl ?? ctaUrl}
              modalChilipiperUrl={props.modalChilipiperUrl}
              modalFormSource={props.modalFormSource}
              modalFormId={props.modalFormId}
              modalMarketoBaseUrl={props.modalMarketoBaseUrl}
              modalMarketoMunchkinId={props.modalMarketoMunchkinId}
              modalMarketoFormId={props.modalMarketoFormId}
              modalChiliPiperHandoffUrl={props.modalChiliPiperHandoffUrl}
              modalChiliPiperHandoffMode={props.modalChiliPiperHandoffMode}
              modalChiliPiperHandoffFieldMap={props.modalChiliPiperHandoffFieldMap}
              modalHeadline={props.modalHeadline}
              modalSubheadline={props.modalSubheadline}
              modalSubmitText={props.modalSubmitText}
              modalSuccessMessage={props.modalSuccessMessage}
              modalDisclaimer={props.modalDisclaimer}
              modalShowFirstName={props.modalShowFirstName}
              modalShowLastName={props.modalShowLastName}
              modalShowPhone={props.modalShowPhone}
              modalShowCompany={props.modalShowCompany}
              brand={brand}
              source="dso-activation-steps"
              className={getButtonClasses(brand, "inline-flex items-center gap-2")}
              style={{ backgroundColor: brand.accentColor, color: brand.primaryColor }}
            >
              <InlineText as="span" value={ctaText} onUpdate={field("ctaText")} style={{ fontFamily: BODY }}/>
              <ArrowRight style={{ width: 16, height: 16 }} />
            </CtaButton>
          </motion.div>
        )}
      </div>
    </section>
  );
}
