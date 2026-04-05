import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, DollarSign, Clock, ChevronDown, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DemoModal from "./DemoModal";

type Scenario = "conservative" | "expected" | "aggressive";

const scenarioApptsSaved: Record<Scenario, number> = {
  conservative: 1,
  expected: 1.5,
  aggressive: 2,
};

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtDec = (n: number, d = 1) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtDollar = (n: number) => `$${fmt(n)}`;

const DSOKCYSCalculator = () => {
  const [demoOpen, setDemoOpen] = useState(false);
  // Denture inputs
  const [dentureCases, setDentureCases] = useState(150);
  const [scenario, setScenario] = useState<Scenario>("expected");
  const [avgMinPerAppt, setAvgMinPerAppt] = useState(30);
  const [workingDays, setWorkingDays] = useState(20);
  const [prodPerHour, setProdPerHour] = useState(500);
  const [pctReinvested, setPctReinvested] = useState(75);
  const [reinvestProdPerHr, setReinvestProdPerHr] = useState(750);

  // Fixed resto inputs
  const [restoCases, setRestoCases] = useState(250);
  const [avgCaseValue, setAvgCaseValue] = useState(1500);
  const [currentRemakeRate, setCurrentRemakeRate] = useState(5);
  const [improvedRemakeRate, setImprovedRemakeRate] = useState(2);
  const [chairTimePerAppt, setChairTimePerAppt] = useState(1);
  const [labCostPerCase, setLabCostPerCase] = useState(50);
  const [restoProdPerHour, setRestoProdPerHour] = useState(500);

  const [practices, setPractices] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (practices > 1 && !recordedRef.current) {
      recordedRef.current = true;
      const timer = setTimeout(() => {
        supabase.from('calc_submissions').insert({ calculator_type: 'kcys', practice_count: practices });
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [practices]);

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

    return {
      apptsFreed,
      chairMinFreed,
      chairHrsFreed,
      chairHrsPerDay,
      incProdMonth,
      incProdYear,
      reinvestedHrs,
      reinvestProdMonth,
    };
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

    return {
      currentRemakes,
      improvedRemakes,
      remakesAvoided,
      recoveredProdMonth,
      recoveredProdYear,
      chairTimeSavedMonth,
      chairTimeSavedYear,
      labCostsAvoidedMonth,
      labCostsAvoidedYear,
      opptyProdMonth,
      opptyProdYear,
      totalFinancialUpsideYear,
    };
  }, [restoCases, currentRemakeRate, improvedRemakeRate, avgCaseValue, chairTimePerAppt, labCostPerCase, restoProdPerHour]);

  const totalAnnualUpside = (dentureResults.incProdYear + restoResults.totalFinancialUpsideYear) * practices;

  return (
    <section className="section-padding">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="text-center mb-14">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-medium text-primary mb-4 tracking-wide"
          >
            Financial Impact Calculator
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-display text-foreground"
          >
            Know your total financial upside.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto"
          >
            Calculate the combined impact of denture workflow improvements and remake reduction across your network.
          </motion.p>
        </div>

        {/* Practices multiplier */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 flex items-center justify-center gap-4"
        >
          <label className="text-sm text-muted-foreground">Number of practices:</label>
          <input
            type="number"
            min={1}
            max={2000}
            value={practices}
            onChange={(e) => setPractices(Math.max(1, Math.min(2000, parseInt(e.target.value) || 1)))}
            className="w-20 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="grid lg:grid-cols-2 gap-8"
        >
          {/* Denture Impact */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-foreground">Denture Workflow Impact</h3>
              <p className="text-xs text-muted-foreground mt-1">Chair time freed by reducing intermediate appointments.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Denture cases / month</label>
                <input
                  type="number" min={1} max={9999} value={dentureCases}
                  onChange={(e) => setDentureCases(Math.max(1, Math.min(9999, parseInt(e.target.value) || 1)))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Scenario</label>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-background p-1">
                  {(["conservative", "expected", "aggressive"] as Scenario[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setScenario(s)}
                      className={`py-2 rounded-md text-xs font-medium capitalize transition-colors ${
                        scenario === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{apptsSaved} appointments saved per case</p>
              </div>
            </div>

            {/* Denture results */}
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

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
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

            {/* Resto results */}
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
        </motion.div>

        {/* Combined total */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 }}
          className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-6"
        >
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
            <button
              onClick={() => setDemoOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              Get Full Analysis
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        <p className="mt-6 text-[11px] text-muted-foreground/50 leading-relaxed text-center">
          Calculations based on per-practice estimates. Actual results may vary based on case mix, clinical workflow, and lab partner quality.
        </p>
      </div>
      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </section>
  );
};

export default DSOKCYSCalculator;
