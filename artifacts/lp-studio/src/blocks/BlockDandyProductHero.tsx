import { useState, type CSSProperties, type FormEvent } from "react";
import { motion } from "framer-motion";
import type { DandyProductHeroBlockProps } from "@/lib/block-types/dso-blocks";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { useBrandConfig } from "@/components/BrandSwatches";

interface Props {
  block: { props: DandyProductHeroBlockProps };
  onCtaClick?: (url: string, mode?: "link" | "chilipiper") => void;
  pageId?: number;
  variantId?: number;
}

const DANDY_GREEN = "var(--brand-primary)";
const DANDY_LIME = "var(--brand-accent)";
const DISPLAY_FONT = `var(--brand-font-display, var(--app-font-display, 'Bagoss Standard')), 'Bagoss Standard', 'Reckless', Georgia, serif`;
const SANS_FONT = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

export function BlockDandyProductHero({ block, onCtaClick, pageId, variantId }: Props) {
  const p = block.props;
  const [email, setEmail] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const submitMode = p.submitMode ?? "navigate";

  const bg = p.backgroundColor || DANDY_GREEN;
  const accent = p.accentColor || DANDY_LIME;
  const brand = useBrandConfig() ?? undefined;
  const textColor = p.textColor || "#ffffff";
  const imageBleed = p.imageBleed ?? true;
  const imageScale = p.imageScale ?? 1.35;
  const imageAnchor = p.imageAnchor || "top left";
  const minH = p.minHeight ?? 90;
  const spinImage = p.spinImage ?? false;
  const spinDuration = p.spinDuration ?? 18;
  const spinDirection = p.spinDirection ?? "cw";

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
    color: accent,
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
    color: `${textColor}cc`,
    maxWidth: "32rem",
    marginBottom: "2.25rem",
  };

  return (
    <section
      className="dandy-product-hero"
      style={{
        position: "relative",
        backgroundColor: bg,
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
          .dandy-product-hero .dph-image { display: none !important; }
        }
      `}</style>
      <div
        className="dph-grid"
        style={{
          width: "100%",
          maxWidth: "1440px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)",
          gap: "2rem",
          padding: "clamp(3rem, 6vw, 5.5rem) clamp(1.5rem, 4vw, 4rem)",
          alignItems: "center",
        }}
      >
        {/* ── Left: copy + email capture ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ minWidth: 0, position: "relative", zIndex: 2 }}
        >
          {p.eyebrow && <div style={eyebrowStyle}>{p.eyebrow}</div>}
          <h1 style={headlineStyle}>{p.headline}</h1>
          {p.subheadline && <p style={subStyle}>{p.subheadline}</p>}

          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#ffffff",
              borderRadius: "9999px",
              padding: "0.375rem",
              maxWidth: "32rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              gap: "0.25rem",
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
              style={{
                backgroundColor: accent,
                color: DANDY_GREEN,
                border: "none",
                borderRadius: "9999px",
                padding: "0.875rem 1.75rem",
                fontFamily: SANS_FONT,
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "transform 0.15s ease, filter 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.95)")}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
            >
              {p.primaryCtaText || "Get Started"}
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
              {p.disclaimer}
            </p>
          )}
        </motion.div>

        {/* ── Right: product image (intentionally bleeds off) ── */}
        <motion.div
          className="dph-image"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          style={{
            position: imageBleed ? "absolute" : "relative",
            ...(imageBleed
              ? { top: 0, right: 0, bottom: 0, width: "55%" }
              : { width: "100%", height: "100%", minHeight: "60vh" }),
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {p.imageUrl ? (
            spinImage ? (
              <>
                <style>{`@keyframes dandyHeroSpin${spinDirection}{from{transform:rotate(${spinDirection === "cw" ? "0deg" : "360deg"})}to{transform:rotate(${spinDirection === "cw" ? "360deg" : "0deg"})}}`}</style>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
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
                  objectFit: "cover",
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
                color: `${textColor}30`,
                fontFamily: DISPLAY_FONT,
                fontSize: "0.875rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                border: `1px dashed ${textColor}20`,
              }}
            >
              Add product image
            </div>
          )}
        </motion.div>
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
