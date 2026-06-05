import { useEffect, useRef, useState } from "react";
import { useInView, useSpring, useTransform, motion } from "framer-motion";
import { isLikelyHtml } from "../lib/sanitize-inline-html";

// Stat values can carry inline-color HTML when an editor recolors them with the
// builder's inline color picker (e.g. `<span style="color: #FFFFFF">96%</span>`).
// The builder renders the field through InlineText (which renders HTML), but the
// published page renders through StatCounter. Without stripping, StatCounter
// would treat the entire HTML string as the value and dump the literal tags as
// visible text ("96% renders as code" on the published page).
function stripHtmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

// Preserve the editor's chosen color. Nested spans cascade so the innermost
// (last-in-source) valid color wins; invalid fragments like "#0" are skipped.
function extractColor(html: string): string | null {
  const matches = [...html.matchAll(/color\s*:\s*([^;"']+)/gi)].map((m) => m[1].trim());
  for (let i = matches.length - 1; i >= 0; i--) {
    const c = matches[i];
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) || /^rgba?\(/i.test(c)) return c;
  }
  return null;
}

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
  const html = isLikelyHtml(raw);
  const text = html ? stripHtmlToText(raw) : raw;
  const colorOverride = html ? extractColor(raw) : null;
  const mergedStyle = colorOverride ? { ...style, color: colorOverride } : style;
  const parsed = parseStatValue(text);

  // Hooks must run unconditionally — drive the spring with 0 when there's
  // nothing to animate; we just don't render it.
  const spring = useSpring(0, { stiffness: 60, damping: 20, mass: 0.8 });
  const display = useTransform(spring, (v) => v.toFixed(parsed?.decimals ?? 0));

  useEffect(() => {
    if (isInView && parsed) spring.set(parsed.value);
  }, [isInView, parsed, spring]);

  if (!parsed) {
    return <span ref={ref} style={mergedStyle}>{text}</span>;
  }

  return (
    <span ref={ref} style={mergedStyle}>
      {parsed.prefix}
      <motion.span>{display}</motion.span>
      {parsed.suffix}
    </span>
  );
}
