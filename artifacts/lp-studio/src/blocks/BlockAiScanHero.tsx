import { motion } from "framer-motion";
import { useRef, useState, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import type { AiScanHeroBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { pickCtaButtonColors, contrastTextColor } from "@/lib/brand-config";
import { getBgStyle, resolveSectionSurface } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";
import { MuteToggleButton } from "@/components/MuteToggleButton";
import { CtaButton } from "@/components/CtaButton";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";

/** Warm editorial default surface (Procore-style beige) used when no
 *  backgroundStyle preset and no custom bgColor are set. */
const WARM_BG = "#F2E9E1";
const DARK_INK = "#141210";
/** Fallback accent when the brand has no accent var — a confident orange that
 *  matches the reference eyebrow dot + primary button. */
const ACCENT_FALLBACK = "#E8590C";

/** Default media-band photo so the hero never renders without media. Reuses the
 *  AI-review visual already established elsewhere in the app (known-good URL);
 *  authors and the AI image-fill pipeline replace it via imageUrl. */
const DEFAULT_IMAGE_URL =
  "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=1600&h=900&fit=crop";

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface Props {
  props: AiScanHeroBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  onFieldChange?: (updated: AiScanHeroBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

export function BlockAiScanHero({
  props,
  brand,
  onCtaClick,
  onFieldChange,
  pageId,
  variantId,
}: Props) {
  const {
    eyebrow = "AI Scan Review",
    headline = "Every scan, reviewed by AI before it ships.",
    body = "Inline AI review catches issues in real time — so your team ships first-time-right work without the costly back-and-forth.",
    imageUrl = "",
    backgroundVideoUrl = "",
    headlineScale = 1,
    backgroundStyle,
  } = props;

  const field = (key: keyof AiScanHeroBlockProps) =>
    onFieldChange
      ? (v: string) =>
          onFieldChange({ ...props, [key]: v as AiScanHeroBlockProps[typeof key] })
      : undefined;

  // ── Surface + contrast ────────────────────────────────────────────────
  // A custom bgColor wins; otherwise a chosen preset; otherwise the warm
  // editorial default. Contrast (isDark) is derived from the *resolved* hex so
  // a pale-brand or dark override never claims the wrong ink.
  const hasBgColor = !!props.bgColor?.trim();
  const paintedBg = hasBgColor
    ? (props.bgColor as string)
    : backgroundStyle
      ? (getBgStyle(backgroundStyle).background as string)
      : WARM_BG;
  const surface = resolveSectionSurface(
    {
      backgroundStyle: hasBgColor ? undefined : backgroundStyle,
      bgColor: hasBgColor ? props.bgColor : backgroundStyle ? undefined : WARM_BG,
    },
    "#ffffff",
    brand,
  );
  const dark = surface.isDark;
  const baseHex = surface.base;

  const fg = props.textColor || (dark ? "#F6F7F9" : DARK_INK);
  const muted = dark ? "rgba(255,255,255,0.72)" : "rgba(20,18,16,0.66)";
  const accent = props.accentColor || `var(--brand-accent, ${ACCENT_FALLBACK})`;

  // ── Primary CTA colors (contrast-safe against the section) ─────────────
  const ctaColors = pickCtaButtonColors(brand, baseHex);
  const primaryBg = props.ctaButtonColor || props.accentColor || ctaColors.bg;
  const primaryFg =
    props.ctaButtonTextColor ||
    (props.ctaButtonColor
      ? contrastTextColor(props.ctaButtonColor)
      : props.accentColor
        ? contrastTextColor(props.accentColor)
        : ctaColors.text);

  // ── Brand-driven fonts ────────────────────────────────────────────────
  useBlockFonts(props.headlineFont, props.bodyFont);
  const headlineFamily = props.headlineFont
    ? toFontFamilyValue(props.headlineFont, "display") ||
      "var(--brand-font-display, ui-sans-serif, system-ui, sans-serif)"
    : "var(--brand-font-display, ui-sans-serif, system-ui, sans-serif)";
  const bodyFamily = props.bodyFont
    ? toFontFamilyValue(props.bodyFont, "sans") ||
      "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)"
    : "var(--brand-font-body, ui-sans-serif, system-ui, sans-serif)";

  // ── Video mute toggle (media plays silently on a loop by default) ──────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoMuted, setVideoMuted] = useState(true);
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) el.muted = true;
  }, []);
  const toggleVideoMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setVideoMuted(el.muted);
  };

  // ── Adjustable headline size (multiplier over the responsive clamp) ────
  const scale = typeof headlineScale === "number" && headlineScale > 0 ? headlineScale : 1;
  const headlineFontSize = `clamp(${(2.75 * scale).toFixed(2)}rem, ${(6 * scale).toFixed(2)}vw, ${(5 * scale).toFixed(2)}rem)`;

  const mediaBg = dark ? "#0b0b0f" : "rgba(0,0,0,0.05)";

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

  const primaryAction = props.ctaAction || "url";
  const secondaryAction = props.ctaSecondaryAction || "url";

  return (
    <section
      style={{
        background: paintedBg,
        color: fg,
        position: "relative",
        overflow: "hidden",
        paddingBottom: 0,
      }}
      className="pt-16 md:pt-24"
    >
      {/* Custom sidePadding lifts the 1280px cap so the slider genuinely
        controls width edge-to-edge; unset keeps the legacy centered layout. */}
      <div
        style={
          typeof props.sidePadding === "number" && props.sidePadding >= 0
            ? { margin: "0 auto", padding: `0 ${props.sidePadding}px` }
            : { maxWidth: 1280, margin: "0 auto", padding: "0 1.5rem" }
        }
        className={
          typeof props.sidePadding === "number" && props.sidePadding >= 0
            ? undefined
            : "md:px-10"
        }
      >
        <div className="grid md:grid-cols-[1.5fr_1fr] gap-x-12 gap-y-8 items-end">
          {/* ── Left: eyebrow + huge headline ── */}
          <div>
            {(eyebrow || onFieldChange) && (
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  marginBottom: "1.5rem",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: accent,
                    flexShrink: 0,
                  }}
                />
                <InlineText
                  as="span"
                  value={eyebrow}
                  onUpdate={field("eyebrow")}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: muted,
                    fontFamily: bodyFamily,
                  }}
                />
              </motion.div>
            )}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
              style={{
                fontFamily: headlineFamily,
                fontSize: headlineFontSize,
                lineHeight: 1.02,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: fg,
                margin: 0,
              }}
            >
              <InlineText
                as="span"
                value={headline}
                onUpdate={field("headline")}
                multiline
                style={{ fontFamily: headlineFamily }}
              />
            </motion.h1>
          </div>

          {/* ── Right: body + CTAs ── */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.12, ease: EASE_OUT_EXPO }}
          >
            {(body || onFieldChange) && (
              <p
                style={{
                  fontSize: "1.0625rem",
                  lineHeight: 1.65,
                  color: muted,
                  fontFamily: bodyFamily,
                  margin: 0,
                  maxWidth: "42ch",
                }}
              >
                <InlineText
                  as="span"
                  value={body}
                  onUpdate={field("body")}
                  multiline
                  style={{ fontFamily: bodyFamily }}
                />
              </p>
            )}
            {(props.ctaText || props.ctaSecondaryText || onFieldChange) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "1rem 1.75rem",
                  marginTop: "2rem",
                }}
              >
                {(props.ctaText || onFieldChange) && (
                  <CtaButton
                    ctaAction={primaryAction}
                    ctaUrl={props.ctaUrl}
                    chilipiperUrl={props.chilipiperUrl}
                    videoUrl={props.videoUrl}
                    {...modalCfg}
                    onClick={primaryAction === "url" ? onCtaClick : undefined}
                    brand={brand}
                    pageId={pageId}
                    variantId={variantId}
                    source="ai-scan-hero-primary"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.9rem 2rem",
                      borderRadius: "0.5rem",
                      background: primaryBg,
                      color: primaryFg,
                      fontWeight: 600,
                      fontSize: "1rem",
                      fontFamily: bodyFamily,
                      border: "none",
                    }}
                  >
                    <InlineText
                      as="span"
                      value={props.ctaText || "Get started"}
                      onUpdate={field("ctaText")}
                      style={{ fontFamily: bodyFamily }}
                    />
                  </CtaButton>
                )}
                {(props.ctaSecondaryText || onFieldChange) && (
                  <CtaButton
                    ctaAction={secondaryAction}
                    ctaUrl={props.ctaSecondaryUrl}
                    chilipiperUrl={props.secondaryChilipiperUrl}
                    videoUrl={props.secondaryVideoUrl}
                    {...modalCfg}
                    onClick={secondaryAction === "url" ? onCtaClick : undefined}
                    brand={brand}
                    pageId={pageId}
                    variantId={variantId}
                    source="ai-scan-hero-secondary"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      color: fg,
                      fontWeight: 600,
                      fontSize: "1rem",
                      fontFamily: bodyFamily,
                      background: "transparent",
                      border: "none",
                    }}
                  >
                    <InlineText
                      as="span"
                      value={props.ctaSecondaryText ?? ""}
                      onUpdate={field("ctaSecondaryText")}
                      style={{ fontFamily: bodyFamily }}
                    />
                    <ArrowRight style={{ width: 18, height: 18, color: accent }} />
                  </CtaButton>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Full-bleed media, flush to the bottom edge ──
        A hero, not a section: the media touches the bottom with no trailing
        padding. Always renders — a video when backgroundVideoUrl is set, the
        author/AI-picked photo via imageUrl, or the built-in default photo. */}
      <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
          style={{
            width: "100%",
            position: "relative",
            overflow: "hidden",
            background: mediaBg,
            marginTop: "clamp(2.5rem, 5vw, 4rem)",
          }}
        >
          <div style={{ width: "100%", height: "clamp(280px, 42vw, 560px)" }}>
            {backgroundVideoUrl ? (
              <video
                ref={attachVideo}
                src={backgroundVideoUrl}
                autoPlay
                loop
                muted
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <img
                src={imageUrl || DEFAULT_IMAGE_URL}
                alt={props.imageAlt || ""}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            )}
          </div>
          {/* The mute toggle only appears over a playing video — a static image
            gets NO play affordance (a play button that plays nothing is a lie). */}
          {backgroundVideoUrl && (
            <MuteToggleButton
              muted={videoMuted}
              onClick={toggleVideoMute}
              className="absolute bottom-5 right-5 z-10"
            />
          )}
      </motion.div>
    </section>
  );
}
