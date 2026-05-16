import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { DandyProductHeroBlockProps } from "@/lib/block-types/dso-blocks";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { useBrandConfig } from "@/components/BrandSwatches";
import { InlineText } from "@/components/InlineText";

interface Props {
  block: { props: DandyProductHeroBlockProps };
  onCtaClick?: (url: string, mode?: import("@/lib/block-types").CtaMode) => void;
  pageId?: number;
  variantId?: number;
  onFieldChange?: (updated: DandyProductHeroBlockProps) => void;
}

const DANDY_GREEN = "var(--brand-primary)";
const DANDY_LIME = "var(--brand-accent)";
const DISPLAY_FONT = `var(--brand-font-display, var(--app-font-display, 'Bagoss Standard')), 'Bagoss Standard', 'Reckless', Georgia, serif`;
const SANS_FONT = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

export function BlockDandyProductHero({ block, onCtaClick, pageId, variantId, onFieldChange }: Props) {
  const p = block.props;
  const field = (key: keyof DandyProductHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...p, [key]: v as DandyProductHeroBlockProps[typeof key] }) : undefined;
  const [email, setEmail] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const submitMode = p.submitMode ?? "navigate";

  const bg = p.backgroundColor || DANDY_GREEN;
  const accent = p.accentColor || DANDY_LIME;
  const brand = useBrandConfig() ?? undefined;
  const baseTextColor = p.textColor || "#ffffff";
  const imageBleed = p.imageBleed ?? true;
  const imageScale = p.imageScale ?? 1.35;
  const imageAnchor = p.imageAnchor || "top left";
  const minH = p.minHeight ?? 90;
  const spinImage = p.spinImage ?? false;
  const spinDuration = p.spinDuration ?? 18;
  const spinDirection = p.spinDirection ?? "cw";

  const variant = p.variant ?? "split";
  const inputStyle = p.inputStyle ?? "rounded";
  const buttonColor = p.buttonColor || p.buttonHoverColor || accent;
  const buttonHoverColor = p.buttonHoverColor || p.buttonColor || accent;
  const buttonTextColor = p.buttonTextColor || bg;
  const leftFr = p.leftColumnFr ?? 1.05;
  const rightFr = p.rightColumnFr ?? 1;
  const cardColor = p.cardColor || "#e8e6df";
  const cardTextColor = p.cardTextColor || "#0a2b25";
  const imageBgColor = p.imageBackgroundColor || "#ffffff";

  // In card variant, copy lives inside the grey card → use cardTextColor.
  const textColor = variant === "card" ? cardTextColor : baseTextColor;
  // Section background depends on variant.
  const sectionBg = variant === "split" ? bg : imageBgColor;

  const isPill = inputStyle === "rounded";
  const inputRadius = isPill ? "9999px" : "6px";
  const formPadding = isPill ? "0.375rem" : "0";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (submitMode === "modal-form" || submitMode === "modal-chilipiper") {
      setModalOpen(true);
      return;
    }
    const url = p.primaryCtaUrl || "#";
    const targetUrl = email
      ? `${url}${url.includes("?") ? "&" : "?"}email=${encodeURIComponent(email)}`
      : url;
    if (onCtaClick) onCtaClick(targetUrl, p.primaryCtaMode ?? "link");
    else if (typeof window !== "undefined") window.location.href = targetUrl;
  };

  const eyebrowStyle: CSSProperties = {
    fontFamily: SANS_FONT,
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: variant === "card" ? bg : accent,
    marginBottom: "1.5rem",
  };

  const headlineStyle: CSSProperties = {
    fontFamily: DISPLAY_FONT,
    fontSize: "clamp(2.5rem, 5.2vw, 4.5rem)",
    lineHeight: 1.05,
    letterSpacing: "-0.02em",
    color: textColor,
    fontWeight: 400,
    marginBottom: "1.5rem",
  };

  const subStyle: CSSProperties = {
    fontFamily: SANS_FONT,
    fontSize: "clamp(1rem, 1.2vw, 1.125rem)",
    lineHeight: 1.55,
    color: variant === "card" ? `${textColor}cc` : `${textColor}cc`,
    maxWidth: "32rem",
    marginBottom: "2.25rem",
  };

  // Left column copy + email form (shared by all variants)
  const leftContent: ReactNode = (
    <>
      {p.eyebrow && <div style={eyebrowStyle}><InlineText as="span" value={p.eyebrow} onUpdate={field("eyebrow")} /></div>}
      <h1 style={headlineStyle}><InlineText as="span" value={p.headline || ""} onUpdate={field("headline")} multiline /></h1>
      {p.subheadline && <p style={subStyle}><InlineText as="span" value={p.subheadline} onUpdate={field("subheadline")} multiline /></p>}

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          alignItems: "center",
          backgroundColor: "#ffffff",
          borderRadius: inputRadius,
          padding: formPadding,
          maxWidth: "32rem",
          boxShadow: variant === "card" ? "0 2px 8px rgba(0,0,0,0.06)" : "0 8px 32px rgba(0,0,0,0.18)",
          gap: isPill ? "0.25rem" : "0",
          border: variant === "card" && !isPill ? "1px solid rgba(0,0,0,0.08)" : "none",
          overflow: "hidden",
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={p.emailPlaceholder || "Email address"}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            padding: "0.875rem 1.25rem",
            fontFamily: SANS_FONT,
            fontSize: "0.9375rem",
            color: "#0a0a0a",
          }}
        />
        <button
          type="submit"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            backgroundColor: hover ? buttonHoverColor : buttonColor,
            color: buttonTextColor,
            border: "none",
            borderRadius: inputRadius,
            padding: "0.875rem 1.75rem",
            fontFamily: SANS_FONT,
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "background-color 0.18s ease",
          }}
        >
          <InlineText as="span" value={p.primaryCtaText || "Get Started"} onUpdate={field("primaryCtaText")} />
        </button>
      </form>

      {p.disclaimer && (
        <p
          style={{
            marginTop: "1rem",
            fontFamily: SANS_FONT,
            fontSize: "0.75rem",
            color: `${textColor}80`,
            maxWidth: "32rem",
          }}
        >
          <InlineText as="span" value={p.disclaimer} onUpdate={field("disclaimer")} multiline />
        </p>
      )}
    </>
  );

  // Image element (shared, but positioning differs by variant)
  const imageEl: ReactNode = p.imageUrl ? (
    spinImage ? (
      <>
        <style>{`@keyframes dandyHeroSpin${spinDirection}{from{transform:rotate(${spinDirection === "cw" ? "0deg" : "360deg"})}to{transform:rotate(${spinDirection === "cw" ? "360deg" : "0deg"})}}`}</style>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img
            src={p.imageUrl}
            alt={p.imageAlt || ""}
            style={{
              width: "82%",
              height: "82%",
              objectFit: "contain",
              transform: `scale(${imageScale})`,
              animation: `dandyHeroSpin${spinDirection} ${spinDuration}s linear infinite`,
              transformOrigin: "center center",
              willChange: "transform",
            }}
          />
        </div>
      </>
    ) : (
      <img
        src={p.imageUrl}
        alt={p.imageAlt || ""}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: variant === "split" ? "cover" : "contain",
          objectPosition: imageAnchor,
          transform: imageScale !== 1 ? `scale(${imageScale})` : undefined,
          transformOrigin: imageAnchor,
        }}
      />
    )
  ) : (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: variant === "split" ? `${baseTextColor}30` : "rgba(0,0,0,0.25)",
        fontFamily: DISPLAY_FONT,
        fontSize: "0.875rem",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        border: variant === "split" ? `1px dashed ${baseTextColor}20` : "1px dashed rgba(0,0,0,0.15)",
      }}
    >
      Add product image
    </div>
  );

  const gridTemplateColumns = `minmax(0, ${leftFr}fr) minmax(0, ${rightFr}fr)`;

  return (
    <section
      className={`dandy-product-hero dph-variant-${variant}`}
      style={{
        position: "relative",
        backgroundColor: sectionBg,
        color: textColor,
        overflow: "hidden",
        minHeight: `${minH}vh`,
        display: "flex",
        alignItems: "stretch",
      }}
    >
      <style>{`
        @media (max-width: 767px) {
          .dandy-product-hero .dph-grid { grid-template-columns: 1fr !important; gap: 0 !important; }
          .dandy-product-hero .dph-image-bleed,
          .dandy-product-hero .dph-image { display: none !important; }
          .dandy-product-hero .dph-card { padding: 2rem !important; }
        }
      `}</style>

      {/* Gradient overlay for "gradient" variant — sits behind content but above section bg */}
      {variant === "gradient" && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to right, ${bg} 0%, ${bg} 38%, ${bg}cc 50%, ${bg}66 60%, transparent 75%)`,
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Bleed image: sibling of the centered grid so right:0 reaches the
          true section edge instead of the grid's inner padding. Width is
          derived from the column ratios on tablet+ so the split-slider still
          controls the visual proportion. */}
      {variant === "split" && imageBleed && (
        <motion.div
          className="dph-image-bleed"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: `${(rightFr / (leftFr + rightFr)) * 100}%`,
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {imageEl}
        </motion.div>
      )}

      <div
        className="dph-grid"
        style={{
          width: "100%",
          maxWidth: "1440px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns,
          gap: variant === "card" ? "3rem" : "2rem",
          padding: variant === "card"
            ? "clamp(2rem, 4vw, 3.5rem) clamp(1.5rem, 4vw, 4rem)"
            : "clamp(3rem, 6vw, 5.5rem) clamp(1.5rem, 4vw, 4rem)",
          alignItems: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* ── Left: copy + email capture ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ minWidth: 0, position: "relative", zIndex: 2 }}
        >
          {variant === "card" ? (
            <div
              className="dph-card"
              style={{
                backgroundColor: cardColor,
                borderRadius: "8px",
                padding: "clamp(2.5rem, 4vw, 4rem)",
                color: cardTextColor,
              }}
            >
              {leftContent}
            </div>
          ) : (
            leftContent
          )}
        </motion.div>

        {/* ── Right: product image (skipped when bleeding — image renders as
            section sibling above so the second grid column is reserved space
            but visually empty here). */}
        {!(variant === "split" && imageBleed) && (
          <motion.div
            className="dph-image"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              minHeight: "60vh",
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            {imageEl}
          </motion.div>
        )}
      </div>

      <EmailCaptureModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        email={email}
        mode={submitMode === "modal-chilipiper" ? "chilipiper" : "form"}
        chilipiperUrl={p.modalChilipiperUrl}
        primaryColor={bg}
        accentColor={accent}
        brand={brand}
        pageId={pageId}
        variantId={variantId}
        source="dandy-product-hero"
        formSource={p.modalFormSource ?? "simple"}
        linkedFormId={p.modalFormId}
        marketoBaseUrl={p.modalMarketoBaseUrl}
        marketoMunchkinId={p.modalMarketoMunchkinId}
        marketoFormId={p.modalMarketoFormId}
        chiliPiperConfig={p.modalChiliPiperHandoffUrl ? { url: p.modalChiliPiperHandoffUrl, mode: p.modalChiliPiperHandoffMode ?? "modal" } : null}
        formConfig={{
          headline: p.modalHeadline,
          subheadline: p.modalSubheadline,
          submitText: p.modalSubmitText,
          successMessage: p.modalSuccessMessage,
          disclaimer: p.modalDisclaimer,
          showFirstName: p.modalShowFirstName,
          showLastName: p.modalShowLastName,
          showPhone: p.modalShowPhone,
          showCompany: p.modalShowCompany,
        }}
      />
    </section>
  );
}
