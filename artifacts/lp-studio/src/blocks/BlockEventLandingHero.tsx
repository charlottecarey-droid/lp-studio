import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { EventLandingHeroBlockProps, FormBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { safeNavigate } from "@/lib/safe-url";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { BlockForm } from "./BlockForm";
import { isLikelyHtml, sanitizeInlineHtml } from "@/lib/sanitize-inline-html";

interface Props {
  props: EventLandingHeroBlockProps;
  brand: BrandConfig;
  pageId?: number;
  testId?: number;
  variantId?: number;
  sessionId?: string;
  onCtaClick?: () => void;
  onFieldChange?: (updated: EventLandingHeroBlockProps) => void;
}

import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
const DISPLAY_FONT = BRAND_DISPLAY_STACK;
const DISPLAY = DISPLAY_FONT;

/** Pick a readable foreground color for the CTA pill given its background. */
function readableOn(hex: string): string {
  const m = hex.replace("#", "").trim();
  const full = m.length === 3 ? m.split("").map(c => c + c).join("") : m;
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return "#ffffff";
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  // Per WCAG relative-luminance approximation
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0f172a" : "#ffffff";
}

/** Convert a `#rrggbb` (or `#rgb`) hex into an `rgba()` string with the given
 *  alpha. Used to build the CTA box-shadow + shine gradient from a
 *  user-picked color while keeping the original alpha curve. */
function hexToRgba(hex: string, alpha: number): string {
  const m = (hex || "#000000").replace("#", "").trim();
  const full = m.length === 3 ? m.split("").map(c => c + c).join("") : m;
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return `rgba(0,0,0,${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Clamp a font-scale multiplier so users can't blow up the layout. */
function clampScale(v: unknown, fallback = 1): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0.6, Math.min(1.8, n));
}

const DETAILS_BG: Record<NonNullable<EventLandingHeroBlockProps["detailsBackgroundStyle"]>, { bg: string; fg: string; muted: string; rule: string }> = {
  "white":       { bg: "#ffffff",                fg: "#0a1f1a", muted: "#475569", rule: "rgba(0,0,0,0.08)" },
  "light-gray":  { bg: "#f6f6f5",                fg: "#0a1f1a", muted: "#475569", rule: "rgba(0,0,0,0.08)" },
  "muted":       { bg: "hsl(42, 18%, 96%)",      fg: "#0a1f1a", muted: "#475569", rule: "rgba(0,0,0,0.08)" },
  "dark":        { bg: "var(--brand-primary)",   fg: "#ffffff", muted: "rgba(255,255,255,0.78)", rule: "rgba(255,255,255,0.14)" },
  "dandy-green": { bg: "var(--brand-primary)",   fg: "#ffffff", muted: "rgba(255,255,255,0.78)", rule: "rgba(255,255,255,0.14)" },
  "black":       { bg: "#000000",                fg: "#ffffff", muted: "rgba(255,255,255,0.78)", rule: "rgba(255,255,255,0.14)" },
};

export function BlockEventLandingHero({ props, brand, pageId, testId, variantId, sessionId, onCtaClick, onFieldChange }: Props) {
  const field = (key: keyof EventLandingHeroBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as EventLandingHeroBlockProps[typeof key] }) : undefined;

  const {
    backgroundImage,
    backgroundImageAlt,
    backgroundFocalPoint,
    overlayColor = "#000000",
    eyebrow,
    eyebrowItalic = true,
    headline,
    dateText,
    locationText,
    ctaText,
    ctaUrl,
    ctaDropShadow = false,
    ctaDropShadowColor = "#000000",
    ctaDropShadowIntensity = 1,
    ctaShine = false,
    ctaShineColor = "#ffffff",
    ctaShineIntensity = 1,
    showScrollIndicator = true,
    scrollLabel = "SCROLL DOWN",
    scrollTargetId,
    showDetailsSection = false,
    detailsAnchorId = "rsvp",
    whatToExpectHeading,
    whatToExpectBody,
    eventDetailsHeading,
    eventDetailsBody,
    eventDetailsBullets,
    formHeading,
    formSubheading,
    formId,
  } = props;
  // Runtime normalization — defends against malformed persisted JSON.
  const overlayRaw = props.backgroundOverlay;
  const backgroundOverlay = typeof overlayRaw === "number"
    ? Math.max(0, Math.min(1, overlayRaw))
    : 0.5;
  const align: "center" | "left" = props.align === "left" ? "left" : "center";
  const minHeight = typeof props.minHeight === "string" && props.minHeight.trim().length > 0
    ? props.minHeight
    : "100vh";
  const headlineMaxWidthCh = Math.max(8, Math.min(60, Number(props.headlineMaxWidthCh) || 18));
  const headlineScale = clampScale(props.headlineFontScale);
  const dateScale = clampScale(props.dateFontScale);

  // If the scroll-down indicator has no explicit target but the details section
  // is shown, default-scroll into the details anchor so the chevron is useful.
  const effectiveScrollTarget = scrollTargetId
    ?? (showDetailsSection ? detailsAnchorId : undefined);

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  // Subtle parallax on the bg image and gentle fade on the foreground.
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  // Brand-aware CTA palette, with optional per-instance overrides. When the
  // user supplies an explicit color it wins; otherwise we fall back to the
  // tenant brand variables (so the rest of the brand system still applies).
  const P = props.ctaBgColor ?? `var(--brand-primary, ${brand.primaryColor})`;
  const A = props.ctaHoverBgColor ?? `var(--brand-accent, ${brand.accentColor})`;
  const ctaFg = props.ctaTextColor ?? readableOn(props.ctaBgColor ?? brand.primaryColor);
  const accentFg = props.ctaHoverTextColor ?? readableOn(props.ctaHoverBgColor ?? brand.accentColor);

  const handleCtaClick = () => {
    if (onCtaClick) { onCtaClick(); return; }
    if (ctaUrl && ctaUrl !== "#") safeNavigate(ctaUrl, "_blank");
  };

  const handleScrollClick = () => {
    if (effectiveScrollTarget) {
      const el = document.getElementById(effectiveScrollTarget);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    }
    window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
  };

  // Compose font-size clamps from the user-provided scales. Original defaults
  // come from the reference (after-hours/new-york). Scaling the max bound
  // keeps the responsive lower bound untouched on small screens.
  const headlineFontSize = `clamp(${(2.5 * headlineScale).toFixed(2)}rem, ${(7.5 * headlineScale).toFixed(2)}vw, ${(5.75 * headlineScale).toFixed(2)}rem)`;
  const dateFontSize = `clamp(${(1 * dateScale).toFixed(2)}rem, ${(2.2 * dateScale).toFixed(2)}vw, ${(1.375 * dateScale).toFixed(2)}rem)`;

  const detailsTheme = DETAILS_BG[props.detailsBackgroundStyle ?? "light-gray"] ?? DETAILS_BG["light-gray"];

  // Synthesize a FormBlockProps shim so we can reuse <BlockForm> for the
  // RSVP column. The visible heading/subheading are rendered above the
  // embedded form, so we leave the inner headline blank. When formMode is
  // "marketo", the marketo* fields embed a Marketo form directly; otherwise
  // formId points at a global form, whose fields/submit/marketo/notification
  // config all live server-side and load via /api/lp/forms/:id.
  const formMode = props.formMode === "marketo" ? "marketo" : "native";
  const embeddedForm: FormBlockProps = {
    headline: "",
    subheadline: "",
    multiStep: false,
    steps: [],
    submitButtonText: "Submit",
    successMessage: "Thanks — you're on the list!",
    redirectUrl: "",
    backgroundStyle: "white",
    formId,
    cardStyle: "flat",
    formMode,
    marketoBaseUrl: props.marketoBaseUrl,
    marketoMunchkinId: props.marketoMunchkinId,
    marketoFormId: props.marketoFormId,
  };

  const leftColTopPad = Math.max(0, Math.min(20, Number(props.leftColumnTopPadding) || 0));
  const rightColTopPad = Math.max(0, Math.min(20, Number(props.rightColumnTopPadding) || 0));
  const copyColWidth = Math.max(0.5, Math.min(2.5, Number(props.copyColumnWidth) || 1.05));
  const swapColumns = props.swapColumns === true;
  const { extraSectionHeading, extraSectionBody } = props;

  // Detect whether the form column has any renderable content so we can show
  // the dashed placeholder when neither a global form nor marketo is configured.
  const hasMarketo = formMode === "marketo"
    && Boolean(props.marketoBaseUrl)
    && Boolean(props.marketoMunchkinId)
    && Boolean(props.marketoFormId);
  const hasForm = hasMarketo || (formMode === "native" && Boolean(formId));

  return (
    <>
      <section
        ref={sectionRef}
        style={{
          position: "relative",
          minHeight,
          width: "100%",
          overflow: "hidden",
          backgroundColor: "#000",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: align === "center" ? "center" : "flex-start",
          justifyContent: "center",
          textAlign: align === "center" ? "center" : "left",
        }}
      >
        {/* Background image with parallax. In edit mode (onFieldChange present)
            we wrap with InlineImage so users can hover-replace, drag-drop, set
            alt text, and adjust the focal point inline. In published mode it
            renders as a plain <img> with no chrome. */}
        {backgroundImage && (
          <motion.div
            style={{
              position: "absolute",
              inset: "-10% 0 -10% 0",
              width: "100%",
              height: "120%",
              y: bgY,
              zIndex: 0,
            }}
          >
            <InlineImage
              src={backgroundImage}
              alt={backgroundImageAlt ?? ""}
              onUpdate={field("backgroundImage")}
              onAltUpdate={field("backgroundImageAlt")}
              focalPoint={backgroundFocalPoint}
              onFocalUpdate={field("backgroundFocalPoint")}
              wrapperClassName="block w-full h-full"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
              loading="eager"
              decoding="async"
            />
          </motion.div>
        )}

        {/* Dark overlay */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: overlayColor,
            opacity: backgroundOverlay,
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        {/* Foreground content */}
        <motion.div
          style={{
            position: "relative",
            zIndex: 2,
            opacity: contentOpacity,
            width: "100%",
            maxWidth: 1100,
            padding: "clamp(5rem, 12vh, 9rem) clamp(1.25rem, 5vw, 3rem) clamp(6rem, 14vh, 9rem)",
            display: "flex",
            flexDirection: "column",
            alignItems: align === "center" ? "center" : "flex-start",
            gap: "clamp(1.25rem, 3vh, 2rem)",
          }}
        >
          {eyebrow && (
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ margin: 0, fontSize: "clamp(0.75rem, 1.4vw, 0.875rem)", fontStyle: eyebrowItalic ? "italic" : "normal", fontWeight: 500, letterSpacing: "0.04em", color: A, textShadow: "0 1px 12px rgba(0,0,0,0.4)", fontFamily: BODY }}>
              <InlineText as="span" value={eyebrow} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }}/>
            </motion.p>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{
              margin: 0,
              fontFamily: DISPLAY_FONT,
              fontSize: headlineFontSize,
              lineHeight: 1.05,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#fff",
              textShadow: "0 2px 24px rgba(0,0,0,0.35)",
              maxWidth: `${headlineMaxWidthCh}ch`,
            }}
          >
            <InlineText as="span" value={headline} onUpdate={field("headline")} multiline style={{ fontFamily: DISPLAY }}/>
          </motion.h1>

          {(dateText || locationText) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                alignItems: align === "center" ? "center" : "flex-start",
              }}
            >
              {dateText && (
                <p style={{ margin: 0, fontSize: dateFontSize, fontWeight: 400, color: "rgba(255,255,255,0.92)", textShadow: "0 1px 8px rgba(0,0,0,0.4)", fontFamily: BODY }}>
                  <InlineText as="span" value={dateText} onUpdate={field("dateText")} style={{ fontFamily: BODY }}/>
                </p>
              )}
              {locationText && (
                <p style={{ margin: 0, fontSize: "clamp(0.875rem, 1.6vw, 1rem)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.78)", fontFamily: BODY }}>
                  <InlineText as="span" value={locationText} onUpdate={field("locationText")} style={{ fontFamily: BODY }}/>
                </p>
              )}
            </motion.div>
          )}

          {ctaText && (
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              onClick={handleCtaClick}
              whileHover={{ y: -2 }}
              style={{
                marginTop: "clamp(0.5rem, 2vh, 1rem)",
                position: "relative",
                overflow: "hidden",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: 9999,
                background: P,
                color: ctaFg,
                padding: "0.95rem 2rem",
                fontSize: "clamp(0.8125rem, 1.4vw, 0.9375rem)",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                border: "none",
                cursor: "pointer",
                // When `ctaDropShadow` is on, layer a tighter inner shadow with
                // a wider, softer outer halo so the button reads as elevated
                // off the hero photo. Otherwise keep the original subtle one.
                // Color + intensity are user-editable; defaults reproduce the
                // original black `rgba(0,0,0,…)` look exactly when intensity=1.
                boxShadow: (() => {
                  const k = Math.max(0, Math.min(2, ctaDropShadowIntensity));
                  if (k === 0) return "none";
                  return ctaDropShadow
                    ? `0 2px 6px ${hexToRgba(ctaDropShadowColor, 0.25 * k)}, 0 18px 42px ${hexToRgba(ctaDropShadowColor, 0.55 * k)}`
                    : `0 8px 28px ${hexToRgba(ctaDropShadowColor, 0.35 * k)}`;
                })(),
                transition: "background-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = A;
                e.currentTarget.style.color = accentFg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = P;
                e.currentTarget.style.color = ctaFg;
              }}
            >
              <InlineText as="span" value={ctaText} onUpdate={field("ctaText")} style={{ fontFamily: BODY }}/>
              {ctaShine && (
                // Diagonal sheen sweeping across the button every few seconds.
                // `pointer-events: none` so it never intercepts the click, and
                // `mix-blend-mode: screen` keeps the sheen visible on both
                // light- and dark-tinted button backgrounds. Color + opacity
                // are user-editable; defaults (white, intensity=1) reproduce
                // the original look exactly.
                <motion.span aria-hidden initial={{ x: "-120%" }} animate={{ x: "220%" }} transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" }} style={{ position: "absolute", top: 0, left: 0, width: "55%", height: "100%", pointerEvents: "none", background: `linear-gradient(115deg, ${hexToRgba(ctaShineColor, 0)} 0%, ${hexToRgba(ctaShineColor, 0.55)} 50%, ${hexToRgba(ctaShineColor, 0)} 100%)`, opacity: Math.max(0, Math.min(1, ctaShineIntensity)), mixBlendMode: "screen", transform: "skewX(-20deg)", fontFamily: BODY }} />
              )}
            </motion.button>
          )}
        </motion.div>

        {/* Scroll-down indicator */}
        {showScrollIndicator && (
          <motion.button
            type="button"
            onClick={handleScrollClick}
            aria-label={scrollLabel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            style={{
              position: "absolute",
              bottom: "clamp(1.5rem, 5vh, 3rem)",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 3,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              padding: "0.5rem 1rem",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textShadow: "0 1px 8px rgba(0,0,0,0.4)", fontFamily: BODY }}>
              {scrollLabel}
            </span>
            <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} style={{ display: "inline-flex", fontFamily: BODY }}>
              <ChevronDown style={{ width: 18, height: 18 }} />
            </motion.span>
          </motion.button>
        )}
      </section>

      {/* Details + RSVP section */}
      {showDetailsSection && (
        <section
          id={detailsAnchorId || undefined}
          style={{
            background: detailsTheme.bg,
            color: detailsTheme.fg,
            padding: "clamp(3.5rem, 9vh, 6.5rem) clamp(1.25rem, 5vw, 3rem)",
          }}
        >
          <div
            style={{
              maxWidth: 1180,
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: swapColumns
                ? `minmax(0, 1fr) minmax(0, ${copyColWidth.toFixed(2)}fr)`
                : `minmax(0, ${copyColWidth.toFixed(2)}fr) minmax(0, 1fr)`,
              gap: "clamp(2rem, 5vw, 4rem)",
              alignItems: "start",
            }}
            className="evlh-details-grid"
          >
            {/* Copy column (visually left by default; swappable). Uses `order`
                so the DOM stays semantic (copy first, then form) while the
                grid renders the requested visual order. */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "clamp(1.75rem, 4vh, 2.5rem)",
                paddingTop: leftColTopPad ? `${leftColTopPad}rem` : undefined,
                order: swapColumns ? 2 : 1,
              }}
            >
              {(whatToExpectHeading || whatToExpectBody) && (
                <div>
                  {whatToExpectHeading && (
                    <h2
                      style={{
                        margin: "0 0 0.85rem 0",
                        fontFamily: DISPLAY_FONT,
                        fontSize: "clamp(1.5rem, 3.4vw, 2.25rem)",
                        lineHeight: 1.15,
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      <InlineText as="span" value={whatToExpectHeading} onUpdate={field("whatToExpectHeading")} style={{ fontFamily: DISPLAY }}/>
                    </h2>
                  )}
                  {whatToExpectBody && (
                    <p style={{ margin: 0, fontSize: "clamp(0.9375rem, 1.6vw, 1.0625rem)", lineHeight: 1.6, color: detailsTheme.muted, fontFamily: BODY }}>
                      <InlineText as="span" value={whatToExpectBody} onUpdate={field("whatToExpectBody")} multiline style={{ fontFamily: BODY }}/>
                    </p>
                  )}
                </div>
              )}

              {(eventDetailsHeading || eventDetailsBody || (eventDetailsBullets && eventDetailsBullets.length > 0)) && (
                <div
                  style={{
                    borderTop: `1px solid ${detailsTheme.rule}`,
                    paddingTop: "clamp(1.25rem, 3vh, 1.75rem)",
                  }}
                >
                  {eventDetailsHeading && (
                    <h3
                      style={{
                        margin: "0 0 0.85rem 0",
                        fontFamily: DISPLAY_FONT,
                        fontSize: "clamp(1.25rem, 2.6vw, 1.625rem)",
                        lineHeight: 1.2,
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      <InlineText as="span" value={eventDetailsHeading} onUpdate={field("eventDetailsHeading")} style={{ fontFamily: DISPLAY }}/>
                    </h3>
                  )}
                  {eventDetailsBody && (
                    <p style={{ margin: "0 0 1rem 0", fontSize: "clamp(0.9375rem, 1.6vw, 1rem)", lineHeight: 1.6, color: detailsTheme.muted, fontFamily: BODY }}>
                      <InlineText as="span" value={eventDetailsBody} onUpdate={field("eventDetailsBody")} multiline style={{ fontFamily: BODY }}/>
                    </p>
                  )}
                  {eventDetailsBullets && eventDetailsBullets.length > 0 && (
                    <ul
                      style={{
                        margin: 0,
                        padding: 0,
                        listStyle: "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      {eventDetailsBullets.map((bullet, i) => (
                        <li key={i} style={{ position: "relative", paddingLeft: "1.5rem", fontSize: "clamp(0.9375rem, 1.5vw, 1rem)", lineHeight: 1.55, color: detailsTheme.fg, fontFamily: BODY }}>
                          <span aria-hidden style={{ position: "absolute", left: 0, top: "0.55em", width: 8, height: 8, borderRadius: 9999, background: A, display: "inline-block", fontFamily: BODY }} />
                          {onFieldChange ? (
                            <InlineText
                              as="span"
                              value={bullet}
                              onUpdate={(v) => onFieldChange({
                                ...props,
                                eventDetailsBullets: (eventDetailsBullets ?? []).map((b, idx) => idx === i ? v : b),
                              })}
                            style={{ fontFamily: BODY }}/>
                          ) : isLikelyHtml(bullet) ? (
                            // Render through the same allowlist sanitizer as
                            // InlineText so inline formatting (`<b style={{ fontFamily: BODY }}>`, `<em style={{ fontFamily: BODY }}>`,
                            // links) the user added in the builder appears
                            // formatted in the live viewer instead of as
                            // literal `<b style={{ fontFamily: BODY }}>…</b>` text.
                            <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(bullet) }} style={{ fontFamily: BODY }}/>
                          ) : (
                            bullet
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Optional extra section — third row in the copy column. Hidden
                  when both heading and body are empty so existing pages render
                  unchanged. */}
              {(extraSectionHeading || extraSectionBody) && (
                <div
                  style={{
                    borderTop: `1px solid ${detailsTheme.rule}`,
                    paddingTop: "clamp(1.25rem, 3vh, 1.75rem)",
                  }}
                >
                  {extraSectionHeading && (
                    <h3
                      style={{
                        margin: "0 0 0.85rem 0",
                        fontFamily: DISPLAY_FONT,
                        fontSize: "clamp(1.25rem, 2.6vw, 1.625rem)",
                        lineHeight: 1.2,
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      <InlineText as="span" value={extraSectionHeading} onUpdate={field("extraSectionHeading")} style={{ fontFamily: DISPLAY }}/>
                    </h3>
                  )}
                  {extraSectionBody && (
                    <p style={{ margin: 0, fontSize: "clamp(0.9375rem, 1.6vw, 1rem)", lineHeight: 1.6, color: detailsTheme.muted, fontFamily: BODY }}>
                      <InlineText as="span" value={extraSectionBody} onUpdate={field("extraSectionBody")} multiline style={{ fontFamily: BODY }}/>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Form column (visually right by default; swaps to left when
                `swapColumns` is true). */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
                paddingTop: rightColTopPad ? `${rightColTopPad}rem` : undefined,
                order: swapColumns ? 1 : 2,
              }}
            >
              {(formHeading || formSubheading) && (
                <div>
                  {formHeading && (
                    <h3
                      style={{
                        margin: "0 0 0.5rem 0",
                        fontFamily: DISPLAY_FONT,
                        fontSize: "clamp(1.5rem, 3vw, 2rem)",
                        lineHeight: 1.15,
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                        color: detailsTheme.fg,
                      }}
                    >
                      <InlineText as="span" value={formHeading} onUpdate={field("formHeading")} style={{ fontFamily: DISPLAY }}/>
                    </h3>
                  )}
                  {formSubheading && (
                    <p style={{ margin: 0, fontSize: "clamp(0.9375rem, 1.5vw, 1rem)", lineHeight: 1.5, color: detailsTheme.muted, fontFamily: BODY }}>
                      <InlineText as="span" value={formSubheading} onUpdate={field("formSubheading")} multiline style={{ fontFamily: BODY }}/>
                    </p>
                  )}
                </div>
              )}

              {hasForm ? (
                <div className="evlh-form-slot">
                  <BlockForm
                    props={embeddedForm}
                    brand={brand}
                    pageId={pageId}
                    testId={testId}
                    variantId={variantId}
                    sessionId={sessionId}
                  />
                </div>
              ) : (
                <div
                  style={{
                    border: `1px dashed ${detailsTheme.rule}`,
                    borderRadius: 16,
                    padding: "1.25rem 1.5rem",
                    fontSize: 13,
                    color: detailsTheme.muted,
                    background: "rgba(255,255,255,0.6)",
                  }}
                >
                  {formMode === "marketo"
                    ? "Add your Marketo instance URL, Munchkin ID, and Form ID in the right panel to embed the form here."
                    : "Pick a form in the right panel to embed your RSVP form here."}
                </div>
              )}
            </div>
          </div>

          {/* Stack the two columns on narrow viewports. Scoped via a class so
              we don't need to add Tailwind config or a global stylesheet. */}
          <style>{`
            @media (max-width: 820px) {
              .evlh-details-grid { grid-template-columns: 1fr !important; }
            }
            /* Trim BlockForm's outer section padding when nested inside the
               details column so it visually aligns with the left column. */
            .evlh-form-slot > section { padding: 0 !important; background: transparent !important; }
          `}</style>
        </section>
      )}
    </>
  );
}
