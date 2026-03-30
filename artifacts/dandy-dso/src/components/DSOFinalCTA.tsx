import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { useState, useRef } from "react";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DemoModal from "./DemoModal";
import ctaBg from "@/assets/financial-chart-bg.png";

const SLIDE = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};
const SPRING = { type: "spring" as const, stiffness: 380, damping: 34 };

interface Fields {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
}

const DSOFinalCTA = () => {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [fields, setFields] = useState<Fields>({ email: "", firstName: "", lastName: "", company: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [demoOpen, setDemoOpen] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const orb1Y = useTransform(scrollYProgress, [0, 1], ["60px", "-60px"]);
  const orb2Y = useTransform(scrollYProgress, [0, 1], ["-40px", "40px"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["30px", "-15px"]);

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields(f => ({ ...f, [key]: e.target.value }));

  const goNext = (e: React.FormEvent) => {
    e.preventDefault();
    setDir(1);
    setStep(1);
  };

  const goBack = () => {
    setDir(-1);
    setStep(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const { error } = await supabase.from("cta_submissions").insert({
        email: fields.email,
        first_name: fields.firstName,
        last_name: fields.lastName,
        company_name: fields.company,
        source: "dso-microsite",
      });
      if (error) throw new Error(error.message);
      setStatus("success");
      setDemoOpen(true);
    } catch (err) {
      console.error("CTA submission failed:", err);
      setStatus("error");
    }
  };

  const inputCls = "w-full rounded-xl border border-primary-foreground/15 bg-card px-5 py-3.5 text-sm text-primary placeholder:text-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-warm/40 transition-all disabled:opacity-50";

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
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-[11px] font-semibold tracking-[0.2em] text-accent-warm mb-6 uppercase"
          >
            Next Steps
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-display text-primary-foreground"
          >
            Prove ROI.<br />Then scale.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-body-lg text-primary-foreground/65"
          >
            Validate impact with a focused pilot at 5–10 offices. Measure remake reduction, chair time recovered, and same-store revenue lift in real time — then scale across your network with confidence.
          </motion.p>

          {/* Step indicator */}
          <motion.div
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            transition={{ delay: 0.12 }}
            className="mt-10 flex items-center justify-center gap-2"
          >
            {[0, 1].map(i => (
              <div
                key={i}
                className="h-1 rounded-full transition-all duration-500"
                style={{
                  width: step === i ? 28 : 8,
                  background: step === i ? "var(--accent-warm, #E8A87C)" : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </motion.div>

          {/* Form card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="mt-4 relative overflow-hidden"
            style={{ minHeight: 120 }}
          >
            <AnimatePresence mode="popLayout" custom={dir}>
              {step === 0 ? (
                <motion.form
                  key="step-1"
                  custom={dir}
                  variants={SLIDE}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={SPRING}
                  className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
                  onSubmit={goNext}
                >
                  <input
                    type="email"
                    required
                    placeholder="Work email address"
                    value={fields.email}
                    onChange={set("email")}
                    className="flex-1 rounded-full border border-primary-foreground/15 bg-card px-6 py-4 text-sm text-primary placeholder:text-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-warm/40 transition-all"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-warm px-7 py-4 text-[14px] font-semibold uppercase tracking-wider text-accent-warm-foreground hover:brightness-110 transition-all duration-300 whitespace-nowrap"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="step-2"
                  custom={dir}
                  variants={SLIDE}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={SPRING}
                  className="max-w-md mx-auto flex flex-col gap-3"
                  onSubmit={handleSubmit}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="First name"
                      value={fields.firstName}
                      onChange={set("firstName")}
                      disabled={status === "loading" || status === "success"}
                      className={inputCls}
                    />
                    <input
                      type="text"
                      required
                      placeholder="Last name"
                      value={fields.lastName}
                      onChange={set("lastName")}
                      disabled={status === "loading" || status === "success"}
                      className={inputCls}
                    />
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="Company / DSO name"
                    value={fields.company}
                    onChange={set("company")}
                    disabled={status === "loading" || status === "success"}
                    className={inputCls}
                  />

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={status === "loading" || status === "success"}
                      className="flex items-center justify-center gap-1.5 rounded-full border border-primary-foreground/20 px-5 py-3.5 text-[13px] text-primary-foreground/60 hover:text-primary-foreground hover:border-primary-foreground/40 transition-all duration-200 disabled:opacity-40"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back
                    </button>

                    <button
                      type="submit"
                      disabled={status === "loading" || status === "success"}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-accent-warm px-7 py-3.5 text-[14px] font-semibold uppercase tracking-wider text-accent-warm-foreground hover:brightness-110 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {status === "loading" ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                      ) : status === "success" ? (
                        <><CheckCircle className="w-4 h-4" /> Done!</>
                      ) : (
                        <>Book My Demo <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>

                  {status === "error" && (
                    <motion.p
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[12px] text-red-400/80 text-center"
                    >
                      Something went wrong — please try again.
                    </motion.p>
                  )}
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-10 text-[11px] text-primary-foreground/35 tracking-wide"
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
