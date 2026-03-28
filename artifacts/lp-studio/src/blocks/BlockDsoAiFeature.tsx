import { motion } from "framer-motion";
import { ScanLine, RefreshCw, ShieldCheck } from "lucide-react";
import type { DsoAiFeatureBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { AiScanReviewAnimation } from "./AiScanReviewAnimation";
import { WordReveal } from "./WordReveal";
import { StatCounter } from "./StatCounter";

const P    = "#003A30";
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
    imageUrl  = "",
    videoUrl  = "/videos/ai-scan-review.mp4",
    backgroundStyle = "dandy-green",
    ctaText,
    ctaUrl,
    ctaMode = "link",
  } = props;

  const dark = isDarkBg(backgroundStyle);
  const fg   = dark ? "#fff"                    : P;
  const mu   = dark ? "rgba(255,255,255,0.60)"  : "rgba(0,58,48,0.60)";
  const mu2  = dark ? "rgba(255,255,255,0.80)"  : "rgba(0,58,48,0.80)";
  const statMu = dark ? "rgba(255,255,255,0.40)" : "rgba(0,58,48,0.45)";
  const imgBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const imgBg     = dark ? "hsl(152,30%,6%)"        : "hsl(152,20%,95%)";
  const iconBg    = dark ? `${AW}18` : `${AW}22`;
  const iconBorder = dark ? `${AW}30` : `${AW}44`;

  const bulletIcons = [ScanLine, RefreshCw, ShieldCheck];

  return (
    <section
      style={{
        ...getBgStyle(backgroundStyle),
        color: fg,
        position: "relative",
        overflow: "hidden",
      }}
      className="py-24 md:py-32"
    >
      {dark && (
        <>
          <motion.div
            animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.15, 0.95, 1] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              top: "10%",
              left: "15%",
              width: 700,
              height: 700,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${AW}0A 0%, transparent 65%)`,
              pointerEvents: "none",
            }}
          />
          <motion.div
            animate={{ x: [0, -50, 30, 0], y: [0, 40, -20, 0], scale: [1, 0.9, 1.1, 1] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 4 }}
            style={{
              position: "absolute",
              bottom: "5%",
              right: "10%",
              width: 500,
              height: 500,
              borderRadius: "50%",
              background: `radial-gradient(circle, hsl(152,60%,25%)22 0%, transparent 65%)`,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      <div
        style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}
        className="md:px-10"
      >
        {/* ── Header: eyebrow + headline + body / stats ── */}
        <div className="grid md:grid-cols-[3fr_2fr] gap-10 items-end mb-10">
          <div>
            {eyebrow && (
              <motion.p
                initial={{ opacity: 0, x: -18 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
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
            <h2
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: "clamp(2rem,3.5vw,3rem)",
                lineHeight: 1.15,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                marginBottom: body ? "1.25rem" : 0,
              }}
            >
              <WordReveal
                text={headline}
                dimColor={dark ? "rgba(255,255,255,0.18)" : "rgba(0,58,48,0.2)"}
                brightColor={fg}
              />
            </h2>
            {body && (
              <p style={{ fontSize: "1rem", lineHeight: 1.7 }}>
                <WordReveal
                  text={body}
                  dimColor={dark ? "rgba(255,255,255,0.15)" : "rgba(0,58,48,0.18)"}
                  brightColor={mu}
                />
              </p>
            )}
          </div>

          {/* Stats + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
          >
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", marginBottom: ctaText ? "2rem" : 0 }}>
              {stats.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 100, damping: 16 }}
                >
                  <p style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(1.5rem,2.5vw,2rem)", fontWeight: 600, letterSpacing: "-0.03em", color: fg, lineHeight: 1 }}>
                    <StatCounter value={s.value} />
                  </p>
                  <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: statMu, marginTop: "0.375rem" }}>
                    {s.label}
                  </p>
                </motion.div>
              ))}
            </div>
            {ctaText && (
              ctaMode === "chilipiper" ? (
                <ChiliPiperButton url={ctaUrl ?? ""} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 2rem", borderRadius: "0.5rem", background: AW, color: P, fontWeight: 600, fontSize: "0.9375rem", cursor: "pointer", border: "none" }}>
                  {ctaText}
                </ChiliPiperButton>
              ) : (
                <a href={ctaUrl || "#"} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 2rem", borderRadius: "0.5rem", background: AW, color: P, fontWeight: 600, fontSize: "0.9375rem", textDecoration: "none" }}>
                  {ctaText}
                </a>
              )
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Full-width landscape video / animation ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        style={{
          overflow: "hidden",
          background: imgBg,
          aspectRatio: "16/9",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {videoUrl ? (
          <video
            src={videoUrl}
            autoPlay
            loop
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <AiScanReviewAnimation imageUrl={imageUrl} />
        )}
      </motion.div>

      {/* ── Bullets row below video ── */}
      {bullets.length > 0 && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }} className="md:px-10">
          <motion.ul
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem 3rem", marginTop: "2.5rem", listStyle: "none", padding: 0 }}
          >
            {bullets.map((text, i) => {
              const Icon = bulletIcons[i % bulletIcons.length];
              return (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: iconBg, border: `1px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon style={{ width: 13, height: 13, color: AW }} />
                  </div>
                  <span style={{ fontSize: "0.9rem", color: mu2 }}>{text}</span>
                </li>
              );
            })}
          </motion.ul>
        </div>
      )}
    </section>
  );
}
