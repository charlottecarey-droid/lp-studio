import { useState, useMemo, useRef, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Calculator, TrendingDown, DollarSign, Clock, ChevronDown, TrendingUp, ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import dashboardMockup from "@/assets/dandy-insights-dashboard.png";
import DemoModal from "./DemoModal";

const DSOUnifiedCalculator = () => {
  const [open, setOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Left card slides from center to left
  const leftX = useTransform(scrollYProgress, [0.15, 0.4], ["100%", "0%"]);
  const leftOpacity = useTransform(scrollYProgress, [0.15, 0.35], [0, 1]);
  const leftScale = useTransform(scrollYProgress, [0.15, 0.4], [0.8, 1]);

  // Right card slides from center to right
  const rightX = useTransform(scrollYProgress, [0.15, 0.4], ["-100%", "0%"]);
  const rightOpacity = useTransform(scrollYProgress, [0.15, 0.35], [0, 1]);
  const rightScale = useTransform(scrollYProgress, [0.15, 0.4], [0.8, 1]);

  // Middle card scales up slightly then settles
  const centerScale = useTransform(scrollYProgress, [0.1, 0.25, 0.4], [0.9, 1.05, 1]);
  const centerOpacity = useTransform(scrollYProgress, [0.1, 0.2], [0, 1]);

  // CTA fades in after cards
  const ctaOpacity = useTransform(scrollYProgress, [0.35, 0.45], [0, 1]);
  const ctaY = useTransform(scrollYProgress, [0.35, 0.45], [30, 0]);

  return (
    <section ref={sectionRef} id="calculator" className="relative" style={{ minHeight: "160vh" }}>
      <div className="sticky top-0 min-h-screen flex items-center justify-center overflow-hidden">
        <div className="max-w-[1100px] mx-auto px-6 md:px-10 w-full">
          <div className="text-center mb-10">
            <motion.p
              style={{ opacity: centerOpacity }}
              className="text-xs font-medium text-primary mb-4 tracking-wide"
            >
              See the Numbers
            </motion.p>
            <motion.h2
              style={{ opacity: centerOpacity }}
              className="text-display text-foreground"
            >
              Calculate the cost of inaction.
            </motion.h2>
            <motion.p
              style={{ opacity: centerOpacity }}
              className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto"
            >
              Enter Aspen's network size and see exactly how much remakes and inefficiencies are draining — and what Dandy recovers.
            </motion.p>
          </div>

          {/* Preview Card */}
          <div
            className="relative rounded-2xl border border-border overflow-hidden cursor-pointer group"
            onClick={() => setOpen(true)}
          >
            {/* Background image */}
            <div className="relative aspect-[16/7] overflow-hidden">
              <img
                src={dashboardMockup}
                alt="ROI Calculator preview"
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/90 to-card/50" />
            </div>

            {/* Content overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4 md:gap-8 w-full max-w-2xl mb-8">
                {/* Left stat — slides in from center */}
                <motion.div
                  style={{ x: leftX, opacity: leftOpacity, scale: leftScale }}
                  className="relative rounded-xl bg-card/60 backdrop-blur-sm border border-primary/15 p-4 md:p-6 text-center overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.08] to-transparent" />
                  <p className="relative text-3xl md:text-5xl font-bold text-primary tracking-tight">60%</p>
                  <p className="relative text-[10px] md:text-sm text-muted-foreground mt-1.5">Fewer remakes</p>
                </motion.div>

                {/* Center stat — appears first */}
                <motion.div
                  style={{ scale: centerScale, opacity: centerOpacity }}
                  className="relative rounded-xl bg-card/60 backdrop-blur-sm border border-border/60 p-4 md:p-6 text-center overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-foreground/[0.03] to-transparent" />
                  <p className="relative text-3xl md:text-5xl font-bold text-foreground tracking-tight">$1.2M+</p>
                  <p className="relative text-[10px] md:text-sm text-muted-foreground mt-1.5">Avg. annual upside</p>
                </motion.div>

                {/* Right stat — slides in from center */}
                <motion.div
                  style={{ x: rightX, opacity: rightOpacity, scale: rightScale }}
                  className="relative rounded-xl bg-card/60 backdrop-blur-sm border border-primary/15 p-4 md:p-6 text-center overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.08] to-transparent" />
                  <p className="relative text-3xl md:text-5xl font-bold text-primary tracking-tight">200+</p>
                  <p className="relative text-[10px] md:text-sm text-muted-foreground mt-1.5">Hours recovered / yr</p>
                </motion.div>
              </div>

              <motion.div style={{ opacity: ctaOpacity, y: ctaY }} className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Interactive ROI Calculator</span>
                </div>
                <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                  Calculate Your Savings
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Calculator Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 gap-0 border-border">
          <DialogTitle className="sr-only">ROI Calculator</DialogTitle>
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-card">
            <div>
              <h3 className="text-lg font-bold text-foreground">ROI Calculator</h3>
              <p className="text-xs text-muted-foreground mt-0.5">See how Dandy impacts your bottom line.</p>
            </div>
          </div>
          <div className="p-6">
            <Tabs defaultValue="financial" className="w-full">
              <TabsList className="w-full max-w-lg mx-auto flex items-center justify-center gap-2 bg-transparent h-auto p-0 mb-8">
                <TabsTrigger
                  value="financial"
                  className="relative rounded-full px-6 py-3 text-base font-semibold transition-all data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none data-[state=inactive]:hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20"
                >
                  Financial Impact
                </TabsTrigger>
                <TabsTrigger
                  value="remake"
                  className="relative rounded-full px-6 py-3 text-base font-semibold transition-all data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-none data-[state=inactive]:hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20"
                >
                  Remake Cost
                </TabsTrigger>
              </TabsList>

              <TabsContent value="financial">
                <DSOKCYSCalculatorInner />
              </TabsContent>
              <TabsContent value="remake">
                <DSOCalculatorInner />
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default DSOUnifiedCalculator;

// ─── Shared helpers ─────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtDec = (n: number, d = 1) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtDollar = (n: number) => `$${fmt(n)}`;

// ─── Remake Cost Calculator (inner) ─────────────────────────────────────────

type Mode = "low" | "medium" | "high" | "custom";

const benchmarks: Record<Exclude<Mode, "custom">, { remakeRate: number; chairTime: number; revenuePerAppt: number }> = {
  low: { remakeRate: 2, chairTime: 20, revenuePerAppt: 250 },
  medium: { remakeRate: 5, chairTime: 30, revenuePerAppt: 350 },
  high: { remakeRate: 8, chairTime: 45, revenuePerAppt: 500 },
};

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

function DSOCalculatorInner() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("medium");
  const [practices, setPractices] = useState(10);
  const [categories, setCategories] = useState<RestorationCategory[]>(defaultCategories);
  const [remakeRate, setRemakeRate] = useState(5);
  const [chairTime, setChairTime] = useState(30);
  const [revenuePerAppt, setRevenuePerAppt] = useState(350);
  const [operatories, setOperatories] = useState(8);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (practices !== 10 && !recordedRef.current) {
      recordedRef.current = true;
      const timer = setTimeout(() => {
        supabase.from('calc_submissions').insert({ calculator_type: 'unified', practice_count: practices });
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [practices]);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
  };

  const updateCategoryVolume = (id: string, vol: number) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, avgPerPractice: vol } : c)));
  };

  const results = useMemo(() => {
    const totalRestPerPractice = categories.filter((c) => c.enabled).reduce((sum, c) => sum + c.avgPerPractice, 0);
    const totalMonthlyCases = practices * totalRestPerPractice;
    const monthlyRemakes = totalMonthlyCases * (remakeRate / 100);
    const monthlyChairTimeLost = (monthlyRemakes * chairTime) / 60;
    const monthlyRevenueLost = monthlyRemakes * revenuePerAppt;
    const annualRevenueAtRisk = monthlyRevenueLost * 12;
    const totalOps = practices * operatories;
    const annualPerPractice = annualRevenueAtRisk / (practices || 1);
    const annualPerOperatory = annualRevenueAtRisk / (totalOps || 1);
    const monthlyChairPerPractice = monthlyChairTimeLost / (practices || 1);
    const dandyRemakeRate = remakeRate * 0.4;
    const dandyMonthlyRemakes = totalMonthlyCases * (dandyRemakeRate / 100);
    const dandyMonthlyRevLost = dandyMonthlyRemakes * revenuePerAppt;
    const dandyAnnualRisk = dandyMonthlyRevLost * 12;
    const annualSavings = annualRevenueAtRisk - dandyAnnualRisk;
    const remakeReduction = monthlyRemakes - dandyMonthlyRemakes;
    const chairTimeRecovered = ((monthlyRemakes - dandyMonthlyRemakes) * chairTime) / 60;
    return {
      totalMonthlyCases, monthlyRemakes, monthlyChairTimeLost, monthlyRevenueLost,
      annualRevenueAtRisk, totalOps, annualPerPractice, annualPerOperatory,
      monthlyChairPerPractice, annualSavings, remakeReduction, chairTimeRecovered, totalRestPerPractice,
    };
  }, [practices, categories, remakeRate, chairTime, revenuePerAppt, operatories]);

  return (
    <div className="grid lg:grid-cols-5 gap-8">
      {/* Left: Inputs */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Scenario</label>
          <div className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-card p-1">
            {(["low", "medium", "high", "custom"] as Mode[]).map((m) => (
              <button key={m} onClick={() => handleModeChange(m)}
                className={`py-2 rounded-md text-xs font-medium capitalize transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Number of practices</label>
          <input type="number" min={1} max={1000} value={practices}
            onChange={(e) => setPractices(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">Restoration Types</label>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className={`rounded-lg border p-3 transition-colors ${cat.enabled ? "border-primary/30 bg-card" : "border-border bg-card/50"}`}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={cat.enabled} onChange={() => toggleCategory(cat.id)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50 accent-primary" />
                    <span className={`text-sm font-medium ${cat.enabled ? "text-foreground" : "text-muted-foreground"}`}>{cat.label}</span>
                  </label>
                  {cat.enabled && (
                    <input type="number" min={0} max={999} value={cat.avgPerPractice}
                      onChange={(e) => updateCategoryVolume(cat.id, Math.max(0, Math.min(999, parseInt(e.target.value) || 0)))}
                      className="w-16 rounded border border-border bg-background px-2 py-1 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/50" />
                  )}
                </div>
                {cat.enabled && <p className="text-[10px] text-muted-foreground mt-1 ml-6.5">per practice / month</p>}
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          Advanced settings
        </button>

        {showAdvanced && (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Remake rate (%)</label>
              <input type="number" min={0.5} max={20} step={0.5} value={remakeRate}
                onChange={(e) => { setRemakeRate(parseFloat(e.target.value) || 0); setMode("custom"); }}
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Chair time lost per remake (min)</label>
              <input type="number" min={5} max={120} value={chairTime}
                onChange={(e) => { setChairTime(parseInt(e.target.value) || 0); setMode("custom"); }}
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Revenue per appointment ($)</label>
              <input type="number" min={50} max={2000} value={revenuePerAppt}
                onChange={(e) => { setRevenuePerAppt(parseInt(e.target.value) || 0); setMode("custom"); }}
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Operatories per practice</label>
              <input type="number" min={1} max={30} value={operatories}
                onChange={(e) => setOperatories(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>
        )}
      </div>

      {/* Right: Results */}
      <div className="lg:col-span-3 space-y-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-xs font-medium text-destructive uppercase tracking-wider mb-5">Your Current Remake Cost</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-background p-4">
              <DollarSign className="w-4 h-4 text-destructive mb-2" />
              <p className="text-3xl font-bold text-foreground">{fmtDollar(results.annualRevenueAtRisk)}</p>
              <p className="text-xs text-muted-foreground mt-1">Annual revenue at risk</p>
            </div>
            <div className="rounded-lg bg-background p-4">
              <Clock className="w-4 h-4 text-destructive mb-2" />
              <p className="text-3xl font-bold text-foreground">{fmt(results.monthlyChairTimeLost)}<span className="text-lg">hrs</span></p>
              <p className="text-xs text-muted-foreground mt-1">Chair time lost / month</p>
            </div>
            <div className="rounded-lg bg-background p-4">
              <p className="text-xl font-bold text-foreground">{fmt(results.monthlyRemakes)}</p>
              <p className="text-xs text-muted-foreground mt-1">Remakes / month</p>
            </div>
            <div className="rounded-lg bg-background p-4">
              <p className="text-xl font-bold text-foreground">{fmtDollar(results.monthlyRevenueLost)}</p>
              <p className="text-xs text-muted-foreground mt-1">Revenue lost / month</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="text-center rounded-lg bg-background p-3">
              <p className="text-sm font-semibold text-foreground">{fmtDollar(results.annualPerPractice)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">per practice / yr</p>
            </div>
            <div className="text-center rounded-lg bg-background p-3">
              <p className="text-sm font-semibold text-foreground">{fmtDollar(results.annualPerOperatory)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">per operatory / yr</p>
            </div>
            <div className="text-center rounded-lg bg-background p-3">
              <p className="text-sm font-semibold text-foreground">{results.monthlyChairPerPractice.toFixed(1)} hrs</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">chair time lost / practice</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
          <p className="text-xs font-medium text-primary uppercase tracking-wider mb-5">With Dandy (60% fewer remakes)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1 rounded-lg bg-card border border-primary/20 p-5">
              <TrendingDown className="w-5 h-5 text-primary mb-2" />
              <p className="text-4xl font-bold text-primary tracking-tight">{fmtDollar(results.annualSavings)}</p>
              <p className="text-xs text-muted-foreground mt-1">Annual savings</p>
            </div>
            <div className="rounded-lg bg-card border border-border p-4">
              <p className="text-2xl font-bold text-primary">{fmt(results.remakeReduction)}</p>
              <p className="text-xs text-muted-foreground mt-1">Fewer remakes / mo</p>
            </div>
            <div className="rounded-lg bg-card border border-border p-4">
              <p className="text-2xl font-bold text-primary">{results.chairTimeRecovered.toFixed(1)} hrs</p>
              <p className="text-xs text-muted-foreground mt-1">Chair time recovered / mo</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-lg bg-card border border-border p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Ready to see these savings?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Get a custom ROI analysis for your DSO.</p>
            </div>
            <button onClick={() => setDemoOpen(true)}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap">
              Get Full Analysis
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
          These figures represent estimated operational waste based on industry benchmarks, not poor performance. Actual savings may vary.
        </p>
      </div>
      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  );
}

// ─── Financial Impact Calculator (inner) ─────────────────────────────────────

type Scenario = "conservative" | "expected" | "aggressive";

const scenarioApptsSaved: Record<Scenario, number> = {
  conservative: 1,
  expected: 1.5,
  aggressive: 2,
};

function DSOKCYSCalculatorInner() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [dentureCases, setDentureCases] = useState(150);
  const [scenario, setScenario] = useState<Scenario>("expected");
  const [avgMinPerAppt, setAvgMinPerAppt] = useState(30);
  const [workingDays, setWorkingDays] = useState(20);
  const [prodPerHour, setProdPerHour] = useState(500);
  const [pctReinvested, setPctReinvested] = useState(75);
  const [reinvestProdPerHr, setReinvestProdPerHr] = useState(750);
  const [restoCases, setRestoCases] = useState(250);
  const [avgCaseValue, setAvgCaseValue] = useState(1500);
  const [currentRemakeRate, setCurrentRemakeRate] = useState(5);
  const [improvedRemakeRate, setImprovedRemakeRate] = useState(2);
  const [chairTimePerAppt, setChairTimePerAppt] = useState(1);
  const [labCostPerCase, setLabCostPerCase] = useState(50);
  const [restoProdPerHour, setRestoProdPerHour] = useState(500);
  const [practices, setPractices] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const apptsSaved = scenarioApptsSaved[scenario];

  const dentureResults = useMemo(() => {
    const apptsFreed = dentureCases * apptsSaved;
    const chairMinFreed = apptsFreed * avgMinPerAppt;
    const chairHrsFreed = chairMinFreed / 60;
    const chairHrsPerDay = chairHrsFreed / workingDays;
    const incProdMonth = chairHrsFreed * prodPerHour;
    const incProdYear = incProdMonth * 12;
    const reinvestedHrs = chairHrsFreed * (pctReinvested / 100);
    const reinvestProdMonth = reinvestedHrs * reinvestProdPerHr;
    return { apptsFreed, chairMinFreed, chairHrsFreed, chairHrsPerDay, incProdMonth, incProdYear, reinvestedHrs, reinvestProdMonth };
  }, [dentureCases, apptsSaved, avgMinPerAppt, workingDays, prodPerHour, pctReinvested, reinvestProdPerHr]);

  const restoResults = useMemo(() => {
    const currentRemakes = restoCases * (currentRemakeRate / 100);
    const improvedRemakes = restoCases * (improvedRemakeRate / 100);
    const remakesAvoided = currentRemakes - improvedRemakes;
    const recoveredProdMonth = remakesAvoided * avgCaseValue;
    const recoveredProdYear = recoveredProdMonth * 12;
    const chairTimeSavedMonth = remakesAvoided * chairTimePerAppt;
    const chairTimeSavedYear = chairTimeSavedMonth * 12;
    const labCostsAvoidedMonth = remakesAvoided * labCostPerCase;
    const labCostsAvoidedYear = labCostsAvoidedMonth * 12;
    const opptyProdMonth = chairTimeSavedMonth * restoProdPerHour;
    const opptyProdYear = opptyProdMonth * 12;
    const totalFinancialUpsideYear = recoveredProdYear + labCostsAvoidedYear + opptyProdYear;
    return { currentRemakes, improvedRemakes, remakesAvoided, recoveredProdMonth, recoveredProdYear, chairTimeSavedMonth, chairTimeSavedYear, labCostsAvoidedMonth, labCostsAvoidedYear, opptyProdMonth, opptyProdYear, totalFinancialUpsideYear };
  }, [restoCases, currentRemakeRate, improvedRemakeRate, avgCaseValue, chairTimePerAppt, labCostPerCase, restoProdPerHour]);

  const totalAnnualUpside = (dentureResults.incProdYear + restoResults.totalFinancialUpsideYear) * practices;

  return (
    <div>
      <div className="mb-8 flex items-center justify-center gap-4">
        <label className="text-sm text-muted-foreground">Number of practices:</label>
        <input type="number" min={1} max={1000} value={practices}
          onChange={(e) => setPractices(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
          className="w-20 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Denture Impact */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-foreground">Denture Workflow Impact</h3>
            <p className="text-xs text-muted-foreground mt-1">Chair time freed by reducing intermediate appointments.</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Denture cases / month</label>
              <input type="number" min={1} max={9999} value={dentureCases}
                onChange={(e) => setDentureCases(Math.max(1, Math.min(9999, parseInt(e.target.value) || 1)))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Scenario</label>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-background p-1">
                {(["conservative", "expected", "aggressive"] as Scenario[]).map((s) => (
                  <button key={s} onClick={() => setScenario(s)}
                    className={`py-2 rounded-md text-xs font-medium capitalize transition-colors ${scenario === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{apptsSaved} appointments saved per case</p>
            </div>
          </div>
          <div className="border-t border-border pt-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-background p-3">
                <p className="text-2xl font-bold text-foreground">{fmt(dentureResults.apptsFreed)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Appointments freed / mo</p>
              </div>
              <div className="rounded-lg bg-background p-3">
                <p className="text-2xl font-bold text-foreground">{fmtDec(dentureResults.chairHrsFreed)} <span className="text-sm">hrs</span></p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Chair hours freed / mo</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-background p-3">
                <p className="text-2xl font-bold text-primary">{fmtDollar(dentureResults.incProdMonth)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Incremental production / mo</p>
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                <p className="text-2xl font-bold text-primary">{fmtDollar(dentureResults.incProdYear)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Incremental production / yr</p>
              </div>
            </div>
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              Advanced
            </button>
            {showAdvanced && (
              <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Avg min / appt</label>
                    <input type="number" min={5} max={120} value={avgMinPerAppt}
                      onChange={(e) => setAvgMinPerAppt(parseInt(e.target.value) || 30)}
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Working days / mo</label>
                    <input type="number" min={1} max={31} value={workingDays}
                      onChange={(e) => setWorkingDays(parseInt(e.target.value) || 20)}
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Production / hr ($)</label>
                    <input type="number" min={50} max={5000} value={prodPerHour}
                      onChange={(e) => setProdPerHour(parseInt(e.target.value) || 500)}
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">% time reinvested</label>
                    <input type="number" min={0} max={100} value={pctReinvested}
                      onChange={(e) => setPctReinvested(parseInt(e.target.value) || 75)}
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-background p-3">
                    <p className="text-lg font-bold text-foreground">{fmtDec(dentureResults.reinvestedHrs)} hrs</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Reinvested hours / mo</p>
                  </div>
                  <div className="rounded-lg bg-background p-3">
                    <p className="text-lg font-bold text-primary">{fmtDollar(dentureResults.reinvestProdMonth)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Reinvestment prod / mo</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Resto Remake Impact */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-foreground">Fixed Resto Remake Impact</h3>
            <p className="text-xs text-muted-foreground mt-1">Production recovered and costs avoided by reducing remakes.</p>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cases / month</label>
                <input type="number" min={1} max={9999} value={restoCases}
                  onChange={(e) => setRestoCases(Math.max(1, Math.min(9999, parseInt(e.target.value) || 1)))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Avg case value ($)</label>
                <input type="number" min={100} max={10000} value={avgCaseValue}
                  onChange={(e) => setAvgCaseValue(parseInt(e.target.value) || 1500)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Current remake rate (%)</label>
                <input type="number" min={0.5} max={20} step={0.5} value={currentRemakeRate}
                  onChange={(e) => setCurrentRemakeRate(parseFloat(e.target.value) || 5)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Improved remake rate (%)</label>
                <input type="number" min={0} max={20} step={0.5} value={improvedRemakeRate}
                  onChange={(e) => setImprovedRemakeRate(parseFloat(e.target.value) || 2)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-5 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-background p-3 text-center">
                <p className="text-xl font-bold text-foreground">{fmtDec(restoResults.currentRemakes)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Current remakes / mo</p>
              </div>
              <div className="rounded-lg bg-background p-3 text-center">
                <p className="text-xl font-bold text-primary">{fmtDec(restoResults.improvedRemakes)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Improved remakes / mo</p>
              </div>
              <div className="rounded-lg bg-background p-3 text-center">
                <p className="text-xl font-bold text-primary">{fmtDec(restoResults.remakesAvoided)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Remakes avoided / mo</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-background p-3">
                <p className="text-lg font-bold text-foreground">{fmtDollar(restoResults.recoveredProdMonth)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Recovered production / mo</p>
              </div>
              <div className="rounded-lg bg-background p-3">
                <p className="text-lg font-bold text-foreground">{fmtDec(restoResults.chairTimeSavedMonth)} hrs</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Chair time saved / mo</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-background p-3">
                <p className="text-lg font-bold text-foreground">{fmtDollar(restoResults.labCostsAvoidedYear)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Lab costs avoided / yr</p>
              </div>
              <div className="rounded-lg bg-background p-3">
                <p className="text-lg font-bold text-foreground">{fmtDollar(restoResults.opptyProdYear)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Opportunity production / yr</p>
              </div>
            </div>
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total financial upside / year</p>
              <p className="text-3xl font-bold text-primary">{fmtDollar(restoResults.totalFinancialUpsideYear)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Combined total */}
      <div className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">
              Combined Annual Upside {practices > 1 ? `(${practices} practices)` : "(per practice)"}
            </p>
            <p className="text-5xl font-bold text-primary tracking-tight">{fmtDollar(totalAnnualUpside)}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Denture: {fmtDollar(dentureResults.incProdYear * practices)}</span>
              <span>•</span>
              <span>Resto remakes: {fmtDollar(restoResults.totalFinancialUpsideYear * practices)}</span>
            </div>
          </div>
          <button onClick={() => setDemoOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap">
            Get Full Analysis
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="mt-6 text-[11px] text-muted-foreground/50 leading-relaxed text-center">
        Calculations based on per-practice estimates. Actual results may vary based on case mix, clinical workflow, and lab partner quality.
      </p>
      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  );
}
