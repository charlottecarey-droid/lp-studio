import { useState, useMemo } from "react";
import type { RoiCalculatorBlockProps, RoiOutputField } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";
import { cn } from "@/lib/utils";
import { evalFormula } from "@/lib/roi-formula";

interface Props {
  props: RoiCalculatorBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
}

function formatValue(value: number, format: RoiOutputField["format"], decimals: number): string {
  if (format === "currency") {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`;
  }
  if (format === "percent") {
    return `${value.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}%`;
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

const BG_STYLES: Record<string, string> = {
  white: "bg-white",
  dark: "bg-[#003A30] text-white",
  "light-gray": "bg-slate-50",
  muted: "bg-[hsl(42,18%,96%)]",
  "dandy-green": "bg-[#003A30] text-white",
  black: "bg-black text-white",
};

export function BlockRoiCalculator({ props, brand, onCtaClick }: Props) {
  const sectionPy = SECTION_PY[brand.sectionPadding];
  const accentColor = props.accentColor ?? brand.accentColor ?? "#C7E738";

  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const values = useMemo(() => {
    const base = Object.fromEntries(props.inputFields.map(f => [f.id, f.defaultValue]));
    return { ...base, ...overrides };
  }, [props.inputFields, overrides]);

  const outputs = useMemo(() => {
    return props.outputFields.map(out => ({
      ...out,
      value: evalFormula(out.formula, values),
    }));
  }, [props.outputFields, values]);

  const handleChange = (id: string, v: number) => {
    setOverrides(prev => ({ ...prev, [id]: v }));
  };

  const isDark = isDarkBg(props.backgroundStyle);

  const ctaUrl = (() => {
    if (props.ctaAction === "chilipiper" && props.chilipiperUrl) return `chilipiper:${props.chilipiperUrl}`;
    return props.ctaUrl ?? "#";
  })();

  const bgStyle = props.backgroundStyle === "gradient" ? getBgStyle("gradient") : undefined;

  return (
    <section className={cn("w-full", BG_STYLES[props.backgroundStyle ?? "white"] ?? BG_STYLES["white"], sectionPy)} style={bgStyle}>
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-12">
          <h2 className={cn("text-3xl md:text-4xl font-bold mb-4", isDark ? "text-white" : "text-foreground")}>
            {props.headline}
          </h2>
          {props.subheadline && (
            <p className={cn("text-base max-w-2xl mx-auto", isDark ? "text-white/70" : "text-muted-foreground")}>
              {props.subheadline}
            </p>
          )}
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 space-y-6">
            <div className={cn("rounded-2xl border p-6 md:p-8 space-y-5", isDark ? "border-white/10 bg-white/5" : "border-border bg-white shadow-sm")}>
              {props.inputFields.map(field => {
                const val = values[field.id] ?? field.defaultValue;
                if (field.inputType === "slider") {
                  const pct = ((val - field.min) / Math.max(field.max - field.min, 0.001)) * 100;
                  return (
                    <div key={field.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
                          {field.label}
                        </label>
                        <span className="text-sm font-semibold text-foreground">
                          {field.prefix}{val.toLocaleString("en-US", { maximumFractionDigits: 1 })}{field.suffix}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={val}
                        onChange={e => handleChange(field.id, parseFloat(e.target.value))}
                        style={{ background: `linear-gradient(to right, var(--color-primary, #003A30) ${pct}%, #e2e8f0 ${pct}%)` }}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>{field.prefix}{field.min}{field.suffix}</span>
                        <span>{field.prefix}{field.max}{field.suffix}</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={field.id}>
                    <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block text-foreground/70">
                      {field.label}
                    </label>
                    <div className="relative">
                      {field.prefix && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">{field.prefix}</span>
                      )}
                      <input
                        type="number"
                        value={val}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) handleChange(field.id, Math.min(field.max, Math.max(field.min, v)));
                        }}
                        className={cn(
                          "w-full rounded-lg border border-border bg-background py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30",
                          field.prefix ? "pl-7 pr-3" : field.suffix ? "pl-3 pr-7" : "px-3",
                        )}
                      />
                      {field.suffix && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">{field.suffix}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 sticky top-24">
            <div className="rounded-2xl p-6 md:p-8 space-y-2" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#003A30" }}>
              <h3 className="text-xl font-semibold text-white mb-5">
                {props.resultsPanelLabel ?? "Your Results"}
              </h3>

              {outputs.map(out => (
                <div
                  key={out.id}
                  className={cn(
                    "flex items-center justify-between py-2",
                    out.highlight ? "border-t border-white/20 mt-2 pt-4" : "",
                  )}
                >
                  <span className={cn("text-sm", out.highlight ? "text-white font-semibold" : "text-white/60")}>
                    {out.label}
                  </span>
                  <span
                    className={cn("font-bold tabular-nums", out.highlight ? "text-2xl" : "text-base text-white")}
                    style={out.highlight ? { color: accentColor } : undefined}
                  >
                    {formatValue(out.value, out.format, out.decimals)}
                  </span>
                </div>
              ))}

              {props.ctaEnabled && props.ctaText && (
                <div className="pt-4">
                  <button
                    onClick={onCtaClick ? onCtaClick : () => {
                      if (ctaUrl && ctaUrl !== "#") window.location.href = ctaUrl;
                    }}
                    className="w-full rounded-full py-3.5 text-sm font-bold uppercase tracking-widest transition-all hover:brightness-105 active:scale-[0.98]"
                    style={{ backgroundColor: accentColor, color: "#003A30" }}
                  >
                    {props.ctaText}
                  </button>
                </div>
              )}

              {props.disclaimer && (
                <p className="text-[10px] text-white/30 pt-2 leading-relaxed">{props.disclaimer}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
