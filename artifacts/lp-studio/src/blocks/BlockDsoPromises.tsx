import { motion } from "framer-motion";
import { ShieldCheck, Ban, RotateCcw, Clock, Zap, TrendingUp, Star, CheckCircle, Award, Heart, Users, Package, Layers, Gift } from "lucide-react";
import type { DsoPromisesBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { getButtonClasses } from "@/lib/brand-config";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { BlockDsoCta } from "@/components/BlockDsoCta";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 18 };

interface Props {
  props: DsoPromisesBlockProps;
  brand: BrandConfig;
}

const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

const ICON_MAP: Record<string, React.ElementType> = {
  "shield-check": ShieldCheck,
  shieldCheck: ShieldCheck,
  shield: ShieldCheck,
  ban: Ban,
  rotate: RotateCcw,
  "rotate-ccw": RotateCcw,
  clock: Clock,
  zap: Zap,
  "trending-up": TrendingUp,
  trending: TrendingUp,
  star: Star,
  "check-circle": CheckCircle,
  award: Award,
  heart: Heart,
  users: Users,
  package: Package,
  layers: Layers,
  gift: Gift,
};

export function BlockDsoPromises({ props, brand }: Props) {
  const { eyebrow, headline, subheadline, promises = [], ctaText, ctaUrl, ctaMode = "link", ctaVariant = "primary", backgroundStyle = "dark" } = props;
  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const subC      = dark ? "rgba(255,255,255,0.55)" : "#6b7280";
  const cardBg    = dark ? "rgba(255,255,255,0.04)" : "#fff";
  const cardBor   = dark ? `1px solid ${LIME}20` : `1px solid ${BRAND}18`;
  const titleC    = dark ? "#fff" : BRAND;
  const descC     = dark ? "rgba(255,255,255,0.58)" : "#6b7280";

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
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(1.875rem,3.5vw,2.75rem)",
                lineHeight: 1.15,
                fontWeight: 600,
                color: headlineC,
                letterSpacing: "-0.02em",
                whiteSpace: "pre-line",
              }}
            >
              {headline}
            </motion.h2>
          )}
          {subheadline && (
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              style={{ marginTop: "1.25rem", fontSize: "1.0625rem", color: subC, lineHeight: 1.7, maxWidth: 600, margin: "1.25rem auto 0" }}
            >
              {subheadline}
            </motion.p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
          {promises.map((promise, i) => {
            const Icon = ICON_MAP[promise.icon?.toLowerCase()] ?? ShieldCheck;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.09, duration: 0.5 }}
                style={{
                  background: cardBg,
                  border: cardBor,
                  borderRadius: "1.25rem",
                  padding: "2rem",
                  backdropFilter: dark ? "blur(12px)" : "none",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "1rem",
                    background: dark ? `${LIME}15` : `${BRAND}08`,
                    border: `1px solid ${dark ? `${LIME}35` : `${BRAND}18`}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1.25rem",
                  }}
                >
                  <Icon style={{ width: 24, height: 24, color: dark ? LIME : BRAND }} />
                </div>
                <p style={{ fontFamily: DISPLAY, fontSize: "1.0625rem", fontWeight: 600, color: titleC, letterSpacing: "-0.01em" }}>{promise.title}</p>
                <p style={{ fontSize: "0.9375rem", color: descC, marginTop: "0.625rem", lineHeight: 1.65 }}>{promise.desc}</p>
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
