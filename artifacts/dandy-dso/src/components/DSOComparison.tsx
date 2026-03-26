import { motion } from "framer-motion";
import { Check, Minus, ArrowRight } from "lucide-react";
import { useState } from "react";
import DemoModal from "./DemoModal";

const rows = [
{ need: "Patient Volume Growth", dandy: "30% higher case acceptance, expanded services like Aligners", traditional: "No growth enablement" },
{ need: "Multi-Brand Consistency", dandy: "One standard across all your brands and locations", traditional: "Varies by location and vendor" },
{ need: "Waste Prevention", dandy: "AI Scan Review catches issues before they cost you", traditional: "Remakes discovered after the fact" },
{ need: "Executive Visibility", dandy: "Real-time, actionable data across your entire network", traditional: "Fragmented, non-actionable reports" },
{ need: "Capital Efficiency", dandy: "Premium scanners included — no CAPEX required", traditional: "Heavy CAPEX, scanner bottlenecks" },
{ need: "Change Management", dandy: "Hands-on training that respects provider autonomy", traditional: "Minimal onboarding, slow rollout" }];


const DSOComparison = () => {
  const [demoOpen, setDemoOpen] = useState(false);
  return (
    <section id="solutions" className="section-padding bg-secondary">
      <div className="max-w-[1100px] mx-auto px-6 md:px-10">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-[11px] font-semibold tracking-[0.15em] text-primary mb-5 uppercase">
            The Dandy Difference
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-display text-foreground">
            Built for DSO scale.<br />Designed for provider trust.
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="mt-6 text-body-lg text-muted-foreground max-w-2xl mx-auto"> Dandy combines the lab providers choose with advanced manufacturing, AI-driven quality control, and network-wide insights — a model traditional labs simply can't match.

           </motion.p>
          <motion.blockquote initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }} className="mt-8 max-w-2xl mx-auto border-l-2 border-primary/30 pl-5 text-left">
            <p className="text-sm text-foreground/70 italic leading-relaxed">"Dandy is the easiest pathway to lab consolidation without forcing doctors to switch."</p>
            <p className="text-xs text-muted-foreground mt-3">— Dr. Michael Fooshée, Chief Clinical Operations Officer, APEX Dental Partners</p>
          </motion.blockquote>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1, duration: 0.7 }} className="rounded-2xl overflow-hidden bg-background" style={{ boxShadow: 'var(--shadow-elevated)' }}>
          <div className="grid grid-cols-3 bg-primary">
            <div className="p-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary-foreground/60">What Your DSO Needs</div>
            <div className="p-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent-warm">Dandy</div>
            <div className="p-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary-foreground/60">Traditional Labs</div>
          </div>

          {rows.map((row, i) =>
          <motion.div key={row.need} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
          className="grid grid-cols-3 border-t border-border/50 hover:bg-secondary/40 transition-colors duration-200">
              <div className="p-5 text-sm font-medium text-foreground">{row.need}</div>
              <div className="p-5 flex items-start gap-2.5">
                <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span className="text-sm text-foreground/80 leading-relaxed">{row.dandy}</span>
              </div>
              <div className="p-5 flex items-start gap-2.5">
                <Minus className="w-4 h-4 text-muted-foreground/30 mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground/50 leading-relaxed">{row.traditional}</span>
              </div>
            </motion.div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="mt-12 text-center">
          <button onClick={() => setDemoOpen(true)} className="inline-flex items-center justify-center gap-2.5 rounded-full bg-primary px-8 py-4 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 transition-all duration-300">
            Request a Demo
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </section>);

};

export default DSOComparison;