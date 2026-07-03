import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/**
 * HeroShowcase — the hero's "image" (July 2026). A finished, on-palette
 * landing page inside a browser frame, tilted back slightly and easing
 * upright with a gentle parallax as the visitor starts scrolling — the
 * premium SaaS "product emerging from the fold" device. Built in code (no
 * bitmap): stays crisp on every display, inherits the marketing palette,
 * and costs nothing at prerender time.
 *
 * Narrative: this is the RESULT — a shipped page. One scroll later the
 * BuildSection shows the same kind of page being assembled from an empty
 * frame, so hero → scrollytelling reads as "here's what you get; here's
 * how fast it happens."
 *
 * Prerender-safe: no initial/animate opacity — the static snapshot renders
 * fully visible; only the scroll-driven transforms are progressive
 * enhancement.
 */
export default function HeroShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [7, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [24, 0]);

  return (
    <section
      className="relative overflow-hidden px-6 pb-4 pt-2"
      style={{ background: "var(--cream)", perspective: "1200px" }}
    >
      <div ref={ref} className="mx-auto w-full max-w-[1020px]">
        <motion.div
          style={{ rotateX, y, transformOrigin: "center top" }}
          className="overflow-hidden rounded-[20px] border border-black/[0.06] bg-white shadow-[0_60px_160px_-40px_rgba(37,33,77,0.28),0_0_0_1px_rgba(0,0,0,0.02)]"
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-2 border-b border-black/[0.05] bg-[oklch(0.985_0.002_280)] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
            <div className="mx-auto flex items-center gap-2 rounded-md bg-white/80 px-3 py-1 font-mono-display text-[10px] tracking-tight text-muted-foreground/70 ring-1 ring-black/[0.04]">
              <span className="h-1.5 w-1.5 rounded-full bg-sage/80" />
              fieldandco.com/spring-launch
            </div>
            <span className="hidden items-center gap-1 rounded-full bg-indigo/[0.08] px-2.5 py-0.5 font-mono-display text-[9px] font-semibold uppercase tracking-[0.14em] text-indigo sm:flex">
              Shipped · 47s
            </span>
          </div>

          {/* The finished page */}
          <div className="bg-white">
            {/* Page nav */}
            <div className="flex items-center justify-between border-b border-black/[0.04] px-8 py-4">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-md bg-indigo" />
                <span className="font-display text-[13px] font-semibold tracking-tight text-ink">Field Co.</span>
              </div>
              <div className="hidden items-center gap-6 text-[11px] text-ink/60 md:flex">
                <span>Products</span>
                <span>Stories</span>
                <span>Stockists</span>
              </div>
              <div className="rounded-full bg-ink px-3.5 py-1.5 text-[11px] font-medium text-white">Shop the drop</div>
            </div>

            {/* Page hero */}
            <div className="px-8 pb-9 pt-10 text-center">
              <span className="font-mono-display text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo">
                Spring &apos;26 · limited run
              </span>
              <h3 className="mx-auto mt-3 max-w-[560px] font-display text-[clamp(26px,3.2vw,40px)] font-[620] leading-[1.02] tracking-[-0.035em] text-ink">
                Tools your weekends
                <br />
                <span className="text-indigo">have been waiting for.</span>
              </h3>
              <p className="mx-auto mt-4 max-w-[420px] text-[13.5px] leading-relaxed text-ink/55">
                Small-batch garden tools, forged and finished by hand. The spring collection drops Thursday.
              </p>
              <div className="mt-6 flex items-center justify-center gap-2.5">
                <span className="rounded-full bg-indigo px-5 py-2 text-[12px] font-semibold text-white shadow-[0_10px_28px_-10px_var(--indigo)]">
                  Get early access
                </span>
                <span className="rounded-full border border-black/[0.09] bg-white px-5 py-2 text-[12px] font-medium text-ink/70">
                  See the collection
                </span>
              </div>
            </div>

            {/* Proof strip — clipped by the fold; the page clearly continues */}
            <div className="grid grid-cols-3 gap-px border-t border-black/[0.05] bg-black/[0.04]">
              {[
                { v: "4.9★", l: "2.1k reviews" },
                { v: "38k", l: "Waitlist members" },
                { v: "72h", l: "Sellout, last drop" },
              ].map((s) => (
                <div key={s.l} className="bg-white px-6 py-5 text-center">
                  <div className="font-display text-[19px] font-semibold tracking-tight text-ink">{s.v}</div>
                  <div className="mt-0.5 font-mono-display text-[9.5px] uppercase tracking-[0.14em] text-ink/45">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Handoff line into the scrollytelling below */}
        <p className="mt-8 text-center font-mono-display text-[10px] uppercase tracking-[0.3em] text-muted-foreground/55">
          Scroll — watch the next one get built
        </p>
        <div className="mx-auto mt-3 h-10 w-px bg-gradient-to-b from-ink/30 to-transparent" />
      </div>
    </section>
  );
}
