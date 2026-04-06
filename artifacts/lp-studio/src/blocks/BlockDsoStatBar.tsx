import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoStatBarBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

interface Props {
  props: DsoStatBarBlockProps;
}

const AW  = "hsl(68,60%,52%)";
const FG  = "hsl(152,40%,13%)";
const MU  = "hsl(152,8%,48%)";
const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

const StatItem = ({
  stat, i, dark,
}: {
  stat: { value: string; label: string };
  i: number;
  dark: boolean;
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
      {/* Value */}
      <p
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: "clamp(2.25rem,4vw,3rem)",
          fontWeight: 600,
          color: dark ? AW : FG,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {stat.value}
      </p>

      {/* Decorative rule */}
      <div
        style={{
          width: 24,
          height: 1,
          background: dark ? `${AW}55` : "rgba(0,58,48,0.18)",
          margin: "0.875rem auto",
        }}
      />

      {/* Label */}
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: dark ? "rgba(255,255,255,0.50)" : MU,
          lineHeight: 1.5,
          maxWidth: 130,
        }}
      >
        {stat.label}
      </p>
    </motion.div>
  );
};

export function BlockDsoStatBar({ props }: Props) {
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

  return (
    <section style={getBgStyle(backgroundStyle)}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem" }}>
        {/* Top rule */}
        <div style={{ height: 1, background: dividerColor }} />

        {/*
          On mobile: 2-col grid (no dividers, clean)
          On sm+:   single flex row with CSS border-left dividers on all
                    items except the first
        */}
        <div
          className="grid grid-cols-2 sm:flex sm:flex-row sm:justify-center"
          style={{ "--divider-color": dividerColor } as React.CSSProperties}
        >
          {displayStats.map((stat, i) => (
            <div
              key={stat.label}
              className={`sm:w-56${i > 0 ? " sm:border-l" : ""}`}
              style={i > 0 ? { borderColor: "var(--divider-color)" } : {}}
            >
              <StatItem stat={stat} i={i} dark={dark} />
            </div>
          ))}
        </div>

        {/* Bottom rule */}
        <div style={{ height: 1, background: dividerColor }} />
      </div>
    </section>
  );
}
