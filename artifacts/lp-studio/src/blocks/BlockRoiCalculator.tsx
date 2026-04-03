import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import type { RoiCalculatorBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import { cn } from "@/lib/utils";

interface Props {
  props: RoiCalculatorBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtDec = (n: number, d = 1) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtDollar = (n: number) => `$${fmt(n)}`;

// ─── Sub-components ───────────────────────────────────────────────────────────

const InputField = ({
  label,
  value,
  onChange,
  prefix,
  suffix,
  ...rest
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  [k: string]: unknown;
}) => (
  <div>
    <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1.5 block">
      {label}
    </label>
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-border bg-background py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          prefix ? "pl-7 pr-3" : suffix ? "pl-3 pr-7" : "px-3"
        }`}
        {...rest}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

const ResultRow = ({
  label,
  value,
  highlight,
  accentColor,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  accentColor: string;
}) => (
  <div className="py-1.5">
    <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-0.5">{label}</p>
    <p
      className="text-xl font-bold tracking-tight"
      style={highlight ? { color: accentColor } : { color: "#fff" }}
    >
      {value}
    </p>
  </div>
);

// ─── Scenario config ──────────────────────────────────────────────────────────

type Scenario = "low" | "medium" | "high";
const scenarioApptsSaved: Record<Scenario, number> = { low: 1, medium: 1.5, high: 2 };

// ─── Background styles ────────────────────────────────────────────────────────

const BG_STYLES: Record<string, string> = {
  white: "bg-white",
  dark: "bg-[#003A30] text-white",
  "light-gray": "bg-slate-50",
  muted: "bg-[hsl(42,18%,96%)]",
  "dandy-green": "bg-[#003A30] text-white",
  black: "bg-black text-white",
};

// ─── Main block ───────────────────────────────────────────────────────────────

export function BlockRoiCalculator({ props, brand, onCtaClick }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const accentColor = props.accentColor ?? brand.accentColor ?? "#C7E738";

  // ── Inputs ──
  const [practices, setPractices] = useState(1);

  // Fixed Resto inputs
  const [restoCases, setRestoCases] = useState(250);
  const [avgCaseValue, setAvgCaseValue] = useState(1500);
  const [currentRemakeRate, setCurrentRemakeRate] = useState(5);
  const [improvedRemakeRate, setImprovedRemakeRate] = useState(2);
  const [chairTimePerAppt, setChairTimePerAppt] = useState(1);
  const [labCostPerCase, setLabCostPerCase] = useState(50);
  const [restoProdPerHour, setRestoProdPerHour] = useState(500);

  // Denture inputs
  const [scenario, setScenario] = useState<Scenario>("medium");
  const [dentureCases, setDentureCases] = useState(150);
  const [prodPerHour, setProdPerHour] = useState(500);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [avgMinPerAppt, setAvgMinPerAppt] = useState(30);
  const [workingDays, setWorkingDays] = useState(20);
  const [pctReinvested, setPctReinvested] = useState(75);
  const [reinvestProdPerHr, setReinvestProdPerHr] = useState(750);

  const apptsSaved = scenarioApptsSaved[scenario];

  // ── Denture calculations ──
  const denture = useMemo(() => {
    const apptsFreed = dentureCases * apptsSaved;
    const chairHrsFreed = (apptsFreed * avgMinPerAppt) / 60;
    const incProdMonth = chairHrsFreed * prodPerHour;
    const incProdYear = incProdMonth * 12;
    return { apptsFreed, chairHrsFreed, incProdMonth, incProdYear };
  }, [dentureCases, apptsSaved, avgMinPerAppt, prodPerHour]);

  // ── Resto remake calculations ──
  const resto = useMemo(() => {
    const currentRemakes = restoCases * (currentRemakeRate / 100);
    const improvedRemakes = restoCases * (improvedRemakeRate / 100);
    const remakesAvoided = currentRemakes - improvedRemakes;
    const recoveredProdYear = remakesAvoided * avgCaseValue * 12;
    const chairTimeSavedMonth = remakesAvoided * chairTimePerAppt;
    const labCostsAvoidedYear = remakesAvoided * labCostPerCase * 12;
    const opptyProdYear = chairTimeSavedMonth * restoProdPerHour * 12;
    const totalUpsideYear = recoveredProdYear + labCostsAvoidedYear + opptyProdYear;
    return { remakesAvoided, recoveredProdYear, labCostsAvoidedYear, opptyProdYear, totalUpsideYear };
  }, [restoCases, currentRemakeRate, improvedRemakeRate, avgCaseValue, chairTimePerAppt, labCostPerCase, restoProdPerHour]);

  const totalAnnualUpside = (denture.incProdYear + resto.totalUpsideYear) * practices;

  const ctaUrl = (() => {
    if (props.ctaAction === "chilipiper" && props.chilipiperUrl) return `chilipiper:${props.chilipiperUrl}`;
    return props.ctaUrl ?? "#";
  })();

  const bgStyle = props.backgroundStyle === "gradient" ? getBgStyle("gradient") : undefined;

  return (
    <section
      className={cn(
        "w-full",
        BG_STYLES[props.backgroundStyle ?? "white"] ?? BG_STYLES["white"],
        sectionPy,
      )}
      style={bgStyle}
    >
      <div className="max-w-[1100px] mx-auto px-6 md:px-10">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {props.headline}
          </h2>
          {props.subheadline && (
            <p className="text-base text-muted-foreground max-w-lg mx-auto">
              {props.subheadline}
            </p>
          )}
        </div>

        {/* Practices multiplier */}
        <div className="mb-10 flex items-center justify-center gap-4">
          <label className="text-sm font-medium text-foreground">Number of practices:</label>
          <input
            type="number"
            min={1}
            max={2000}
            value={practices}
            onChange={(e) => setPractices(Math.max(1, Math.min(2000, parseInt(e.target.value) || 1)))}
            className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* ── LEFT: Two calculator sections ── */}
          <div className="lg:col-span-3 space-y-8">

            {/* SECTION 1: Fixed Restoration Remake Impact */}
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Fixed Restoration Remake Impact</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Production recovered and costs avoided by reducing remakes.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <InputField
                  label="Cases per Month:"
                  value={restoCases}
                  onChange={(v) => setRestoCases(Math.max(1, parseInt(v) || 1))}
                  min={1}
                  max={9999}
                />
                <InputField
                  label="Average Case Value ($):"
                  value={avgCaseValue}
                  prefix="$"
                  onChange={(v) => setAvgCaseValue(parseInt(v) || 0)}
                  min={100}
                  max={10000}
                />
                <InputField
                  label="Current Remake Rate (%):"
                  value={currentRemakeRate}
                  suffix="%"
                  onChange={(v) => setCurrentRemakeRate(parseFloat(v) || 0)}
                  min={0.5}
                  max={20}
                  step={0.5}
                />
                <InputField
                  label="Improved Remake Rate (%):"
                  value={improvedRemakeRate}
                  suffix="%"
                  onChange={(v) => setImprovedRemakeRate(parseFloat(v) || 0)}
                  min={0}
                  max={20}
                  step={0.5}
                />
                <InputField
                  label="Avg Chair Time per Case (Hours):"
                  value={chairTimePerAppt}
                  onChange={(v) => setChairTimePerAppt(parseFloat(v) || 0)}
                  min={0}
                  step={0.5}
                />
                <InputField
                  label="Avg Lab Hard Cost per Case ($):"
                  value={labCostPerCase}
                  prefix="$"
                  onChange={(v) => setLabCostPerCase(parseInt(v) || 0)}
                  min={0}
                />
                <InputField
                  label="Avg Production per Hour ($):"
                  value={restoProdPerHour}
                  prefix="$"
                  onChange={(v) => setRestoProdPerHour(parseInt(v) || 0)}
                  min={50}
                  max={5000}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* SECTION 2: Denture Workflow Impact */}
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Denture Workflow Impact</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Chair time freed by reducing intermediate appointments.
                </p>
              </div>

              {/* Scenario toggle */}
              <div>
                <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2.5 block">
                  Benchmark Scenario:
                </label>
                <div className="grid grid-cols-3 gap-0 rounded-full border border-border overflow-hidden">
                  {(["low", "medium", "high"] as Scenario[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScenario(s)}
                      className={`py-2.5 text-sm font-semibold capitalize transition-all ${
                        scenario === s
                          ? "text-[#003A30]"
                          : "bg-background text-muted-foreground hover:text-foreground"
                      }`}
                      style={scenario === s ? { backgroundColor: accentColor } : undefined}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {apptsSaved} appointments saved per case
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <InputField
                  label="Denture Cases / Month:"
                  value={dentureCases}
                  onChange={(v) => setDentureCases(Math.max(0, parseInt(v) || 0))}
                  min={0}
                  max={9999}
                />
                <InputField
                  label="Avg Production per Hour ($):"
                  value={prodPerHour}
                  prefix="$"
                  onChange={(v) => setProdPerHour(parseInt(v) || 0)}
                  min={50}
                  max={5000}
                />
              </div>

              {/* Advanced settings */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
                Advanced settings
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                  <InputField
                    label="Avg Min / Appointment:"
                    value={avgMinPerAppt}
                    onChange={(v) => setAvgMinPerAppt(parseInt(v) || 30)}
                    min={5}
                    max={120}
                  />
                  <InputField
                    label="Working Days / Month:"
                    value={workingDays}
                    onChange={(v) => setWorkingDays(parseInt(v) || 20)}
                    min={1}
                    max={31}
                  />
                  <InputField
                    label="% Time Reinvested:"
                    value={pctReinvested}
                    suffix="%"
                    onChange={(v) => setPctReinvested(parseInt(v) || 0)}
                    min={0}
                    max={100}
                  />
                  <InputField
                    label="Prod/Hr Reinvested Time ($):"
                    value={reinvestProdPerHr}
                    prefix="$"
                    onChange={(v) => setReinvestProdPerHr(parseInt(v) || 0)}
                    min={50}
                    max={5000}
                  />
                </div>
              )}
            </div>

            {/* CTA button on left panel */}
            {props.ctaEnabled && props.ctaText && (
              <button
                type="button"
                onClick={onCtaClick ? onCtaClick : () => {
                  if (ctaUrl && ctaUrl !== "#") window.location.href = ctaUrl;
                }}
                className="w-full rounded-full py-3.5 text-sm font-bold uppercase tracking-widest transition-all hover:brightness-105 active:scale-[0.98]"
                style={{ backgroundColor: accentColor, color: "#003A30" }}
              >
                {props.ctaText}
              </button>
            )}
          </div>

          {/* ── RIGHT: Results panel ── */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl p-6 md:p-8 space-y-1 sticky top-24" style={{ backgroundColor: "#003A30" }}>
              <h3 className="text-2xl font-medium text-white tracking-tight mb-6">
                {props.resultsPanelLabel ?? "Your results"}
              </h3>

              {/* Denture results */}
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest pt-2">
                Denture Workflow
              </p>
              <ResultRow
                label="Appointments Freed / Month"
                value={fmt(denture.apptsFreed)}
                accentColor={accentColor}
              />
              <ResultRow
                label="Chair Hours Freed / Month"
                value={fmtDec(denture.chairHrsFreed)}
                accentColor={accentColor}
              />
              <ResultRow
                label="Incremental Production / Month ($)"
                value={fmtDollar(denture.incProdMonth)}
                highlight
                accentColor={accentColor}
              />
              <ResultRow
                label="Incremental Production / Year ($)"
                value={fmtDollar(denture.incProdYear)}
                highlight
                accentColor={accentColor}
              />

              <div className="border-t border-white/10 my-3" />

              {/* Resto results */}
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest pt-2">
                Remake Impact
              </p>
              <ResultRow
                label="Remakes Avoided / Month"
                value={fmtDec(resto.remakesAvoided)}
                accentColor={accentColor}
              />
              <ResultRow
                label="Recovered Production / Year ($)"
                value={fmtDollar(resto.recoveredProdYear)}
                accentColor={accentColor}
              />
              <ResultRow
                label="Lab Costs Avoided / Year ($)"
                value={fmtDollar(resto.labCostsAvoidedYear)}
                accentColor={accentColor}
              />
              <ResultRow
                label="Opportunity Production / Year ($)"
                value={fmtDollar(resto.opptyProdYear)}
                highlight
                accentColor={accentColor}
              />

              <div className="border-t border-white/10 my-3" />

              {/* Total */}
              <div className="pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: accentColor }}>
                  Total Financial Upside / Year ($)
                  {practices > 1 ? ` (${practices} practices)` : ""}
                </p>
                <p className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                  {fmtDollar(totalAnnualUpside)}
                </p>
                {practices > 1 && (
                  <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-white/50">
                    <span>Denture: {fmtDollar(denture.incProdYear * practices)}</span>
                    <span>•</span>
                    <span>Remakes: {fmtDollar(resto.totalUpsideYear * practices)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {props.disclaimer && (
          <p className="mt-8 text-[11px] text-muted-foreground/50 leading-relaxed text-center">
            {props.disclaimer}
          </p>
        )}
      </div>
    </section>
  );
}
