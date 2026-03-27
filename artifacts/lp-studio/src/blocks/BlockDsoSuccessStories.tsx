import { motion } from "framer-motion";
import type { DsoSuccessStoriesBlockProps } from "@/lib/block-types";

interface Props {
  props: DsoSuccessStoriesBlockProps;
  onCtaClick?: () => void;
}

const P   = "hsl(152,42%,12%)";
const PFG = "hsl(48,100%,96%)";
const AW  = "hsl(68,60%,52%)";
const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const DEFAULT_CASES = [
  {
    name: "APEX Dental Partners",
    stat: "12.5%",
    label: "annualized revenue potential increase",
    quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.",
    author: "Dr. Layla Lohmann, Founder",
  },
  {
    name: "Open & Affordable Dental",
    stat: "96%",
    label: "reduction in remakes",
    quote: "Reduced crown appointments by 2–3 minutes per case. That adds up to hours of saved chair time per month.",
    author: "Clinical Director",
  },
  {
    name: "Dental Care Alliance",
    stat: "99%",
    label: "practices still using Dandy after one year",
    quote: "The training you guys give is incredible. The onboarding has been incredible. The whole experience has been incredible.",
    author: "Dr. Trey Mueller, Chief Clinical Officer",
  },
];

export function BlockDsoSuccessStories({ props, onCtaClick }: Props) {
  const { eyebrow, headline, cases } = props;
  const displayCases = (cases && cases.length > 0) ? cases.slice(0, 3) : DEFAULT_CASES;

  return (
    <section style={{ background: P }} className="py-24 md:py-32">
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
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
                color: AW,
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
              color: PFG,
              letterSpacing: 0,
            }}
          >
            {headline || "DSOs that switched\nand never looked back."}
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {displayCases.map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.7 }}
              style={{
                borderRadius: "1rem",
                background: "rgba(255,255,255,0.06)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.10)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
              className="hover:bg-white/[0.1] transition-colors duration-300"
            >
              <div
                style={{
                  padding: "2rem 2.25rem",
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    color: "rgba(255,255,255,0.50)",
                    marginBottom: "1.5rem",
                  }}
                >
                  {s.name.toUpperCase()}
                </p>
                <p
                  style={{
                    fontSize: "clamp(2.5rem,4vw,3rem)",
                    fontWeight: 500,
                    color: PFG,
                    letterSpacing: "-0.035em",
                    lineHeight: 1,
                  }}
                >
                  {s.stat}
                </p>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "rgba(255,255,255,0.60)",
                    marginTop: "0.5rem",
                    marginBottom: "2rem",
                  }}
                >
                  {s.label}
                </p>
                <div
                  style={{
                    width: 32,
                    height: 1,
                    background: `${AW}66`,
                    marginBottom: "1.5rem",
                  }}
                />
                <blockquote
                  style={{
                    fontSize: "0.875rem",
                    color: "rgba(255,255,255,0.70)",
                    lineHeight: 1.6,
                    fontStyle: "italic",
                    flex: 1,
                  }}
                >
                  "{s.quote}"
                </blockquote>
                <p
                  style={{
                    marginTop: "2rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: AW,
                  }}
                >
                  — {s.author}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
