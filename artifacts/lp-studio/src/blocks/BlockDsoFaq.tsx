import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import type { DsoFaqBlockProps } from "@/lib/block-types";
import { getBgStyle, resolveSectionSurface } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses } from "@/lib/brand-config";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { BlockDsoCta } from "@/components/BlockDsoCta";
import { InlineText } from "@/components/InlineText";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props {
  props: DsoFaqBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DsoFaqBlockProps) => void;
}

const BRAND   = "var(--brand-primary, #0f172a)";
const LIME    = "var(--brand-accent, hsl(68,60%,52%))";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_STACK;

const ITEM_SIZES = {
  sm: { q: "1rem", icon: 16, padY: "1rem", gap: "0.875rem" },
  md: { q: "1.25rem", icon: 20, padY: "1.375rem", gap: "1rem" },
  lg: { q: "1.5rem", icon: 24, padY: "1.625rem", gap: "1.125rem" },
} as const;

export function BlockDsoFaq({ props, brand, onFieldChange }: Props) {
  const { eyebrow, headline, subheadline, items = [], itemSize = "md", ctaText, ctaUrl, ctaMode = "link", ctaVariant = "secondary", backgroundStyle = "white" } = props;
  const SZ = ITEM_SIZES[itemSize] ?? ITEM_SIZES.md;
  const field = (key: keyof DsoFaqBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as DsoFaqBlockProps[typeof key] }) : undefined;
  const updateItem = onFieldChange
    ? (idx: number, patch: Partial<NonNullable<DsoFaqBlockProps["items"]>[number]>) =>
        onFieldChange({
          ...props,
          items: items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
        })
    : undefined;
  const [open, setOpen] = useState<number | null>(0);
  const dark = resolveSectionSurface({ backgroundStyle: backgroundStyle }, "#ffffff", brand).isDark;
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const qC        = dark ? "#fff" : BRAND;
  const aC        = dark ? "rgba(255,255,255,0.65)" : "#4b5563";
  const divider   = dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e5ea";
  const toggleC   = dark ? LIME : BRAND;

  return (
    <section style={sectionBg} className="py-24 md:py-32">
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          {eyebrow && (
            <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: eyebrowC, marginBottom: "1.25rem", fontFamily: BODY }}>
              <InlineText as="span" value={eyebrow} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }}/>
            </motion.p>
          )}
          {headline && (
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              style={{ fontFamily: DISPLAY, fontSize: "clamp(1.875rem,3.5vw,2.75rem)", lineHeight: 1.15, fontWeight: 600, color: headlineC, letterSpacing: "-0.015em" }}
            >
              <InlineText as="span" value={headline} onUpdate={field("headline")} multiline style={{ fontFamily: DISPLAY }}/>
            </motion.h2>
          )}
          {subheadline && (
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }} style={{ marginTop: "1rem", fontSize: "1.0625rem", color: subC, lineHeight: 1.7, fontFamily: BODY }}>
              <InlineText as="span" value={subheadline} onUpdate={field("subheadline")} multiline style={{ fontFamily: BODY }}/>
            </motion.p>
          )}
        </div>

        <div style={{ marginBottom: ctaText ? "3rem" : 0 }}>
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              style={{ borderBottom: divider, ...(i === 0 ? { borderTop: divider } : {}) }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  padding: `${SZ.padY} 0.25rem`,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  gap: SZ.gap,
                }}
              >
                <motion.span
                  animate={{ rotate: open === i ? 45 : 0 }}
                  transition={{ duration: 0.22 }}
                  style={{ flexShrink: 0, display: "inline-flex", marginTop: `calc(${SZ.q} * 0.7 - ${SZ.icon}px / 2)` }}
                >
                  <Plus style={{ width: SZ.icon, height: SZ.icon, color: toggleC }} strokeWidth={2.25} />
                </motion.span>
                <span style={{ fontSize: SZ.q, fontWeight: 600, color: qC, lineHeight: 1.4, flex: 1, fontFamily: DISPLAY, letterSpacing: "-0.01em" }}>
                  <InlineText
                    as="span"
                    value={item.question}
                    onUpdate={updateItem ? (v) => updateItem(i, { question: v }) : undefined}
                  style={{ fontFamily: DISPLAY }}/>
                </span>
              </button>

              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <p style={{ padding: `0 0.25rem ${SZ.padY} calc(${SZ.icon}px + ${SZ.gap} + 0.25rem)`, fontSize: "0.9375rem", color: aC, lineHeight: 1.75, fontFamily: BODY, maxWidth: "62ch" }}>
                      <InlineText
                        as="span"
                        value={item.answer}
                        onUpdate={updateItem ? (v) => updateItem(i, { answer: v }) : undefined}
                        multiline
                      style={{ fontFamily: BODY }}/>
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {ctaText && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            style={{ textAlign: "center" }}
          >
            <BlockDsoCta ctaText={ctaText} ctaUrl={ctaUrl} ctaMode={ctaMode} ctaVariant={ctaVariant} brand={brand} dark={dark} />
          </motion.div>
        )}
      </div>
    </section>
  );
}
