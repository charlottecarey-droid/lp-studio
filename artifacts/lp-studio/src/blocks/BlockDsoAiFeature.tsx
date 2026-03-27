import { motion } from "framer-motion";
import { ScanLine, RefreshCw, ShieldCheck } from "lucide-react";
import type { DsoAiFeatureBlockProps } from "@/lib/block-types";

const P    = "hsl(152,42%,12%)";
const AW   = "hsl(68,60%,52%)";
const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const DEFAULT_BULLETS = [
  { icon: ScanLine,   text: "AI reviews every scan for clinical accuracy" },
  { icon: RefreshCw,  text: "Real-time feedback before case submission" },
  { icon: ShieldCheck,text: "Eliminates remakes at the source" },
];

const DEFAULT_STATS = [
  { value: "96%",  label: "First-Time Right" },
  { value: "<30s", label: "Scan Review" },
  { value: "100%", label: "AI-Screened" },
];

interface Props {
  props: DsoAiFeatureBlockProps;
}

export function BlockDsoAiFeature({ props }: Props) {
  const {
    eyebrow   = "Waste Prevention",
    headline  = "Remakes are a tax. AI eliminates them.",
    body      = "AI Scan Review catches issues in real time — avoiding costly rework and maximizing revenue potential before a case ever reaches the bench.",
    bullets   = DEFAULT_BULLETS.map(b => b.text),
    stats     = DEFAULT_STATS,
    imageUrl  = "/dso-ai-scan.jpg",
  } = props;

  const bulletIcons = [ScanLine, RefreshCw, ShieldCheck];

  return (
    <section
      style={{
        background: "hsl(152,32%,7%)",
        color: "#fff",
        position: "relative",
        overflow: "hidden",
      }}
      className="py-24 md:py-32"
    >
      {/* Subtle background glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "30%",
          transform: "translate(-50%, -50%)",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${AW}08 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <div
        style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}
        className="md:px-10"
      >
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* ── Left: text ── */}
          <div>
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
                  marginBottom: "1.5rem",
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
                fontSize: "clamp(2.25rem,4vw,3.5rem)",
                lineHeight: 1.08,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                color: "#fff",
                marginBottom: "1.5rem",
              }}
            >
              {headline}
            </motion.h2>

            {body && (
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 }}
                style={{
                  fontSize: "1.0625rem",
                  color: "rgba(255,255,255,0.60)",
                  lineHeight: 1.7,
                  marginBottom: "2.25rem",
                }}
              >
                {body}
              </motion.p>
            )}

            {/* Bullets */}
            <motion.ul
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.12 }}
              style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2.75rem" }}
            >
              {bullets.map((text, i) => {
                const Icon = bulletIcons[i % bulletIcons.length];
                return (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: `${AW}18`,
                        border: `1px solid ${AW}30`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon style={{ width: 14, height: 14, color: AW }} />
                    </div>
                    <span style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.80)" }}>{text}</span>
                  </li>
                );
              })}
            </motion.ul>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.18 }}
              style={{ display: "flex", gap: "2.5rem", flexWrap: "wrap" }}
            >
              {stats.map((s, i) => (
                <div key={i}>
                  <p
                    style={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: "clamp(1.75rem,3vw,2.25rem)",
                      fontWeight: 600,
                      letterSpacing: "-0.03em",
                      color: "#fff",
                      lineHeight: 1,
                    }}
                  >
                    {s.value}
                  </p>
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.40)",
                      marginTop: "0.375rem",
                    }}
                  >
                    {s.label}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Right: scan image ── */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            style={{
              borderRadius: "1.25rem",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.4), 0 32px 80px rgba(0,0,0,0.5)",
              background: "hsl(152,30%,6%)",
              aspectRatio: "4/3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Dandy AI Scan Review — 3D dental scan with AI issue detection"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                loading="lazy"
              />
            ) : (
              /* Placeholder when no image */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1rem",
                  color: "rgba(255,255,255,0.25)",
                }}
              >
                <ScanLine style={{ width: 64, height: 64 }} />
                <p style={{ fontSize: "0.875rem" }}>AI Scan Preview</p>
              </div>
            )}
          </motion.div>

        </div>
      </div>
    </section>
  );
}
