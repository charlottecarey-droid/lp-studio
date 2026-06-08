import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Terminal,
  Zap,
  Shield,
  ChevronRight,
  Sparkles,
  Globe,
  Cpu,
  Lock,
  Rocket,
  Activity,
  Cloud,
  Code,
  Database,
  Layers,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex, pickCtaButtonColors } from "@/lib/brand-config";
import type { SpotlightGlowHeroBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { BrandLogo, brandHasLogo } from "@/components/BrandLogo";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";

interface Props {
  props: SpotlightGlowHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: SpotlightGlowHeroBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

/** Mockup accent (violet-600 / rgba(139,92,246)). */
const MOCKUP_ACCENT = "#8b5cf6";
/** Mockup surface (`--bg-color`). */
const MOCKUP_BG = "#030305";
const MOCKUP_TEXT = "#FFFFFF";
/** Display fallback when no brand display font + no per-block pick. */
const DISPLAY_FALLBACK = "'Outfit', ui-sans-serif, system-ui, sans-serif";

const DEFAULT_NAV_LINKS = [
  { label: "Platform", url: "#" },
  { label: "Solutions", url: "#" },
  { label: "Documentation", url: "#" },
  { label: "Pricing", url: "#" },
];

const DEFAULT_SIDEBAR = [
  { icon: "Zap", label: "Real-time Sync" },
  { icon: "Shield", label: "Enterprise Sec" },
  { icon: "Terminal", label: "Edge Compute" },
];

const DEFAULT_CODE_SNIPPET = `export default defineConfig({
  edge: true,
  scaling: 'auto',
  regions: ['global'],
});`;

/** Curated lucide set for prop-driven sidebar icon names. */
const ICONS: Record<string, LucideIcon> = {
  Zap,
  Shield,
  Terminal,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Globe,
  Cpu,
  Lock,
  Rocket,
  Activity,
  Cloud,
  Code,
  Database,
  Layers,
  Gauge,
};

function resolveIcon(name?: string): LucideIcon {
  return (name && ICONS[name]) || Zap;
}

/** Render the headline with the accent-gradient word, when present. */
function renderHeadline(
  headline: string,
  gradientWord: string | undefined,
  gradientCss: string,
) {
  if (!gradientWord || !headline.includes(gradientWord)) {
    return <>{headline}</>;
  }
  const idx = headline.indexOf(gradientWord);
  const before = headline.slice(0, idx);
  const after = headline.slice(idx + gradientWord.length);
  const gradientStyle: CSSProperties = {
    color: "transparent",
    backgroundImage: gradientCss,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
  };
  return (
    <>
      {before}
      <span style={gradientStyle}>{gradientWord}</span>
      {after}
    </>
  );
}

export function BlockSpotlightGlowHero({
  props,
  brand,
  onCtaClick,
  onFieldChange,
  pageId,
  variantId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [emailValue, setEmailValue] = useState("");
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const field = (key: keyof SpotlightGlowHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const isEditor = !!onFieldChange;

  // ── Brand vars (colors + fonts) ───────────────────────────────
  const accent = props.accentColor || `var(--brand-accent, ${MOCKUP_ACCENT})`;
  const bg = props.bgColor || MOCKUP_BG;
  const text = props.textColor || MOCKUP_TEXT;

  useBlockFonts(props.headlineFont, props.bodyFont);
  const headlineFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") || DISPLAY_FALLBACK
    : `var(--brand-font-display, ${DISPLAY_FALLBACK})`;
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") ||
      "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)"
    : "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)";

  // Accent-driven derivations (mirror the mockup's layered violet/indigo).
  const gradientCss = `linear-gradient(to right, ${accent}, var(--brand-primary, #818cf8))`;

  // ── CTA colors ────────────────────────────────────────────────
  const surfaceHex = isValidHex(bg) ? bg : MOCKUP_BG;
  const picked = pickCtaButtonColors(brand, surfaceHex);
  const primaryBg = props.ctaButtonColor || picked.bg;
  const primaryText = props.ctaButtonTextColor || picked.text;
  const primaryGlow = `color-mix(in srgb, ${primaryBg} 40%, transparent)`;

  // ── Mouse-follow glow (respects reduced motion) ───────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const handle = (e: MouseEvent) => {
      const { left, top } = el.getBoundingClientRect();
      el.style.setProperty("--sg-mouse-x", `${e.clientX - left}px`);
      el.style.setProperty("--sg-mouse-y", `${e.clientY - top}px`);
    };
    window.addEventListener("mousemove", handle);
    return () => window.removeEventListener("mousemove", handle);
  }, []);

  // ── Pass-through modal config (shared by primary + secondary CTAs). ──
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

  // ── Email-capture submit (mirrors dso-heartland routing). ─────
  const submitMode = props.submitMode ?? "navigate";
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailValue.trim();
    if (!trimmed) return;

    if (submitMode === "modal-form" || submitMode === "modal-chilipiper") {
      setEmailModalOpen(true);
      return;
    }

    if (props.ctaAction === "chilipiper" && onCtaClick) {
      onCtaClick();
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

  // ── Resolved content (defaults preserve the mockup's look) ────
  const headline = props.headline || "Build with absolute velocity";
  const gradientWord = props.headlineGradientWord ?? "absolute velocity";
  const badgeText = props.badgeText ?? "Nexus Engine v2.0 is now live";
  const subheadline =
    props.subheadline ??
    "The world's most powerful infrastructure for deploying scalable applications. Zero configuration. Infinite performance.";

  const logoText = props.logoText || brand.brandName || "NEXUS";
  const navLinks = props.navLinks ?? DEFAULT_NAV_LINKS;
  const navSignInText = props.navSignInText ?? "Sign In";
  const navCtaText = props.navCtaText ?? "Get Started";

  const showPreview = props.showPreview !== false;
  const sidebarItems =
    props.sidebarItems && props.sidebarItems.length > 0 ? props.sidebarItems : DEFAULT_SIDEBAR;
  const codeFileName = props.codeFileName ?? "nexus.config.ts";
  const codeSnippet = props.codeSnippet ?? DEFAULT_CODE_SNIPPET;

  const ctaStyle = props.ctaStyle ?? "buttons";
  const ctaText = props.ctaText || "Start Building Free";

  // Root CSS vars consumed by the scoped <style> block below.
  const rootStyle = {
    backgroundColor: bg,
    color: text,
    fontFamily: bodyFamily,
    "--sg-grid": "rgba(255,255,255,0.05)",
    "--sg-spotlight": `color-mix(in srgb, ${accent} 15%, transparent)`,
    "--sg-bento-1": `color-mix(in srgb, ${accent} 50%, transparent)`,
    "--sg-bento-2": "color-mix(in srgb, var(--brand-primary, #3b82f6) 50%, transparent)",
    "--sg-mouse-x": "50%",
    "--sg-mouse-y": "50%",
  } as CSSProperties;

  return (
    <div ref={containerRef} className="spotlight-glow-hero flex flex-col" style={rootStyle}>
      <style>{SCOPED_CSS}</style>
      <div className="sg-grid-bg" aria-hidden />
      <div className="sg-spotlight" aria-hidden />

      {/* ── Navigation ── */}
      {props.showNav !== false && (
        <nav className="sg-content w-full px-8 py-6 flex items-center justify-between">
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
                <div
                  className="w-8 h-8 rounded flex items-center justify-center"
                  style={{ backgroundColor: accent }}
                >
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <InlineText
                  as="span"
                  className="text-xl font-bold tracking-tight"
                  value={logoText}
                  onUpdate={field("logoText")}
                  style={{ fontFamily: headlineFamily }}
                />
              </>
            )}
          </div>

          {navLinks.length > 0 && (
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
              {navLinks.map((link, i) => (
                <a key={i} href={link.url} className="hover:text-white transition-colors">
                  {link.label}
                </a>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4">
            {navSignInText && (
              <a
                href={props.navSignInUrl || "#"}
                className="text-sm font-medium text-white/70 hover:text-white transition-colors hidden sm:block"
              >
                {navSignInText}
              </a>
            )}
            {navCtaText && (
              <a
                href={props.navCtaUrl || "#"}
                className="spotlight-glow-glass px-5 py-2.5 rounded-full text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                {navCtaText}
                <ChevronRight className="w-4 h-4" style={{ color: accent }} />
              </a>
            )}
          </div>
        </nav>
      )}

      {/* ── Main Content ── */}
      <main className="sg-content flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-12 md:py-24 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mb-16">
          {(badgeText || isEditor) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium mb-8"
              style={{
                borderColor: `color-mix(in srgb, ${accent} 30%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${accent} 10%, transparent)`,
                color: `color-mix(in srgb, ${accent} 55%, white)`,
              }}
            >
              <span
                className="flex h-2 w-2 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <InlineText as="span" value={badgeText} onUpdate={field("badgeText")} />
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]"
            style={{ fontFamily: headlineFamily }}
          >
            {isEditor ? (
              <InlineText
                as="span"
                value={headline}
                onUpdate={field("headline")}
                style={{ fontFamily: headlineFamily }}
              />
            ) : (
              renderHeadline(headline, gradientWord, gradientCss)
            )}
          </motion.h1>

          {(subheadline || isEditor) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
            >
              <InlineText
                as="p"
                multiline
                value={subheadline}
                onUpdate={field("subheadline")}
                className="text-lg md:text-xl text-white/60 mb-10 max-w-2xl mx-auto"
              />
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {ctaStyle === "email-capture" ? (
              <form
                onSubmit={handleEmailSubmit}
                className="flex items-center gap-1.5 p-1.5 rounded-full bg-white shadow-lg w-full max-w-[420px]"
              >
                <input
                  type="email"
                  required
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  placeholder={props.emailCapturePlaceholder || "Email address"}
                  aria-label={props.emailCapturePlaceholder || "Email address"}
                  className="flex-1 min-w-0 bg-transparent outline-none border-none px-3 py-2 text-sm text-slate-900"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition-opacity hover:opacity-90"
                  style={{ background: primaryBg, color: primaryText }}
                >
                  {props.emailCaptureButtonText || ctaText || "Get Started"}
                  <ArrowRight className="w-4 h-4" />
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
                  source="spotlight-glow-hero-primary"
                  className="h-12 px-8 rounded-full font-medium flex items-center gap-2 transition-all"
                  style={{
                    backgroundColor: primaryBg,
                    color: primaryText,
                    boxShadow: `0 0 20px ${primaryGlow}`,
                  }}
                >
                  <InlineText as="span" value={ctaText} onUpdate={field("ctaText")} />
                  <ArrowRight className="w-4 h-4" />
                </CtaButton>

                {(props.ctaSecondaryText || isEditor) && (
                  <CtaButton
                    ctaAction={props.ctaSecondaryAction || "url"}
                    ctaUrl={props.ctaSecondaryUrl}
                    chilipiperUrl={props.secondaryChilipiperUrl}
                    videoUrl={props.secondaryVideoUrl}
                    {...modalCfg}
                    brand={brand}
                    pageId={pageId}
                    variantId={variantId}
                    source="spotlight-glow-hero-secondary"
                    className="h-12 px-8 rounded-full spotlight-glow-glass text-white font-medium hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <Terminal className="w-4 h-4 text-white/60" />
                    <InlineText
                      as="span"
                      value={props.ctaSecondaryText || "Read Documentation"}
                      onUpdate={field("ctaSecondaryText")}
                    />
                  </CtaButton>
                )}
              </>
            )}
          </motion.div>
        </div>

        {/* ── Bento Grid Preview ── */}
        {showPreview && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
            className="w-full max-w-5xl"
          >
            <div className="spotlight-glow-bento-glow rounded-2xl p-1">
              <div className="spotlight-glow-glass rounded-xl overflow-hidden flex flex-col md:flex-row">
                {/* Sidebar */}
                <div className="w-full md:w-64 border-r border-white/5 p-6 flex flex-col gap-6">
                  <div className="space-y-4">
                    <div className="h-2 w-16 bg-white/20 rounded" />
                    <div className="h-2 w-32 bg-white/10 rounded" />
                    <div className="h-2 w-24 bg-white/10 rounded" />
                  </div>

                  <div className="mt-8 space-y-3">
                    {sidebarItems.map((item, i) => {
                      const Icon = resolveIcon(item.icon);
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 font-mono text-sm"
                          style={{ color: i === 0 ? accent : "rgba(255,255,255,0.4)" }}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Main Preview Area */}
                <div className="flex-1 p-1">
                  <div
                    className="w-full h-[400px] rounded-lg border border-white/5 overflow-hidden relative group"
                    style={{ backgroundColor: MOCKUP_BG }}
                  >
                    {props.previewImageUrl ? (
                      <InlineImage
                        src={props.previewImageUrl}
                        alt={props.previewImageAlt || "Dashboard Preview"}
                        wrapperClassName="block w-full h-full"
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                        onUpdate={field("previewImageUrl")}
                        onAltUpdate={field("previewImageAlt")}
                      />
                    ) : (
                      <div
                        className="w-full h-full"
                        style={{
                          backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${accent} 35%, transparent), transparent), linear-gradient(to bottom right, color-mix(in srgb, var(--brand-primary, #3b82f6) 25%, transparent), transparent)`,
                        }}
                      />
                    )}
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(to top, ${MOCKUP_BG}, transparent 60%)`,
                      }}
                    />

                    {/* Overlay code snippet */}
                    <div className="absolute bottom-6 left-6 right-6">
                      <div className="spotlight-glow-glass p-4 rounded-lg font-mono text-xs sm:text-sm text-white/80 overflow-hidden relative">
                        <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                          <InlineText
                            as="span"
                            className="text-white/40 ml-2"
                            value={codeFileName}
                            onUpdate={field("codeFileName")}
                          />
                        </div>
                        <InlineText
                          as="pre"
                          multiline
                          value={codeSnippet}
                          onUpdate={field("codeSnippet")}
                          className="whitespace-pre-wrap"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Shared email-capture modal (for modal-* submit modes). */}
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
        source="spotlight-glow-hero"
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

/** Scoped styles ported from the approved mockup (SpotlightGlow.css). Accent /
 *  grid / bento colors are driven by the `--sg-*` CSS vars set on the root so
 *  the design stays brand-swappable. */
const SCOPED_CSS = `
.spotlight-glow-hero {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
}
.spotlight-glow-hero .sg-grid-bg {
  position: absolute;
  inset: 0;
  background-size: 40px 40px;
  background-image:
    linear-gradient(to right, var(--sg-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--sg-grid) 1px, transparent 1px);
  -webkit-mask-image: radial-gradient(circle at center, black, transparent 80%);
  mask-image: radial-gradient(circle at center, black, transparent 80%);
  pointer-events: none;
  z-index: 0;
}
.spotlight-glow-hero .sg-spotlight {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background: radial-gradient(
    circle 600px at var(--sg-mouse-x) var(--sg-mouse-y),
    var(--sg-spotlight),
    transparent 80%
  );
  opacity: 0;
  transition: opacity 0.5s;
}
.spotlight-glow-hero:hover .sg-spotlight {
  opacity: 1;
}
.spotlight-glow-hero .sg-content {
  position: relative;
  z-index: 10;
}
.spotlight-glow-hero .spotlight-glow-glass {
  background: rgba(20, 20, 25, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.spotlight-glow-hero .spotlight-glow-bento-glow {
  position: relative;
}
.spotlight-glow-hero .spotlight-glow-bento-glow::before {
  content: "";
  position: absolute;
  inset: -1px;
  background: linear-gradient(to bottom right, var(--sg-bento-1), var(--sg-bento-2), transparent);
  border-radius: inherit;
  z-index: -1;
  opacity: 0.3;
  transition: opacity 0.3s;
}
.spotlight-glow-hero .spotlight-glow-bento-glow:hover::before {
  opacity: 0.6;
}
@media (prefers-reduced-motion: reduce) {
  .spotlight-glow-hero .sg-spotlight { transition: none; }
}
`;
