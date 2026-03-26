import { motion, useScroll, useTransform } from "framer-motion";
import { ScanLine, ShieldCheck, BrainCircuit } from "lucide-react";
import aiScanReview from "@/assets/ai-scan-review.jpg";
import { useRef } from "react";

const stats = [
  { value: "96%", label: "First-Time Right" },
  { value: "<30s", label: "Scan Review" },
  { value: "100%", label: "AI-Screened" },
];

const DSOAIQuality = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["40px", "-40px"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["20px", "-20px"]);

  return (
    <section ref={sectionRef} className="section-padding">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="grid md:grid-cols-2 gap-14 lg:gap-24 items-center">
          <motion.div style={{ y: textY }}>
            <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-[11px] font-semibold tracking-[0.15em] text-primary mb-5 uppercase">
              Waste Prevention
            </motion.p>
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-display text-foreground">
              Remakes are a tax.<br />AI eliminates them.
            </motion.h2>
            <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="mt-6 text-body-lg text-muted-foreground">
              AI Scan Review catches issues in real time — avoiding costly rework and maximizing revenue potential before a case ever reaches the bench.
            </motion.p>

            <motion.blockquote initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.12 }} className="mt-6 border-l-2 border-primary/30 pl-4">
              <p className="text-sm text-foreground/70 italic leading-relaxed">"I don't even double-check the AI margins anymore — it's gained me time."</p>
              <p className="text-xs text-muted-foreground mt-2">— DSO Clinical Director</p>
            </motion.blockquote>

            <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }} className="mt-10 space-y-4">
              {[
                { icon: BrainCircuit, text: "AI reviews every scan for clinical accuracy" },
                { icon: ScanLine, text: "Real-time feedback before case submission" },
                { icon: ShieldCheck, text: "Eliminates remakes at the source" },
              ].map((item, i) => (
                <motion.div key={item.text} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.08 }} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-[15px] text-foreground/80">{item.text}</span>
                </motion.div>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="mt-12 flex gap-10">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="text-3xl font-medium text-foreground tracking-tight">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1.5 uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div style={{ y: imageY }} className="relative order-first md:order-last">
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-3xl overflow-hidden relative"
              style={{ boxShadow: 'var(--shadow-elevated)' }}
            >
              <img
                src={aiScanReview}
                alt="AI-powered dental scan quality review"
                className="w-full h-auto aspect-[4/3] object-cover object-[35%_center] scale-110"
                loading="lazy"
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default DSOAIQuality;
