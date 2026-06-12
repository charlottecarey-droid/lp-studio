import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Activity,
  Shield,
  Zap,
  ChevronRight,
  Star,
  Globe,
  Lock,
  Rocket,
  Cpu,
  Cloud,
  BarChart3,
  Users,
  Heart,
  CheckCircle2,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import type { AuroraGradientHeroBlockProps, AuroraHeroChip } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BrandLogo, brandHasLogo } from "@/components/BrandLogo";
import { CtaButton } from "@/components/CtaButton";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { pickCtaButtonColors, resolveBrandColor } from "@/lib/brand-config";

interface Props {
  props: AuroraGradientHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: AuroraGradientHeroBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

/** Mockup surface / text hexes preserved as defaults. */
const SURFACE_HEX = "#050505";
const TEXT_HEX = "#FFFFFF";
/** Last-resort accent when the tenant brand exposes no --brand-accent var.
 *  Matches the launch-hero fallback so un-themed previews stay consistent. */
const ACCENT_HEX = "#8B5CF6";

const FALLBACK_DISPLAY = "'Inter', system-ui, sans-serif";

/** Curated lucide set for prop-driven chip icons. */
const CHIP_ICONS: Record<string, LucideIcon> = {
  Activity,
  Shield,
  Sparkles,
  Zap,
  Star,
  Globe,
  Lock,
  Rocket,
  Cpu,
  Cloud,
  BarChart3,
  Users,
  Heart,
  CheckCircle2,
  Gauge,
};

function resolveIcon(name?: string): LucideIcon {
  if (name && CHIP_ICONS[name]) return CHIP_ICONS[name];
  return Activity;
}

const DEFAULT_CHIPS: AuroraHeroChip[] = [
  { icon: "Activity", title: "Real-time sync", subtitle: "99.9% uptime SLA" },
  { icon: "Shield", title: "Enterprise security", subtitle: "SOC2 Type II certified" },
];

export function BlockAuroraGradientHero({ props, brand, onCtaClick, onFieldChange, pageId, variantId }: Props) {
  const field = (key: keyof AuroraGradientHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  // ── Brand-driven colors. The mockup layered a purple accent over a blue
  // secondary hue, so the second blob colors read var(--brand-primary). ──
  const accent = props.accentColor || `var(--brand-accent, ${ACCENT_HEX})`;
  const secondHue = "var(--brand-primary, #3B82F6)";
  const bg = props.bgColor || SURFACE_HEX;
  const text = props.textColor || TEXT_HEX;
  // Real hex passed to pickCtaButtonColors (it needs a concrete surface).
  const surfaceHex = props.bgColor || SURFACE_HEX;

  // ── Fonts (mirror BlockMagazineHero lines 55-71). ──
  useBlockFonts(props.headlineFont, props.bodyFont);
  const headlineFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || FALLBACK_DISPLAY
    : `var(--brand-font-display, ${FALLBACK_DISPLAY})`;
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") ||
      "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)"
    : "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)";

  // ── Entry / float animation variants (preserved from mockup). When the
  // visitor prefers reduced motion the continuous chip float is replaced by
  // its static resting state (the aurora blob keyframes are stopped via the
  // prefers-reduced-motion media query in the inline <style> below). ──
  const prefersReducedMotion = useReducedMotion();
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
  };
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 100, damping: 20 },
    },
  };
  const floatVariants: Variants = prefersReducedMotion
    ? { initial: { y: 0 }, animate: { y: 0 } }
    : {
        initial: { y: 0 },
        animate: {
          y: [-10, 10, -10],
          transition: { duration: 6, repeat: Infinity, ease: "easeInOut" },
        },
      };

  // ── CTA config / colors. ──
  const pick = pickCtaButtonColors(brand, surfaceHex);
  const primaryBg = props.ctaButtonColor || pick.bg;
  const primaryTextColor = props.ctaButtonTextColor || pick.text;

  const ctaStyle = props.ctaStyle ?? "buttons";
  const primaryAction = props.ctaAction ?? "url";
  const secondaryAction = props.ctaSecondaryAction ?? "url";
  const submitMode = props.submitMode ?? "navigate";

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

  // ── Inline email-capture pill state (mirror BlockDsoHeartlandHero). ──
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
        /* fall through */
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

  // ── Resolved content values. ──
  const logoText = props.logoText || brand.brandName || "Lumina";
  const navLinks = props.navLinks ?? [];
  const signInText = props.navSignInText ?? "Sign in";
  const navCtaText = props.navCtaText ?? "Get Started";
  const badgeText = props.badgeText ?? "Introducing Lumina AI Generation";
  const badgeLinkText = props.badgeLinkText ?? "Read announcement";
  const chips = props.chips && props.chips.length > 0 ? props.chips : DEFAULT_CHIPS;

  const blobStyle = (color: string): CSSProperties => ({
    background: `radial-gradient(circle, color-mix(in srgb, ${color} 80%, transparent) 0%, transparent 70%)`,
  });

  return (
    <section
      className="aurora-hero-wrapper relative overflow-hidden min-h-[100svh] flex flex-col font-sans"
      style={{ backgroundColor: bg, color: text, fontFamily: bodyFamily }}
    >
      <style>{`
        .aurora-hero-wrapper ::selection {
          background: color-mix(in srgb, ${accent} 30%, transparent);
        }
        @keyframes aurora-1 {
          0%, 100% { transform: translateY(0) translateX(0) scale(1) rotate(0deg); }
          33% { transform: translateY(-20%) translateX(10%) scale(1.2) rotate(45deg); }
          66% { transform: translateY(10%) translateX(-10%) scale(0.8) rotate(-45deg); }
        }
        @keyframes aurora-2 {
          0%, 100% { transform: translateY(0) translateX(0) scale(1) rotate(0deg); }
          33% { transform: translateY(15%) translateX(-20%) scale(0.9) rotate(-30deg); }
          66% { transform: translateY(-15%) translateX(20%) scale(1.1) rotate(30deg); }
        }
        @keyframes aurora-3 {
          0%, 100% { transform: translateY(0) translateX(0) scale(1) rotate(0deg); }
          33% { transform: translateY(-25%) translateX(-15%) scale(1.3) rotate(60deg); }
          66% { transform: translateY(20%) translateX(15%) scale(0.7) rotate(-60deg); }
        }
        @keyframes aurora-4 {
          0%, 100% { transform: translateY(0) translateX(0) scale(1) rotate(0deg); }
          33% { transform: translateY(20%) translateX(25%) scale(0.8) rotate(-20deg); }
          66% { transform: translateY(-20%) translateX(-25%) scale(1.2) rotate(20deg); }
        }
        .aurora-bg { position: absolute; inset: -50%; z-index: 0; pointer-events: none; }
        .aurora-blob { position: absolute; filter: blur(110px) saturate(118%); opacity: 0.48; border-radius: 50%; mix-blend-mode: screen; }
        .aurora-blob-1 { top: 10%; left: 20%; width: 50%; height: 50%; animation: aurora-1 25s infinite ease-in-out; }
        .aurora-blob-2 { top: 40%; left: 60%; width: 40%; height: 40%; animation: aurora-2 30s infinite ease-in-out; }
        .aurora-blob-3 { top: 60%; left: 10%; width: 45%; height: 45%; animation: aurora-3 28s infinite ease-in-out; }
        .aurora-blob-4 { top: 20%; left: 40%; width: 60%; height: 60%; animation: aurora-4 35s infinite ease-in-out; }
        @media (prefers-reduced-motion: reduce) {
          .aurora-blob { animation: none; }
        }
        /* Brand-derived multi-stop veil: a cool crown glow, a low corner ember,
           and a gentle floor fade that grounds the centered content. */
        .aurora-veil {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 85% 58% at 50% -12%, color-mix(in srgb, ${accent} 16%, transparent), transparent 64%),
            radial-gradient(ellipse 65% 50% at 14% 112%, color-mix(in srgb, ${secondHue} 12%, transparent), transparent 70%),
            linear-gradient(to bottom, transparent 55%, color-mix(in srgb, ${bg} 55%, transparent) 100%);
        }
        .aurora-noise {
          position: absolute; inset: 0; z-index: 1; opacity: 0.04; pointer-events: none; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
        .aurora-glass-panel {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.09);
          box-shadow:
            0 24px 48px -16px rgba(0, 0, 0, 0.55),
            0 0 44px -20px color-mix(in srgb, ${accent} 50%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
        .aurora-hero-wrapper a:focus-visible,
        .aurora-hero-wrapper button:focus-visible,
        .aurora-hero-wrapper input:focus-visible {
          outline: 2px solid color-mix(in srgb, ${accent} 60%, #ffffff);
          outline-offset: 3px;
        }
      `}</style>

      {/* Full-bleed background image (optional) + color overlay */}
      {props.backgroundImageUrl && (
        <>
          <div
            className="absolute inset-0 z-0 pointer-events-none"
            style={{
              backgroundImage: `url(${props.backgroundImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div
            className="absolute inset-0 z-0 pointer-events-none"
            style={{
              backgroundColor: resolveBrandColor(brand, props.overlayColor, bg),
              opacity: (props.overlayOpacity ?? 50) / 100,
            }}
          />
        </>
      )}

      {/* Background Animation */}
      <div className="aurora-bg" aria-hidden>
        <div className="aurora-blob aurora-blob-1" style={blobStyle(accent)}></div>
        <div className="aurora-blob aurora-blob-2" style={blobStyle(secondHue)}></div>
        <div className="aurora-blob aurora-blob-3" style={blobStyle(accent)}></div>
        <div className="aurora-blob aurora-blob-4" style={blobStyle(secondHue)}></div>
      </div>
      <div className="aurora-veil" aria-hidden></div>
      <div className="aurora-noise" aria-hidden></div>

      {/* Navigation */}
      {props.showNav !== false && (
        <nav className="relative z-10 w-full px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {brandHasLogo(brand, props.logoImageUrl) ? (
              <BrandLogo
                brand={brand}
                url={props.logoImageUrl}
                tone="onDark"
                alt={logoText}
                className="h-8 w-auto"
              />
            ) : (
              <>
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                  <Zap className="w-5 h-5 text-black" fill="currentColor" />
                </div>
                <InlineText
                  as="span"
                  value={logoText}
                  onUpdate={field("logoText")}
                  className="text-xl font-bold tracking-tight"
                  style={{ color: text }}
                />
              </>
            )}
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
            {navLinks.map((link, i) => (
              <a key={i} href={link.url || "#"} className="hover:text-white transition-colors">
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4 text-sm font-medium">
            {signInText && (
              <a
                href={props.navSignInUrl || "#"}
                className="hidden sm:block text-white/70 hover:text-white transition-colors"
              >
                {signInText}
              </a>
            )}
            {navCtaText && (
              <a
                href={props.navCtaUrl || "#"}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/10 transition-all flex items-center gap-2"
              >
                {navCtaText}
              </a>
            )}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-10 pb-24 text-center">
        <motion.div
          className="max-w-4xl mx-auto w-full flex flex-col items-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          {(badgeText || onFieldChange) && (
            <motion.div variants={itemVariants} className="mb-9">
              <div
                className="inline-flex min-h-[36px] items-center gap-2.5 px-4 py-1.5 rounded-full border backdrop-blur-md text-sm font-medium"
                style={{
                  borderColor: `color-mix(in srgb, ${accent} 30%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${accent} 10%, transparent)`,
                  color: `color-mix(in srgb, ${accent} 45%, #ffffff)`,
                }}
              >
                <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
                <InlineText as="span" value={badgeText} onUpdate={field("badgeText")} />
                {(badgeLinkText || onFieldChange) && (
                  <>
                    <div className="w-px h-4 bg-white/20 mx-1"></div>
                    <a
                      href={props.badgeLinkUrl || "#"}
                      className="text-white hover:underline flex items-center gap-1"
                    >
                      <InlineText as="span" value={badgeLinkText} onUpdate={field("badgeLinkText")} />
                      <ChevronRight className="w-4 h-4" />
                    </a>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="font-bold mb-6 max-w-4xl"
            style={{
              fontFamily: headlineFamily,
              color: text,
              fontSize: "clamp(2.875rem, 7.5vw, 6.25rem)",
              lineHeight: 1.03,
              letterSpacing: "-0.035em",
            }}
          >
            <InlineText as="span" value={props.headline} onUpdate={field("headline")} />
          </motion.h1>

          {/* Subheadline */}
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              multiline
              value={props.subheadline ?? ""}
              onUpdate={field("subheadline")}
              className="text-lg md:text-xl max-w-2xl mb-10 leading-relaxed"
              style={{ color: text, opacity: 0.65 }}
            />
          )}

          {/* CTAs */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center gap-4 mb-16 md:mb-20 w-full sm:w-auto"
          >
            {ctaStyle === "email-capture" ? (
              <form
                onSubmit={handleEmailSubmit}
                className="flex items-center gap-1.5 w-full sm:w-auto rounded-full p-1.5 bg-white"
                style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.18)", maxWidth: 480 }}
              >
                <input
                  type="email"
                  required
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  placeholder={props.emailCapturePlaceholder || "Email address"}
                  aria-label={props.emailCapturePlaceholder || "Email address"}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none px-4 py-3 text-sm"
                  style={{ color: "#0A0A0A", fontFamily: "inherit" }}
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold whitespace-nowrap transition-transform hover:scale-105"
                  style={{ background: primaryBg, color: primaryTextColor }}
                >
                  {props.emailCaptureButtonText || props.ctaText || "Get Started"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <>
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
                    color: primaryTextColor,
                    boxShadow: `0 0 32px color-mix(in srgb, ${primaryBg} 40%, transparent), 0 10px 28px -14px rgba(0,0,0,0.7)`,
                  }}
                  brand={brand}
                  pageId={pageId}
                  variantId={variantId}
                  source="aurora-gradient-hero-primary"
                >
                  <InlineText as="span" value={props.ctaText} onUpdate={field("ctaText")} />
                  <ArrowRight className="w-5 h-5" />
                </CtaButton>

                {(props.ctaSecondaryText || onFieldChange) && (
                  <CtaButton
                    ctaAction={secondaryAction}
                    ctaUrl={props.ctaSecondaryUrl}
                    chilipiperUrl={props.secondaryChilipiperUrl}
                    videoUrl={props.secondaryVideoUrl}
                    {...modalCfg}
                    onClick={secondaryAction === "url" ? onCtaClick : undefined}
                    className="w-full sm:w-auto min-h-[52px] px-8 py-4 rounded-full bg-white/5 text-white font-semibold text-base backdrop-blur-md border border-white/15 hover:bg-white/10 hover:border-white/25 transition-colors flex items-center justify-center gap-2"
                    brand={brand}
                    pageId={pageId}
                    variantId={variantId}
                    source="aurora-gradient-hero-secondary"
                  >
                    <InlineText
                      as="span"
                      value={props.ctaSecondaryText ?? "Book a demo"}
                      onUpdate={field("ctaSecondaryText")}
                    />
                  </CtaButton>
                )}
              </>
            )}
          </motion.div>

          {/* Floating UI Chips */}
          <motion.div className="relative w-full max-w-5xl h-40" variants={containerVariants}>
            {chips.map((chip, i) => {
              const Icon = resolveIcon(chip.icon);
              const isLeft = i % 2 === 0;
              const chipHue = isLeft ? secondHue : accent;
              return (
                <motion.div
                  key={i}
                  className={`absolute ${isLeft ? "left-0 sm:left-[10%] top-0" : "right-0 sm:right-[10%] top-8"} aurora-glass-panel rounded-2xl p-4 flex items-center gap-4 w-64`}
                  variants={floatVariants}
                  initial="initial"
                  animate="animate"
                  style={isLeft ? undefined : { animationDelay: "-2s" }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${chipHue} 18%, transparent)`,
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${chipHue} 28%, transparent)`,
                    }}
                  >
                    <Icon className="w-5 h-5" style={{ color: `color-mix(in srgb, ${chipHue} 70%, #ffffff)` }} aria-hidden />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-white">{chip.title}</div>
                    {chip.subtitle && (
                      <div className="text-xs text-white/55 mt-0.5">{chip.subtitle}</div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </main>

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
        source="aurora-gradient-hero"
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
