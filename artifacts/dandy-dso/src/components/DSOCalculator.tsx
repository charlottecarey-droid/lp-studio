import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingDown, DollarSign, Clock, ChevronDown } from "lucide-react";
import DemoModal from "./DemoModal";

type Mode = "low" | "medium" | "high" | "custom";

const benchmarks: Record<Exclude<Mode, "custom">, { remakeRate: number; chairTime: number; revenuePerAppt: number }> = {
  low: { remakeRate: 2, chairTime: 20, revenuePerAppt: 250 },
  medium: { remakeRate: 5, chairTime: 30, revenuePerAppt: 350 },
  high: { remakeRate: 8, chairTime: 45, revenuePerAppt: 500 },
};

const DANDY_REMAKE_RATE = 2; // Dandy's 96% first-time right = ~2% remakes

type RestorationCategory = {
  id: string;
  label: string;
  enabled: boolean;
  avgPerPractice: number;
};

const defaultCategories: RestorationCategory[] = [
  { id: "crowns", label: "Crowns & Bridges", enabled: true, avgPerPractice: 180 },
  { id: "implants", label: "Implant Abutments", enabled: true, avgPerPractice: 40 },
  { id: "veneers", label: "Veneers", enabled: false, avgPerPractice: 20 },
  { id: "dentures", label: "Dentures & Partials", enabled: false, avgPerPractice: 15 },
  { id: "removables", label: "Removables & Appliances", enabled: false, avgPerPractice: 10 },
];

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtDollar = (n: number) => `$${fmt(n)}`;

const DSOCalculator = () => {
  const [demoOpen, setDemoOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("medium");
  const [practices, setPractices] = useState(10);
  const [categories, setCategories] = useState<RestorationCategory[]>(defaultCategories);
  const [remakeRate, setRemakeRate] = useState(5);
  const [chairTime, setChairTime] = useState(30);
  const [revenuePerAppt, setRevenuePerAppt] = useState(350);
  const [operatories, setOperatories] = useState(8);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // When mode changes, update benchmark values
  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    if (newMode !== "custom") {
      const b = benchmarks[newMode];
      setRemakeRate(b.remakeRate);
      setChairTime(b.chairTime);
      setRevenuePerAppt(b.revenuePerAppt);
    }
  };

  const toggleCategory = (id: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const updateCategoryVolume = (id: string, vol: number) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, avgPerPractice: vol } : c))
    );
  };

  const results = useMemo(() => {
    const totalRestPerPractice = categories
      .filter((c) => c.enabled)
      .reduce((sum, c) => sum + c.avgPerPractice, 0);

    const totalMonthlyCases = practices * totalRestPerPractice;
    const monthlyRemakes = totalMonthlyCases * (remakeRate / 100);
    const monthlyChairTimeLost = (monthlyRemakes * chairTime) / 60;
    const monthlyRevenueLost = monthlyRemakes * revenuePerAppt;
    const annualRevenueAtRisk = monthlyRevenueLost * 12;
    const totalOps = practices * operatories;
    const annualPerPractice = annualRevenueAtRisk / (practices || 1);
    const annualPerOperatory = annualRevenueAtRisk / (totalOps || 1);
    const monthlyChairPerPractice = monthlyChairTimeLost / (practices || 1);

    // Dandy savings — 60% fewer remakes than user's current rate
    const dandyRemakeRate = remakeRate * 0.4; // 60% reduction
    const dandyMonthlyRemakes = totalMonthlyCases * (dandyRemakeRate / 100);
    const dandyMonthlyRevLost = dandyMonthlyRemakes * revenuePerAppt;
    const dandyAnnualRisk = dandyMonthlyRevLost * 12;
    const annualSavings = annualRevenueAtRisk - dandyAnnualRisk;
    const remakeReduction = monthlyRemakes - dandyMonthlyRemakes;
    const chairTimeRecovered = ((monthlyRemakes - dandyMonthlyRemakes) * chairTime) / 60;

    return {
      totalMonthlyCases,
      monthlyRemakes,
      monthlyChairTimeLost,
      monthlyRevenueLost,
      annualRevenueAtRisk,
      totalOps,
      annualPerPractice,
      annualPerOperatory,
      monthlyChairPerPractice,
      annualSavings,
      remakeReduction,
      chairTimeRecovered,
      totalRestPerPractice,
    };
  }, [practices, categories, remakeRate, chairTime, revenuePerAppt, operatories]);

  return (
    <section className="section-padding section-alt">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="text-center mb-14">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-medium text-primary mb-4 tracking-wide"
          >
            ROI Calculator
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-display text-foreground"
          >
            How much are remakes costing you?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto"
          >
            Enter your network size and see the hidden cost of remakes — and how much Dandy could save you.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="grid lg:grid-cols-5 gap-8"
        >
          {/* Left: Inputs (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Mode selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                Scenario
              </label>
              <div className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-card p-1">
                {(["low", "medium", "high", "custom"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleModeChange(m)}
                    className={`py-2 rounded-md text-xs font-medium capitalize transition-colors ${
                      mode === m
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Practices */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                Number of practices
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={practices}
                onChange={(e) => setPractices(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Restoration categories */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
                Restoration Types
              </label>
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      cat.enabled ? "border-primary/30 bg-card" : "border-border bg-card/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cat.enabled}
                          onChange={() => toggleCategory(cat.id)}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50 accent-[hsl(168,55%,42%)]"
                        />
                        <span className={`text-sm font-medium ${cat.enabled ? "text-foreground" : "text-muted-foreground"}`}>
                          {cat.label}
                        </span>
                      </label>
                      {cat.enabled && (
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={cat.avgPerPractice}
                          onChange={(e) =>
                            updateCategoryVolume(cat.id, Math.max(0, Math.min(999, parseInt(e.target.value) || 0)))
                          }
                          className="w-16 rounded border border-border bg-background px-2 py-1 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                      )}
                    </div>
                    {cat.enabled && (
                      <p className="text-[10px] text-muted-foreground mt-1 ml-6.5">per practice / month</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Advanced toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              Advanced settings
            </button>

            {showAdvanced && (
              <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Remake rate (%)</label>
                  <input
                    type="number"
                    min={0.5}
                    max={20}
                    step={0.5}
                    value={remakeRate}
                    onChange={(e) => { setRemakeRate(parseFloat(e.target.value) || 0); setMode("custom"); }}
                    className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Chair time lost per remake (min)</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={chairTime}
                    onChange={(e) => { setChairTime(parseInt(e.target.value) || 0); setMode("custom"); }}
                    className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Revenue per appointment ($)</label>
                  <input
                    type="number"
                    min={50}
                    max={2000}
                    value={revenuePerAppt}
                    onChange={(e) => { setRevenuePerAppt(parseInt(e.target.value) || 0); setMode("custom"); }}
                    className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Operatories (chairs) per practice</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={operatories}
                    onChange={(e) => setOperatories(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                    className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right: Results (3 cols) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Hero stat — annual cost */}
            <div className="relative rounded-xl overflow-hidden border border-destructive/15 p-8 text-center">
              <div className="absolute inset-0 bg-gradient-to-b from-destructive/[0.07] via-card to-card" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-destructive/[0.05] rounded-full blur-[80px]" />
              <div className="relative z-10">
                <DollarSign className="w-5 h-5 text-destructive mx-auto mb-2 opacity-70" />
                <p className="text-5xl md:text-6xl font-bold text-foreground tracking-tight">{fmtDollar(results.annualRevenueAtRisk)}</p>
                <p className="text-sm text-muted-foreground mt-2">Annual revenue at risk across {practices} practices</p>
              </div>
            </div>

            {/* Breakdown row */}
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-lg font-bold text-foreground">{fmt(results.monthlyRemakes)}</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Remakes / mo</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-lg font-bold text-foreground">{fmt(results.monthlyChairTimeLost)}<span className="text-xs ml-0.5">hrs</span></p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Chair time lost / mo</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-lg font-bold text-foreground">{fmtDollar(results.annualPerPractice)}</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Per practice / yr</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-lg font-bold text-foreground">{fmtDollar(results.annualPerOperatory)}</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Per operatory / yr</p>
              </div>
            </div>

            {/* Dandy savings — side by side hero */}
            <div className="relative rounded-xl overflow-hidden border border-primary/20 p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-card to-card" />
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-primary/[0.06] rounded-full blur-[60px]" />
              <div className="relative z-10">
                <p className="text-xs font-medium text-primary tracking-wide mb-6">With Dandy (60% fewer remakes)</p>
                <div className="grid grid-cols-3 gap-6 items-end">
                  <div>
                    <TrendingDown className="w-5 h-5 text-primary mb-2 opacity-70" />
                    <p className="text-4xl font-bold text-primary tracking-tight">{fmtDollar(results.annualSavings)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Annual savings</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{fmt(results.remakeReduction)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Fewer remakes / mo</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{results.chairTimeRecovered.toFixed(1)} hrs</p>
                    <p className="text-xs text-muted-foreground mt-1">Chair time recovered / mo</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA bar */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5">
              <div>
                <p className="text-sm font-semibold text-foreground">Ready to see these savings?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Get a custom ROI analysis for your DSO.</p>
              </div>
              <button
                onClick={() => setDemoOpen(true)}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                Get Full Analysis
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
              These figures represent estimated operational waste based on industry benchmarks, not poor performance. Actual savings may vary based on case mix, lab quality, and clinical workflow.
            </p>
          </div>
        </motion.div>
      </div>
      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </section>
  );
};

export default DSOCalculator;
