import { motion } from "framer-motion";

const stories = [
  {
    org: "APEX DENTAL PARTNERS",
    metric: "12.5%",
    metricLabel: "annualized revenue potential increase",
    quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.",
    author: "Dr. Layla Lohmann, Founder",
  },
  {
    org: "OPEN & AFFORDABLE DENTAL",
    metric: "96%",
    metricLabel: "reduction in remakes",
    quote: "Reduced crown appointments by 2–3 minutes per case. That adds up to hours of saved chair time per month — and our remake headaches are gone.",
    author: "Clinical Director",
  },
  {
    org: "DENTAL CARE ALLIANCE",
    metric: "99%",
    metricLabel: "practices still using Dandy after one year",
    quote: "The training you guys give is incredible. The onboarding has been incredible. The whole experience has been incredible.",
    author: "Dr. Trey Mueller, Chief Clinical Officer",
  },
];

const DSOSuccessStories = () => (
  <section id="results" className="section-padding bg-primary">
    <div className="max-w-[1200px] mx-auto px-6 md:px-10">
      <div className="text-center mb-16">
        <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-[11px] font-semibold tracking-[0.15em] text-accent-warm mb-5 uppercase">
          Proven Results
        </motion.p>
        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-display text-primary-foreground">
          DSOs that switched<br />and never looked back.
        </motion.h2>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {stories.map((s, i) => (
          <motion.div
            key={s.org}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12, duration: 0.7 }}
            className="rounded-2xl bg-primary-foreground/[0.06] backdrop-blur-sm border border-primary-foreground/10 overflow-hidden flex flex-col hover:bg-primary-foreground/[0.1] transition-colors duration-300"
          >
            <div className="p-8 md:p-9 flex flex-col flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/50 mb-6">{s.org}</p>

              <p className="text-5xl font-medium text-primary-foreground tracking-tight">{s.metric}</p>
              <p className="mt-2 text-sm text-primary-foreground/60 mb-8">{s.metricLabel}</p>

              <div className="w-8 h-px bg-accent-warm/40 mb-6" />

              <blockquote className="text-sm text-primary-foreground/70 leading-relaxed italic flex-1">
                "{s.quote}"
              </blockquote>

              <p className="mt-8 text-sm font-medium text-accent-warm">— {s.author}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default DSOSuccessStories;
