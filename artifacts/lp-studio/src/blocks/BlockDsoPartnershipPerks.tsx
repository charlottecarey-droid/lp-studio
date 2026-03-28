import { motion } from "framer-motion";
import { Gift, Star, Shield, Sparkles, Zap, Users, Clock, TrendingUp, CheckCircle, Award, Heart, Layers } from "lucide-react";
import type { DsoPartnershipPerksBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses } from "@/lib/brand-config";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props {
  props: DsoPartnershipPerksBlockProps;
  brand: BrandConfig;
}

const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

const ICON_MAP: Record<string, React.ElementType> = {
  gift: Gift,
  star: Star,
  shield: Shield,
  sparkles: Sparkles,
  zap: Zap,
  users: Users,
  clock: Clock,
  "trending-up": TrendingUp,
  trending: TrendingUp,
  "check-circle": CheckCircle,
  award: Award,
  heart: Heart,
  layers: Layers,
};

function PerkIcon({ name, dark }: { name: string; dark: boolean }) {
  const Ic = ICON_MAP[name.toLowerCase()] ?? Star;
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "0.75rem",
        background: dark ? `${LIME}18` : `${BRAND}10`,
        border: `1px solid ${dark ? `${LIME}30` : `${BRAND}20`}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Ic style={{ width: 20, height: 20, color: dark ? LIME : BRAND }} />
    </div>
  );
}

export function BlockDsoPartnershipPerks({ props, brand }: Props) {
  const { eyebrow, headline, subheadline, perks = [], ctaText, ctaUrl, ctaMode = "link", backgroundStyle = "dark" } = props;
  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

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
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: eyebrowC, marginBottom: "1.25rem" }}
            >
              {eyebrow}
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
              {headline}
            </motion.h2>
          )}
          {subheadline && (
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              style={{ marginTop: "1.25rem", fontSize: "1.0625rem", color: subC, lineHeight: 1.7, maxWidth: 560, margin: "1.25rem auto 0" }}
            >
              {subheadline}
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
                <p style={{ fontFamily: DISPLAY, fontSize: "1.0625rem", fontWeight: 600, color: titleC, letterSpacing: "-0.01em" }}>{perk.title}</p>
                <p style={{ fontSize: "0.9375rem", color: descC, marginTop: 4, lineHeight: 1.6 }}>{perk.desc}</p>
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
            {ctaMode === "chilipiper" ? (
              <ChiliPiperButton
                url={ctaUrl ?? ""}
                className={getButtonClasses(brand, "inline-flex items-center")}
                style={{ backgroundColor: brand.accentColor, color: brand.primaryColor }}
              >
                {ctaText}
              </ChiliPiperButton>
            ) : (
              <motion.a
                href={ctaUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={getButtonClasses(brand, "inline-flex items-center")}
                style={{ backgroundColor: brand.accentColor, color: brand.primaryColor, textDecoration: "none" }}
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.96 }}
                transition={SPRING}
              >
                {ctaText}
              </motion.a>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}
