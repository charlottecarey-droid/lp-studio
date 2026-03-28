import { useEffect, useRef, useState } from "react";
import { useInView, useSpring, useTransform, motion } from "framer-motion";

function parseStatValue(raw: string): { prefix: string; value: number; decimals: number; suffix: string } {
  const match = raw.match(/^([^0-9]*)(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return { prefix: "", value: 0, decimals: 0, suffix: raw };
  const numStr = match[2];
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
  return {
    prefix: match[1],
    value: parseFloat(numStr),
    decimals,
    suffix: match[3],
  };
}

interface StatCounterProps {
  value: string;
  style?: React.CSSProperties;
}

export function StatCounter({ value: raw, style }: StatCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-5%" });
  const { prefix, value, decimals, suffix } = parseStatValue(raw);

  const spring = useSpring(0, { stiffness: 60, damping: 20, mass: 0.8 });
  const display = useTransform(spring, (v) =>
    v.toFixed(decimals)
  );

  useEffect(() => {
    if (isInView) spring.set(value);
  }, [isInView, value, spring]);

  return (
    <span ref={ref} style={style}>
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}
