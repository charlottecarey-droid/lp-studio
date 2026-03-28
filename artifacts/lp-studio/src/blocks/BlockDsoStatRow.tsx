import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { DsoStatRowBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

interface Props {
  props: DsoStatRowBlockProps;
}

const BRAND   = "#003A30";
const LIME    = "hsl(68,60%,52%)";
const DISPLAY = "'Bagoss Standard','Inter',system-ui,sans-serif";

function CountUp({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1400;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            setCount(Math.round(ease * target));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

function parseStatValue(value: string): { prefix: string; num: number; suffix: string } | null {
  const m = value.match(/^([^0-9]*)([0-9]+(?:\.[0-9]+)?)(.*)$/);
  if (!m) return null;
  return { prefix: m[1], num: parseFloat(m[2]), suffix: m[3] };
}

export function BlockDsoStatRow({ props }: Props) {
  const { eyebrow, headline, items = [], backgroundStyle = "dark" } = props;
  const dark = isDarkBg(backgroundStyle);
  const sectionBg = getBgStyle(backgroundStyle);

  const eyebrowC  = dark ? LIME : BRAND;
  const headlineC = dark ? "#fff" : BRAND;
  const valC      = dark ? LIME : BRAND;
  const labelC    = dark ? "rgba(255,255,255,0.75)" : "#374151";
  const detailC   = dark ? "rgba(255,255,255,0.35)" : "#9ca3af";
  const divC      = dark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  return (
    <section style={sectionBg} className="py-16 md:py-20">
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>
        {(eyebrow || headline) && (
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            {eyebrow && (
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: eyebrowC, marginBottom: "0.75rem" }}>
                {eyebrow}
              </p>
            )}
            {headline && (
              <h2 style={{ fontFamily: DISPLAY, fontSize: "clamp(1.875rem,3.5vw,2.75rem)", fontWeight: 600, color: headlineC, lineHeight: 1.15, letterSpacing: "-0.015em" }}>
                {headline}
              </h2>
            )}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`,
            gap: "0",
            border: `1px solid ${divC}`,
            borderRadius: "1rem",
            overflow: "hidden",
          }}
        >
          {items.map((item, i) => {
            const parsed = parseStatValue(item.value);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                style={{
                  padding: "2rem 1.5rem",
                  textAlign: "center",
                  borderRight: i < items.length - 1 ? `1px solid ${divC}` : "none",
                  background: dark ? "rgba(255,255,255,0.03)" : "#fff",
                }}
              >
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: "clamp(2.25rem,4vw,3rem)",
                    fontWeight: 700,
                    color: valC,
                    lineHeight: 1,
                    marginBottom: "0.625rem",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {parsed ? (
                    <CountUp prefix={parsed.prefix} target={parsed.num} suffix={parsed.suffix} />
                  ) : item.value}
                </div>
                <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: labelC, marginBottom: item.detail ? "0.25rem" : 0 }}>
                  {item.label}
                </p>
                {item.detail && (
                  <p style={{ fontSize: "0.8125rem", color: detailC, lineHeight: 1.5 }}>{item.detail}</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
