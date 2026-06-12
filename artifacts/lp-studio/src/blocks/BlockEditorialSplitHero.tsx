import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Menu } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { EditorialSplitHeroBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BrandLogo, brandHasLogo } from "@/components/BrandLogo";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { pickCtaButtonColors } from "@/lib/brand-config";

interface Props {
  props: EditorialSplitHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: EditorialSplitHeroBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

/** Mockup defaults — light editorial palette. */
const MOCKUP_BG = "#fdfbf9";
const MOCKUP_TEXT = "#1a1a1a";
/** The mockup renders the italic accent word in text-gray-400. */
const MOCKUP_ACCENT_HEX = "#9ca3af";
/** Default headline face leans Playfair (per mockup `font-serif-display`). */
const PLAYFAIR_FALLBACK = "'Playfair Display', Georgia, serif";

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function BlockEditorialSplitHero({
  props,
  brand,
  onCtaClick,
  onFieldChange,
  pageId,
  variantId,
}: Props) {
  const field = (key: keyof EditorialSplitHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  // ── Brand-driven colors ───────────────────────────────────────────────
  const bg = props.bgColor || MOCKUP_BG;
  const text = props.textColor || MOCKUP_TEXT;
  const accent = props.accentColor || `var(--brand-accent, ${MOCKUP_ACCENT_HEX})`;

  // ── Brand-driven fonts ────────────────────────────────────────────────
  // Load any picked catalog font; also load the mockup defaults (Playfair
  // Display + Inter) so the un-overridden look matches the approved mockup.
  useBlockFonts(props.headlineFont || "Playfair Display", props.bodyFont || "Inter");
  const headlineFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || PLAYFAIR_FALLBACK
    : `var(--brand-font-display, ${PLAYFAIR_FALLBACK})`;
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") ||
      "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)"
    : "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)";

  const imageSide = props.imageSide || "right";
  const ctaStyle = props.ctaStyle || "buttons";
  const submitMode = props.submitMode ?? "navigate";

  const brandName = brand.brandName || "Brand";

  // Surface-aware CTA fill used for the email-capture pill default.
  const ctaColors = pickCtaButtonColors(brand, bg);

  // ── Shared CtaButton modal config (spread onto every CtaButton) ────────
  const modalCfg = {
    modalChilipiperUrl: props.modalChilipiperUrl,
    modalFormSource: props.modalFormSource,
    modalFormId: props.modalFormId,
    modalMarketoBaseUrl: props.modalMarketoBaseUrl,
    modalMarketoMunchkinId: props.modalMarketoMunchkinId,
    modalMarketoFormId: props.modalMarketoFormId,
    modalChiliPiperHandoffUrl: props.modalChiliPiperHandoffUrl,
    modalChiliPiperHandoffMode: props.modalChiliPiperHandoffMode,
    modalChiliPiperHandoffFieldMap: props.modalChiliPiperHandoffFieldMap,
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

  // ── Email-capture pill state + submit routing (mirrors dso-heartland) ──
  const [emailValue, setEmailValue] = useState("");
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = emailValue.trim();
    if (!trimmed) return;

    if (submitMode === "modal-form" || submitMode === "modal-chilipiper") {
      setEmailModalOpen(true);
      return;
    }

    const ctaUrl = props.ctaUrl?.trim() ?? "";

    if (ctaUrl.startsWith("#") && ctaUrl.length > 1) {
      const target = document.getElementById(ctaUrl.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }

    const hasRealUrl = ctaUrl && ctaUrl !== "#" && !ctaUrl.startsWith("#");
    if (hasRealUrl) {
      try {
        const url = new URL(ctaUrl, window.location.origin);
        url.searchParams.set("email", trimmed);
        window.location.assign(url.toString());
        return;
      } catch {
        // fall through
      }
    }

    const brandDefault = brand?.defaultCtaUrl?.trim();
    const brandHasDefault = !!(brandDefault && brandDefault !== "#" && !brandDefault.startsWith("#"));
    const brandHasChilipiper = !!brand?.chilipiperUrl;
    if (onCtaClick && (brandHasDefault || brandHasChilipiper)) {
      onCtaClick();
      return;
    }

    setEmailModalOpen(true);
  };

  // ── Primary CTA — preserves the mockup's underline text-button look ────
  const primaryAction = props.ctaAction || "url";
  const primaryLabelColor = props.ctaButtonTextColor || text;
  const primaryBorderColor = props.ctaButtonColor || text;

  const emailPill = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.7 }}
      style={{ width: "100%", maxWidth: 480 }}
    >
      <form
        onSubmit={handleEmailSubmit}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 6,
          borderRadius: 9999,
          background: "#fff",
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          width: "100%",
        }}
      >
        <input
          type="email"
          required
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          placeholder={props.emailCapturePlaceholder || "Email address"}
          aria-label={props.emailCapturePlaceholder || "Email address"}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            padding: "0.75rem 1rem",
            fontSize: "0.9375rem",
            color: MOCKUP_TEXT,
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-full text-sm font-semibold"
          style={{
            background: props.ctaButtonColor || ctaColors.bg,
            color: props.ctaButtonTextColor || ctaColors.text,
            padding: "0.75rem 1.5rem",
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {props.emailCaptureButtonText || props.ctaText || "Get started"}
        </button>
      </form>
    </motion.div>
  );

  const buttonCtas = (
    <div className="flex flex-wrap items-center gap-6">
      <CtaButton
        ctaAction={primaryAction}
        ctaUrl={props.ctaUrl}
        chilipiperUrl={props.chilipiperUrl}
        videoUrl={props.videoUrl}
        {...modalCfg}
        onClick={primaryAction === "url" ? onCtaClick : undefined}
        className="group flex items-center gap-4 text-sm uppercase tracking-widest font-medium pb-2 border-b"
        style={{ color: primaryLabelColor, borderColor: primaryBorderColor, background: "transparent" }}
        brand={brand}
        pageId={pageId}
        variantId={variantId}
        source="editorial-split-hero-primary"
      >
        <InlineText as="span" value={props.ctaText} onUpdate={field("ctaText")} />
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </CtaButton>

      {(props.ctaSecondaryText || onFieldChange) && (
        <CtaButton
          ctaAction={props.ctaSecondaryAction || "url"}
          ctaUrl={props.ctaSecondaryUrl}
          chilipiperUrl={props.secondaryChilipiperUrl}
          videoUrl={props.secondaryVideoUrl}
          {...modalCfg}
          onClick={(props.ctaSecondaryAction || "url") === "url" ? onCtaClick : undefined}
          className="group flex items-center gap-2 text-sm uppercase tracking-widest font-medium pb-2 border-b border-transparent hover:border-current transition-colors"
          style={{ color: text, opacity: 0.7, background: "transparent" }}
          brand={brand}
          pageId={pageId}
          variantId={variantId}
          source="editorial-split-hero-secondary"
        >
          <InlineText as="span" value={props.ctaSecondaryText ?? ""} onUpdate={field("ctaSecondaryText")} />
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </CtaButton>
      )}
    </div>
  );

  // ── Nav ────────────────────────────────────────────────────────────────
  const navBar = (props.showNav !== false) && (
    <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-6 mix-blend-difference" style={{ color: MOCKUP_BG }}>
      <div className="text-xl tracking-widest uppercase font-medium" style={{ fontFamily: headlineFamily }}>
        {brandHasLogo(brand, props.logoImageUrl) ? (
          <BrandLogo
            brand={brand}
            url={props.logoImageUrl}
            // The nav is `mix-blend-difference` (built for a white wordmark), so
            // the logo must render white — `onLight` would recolor a mono SVG to
            // the brand primary (e.g. pink) and read wrong under the blend.
            tone="onDark"
            alt={props.logoText || brandName}
            style={{ height: 28, display: "block" }}
          />
        ) : (
          props.logoText || brandName
        )}
      </div>

      {(props.navLinks && props.navLinks.length > 0) && (
        <div className="hidden md:flex items-center gap-8 text-sm tracking-wide" style={{ fontFamily: bodyFamily }}>
          {props.navLinks.map((link, i) => (
            <a key={i} href={link.url || "#"} className="hover:opacity-70 transition-opacity">
              {link.label}
            </a>
          ))}
        </div>
      )}

      <div className="flex items-center gap-6" style={{ fontFamily: bodyFamily }}>
        {props.navSignInText && (
          <a
            href={props.navSignInUrl || "#"}
            className="hidden md:block text-sm uppercase tracking-wider border-b border-transparent hover:border-current transition-colors pb-0.5"
          >
            {props.navSignInText}
          </a>
        )}
        {props.navCtaText && (
          <a
            href={props.navCtaUrl || "#"}
            className="hidden md:block text-sm uppercase tracking-wider border-b border-current hover:opacity-70 transition-opacity pb-0.5"
          >
            {props.navCtaText}
          </a>
        )}
        <button className="md:hidden" aria-label="Open menu" type="button">
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );

  // ── Content column ───────────────────────────────────────────────────
  const contentCol = (
    <div
      className="relative z-10 flex flex-col justify-center px-6 sm:px-10 lg:px-16 xl:px-24 py-16 md:py-20 lg:py-24"
      style={{ backgroundColor: bg }}
    >
      <div className="max-w-xl mx-auto lg:mx-0 w-full">
        {(props.eyebrow || onFieldChange) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.2 }}
            className="mb-8 lg:mb-10 flex items-center gap-3"
          >
            {/* Kicker rail */}
            <span
              className="inline-block h-px w-10 shrink-0"
              style={{ backgroundColor: text, opacity: 0.35 }}
              aria-hidden
            />
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={field("eyebrow")}
              className="block text-xs uppercase tracking-[0.22em] font-medium"
              style={{ fontFamily: bodyFamily, color: text, opacity: 0.55 }}
            />
          </motion.div>
        )}

        <motion.h1
          className="font-medium mb-7"
          style={{
            fontFamily: headlineFamily,
            color: text,
            fontSize: "clamp(2.875rem, 4.5vw + 1rem, 5.75rem)",
            lineHeight: 1.04,
            letterSpacing: "-0.015em",
          }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.3 }}
        >
          <InlineText as="span" value={props.headline} onUpdate={field("headline")} />
        </motion.h1>

        {(props.subheadline || onFieldChange) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
          >
            <InlineText
              as="p"
              multiline
              value={props.subheadline ?? ""}
              onUpdate={field("subheadline")}
              className="text-lg leading-relaxed max-w-md mb-10 lg:mb-12"
              style={{ fontFamily: bodyFamily, color: text, opacity: 0.66 }}
            />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.7 }}
          style={{ fontFamily: bodyFamily }}
        >
          {ctaStyle === "email-capture" ? emailPill : buttonCtas}
        </motion.div>
      </div>
    </div>
  );

  // ── Image column ─────────────────────────────────────────────────────
  const imageFallback: CSSProperties = {
    background: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 45%, var(--brand-primary, ${MOCKUP_TEXT})) 100%)`,
  };

  // Editorial plate treatment: the photo sits inset on the surface as a
  // rounded plate with a hairline ring + soft layered shadow, instead of a
  // hard full-bleed column.
  const imageCol = (
    <div className="relative w-full flex p-4 sm:p-6 lg:p-10 xl:p-12">
      <motion.div
        initial={{ scale: 1.04, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: EASE_OUT_EXPO }}
        className="relative w-full h-[46vh] min-h-[320px] lg:h-auto overflow-hidden rounded-2xl"
        style={{
          backgroundColor: `color-mix(in srgb, ${text} 8%, ${bg})`,
          boxShadow:
            "0 0 0 1px rgba(17,17,17,0.07), 0 24px 56px -24px rgba(17,17,17,0.3), 0 8px 20px -12px rgba(17,17,17,0.18)",
        }}
      >
        {props.imageUrl ? (
          <InlineImage
            src={props.imageUrl}
            alt={props.imageAlt || ""}
            wrapperClassName="block w-full h-full"
            className="w-full h-full object-cover"
            onUpdate={field("imageUrl")}
            onAltUpdate={field("imageAlt")}
          />
        ) : onFieldChange ? (
          <InlineImage
            src=""
            alt={props.imageAlt || ""}
            wrapperClassName="block w-full h-full"
            className="w-full h-full object-cover"
            onUpdate={field("imageUrl")}
            onAltUpdate={field("imageAlt")}
          />
        ) : (
          <div className="w-full h-full" style={imageFallback} />
        )}
        {/* Hairline inner ring so bright photos keep a defined edge */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: "inset 0 0 0 1px rgba(17,17,17,0.06)" }}
          aria-hidden
        />
      </motion.div>
    </div>
  );

  return (
    <section
      className="esh-hero relative w-full flex flex-col lg:min-h-[100svh]"
      style={{ backgroundColor: bg, color: text, fontFamily: bodyFamily }}
    >
      <style>{`
        .esh-hero a:focus-visible,
        .esh-hero button:focus-visible,
        .esh-hero input:focus-visible {
          outline: 2px solid color-mix(in srgb, ${text} 75%, transparent);
          outline-offset: 3px;
        }
      `}</style>
      {navBar}

      <div
        className={`flex-1 grid grid-cols-1 ${
          props.showNav !== false ? "pt-16 lg:pt-0" : ""
        } ${
          imageSide === "left"
            ? "lg:grid-cols-[46fr_54fr]"
            : "lg:grid-cols-[54fr_46fr]"
        }`}
      >
        {imageSide === "left" ? (
          <>
            {imageCol}
            {contentCol}
          </>
        ) : (
          <>
            {contentCol}
            {imageCol}
          </>
        )}
      </div>

      <EmailCaptureModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        email={emailValue}
        mode={submitMode === "modal-chilipiper" ? "chilipiper" : "form"}
        chilipiperUrl={props.modalChilipiperUrl}
        primaryColor={brand.primaryColor}
        accentColor={brand.accentColor}
        brand={brand}
        pageId={pageId}
        variantId={variantId}
        source="editorial-split-hero"
        formSource={props.modalFormSource ?? "simple"}
        linkedFormId={props.modalFormId}
        marketoBaseUrl={props.modalMarketoBaseUrl}
        marketoMunchkinId={props.modalMarketoMunchkinId}
        marketoFormId={props.modalMarketoFormId}
        chiliPiperConfig={
          props.modalChiliPiperHandoffUrl
            ? {
                url: props.modalChiliPiperHandoffUrl,
                mode: props.modalChiliPiperHandoffMode ?? "modal",
                fieldMap: props.modalChiliPiperHandoffFieldMap,
              }
            : null
        }
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
      />
    </section>
  );
}
