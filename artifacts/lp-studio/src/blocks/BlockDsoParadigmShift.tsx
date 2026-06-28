import { motion } from "framer-motion";
import { XCircle, CheckCircle2 } from "lucide-react";
import type { DsoParadigmShiftBlockProps } from "@/lib/block-types";
import { getBgStyle, resolveSectionSurface } from "@/lib/bg-styles";
import { resolveBrandColor, pickContrastingColor, relativeLuminance } from "@/lib/brand-config";
import type { BrandConfig } from "@/lib/brand-config";
import { BlockDsoCta } from "@/components/BlockDsoCta";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: DsoParadigmShiftBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DsoParadigmShiftBlockProps) => void;
}

const BRAND   = "var(--brand-primary, #0f172a)";
const LIME    = "var(--brand-accent, #3b82f6)"; /* alpha-concat literal */
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_STACK;

export function BlockDsoParadigmShift({ props, brand, onFieldChange }: Props) {
  const {
    eyebrow, headline, subheadline,
    oldWayLabel = "Traditional Lab",
    newWayLabel = "The New Way",
    oldWayItems = [],
    newWayItems = [],
    ctaText, ctaUrl, ctaMode = "link", ctaVariant = "primary",
    backgroundStyle = "dark",
    headlineColor, oldWayCardBg, newWayCardBg, cardTextColor,
  } = props;
  const field = (key: keyof DsoParadigmShiftBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as DsoParadigmShiftBlockProps[typeof key] }) : undefined;
  const updateOldItem = onFieldChange
    ? (i: number, v: string) => onFieldChange({ ...props, oldWayItems: oldWayItems.map((it, idx) => idx === i ? v : it) })
    : undefined;
  const updateNewItem = onFieldChange
    ? (i: number, v: string) => onFieldChange({ ...props, newWayItems: newWayItems.map((it, idx) => idx === i ? v : it) })
    : undefined;

  const surface = resolveSectionSurface({ backgroundStyle: backgroundStyle }, "#ffffff", brand);
  const dark = surface.isDark;
  const sectionBg = getBgStyle(backgroundStyle);

  // ── light-mode tokens ──────────────────────────────────────────
  // Section uses a very light mint tint so white cards pop
  const lightSectionBg = { backgroundColor: "#f2f5f2" };
  const effectiveSectionBg = dark ? sectionBg : lightSectionBg;

  // Concrete hex for the painted section surface, fed to all contrast math.
  // CRITICAL: resolve var(--brand-*) to a live hex BEFORE any contrast/luminance
  // call — a raw var() string reads as "light" and silently mispicks colors.
  const sectionBaseHex = dark ? surface.base : "#f2f5f2";
  const brandPrimaryHex = resolveBrandColor(brand, BRAND, "#0f172a");
  const brandAccentHex  = resolveBrandColor(brand, LIME, "#3b82f6");

  // ── Section header (derives ink from the real section surface) ──
  const headlineC = headlineColor
    ?? (dark ? "#ffffff" : pickContrastingColor(brandPrimaryHex, sectionBaseHex, ["#0f172a", "#111827"], 4.5));
  const eyebrowC  = dark
    ? pickContrastingColor(brandAccentHex, sectionBaseHex, ["#ffffff"], 3)
    : pickContrastingColor(brandPrimaryHex, sectionBaseHex, ["#0f172a"], 4.5);
  const subC      = dark ? "rgba(255,255,255,0.60)" : "#6b7280";

  // ── Old Way card ──────────────────────────────────────────────
  // Default bg is a translucent overlay (≈ section) or a light neutral; derive
  // its ink from the override hex when set, else from the section surface.
  const oldCardBg        = oldWayCardBg ?? (dark ? "rgba(255,255,255,0.04)" : "#e8ece8");
  const oldCardSurface   = oldWayCardBg ?? (dark ? sectionBaseHex : "#e8ece8");
  const oldCardDark      = relativeLuminance(oldCardSurface) < 0.4;
  const oldCardBor       = oldCardDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #d4d9d4";
  const oldSubC          = oldCardDark ? "rgba(255,255,255,0.45)" : "#9ca3af";
  const oldHeadC         = cardTextColor ?? (oldCardDark ? "rgba(255,255,255,0.70)" : "#374151");
  const oldItemC         = cardTextColor ?? (oldCardDark ? "rgba(255,255,255,0.60)" : "#6b7280");
  const oldIconC         = "#f87171"; // soft red

  // ── New Way card (the bug fix) ────────────────────────────────
  // Was hardcoded to the brand-primary var() bg + white text; a light brand
  // primary then painted a near-white card with invisible white text. Resolve
  // the card bg to a concrete hex and derive readable ink from its luminance.
  const newCardBg        = newWayCardBg ?? brandPrimaryHex;
  const newCardDark      = relativeLuminance(newCardBg) < 0.4;
  const newCardBor       = newCardDark ? `2px solid rgb(var(--brand-accent-rgb, 59 130 246) / 0.55)` : "2px solid rgba(0,0,0,0.08)";
  const newHeadC         = cardTextColor ?? (newCardDark ? "#ffffff" : "#0b0b0f");
  const newItemC         = cardTextColor ?? (newCardDark ? "rgba(255,255,255,0.88)" : "rgba(11,11,15,0.82)");
  const newSubC          = pickContrastingColor(brandAccentHex, newCardBg, [newCardDark ? "#ffffff" : "#0b0b0f"], 3);
  const newIconC         = newSubC;

  return (
    <section style={effectiveSectionBg} className="py-24 md:py-32">
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 1.5rem" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          {(eyebrow || onFieldChange) && (
            <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: eyebrowC, marginBottom: "1.25rem", fontFamily: BODY }}>
              <InlineText value={eyebrow ?? ""} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }}/>
            </motion.p>
          )}
          {(headline || onFieldChange) && (
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              style={{ fontFamily: DISPLAY, fontSize: "clamp(2rem,4vw,3rem)", lineHeight: 1.1, fontWeight: 600, color: headlineC, letterSpacing: "-0.02em", whiteSpace: "pre-line" }}
            >
              <InlineText value={headline ?? ""} onUpdate={field("headline")} multiline style={{ fontFamily: DISPLAY }}/>
            </motion.h2>
          )}
          {(subheadline || onFieldChange) && (
            <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} style={{ marginTop: "1.25rem", fontSize: "1.0625rem", color: subC, lineHeight: 1.7, maxWidth: 580, margin: "1.25rem auto 0", fontFamily: BODY }}>
              <InlineText value={subheadline ?? ""} onUpdate={field("subheadline")} multiline style={{ fontFamily: BODY }}/>
            </motion.p>
          )}
        </div>

        {/* ── Cards ── */}
        <div style={{ display: "grid", gap: "1.25rem" }} className="grid-cols-1 md:grid-cols-2">

          {/* Old Way */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            style={{
              background: oldCardBg,
              border: oldCardBor,
              borderRadius: "1.25rem",
              padding: "2.25rem",
            }}
          >
            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: oldSubC, marginBottom: "0.5rem", fontFamily: BODY }}>
                Old Way
              </p>
              <h3 style={{ fontFamily: DISPLAY, fontSize: "1.75rem", fontWeight: 600, color: oldHeadC, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                <InlineText value={oldWayLabel} onUpdate={field("oldWayLabel")} style={{ fontFamily: DISPLAY }}/>
              </h3>
            </div>
            <ul style={{ display: "flex", flexDirection: "column", gap: "1rem" }} aria-label="Old Way">
              {oldWayItems.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 + i * 0.06 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
                >
                  <XCircle
                    aria-hidden="true"
                    style={{ width: 20, height: 20, color: oldIconC, flexShrink: 0, marginTop: 1 }}
                  />
                  <span style={{ fontSize: "0.9375rem", color: oldItemC, lineHeight: 1.6, fontFamily: BODY }}>
                    <InlineText value={item} onUpdate={updateOldItem ? (v) => updateOldItem(i, v) : undefined} style={{ fontFamily: BODY }}/>
                  </span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* New Way */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
            style={{
              background: newCardBg,
              border: newCardBor,
              borderRadius: "1.25rem",
              padding: "2.25rem",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Subtle top-right glow */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute", top: -60, right: -60,
                width: 200, height: 200, borderRadius: "50%",
                background: `rgb(var(--brand-accent-rgb, 59 130 246) / 0.094)`,
                filter: "blur(50px)",
                pointerEvents: "none",
              }}
            />
            <div style={{ marginBottom: "1.5rem", position: "relative" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: newSubC, marginBottom: "0.5rem", fontFamily: BODY }}>
                New Way
              </p>
              <h3 style={{ fontFamily: DISPLAY, fontSize: "1.75rem", fontWeight: 600, color: newHeadC, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                <InlineText value={newWayLabel} onUpdate={field("newWayLabel")} style={{ fontFamily: DISPLAY }}/>
              </h3>
            </div>
            <ul style={{ display: "flex", flexDirection: "column", gap: "1rem", position: "relative" }} aria-label="New Way">
              {newWayItems.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
                >
                  <CheckCircle2
                    aria-hidden="true"
                    style={{ width: 20, height: 20, color: newIconC, flexShrink: 0, marginTop: 1 }}
                  />
                  <span style={{ fontSize: "0.9375rem", color: newItemC, lineHeight: 1.6, fontWeight: 500, fontFamily: BODY }}>
                    <InlineText value={item} onUpdate={updateNewItem ? (v) => updateNewItem(i, v) : undefined} style={{ fontFamily: BODY }}/>
                  </span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* CTA */}
        {ctaText && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            style={{ textAlign: "center", marginTop: "3rem" }}
          >
            <BlockDsoCta ctaText={ctaText} ctaUrl={ctaUrl} ctaMode={ctaMode} ctaVariant={ctaVariant} brand={brand} dark={dark} />
          </motion.div>
        )}
      </div>
    </section>
  );
}
