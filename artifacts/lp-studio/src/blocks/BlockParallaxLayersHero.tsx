import { Fragment, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from "framer-motion";
import { ArrowRight, Menu } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { ParallaxLayersHeroBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BrandLogo, brandHasLogo } from "@/components/BrandLogo";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { pickCtaButtonColors } from "@/lib/brand-config";

interface Props {
  props: ParallaxLayersHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ParallaxLayersHeroBlockProps) => void;
  pageId?: number;
  variantId?: number;
  /** When true (builder canvas), render the nav in-flow (relative, no
   *  sticky/high z-index) so it doesn't pin over the builder chrome while
   *  scrolling. Published/preview keeps the sticky behaviour. */
  isBuilder?: boolean;
}

/** Mockup surface / ink defaults (dark hero). */
const SURFACE = "#050505";
const INK = "#FFFFFF";
const MOCKUP_ACCENT = "#6366F1"; // indigo-500 dot / accent glow in the mockup

const DEFAULT_NAV_LINKS = [
  { label: "Products", url: "#" },
  { label: "Solutions", url: "#" },
  { label: "Resources", url: "#" },
  { label: "Pricing", url: "#" },
];

const DEFAULT_MARQUEE_LOGOS = ["LUMINA", "NEXUS", "ELEVATE", "SYNTH", "VERTEX"];

export function BlockParallaxLayersHero({ props, brand, onCtaClick, onFieldChange, pageId, variantId, isBuilder }: Props) {
  const field = (key: keyof ParallaxLayersHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  // ── Brand-driven colors ───────────────────────────────────────────────
  const accent = props.accentColor || `var(--brand-accent, ${MOCKUP_ACCENT})`;
  const bg = props.bgColor || SURFACE;
  const text = props.textColor || INK;
  // Second layered glow hue. Reads the brand primary so the depth layers stay
  // brand-derived; neutral blue last-resort when no brand var is set.
  const accent2 = "var(--brand-primary, #3B82F6)";

  // ── Brand-driven fonts ────────────────────────────────────────────────
  useBlockFonts(props.headlineFont, props.bodyFont);
  const headlineFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || "var(--brand-font-display, ui-sans-serif, system-ui, sans-serif)"
    : "var(--brand-font-display, ui-sans-serif, system-ui, sans-serif)";
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") ||
      "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)"
    : "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)";

  // ── Parallax (scroll + mouse) ─────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    setMousePosition({
      x: (clientX / innerWidth - 0.5) * 2,
      y: (clientY / innerHeight - 0.5) * 2,
    });
  };

  // parallaxStrength defaults to 0.5 — which maps to the mockup's baseline
  // offsets. We scale the mockup ranges by (strength / 0.5) so 0.5 == mockup.
  // Reduced motion zeroes every scroll/mouse parallax offset so the layers
  // render in their static resting positions.
  const prefersReducedMotion = useReducedMotion();
  const strength = props.parallaxStrength ?? 0.5;
  const mult = prefersReducedMotion ? 0 : strength / 0.5;

  const yBg = useTransform(scrollYProgress, [0, 1], [0, 200 * mult]);
  const yMid = useTransform(scrollYProgress, [0, 1], [0, -100 * mult]);
  const yFront = useTransform(scrollYProgress, [0, 1], [0, -300 * mult]);
  const opacityFade = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const springConfig = { stiffness: 50, damping: 20 };
  const mouseX = useSpring(mousePosition.x, springConfig);
  const mouseY = useSpring(mousePosition.y, springConfig);

  const xBgMouse = useTransform(mouseX, [-1, 1], [-15 * mult, 15 * mult]);
  const yBgMouse = useTransform(mouseY, [-1, 1], [-15 * mult, 15 * mult]);
  const xMidMouse = useTransform(mouseX, [-1, 1], [-40 * mult, 40 * mult]);
  const yMidMouse = useTransform(mouseY, [-1, 1], [-40 * mult, 40 * mult]);
  const xFrontMouse = useTransform(mouseX, [-1, 1], [-90 * mult, 90 * mult]);
  const yFrontMouse = useTransform(mouseY, [-1, 1], [-90 * mult, 90 * mult]);

  // ── CTA suite ─────────────────────────────────────────────────────────
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const ctaStyle = props.ctaStyle ?? "buttons";
  const submitMode = props.submitMode ?? "navigate";

  const primaryAction: "url" | "chilipiper" | "modal-form" | "modal-chilipiper" | "video-modal" =
    props.ctaAction === "chilipiper" ||
    props.ctaAction === "modal-form" ||
    props.ctaAction === "modal-chilipiper" ||
    props.ctaAction === "video-modal"
      ? props.ctaAction
      : "url";
  const secondaryAction: "url" | "chilipiper" | "modal-form" | "modal-chilipiper" | "video-modal" =
    props.ctaSecondaryAction === "chilipiper" ||
    props.ctaSecondaryAction === "modal-form" ||
    props.ctaSecondaryAction === "modal-chilipiper" ||
    props.ctaSecondaryAction === "video-modal"
      ? props.ctaSecondaryAction
      : "url";

  // Pass-through modal config props (shared between primary + secondary CTAs).
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

  // Surface-aware primary CTA fill (the hero surface is near-black, so the
  // default ink button would be invisible). Honors per-block overrides first.
  const ctaColors = pickCtaButtonColors(brand, SURFACE);
  const primaryBg = props.ctaButtonColor || ctaColors.bg;
  const primaryText = props.ctaButtonTextColor || ctaColors.text;

  // Email-capture submit. Mirrors BlockDsoHeartlandHero: explicit modal modes
  // open the modal; "navigate" appends ?email=… to the configured ctaUrl.
  const handleEmailSubmit = (e: React.FormEvent) => {
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
        // Fall through.
      }
    }
    if (onCtaClick) {
      onCtaClick();
      return;
    }
    setEmailModalOpen(true);
  };

  const emailCaptureForm = (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.5 }}
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
          boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
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
            color: "#0A0A0A",
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-full font-semibold text-lg transition-transform hover:scale-105"
          style={{
            background: primaryBg,
            color: primaryText,
            padding: "0.75rem 1.5rem",
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {props.emailCaptureButtonText || props.ctaText || "Get Started"}
          <ArrowRight size={20} />
        </button>
      </form>
    </motion.div>
  );

  const ctaButtons = (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.5 }}
      className="flex flex-col sm:flex-row items-center gap-4"
    >
      <CtaButton
        ctaAction={primaryAction}
        ctaUrl={props.ctaUrl}
        chilipiperUrl={props.chilipiperUrl}
        videoUrl={props.videoUrl}
        {...modalCfg}
        onClick={primaryAction === "url" ? onCtaClick : undefined}
        className="w-full sm:w-auto min-h-[52px] px-8 py-4 rounded-full font-semibold text-base flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
        style={{
          background: primaryBg,
          color: primaryText,
          boxShadow: `0 0 32px color-mix(in srgb, ${primaryBg} 38%, transparent), 0 10px 28px -14px rgba(0,0,0,0.7)`,
        }}
        brand={brand}
        pageId={pageId}
        variantId={variantId}
        source="parallax-layers-hero-primary"
        modalTheme="dark"
      >
        <InlineText as="span" value={props.ctaText} onUpdate={field("ctaText")} />
        <ArrowRight size={20} />
      </CtaButton>

      {(props.ctaSecondaryText || onFieldChange) && (
        <CtaButton
          ctaAction={secondaryAction}
          ctaUrl={props.ctaSecondaryUrl}
          chilipiperUrl={props.secondaryChilipiperUrl}
          videoUrl={props.secondaryVideoUrl}
          {...modalCfg}
          className="w-full sm:w-auto min-h-[52px] px-8 py-4 rounded-full font-semibold text-base border backdrop-blur-md transition-colors hover:bg-white/10"
          style={{
            background: "rgba(255,255,255,0.05)",
            color: text,
            borderColor: "rgba(255,255,255,0.15)",
          }}
          brand={brand}
          pageId={pageId}
          variantId={variantId}
          source="parallax-layers-hero-secondary"
          modalTheme="dark"
        >
          <InlineText as="span" value={props.ctaSecondaryText ?? ""} onUpdate={field("ctaSecondaryText")} />
        </CtaButton>
      )}
    </motion.div>
  );

  // ── Headline gradient (white → 58% white, clipped to text) + display
  // scale: clamp()'d size with tight tracking so the type reads engineered
  // rather than just enlarged. ─────
  const headlineStyle: CSSProperties = {
    fontFamily: headlineFamily,
    fontSize: "clamp(3rem, 7.5vw, 6.5rem)",
    lineHeight: 1.02,
    letterSpacing: "-0.03em",
    backgroundImage: `linear-gradient(180deg, ${text} 0%, color-mix(in srgb, ${text} 58%, transparent) 100%)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  };

  // ── Nav ────────────────────────────────────────────────────────────────
  const navLinks = props.navLinks && props.navLinks.length > 0 ? props.navLinks : DEFAULT_NAV_LINKS;
  const logoLabel = props.logoText || brand.brandName || "AURA";

  // ── Marquee ─────────────────────────────────────────────────────────────
  const marqueeLogos = props.marqueeLogos && props.marqueeLogos.length > 0 ? props.marqueeLogos : DEFAULT_MARQUEE_LOGOS;

  // Orb fallback with a proper highlight→falloff so depth reads as a lit
  // sphere rather than a flat glow smear.
  const shapeFallback = (extraClass: string) => (
    <div
      className={`${extraClass} rounded-full`}
      style={{
        background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${accent} 80%, #ffffff) 0%, color-mix(in srgb, ${accent} 55%, transparent) 38%, transparent 72%)`,
        opacity: 0.55,
      }}
    />
  );

  return (
    <div
      ref={containerRef}
      className="plx-hero-root relative min-h-[120vh] overflow-hidden"
      style={{ backgroundColor: bg, color: text, fontFamily: bodyFamily }}
      onMouseMove={handleMouseMove}
    >
      <style>{`
        .plx-glass-nav {
          background: rgba(10, 10, 11, 0.5);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .plx-marquee-container {
          display: flex;
          overflow: hidden;
          user-select: none;
          -webkit-mask-image: linear-gradient(to right, hsl(0 0% 0% / 0), hsl(0 0% 0% / 1) 10%, hsl(0 0% 0% / 1) 90%, hsl(0 0% 0% / 0));
          mask-image: linear-gradient(to right, hsl(0 0% 0% / 0), hsl(0 0% 0% / 1) 10%, hsl(0 0% 0% / 1) 90%, hsl(0 0% 0% / 0));
        }
        .plx-marquee-content {
          flex-shrink: 0;
          display: flex;
          justify-content: space-around;
          min-width: 100%;
          gap: 2rem;
          animation: plxScrollX 30s linear infinite;
        }
        @keyframes plxScrollX {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .plx-marquee-content { animation: none; }
        }
        .plx-hero-root a:focus-visible,
        .plx-hero-root button:focus-visible,
        .plx-hero-root input:focus-visible {
          outline: 2px solid color-mix(in srgb, ${accent} 60%, #ffffff);
          outline-offset: 3px;
        }
      `}</style>

      {/* Static depth bed: crown wash + floor vignette grounding the layers */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        aria-hidden
        style={{
          background: `radial-gradient(ellipse 90% 55% at 50% -10%, color-mix(in srgb, ${accent} 10%, transparent), transparent 62%), linear-gradient(to bottom, transparent 60%, color-mix(in srgb, ${bg} 70%, transparent) 100%)`,
        }}
      />

      {/* Background Layer: Deep Glows (most blur, least travel = farthest) */}
      <motion.div className="absolute inset-0 z-0 pointer-events-none" style={{ y: yBg, x: xBgMouse, translateY: yBgMouse }}>
        <div
          className="absolute top-[20%] left-[20%] w-[600px] h-[600px] rounded-full blur-[130px]"
          style={{ background: accent, opacity: 0.16 }}
        />
        <div
          className="absolute top-[40%] right-[10%] w-[500px] h-[500px] rounded-full blur-[110px]"
          style={{ background: accent2, opacity: 0.16 }}
        />
      </motion.div>

      {/* Midground Layer: Geometric Shapes */}
      <motion.div className="absolute inset-0 z-10 pointer-events-none" style={{ y: yMid, x: xMidMouse, translateY: yMidMouse }}>
        {props.shapeImage1Url ? (
          <InlineImage
            src={props.shapeImage1Url}
            alt="Abstract shape"
            wrapperClassName="absolute top-[15%] left-[10%] pointer-events-auto"
            className="w-64 h-64 object-contain opacity-80 drop-shadow-[0_28px_40px_rgba(0,0,0,0.45)]"
            onUpdate={field("shapeImage1Url")}
          />
        ) : (
          <div className="absolute top-[15%] left-[10%] w-64 h-64">{shapeFallback("w-64 h-64")}</div>
        )}
        {props.shapeImage2Url ? (
          <InlineImage
            src={props.shapeImage2Url}
            alt="Abstract shape"
            wrapperClassName="absolute top-[60%] right-[5%] pointer-events-auto"
            className="w-80 h-80 object-contain opacity-80 drop-shadow-[0_28px_40px_rgba(0,0,0,0.45)]"
            onUpdate={field("shapeImage2Url")}
          />
        ) : (
          <div className="absolute top-[60%] right-[5%] w-80 h-80">{shapeFallback("w-80 h-80")}</div>
        )}
      </motion.div>

      {/* Foreground Layer: Content */}
      <div className="relative z-20 flex flex-col h-[100vh]">
        {/* Navigation */}
        {props.showNav !== false && (
          <header className={`plx-glass-nav w-full px-8 py-4 flex items-center justify-between ${isBuilder ? "relative z-auto" : "sticky top-0 z-50"}`}>
            <div className="flex items-center gap-2">
              {brandHasLogo(brand, props.logoImageUrl) ? (
                <BrandLogo brand={brand} url={props.logoImageUrl} tone="onDark" alt={logoLabel} className="h-8 w-auto" />
              ) : (
                <>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xl tracking-tighter"
                    style={{ background: text, color: bg }}
                  >
                    {logoLabel.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold text-xl tracking-tight" style={{ color: text }}>
                    <InlineText as="span" value={props.logoText ?? logoLabel} onUpdate={field("logoText")} />
                  </span>
                </>
              )}
            </div>
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: "rgba(255,255,255,0.70)" }}>
              {navLinks.map((link, i) => (
                <a key={i} href={link.url || "#"} className="hover:text-white transition-colors">
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-4">
              {(props.navSignInText || onFieldChange) && (
                <a
                  href={props.navSignInUrl || "#"}
                  className="hidden md:block text-sm font-medium transition-colors hover:text-white"
                  style={{ color: "rgba(255,255,255,0.70)" }}
                >
                  {props.navSignInText || "Log in"}
                </a>
              )}
              <a
                href={props.navCtaUrl || "#"}
                className="px-4 py-2 rounded-full text-sm font-semibold transition-colors hover:opacity-90"
                style={{ background: text, color: bg }}
              >
                {props.navCtaText || "Get Started"}
              </a>
              <button className="md:hidden" style={{ color: text }} aria-label="Open menu">
                <Menu size={24} />
              </button>
            </div>
          </header>
        )}

        {/* Hero Content */}
        <motion.main
          className="flex-1 flex flex-col items-center justify-center text-center px-4 max-w-5xl mx-auto"
          style={{ opacity: prefersReducedMotion ? 1 : opacityFade }}
        >
          {(props.badgeText || onFieldChange) && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="inline-flex min-h-[36px] items-center gap-2.5 px-4 py-1.5 rounded-full text-sm font-medium backdrop-blur-md mb-8"
              style={{
                background: `color-mix(in srgb, ${accent} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
              }}
            >
              <span className="flex h-2 w-2 rounded-full shrink-0" style={{ background: accent }} aria-hidden />
              <span style={{ color: "rgba(255,255,255,0.85)" }}>
                <InlineText as="span" value={props.badgeText ?? ""} onUpdate={field("badgeText")} />
              </span>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="font-bold mb-6"
          >
            <InlineText as="h1" multiline value={props.headline} onUpdate={field("headline")} style={headlineStyle} />
          </motion.div>

          {(props.subheadline || onFieldChange) && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg md:text-xl leading-relaxed mb-10 max-w-2xl"
              style={{ color: "rgba(255,255,255,0.64)" }}
            >
              <InlineText as="p" multiline value={props.subheadline ?? ""} onUpdate={field("subheadline")} />
            </motion.div>
          )}

          {ctaStyle === "email-capture" ? emailCaptureForm : ctaButtons}
        </motion.main>

        {/* Marquee Band */}
        {props.showMarquee !== false && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="w-full pb-12"
          >
            {(props.marqueeLabel || onFieldChange) && (
              <p
                className="text-center text-xs mb-6 uppercase tracking-[0.22em] font-semibold"
                style={{ color: "rgba(255,255,255,0.40)" }}
              >
                <InlineText as="span" value={props.marqueeLabel ?? "Trusted by visionary teams"} onUpdate={field("marqueeLabel")} />
              </p>
            )}
            <div className="plx-marquee-container">
              <div className="plx-marquee-content">
                {[...Array(6)].map((_, i) => (
                  <Fragment key={i}>
                    {marqueeLogos.map((logo, j) => (
                      <span
                        key={j}
                        className="flex items-center gap-8 whitespace-nowrap text-base md:text-lg font-semibold uppercase tracking-[0.16em]"
                        style={{ color: "rgba(255,255,255,0.35)" }}
                      >
                        {logo}
                        <span
                          className="inline-block h-1 w-1 rounded-full"
                          style={{ background: `color-mix(in srgb, ${accent} 70%, transparent)` }}
                          aria-hidden
                        />
                      </span>
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Ultra Foreground Layer: Fast floating elements */}
      <motion.div className="absolute inset-0 z-30 pointer-events-none" style={{ y: yFront, x: xFrontMouse, translateY: yFrontMouse }}>
        {props.shapeImage3Url ? (
          <InlineImage
            src={props.shapeImage3Url}
            alt="Floating shape"
            wrapperClassName="absolute top-[80%] left-[20%] pointer-events-auto"
            className="w-48 h-48 object-contain opacity-90 blur-[1px] drop-shadow-[0_36px_48px_rgba(0,0,0,0.55)]"
            onUpdate={field("shapeImage3Url")}
          />
        ) : (
          <div className="absolute top-[80%] left-[20%] w-48 h-48 blur-[1px]">{shapeFallback("w-48 h-48")}</div>
        )}
        <div className="absolute top-[30%] right-[25%] w-3 h-3 rounded-full bg-white/90 shadow-[0_0_24px_8px_rgba(255,255,255,0.35)]" />
        <div
          className="absolute top-[70%] left-[40%] w-2.5 h-2.5 rounded-full"
          style={{ background: accent, boxShadow: `0 0 18px 5px color-mix(in srgb, ${accent} 45%, transparent)` }}
        />
      </motion.div>

      {/* Shared email-capture modal (only used in email-capture style). */}
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
        source="parallax-layers-hero"
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
    </div>
  );
}
