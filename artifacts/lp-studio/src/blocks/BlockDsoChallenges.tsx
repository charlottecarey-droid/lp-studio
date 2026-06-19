import { motion } from "framer-motion";
import { TrendingDown, BarChart3, Scale, Wallet } from "lucide-react";
import type { DsoChallengesBlockProps } from "@/lib/block-types";
import { getBgStyle, resolveSectionSurface, getImageBgSectionStyle } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";

interface Props {
  brand?: BrandConfig;
  props: DsoChallengesBlockProps;
  onFieldChange?: (updated: DsoChallengesBlockProps) => void;
}

const P     = "hsl(152,42%,12%)";
const FG    = "hsl(152,40%,13%)";
const MU    = "hsl(152,8%,48%)";
const AW    = "var(--brand-accent, hsl(68,60%,52%))";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
const DISPLAY_FONT = BRAND_DISPLAY_STACK;
const DISPLAY = DISPLAY_FONT;

const ICONS = [TrendingDown, BarChart3, Scale, Wallet];

// Neutral component-level fallback. Catalog default_props (industry='generic')
// supplies challenges for catalog-added blocks; this fires only for isolated previews.
const DEFAULT_CHALLENGES = [
  {
    title: "Same-Store Growth Pressure",
    desc: "Pipelines have slowed. With rising costs and tighter financing, teams must unlock more revenue from existing operations to protect margins.",
  },
  {
    title: "Fragmented Vendor Relationships",
    desc: "When every team picks their own tools, you lose the volume advantage. Disconnected vendors create data silos, quality variance, and zero negotiating leverage.",
  },
  {
    title: "Standards That Don't Survive Growth",
    desc: "Organizations rarely fail because they grow too fast — they fail because their standards don't scale. Variability creeps in and operational discipline erodes with every new site.",
  },
  {
    title: "Capital Constraints",
    desc: "Hardware refresh cycles add up fast. Teams need a partner that eliminates upfront CAPEX, includes premium gear, and proves ROI within months.",
  },
];

export function BlockDsoChallenges({ props, brand, onFieldChange }: Props) {
  const { eyebrow, headline, backgroundStyle = "muted", layout = "4-col", challenges, backgroundImage, backgroundOverlay, overlayColor = "#000000" } = props;
  const field = (key: keyof DsoChallengesBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as DsoChallengesBlockProps[typeof key] }) : undefined;
  const updateChallenge = onFieldChange
    ? (idx: number, patch: Partial<NonNullable<DsoChallengesBlockProps["challenges"]>[number]>) => {
        const list = (challenges && challenges.length > 0)
          ? challenges
          : (DEFAULT_CHALLENGES as NonNullable<DsoChallengesBlockProps["challenges"]>);
        onFieldChange({
          ...props,
          challenges: list.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
        });
      }
    : undefined;
  const dark = resolveSectionSurface({ backgroundStyle: backgroundStyle }, "#ffffff", brand).isDark || !!backgroundImage;
  const sectionBgStyle = backgroundImage ? getImageBgSectionStyle(backgroundImage) : getBgStyle(backgroundStyle);
  const displayChallenges = (challenges && challenges.length > 0) ? challenges : DEFAULT_CHALLENGES;
  const gridCols = layout === "2-col" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 md:grid-cols-4";

  const cardBg = dark
    ? "rgba(255,255,255,0.04)"
    : "white";
  const cardBorder = dark
    ? "1px solid rgba(255,255,255,0.08)"
    : "1px solid rgba(0,0,0,0.05)";
  const cardShadow = dark
    ? "none"
    : "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 20px 40px rgba(0,0,0,0.06)";
  const cardAccentBorder = dark ? `2px solid ${AW}` : `2px solid ${P}`;

  const iconBg = dark ? `rgb(var(--brand-accent-rgb, 199 231 56) / 0.082)` : `rgb(var(--brand-primary-rgb, 0 58 48) / 0.071)`;
  const iconBorder = dark ? `1px solid rgb(var(--brand-accent-rgb, 199 231 56) / 0.157)` : `1px solid rgb(var(--brand-primary-rgb, 0 58 48) / 0.125)`;
  const iconColor = dark ? AW : P;

  return (
    <section style={sectionBgStyle} className="py-24 md:py-32">
      {backgroundImage && <div style={{ position: "absolute", inset: 0, backgroundColor: overlayColor, opacity: backgroundOverlay ?? 0.55, zIndex: 0, pointerEvents: "none" }} />}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ maxWidth: 768, marginBottom: "3.5rem" }}>
          {eyebrow && (
            <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: dark ? AW : P, marginBottom: "1.25rem", fontFamily: BODY }}>
              <InlineText as="span" value={eyebrow} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }}/>
            </motion.p>
          )}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(2rem,4vw,3.25rem)",
              lineHeight: 1.1,
              fontWeight: 600,
              color: dark ? "#fff" : FG,
              letterSpacing: "-0.015em",
            }}
          >
            <InlineText
              as="span"
              value={headline || "At scale — even small inefficiencies compound fast."}
              onUpdate={field("headline")}
              multiline
            style={{ fontFamily: DISPLAY }}/>
          </motion.h2>
        </div>

        <div className={`grid ${gridCols} gap-5`}>
          {displayChallenges.slice(0, 4).map((c, i) => {
            const Icon = ICONS[i % 4];
            return (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.65 }}
                whileHover={{ y: -5 }}
                style={{
                  borderRadius: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  padding: layout === "2-col" ? "2.5rem" : "2rem 2rem 2.5rem",
                  background: cardBg,
                  backdropFilter: dark ? "blur(16px)" : "none",
                  boxShadow: cardShadow,
                  border: cardBorder,
                  borderTop: cardAccentBorder,
                  transition: "box-shadow 0.35s ease, transform 0.35s cubic-bezier(0.16,1,0.3,1)",
                  cursor: "default",
                }}
                onMouseEnter={e => {
                  if (!dark) (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.08), 0 32px 64px rgba(0,0,0,0.10)";
                  else (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
                }}
                onMouseLeave={e => {
                  if (!dark) (e.currentTarget as HTMLElement).style.boxShadow = cardShadow;
                  else (e.currentTarget as HTMLElement).style.background = cardBg;
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: iconBg,
                    border: iconBorder,
                    marginBottom: "1.75rem",
                  }}
                >
                  <Icon style={{ width: 18, height: 18, color: iconColor }} />
                </div>
                <h3
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    color: dark ? "#fff" : FG,
                    marginBottom: "0.875rem",
                    lineHeight: 1.4,
                  }}
                >
                  <InlineText
                    as="span"
                    value={c.title}
                    onUpdate={updateChallenge ? (v) => updateChallenge(i, { title: v }) : undefined}
                  style={{ fontFamily: DISPLAY }}/>
                </h3>
                <p style={{ fontSize: "0.875rem", color: dark ? "rgba(255,255,255,0.55)" : MU, lineHeight: 1.7, fontFamily: BODY }}>
                  <InlineText
                    as="span"
                    value={c.desc}
                    onUpdate={updateChallenge ? (v) => updateChallenge(i, { desc: v }) : undefined}
                    multiline
                  style={{ fontFamily: BODY }}/>
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
