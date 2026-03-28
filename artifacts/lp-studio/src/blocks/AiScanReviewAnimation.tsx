import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LIME = "#c6f135";
const BG_CARD = "rgba(255,255,255,0.04)";
const BG_DARK = "hsl(152,28%,5%)";
const BORDER = "rgba(198,241,53,0.12)";
const FG = "#ffffff";
const MU = "rgba(255,255,255,0.45)";

const CHECKS = [
  { label: "Margin quality",        note: "0.3 mm — within spec" },
  { label: "Occlusal clearance",    note: "1.5 mm — acceptable" },
  { label: "Prep taper",            note: "6° — optimal convergence" },
  { label: "Undercut detection",    note: "None detected" },
  { label: "Material compatibility",note: "Full-contour zirconia confirmed" },
];

type Phase = "scanning" | "detecting" | "result" | "confirm" | "reset";

interface AiScanReviewAnimationProps {
  imageUrl?: string;
}

export function AiScanReviewAnimation({ imageUrl }: AiScanReviewAnimationProps = {}) {
  const [phase, setPhase]               = useState<Phase>("scanning");
  const [visibleChecks, setVisibleChecks] = useState(0);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;

    if (phase === "scanning") {
      t = setTimeout(() => { setPhase("detecting"); setVisibleChecks(0); }, 2200);
    } else if (phase === "detecting") {
      if (visibleChecks < CHECKS.length) {
        t = setTimeout(() => setVisibleChecks(v => v + 1), 620);
      } else {
        t = setTimeout(() => setPhase("result"), 500);
      }
    } else if (phase === "result") {
      t = setTimeout(() => setPhase("confirm"), 1400);
    } else if (phase === "confirm") {
      t = setTimeout(() => setPhase("reset"), 2800);
    } else {
      t = setTimeout(() => { setPhase("scanning"); setVisibleChecks(0); }, 700);
    }

    return () => clearTimeout(t);
  }, [phase, visibleChecks]);

  const scanning  = phase === "scanning";
  const done      = phase === "result" || phase === "confirm";
  const confirmed = phase === "confirm";

  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: BG_DARK,
      display: "flex",
      flexDirection: "column",
      padding: "1.5rem",
      gap: "0.875rem",
      fontFamily: "'Inter',-apple-system,sans-serif",
      position: "relative",
      overflow: "hidden",
      color: FG,
    }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div style={{ position: "relative", width: 8, height: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: done ? LIME : "rgba(198,241,53,0.5)",
            transition: "background 0.4s",
          }} />
          {scanning && (
            <motion.div
              animate={{ scale: [1, 3], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 1.1, ease: "easeOut" }}
              style={{
                position: "absolute", inset: 0, borderRadius: "50%", background: LIME,
              }}
            />
          )}
        </div>
        <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", color: LIME, textTransform: "uppercase" }}>
          AI Scan Review
        </span>
        <span style={{ marginLeft: "auto", fontSize: "0.62rem", color: MU }}>
          {scanning ? "Analyzing scan…" : phase === "detecting" ? "Checking flags…" : done ? "Complete" : ""}
        </span>
      </div>

      {/* ── Scan visualizer ── */}
      <div style={{
        borderRadius: "0.75rem",
        background: BG_CARD,
        border: `1px solid ${BORDER}`,
        overflow: "hidden",
        position: "relative",
        height: "130px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        {/* Real product image backdrop — z-index 1 (base layer) */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              borderRadius: "0.75rem",
              zIndex: 1,
            }}
          />
        )}

        {/* Tooth outline SVG — z-index 2 (grid overlay, dimmed when image present) */}
        <svg viewBox="0 0 130 110" style={{ width: 110, height: 90, position: "relative", zIndex: 2, opacity: imageUrl ? 0.25 : 1 }}>
          {/* Crown body */}
          <path d="M18 90 Q12 62 22 42 Q34 18 46 24 Q55 30 65 24 Q75 18 87 24 Q99 18 109 42 Q120 62 113 90 Q100 98 82 91 Q72 86 65 91 Q58 86 48 91 Q30 98 18 90Z"
            fill="none" stroke={LIME} strokeWidth="1.5" strokeLinejoin="round" opacity="0.55" />
          {/* Cusps */}
          <path d="M36 44 Q42 22 48 38 Q54 16 60 38 Q66 16 72 38 Q78 22 84 38 Q90 28 95 44"
            fill="none" stroke={LIME} strokeWidth="1.5" strokeLinejoin="round" opacity="0.40" />
          {/* Pulp hint */}
          <ellipse cx="65" cy="68" rx="7" ry="9" fill="none" stroke={LIME} strokeWidth="1" opacity="0.25" />
        </svg>

        {/* Scan sweep line — z-index 3 (top layer) */}
        {scanning && (
          <motion.div
            animate={{ top: ["8%", "92%"] }}
            transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
            style={{
              position: "absolute", left: "8%", right: "8%",
              height: "1.5px", zIndex: 3,
              background: `linear-gradient(to right, transparent, ${LIME}cc, transparent)`,
              boxShadow: `0 0 10px 2px ${LIME}66`,
            }}
          />
        )}

        {/* Detected point dots */}
        <AnimatePresence>
          {!scanning && ([
            { x: "34%", y: "38%" },
            { x: "58%", y: "28%" },
            { x: "72%", y: "48%" },
            { x: "44%", y: "65%" },
            { x: "60%", y: "60%" },
          ].map((pt, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.08, duration: 0.2, type: "spring", stiffness: 500 }}
              style={{
                position: "absolute", left: pt.x, top: pt.y,
                transform: "translate(-50%, -50%)",
                width: 8, height: 8, borderRadius: "50%",
                zIndex: 3,
                background: LIME, boxShadow: `0 0 8px 2px ${LIME}88`,
              }}
            />
          )))}
        </AnimatePresence>

        {/* "No issues detected" pill */}
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
                zIndex: 3,
                background: "rgba(5,20,12,0.92)", border: `1px solid ${LIME}`,
                borderRadius: 999, padding: "3px 14px",
                fontSize: "0.62rem", fontWeight: 700, color: LIME,
                whiteSpace: "nowrap", letterSpacing: "0.06em",
              }}
            >
              ✓ No issues detected
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Check items ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: 1, overflow: "hidden" }}>
        {CHECKS.map((check, i) => (
          <AnimatePresence key={i}>
            {visibleChecks > i && (
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.3rem 0.55rem",
                  borderRadius: "0.45rem",
                  background: BG_CARD,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.12, type: "spring", stiffness: 500 }}
                  style={{
                    width: 16, height: 16, borderRadius: "50%",
                    background: LIME,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, fontSize: 9, color: "#071208", fontWeight: 900,
                  }}
                >
                  ✓
                </motion.div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.67rem", fontWeight: 600, color: FG, lineHeight: 1.25 }}>{check.label}</div>
                  <div style={{ fontSize: "0.59rem", color: MU, lineHeight: 1.25 }}>{check.note}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>

      {/* ── "Good to go?" confirmation bar ── */}
      <AnimatePresence>
        {confirmed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.6rem 0.875rem",
              borderRadius: "0.6rem",
              background: LIME,
              color: "#071208",
              fontWeight: 700,
              fontSize: "0.76rem",
              flexShrink: 0,
            }}
          >
            <span style={{ flex: 1 }}>Approve case — good to go?</span>
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 0.9, ease: "easeInOut" }}
              style={{ fontSize: "1rem" }}
            >
              →
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
