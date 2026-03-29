import { motion, useScroll, useTransform } from "framer-motion";
import { useState, useRef } from "react";
import { ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DemoModal from "./DemoModal";
import ctaBg from "@/assets/financial-chart-bg.png";

const DSOFinalCTA = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [demoOpen, setDemoOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const orb1Y = useTransform(scrollYProgress, [0, 1], ["60px", "-60px"]);
  const orb2Y = useTransform(scrollYProgress, [0, 1], ["-40px", "40px"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["30px", "-15px"]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const { error } = await supabase.from("cta_submissions").insert({ email, source: "dso-microsite" });
      if (error) throw new Error(error.message);
      setStatus("success");
      setDemoOpen(true);
    } catch (err) {
      console.error("CTA submission failed:", err);
      setStatus("error");
    }
  };

  return (
    <section ref={sectionRef} id="contact" className="relative overflow-hidden bg-primary">
      <div className="absolute inset-0 z-0">
        <img src={ctaBg} alt="" className="w-full h-full object-cover opacity-10" />
        <div className="absolute inset-0 bg-primary/80" />
      </div>

      <div className="relative section-padding z-[1]">
        <motion.div style={{ y: orb1Y }} className="absolute top-0 left-1/4 w-96 h-96 bg-accent-warm/10 rounded-full blur-3xl" />
        <motion.div style={{ y: orb2Y }} className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary-light/20 rounded-full blur-3xl" />

        <motion.div style={{ y: contentY }} className="max-w-[720px] mx-auto px-6 md:px-10 text-center relative z-10">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[11px] font-semibold tracking-[0.2em] text-accent-warm mb-6 uppercase"
          >
            Next Steps
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-display text-primary-foreground"
          >
            Prove ROI.<br />Then scale.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-body-lg text-primary-foreground/65"
          >
            Validate impact with a focused pilot at 5–10 offices. Measure remake reduction, chair time recovered, and same-store revenue lift in real time — then scale across your network with confidence.
          </motion.p>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="mt-10 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            onSubmit={handleSubmit}
          >
            <input
              type="email"
              required
              placeholder="Email address"
              value={email}
              disabled={status === "loading" || status === "success"}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-full border border-primary-foreground/15 bg-card px-6 py-4 text-sm text-primary placeholder:text-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-warm/40 transition-all disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={status === "loading" || status === "success"}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-warm px-7 py-4 text-[14px] font-semibold uppercase tracking-wider text-accent-warm-foreground hover:brightness-110 transition-all duration-300 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === "loading" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
              ) : status === "success" ? (
                <><CheckCircle className="w-4 h-4" /> Sent!</>
              ) : (
                <>Get Started <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </motion.form>

          {status === "error" && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-[12px] text-red-400/80"
            >
              Something went wrong — please try again or email us directly.
            </motion.p>
          )}

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-12 text-[11px] text-primary-foreground/35 tracking-wide"
          >
            Trusted by 2,000+ dental offices · 96% first-time right · U.S.-based manufacturing
          </motion.p>
        </motion.div>
      </div>

      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </section>
  );
};

export default DSOFinalCTA;
