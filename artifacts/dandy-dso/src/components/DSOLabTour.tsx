import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { MapPin, Microscope, Cpu, Users, Play, X } from "lucide-react";
import { useState, useRef } from "react";
import dandyLabMachines from "@/assets/dandy-lab-crown-machine.webp";
import DemoModal from "./DemoModal";

const highlights = [
  { icon: Microscope, label: "Advanced Materials Lab" },
  { icon: Cpu, label: "AI Quality Control" },
  { icon: Users, label: "U.S.-Based Technicians" },
  { icon: MapPin, label: "Multiple Locations" },
];

const DSOLabTour = () => {
  const [videoOpen, setVideoOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["40px", "-40px"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["20px", "-20px"]);

  return (
    <>
      <section ref={sectionRef} className="section-padding">
        <div className="max-w-[1200px] mx-auto px-6 md:px-10">
          <div className="grid md:grid-cols-2 gap-14 lg:gap-24 items-center">
            <motion.div
              style={{ y: imageY, boxShadow: 'var(--shadow-elevated)' }}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative rounded-3xl overflow-hidden group cursor-pointer"
              onClick={() => setVideoOpen(true)}
            >
              <div className="relative aspect-[4/3]">
                <img src={dandyLabMachines} alt="Dandy lab manufacturing floor" className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-foreground/10 group-hover:bg-black/5 transition-colors duration-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-xl">
                    <Play className="w-6 h-6 text-primary-foreground ml-0.5" fill="currentColor" />
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-foreground/70 to-transparent">
                  <p className="text-[10px] font-semibold text-primary-foreground/70 uppercase tracking-[0.2em]">Lab Tour</p>
                  <p className="mt-1 text-base font-medium text-white">Inside Dandy's U.S. Manufacturing Facility</p>
                </div>
              </div>
            </motion.div>

            <motion.div style={{ y: textY }}>
              <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-[11px] font-semibold tracking-[0.15em] text-primary mb-5 uppercase">
                Built in the USA
              </motion.p>
              <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="text-display text-foreground">
                See vertical integration in action.
              </motion.h2>
              <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="mt-6 text-body-lg text-muted-foreground">
                Unlike traditional labs, Dandy owns the entire manufacturing process — from scan to delivery. U.S.-based facilities, AI quality control, and expert technicians deliver a 96% first-time right rate at enterprise scale.
              </motion.p>

              <motion.blockquote initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.12 }} className="mt-6 border-l-2 border-primary/30 pl-4">
                <p className="text-sm text-foreground/70 italic leading-relaxed">"Dandy is a true partner, not just a vendor. They value education, technology, and people — that's what makes the difference."</p>
                <p className="text-xs text-muted-foreground mt-2">— DSO Clinical Operations Officer</p>
              </motion.blockquote>

              <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }} className="mt-10 grid grid-cols-2 gap-4">
                {highlights.map((h) => (
                  <div key={h.label} className="flex items-center gap-3 p-4 rounded-xl bg-secondary">
                    <h.icon className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground/80">{h.label}</span>
                  </div>
                ))}
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                onClick={() => setDemoOpen(true)}
                className="inline-flex items-center gap-2.5 mt-10 rounded-full bg-primary px-8 py-4 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 transition-all duration-300"
              >
                <MapPin className="w-4 h-4" />
                Request a Lab Tour
              </motion.button>
            </motion.div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {videoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
            onClick={() => setVideoOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setVideoOpen(false)} className="absolute -top-10 right-0 z-10 text-white hover:text-white/80 transition-colors" aria-label="Close video">
                <X className="w-6 h-6" />
              </button>
              <iframe
                src="https://www.youtube.com/embed/SjXFjvWW9o0?autoplay=1&rel=0"
                title="Inside Dandy's 100% Digital Dental Lab"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
};

export default DSOLabTour;
