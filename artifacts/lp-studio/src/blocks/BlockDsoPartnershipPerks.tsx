import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { IconOrImage, isImageIcon } from "@/lib/icon-value";
import type { DsoPartnershipPerksBlockProps } from "@/lib/block-types";
import { getBgStyle, resolveSectionSurface } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses } from "@/lib/brand-config";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { BlockDsoCta } from "@/components/BlockDsoCta";
import { InlineText } from "@/components/InlineText";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props {
  props: DsoPartnershipPerksBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DsoPartnershipPerksBlockProps) => void;
}

const DEFAULT_PERKS: DsoPartnershipPerksBlockProps["perks"] = [];

const BRAND   = "var(--brand-primary, #003A30)";
const LIME    = "var(--brand-accent, hsl(68,60%,52%))";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_STACK;

/** Legacy perk icons were stored lowercase/kebab ("trending-up"); Lucide names are PascalCase. */
function normalizeIconValue(value?: string): string | undefined {
  if (!value || isImageIcon(value) || /^[A-Z]/.test(value)) return value;
  return value
    .split(/[-_\s]+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function PerkIcon({ name, dark }: { name: string; dark: boolean }) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "0.75rem",
        background: dark ? `rgb(var(--brand-accent-rgb, 199 231 56) / 0.094)` : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.063)`,
        border: `1px solid ${dark ? `rgb(var(--brand-accent-rgb, 199 231 56) / 0.188)` : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.125)`}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <IconOrImage value={normalizeIconValue(name)} fallback={Star} style={{ width: 20, height: 20, color: dark ? LIME : BRAND }} />
    </div>
  );
}

export function BlockDsoPartnershipPerks({ props, brand, onFieldChange }: Props) {
  const { eyebrow, headline, subheadline, perks = [], ctaText, ctaUrl, ctaMode = "link", ctaVariant = "secondary", backgroundStyle = "dark" } = props;
  const dark = resolveSectionSurface({ backgroundStyle: backgroundStyle }, "#ffffff", brand).isDark;
  const sectionBg = getBgStyle(backgroundStyle);
  const field = (key: keyof DsoPartnershipPerksBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as DsoPartnershipPerksBlockProps[typeof key] }) : undefined;
  const updatePerk = onFieldChange
    ? (idx: number, patch: Partial<DsoPartnershipPerksBlockProps["perks"][number]>) => {
        const list = (perks && perks.length > 0) ? perks : DEFAULT_PERKS;
        onFieldChange({ ...props, perks: list.map((p, i) => i === idx ? { ...p, ...patch } : p) });
      }
    : undefined;

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg    = dark ? "rgba(255,255,255,0.04)" : "#fff";
  const cardBor   = dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb";
  const titleC    = dark ? "#fff" : BRAND;
  const descC     = dark ? "rgba(255,255,255,0.55)" : "#6b7280";

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
            <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} style={{ marginTop: "1.25rem", fontSize: "1.0625rem", color: subC, lineHeight: 1.7, maxWidth: 560, margin: "1.25rem auto 0", fontFamily: BODY }}>
              <InlineText as="span" value={subheadline} onUpdate={field("subheadline")} multiline style={{ fontFamily: BODY }}/>
            </motion.p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
          {perks.map((perk, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              style={{
                background: cardBg,
                border: cardBor,
                borderRadius: "1rem",
                padding: "1.5rem",
                display: "flex",
                gap: "1rem",
                backdropFilter: dark ? "blur(12px)" : "none",
              }}
            >
              <PerkIcon name={perk.icon} dark={dark} />
              <div>
                <InlineText
                  as="p"
                  value={perk.title}
                  onUpdate={updatePerk ? (v) => updatePerk(i, { title: v }) : undefined}
                  style={{ fontFamily: DISPLAY, fontSize: "1.0625rem", fontWeight: 600, color: titleC, letterSpacing: "-0.01em" }}
                />
                <InlineText as="p" value={perk.desc} onUpdate={updatePerk ? (v) => updatePerk(i, { desc: v }) : undefined} multiline style={{ fontSize: "0.9375rem", color: descC, marginTop: 4, lineHeight: 1.6, fontFamily: BODY }} />
              </div>
            </motion.div>
          ))}
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
