import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import type { DsoSplitFeatureBlockProps } from "@/lib/block-types";
import { getBgStyle, resolveSectionSurface } from "@/lib/bg-styles";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { extractWistiaId, isWistiaShareLink, resolveWistiaShareLink, wistiaIframeUrl } from "@/lib/wistia";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props {
  props: DsoSplitFeatureBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DsoSplitFeatureBlockProps) => void;
}

const BRAND   = "var(--brand-primary, #0f172a)";
const LIME    = "var(--brand-accent, hsl(68,60%,52%))";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_STACK;

export function BlockDsoSplitFeature({ props, brand, onFieldChange }: Props) {
  const {
    eyebrow,
    headline,
    body,
    bullets = [],
    ctaText,
    ctaUrl,
    ctaMode = "link",
    imageUrl,
    videoPlayMode = "inline",
    imagePosition = "right",
    backgroundStyle = "white",
  } = props;

  // wistiaUrl is the canonical prop; legacy pages saved the video under
  // `videoUrl`, which doubles as a primary-CTA alias and gets clobbered by an
  // active Page CTA — hence the rename. Fallback keeps legacy pages playing
  // (whenever no Page CTA interferes) until the panel migrates them.
  const videoSource = props.wistiaUrl || props.videoUrl || "";
  const directId = videoSource ? extractWistiaId(videoSource) : null;
  // wistia.com/s/<token> share links carry a token, not the media id — the
  // panel normalises them on paste, but pages saved with a raw share link
  // (or generator output) still resolve here at render time via oEmbed.
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  useEffect(() => {
    setResolvedId(null);
    if (!videoSource || directId || !isWistiaShareLink(videoSource)) return;
    let cancelled = false;
    void resolveWistiaShareLink(videoSource).then((id) => {
      if (!cancelled && id) setResolvedId(id);
    });
    return () => { cancelled = true; };
  }, [videoSource, directId]);
  const wistiaId = directId ?? resolvedId;
  // Inline playback: the thumbnail swaps to the autoplaying player in place.
  const [playing, setPlaying] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setModalOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  const dark = resolveSectionSurface({ backgroundStyle: backgroundStyle }, "#ffffff", brand).isDark;
  const sectionBg = getBgStyle(backgroundStyle);
  const field = (key: keyof DsoSplitFeatureBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const updateBullet = (i: number, v: string) => {
    if (!onFieldChange) return;
    const next = bullets.slice();
    next[i] = v;
    onFieldChange({ ...props, bullets: next });
  };

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const bodyC     = dark ? "rgba(255,255,255,0.6)" : "#4b5563";
  const bulletC   = dark ? "rgba(255,255,255,0.75)" : "#374151";
  const checkC    = dark ? LIME : BRAND;
  const imgBg     = dark ? "rgba(255,255,255,0.05)" : `rgb(var(--brand-primary-rgb, 15 23 42) / 0.031)`;
  const imgBor    = dark ? "rgba(255,255,255,0.08)" : `rgb(var(--brand-primary-rgb, 15 23 42) / 0.082)`;

  const textCol = (
    <motion.div
      initial={{ opacity: 0, x: imagePosition === "left" ? 30 : -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.25rem" }}
    >
      {(eyebrow || onFieldChange) && (
        <InlineText as="p" value={eyebrow ?? ""} onUpdate={field("eyebrow")} animate={{ y: 10 }} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: eyebrowC, fontFamily: BODY }} />
      )}

      {(headline || onFieldChange) && (
        <InlineText
          as="h2"
          value={headline ?? ""}
          onUpdate={field("headline")}
          animate={{ y: 20, delay: 0.05 }}
          style={{
            fontFamily: DISPLAY,
            fontSize: "clamp(1.875rem,3.5vw,2.75rem)",
            lineHeight: 1.15,
            fontWeight: 600,
            color: headlineC,
            letterSpacing: "-0.015em",
          }}
        />
      )}

      {(body || onFieldChange) && (
        <InlineText as="p" value={body ?? ""} onUpdate={field("body")} multiline animate={{ y: 15, delay: 0.12 }} style={{ fontSize: "1.0625rem", lineHeight: 1.75, color: bodyC, fontFamily: BODY }} />
      )}

      {bullets.length > 0 && (
        <ul style={{ display: "flex", flexDirection: "column", gap: "0.625rem", listStyle: "none", padding: 0, margin: 0 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", fontFamily: BODY }}>
              <CheckCircle2 style={{ width: 18, height: 18, color: checkC, flexShrink: 0, marginTop: 2 }} />
              <InlineText as="span" value={b} onUpdate={onFieldChange ? (v) => updateBullet(i, v) : undefined} style={{ fontSize: "0.9375rem", color: bulletC, lineHeight: 1.55, fontFamily: BODY }} />
            </li>
          ))}
        </ul>
      )}

      {ctaText && (
        <div style={{ paddingTop: "0.5rem" }}>
          {ctaMode === "chilipiper" ? (
            <ChiliPiperButton
              url={ctaUrl || ""}
              className={getButtonClasses(brand, "inline-flex items-center")}
              style={{ backgroundColor: brand.accentColor, color: brand.primaryColor }}
            >
              {ctaText}
            </ChiliPiperButton>
          ) : (
            <motion.a
              href={ctaUrl || "#"}
              className={getButtonClasses(brand, "inline-flex items-center")}
              style={{ backgroundColor: brand.accentColor, color: brand.primaryColor, textDecoration: "none" }}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.96 }}
              transition={SPRING}
            >
              {ctaText}
            </motion.a>
          )}
        </div>
      )}
    </motion.div>
  );

  const imageCol = (
    <motion.div
      initial={{ opacity: 0, x: imagePosition === "left" ? -30 : 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.65 }}
      style={{
        borderRadius: "1.25rem",
        overflow: "hidden",
        background: wistiaId ? "#000" : imgBg,
        border: `1px solid ${imgBor}`,
        // 16/9 when a video rides the column so the thumbnail and the
        // playing iframe share one footprint — no layout shift on play.
        aspectRatio: wistiaId ? "16/9" : "4/3",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {wistiaId && (playing || !imageUrl) ? (
        // Playing inline, or no thumbnail image at all — embed the player
        // directly (Wistia's own poster covers the no-image case).
        <iframe
          src={wistiaIframeUrl(wistiaId, { autoPlay: playing })}
          allow="autoplay; fullscreen"
          allowFullScreen
          title={headline || "Video"}
          style={{ width: "100%", height: "100%", border: 0, display: "block" }}
        />
      ) : wistiaId && imageUrl ? (
        <button
          type="button"
          onClick={() => (videoPlayMode === "modal" ? setModalOpen(true) : setPlaying(true))}
          aria-label="Play video"
          style={{ all: "unset", cursor: "pointer", width: "100%", height: "100%", display: "block", position: "relative" }}
        >
          <img
            src={imageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.18)",
            }}
          >
            <span
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.92)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill={BRAND} aria-hidden style={{ marginLeft: 3 }}>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            minHeight: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="64" height="64" rx="16" fill={dark ? "rgba(255,255,255,0.06)" : `rgb(var(--brand-primary-rgb, 15 23 42) / 0.063)`} />
            <path d="M20 44 C20 32 32 20 44 20" stroke={dark ? LIME : BRAND} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
            <circle cx="32" cy="32" r="8" fill={dark ? LIME : BRAND} opacity="0.2" />
          </svg>
          <p style={{ fontSize: "0.8125rem", color: dark ? "rgba(255,255,255,0.25)" : `rgb(var(--brand-primary-rgb, 15 23 42) / 0.251)`, fontFamily: BODY }}>Add image URL in properties</p>
        </div>
      )}
    </motion.div>
  );

  return (
    <section style={sectionBg} className="py-20 md:py-28">
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "3.5rem",
            alignItems: "center",
          }}
        >
          {imagePosition === "left" ? (
            <>
              {imageCol}
              {textCol}
            </>
          ) : (
            <>
              {textCol}
              {imageCol}
            </>
          )}
        </div>
      </div>

      {modalOpen && wistiaId && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 md:p-8"
          onClick={() => setModalOpen(false)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setModalOpen(false); }}
            aria-label="Close video"
            className="absolute top-4 right-4 md:top-6 md:right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div
            className="relative bg-black rounded-2xl overflow-hidden shadow-2xl"
            style={{ width: "min(92vw, 960px)", aspectRatio: "16/9", maxHeight: "82vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={wistiaIframeUrl(wistiaId, { autoPlay: true })}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="w-full h-full border-0"
              title={headline || "Video"}
            />
          </div>
        </div>
      )}
    </section>
  );
}
