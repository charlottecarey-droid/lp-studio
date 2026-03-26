import { motion } from "framer-motion";
import { AlertTriangle, BarChart3, Users2, TrendingDown } from "lucide-react";

const problems = [
{
  icon: AlertTriangle,
  title: "Fragmented Networks",
  desc: "Lab vendors vary by region, creating blind spots in quality, cost, and turnaround — with no centralized visibility across your network."
},
{
  icon: BarChart3,
  title: "Scattered Data",
  desc: "Disconnected systems across brands and locations make performance tracking nearly impossible. You can't improve what you can't measure."
},
{
  icon: Users2,
  title: "Provider Resistance",
  desc: "When lab quality is inconsistent, providers lose confidence in the workflow — slowing adoption and undermining digital transformation."
},
{
  icon: TrendingDown,
  title: "Revenue Leakage",
  desc: "High remake rates, wasted chair time, and inefficient workflows silently drain profitability at every location — compounding across your entire network."
}];


const DSOProblem = () =>
<section className="section-padding relative z-10 overflow-hidden">
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 relative z-10">
      <div className="text-center mb-16">
        <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-[11px] font-semibold tracking-[0.15em] text-primary mb-5 uppercase">
          The Problem
        </motion.p>
        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-display text-foreground">Lab consolidation shouldn't{' '}<br className="hidden md:block" />mean compromise.
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="mt-6 text-body-lg text-muted-foreground max-w-2xl mx-auto">Growing DSOs face a critical tension: executives need standardization and cost control, while providers demand clinical autonomy and quality they trust. Without alignment, both sides lose.
      </motion.p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {problems.map((p, i) => <motion.div
        key={p.title}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: i * 0.08 }}
        className="premium-card p-8 group">

            <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center mb-6 group-hover:bg-primary/12 transition-colors">
              <p.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground tracking-tight">{p.title}</h3>
            <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">{p.desc}</p>
          </motion.div>
      )}
      </div>
    </div>
  </section>;


export default DSOProblem;
