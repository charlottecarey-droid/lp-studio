import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { DsoStatRowBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { BlockDsoCta } from "@/components/BlockDsoCta";
import { InlineText } from "@/components/InlineText";

interface Props {
  props: DsoStatRowBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: DsoStatRowBlockProps) => void;
}

const BRAND   = "var(--brand-primary, #003A30)";
const LIME    = "var(--brand-accent, hsl(68,60%,52%))";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK } from "../lib/brand-fonts";
const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_STACK;

/**
 * Count-up respects reduced-motion. On phones the stats are laid out as a
 * 2-column grid (all visible at once), so animation is fine there too.
 */
function shouldAnimateCount(): boolean {
  if (typeof window === "undefined") return false;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return !reducedMotion;
}

function CountUp({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const animate = shouldAnimateCount();
  const [count, setCount] = useState(animate ? 0 : target);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!animate) {
      setCount(target);
      return;
    }
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
  }, [target, animate]);

  return <span ref={ref} style={{ fontFamily: BODY }}>{prefix}{count}{suffix}</span>;
}

function parseStatValue(value: string): { prefix: string; num: number; suffix: string } | null {
  const m = value.match(/^([^0-9]*)([0-9]+(?:\.[0-9]+)?)(.*)$/);
  if (!m) return null;
  return { prefix: m[1], num: parseFloat(m[2]), suffix: m[3] };
}

export function BlockDsoStatRow({ props, brand, onFieldChange }: Props) {
  const { eyebrow, headline, items = [], ctaText, ctaUrl, ctaMode = "link", ctaVariant = "secondary", backgroundStyle = "dark", animateNumbers = true } = props;
  const field = (key: keyof DsoStatRowBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;
  const updateItem = (i: number, patch: Partial<typeof items[number]>) => {
    if (!onFieldChange) return;
    const next = items.slice();
    next[i] = { ...next[i], ...patch };
    onFieldChange({ ...props, items: next });
  };
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
        {(eyebrow || headline || onFieldChange) && (
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            {(eyebrow || onFieldChange) && (
              <InlineText as="p" value={eyebrow ?? ""} onUpdate={field("eyebrow")} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: eyebrowC, marginBottom: "0.75rem", fontFamily: BODY }} />
            )}
            {(headline || onFieldChange) && (
              <InlineText
                as="h2"
                value={headline ?? ""}
                onUpdate={field("headline")}
                style={{ fontFamily: DISPLAY, fontSize: "clamp(1.875rem,3.5vw,2.75rem)", fontWeight: 600, color: headlineC, lineHeight: 1.15, letterSpacing: "-0.015em" }}
              />
            )}
          </div>
        )}

        {/*
          Mobile: horizontal snap-scroll so 3 or 6 items don't leave an
          odd card stranded in a 2-col grid. Each item is ~70% viewport
          width so the next one peeks in to hint scrollability.
          Desktop (sm+): equal-width grid columns inside a bordered
          card with internal dividers between items.
        */}
        <div
          className="dso-stat-row flex overflow-x-auto snap-x snap-mandatory gap-3 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:gap-0 sm:overflow-visible"
          style={{
            ["--dso-stat-cols" as string]: String(Math.min(items.length, 4)),
            ["--dso-stat-border" as string]: divC,
            scrollbarWidth: "none",
          }}
        >
          <style>{`
            .dso-stat-row::-webkit-scrollbar { display: none; }
            @media (min-width: 640px) {
              .dso-stat-row {
                grid-template-columns: repeat(var(--dso-stat-cols), 1fr);
                border: 1px solid var(--dso-stat-border);
                border-radius: 1rem;
                overflow: hidden;
              }
            }
          `}</style>
          {items.map((item, i) => {
            const parsed = parseStatValue(item.value);
            const isLast = i === items.length - 1;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className={`rounded-2xl sm:rounded-none border sm:border-0 shrink-0 basis-[70%] snap-start sm:basis-auto sm:shrink ${isLast ? "" : "sm:border-r"}`}
                style={{
                  padding: "1.25rem 1rem",
                  textAlign: "center",
                  borderColor: divC,
                  background: dark ? "rgba(255,255,255,0.03)" : "#fff",
                }}
              >
                {/* CountUp animates parsed-number values during read-only render.
                    In edit mode (onFieldChange present), swap to InlineText so the
                    raw string is editable; the count animation is suppressed there. */}
                {onFieldChange ? (
                  <InlineText
                    as="div"
                    value={item.value}
                    onUpdate={(v) => updateItem(i, { value: v })}
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: "clamp(2.25rem,4vw,3rem)",
                      fontWeight: 700,
                      color: valC,
                      lineHeight: 1,
                      marginBottom: "0.625rem",
                      letterSpacing: "-0.02em",
                    }}
                  />
                ) : (
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
                    {parsed && animateNumbers ? (
                      <CountUp prefix={parsed.prefix} target={parsed.num} suffix={parsed.suffix} />
                    ) : item.value}
                  </div>
                )}
                <InlineText as="p" value={item.label} onUpdate={onFieldChange ? (v) => updateItem(i, { label: v }) : undefined} style={{ fontSize: "0.9375rem", fontWeight: 600, color: labelC, marginBottom: item.detail ? "0.25rem" : 0, fontFamily: BODY }} />
                {(item.detail || onFieldChange) && (
                  <InlineText as="p" value={item.detail ?? ""} onUpdate={onFieldChange ? (v) => updateItem(i, { detail: v }) : undefined} style={{ fontSize: "0.8125rem", color: detailC, lineHeight: 1.5, fontFamily: BODY }} />
                )}
              </motion.div>
            );
          })}
        </div>

        {ctaText && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            style={{ textAlign: "center", marginTop: "2.5rem" }}
          >
            <BlockDsoCta ctaText={ctaText} ctaUrl={ctaUrl} ctaMode={ctaMode} ctaVariant={ctaVariant} brand={brand} dark={dark} />
          </motion.div>
        )}
      </div>
    </section>
  );
}
