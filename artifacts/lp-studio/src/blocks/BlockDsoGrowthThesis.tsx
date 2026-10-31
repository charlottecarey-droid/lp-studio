import { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useMotionValueEvent, animate } from "framer-motion";
import { useAnimInitial, useRevealFallback, useStaticRender } from "@/lib/reveal-fallback";
import { PulseGlow, ScanAcross } from "./SectionAmbient";
import { WordReveal } from "./WordReveal";
import type { DsoGrowthThesisBlockProps } from "@/lib/block-types";
import { getBgStyle, resolveSectionSurface } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "../lib/brand-fonts";

/**
 * DSO — Growth thesis (Oct 2026).
 *
 * A cinematic statement section in the idiom of meetdandy.com's Vision page:
 * one long sentence set very large on a dark surface, each word lighting up
 * as the reader scrolls (WordReveal), followed by three oversized pillars
 * (big numeral, label, one line of proof). Built for the enterprise DSO page,
 * where the argument ("same-store growth, powered by the lab") deserves a
 * full-width statement rather than a card grid.
 *
 * Reveal contract: WordReveal pins its bright frame under static render; the
 * pillars use useAnimInitial + useRevealFallback, and count-ups jump to the
 * final number on static render (see lib/reveal-fallback.ts).
 */

const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_STACK;
const NUMBERS = BRAND_NUMBERS_STACK;
const P = "var(--brand-primary, #0f172a)";
const AW = "var(--brand-accent, hsl(68,60%,52%))";

export const DSO_GROWTH_THESIS_DEFAULT_PROPS: DsoGrowthThesisBlockProps = {
  eyebrow: "The thesis",
  statement:
    "Acquisitions slow down. Same-store growth doesn't have to. The partner that touches every chair, every day, is the biggest growth lever an organization already owns.",
  pillars: [
    { value: "25%", label: "More throughput each day", body: "Fewer reworks and shorter cycles free capacity at every location." },
    { value: "2x", label: "More revenue per visit", body: "Visualization and easy add-ons lift acceptance and share of wallet." },
    { value: "100%", label: "Visibility across the network", body: "Centralized data surfaces what no single location can see." },
  ],
  footnote: "",
  backgroundStyle: "black",
};

function parseValue(raw: string): { prefix: string; num: number; suffix: string; isDecimal: boolean } {
  const match = raw.match(/^([^0-9]*)(\d[\d,.]*)(.*)$/);
  if (!match) return { prefix: "", num: 0, suffix: raw, isDecimal: false };
  const numStr = match[2].replace(/,/g, "");
  const num = parseFloat(numStr);
  return { prefix: match[1], num, suffix: match[3], isDecimal: numStr.includes(".") };
}

function Pillar({
  pillar,
  index,
  fg,
  mu,
  rule,
  onUpdate,
}: {
  pillar: DsoGrowthThesisBlockProps["pillars"][number];
  index: number;
  fg: string;
  mu: string;
  rule: string;
  onUpdate?: (patch: Partial<DsoGrowthThesisBlockProps["pillars"][number]>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const forceVisible = useRevealFallback(inView);
  const show = inView || forceVisible;
  const staticRender = useStaticRender();
  const anim = useAnimInitial();

  const { prefix, num, suffix, isDecimal } = parseValue(pillar.value);
  const numeric = /\d/.test(pillar.value);
  const count = useMotionValue(staticRender || !numeric ? num : 0);
  const fmt = (v: number) => `${prefix}${isDecimal ? v.toFixed(1) : Math.round(v).toLocaleString()}${suffix}`;
  const [display, setDisplay] = useState(() => (numeric ? fmt(staticRender ? num : 0) : pillar.value));
  useMotionValueEvent(count, "change", (latest) => {
    if (numeric) setDisplay(fmt(latest));
  });
  useEffect(() => {
    if (!numeric) {
      setDisplay(pillar.value);
      return;
    }
    if (staticRender) {
      count.jump(num);
      setDisplay(fmt(num));
      return;
    }
    if (show) animate(count, num, { duration: 1.5, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticRender, show, num, numeric, pillar.value, index]);

  return (
    <motion.div
      ref={ref}
      initial={anim({ opacity: 0, y: 28 })}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.8, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
      style={{ borderTop: `1px solid ${rule}`, paddingTop: "2rem", position: "relative" }}
    >
      <motion.div
        aria-hidden
        initial={anim({ width: 0 })}
        animate={show ? { width: 56 } : { width: 0 }}
        transition={{ duration: 0.7, delay: index * 0.12 + 0.2 }}
        style={{ position: "absolute", top: -1, left: 0, height: 2, background: AW, borderRadius: 1 }}
      />
      {onUpdate ? (
        <InlineText
          as="p"
          value={pillar.value}
          onUpdate={(v) => onUpdate({ value: v })}
          style={{ fontFamily: NUMBERS, fontSize: "clamp(3.25rem, 6.5vw, 5.75rem)", fontWeight: 500, letterSpacing: "-0.045em", lineHeight: 0.95, color: fg, marginBottom: "1.25rem" }}
        />
      ) : (
        <p style={{ fontFamily: NUMBERS, fontSize: "clamp(3.25rem, 6.5vw, 5.75rem)", fontWeight: 500, letterSpacing: "-0.045em", lineHeight: 0.95, color: fg, marginBottom: "1.25rem" }}>
          {display}
        </p>
      )}
      <p style={{ fontFamily: BODY, fontSize: "1.0625rem", fontWeight: 600, color: fg, letterSpacing: "-0.01em", marginBottom: "0.5rem" }}>
        <InlineText as="span" value={pillar.label} onUpdate={onUpdate ? (v) => onUpdate({ label: v }) : undefined} style={{ fontFamily: BODY }} />
      </p>
      {(pillar.body || onUpdate) && (
        <p style={{ fontFamily: BODY, fontSize: "0.9375rem", lineHeight: 1.6, color: mu, maxWidth: 360 }}>
          <InlineText as="span" value={pillar.body ?? ""} onUpdate={onUpdate ? (v) => onUpdate({ body: v }) : undefined} multiline style={{ fontFamily: BODY }} />
        </p>
      )}
    </motion.div>
  );
}

interface Props {
  brand?: BrandConfig;
  props: DsoGrowthThesisBlockProps;
  onFieldChange?: (updated: DsoGrowthThesisBlockProps) => void;
}

export function BlockDsoGrowthThesis({ props, brand, onFieldChange }: Props) {
  const merged = { ...DSO_GROWTH_THESIS_DEFAULT_PROPS, ...props };
  const { eyebrow, statement, footnote, backgroundStyle = "black", ctaText, ctaUrl, ctaMode = "link" } = merged;
  const pillars = (merged.pillars && merged.pillars.length > 0 ? merged.pillars : DSO_GROWTH_THESIS_DEFAULT_PROPS.pillars).slice(0, 4);

  const field = (key: keyof DsoGrowthThesisBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v } as DsoGrowthThesisBlockProps) : undefined;
  const updatePillar = onFieldChange
    ? (i: number, patch: Partial<DsoGrowthThesisBlockProps["pillars"][number]>) => {
        const next = pillars.map((p, idx) => (idx === i ? { ...p, ...patch } : { ...p }));
        onFieldChange({ ...props, pillars: next });
      }
    : undefined;

  const dark = resolveSectionSurface({ backgroundStyle }, "#ffffff", brand).isDark;
  const fg = dark ? "#FFFFFF" : P;
  const dim = dark ? "rgba(255,255,255,0.22)" : "rgb(var(--brand-primary-rgb, 15 23 42) / 0.22)";
  const mu = dark ? "rgba(255,255,255,0.56)" : "rgb(var(--brand-primary-rgb, 15 23 42) / 0.62)";
  const rule = dark ? "rgba(255,255,255,0.12)" : "rgb(var(--brand-primary-rgb, 15 23 42) / 0.12)";

  const sectionRef = useRef<HTMLElement>(null);
  const anim = useAnimInitial();
  const headerInView = useInView(sectionRef, { once: true, margin: "-40px" });
  const headerForce = useRevealFallback(headerInView);
  const showHeader = headerInView || headerForce;
  const cols = pillars.length === 4 ? "lg:grid-cols-4" : pillars.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";

  return (
    <section
      ref={sectionRef}
      data-block="dso-growth-thesis"
      style={{ ...getBgStyle(backgroundStyle), color: fg, position: "relative", overflow: "hidden" }}
      className="py-28 md:py-40"
    >
      {dark && (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "-18%",
              left: "-10%",
              width: "55vw",
              height: "55vw",
              maxWidth: 820,
              maxHeight: 820,
              background: "radial-gradient(circle, rgb(var(--brand-accent-rgb, 199 231 56) / 0.10) 0%, transparent 62%)",
              filter: "blur(10px)",
              pointerEvents: "none",
            }}
          />
          <ScanAcross duration={14} delay={2} repeatDelay={10} />
          <PulseGlow top="78%" left="86%" size={360} duration={9} delay={1} />
        </>
      )}

      <div style={{ maxWidth: "var(--lp-page-max)", margin: "0 auto", padding: "0 1.5rem", position: "relative" }}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-3">
            {(eyebrow || onFieldChange) && (
              <motion.p
                initial={anim({ opacity: 0, y: 8 })}
                animate={showHeader ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5 }}
                style={{ fontFamily: BODY, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: AW, display: "flex", alignItems: "center", gap: 12 }}
              >
                <span aria-hidden style={{ width: 28, height: 1, background: AW, display: "inline-block" }} />
                <InlineText as="span" value={eyebrow ?? ""} onUpdate={field("eyebrow")} style={{ fontFamily: BODY }} />
              </motion.p>
            )}
          </div>
          <div className="lg:col-span-9">
            <h2
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(2.125rem, 4.6vw, 4.5rem)",
                lineHeight: 1.06,
                fontWeight: 500,
                letterSpacing: "-0.025em",
                margin: 0,
                textWrap: "balance",
              } as React.CSSProperties}
            >
              {onFieldChange ? (
                <InlineText as="span" value={statement} onUpdate={field("statement")} multiline style={{ fontFamily: DISPLAY, color: fg }} />
              ) : (
                <WordReveal text={statement} dimColor={dim} brightColor={fg} />
              )}
            </h2>
          </div>
        </div>

        <div className={`mt-20 md:mt-28 grid grid-cols-1 sm:grid-cols-2 ${cols} gap-x-10 gap-y-12`}>
          {pillars.map((p, i) => (
            <Pillar key={i} pillar={p} index={i} fg={fg} mu={mu} rule={rule} onUpdate={updatePillar ? (patch) => updatePillar(i, patch) : undefined} />
          ))}
        </div>

        {(footnote || ctaText || onFieldChange) && (
          <motion.div
            initial={anim({ opacity: 0, y: 12 })}
            animate={showHeader ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 flex flex-col sm:flex-row sm:items-center gap-6 justify-between"
          >
            {(footnote || onFieldChange) && (
              <p style={{ fontFamily: BODY, fontSize: "0.8125rem", color: mu, maxWidth: 560, lineHeight: 1.6 }}>
                <InlineText as="span" value={footnote ?? ""} onUpdate={field("footnote")} multiline style={{ fontFamily: BODY }} />
              </p>
            )}
            {ctaText && (
              ctaMode === "chilipiper" ? (
                <ChiliPiperButton
                  url={ctaUrl ?? ""}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0.8rem 1.75rem", borderRadius: 999, background: AW, color: "#0B1410", fontWeight: 600, fontSize: "0.875rem", letterSpacing: "0.04em", textTransform: "uppercase", border: "none", cursor: "pointer", fontFamily: BODY }}
                >
                  <InlineText as="span" value={ctaText} onUpdate={field("ctaText")} style={{ fontFamily: BODY }} />
                </ChiliPiperButton>
              ) : (
                <a
                  href={ctaUrl || "#"}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0.8rem 1.75rem", borderRadius: 999, background: AW, color: "#0B1410", fontWeight: 600, fontSize: "0.875rem", letterSpacing: "0.04em", textTransform: "uppercase", textDecoration: "none", fontFamily: BODY }}
                >
                  <InlineText as="span" value={ctaText} onUpdate={field("ctaText")} style={{ fontFamily: BODY }} />
                </a>
              )
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}
