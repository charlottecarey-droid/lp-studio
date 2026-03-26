import { motion } from "framer-motion";
import { TrendingUp, Shield, Eye, Layers } from "lucide-react";
import digitalScanning from "@/assets/digital-scanning.jpg";

const pillars = [
  {
    number: "01",
    icon: TrendingUp,
    label: "Same-Store Growth",
    headline: "Your lab is the growth engine.",
    desc: "Higher case acceptance, faster throughput, and expanded services — turning a cost center into a scalable revenue driver across your entire network.",
    stats: [
      { value: "30%", label: "higher case acceptance" },
      { value: "31%", label: "annual revenue growth" },
    ],
  },
  {
    number: "02",
    icon: Layers,
    label: "Network-Wide Standardization",
    headline: "Growth breaks without a standard that scales.",
    desc: "Dandy embeds a single clinical and operational standard across every office — ensuring predictable outcomes across your entire portfolio.",
    stats: [
      { value: "300%", label: "nightguard volume increase" },
      { value: "2–3 min", label: "saved per crown appt" },
    ],
  },
  {
    number: "03",
    icon: Shield,
    label: "Waste Prevention",
    headline: "Waste is the hidden tax on every DSO.",
    desc: "By preventing remakes, delays, and variability before they occur, Dandy delivers immediate, visible value during pilots.",
    stats: [
      { value: "96%", label: "remake reduction" },
      { value: "2x", label: "faster denture workflow" },
    ],
  },
  {
    number: "04",
    icon: Eye,
    label: "Executive Visibility",
    headline: "Visibility isn't reporting — it's control.",
    desc: "Actionable insights that allow DSO leadership to intervene early, manage by exception, and maintain control as complexity increases across brands.",
    stats: [
      { value: "Real-time", label: "network-wide data" },
      { value: "AI-powered", label: "issue detection" },
    ],
  },
];

const DSOSolution = () => (
  <section id="solutions" className="section-padding">
    <div className="max-w-[1200px] mx-auto px-6 md:px-10">
      <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center mb-20">
        <div>
          <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-[11px] font-semibold text-primary mb-5 tracking-[0.15em] uppercase">
            The Dandy Platform
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-display text-foreground">
            Four systems.<br />One growth engine.
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="mt-6 text-body-lg text-muted-foreground">
            Dandy combines advanced manufacturing, AI-driven quality control, and network-wide insights — giving your DSO the tools to drive same-store growth across every office.
          </motion.p>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="relative rounded-3xl overflow-hidden group">
          <div className="aspect-[4/3] overflow-hidden">
            <img src={digitalScanning} alt="Dandy digital scanning workflow" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" loading="lazy" />
          </div>
        </motion.div>
      </div>

      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-border/60 hidden md:block" />
        <div className="space-y-5">
          {pillars.map((p, i) => (
            <motion.div key={p.label} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.6 }} className="group relative md:pl-20">
              <div className="hidden md:flex absolute left-0 top-8 w-12 h-12 rounded-full bg-secondary border-2 border-border items-center justify-center z-10 group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                <span className="text-xs font-semibold text-primary group-hover:text-primary-foreground transition-colors">{p.number}</span>
              </div>
              <div className="premium-card p-7 md:p-9">
                <div className="flex flex-col md:flex-row md:items-start md:gap-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0 group-hover:bg-primary/12 transition-colors">
                        <p.icon className="w-4.5 h-4.5 text-primary" />
                      </div>
                      <span className="text-[11px] font-semibold text-primary uppercase tracking-[0.15em]">{p.label}</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-medium text-foreground leading-snug tracking-tight">{p.headline}</h3>
                    <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed max-w-lg">{p.desc}</p>
                  </div>
                  <div className="flex md:flex-col gap-8 md:gap-5 mt-6 md:mt-0 md:min-w-[160px] md:text-right">
                    {p.stats.map((s) => (
                      <div key={s.label}>
                        <p className="text-2xl md:text-3xl font-medium text-foreground tracking-tight">{s.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default DSOSolution;
