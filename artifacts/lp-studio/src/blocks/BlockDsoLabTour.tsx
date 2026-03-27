import { useState, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Play, X, Microscope, Cpu, Users, MapPin } from "lucide-react";
import type { DsoLabTourBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { SECTION_PY } from "@/lib/brand-config";

interface Props {
  props: DsoLabTourBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
}

const LAB_HIGHLIGHTS = [
  { icon: Microscope, label: "Advanced Materials Lab"  },
  { icon: Cpu,        label: "AI Quality Control"      },
  { icon: Users,      label: "U.S.-Based Technicians"  },
  { icon: MapPin,     label: "Multiple Locations"      },
];

export function BlockDsoLabTour({ props, brand, onCtaClick }: Props) {
  const {
    eyebrow, headline, body,
    quote, quoteAttribution,
    imageUrl, videoUrl,
    ctaText, ctaUrl,
  } = props;

  const [videoOpen, setVideoOpen] = useState(false);

  const sectionRef  = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["40px", "-40px"]);
  const textY  = useTransform(scrollYProgress, [0, 1], ["20px", "-20px"]);

  const brandGreen = "hsl(152,42%,12%)";

  const handleCtaClick = () => {
    if (onCtaClick) { onCtaClick(); return; }
    if (ctaUrl && ctaUrl !== "#") window.open(ctaUrl, "_blank");
  };

  return (
    <>
      <section ref={sectionRef} className={`bg-white ${SECTION_PY}`}>
        <div className="max-w-[1200px] mx-auto px-6 md:px-10">
          <div className="grid md:grid-cols-2 gap-14 lg:gap-24 items-center">

            {/* ── Image / Video ── */}
            <motion.div
              style={{ y: imageY, boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative rounded-3xl overflow-hidden group cursor-pointer"
              onClick={() => videoUrl ? setVideoOpen(true) : undefined}
            >
              <div className="relative aspect-[4/3]">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Dandy lab manufacturing floor"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <Microscope className="w-16 h-16 text-slate-300" />
                  </div>
                )}

                {/* Overlay tint */}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-500" />

                {/* Play button */}
                {videoUrl && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-xl"
                      style={{ background: `${brandGreen}e6` }}
                    >
                      <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                    </div>
                  </div>
                )}

                {/* Caption bar */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
                  <p className="text-[10px] font-semibold text-white/70 uppercase tracking-[0.2em]">Lab Tour</p>
                  <p className="mt-1 text-base font-medium text-white">Inside Dandy's U.S. Manufacturing Facility</p>
                </div>
              </div>
            </motion.div>

            {/* ── Text side ── */}
            <motion.div style={{ y: textY }}>
              {eyebrow && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-5"
                  style={{ color: brandGreen }}
                >
                  {eyebrow}
                </motion.p>
              )}

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                className="text-3xl md:text-4xl font-bold leading-tight text-slate-900"
              >
                {headline}
              </motion.h2>

              {body && (
                <motion.p
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="mt-6 text-lg text-slate-500 leading-relaxed"
                >
                  {body}
                </motion.p>
              )}

              {quote && (
                <motion.blockquote
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.12 }}
                  className="mt-6 pl-4"
                  style={{ borderLeft: `2px solid ${brandGreen}4d` }}
                >
                  <p className="text-sm text-slate-600 italic leading-relaxed">"{quote}"</p>
                  {quoteAttribution && (
                    <p className="text-xs text-slate-400 mt-2">— {quoteAttribution}</p>
                  )}
                </motion.blockquote>
              )}

              {/* Lab highlight tiles */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 }}
                className="mt-10 grid grid-cols-2 gap-4"
              >
                {LAB_HIGHLIGHTS.map((h) => (
                  <div
                    key={h.label}
                    className="flex items-center gap-3 p-4 rounded-xl bg-slate-50"
                  >
                    <h.icon className="w-5 h-5 shrink-0" style={{ color: brandGreen }} />
                    <span className="text-sm font-medium text-slate-700">{h.label}</span>
                  </div>
                ))}
              </motion.div>

              {/* CTA */}
              {ctaText && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  onClick={handleCtaClick}
                  className="inline-flex items-center gap-2.5 mt-10 rounded-full px-8 py-4 text-[14px] font-semibold text-white hover:opacity-90 transition-all duration-300"
                  style={{ background: brandGreen }}
                >
                  <MapPin className="w-4 h-4" />
                  {ctaText}
                </motion.button>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Video lightbox ── */}
      <AnimatePresence>
        {videoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
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
              <button
                onClick={() => setVideoOpen(false)}
                className="absolute -top-10 right-0 z-10 text-white hover:text-white/80 transition-colors"
                aria-label="Close video"
              >
                <X className="w-6 h-6" />
              </button>
              {videoUrl && (
                <iframe
                  src={`${videoUrl}${videoUrl.includes("?") ? "&" : "?"}autoplay=1&rel=0`}
                  title="Lab tour video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
