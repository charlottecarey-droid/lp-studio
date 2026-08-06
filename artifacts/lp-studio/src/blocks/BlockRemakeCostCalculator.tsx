import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { RemakeCostCalculatorBlockProps } from "@/lib/block-types";
import { resolveSectionSurface } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import { cn } from "@/lib/utils";
import { InlineText } from "@/components/InlineText";
import { BRAND_BODY_FONT, BRAND_DISPLAY_STACK } from "../lib/brand-fonts";

/**
 * Two-field remake cost calculator (practices + avg case value), benchmark
 * scenario chips, everything else collapsed behind "refine your estimate".
 *
 * Built for the customer-website embed: the host page owns conversion, so
 * there is deliberately NO CTA (also keeps it out of page-CTA following),
 * no vh sizing, no sticky positioning (useless inside an embed iframe —
 * the iframe never scrolls internally), and no scroll reveals (fail-open
 * contract satisfied by having no hidden initial states at all).
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
      className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block"
      style={{ fontFamily: BODY }}
    >
      {label}
    </label>
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none" style={{ fontFamily: BODY }}>
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
          "w-full rounded-lg border border-border bg-[hsl(42,25%,98%)] py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/25",
          prefix ? "pl-7 pr-3" : suffix ? "pl-3 pr-8" : "px-3",
        )}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none" style={{ fontFamily: BODY }}>
          {suffix}
        </span>
      )}
    </div>
  </div>
);

export function BlockRemakeCostCalculator({ props, brand, onFieldChange }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const accentColor = props.accentColor ?? brand.accentColor ?? "var(--brand-accent, #C7E738)";
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
    <section className={cn("w-full", BG_STYLES[props.backgroundStyle ?? "muted"] ?? BG_STYLES["muted"], sectionPy)}>
      <div className="max-w-[1100px] mx-auto px-6 md:px-10">
        {(props.headline || onFieldChange) && (
          <div className="text-center mb-10">
            <InlineText
              as="h2"
              value={props.headline ?? ""}
              onUpdate={field("headline")}
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(1.875rem,3.5vw,2.75rem)",
                fontWeight: 600,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                color: headlineColor,
                marginBottom: "0.75rem",
              }}
            />
            {(props.subheadline || onFieldChange) && (
              <InlineText
                as="p"
                value={props.subheadline ?? ""}
                onUpdate={field("subheadline")}
                multiline
                style={{ fontSize: "1.0625rem", lineHeight: 1.7, color: subColor, maxWidth: 560, margin: "0 auto", fontFamily: BODY }}
              />
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6 items-stretch">
          {/* ── LEFT: input card ── */}
          <div className="lg:col-span-3 bg-white border border-border rounded-2xl p-6 md:p-8 flex flex-col gap-6">
            <div>
              <InlineText
                as="p"
                value={props.scenarioLabel ?? ""}
                onUpdate={field("scenarioLabel")}
                className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2.5 block"
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
                        "text-left rounded-xl border px-3.5 py-3 transition-colors",
                        selected ? "border-[var(--brand-primary,#0B3B2B)]" : "border-border bg-[hsl(42,25%,98%)] hover:border-muted-foreground/40",
                      )}
                      style={selected ? { backgroundColor: `color-mix(in srgb, ${accentColor} 18%, white)` } : undefined}
                    >
                      <span className="block text-[13px] font-semibold text-foreground" style={{ fontFamily: BODY }}>{s.label}</span>
                      <span className="block text-[11px] leading-snug text-muted-foreground mt-0.5" style={{ fontFamily: BODY }}>{s.description}</span>
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
                className="flex items-center gap-1 text-[13px] font-semibold transition-colors hover:opacity-80"
                style={{ color: PRIMARY, fontFamily: BODY }}
              >
                <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", refineOpen && "rotate-90")} />
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

            <button
              type="button"
              disabled={!canCalculate}
              onClick={() => setRevealed(true)}
              className="w-full rounded-full py-3.5 text-sm font-bold uppercase tracking-widest text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed mt-auto"
              style={{ backgroundColor: PRIMARY, fontFamily: BODY }}
            >
              {props.calculateLabel}
            </button>
          </div>

          {/* ── RIGHT: results panel ── */}
          <div className="lg:col-span-2">
            <div
              className="rounded-2xl p-6 md:p-8 h-full flex flex-col"
              style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${PRIMARY} 88%, #1a4a3a) 0%, ${PRIMARY} 55%, color-mix(in srgb, ${PRIMARY} 82%, black) 100%)` }}
            >
              <InlineText
                as="h3"
                value={props.resultsLabel ?? ""}
                onUpdate={field("resultsLabel")}
                className="text-2xl font-medium text-white tracking-tight"
                style={{ fontFamily: DISPLAY }}
              />
              {(props.resultsSublabel || onFieldChange) && (
                <InlineText
                  as="p"
                  value={props.resultsSublabel ?? ""}
                  onUpdate={field("resultsSublabel")}
                  className="text-[13px] text-white/55 mt-1"
                  style={{ fontFamily: BODY }}
                />
              )}

              {showResults ? (
                <div className="mt-6">
                  <p className="text-5xl md:text-[3.4rem] font-bold text-white tracking-tight leading-none" style={{ fontFamily: BODY }}>
                    {fmtDollar(result!.total)}
                  </p>
                  <InlineText
                    as="p"
                    value={props.resultsHeadline ?? ""}
                    onUpdate={field("resultsHeadline")}
                    multiline
                    className="text-sm text-white/70 leading-relaxed mt-3"
                    style={{ fontFamily: BODY }}
                  />
                  <p className="text-sm font-semibold text-white mt-3" style={{ fontFamily: BODY }}>
                    {fmtDollar(result!.perPractice)} per practice, per year
                  </p>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="text-5xl md:text-[3.4rem] font-bold text-white/25 tracking-tight leading-none" style={{ fontFamily: BODY }}>
                    $0
                  </p>
                  <InlineText
                    as="p"
                    value={props.resultsPlaceholder ?? ""}
                    onUpdate={field("resultsPlaceholder")}
                    multiline
                    className="text-sm text-white/55 leading-relaxed mt-3"
                    style={{ fontFamily: BODY }}
                  />
                </div>
              )}

              {(props.resultsFootnote || onFieldChange) && (
                <div className="mt-auto pt-6">
                  <div className="border-t border-white/15 mb-4" />
                  <InlineText
                    as="p"
                    value={props.resultsFootnote ?? ""}
                    onUpdate={field("resultsFootnote")}
                    multiline
                    className="text-[13px] text-white/60 leading-relaxed"
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
