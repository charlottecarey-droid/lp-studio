import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoStatBarBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: DsoStatBarBlockProps;
  onFieldChange?: (updated: DsoStatBarBlockProps) => void;
}

const AW  = "var(--brand-accent, hsl(68,60%,52%))";
const FG  = "var(--brand-primary, hsl(152,40%,13%))";
const MU  = "hsl(152,8%,48%)";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
const DISPLAY_FONT = `${BRAND_DISPLAY_FONT}, 'Inter', system-ui, sans-serif`;

const StatItem = ({
  stat, i, dark, onUpdateValue, onUpdateLabel,
}: {
  stat: { value: string; label: string };
  i: number;
  dark: boolean;
  onUpdateValue?: (v: string) => void;
  onUpdateLabel?: (v: string) => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: i * 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "2.5rem 1.5rem",
      }}
    >
      <InlineText
        as="p"
        value={stat.value}
        onUpdate={onUpdateValue}
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: "clamp(2.25rem,4vw,3rem)",
          fontWeight: 600,
          color: dark ? AW : FG,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      />

      <div
        style={{
          width: 24,
          height: 1,
          background: dark ? AW : "rgb(var(--brand-primary-rgb, 0 58 48) / 0.18)",
          opacity: dark ? 0.33 : 1,
          margin: "0.875rem auto",
        }}
      />

      <InlineText as="p" value={stat.label} onUpdate={onUpdateLabel} style={{ ...{fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: dark ? "rgba(255,255,255,0.50)" : MU, lineHeight: 1.5, maxWidth: 130,}, ...{fontFamily: BODY} }} />
    </motion.div>
  );
};

export function BlockDsoStatBar({ props, onFieldChange }: Props) {
  const { stats = [], backgroundStyle = "white" } = props;
  const dark = isDarkBg(backgroundStyle);

  const displayStats = stats.length > 0
    ? stats.slice(0, 4)
    : [
        { value: "30%",  label: "Avg case acceptance lift" },
        { value: "96%",  label: "First-time right rate" },
        { value: "50%",  label: "Denture appointments saved" },
        { value: "$0",   label: "CAPEX to get started" },
      ];

  const dividerColor = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";

  // Only allow inline edits when the page already has explicit stats. If the
  // block is rendering placeholder defaults, edits would silently disappear
  // because they wouldn't be persisted to the (still-empty) `stats` array.
  const editable = onFieldChange && stats.length > 0;
  const updateStat = (i: number, patch: Partial<{ value: string; label: string }>) => {
    if (!onFieldChange) return;
    const next = stats.slice();
    next[i] = { ...next[i], ...patch };
    onFieldChange({ ...props, stats: next });
  };

  return (
    <section style={getBgStyle(backgroundStyle)}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ height: 1, background: dividerColor }} />

        <div
          className="grid grid-cols-2 sm:flex sm:flex-row sm:justify-center"
          style={{ "--divider-color": dividerColor } as React.CSSProperties}
        >
          {displayStats.map((stat, i) => (
            <div
              key={i}
              className={`sm:w-56${i > 0 ? " sm:border-l" : ""}`}
              style={i > 0 ? { borderColor: "var(--divider-color)" } : {}}
            >
              <StatItem
                stat={stat}
                i={i}
                dark={dark}
                onUpdateValue={editable ? (v) => updateStat(i, { value: v }) : undefined}
                onUpdateLabel={editable ? (v) => updateStat(i, { label: v }) : undefined}
              />
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: dividerColor }} />
      </div>
    </section>
  );
}
