import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { RemakeCostCalculatorBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { isValidHex, pickContrastingColor, type BrandConfig } from "@/lib/brand-config";
import { cn } from "@/lib/utils";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "../lib/brand-fonts";

/**
 * Two-field remake cost calculator (practices + avg case value), benchmark
 * scenario chips, everything else collapsed behind "refine your estimate".
 *
 * Built for the customer-website embed: the host page owns conversion, so
 * there is deliberately NO page-CTA-following button. The optional
 * "analysis" link in the results panel (analysisCtaLabel/Href) is a plain
 * anchor the host page points wherever it likes — its prop names stay off
 * the CTA alias lists on purpose. No vh sizing, no sticky positioning
 * (useless inside an embed iframe — the iframe never scrolls internally),
 * and no scroll reveals (fail-open contract satisfied by having no hidden
 * initial states at all).
 *
 * The host page also owns spacing, so the section has NO outer padding.
 * All type is em-based off the section's font-size so `fontScale` resizes
 * the whole block uniformly (matching the host site's larger type).
 */

interface Props {
  props: RemakeCostCalculatorBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: RemakeCostCalculatorBlockProps) => void;
}

const BODY = BRAND_BODY_FONT;
const DISPLAY = BRAND_DISPLAY_STACK;

/* Fallback = Dandy deep green, so the block still renders correctly in
   contexts that never set the brand CSS variables (fixture previews,
   thumbnails). */
const PRIMARY = "var(--brand-primary, #0B3B2B)";

const fmtDollar = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const BG_STYLES: Record<string, string> = {
  white: "bg-white",
  dark: "bg-[var(--brand-primary)]",
  "light-gray": "bg-slate-50",
  muted: "bg-[hsl(42,18%,96%)]",
  "dandy-green": "bg-[var(--brand-primary)]",
  black: "bg-black",
};

/** Parse a visitor-typed field: "" stays empty, junk becomes null. */
function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** Clamp the font-scale multiplier so users can't blow up the layout. */
function clampScale(v: unknown, fallback = 1): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0.6, Math.min(1.8, n));
}

/** Clamp the outer padding (px). Defaults to 0 — the embed host owns spacing. */
function clampPadding(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(160, n));
}

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  prefix?: string;
  suffix?: string;
}) => (
  <div>
    <label
      className="text-[0.75em] font-semibold text-foreground uppercase tracking-wider mb-1.5 block"
      style={{ fontFamily: BODY }}
    >
      {label}
    </label>
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.9375em] text-muted-foreground pointer-events-none" style={{ fontFamily: BODY }}>
          {prefix}
        </span>
      )}
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded-xl border border-[#0a1628]/10 bg-white py-3 text-[1em] text-foreground placeholder:text-muted-foreground/50 shadow-[inset_0_1px_2px_rgba(10,22,40,0.04)] transition-colors hover:border-[#0a1628]/20 focus:outline-none focus:border-[var(--brand-primary,#0B3B2B)]/40 focus:ring-2 focus:ring-[var(--brand-primary)]/15",
          prefix ? "pl-7 pr-3" : suffix ? "pl-3 pr-8" : "px-3",
        )}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.9375em] text-muted-foreground pointer-events-none" style={{ fontFamily: BODY }}>
          {suffix}
        </span>
      )}
    </div>
  </div>
);

export function BlockRemakeCostCalculator({ props, brand, onFieldChange }: Props) {
  const fontScale = clampScale(props.fontScale);
  const outerPadding = clampPadding(props.outerPadding);
  const accentColor = props.accentColor ?? brand.accentColor ?? "var(--brand-accent, #C7E738)";
  // Analysis-button ink over the accent fill. When the accent is a real hex,
  // pick a contrast-safe color (brand primary first — the Dandy lime-on-green
  // pairing); a CSS-var accent means the default lime, where deep green reads.
  const analysisBtnText = isValidHex(accentColor)
    ? pickContrastingColor(brand.primaryColor, accentColor, ["#0a1628", "#ffffff"])
    : "var(--brand-primary, #0B3B2B)";

  // Results-panel alignment. text-align also places the inline-flex chip and
  // button; the width-capped paragraphs need their auto margins to follow.
  const resultsAlign = props.resultsAlign ?? "center";
  const alignText = resultsAlign === "left" ? "text-left" : resultsAlign === "right" ? "text-right" : "text-center";
  const alignCapped = resultsAlign === "left" ? "" : resultsAlign === "right" ? "ml-auto" : "mx-auto";
  const dark = resolveSectionSurface({ backgroundStyle: props.backgroundStyle ?? "muted" }, "#ffffff", brand).isDark;
  const headlineColor = dark ? "#fff" : "#0a1628";
  const subColor = dark ? "rgba(255,255,255,0.72)" : "#6b7280";

  type CopyKey = "headline" | "subheadline" | "scenarioLabel" | "resultsLabel" | "resultsSublabel" | "resultsHeadline" | "resultsPlaceholder" | "resultsFootnote";
  const field = (key: CopyKey) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined;

  const scenarios = props.scenarios ?? [];
  const [scenarioId, setScenarioId] = useState<string>(scenarios[0]?.id ?? "");
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];

  // Visitor inputs live as raw strings so fields can sit empty showing their
  // "e.g." placeholders until the visitor types — matching the live page.
  const [practicesStr, setPracticesStr] = useState("");
  const [caseValueStr, setCaseValueStr] = useState("");
  const [restorationsStr, setRestorationsStr] = useState("");
  const [remakeRateStr, setRemakeRateStr] = useState("");
  const [chairTimeStr, setChairTimeStr] = useState("");
  const [labCostStr, setLabCostStr] = useState("");
  const [prodPerHourStr, setProdPerHourStr] = useState("");
  const [refineOpen, setRefineOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const practices = num(practicesStr);
  const caseValue = num(caseValueStr);
  const canCalculate = practices !== null && practices > 0 && caseValue !== null && caseValue > 0;

  // `?? 50` guards pages saved before the defaultLabCostPct → PerCase rename.
  const labCostDefault = props.defaultLabCostPerCase ?? 50;

  const result = useMemo(() => {
    if (!canCalculate || !scenario) return null;
    const restorations = num(restorationsStr) ?? props.defaultRestorationsPerPractice;
    // Editing the rate in "refine" overrides the selected chip's benchmark.
    const remakeRate = num(remakeRateStr) ?? scenario.remakeRate;
    const chairTime = num(chairTimeStr) ?? props.defaultChairTimeHours;
    const labCost = num(labCostStr) ?? labCostDefault;
    const prodPerHour = num(prodPerHourStr) ?? props.defaultProductionPerHour;

    const remakesPerPracticeYear = restorations * 12 * (remakeRate / 100);
    // Same remake economics as the roi-calculator block: each remake forfeits
    // the case's full production value, burns chair time re-valued at
    // production/hour, and pays the lab's per-case hard cost again.
    const costPerRemake = caseValue! + chairTime * prodPerHour + labCost;
    const perPractice = remakesPerPracticeYear * costPerRemake;
    return { perPractice, total: perPractice * practices!, practices: practices! };
  }, [canCalculate, scenario, practicesStr, caseValueStr, restorationsStr, remakeRateStr, chairTimeStr, labCostStr, prodPerHourStr, props, caseValue, practices, labCostDefault]);
  const showResults = revealed && result !== null;

  return (
    <section
      className={cn("w-full", BG_STYLES[props.backgroundStyle ?? "muted"] ?? BG_STYLES["muted"])}
      style={{ fontSize: `${fontScale}rem`, padding: outerPadding ? `${outerPadding}px` : undefined }}
    >
      <div className="max-w-[1100px] mx-auto">
        {props.showHeader !== false && (props.headline || onFieldChange) && (
          <div className="text-center mb-10">
            <InlineText
              as="h2"
              value={props.headline ?? ""}
              onUpdate={field("headline")}
              style={{
                fontFamily: DISPLAY,
                fontSize: `clamp(2.125em, calc(4vw * ${fontScale}), 3.25em)`,
                fontWeight: 600,
                lineHeight: 1.12,
                letterSpacing: "-0.02em",
                color: headlineColor,
                marginBottom: "0.75em",
              }}
            />
            {(props.subheadline || onFieldChange) && (
              <InlineText
                as="p"
                value={props.subheadline ?? ""}
                onUpdate={field("subheadline")}
                multiline
                style={{ fontSize: "1.1875em", lineHeight: 1.65, color: subColor, maxWidth: "34em", margin: "0 auto", fontFamily: BODY }}
              />
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6 items-stretch">
          {/* ── LEFT: input card ── */}
          <div className="lg:col-span-3 bg-white rounded-[20px] p-6 md:p-8 flex flex-col gap-6 border border-[#0a1628]/[0.06] shadow-[0_1px_2px_rgba(10,22,40,0.04),0_16px_40px_-16px_rgba(10,22,40,0.14)]">
            <div>
              <InlineText
                as="p"
                value={props.scenarioLabel ?? ""}
                onUpdate={field("scenarioLabel")}
                className="text-[0.75em] font-semibold text-foreground uppercase tracking-wider mb-2.5 block"
                style={{ fontFamily: BODY }}
              />
              <div className="grid sm:grid-cols-3 gap-2.5">
                {scenarios.map((s) => {
                  const selected = s.id === scenario?.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setScenarioId(s.id); setRemakeRateStr(""); }}
                      aria-pressed={selected}
                      className={cn(
                        "text-left rounded-xl border px-3.5 py-3 transition-all duration-150",
                        selected
                          ? "border-[var(--brand-primary,#0B3B2B)] shadow-[0_6px_16px_-8px_rgba(11,59,43,0.4)]"
                          : "border-[#0a1628]/10 bg-white hover:border-[#0a1628]/25 hover:shadow-[0_4px_12px_-6px_rgba(10,22,40,0.16)]",
                      )}
                      style={selected ? { backgroundColor: `color-mix(in srgb, ${accentColor} 16%, white)` } : undefined}
                    >
                      <span className="block text-[0.9375em] font-semibold text-foreground" style={{ fontFamily: BODY }}>{s.label}</span>
                      <span className="block text-[0.8125em] leading-snug text-muted-foreground mt-0.5" style={{ fontFamily: BODY }}>{s.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
              <Field label="Number of practices" value={practicesStr} onChange={(v) => setPracticesStr(v)} placeholder="e.g. 12" />
              <Field label="Avg case value ($)" value={caseValueStr} onChange={(v) => setCaseValueStr(v)} placeholder="e.g. 1500" prefix="$" />
            </div>

            <div>
              <button
                type="button"
                onClick={() => setRefineOpen((o) => !o)}
                className="flex items-center gap-1 text-[0.875em] font-semibold transition-colors hover:opacity-80"
                style={{ color: PRIMARY, fontFamily: BODY }}
              >
                <ChevronRight className={cn("w-[1em] h-[1em] transition-transform", refineOpen && "rotate-90")} />
                {props.refineLabel}
              </button>
              {refineOpen && (
                <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4 mt-4">
                  <Field
                    label="Avg restorations / practice / month"
                    value={restorationsStr}
                    onChange={setRestorationsStr}
                    placeholder={`e.g. ${props.defaultRestorationsPerPractice}`}
                  />
                  <Field
                    label="Current remake rate (%)"
                    value={remakeRateStr}
                    onChange={setRemakeRateStr}
                    placeholder={scenario ? `${scenario.remakeRate}` : "5"}
                    suffix="%"
                  />
                  <Field
                    label="Avg chair time per case (hours)"
                    value={chairTimeStr}
                    onChange={setChairTimeStr}
                    placeholder={`e.g. ${props.defaultChairTimeHours}`}
                  />
                  <Field
                    label="Avg lab hard cost per case ($)"
                    value={labCostStr}
                    onChange={setLabCostStr}
                    placeholder={`e.g. ${labCostDefault}`}
                    prefix="$"
                  />
                  <Field
                    label="Avg production per hour ($)"
                    value={prodPerHourStr}
                    onChange={setProdPerHourStr}
                    placeholder={`e.g. ${props.defaultProductionPerHour}`}
                    prefix="$"
                  />
                </div>
              )}
            </div>

            <div className="mt-auto pt-5 border-t border-[#0a1628]/[0.06]">
            <button
              type="button"
              disabled={!canCalculate}
              onClick={() => setRevealed(true)}
              className="w-full rounded-full py-3.5 text-[0.9375em] font-bold uppercase tracking-widest transition-all enabled:hover:brightness-110 enabled:active:scale-[0.99] disabled:cursor-not-allowed"
              style={
                canCalculate
                  ? {
                      backgroundColor: PRIMARY,
                      color: "#fff",
                      fontFamily: BODY,
                      boxShadow: `0 12px 28px -12px color-mix(in srgb, ${PRIMARY} 60%, transparent)`,
                    }
                  : {
                      // Quiet neutral resting state — a washed-out primary reads broken.
                      backgroundColor: "color-mix(in srgb, #0a1628 6%, white)",
                      color: "rgba(10, 22, 40, 0.35)",
                      fontFamily: BODY,
                    }
              }
            >
              {props.calculateLabel}
            </button>
            </div>
          </div>

          {/* ── RIGHT: results panel ── */}
          <div className="lg:col-span-2">
            <div
              className={cn(
                "relative isolate overflow-hidden rounded-[20px] p-6 md:p-8 h-full flex flex-col ring-1 ring-inset ring-white/10 shadow-[0_24px_48px_-20px_rgba(11,59,43,0.45)]",
                alignText,
              )}
              style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${PRIMARY} 88%, #1a4a3a) 0%, ${PRIMARY} 55%, color-mix(in srgb, ${PRIMARY} 82%, black) 100%)` }}
            >
              {props.showResultsGlow !== false && (
                /* Soft accent glow, behind the content (isolate + -z-10). */
                <div
                  aria-hidden
                  className="pointer-events-none absolute -z-10 -top-24 -right-24 w-80 h-80 rounded-full opacity-20"
                  style={{ background: `radial-gradient(closest-side, ${accentColor}, transparent 72%)` }}
                />
              )}
              <InlineText
                as="h3"
                value={props.resultsLabel ?? ""}
                onUpdate={field("resultsLabel")}
                className="text-[1.625em] font-medium text-white tracking-tight"
                style={{ fontFamily: DISPLAY }}
              />
              {(props.resultsSublabel || onFieldChange) && (
                <InlineText
                  as="p"
                  value={props.resultsSublabel ?? ""}
                  onUpdate={field("resultsSublabel")}
                  className="text-[0.75em] font-semibold uppercase tracking-[0.14em] text-white/50 mt-2"
                  style={{ fontFamily: BODY }}
                />
              )}

              {/* Stat group — my-auto centers it between the header above and
                  the footnote below, so the panel reads composed at any height. */}
              <div className="my-auto py-6">
                {showResults ? (
                  <>
                    <p
                      className="text-[3.25em] md:text-[3.75em] font-bold text-white tracking-tight leading-none"
                      style={{ fontFamily: BRAND_NUMBERS_STACK, fontVariantNumeric: "tabular-nums" }}
                    >
                      {fmtDollar(result!.total)}
                    </p>
                    <InlineText
                      as="p"
                      value={props.resultsHeadline ?? ""}
                      onUpdate={field("resultsHeadline")}
                      multiline
                      className={`text-[0.9375em] text-white/70 leading-relaxed mt-3 max-w-[22em] ${alignCapped}`}
                      style={{ fontFamily: BODY }}
                    />
                    <div
                      className="inline-flex items-baseline gap-1.5 rounded-full bg-white/[0.08] ring-1 ring-inset ring-white/10 px-4 py-2 mt-5 text-[0.875em] text-white/80"
                      style={{ fontFamily: BODY }}
                    >
                      <span className="font-bold text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {fmtDollar(result!.perPractice)}
                      </span>
                      per practice, per year
                    </div>
                  </>
                ) : (
                  <>
                    <p
                      className="text-[3.25em] md:text-[3.75em] font-bold text-white/20 tracking-tight leading-none"
                      style={{ fontFamily: BRAND_NUMBERS_STACK, fontVariantNumeric: "tabular-nums" }}
                    >
                      $0
                    </p>
                    <InlineText
                      as="p"
                      value={props.resultsPlaceholder ?? ""}
                      onUpdate={field("resultsPlaceholder")}
                      multiline
                      className={`text-[0.9375em] text-white/55 leading-relaxed mt-3 max-w-[22em] ${alignCapped}`}
                      style={{ fontFamily: BODY }}
                    />
                  </>
                )}

                {(props.analysisCtaLabel ?? "").trim() !== "" && (
                  <div className="mt-7">
                    <a
                      href={(props.analysisCtaHref ?? "").trim() || "#"}
                      target={props.analysisCtaOpenInParent ? "_top" : undefined}
                      // In the builder the anchor target doesn't exist — don't jump the canvas.
                      onClick={onFieldChange ? (e) => e.preventDefault() : undefined}
                      className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[0.8125em] font-bold uppercase tracking-[0.12em] transition-all hover:brightness-105 hover:-translate-y-px active:scale-[0.99] shadow-[0_12px_24px_-10px_rgba(0,0,0,0.5)]"
                      style={{ backgroundColor: accentColor, color: analysisBtnText, fontFamily: BODY }}
                    >
                      {props.analysisCtaLabel}
                      <ChevronRight className="w-[1em] h-[1em] transition-transform group-hover:translate-x-0.5" />
                    </a>
                  </div>
                )}
              </div>

              {(props.resultsFootnote || onFieldChange) && (
                <div className="pt-2">
                  <div className="border-t border-white/15 mb-4" />
                  <InlineText
                    as="p"
                    value={props.resultsFootnote ?? ""}
                    onUpdate={field("resultsFootnote")}
                    multiline
                    className={`text-[0.8125em] text-white/55 leading-relaxed max-w-[26em] ${alignCapped}`}
                    style={{ fontFamily: BODY }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
