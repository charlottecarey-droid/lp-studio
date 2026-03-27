import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import type { DsoStatBarBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

interface Props {
  props: DsoStatBarBlockProps;
}

const P = "hsl(152,42%,12%)";
const FG = "hsl(152,40%,13%)";
const MU = "hsl(152,8%,48%)";

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
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: i * 0.08, duration: 0.5 }}
      className="text-center"
    >
      <p
        style={{
          fontSize: "clamp(2rem,4vw,2.75rem)",
          fontWeight: 500,
          color: dark ? "hsl(68,60%,52%)" : FG,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {stat.value}
      </p>
      <p style={{ fontSize: "0.875rem", color: dark ? "rgba(255,255,255,0.6)" : MU, marginTop: "0.375rem" }}>
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
        { value: "30%", label: "Avg case acceptance lift" },
        { value: "96%", label: "First-time right rate" },
        { value: "50%", label: "Denture appointments saved" },
        { value: "$0", label: "CAPEX to get started" },
      ];

  return (
    <section style={getBgStyle(backgroundStyle)}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2.5rem 1.5rem 3rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "2rem 1rem",
          }}
          className="md:grid-cols-4"
        >
          {displayStats.map((stat, i) => (
            <StatItem key={stat.label} stat={stat} i={i} dark={dark} />
          ))}
        </div>
      </div>
    </section>
  );
}
