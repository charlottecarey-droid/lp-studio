import { motion } from "framer-motion";
import { TrendingDown, BarChart3, Scale, Wallet } from "lucide-react";
import type { DsoChallengesBlockProps } from "@/lib/block-types";

interface Props {
  props: DsoChallengesBlockProps;
}

const P     = "hsl(152,42%,12%)";
const SEC   = "hsl(42,18%,96%)";
const FG    = "hsl(152,40%,13%)";
const MU    = "hsl(152,8%,48%)";
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
  const { eyebrow, headline, backgroundStyle = "muted", layout = "4-col", challenges } = props;
  const bg = backgroundStyle === "white" ? "#fff" : SEC;
  const displayChallenges = (challenges && challenges.length > 0) ? challenges : DEFAULT_CHALLENGES;
  const gridCols = layout === "2-col" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 md:grid-cols-4";

  return (
    <section style={{ background: bg }} className="py-24 md:py-32">
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 1.5rem" }}>
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
                color: P,
                marginBottom: "1rem",
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
              color: FG,
              letterSpacing: 0,
            }}
          >
            {headline || "At scale — even small inefficiencies compound fast."}
          </motion.h2>
        </div>

        <div className={`grid ${gridCols} gap-4`}>
          {displayChallenges.slice(0, layout === "2-col" ? 4 : 4).map((c, i) => {
            const Icon = ICONS[i % 4];
            return (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.6 }}
                style={{
                  borderRadius: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  padding: layout === "2-col" ? "2.5rem" : "1.75rem 1.75rem 2.5rem",
                  background: "linear-gradient(150deg,#ffffff 50%,hsl(152,42%,96%) 100%)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04),0 6px 24px rgba(0,0,0,0.07)",
                  borderTop: `2px solid ${P}`,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `${P}14`,
                    marginBottom: "1.5rem",
                  }}
                >
                  <Icon style={{ width: 16, height: 16, color: P }} />
                </div>
                <h3
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: FG,
                    marginBottom: "0.75rem",
                    lineHeight: 1.35,
                  }}
                >
                  {c.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: MU,
                    lineHeight: 1.65,
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
