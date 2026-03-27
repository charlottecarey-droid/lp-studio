import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import type { DsoHeartlandHeroBlockProps } from "@/lib/block-types";

interface Props {
  props: DsoHeartlandHeroBlockProps;
  onCtaClick?: () => void;
}

export function BlockDsoHeartlandHero({ props: p, onCtaClick }: Props) {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const primary   = "hsl(72, 55%, 48%)";
  const bg        = "hsl(192, 30%, 5%)";
  const statsBg   = "hsl(192, 28%, 4%)";
  const mutedFg   = "hsl(192, 10%, 55%)";

  const stats = p.stats ?? [];

  const renderHeadline = () => {
    const company = p.companyName?.trim() ?? "";
    if (company && p.headline.includes(company)) {
      const [before, ...rest] = p.headline.split(company);
      const after = rest.join(company);
      return (
        <>
          {before}
          <span style={{ color: primary }}>{company}</span>
          {after}
        </>
      );
    }
    return p.headline;
  };

  return (
    <div style={{ background: bg }}>
      <section
        ref={heroRef}
        className="relative flex flex-col overflow-hidden"
        style={{ minHeight: "100vh" }}
      >
        {p.backgroundImageUrl ? (
          <div className="absolute inset-0">
            <img
              src={p.backgroundImageUrl}
              alt=""
              className="w-full h-full object-cover"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, hsl(192 30% 5% / 0.65) 0%, hsl(192 30% 5% / 0.75) 50%, hsl(192 25% 8% / 0.92) 100%)",
              }}
            />
          </div>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                `radial-gradient(ellipse 80% 60% at 50% 0%, hsl(192 25% 12% / 0.8), transparent),
                 radial-gradient(ellipse 60% 40% at 80% 30%, hsl(72 40% 20% / 0.15), transparent),
                 ${bg}`,
            }}
          />
        )}

        <motion.div
          style={{ opacity: heroOpacity }}
          className="relative z-10 flex-1 flex flex-col justify-center w-full pt-24 pb-12"
        >
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 w-full text-center">
            {p.eyebrow && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-xs font-semibold uppercase tracking-[0.2em] mb-6"
                style={{ color: primary }}
              >
                {p.eyebrow}
              </motion.p>
            )}

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="font-semibold tracking-tight leading-[1.05]"
              style={{
                color: "hsl(0 0% 100%)",
                fontSize: "clamp(2.75rem, 8vw, 5rem)",
                textShadow: "0 2px 30px rgba(0,0,0,0.4)",
              }}
            >
              {renderHeadline()}
            </motion.h1>

            {p.subheadline && (
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="mt-6 text-base md:text-lg max-w-md mx-auto leading-relaxed"
                style={{ color: mutedFg }}
              >
                {p.subheadline}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
            >
              {p.primaryCtaText && (
                <a
                  href={p.primaryCtaUrl || "#"}
                  onClick={onCtaClick ? (e) => { e.preventDefault(); onCtaClick(); } : undefined}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{
                    background: primary,
                    color: "hsl(192, 30%, 6%)",
                  }}
                >
                  {p.primaryCtaText}
                  <ArrowRight className="w-4 h-4" />
                </a>
              )}

              {p.secondaryCtaText && (
                <a
                  href={p.secondaryCtaUrl || "#"}
                  className="inline-flex items-center justify-center gap-2 rounded-full border px-8 py-3.5 text-sm font-semibold transition-colors hover:border-opacity-60"
                  style={{
                    borderColor: "rgba(255,255,255,0.2)",
                    color: "hsl(0, 0%, 98%)",
                  }}
                >
                  {p.secondaryCtaText}
                </a>
              )}
            </motion.div>
          </div>

          {p.showScrollIndicator !== false && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.8 }}
              className="flex flex-col items-center gap-2 pb-8 mt-auto pt-12"
            >
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-5 h-8 rounded-full border flex items-start justify-center pt-1.5"
                style={{ borderColor: "rgba(255,255,255,0.2)" }}
              >
                <div
                  className="w-1 h-1.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.4)" }}
                />
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </section>

      {stats.length > 0 && (
        <div style={{ background: statsBg, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-5">
            <div
              className="grid divide-x"
              style={{
                gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`,
                divideColor: "rgba(255,255,255,0.07)",
              }}
            >
              {stats.slice(0, 4).map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="text-center px-4"
                >
                  <p
                    className="text-xl md:text-2xl font-semibold tracking-tight"
                    style={{ color: primary }}
                  >
                    {s.value}
                  </p>
                  <p
                    className="text-[10px] md:text-xs mt-0.5 uppercase tracking-wider"
                    style={{ color: mutedFg }}
                  >
                    {s.label}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
