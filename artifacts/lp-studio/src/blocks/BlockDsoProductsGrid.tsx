import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Crown, SmilePlus, Stethoscope, Target, Scan, Sparkles, Moon, Shield } from "lucide-react";
import type { DsoProductsGridBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses } from "@/lib/brand-config";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { BlockDsoCta } from "@/components/BlockDsoCta";
import { InlineText } from "@/components/InlineText";

// Note: product photos are no longer bundled with the lp-studio JS.
// Pages provide imageUrl explicitly (uploaded to the tenant's media library).
// When imageUrl is missing the card falls back to its lucide icon below.

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props {
  props: DsoProductsGridBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DsoProductsGridBlockProps) => void;
}

const DEFAULT_PRODUCTS: DsoProductsGridBlockProps["products"] = [];

const BRAND   = "var(--brand-primary, #0f172a)";
const LIME    = "var(--brand-accent, hsl(68,60%,52%))";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_STACK;

const PRODUCT_ICONS: Record<string, React.ElementType> = {
  crown:       Crown,
  smile:       SmilePlus,
  stethoscope: Stethoscope,
  target:      Target,
  scan:        Scan,
  sparkles:    Sparkles,
  moon:        Moon,
  shield:      Shield,
};

export function BlockDsoProductsGrid({ props, brand, onFieldChange }: Props) {
  const { eyebrow, headline, subheadline, products = [], ctaText, ctaUrl, ctaMode = "link", ctaVariant = "link", backgroundStyle = "muted" } = props;
  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);
  const field = (key: keyof DsoProductsGridBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as DsoProductsGridBlockProps[typeof key] }) : undefined;
  const updateProduct = onFieldChange
    ? (idx: number, patch: Partial<DsoProductsGridBlockProps["products"][number]>) => {
        const list = (products && products.length > 0) ? products : DEFAULT_PRODUCTS;
        onFieldChange({ ...props, products: list.map((p, i) => i === idx ? { ...p, ...patch } : p) });
      }
    : undefined;

  const [windowWidth, setWindowWidth] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const desktopCols = Math.min(products.length, 4);
  const gridCols = windowWidth < 640 ? 1 : windowWidth < 1024 ? Math.min(products.length, 2) : desktopCols;

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg    = dark ? "rgba(255,255,255,0.05)" : "#fff";
  const cardBor   = dark ? "1px solid rgba(255,255,255,0.09)" : "1px solid #e5e7eb";
  const nameC     = dark ? "#fff" : BRAND;
  const detailC   = dark ? "rgba(255,255,255,0.50)" : "#9ca3af";
  const priceC    = dark ? LIME : BRAND;

  return (
    <section style={sectionBg} className="py-24 md:py-32">
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
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
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }} style={{ marginTop: "1.25rem", fontSize: "1.0625rem", color: subC, lineHeight: 1.7, maxWidth: 560, margin: "1.25rem auto 0", fontFamily: BODY }}>
              <InlineText as="span" value={subheadline} onUpdate={field("subheadline")} multiline style={{ fontFamily: BODY }}/>
            </motion.p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: "1.25rem" }}>
          {products.map((product, i) => {
            const imgSrc = product.imageUrl || null;
            const iconKey = product.icon?.toLowerCase() ?? "";
            const Icon = PRODUCT_ICONS[iconKey] ?? Crown;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.5 }}
                style={{
                  background: cardBg,
                  border: cardBor,
                  borderRadius: "1rem",
                  overflow: "hidden",
                  backdropFilter: dark ? "blur(12px)" : "none",
                }}
              >
                {imgSrc ? (
                  <div style={{ height: 140, overflow: "hidden" }}>
                    <img src={imgSrc} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ) : (
                  <div
                    style={{
                      height: 100,
                      background: dark ? `rgb(var(--brand-accent-rgb, 59 130 246) / 0.063)` : `rgb(var(--brand-primary-rgb, 15 23 42) / 0.024)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon style={{ width: 36, height: 36, color: dark ? LIME : BRAND, opacity: 0.5 }} />
                  </div>
                )}

                <div style={{ padding: "1.25rem 1.5rem 1.5rem" }}>
                  <InlineText
                    as="p"
                    value={product.name}
                    onUpdate={updateProduct ? (v) => updateProduct(i, { name: v }) : undefined}
                    style={{ fontFamily: DISPLAY, fontSize: "1.0625rem", fontWeight: 600, color: nameC, letterSpacing: "-0.01em" }}
                  />
                  <InlineText as="p" value={product.detail} onUpdate={updateProduct ? (v) => updateProduct(i, { detail: v }) : undefined} multiline style={{ fontSize: "0.9375rem", color: detailC, marginTop: 4, lineHeight: 1.55, fontFamily: BODY }} />
                  <InlineText as="p" value={product.price} onUpdate={updateProduct ? (v) => updateProduct(i, { price: v }) : undefined} style={{ fontSize: "1rem", fontWeight: 700, color: priceC, marginTop: "0.875rem", fontFamily: BODY }} />
                </div>
              </motion.div>
            );
          })}
        </div>

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
