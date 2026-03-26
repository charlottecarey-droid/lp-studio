import { motion, useScroll, useTransform } from "framer-motion";
import { Rocket, BarChart3, TrendingUp, CheckCircle2 } from "lucide-react";
import { useRef } from "react";

const steps = [
  {
    icon: Rocket,
    title: "Launch a Pilot",
    subtitle: "Start with 5–10 offices",
    desc: "Dandy deploys premium scanners, onboards doctors with hands-on training, and integrates into existing workflows — no CAPEX, no disruption.",
    details: [
      "Premium hardware included for every operatory",
      "Dedicated field team manages change management",
      "Doctors trained and scanning within days",
    ],
  },
  {
    icon: BarChart3,
    title: "Validate Impact",
    subtitle: "Measure results in 60–90 days",
    desc: "Track remake reduction, chair time recovered, and same-store revenue lift in real time — proving ROI before you scale.",
    details: [
      "Live dashboard tracks pilot KPIs",
      "Compare pilot offices vs. control group",
      "Executive-ready reporting for leadership review",
    ],
  },
  {
    icon: TrendingUp,
    title: "Scale With Confidence",
    subtitle: "Roll out across the network",
    desc: "Expand across your entire network with the same standard, same playbook, and same results — predictable execution at enterprise scale.",
    details: [
      "Consistent onboarding across all locations",
      "One standard across every office and brand",
      "MSA ensures network-wide alignment at scale",
    ],
  },
];

const DSOPilotProgram = () => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: timelineRef, offset: ["start 80%", "end 60%"] });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section className="section-padding bg-secondary">
      <div className="max-w-[800px] mx-auto px-6 md:px-10">
        <div className="text-center mb-16">
          <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-[11px] font-semibold tracking-[0.15em] text-primary mb-5 uppercase">
            How It Works
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-display text-foreground">
            Start small. Prove it out.<br />Then scale.
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="mt-6 text-body-lg text-muted-foreground max-w-xl mx-auto">
            Growth should be proven before it's scaled. Dandy helps DSOs validate impact with a small number of locations and scale with confidence after — no enterprise risk required.
          </motion.p>
        </div>

        <div className="relative" ref={timelineRef}>
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border/60" />
          <motion.div className="absolute left-6 top-0 w-px bg-primary origin-top" style={{ height: lineHeight }} />

          <div className="space-y-14">
            {steps.map((step, i) => (
              <motion.div key={step.title} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.6 }} className="relative flex gap-6 md:gap-8">
                <div className="relative z-10 shrink-0">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                    <step.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                </div>
                <div className="pb-2 -mt-0.5">
                  <p className="text-[10px] font-semibold text-accent-warm uppercase tracking-[0.2em] mb-1">Step 0{i + 1}</p>
                  <h3 className="text-xl font-medium text-foreground tracking-tight">{step.title}</h3>
                  <p className="text-sm font-medium text-primary/70 mt-1">{step.subtitle}</p>
                  <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed">{step.desc}</p>
                  <ul className="mt-4 space-y-2">
                    {step.details.map((d) => (
                      <li key={d} className="flex items-start gap-2.5 text-[15px] text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DSOPilotProgram;
