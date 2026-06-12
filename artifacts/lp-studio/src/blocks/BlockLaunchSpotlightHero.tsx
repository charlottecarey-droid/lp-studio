import { useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import {
  isValidHex,
  pickCtaButtonColors,
  pickOutlineButtonColors,
} from "@/lib/brand-config";
import type {
  CtaModalConfig,
  HeroCtaConfig,
  HeroBrandStyleConfig,
  SocialProofLogo,
} from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";

/**
 * Launch Spotlight Hero — dark-mode-first premium launch hero. A near-black
 * surface with a soft radial brand-accent glow, a pulsing announcement chip
 * ("Now live on Product Hunt"), an oversized clamp() display headline with an
 * optional gradient word, dual CTAs, a product screenshot in a glass frame
 * that tilts in 3D and settles flat on scroll, and a low-opacity trust-logo
 * row. Built for product launches and 2026-grade SaaS landing pages.
 *
 * Props interface is exported from this file (registration manifest) — the
 * wiring agent re-homes it into `@/lib/block-types` when registering.
 */
export interface LaunchSpotlightHeroBlockProps
  extends CtaModalConfig,
    HeroCtaConfig,
    HeroBrandStyleConfig {
  /** Small announcement chip above the headline, e.g. "Now live on Product Hunt". Empty hides it. */
  chipText?: string;
  /** Optional link target for the chip. Empty renders a non-link chip. */
  chipHref?: string;
  headline: string;
  /** Word (or phrase) inside the headline rendered with the accent gradient. */
  highlightWord?: string;
  subheadline?: string;
  /** Product screenshot shown in the glass frame. Empty renders a brand-gradient placeholder. */
  imageUrl?: string;
  imageAlt?: string;
  /** Render a browser-chrome topbar (traffic lights + URL pill) above the screenshot. Default true. */
  showBrowserChrome?: boolean;
  /** Faux URL shown in the browser-chrome pill. */
  browserUrl?: string;
  /** 4–6 small trust logos shown at low opacity below the screenshot. Name-only entries render as wordmarks. */
  logos?: SocialProofLogo[];
  /** Small label above the logo row, e.g. "Trusted by teams at". Empty hides the label. */
  logosLabel?: string;
}

interface Props {
  props: LaunchSpotlightHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: LaunchSpotlightHeroBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

/** Near-black launch surface (NOT pure #000 — keeps glow + glass legible). */
const SURFACE_HEX = "#060609";
const TEXT_HEX = "#FFFFFF";
const ACCENT_FALLBACK = "#8B5CF6";
const DISPLAY_FALLBACK = "'Inter', ui-sans-serif, system-ui, sans-serif";

const DEFAULT_LOGOS: SocialProofLogo[] = [
  { name: "Acme Corp" },
  { name: "Northwind" },
  { name: "Globex" },
  { name: "Initech" },
  { name: "Vertex" },
];

/** Render the headline with the accent-gradient word, when present. */
function renderHeadline(
  headline: string,
  highlightWord: string | undefined,
  gradientCss: string,
) {
  if (!highlightWord || !headline.includes(highlightWord)) {
    return <>{headline}</>;
  }
  const idx = headline.indexOf(highlightWord);
  const gradientStyle: CSSProperties = {
    color: "transparent",
    backgroundImage: gradientCss,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
  };
  return (
    <>
      {headline.slice(0, idx)}
      <span style={gradientStyle}>{highlightWord}</span>
      {headline.slice(idx + highlightWord.length)}
    </>
  );
}

export function BlockLaunchSpotlightHero({
  props,
  brand,
  onCtaClick,
  onFieldChange,
  pageId,
  variantId,
}: Props) {
  const field = (key: keyof LaunchSpotlightHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const isEditor = !!onFieldChange;
  const prefersReducedMotion = useReducedMotion();

  // ── Brand vars (colors + fonts) ───────────────────────────────
  const accent = props.accentColor || `var(--brand-accent, ${ACCENT_FALLBACK})`;
  const bg = props.bgColor || SURFACE_HEX;
  const text = props.textColor || TEXT_HEX;
  // Concrete surface hex for the runtime contrast helpers.
  const surfaceHex = isValidHex(bg) ? bg : SURFACE_HEX;

  useBlockFonts(props.headlineFont, props.bodyFont);
  const headlineFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || DISPLAY_FALLBACK
    : `var(--brand-font-display, ${DISPLAY_FALLBACK})`;
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") ||
      "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)"
    : "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)";

  // Luminous gradient for the highlight word — anchored to white so it stays
  // legible on the dark surface regardless of how dark the brand accent is.
  const gradientCss = `linear-gradient(105deg, ${text} 0%, color-mix(in srgb, ${accent} 60%, ${text}) 45%, color-mix(in srgb, ${accent} 90%, ${text}) 100%)`;

  // ── CTA colors (runtime-resolved against THIS section's surface) ──
  const picked = pickCtaButtonColors(brand, surfaceHex);
  const primaryBg = props.ctaButtonColor || picked.bg;
  const primaryText = props.ctaButtonTextColor || picked.text;
  const outline = pickOutlineButtonColors(brand, surfaceHex);

  // ── Entrance variants (reduced motion → opacity-only) ────────
  const rise = (px: number) => (prefersReducedMotion ? 0 : px);
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
  };
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: rise(24) },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  };

  // ── Glass frame: perspective tilt that settles flat on scroll. ──
  // Reduced motion: static flat (the transform stays at 0).
  const frameRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: frameRef,
    offset: ["start end", "start 0.4"],
  });
  const tiltX = useTransform(scrollYProgress, [0, 1], [10, 0]);
  const frameMotionStyle = prefersReducedMotion
    ? { rotateX: 0 }
    : { rotateX: tiltX };

  // ── Modal config pass-through (shared by primary + secondary CTAs) ──
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

  // ── Email-capture pill state (mirrors spotlight-glow / aurora heroes) ──
  const [emailValue, setEmailValue] = useState("");
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const submitMode = props.submitMode ?? "navigate";

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
        /* fall through */
      }
    }
    const brandDefault = brand?.defaultCtaUrl?.trim();
    const brandHasDefault = !!(brandDefault && brandDefault !== "#" && !brandDefault.startsWith("#"));
    if (onCtaClick && (brandHasDefault || !!brand?.chilipiperUrl)) {
      onCtaClick();
      return;
    }
    setEmailModalOpen(true);
  };

  // ── Resolved content (confident generic-SaaS defaults) ───────
  const chipText = props.chipText ?? "Now live on Product Hunt";
  const headline = props.headline || "The fastest way to ship beautiful products";
  const highlightWord = props.highlightWord ?? "beautiful";
  const subheadline =
    props.subheadline ??
    "One platform to design, build, and launch — without the handoffs. Join the teams who refuse to ship slow.";
  const ctaText = props.ctaText || "Start for free";
  const ctaStyle = props.ctaStyle ?? "buttons";
  const showChrome = props.showBrowserChrome !== false;
  const browserUrl = props.browserUrl ?? "app.yourproduct.com";
  const logos = props.logos && props.logos.length > 0 ? props.logos : DEFAULT_LOGOS;
  const logosLabel = props.logosLabel ?? "Trusted by teams at";

  return (
    <section
      className="lsh-hero relative overflow-hidden"
      style={{ backgroundColor: bg, color: text, fontFamily: bodyFamily }}
    >
      <style>{`
        .lsh-hero { isolation: isolate; }
        .lsh-glow {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 70% 55% at 50% -8%, var(--lsh-glow-strong), transparent 70%),
            radial-gradient(ellipse 90% 60% at 50% 110%, var(--lsh-glow-soft), transparent 65%);
        }
        @keyframes lsh-chip-pulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--lsh-pulse); }
          70% { box-shadow: 0 0 0 6px transparent; }
        }
        .lsh-chip-dot { animation: lsh-chip-pulse 2.4s ease-out infinite; }
        .lsh-frame-glass {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow:
            0 40px 80px -24px rgba(0, 0, 0, 0.65),
            0 0 60px -12px var(--lsh-frame-glow),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
        .lsh-cta:focus-visible, .lsh-hero a:focus-visible, .lsh-hero button:focus-visible {
          outline: 2px solid var(--lsh-focus);
          outline-offset: 3px;
        }
        @media (prefers-reduced-motion: reduce) {
          .lsh-chip-dot { animation: none; }
        }
      `}</style>

      <div
        className="lsh-glow"
        aria-hidden
        style={
          {
            "--lsh-glow-strong": `color-mix(in srgb, ${accent} 22%, transparent)`,
            "--lsh-glow-soft": `color-mix(in srgb, ${accent} 10%, transparent)`,
          } as CSSProperties
        }
      />

      <motion.div
        className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8 pt-20 md:pt-28 pb-16 md:pb-24 flex flex-col items-center text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ "--lsh-focus": `color-mix(in srgb, ${accent} 70%, ${text})` } as CSSProperties}
      >
        {/* ── Announcement chip ── */}
        {(chipText || isEditor) && (
          <motion.div variants={itemVariants} className="mb-8">
            {(() => {
              const chipInner = (
                <>
                  <span
                    className="lsh-chip-dot inline-block h-2 w-2 rounded-full shrink-0"
                    aria-hidden
                    style={
                      {
                        backgroundColor: accent,
                        "--lsh-pulse": `color-mix(in srgb, ${accent} 55%, transparent)`,
                      } as CSSProperties
                    }
                  />
                  <InlineText as="span" value={chipText} onUpdate={field("chipText")} />
                  {props.chipHref ? <ArrowRight className="w-3.5 h-3.5 opacity-70" aria-hidden /> : null}
                </>
              );
              const chipClass =
                "inline-flex min-h-[36px] items-center gap-2.5 rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur-md transition-colors";
              const chipStyle: CSSProperties = {
                borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
                color: `color-mix(in srgb, ${accent} 40%, ${text})`,
              };
              return props.chipHref && !isEditor ? (
                <a href={props.chipHref} className={chipClass} style={chipStyle}>
                  {chipInner}
                </a>
              ) : (
                <div className={chipClass} style={chipStyle}>
                  {chipInner}
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* ── Headline ── */}
        <motion.h1
          variants={itemVariants}
          className="mb-6 max-w-5xl font-bold tracking-[-0.03em]"
          style={{
            fontFamily: headlineFamily,
            color: text,
            fontSize: "clamp(2.75rem, 7.5vw, 6rem)",
            lineHeight: 1.02,
          }}
        >
          {isEditor ? (
            <InlineText as="span" value={headline} onUpdate={field("headline")} />
          ) : (
            renderHeadline(headline, highlightWord, gradientCss)
          )}
        </motion.h1>

        {/* ── Subheadline ── */}
        {(subheadline || isEditor) && (
          <motion.div variants={itemVariants} className="w-full flex justify-center">
            <InlineText
              as="p"
              multiline
              value={subheadline}
              onUpdate={field("subheadline")}
              className="mb-10 max-w-2xl text-lg md:text-xl leading-relaxed"
              style={{ color: text, opacity: 0.62 }}
            />
          </motion.div>
        )}

        {/* ── CTAs ── */}
        <motion.div
          variants={itemVariants}
          className="mb-16 md:mb-20 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row"
        >
          {ctaStyle === "email-capture" ? (
            <form
              onSubmit={handleEmailSubmit}
              className="flex w-full max-w-[440px] items-center gap-1.5 rounded-full bg-white p-1.5"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.35)" }}
            >
              <input
                type="email"
                required
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                placeholder={props.emailCapturePlaceholder || "Email address"}
                aria-label={props.emailCapturePlaceholder || "Email address"}
                className="min-w-0 flex-1 border-none bg-transparent px-4 py-3 text-sm outline-none"
                style={{ color: "#0A0A0A", fontFamily: "inherit" }}
              />
              <button
                type="submit"
                className="lsh-cta inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: primaryBg, color: primaryText }}
              >
                {props.emailCaptureButtonText || ctaText}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </form>
          ) : (
            <>
              <CtaButton
                ctaAction={props.ctaAction || "url"}
                ctaUrl={props.ctaUrl}
                chilipiperUrl={props.chilipiperUrl}
                videoUrl={props.videoUrl}
                {...modalCfg}
                onClick={(props.ctaAction || "url") === "url" ? onCtaClick : undefined}
                brand={brand}
                pageId={pageId}
                variantId={variantId}
                source="launch-spotlight-hero-primary"
                className="lsh-cta flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold transition-transform sm:w-auto"
                style={{
                  backgroundColor: primaryBg,
                  color: primaryText,
                  boxShadow: `0 0 28px color-mix(in srgb, ${primaryBg} 45%, transparent)`,
                }}
              >
                <InlineText as="span" value={ctaText} onUpdate={field("ctaText")} />
                <ArrowRight className="h-5 w-5" aria-hidden />
              </CtaButton>

              {(props.ctaSecondaryText || isEditor) && (
                <CtaButton
                  ctaAction={props.ctaSecondaryAction || "url"}
                  ctaUrl={props.ctaSecondaryUrl}
                  chilipiperUrl={props.secondaryChilipiperUrl}
                  videoUrl={props.secondaryVideoUrl}
                  {...modalCfg}
                  onClick={(props.ctaSecondaryAction || "url") === "url" ? onCtaClick : undefined}
                  brand={brand}
                  pageId={pageId}
                  variantId={variantId}
                  source="launch-spotlight-hero-secondary"
                  className="lsh-cta flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border bg-transparent px-8 py-3.5 text-base font-semibold transition-colors hover:bg-white/5 sm:w-auto"
                  style={{ borderColor: outline.border, color: outline.text }}
                >
                  <InlineText
                    as="span"
                    value={props.ctaSecondaryText || "Watch the demo"}
                    onUpdate={field("ctaSecondaryText")}
                  />
                </CtaButton>
              )}
            </>
          )}
        </motion.div>

        {/* ── Product screenshot in a glass frame (tilts flat on scroll) ── */}
        <motion.div
          variants={itemVariants}
          className="w-full max-w-4xl"
          style={{ perspective: 1400 }}
        >
          <motion.div
            ref={frameRef}
            className="lsh-frame-glass overflow-hidden rounded-2xl"
            style={
              {
                ...frameMotionStyle,
                transformStyle: "preserve-3d",
                "--lsh-frame-glow": `color-mix(in srgb, ${accent} 30%, transparent)`,
              } as never
            }
          >
            {showChrome && (
              <div
                className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5"
                aria-hidden
              >
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="mx-auto flex h-6 max-w-[60%] flex-1 items-center justify-center truncate rounded-md bg-white/5 px-3 text-[11px] text-white/40">
                  {browserUrl}
                </span>
                <span className="w-12" />
              </div>
            )}
            <div className="relative aspect-[16/9] w-full" style={{ backgroundColor: SURFACE_HEX }}>
              {props.imageUrl || isEditor ? (
                <InlineImage
                  src={props.imageUrl ?? ""}
                  alt={props.imageAlt || "Product screenshot"}
                  wrapperClassName="block w-full h-full"
                  className="h-full w-full object-cover object-top"
                  onUpdate={field("imageUrl")}
                  onAltUpdate={field("imageAlt")}
                />
              ) : (
                <div
                  className="h-full w-full"
                  aria-hidden
                  style={{
                    backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${accent} 35%, transparent), transparent 55%), linear-gradient(to top right, color-mix(in srgb, var(--brand-primary, #3b82f6) 25%, transparent), transparent)`,
                  }}
                />
              )}
            </div>
          </motion.div>
        </motion.div>

        {/* ── Trust logos ── */}
        {logos.length > 0 && (
          <motion.div variants={itemVariants} className="mt-14 w-full" aria-label={logosLabel || "Trusted by"}>
            {logosLabel && (
              <p
                className="mb-5 text-xs font-medium uppercase tracking-[0.18em]"
                style={{ color: text, opacity: 0.4 }}
              >
                {logosLabel}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
              {logos.slice(0, 6).map((logo, i) =>
                logo.imageUrl ? (
                  <img
                    key={i}
                    src={logo.imageUrl}
                    alt={logo.name}
                    className="h-6 w-auto opacity-40 grayscale"
                    loading="lazy"
                  />
                ) : (
                  <span
                    key={i}
                    className="text-sm font-semibold tracking-wide"
                    style={{ color: text, opacity: 0.38, fontFamily: headlineFamily }}
                  >
                    {logo.name}
                  </span>
                ),
              )}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Shared email-capture modal (email-capture pill modal modes). */}
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
        source="launch-spotlight-hero"
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
