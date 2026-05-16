// NOTE: This block is intentionally NOT exposed in the block catalog seed
// (`scripts/seed-block-catalog.cjs`). It was originally authored for the
// Dandy × Heartland co-branded landing page. While the registry default
// props still reference Dandy/Heartland for that legacy use, all hardcoded
// fallbacks inside the component itself have been made neutral so that, if
// the block is ever surfaced to non-Dandy tenants, no Dandy branding leaks
// through when default_props are overridden.
import { motion } from "framer-motion";
import type { DsoPracticeHeroBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses, getSecondaryButtonClasses } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";

interface Props {
  props: DsoPracticeHeroBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DsoPracticeHeroBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

const BRAND   = "var(--brand-primary, #003A30)";
const LIME    = "var(--brand-accent, hsl(68,60%,52%))";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

export function BlockDsoPracticeHero({ props, brand, onFieldChange, pageId, variantId }: Props) {
  const field = (key: keyof DsoPracticeHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as DsoPracticeHeroBlockProps[typeof key] }) : undefined;
  const {
    eyebrow,
    headline,
    subheadline,
    primaryCtaText,
    primaryCtaUrl,
    primaryCtaMode = "link",
    primaryCtaAction,
    primaryChilipiperUrl,
    secondaryCtaText,
    secondaryCtaUrl,
    secondaryCtaMode = "link",
    secondaryCtaAction,
    secondaryChilipiperUrl,
    trustLine,
    backgroundStyle = "dark",
    layout = "centered",
    imageUrl,
    imageAlt = "",
    imageShadow = true,
    heroHeight = "default",
    imageAspect = "4/3",
  } = props;

  // Resolve action: prefer explicit ctaAction; else map legacy mode "chilipiper"
  // to action="chilipiper" so existing pages keep working.
  const resolveAction = (
    action: string | undefined,
    legacyMode: string,
  ): "url" | "chilipiper" | "modal-form" | "modal-chilipiper" => {
    if (action === "chilipiper" || action === "modal-form" || action === "modal-chilipiper" || action === "url") return action;
    if (legacyMode === "chilipiper" || legacyMode === "modal-form" || legacyMode === "modal-chilipiper") return legacyMode;
    return "url";
  };
  const primaryAction = resolveAction(primaryCtaAction, primaryCtaMode);
  const secondaryAction = resolveAction(secondaryCtaAction, secondaryCtaMode);

  const modalCfg = {
    modalChilipiperUrl: props.modalChilipiperUrl,
    modalFormSource: props.modalFormSource,
    modalFormId: props.modalFormId,
    modalMarketoBaseUrl: props.modalMarketoBaseUrl,
    modalMarketoMunchkinId: props.modalMarketoMunchkinId,
    modalMarketoFormId: props.modalMarketoFormId,
    modalChiliPiperHandoffUrl: props.modalChiliPiperHandoffUrl,
    modalChiliPiperHandoffMode: props.modalChiliPiperHandoffMode,
    modalHeadline: props.modalHeadline,
    modalSubheadline: props.modalSubheadline,
    modalSubmitText: props.modalSubmitText,
    modalSuccessMessage: props.modalSuccessMessage,
    modalDisclaimer: props.modalDisclaimer,
    modalShowFirstName: props.modalShowFirstName,
    modalShowLastName: props.modalShowLastName,
    modalShowPhone: props.modalShowPhone,
    modalShowCompany: props.modalShowCompany,
  };

  const heightClass =
    heroHeight === "full" ? "min-h-screen"
    : heroHeight === "large" ? "min-h-[85vh]"
    : heroHeight === "compact" ? "min-h-[40vh]"
    : "min-h-[60vh]";

  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.6)" : "#4b5563";
  const trustC    = dark ? "rgba(255,255,255,0.35)" : "#9ca3af";
  const divC      = dark ? "rgba(255,255,255,0.12)" : "#d1fae5";

  const eyebrowEl = eyebrow ? (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      style={{ marginBottom: "1.5rem" }}
    >
      <span
        style={{
          display: "inline-block",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: eyebrowC,
          background: dark ? "rgb(var(--brand-accent-rgb, 199 231 56) / 0.1)" : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.031)`,
          border: `1px solid ${dark ? "rgb(var(--brand-accent-rgb, 199 231 56) / 0.2)" : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.125)`}`,
          borderRadius: "999px",
          padding: "0.35rem 1rem",
        }}
      >
        <InlineText as="span" value={eyebrow} onUpdate={field("eyebrow")} />
      </span>
    </motion.div>
  ) : null;

  const headlineEl = (
    <motion.h1
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.65 }}
      style={{
        fontFamily: DISPLAY,
        fontSize: "clamp(2.25rem,5.5vw,3.75rem)",
        lineHeight: 1.1,
        fontWeight: 600,
        color: headlineC,
        letterSpacing: "-0.02em",
        marginBottom: "1.25rem",
      }}
    >
      <InlineText as="span" value={headline || "Your practice. Elevated."} onUpdate={field("headline")} multiline />
    </motion.h1>
  );

  const subEl = (align: "center" | "left") => subheadline ? (
    <motion.p
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay: 0.12 }}
      style={{
        fontSize: "1.125rem",
        lineHeight: 1.7,
        color: subC,
        marginBottom: "2.25rem",
        maxWidth: align === "center" ? 600 : undefined,
        marginLeft: align === "center" ? "auto" : undefined,
        marginRight: align === "center" ? "auto" : undefined,
      }}
    >
      <InlineText as="span" value={subheadline} onUpdate={field("subheadline")} multiline />
    </motion.p>
  ) : null;

  const ctasEl = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.18 }}
      style={{ display: "flex", gap: "0.875rem", flexWrap: "wrap" }}
    >
      {primaryCtaText && (
        <CtaButton
          ctaAction={primaryAction}
          ctaUrl={primaryCtaUrl}
          chilipiperUrl={primaryChilipiperUrl ?? (primaryCtaMode === "chilipiper" ? primaryCtaUrl : undefined)}
          {...modalCfg}
          className={getButtonClasses(brand, "inline-flex items-center")}
          style={{ backgroundColor: brand.accentColor, color: brand.primaryColor }}
          brand={brand}
          pageId={pageId}
          variantId={variantId}
          source="dso-practice-hero-primary"
        >
          <InlineText as="span" value={primaryCtaText} onUpdate={field("primaryCtaText")} />
        </CtaButton>
      )}

      {secondaryCtaText && (
        <CtaButton
          ctaAction={secondaryAction}
          ctaUrl={secondaryCtaUrl}
          chilipiperUrl={secondaryChilipiperUrl ?? (secondaryCtaMode === "chilipiper" ? secondaryCtaUrl : undefined)}
          {...modalCfg}
          className={getSecondaryButtonClasses(brand)}
          style={{ borderColor: dark ? "hsl(42,18%,96%)" : BRAND, color: dark ? "hsl(42,18%,96%)" : BRAND, background: dark ? "rgba(255,255,255,0.5)" : "rgb(var(--brand-primary-rgb, 0 58 48) / 0.5)" }}
          brand={brand}
          pageId={pageId}
          variantId={variantId}
          source="dso-practice-hero-secondary"
        >
          <InlineText as="span" value={secondaryCtaText} onUpdate={field("secondaryCtaText")} />
        </CtaButton>
      )}
    </motion.div>
  );

  const trustEl = trustLine ? (
    <motion.p
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay: 0.28 }}
      style={{
        marginTop: "1.75rem",
        fontSize: "0.8125rem",
        color: trustC,
        letterSpacing: "0.01em",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <span style={{ display: "inline-block", width: 32, height: 1, background: divC }} />
      <InlineText as="span" value={trustLine} onUpdate={field("trustLine")} />
      <span style={{ display: "inline-block", width: 32, height: 1, background: divC }} />
    </motion.p>
  ) : null;

  if (layout === "bg-image" && imageUrl) {
    return (
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        className={`flex items-center ${heightClass}`}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: dark
              ? "rgba(0,0,0,0.62)"
              : "rgba(255,255,255,0.78)",
            pointerEvents: "none",
          }}
        />
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 1.5rem", textAlign: "center", position: "relative" }}>
          {eyebrowEl}
          {headlineEl}
          {subEl("center")}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {ctasEl}
            {trustEl && <div style={{ display: "flex", justifyContent: "center" }}>{trustEl}</div>}
          </div>
        </div>
      </section>
    );
  }

  if (layout === "split") {
    return (
      <section
        style={{ ...sectionBg, position: "relative", overflow: "hidden" }}
        className={`flex items-center ${heightClass}`}
      >
        {dark && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(ellipse 80% 60% at 20% -10%, rgb(var(--brand-accent-rgb, 199 231 56) / 0.09) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
        )}
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 1.5rem",
            display: "grid",
            gridTemplateColumns: imageUrl ? "1fr 1fr" : "1fr",
            gap: "3.5rem",
            alignItems: "center",
            position: "relative",
          }}
          className="md:grid-cols-2 grid-cols-1"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {eyebrowEl}
            {headlineEl}
            {subEl("left")}
            {ctasEl}
            {trustEl}
          </div>

          {imageUrl && (
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 }}
              style={{
                borderRadius: "1.25rem",
                overflow: "hidden",
                boxShadow: imageShadow
                  ? (dark
                    ? "0 32px 64px rgba(0,0,0,0.45)"
                    : "0 24px 48px rgb(var(--brand-primary-rgb, 0 58 48) / 0.12)")
                  : "none",
                aspectRatio: imageAspect,
              }}
            >
              <img
                src={imageUrl}
                alt={imageAlt}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </motion.div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section style={{ ...sectionBg, position: "relative", overflow: "hidden" }} className={`flex items-center ${heightClass}`}>
      {dark && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgb(var(--brand-accent-rgb, 199 231 56) / 0.09) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
      )}

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 1.5rem", textAlign: "center", position: "relative" }}>
        {eyebrowEl}
        {headlineEl}
        {subEl("center")}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "0.875rem", justifyContent: "center", flexWrap: "wrap" }}>
            {ctasEl}
          </div>
          {trustLine && (
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.28 }}
              style={{
                marginTop: "1.75rem",
                fontSize: "0.8125rem",
                color: trustC,
                letterSpacing: "0.01em",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ display: "inline-block", width: 32, height: 1, background: divC }} />
              {trustLine}
              <span style={{ display: "inline-block", width: 32, height: 1, background: divC }} />
            </motion.p>
          )}
        </div>
      </div>
    </section>
  );
}
