import { motion } from "framer-motion";
import { TrendingDown, BarChart3, Scale, Wallet } from "lucide-react";
import type { DsoChallengesBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg, getImageBgSectionStyle } from "@/lib/bg-styles";

interface Props {
  props: DsoChallengesBlockProps;
}

const P     = "hsl(152,42%,12%)";
const FG    = "hsl(152,40%,13%)";
const MU    = "hsl(152,8%,48%)";
const AW    = "hsl(68,60%,52%)";
const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const ICONS = [TrendingDown, BarChart3, Scale, Wallet];

const DEFAULT_CHALLENGES = [
  {
    title: "Same-Store Growth Pressure",
    desc: "Acquisition pipelines have slowed. With rising costs and tighter financing, DSOs must unlock more revenue from existing practices to protect EBITDA — and the dental lab is one of the most overlooked levers.",
  },
  {
    title: "Fragmented Lab Relationships",
    desc: "If every dentist chooses their own lab, you never get a volume advantage. Disconnected vendors across regions create data silos, quality variance, and zero negotiating leverage.",
  },
  {
    title: "Standards That Don't Survive Growth",
    desc: "Most DSOs don't fail because they grow too fast — they fail because their standards don't scale. Variability creeps in, outcomes drift, and operational discipline erodes with every new location.",
  },
  {
    title: "Capital Constraints",
    desc: "Scanner requests pile up every year — $40K–$75K per operatory adds up fast. DSOs need a partner that eliminates CAPEX, includes premium hardware, and proves ROI within months.",
  },
];

export function BlockDsoChallenges({ props }: Props) {
  const { eyebrow, headline, backgroundStyle = "muted", layout = "4-col", challenges, backgroundImage, backgroundOverlay, overlayColor = "#000000" } = props;
  const dark = isDarkBg(backgroundStyle) || !!backgroundImage;
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

  const iconBg = dark ? `${AW}15` : `${P}12`;
  const iconBorder = dark ? `1px solid ${AW}28` : `1px solid ${P}20`;
  const iconColor = dark ? AW : P;

  return (
    <section style={sectionBgStyle} className="py-24 md:py-32">
      {backgroundImage && <div style={{ position: "absolute", inset: 0, backgroundColor: overlayColor, opacity: backgroundOverlay ?? 0.55, zIndex: 0, pointerEvents: "none" }} />}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ maxWidth: 768, marginBottom: "3.5rem" }}>
          {eyebrow && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: dark ? AW : P,
                marginBottom: "1.25rem",
              }}
            >
              {eyebrow}
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
            {headline || "At scale — even small inefficiencies compound fast."}
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
                  {c.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: dark ? "rgba(255,255,255,0.55)" : MU,
                    lineHeight: 1.7,
                  }}
                >
                  {c.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
