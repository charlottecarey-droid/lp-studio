import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface WordRevealProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  dimColor?: string;
  brightColor?: string;
}

export function WordReveal({
  text,
  className,
  style,
  dimColor = "rgba(255,255,255,0.2)",
  brightColor = "#ffffff",
}: WordRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.4"],
  });

  const words = text.trim().split(/\s+/);
  const total = words.length;

  return (
    <span ref={ref} className={className} style={{ display: "inline", ...style }}>
      {words.map((word, i) => {
        const start = i / total;
        const end = Math.min((i + 2) / total, 1);
        return (
          <Word
            key={i}
            scrollYProgress={scrollYProgress}
            start={start}
            end={end}
            dimColor={dimColor}
            brightColor={brightColor}
          >
            {word}
          </Word>
        );
      })}
    </span>
  );
}

function Word({
  children,
  scrollYProgress,
  start,
  end,
  dimColor,
  brightColor,
}: {
  children: string;
  scrollYProgress: ReturnType<typeof useScroll>["scrollYProgress"];
  start: number;
  end: number;
  dimColor: string;
  brightColor: string;
}) {
  const color = useTransform(scrollYProgress, [start, end], [dimColor, brightColor]);

  return (
    <motion.span style={{ color, display: "inline" }}>
      {children}{" "}
    </motion.span>
  );
}
