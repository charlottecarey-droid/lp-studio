import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { TrendingDown, BarChart3, Scale, Wallet } from "lucide-react";
import { useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const challenges = [
  { icon: TrendingDown, title: "Same-Store Growth Pressure", desc: "Acquisition pipelines have slowed. With rising costs and tighter financing, DSOs must unlock more revenue from existing practices to protect EBITDA — and the dental lab is one of the most overlooked levers." },
  { icon: BarChart3, title: "Fragmented Lab Relationships", desc: "If every dentist chooses their own lab, you never get a volume advantage. Disconnected vendors across regions create data silos, quality variance, and zero negotiating leverage." },
  { icon: Scale, title: "Standards That Don't Survive Growth", desc: "Most DSOs don't fail because they grow too fast — they fail because their standards don't scale. Variability creeps in, outcomes drift, and operational discipline erodes with every new location." },
  { icon: Wallet, title: "Capital Constraints", desc: "Scanner requests pile up every year — $40K–$75K per operatory adds up fast. DSOs need a partner that eliminates CAPEX, includes premium hardware, and proves ROI within months." },
];

const DSOChallenge = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, [0.1, 0.9], ["0%", "-45%"]);
  const pathProgress = useTransform(scrollYProgress, [0.05, 0.85], [0, 1]);
  const [pathLen, setPathLen] = useState(0);
  useMotionValueEvent(pathProgress, "change", (v) => setPathLen(v));

  // Mobile: simple stacked layout
  if (isMobile) {
    return (
      <section className="section-padding bg-secondary">
        <div className="max-w-[1280px] mx-auto px-6">
          <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-[11px] font-semibold text-primary mb-4 tracking-[0.15em] uppercase">
            The Hidden Cost
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-display text-foreground mb-10">
            At scale — even small inefficiencies compound fast.
          </motion.h2>
          <div className="flex flex-col gap-5">
            {challenges.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.6 }}
                className="premium-card p-7"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center mb-5">
                  <c.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-foreground tracking-tight">{c.title}</h3>
                <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">{c.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="relative" style={{ height: "200vh" }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-secondary">
        <div className="relative h-full flex flex-col justify-center px-6 md:px-10">
          <div className="max-w-[1280px] mx-auto w-full mb-12">
            <div className="max-w-3xl">
              <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-[11px] font-semibold text-primary mb-4 tracking-[0.15em] uppercase">
                The Hidden Cost
              </motion.p>
              <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-display text-foreground">
                At scale — even small inefficiencies compound fast.
              </motion.h2>
            </div>
          </div>

          <div className="max-w-[1280px] mx-auto w-full relative">
            <svg
              className="absolute -top-16 left-0 w-full h-[calc(100%+80px)] pointer-events-none z-0"
              viewBox="0 0 1200 300"
              preserveAspectRatio="none"
              fill="none"
            >
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(152 42% 12%)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="hsl(152 42% 12%)" stopOpacity="0.02" />
                </linearGradient>
                <clipPath id="areaClip">
                  <rect x="0" y="0" width={1200 * pathLen} height="300" />
                </clipPath>
              </defs>
              <path
                d="M0 30 L40 25 L80 55 L120 40 L160 70 L200 58 L240 90 L280 75 L320 105 L360 95 L400 125 L440 110 L480 140 L520 128 L560 155 L600 145 L640 175 L680 160 L720 190 L760 180 L800 210 L840 198 L880 225 L920 215 L960 240 L1000 232 L1040 255 L1080 248 L1120 268 L1160 260 L1200 280 L1200 300 L0 300 Z"
                fill="url(#areaGrad)"
                clipPath="url(#areaClip)"
              />
              <path
                d="M0 30 L40 25 L80 55 L120 40 L160 70 L200 58 L240 90 L280 75 L320 105 L360 95 L400 125 L440 110 L480 140 L520 128 L560 155 L600 145 L640 175 L680 160 L720 190 L760 180 L800 210 L840 198 L880 225 L920 215 L960 240 L1000 232 L1040 255 L1080 248 L1120 268 L1160 260 L1200 280"
                stroke="hsl(152 42% 12%)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray="2000"
                strokeDashoffset={2000 - 2000 * pathLen}
                style={{ transition: "stroke-dashoffset 0.05s linear" }}
              />
            </svg>

            <motion.div style={{ x }} className="flex gap-6 will-change-transform relative z-10">
              {challenges.map((c, i) => (
                <motion.div
                  key={c.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.6 }}
                  className="w-[300px] md:w-[360px] premium-card p-8 shrink-0"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center mb-5">
                    <c.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground tracking-tight">{c.title}</h3>
                  <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">{c.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DSOChallenge;
