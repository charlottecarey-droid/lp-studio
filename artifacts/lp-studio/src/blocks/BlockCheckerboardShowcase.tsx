import { motion } from "framer-motion";
import { useAnimInitial } from "@/lib/reveal-fallback";
import type { CheckerboardShowcaseBlockProps, CheckerboardShowcaseItem } from "@/lib/block-types";
import { getBgStyle, resolveSectionSurface } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK } from "../lib/brand-fonts";

const BRAND = "var(--brand-primary, #0f172a)";
const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_STACK;

interface Props {
  props: CheckerboardShowcaseBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CheckerboardShowcaseBlockProps) => void;
}

/**
 * Checkerboard Showcase — full-bleed alternating "switchback" squares: each
 * row pairs an edge-to-edge image tile with a text tile, flipping sides every
 * row so the images fall in a checkerboard. Hairline rules frame every tile,
 * and each row carries a thin vertical gradient "rail" on the text tile's
 * outer edge with small icon chips and a rotated micro-label — the editorial
 * museum-plaque look. On mobile the grid stacks and the rail becomes a slim
 * horizontal bar under the row.
 */

// Decorative multi-hue gradient for the rail. Deliberately NOT brand-derived —
// it's an accent artifact (like a printed color calibration strip), and the
// mixed hues read as neutral against any brand palette.
const RAIL_GRADIENT_STOPS =
  "rgb(67,103,67) 0%, rgb(233,184,72) 20%, rgb(185,177,212) 45%, rgb(121,171,255) 68%, rgb(175,100,25) 100%";

// Small original decorative glyphs for the rail chips (stroke = current ink).
function RailGlyphTop({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <ellipse cx="6" cy="6" rx="5" ry="3" stroke={color} strokeWidth="0.9" />
      <circle cx="6" cy="6" r="1.4" stroke={color} strokeWidth="0.9" />
    </svg>
  );
}
function RailGlyphBottom({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1v10M1 6h10M2.5 2.5l7 7M9.5 2.5l-7 7" stroke={color} strokeWidth="0.9" />
    </svg>
  );
}

export function BlockCheckerboardShowcase({ props, brand, onFieldChange }: Props) {
  // Fail-open reveal — see lib/reveal-fallback.ts.
  const anim = useAnimInitial();
  const {
    eyebrow,
    headline,
    subheadline,
    items = [],
    showRails = true,
    backgroundStyle = "white",
  } = props;

  const dark = resolveSectionSurface({ backgroundStyle }, "#ffffff", brand).isDark;
  const sectionBg = getBgStyle(backgroundStyle);

  const field = (key: keyof CheckerboardShowcaseBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const updateItem = (i: number, key: keyof CheckerboardShowcaseItem, v: string) => {
    if (!onFieldChange) return;
    const next = items.map((it, idx) => (idx === i ? { ...it, [key]: v } : it));
    onFieldChange({ ...props, items: next });
  };

  const inkC      = dark ? "#ffffff" : BRAND;
  const softInkC  = dark ? "rgba(255,255,255,0.65)" : `rgb(var(--brand-primary-rgb, 15 23 42) / 0.65)`;
  const bodyInkC  = dark ? "rgba(255,255,255,0.55)" : `rgb(var(--brand-primary-rgb, 15 23 42) / 0.55)`;
  const hairline  = dark ? "rgba(255,255,255,0.16)" : "#dddddd";
  const chipBg    = dark ? "#111827" : "#ffffff";
  const imgBg     = dark ? "rgba(255,255,255,0.05)" : `rgb(var(--brand-primary-rgb, 15 23 42) / 0.031)`;

  // The vertical rail on the text tile's outer edge (md+ only).
  const rail = (item: CheckerboardShowcaseItem, reversed: boolean) => (
    <div
      aria-hidden="true"
      className="absolute inset-y-0 z-[2] hidden w-5 md:flex flex-col"
      style={{
        [reversed ? "right" : "left"]: 0,
        background: `linear-gradient(to bottom, ${RAIL_GRADIENT_STOPS})`,
        [reversed ? "borderLeft" : "borderRight"]: `1px solid ${hairline}`,
      }}
    >
      <div style={{ background: chipBg, padding: "4px 0 6px" }} className="flex justify-center">
        <RailGlyphTop color={softInkC} />
      </div>
      {item.railLabel && (
        <div
          className="flex justify-center"
          style={{
            background: chipBg,
            padding: "0.5rem 0",
            writingMode: "vertical-rl",
            textOrientation: "mixed",
          }}
        >
          <span
            style={{
              transform: "rotate(180deg)",
              fontSize: 10,
              lineHeight: 1,
              letterSpacing: "0.11em",
              textTransform: "uppercase",
              color: inkC,
              fontFamily: BODY,
            }}
          >
            {item.railLabel}
          </span>
        </div>
      )}
      <div className="flex-1" />
      <div style={{ background: chipBg, padding: "6px 0 4px" }} className="flex justify-center">
        <RailGlyphBottom color={softInkC} />
      </div>
    </div>
  );

  // Mobile stand-in: slim horizontal gradient bar under the row.
  const mobileRail = (item: CheckerboardShowcaseItem) => (
    <div
      aria-hidden="true"
      className="flex h-5 items-center md:hidden"
      style={{
        background: `linear-gradient(to right, ${RAIL_GRADIENT_STOPS})`,
        borderTop: `1px solid ${hairline}`,
      }}
    >
      {item.railLabel && (
        <span
          style={{
            background: chipBg,
            padding: "0.25rem 0.5rem",
            fontSize: 10,
            lineHeight: 1,
            letterSpacing: "0.11em",
            textTransform: "uppercase",
            color: inkC,
            fontFamily: BODY,
            height: "100%",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          {item.railLabel}
        </span>
      )}
    </div>
  );

  return (
    <section
      style={{ ...sectionBg, borderTop: `1px solid ${hairline}`, borderBottom: `1px solid ${hairline}` }}
      className="relative"
    >
      {/* Header */}
      {(eyebrow || headline || subheadline || onFieldChange) && (
        <motion.div
          initial={anim({ opacity: 0, y: 16, filter: "blur(8px)" })}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto flex flex-col items-center px-5 pt-14 pb-12 text-center md:pt-16"
          style={{ maxWidth: 670 }}
        >
          {(eyebrow || onFieldChange) && (
            <div
              className="mb-3 inline-flex items-center gap-2 rounded-full"
              style={{ border: `1px solid ${hairline}`, padding: "4px 10px" }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${RAIL_GRADIENT_STOPS})`,
                  flexShrink: 0,
                }}
              />
              <InlineText
                as="span"
                value={eyebrow ?? ""}
                onUpdate={field("eyebrow")}
                style={{ fontSize: 11, lineHeight: 1, letterSpacing: "-0.01em", color: inkC, fontFamily: BODY }}
              />
            </div>
          )}
          {(headline || onFieldChange) && (
            <InlineText
              as="h2"
              value={headline ?? ""}
              onUpdate={field("headline")}
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(2.5rem, 4.5vw, 3.4rem)",
                lineHeight: 1.02,
                fontWeight: 400,
                letterSpacing: "-0.01em",
                color: inkC,
                margin: 0,
              }}
            />
          )}
          {(subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={subheadline ?? ""}
              onUpdate={field("subheadline")}
              multiline
              style={{
                fontSize: "1.25rem",
                lineHeight: 1.3,
                color: softInkC,
                fontFamily: BODY,
                marginTop: "2.25rem",
              }}
            />
          )}
        </motion.div>
      )}

      {/* Checkerboard rows */}
      <div style={{ borderTop: `1px solid ${hairline}` }}>
        {items.map((item, i) => {
          const reversed = i % 2 === 1;
          const textTile = (
            <motion.div
              initial={anim({ opacity: 0, y: 16, filter: "blur(8px)" })}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
              className={`flex flex-col justify-center px-6 py-12 text-center md:py-0 md:text-left ${
                reversed ? "md:order-2 md:pr-[110px] md:pl-[100px]" : "md:pl-[110px] md:pr-[100px]"
              }`}
            >
              <InlineText
                as="h3"
                value={item.title}
                onUpdate={onFieldChange ? (v) => updateItem(i, "title", v) : undefined}
                style={{
                  fontFamily: DISPLAY,
                  fontSize: "clamp(1.75rem, 2.6vw, 2.2rem)",
                  lineHeight: 1.02,
                  fontWeight: 400,
                  letterSpacing: "-0.01em",
                  color: inkC,
                  maxWidth: 495,
                  margin: 0,
                }}
              />
              <InlineText
                as="p"
                value={item.body}
                onUpdate={onFieldChange ? (v) => updateItem(i, "body", v) : undefined}
                multiline
                style={{
                  fontSize: "0.875rem",
                  lineHeight: 1.4,
                  color: bodyInkC,
                  fontFamily: BODY,
                  maxWidth: 380,
                  marginTop: 12,
                }}
              />
            </motion.div>
          );
          const mediaTile = (
            <motion.div
              initial={anim({ opacity: 0 })}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className={`relative aspect-[4/3] md:aspect-square ${reversed ? "md:order-1" : ""}`}
              style={{ background: imgBg }}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              ) : onFieldChange ? (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ color: bodyInkC, fontFamily: BODY, fontSize: 13 }}
                >
                  Add image URL in properties
                </div>
              ) : null}
            </motion.div>
          );
          return (
            <div key={i} className="relative" style={{ borderBottom: i < items.length - 1 ? `1px solid ${hairline}` : "none" }}>
              <div className="grid md:grid-cols-2">
                {textTile}
                {mediaTile}
              </div>
              {showRails && rail(item, reversed)}
              {showRails && mobileRail(item)}
            </div>
          );
        })}
      </div>
    </section>
  );
}
