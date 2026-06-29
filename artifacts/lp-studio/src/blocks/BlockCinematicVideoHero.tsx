import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { Play, Pause, ChevronRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex, pickCtaButtonColors, getHeadingLetterSpacingClass } from "@/lib/brand-config";
import type { CinematicVideoHeroBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BrandLogo, brandHasLogo } from "@/components/BrandLogo";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";

interface Props {
  props: CinematicVideoHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: CinematicVideoHeroBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

/** Mockup serif headline fallback (Cinzel) + system tail. Used only when no
 *  per-block headline font is picked and the brand has no display font. */
const HEADLINE_FALLBACK = "'Cinzel', 'Cormorant Garamond', Georgia, serif";

export function BlockCinematicVideoHero({ props, brand, onCtaClick, onFieldChange, pageId, variantId }: Props) {
  const field = (key: keyof CinematicVideoHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  // ── Brand-driven colors. The mockup is a monochrome white-on-black
  // cinematic surface; its "accent" is white. All four are overridable. ──
  const accent = props.accentColor || "var(--brand-accent, #FFFFFF)";
  const bg = props.bgColor || "#000000";
  const text = props.textColor || "#FFFFFF";

  // ── Brand-driven fonts (mirror BlockMagazineHero lines 55-71). ──
  useBlockFonts(props.headlineFont, props.bodyFont);
  const headlineFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || HEADLINE_FALLBACK
    : `var(--brand-font-display, ${HEADLINE_FALLBACK})`;
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") ||
      "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)"
    : "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)";

  // ── Respect prefers-reduced-motion: pause/skip the video, show the poster. ──
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Layout: classic centered title card vs film-style lower-third. ──
  const lowerThird = (props.layout ?? "centered") === "lower-third";

  const overlay = props.overlayOpacity ?? 0.55;
  // Four-stop scrim derived from the mockup's linear scrim
  // (from-black/60 via-black/20 to-black/80) at the default 0.55 strength,
  // scaled by overlayOpacity. The extra ~78% stop deepens the lower third so
  // copy and CTAs always sit on the darkest band of the frame. Lower-third
  // layout leans harder on the floor stop.
  const stop = (f: number) => Math.min(1, overlay * f).toFixed(3);
  const scrimStyle: CSSProperties = {
    background: lowerThird
      ? `linear-gradient(to bottom, rgba(0,0,0,${stop(0.95)}) 0%, rgba(0,0,0,${stop(0.27)}) 38%, rgba(0,0,0,${stop(1.05)}) 72%, rgba(0,0,0,${stop(1.62)}) 100%)`
      : `linear-gradient(to bottom, rgba(0,0,0,${stop(1.0909)}) 0%, rgba(0,0,0,${stop(0.3636)}) 46%, rgba(0,0,0,${stop(0.9)}) 78%, rgba(0,0,0,${stop(1.4545)}) 100%)`,
  };
  // Elliptical vignette — pulls the eye to the title and keeps frame edges
  // from reading washed-out on bright footage.
  const vignetteStyle: CSSProperties = {
    background:
      "radial-gradient(ellipse 120% 90% at 50% 42%, transparent 36%, rgba(0,0,0,0.62) 100%)",
  };

  // ── Background-video play/pause affordance (a11y + focus-visible). ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPaused, setVideoPaused] = useState(false);
  const toggleVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setVideoPaused(false);
    } else {
      v.pause();
      setVideoPaused(true);
    }
  };

  // Surface-aware fill for the email-capture pill button (the only filled CTA
  // in this hero — the primary is a glass button). Runtime contrast-resolved.
  const surfaceHex = isValidHex(bg) ? bg : "#000000";
  const pillColors = pickCtaButtonColors(brand, surfaceHex);

  // ── CTA suite. ──
  const ctaStyle = props.ctaStyle ?? "buttons";
  const submitMode = props.submitMode ?? "navigate";
  const primaryAction = props.ctaAction || "url";
  const secondaryAction = props.ctaSecondaryAction || "video-modal";

  const [emailValue, setEmailValue] = useState("");
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  // Pass-through modal config props (shared between CTAs + email pill).
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

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailValue.trim();
    if (!trimmed) return;
    if (submitMode === "modal-form" || submitMode === "modal-chilipiper") {
      setEmailModalOpen(true);
      return;
    }
    const url = props.ctaUrl?.trim() ?? "";
    if (url.startsWith("#") && url.length > 1) {
      const target = document.getElementById(url.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    if (url && url !== "#") {
      try {
        const u = new URL(url, window.location.origin);
        u.searchParams.set("email", trimmed);
        window.location.assign(u.toString());
        return;
      } catch {
        // Fall through to host / modal fallbacks.
      }
    }
    if (onCtaClick) {
      onCtaClick();
      return;
    }
    setEmailModalOpen(true);
  };

  const primaryButton = (
    <CtaButton
      ctaAction={primaryAction}
      ctaUrl={props.ctaUrl}
      chilipiperUrl={props.chilipiperUrl}
      videoUrl={props.videoUrl}
      videoPosterUrl={props.backgroundImageUrl}
      {...modalCfg}
      onClick={primaryAction === "url" ? onCtaClick : undefined}
      className="glass-panel px-8 py-4 rounded-full text-sm tracking-widest uppercase hover:bg-white/10 transition-all flex items-center gap-3 group"
      style={{
        backgroundColor: props.ctaButtonColor || undefined,
        color: props.ctaButtonTextColor || text,
        fontFamily: bodyFamily,
      }}
      brand={brand}
      pageId={pageId}
      variantId={variantId}
      source="cinematic-video-hero-primary"
    >
      <InlineText as="span" value={props.ctaText} onUpdate={field("ctaText")} />
      <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
    </CtaButton>
  );

  const emailPill = (
    <form
      onSubmit={handleEmailSubmit}
      className="glass-panel flex items-center gap-1.5 rounded-full"
      style={{ padding: 6, width: "100%", maxWidth: 480 }}
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
          color: text,
          fontFamily: bodyFamily,
        }}
      />
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-full text-sm tracking-wide uppercase transition-opacity hover:opacity-90"
        style={{
          background: props.ctaButtonColor || pillColors.bg,
          color: props.ctaButtonTextColor || pillColors.text,
          padding: "0.75rem 1.5rem",
          border: "none",
          cursor: "pointer",
          whiteSpace: "nowrap",
          fontFamily: bodyFamily,
        }}
      >
        {props.emailCaptureButtonText || props.ctaText || "Get Started"}
      </button>
    </form>
  );

  const secondaryButton = (props.ctaSecondaryText || onFieldChange) ? (
    <CtaButton
      ctaAction={secondaryAction}
      ctaUrl={props.ctaSecondaryUrl}
      chilipiperUrl={props.secondaryChilipiperUrl}
      videoUrl={props.secondaryVideoUrl || props.videoUrl}
      videoPosterUrl={props.backgroundImageUrl}
      {...modalCfg}
      onClick={secondaryAction === "url" ? onCtaClick : undefined}
      className="flex items-center gap-3 text-sm tracking-widest uppercase transition-colors group bg-transparent"
      style={{ color: text, opacity: 0.7, fontFamily: bodyFamily }}
      brand={brand}
      pageId={pageId}
      variantId={variantId}
      source="cinematic-video-hero-secondary"
    >
      <span className="w-11 h-11 rounded-full border border-white/25 bg-white/5 backdrop-blur-md flex items-center justify-center group-hover:border-white/60 group-hover:bg-white/10 transition-colors">
        <Play className="w-3.5 h-3.5 ml-0.5" aria-hidden />
      </span>
      <InlineText as="span" value={props.ctaSecondaryText ?? "Watch Film"} onUpdate={field("ctaSecondaryText")} />
    </CtaButton>
  ) : null;

  const emailCaptureModalEl = (
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
      source="cinematic-video-hero"
      formSource={props.modalFormSource ?? "simple"}
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
    />
  );

  const showVideo = !!props.backgroundVideoUrl && !reducedMotion;

  return (
    <section
      className="cvh-root relative min-h-[100svh] w-full overflow-hidden flex flex-col selection:bg-white/20"
      style={{ backgroundColor: bg, color: text, fontFamily: bodyFamily }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .cvh-root .glass-panel {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .cvh-root .glass-button {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
        }
        .cvh-root .glass-button:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.4);
          transform: translateY(-1px);
        }
        .cvh-root .text-glow {
          text-shadow: 0 0 60px rgba(255, 255, 255, 0.22), 0 2px 28px rgba(0, 0, 0, 0.55);
        }
        .cvh-root a:focus-visible,
        .cvh-root button:focus-visible,
        .cvh-root input:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.9);
          outline-offset: 3px;
        }
      ` }} />

      {/* Background Video / poster / brand-gradient fallback */}
      <div className="absolute inset-0 z-0">
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            poster={props.backgroundImageUrl || undefined}
            className="w-full h-full object-cover opacity-80"
            src={props.backgroundVideoUrl}
          />
        ) : props.backgroundImageUrl ? (
          <InlineImage
            src={props.backgroundImageUrl}
            alt=""
            wrapperClassName="absolute inset-0"
            className="w-full h-full object-cover opacity-80"
            onUpdate={field("backgroundImageUrl")}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 32%, #000000) 0%, #000000 100%)` }}
          />
        )}
        {/* Scrims: directional gradient + elliptical vignette for legibility */}
        <div aria-hidden className="absolute inset-0 z-10" style={scrimStyle} />
        <div aria-hidden className="absolute inset-0 z-10" style={vignetteStyle} />
      </div>

      {/* Background-video play/pause (focus-visible affordance) */}
      {showVideo && (
        <button
          type="button"
          onClick={toggleVideo}
          aria-label={videoPaused ? "Play background video" : "Pause background video"}
          aria-pressed={videoPaused}
          className="absolute bottom-6 right-6 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/30 backdrop-blur-md transition-colors hover:border-white/50 hover:bg-black/50"
          style={{ color: text }}
        >
          {videoPaused ? (
            <Play className="w-4 h-4 ml-0.5" aria-hidden />
          ) : (
            <Pause className="w-4 h-4" aria-hidden />
          )}
        </button>
      )}

      {/* Top Nav */}
      {(props.showNav !== false) && (
        <header className="relative z-20 w-full px-8 py-6 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2"
          >
            {brandHasLogo(brand, props.logoImageUrl) ? (
              <BrandLogo
                brand={brand}
                url={props.logoImageUrl}
                tone="onDark"
                alt={props.logoText || brand.brandName || "Logo"}
                className="h-7 w-auto"
              />
            ) : (
              <>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ border: "1px solid rgba(255,255,255,0.5)" }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: text }} />
                </div>
                <InlineText
                  as="span"
                  value={props.logoText || brand.brandName || "AURA"}
                  onUpdate={field("logoText")}
                  className="text-xl tracking-widest font-semibold uppercase"
                  style={{ fontFamily: headlineFamily }}
                />
              </>
            )}
          </motion.div>

          <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="hidden md:flex items-center gap-10 text-sm tracking-wide"
            style={{ color: text, opacity: 0.7, fontFamily: bodyFamily }}
          >
            {(props.navLinks ?? []).map((link, i) => (
              <a key={i} href={link.url || "#"} className="hover:opacity-100 transition-colors" style={{ color: text }}>
                {link.label}
              </a>
            ))}
          </motion.nav>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="flex items-center gap-4"
          >
            {(props.navSignInText || onFieldChange) && (
              <a
                href={props.navSignInUrl || "#"}
                className="hidden md:block text-sm tracking-wide transition-colors uppercase px-4 py-2"
                style={{ color: text, opacity: 0.9, fontFamily: bodyFamily }}
              >
                <InlineText as="span" value={props.navSignInText ?? "Sign In"} onUpdate={field("navSignInText")} />
              </a>
            )}
            {(props.navCtaText || onFieldChange) && (
              <a
                href={props.navCtaUrl || "#"}
                className="glass-button px-6 py-2.5 rounded-full text-sm tracking-wide uppercase"
                style={{ color: text, fontFamily: bodyFamily }}
              >
                <InlineText as="span" value={props.navCtaText ?? "Request Access"} onUpdate={field("navCtaText")} />
              </a>
            )}
          </motion.div>
        </header>
      )}

      {/* Main Content */}
      <main
        className={
          lowerThird
            ? "relative z-20 flex-1 flex flex-col items-start justify-end text-left w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pb-24 md:pb-14"
            : "relative z-20 flex-1 flex flex-col items-center justify-center text-center px-4"
        }
      >
        {(props.eyebrow || onFieldChange) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className={lowerThird ? "mb-5 flex items-center gap-3" : "mb-6"}
          >
            {lowerThird && (
              <span
                className="inline-block h-px w-10 shrink-0"
                style={{ backgroundColor: accent, opacity: 0.7 }}
                aria-hidden
              />
            )}
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={field("eyebrow")}
              className="text-xs tracking-[0.3em] uppercase"
              style={{ color: accent, opacity: 0.75, fontFamily: bodyFamily }}
            />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          className={lowerThird ? "max-w-4xl" : "max-w-4xl mx-auto"}
        >
          <InlineText
            as="h1"
            value={props.headline}
            onUpdate={field("headline")}
            className={`mb-6 text-glow ${getHeadingLetterSpacingClass(brand)}`}
            style={{
              fontFamily: headlineFamily,
              fontSize: lowerThird
                ? "clamp(2.5rem, 5.5vw + 0.5rem, 5.25rem)"
                : "clamp(2.75rem, 6.5vw + 0.5rem, 6.5rem)",
              lineHeight: 1.06,
            }}
          />
        </motion.div>

        {(props.subheadline || onFieldChange) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.8 }}
            className={lowerThird ? "max-w-xl mb-9" : "max-w-xl mx-auto mb-11"}
          >
            <InlineText
              as="p"
              multiline
              value={props.subheadline ?? ""}
              onUpdate={field("subheadline")}
              className="text-lg md:text-xl leading-relaxed font-light tracking-wide"
              style={{ color: text, opacity: 0.66, fontFamily: bodyFamily }}
            />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 1 }}
          className={
            lowerThird
              ? "flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 w-full sm:w-auto"
              : "flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto justify-center"
          }
        >
          {ctaStyle === "email-capture" ? emailPill : primaryButton}
          {secondaryButton}
        </motion.div>
      </main>

      {/* Scroll Cue (centered layout only — the lower-third pins copy there) */}
      {!lowerThird && (props.scrollCueLabel || onFieldChange) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="relative z-20 pb-8 flex flex-col items-center justify-center gap-4"
        >
          <div className="w-[1px] h-16 bg-gradient-to-b from-white/0 via-white/20 to-white/0" />
          <InlineText
            as="span"
            value={props.scrollCueLabel ?? ""}
            onUpdate={field("scrollCueLabel")}
            className="text-xs tracking-[0.2em] uppercase"
            style={{ color: text, opacity: 0.4, fontFamily: bodyFamily }}
          />
        </motion.div>
      )}

      {emailCaptureModalEl}
    </section>
  );
}
