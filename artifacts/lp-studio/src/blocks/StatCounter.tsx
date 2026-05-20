import { useEffect, useRef, useState } from "react";
import { useInView, useSpring, useTransform, motion } from "framer-motion";

function parseStatValue(raw: string): { prefix: string; value: number; decimals: number; suffix: string } | null {
  const match = raw.match(/^([^0-9]*)(\d+(?:\.\d+)?)(.*)$/);
  // No digit at all (e.g. "Real-time", "Live", "Coming soon") — caller will
  // render the raw string verbatim instead of synthesizing a "0" prefix.
  if (!match) return null;
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
  const parsed = parseStatValue(raw);

  // Hooks must run unconditionally — drive the spring with 0 when there's
  // nothing to animate; we just don't render it.
  const spring = useSpring(0, { stiffness: 60, damping: 20, mass: 0.8 });
  const display = useTransform(spring, (v) => v.toFixed(parsed?.decimals ?? 0));

  useEffect(() => {
    if (isInView && parsed) spring.set(parsed.value);
  }, [isInView, parsed, spring]);

  if (!parsed) {
    return <span ref={ref} style={style}>{raw}</span>;
  }

  return (
    <span ref={ref} style={style}>
      {parsed.prefix}
      <motion.span>{display}</motion.span>
      {parsed.suffix}
    </span>
  );
}
