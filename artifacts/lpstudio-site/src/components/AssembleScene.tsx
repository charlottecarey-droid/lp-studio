import { useEffect, useRef, useState } from "react";

const LIME = "#C7E738";
const FOREST = "#003A30";
const FOREST_DEEP = "#001F18";
const FOREST_MID = "#002B24";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

function useScrollProgress<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);
  const [vw, setVw] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let inView = true;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      // If section isn't tall enough yet (initial mount, layout pending), bail.
      if (total <= 0) {
        setProgress(0);
        return;
      }
      const traveled = -rect.top;
      const p = clamp01(traveled / total);
      setProgress(p);
      setVw(window.innerWidth);
    };
    const onScroll = () => {
      if (!inView) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    // Gate the heavy listener via IntersectionObserver to avoid layout thrash
    // when the section isn't on screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) update();
      },
      { rootMargin: "100px 0px" }
    );
    io.observe(el);
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return { ref, progress, vw };
}

interface BlockProps {
  visible: number;
  delay?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function FadeBlock({ visible, children, className = "", style }: BlockProps) {
  const v = clamp01(visible);
  return (
    <div
      className={className}
      style={{
        opacity: v,
        transform: `translateY(${(1 - v) * 28}px) scale(${0.96 + v * 0.04})`,
        transition: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function AssembleScene() {
  const { ref, progress, vw } = useScrollProgress<HTMLDivElement>();
  const isMobile = vw < 768;

  // Phase ranges (within 0..1 of pinned scroll)
  const introOut = range(progress, 0.0, 0.06);
  const frameIn = range(progress, 0.02, 0.10);
  const heroIn = range(progress, 0.10, 0.22);
  const imagesIn = range(progress, 0.22, 0.34);
  const logosIn = range(progress, 0.34, 0.42);
  const featuresIn = range(progress, 0.42, 0.54);
  const ctaIn = range(progress, 0.54, 0.62);
  const builderIn = range(progress, 0.62, 0.80);
  const finalIn = range(progress, 0.82, 0.95);

  // Page scale shrinks as more blocks stack so they stay in frame
  const blocksAdded = heroIn + imagesIn + logosIn + featuresIn + ctaIn;
  const pageScale = lerp(1.0, 0.6, clamp01(blocksAdded / 5));

  // Page upward scroll inside the frame (more aggressive after hero)
  const pageOffset = lerp(0, -120, clamp01(blocksAdded / 5));

  // Builder sidebar widths — collapse on mobile so the page area stays usable.
  const leftSbW = isMobile ? 0 : lerp(0, 200, builderIn);
  const rightSbW = isMobile ? 0 : lerp(0, 240, builderIn);

  // Hint label for current scroll-tied caption
  const captions = [
    { at: 0.10, text: "Block 1 — Hero" },
    { at: 0.22, text: "Block 2 — Visuals" },
    { at: 0.34, text: "Block 3 — Social proof" },
    { at: 0.42, text: "Block 4 — Features" },
    { at: 0.54, text: "Block 5 — Conversion CTA" },
    { at: 0.66, text: "Step 6 — Open the builder" },
    { at: 0.84, text: "Done. Now make it yours." },
  ];
  const activeCaption = [...captions].reverse().find((c) => progress >= c.at) ?? captions[0];

  return (
    <section
      ref={ref}
      style={{
        height: "520vh",
        background: `linear-gradient(180deg, #000 0%, ${FOREST_DEEP} 30%, ${FOREST_MID} 70%, #000 100%)`,
        position: "relative",
      }}
    >
      <div
        className="sticky top-0 h-screen w-full overflow-hidden"
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 1100px 700px at 50% 25%, rgba(199,231,56,0.10) 0%, transparent 65%), radial-gradient(ellipse 600px 400px at 90% 80%, rgba(199,231,56,0.06) 0%, transparent 70%)",
          }}
        />
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Top intro headline (fades out as you scroll) */}
        <div
          className="absolute z-20 text-center px-6 left-0 right-0"
          style={{
            top: 100,
            opacity: 1 - introOut,
            transform: `translateY(${-introOut * 24}px)`,
            pointerEvents: introOut > 0.5 ? "none" : "auto",
          }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-4"
            style={{
              background: "rgba(199,231,56,0.12)",
              color: LIME,
              border: "1px solid rgba(199,231,56,0.3)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: LIME }} />
            Scroll to watch LP Studio build a page
          </div>
          <h1
            className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl mx-auto"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            Your next landing page,{" "}
            <span style={{ color: LIME }}>assembled in real time.</span>
          </h1>
          <p
            className="mt-5 text-sm md:text-base max-w-md mx-auto"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Scroll down — watch a hero, visuals, social proof, and a full builder
            stack itself together. That's LP Studio.
          </p>
          <div className="mt-8 flex flex-col items-center gap-2 animate-pulse">
            <div
              className="text-[10px] uppercase tracking-widest"
              style={{ color: "rgba(199,231,56,0.8)" }}
            >
              Scroll
            </div>
            <svg width="20" height="28" viewBox="0 0 20 28" fill="none">
              <rect
                x="1"
                y="1"
                width="18"
                height="26"
                rx="9"
                stroke={LIME}
                strokeOpacity="0.6"
                strokeWidth="1.5"
              />
              <circle cx="10" cy="9" r="2.5" fill={LIME} />
            </svg>
          </div>
        </div>

        {/* Stage caption ribbon (top-pinned) */}
        <div
          className="absolute z-20 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wider uppercase whitespace-nowrap"
          style={{
            top: 92,
            opacity: clamp01(introOut * 1.2),
            background: "rgba(199,231,56,0.12)",
            color: LIME,
            border: "1px solid rgba(199,231,56,0.25)",
            transform: `translateX(-50%) translateY(${(1 - clamp01(introOut * 1.2)) * 8}px)`,
          }}
        >
          {activeCaption.text}
        </div>

        {/* Browser stage — fills full sticky viewport */}
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4 py-6"
          style={{ paddingTop: 130, paddingBottom: 40 }}
        >
          <div
            className="relative w-full max-w-6xl rounded-2xl overflow-hidden"
            style={{
              opacity: frameIn,
              transform: `translateY(${(1 - frameIn) * 40}px) scale(${0.92 + frameIn * 0.08})`,
              border: "1px solid rgba(199,231,56,0.18)",
              boxShadow:
                "0 50px 140px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 80px rgba(199,231,56,0.06)",
              background: FOREST_DEEP,
              height: "min(78vh, 720px)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Browser chrome */}
            <div
              className="h-9 flex items-center gap-2 px-4 shrink-0"
              style={{
                background: "#001512",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
              <span className="w-3 h-3 rounded-full" style={{ background: "#ffbd2e" }} />
              <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
              <div
                className="flex-1 mx-6 h-5 rounded-md flex items-center justify-center text-[10px]"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                lpstudio.ai/p/your-next-campaign
              </div>
              <div
                className="text-[10px] font-semibold tracking-wide"
                style={{ color: builderIn > 0.2 ? LIME : "rgba(255,255,255,0.3)" }}
              >
                {builderIn > 0.2 ? "● EDITING" : "● LIVE"}
              </div>
            </div>

            {/* Body: builder sidebars + page */}
            <div className="flex-1 flex min-h-0 relative">
              {/* LEFT SIDEBAR — block library */}
              <div
                className="shrink-0 overflow-hidden border-r"
                style={{
                  width: leftSbW,
                  background: "#000a08",
                  borderColor: "rgba(255,255,255,0.06)",
                  opacity: builderIn,
                }}
              >
                <div className="p-3 w-[200px]">
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider mb-3"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    Blocks on page
                  </div>
                  {[
                    { name: "Hero", on: heroIn > 0.5 },
                    { name: "Visual gallery", on: imagesIn > 0.5 },
                    { name: "Logo strip", on: logosIn > 0.5 },
                    { name: "Feature cards", on: featuresIn > 0.5 },
                    { name: "Conversion CTA", on: ctaIn > 0.5 },
                  ].map((b, i) => (
                    <div
                      key={b.name}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg mb-1 text-[11px]"
                      style={{
                        background: i === 0 ? "rgba(199,231,56,0.12)" : "transparent",
                        color: i === 0 ? LIME : b.on ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
                        fontWeight: i === 0 ? 600 : 500,
                      }}
                    >
                      <span
                        className="w-3 h-3 rounded flex items-center justify-center text-[8px]"
                        style={{
                          background: b.on ? LIME : "rgba(255,255,255,0.08)",
                          color: b.on ? FOREST : "transparent",
                        }}
                      >
                        ✓
                      </span>
                      {b.name}
                    </div>
                  ))}

                  <div
                    className="mt-4 text-[10px] font-bold uppercase tracking-wider mb-2"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    Block library
                  </div>
                  {["Pricing", "Testimonials", "FAQ", "Footer"].map((b) => (
                    <div
                      key={b}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-0.5 text-[11px]"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                    >
                      <span
                        className="w-3 h-3 rounded border"
                        style={{ borderColor: "rgba(255,255,255,0.2)" }}
                      />
                      {b}
                    </div>
                  ))}
                </div>
              </div>

              {/* CENTER — the page being assembled */}
              <div className="flex-1 min-w-0 overflow-hidden relative" style={{ background: FOREST }}>
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(199,231,56,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(199,231,56,0.04) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                    opacity: 1 - heroIn * 0.7,
                  }}
                />
                {/* Empty-state hint */}
                <div
                  className="absolute inset-0 flex items-center justify-center text-xs"
                  style={{
                    opacity: clamp01(1 - heroIn * 2),
                    color: "rgba(255,255,255,0.25)",
                  }}
                >
                  <div
                    className="px-4 py-2 rounded-lg border-2 border-dashed"
                    style={{
                      borderColor: "rgba(199,231,56,0.3)",
                      color: LIME,
                    }}
                  >
                    + Drop a block to start
                  </div>
                </div>

                {/* Stack of blocks */}
                <div
                  className="absolute inset-0 px-6 py-6 flex flex-col gap-4 overflow-hidden"
                  style={{
                    transformOrigin: "top center",
                    transform: `translateY(${pageOffset}px) scale(${pageScale})`,
                    transition: "none",
                  }}
                >
                  {/* Block 1 — Hero */}
                  <FadeBlock
                    visible={heroIn}
                    className="rounded-xl px-6 py-7 relative overflow-hidden"
                    style={{
                      background: FOREST_DEEP,
                      border: `1px solid rgba(199,231,56,${0.15 + heroIn * 0.15})`,
                      boxShadow:
                        heroIn > 0.5
                          ? "0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(199,231,56,0.1)"
                          : "none",
                    }}
                  >
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          "radial-gradient(ellipse 500px 300px at 30% 20%, rgba(199,231,56,0.10) 0%, transparent 65%)",
                      }}
                    />
                    <div className="relative">
                      <div
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold mb-3"
                        style={{
                          background: "rgba(199,231,56,0.15)",
                          color: LIME,
                          border: "1px solid rgba(199,231,56,0.25)",
                        }}
                      >
                        <span className="w-1 h-1 rounded-full" style={{ background: LIME }} />
                        Built for revenue teams
                      </div>
                      <div
                        className="font-bold leading-tight mb-2"
                        style={{
                          fontFamily: "Outfit, sans-serif",
                          fontSize: 28,
                          color: "#fff",
                        }}
                      >
                        Fast, branded landing pages{" "}
                        <span style={{ color: LIME }}>for revenue teams.</span>
                      </div>
                      <div
                        className="text-xs mb-4 max-w-md"
                        style={{ color: "rgba(255,255,255,0.6)" }}
                      >
                        Build personalized pages in minutes — AI copy, on-brand
                        design, instant publishing.
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="px-4 py-2 rounded-full text-[11px] font-bold"
                          style={{
                            background: LIME,
                            color: FOREST,
                            fontFamily: "Outfit, sans-serif",
                          }}
                        >
                          Start Building Free
                        </div>
                        <div
                          className="px-3 py-2 rounded-full text-[11px] font-semibold"
                          style={{
                            background: "rgba(255,255,255,0.08)",
                            color: "#fff",
                            border: "1px solid rgba(255,255,255,0.15)",
                          }}
                        >
                          See it in action →
                        </div>
                      </div>
                    </div>
                  </FadeBlock>

                  {/* Block 2 — Visual gallery */}
                  <FadeBlock
                    visible={imagesIn}
                    className="grid grid-cols-4 gap-2"
                  >
                    {[
                      { label: "Demo", grad: "linear-gradient(135deg, #C7E738, #6c8a1f)" },
                      { label: "Product", grad: "linear-gradient(135deg, #5fa9ff, #1a5fa0)" },
                      { label: "Team", grad: "linear-gradient(135deg, #ff8e6e, #b8503a)" },
                      { label: "Outcome", grad: "linear-gradient(135deg, #b87cff, #5e3aa0)" },
                    ].map((c) => (
                      <div
                        key={c.label}
                        className="aspect-[4/3] rounded-lg flex items-end p-2 text-[10px] font-bold relative overflow-hidden"
                        style={{
                          background: c.grad,
                          color: "#fff",
                          textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background:
                              "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 50%)",
                          }}
                        />
                        <span className="relative">{c.label}</span>
                      </div>
                    ))}
                  </FadeBlock>

                  {/* Block 3 — Logo strip */}
                  <FadeBlock
                    visible={logosIn}
                    className="rounded-xl px-4 py-4"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      className="text-[9px] uppercase tracking-widest mb-2 text-center"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      Trusted by 1,200+ revenue teams
                    </div>
                    <div className="flex items-center justify-around gap-3">
                      {["NORTHWIND", "ACME CO", "GLOBEX", "INITECH", "UMBRELLA"].map(
                        (n) => (
                          <div
                            key={n}
                            className="text-[10px] font-bold tracking-wider"
                            style={{ color: "rgba(255,255,255,0.55)" }}
                          >
                            {n}
                          </div>
                        )
                      )}
                    </div>
                  </FadeBlock>

                  {/* Block 4 — Feature cards */}
                  <FadeBlock visible={featuresIn} className="grid grid-cols-3 gap-2">
                    {[
                      { icon: "⚡", title: "Ship in minutes", body: "AI copy + brand styles already baked in." },
                      { icon: "🎯", title: "Convert more", body: "A/B variants with auto-significance." },
                      { icon: "🔒", title: "On-brand always", body: "Locked tokens, approved blocks." },
                    ].map((f) => (
                      <div
                        key={f.title}
                        className="rounded-lg p-3"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div className="text-base mb-1.5">{f.icon}</div>
                        <div
                          className="text-[11px] font-bold mb-1"
                          style={{ color: "#fff", fontFamily: "Outfit, sans-serif" }}
                        >
                          {f.title}
                        </div>
                        <div
                          className="text-[9px] leading-snug"
                          style={{ color: "rgba(255,255,255,0.5)" }}
                        >
                          {f.body}
                        </div>
                      </div>
                    ))}
                  </FadeBlock>

                  {/* Block 5 — CTA */}
                  <FadeBlock
                    visible={ctaIn}
                    className="rounded-xl px-5 py-4 flex items-center justify-between"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(199,231,56,0.18), rgba(199,231,56,0.05))",
                      border: "1px solid rgba(199,231,56,0.3)",
                    }}
                  >
                    <div>
                      <div
                        className="text-sm font-bold mb-0.5"
                        style={{ color: "#fff", fontFamily: "Outfit, sans-serif" }}
                      >
                        Want this live for your team?
                      </div>
                      <div
                        className="text-[10px]"
                        style={{ color: "rgba(255,255,255,0.6)" }}
                      >
                        Drop your email — we'll spin up a workspace.
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="px-3 py-1.5 rounded-full text-[10px]"
                        style={{
                          background: "rgba(0,0,0,0.3)",
                          color: "rgba(255,255,255,0.5)",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        you@company.com
                      </div>
                      <div
                        className="px-3 py-1.5 rounded-full text-[10px] font-bold"
                        style={{ background: LIME, color: FOREST }}
                      >
                        Get access
                      </div>
                    </div>
                  </FadeBlock>
                </div>
              </div>

              {/* RIGHT SIDEBAR — properties panel */}
              <div
                className="shrink-0 overflow-hidden border-l"
                style={{
                  width: rightSbW,
                  background: "#000a08",
                  borderColor: "rgba(255,255,255,0.06)",
                  opacity: builderIn,
                }}
              >
                <div className="p-3 w-[240px]">
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      Hero properties
                    </div>
                    <div
                      className="text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(199,231,56,0.15)", color: LIME }}
                    >
                      LIVE
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <div className="text-[9px] uppercase mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Eyebrow
                      </div>
                      <div
                        className="px-2 py-1.5 rounded text-[10px]"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        Built for revenue teams
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] uppercase mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Background
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-7 h-7 rounded"
                          style={{ background: FOREST_DEEP, border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                        <div
                          className="flex-1 px-2 py-1.5 rounded text-[10px] font-mono"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            color: "#fff",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          {FOREST_DEEP}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                          Brand:
                        </span>
                        {[FOREST, LIME, "#005A47", "#ffffff"].map((c, i) => (
                          <div
                            key={c + i}
                            className="w-3.5 h-3.5 rounded border"
                            style={{
                              background: c,
                              borderColor: i === 0 ? LIME : "rgba(255,255,255,0.2)",
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] uppercase mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Accent
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-7 h-7 rounded"
                          style={{ background: LIME, border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                        <div
                          className="flex-1 px-2 py-1.5 rounded text-[10px] font-mono"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            color: "#fff",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          {LIME}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] uppercase mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                        CTA text
                      </div>
                      <div
                        className="px-2 py-1.5 rounded text-[10px]"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        Start Building Free
                      </div>
                    </div>

                    <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="px-2.5 py-2 rounded-lg text-[10px] font-bold text-center"
                        style={{ background: LIME, color: FOREST }}
                      >
                        Publish changes
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Final CTA overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none px-6"
            style={{
              opacity: finalIn,
              background: `radial-gradient(ellipse 700px 400px at 50% 50%, rgba(0,0,0,${finalIn * 0.55}) 0%, transparent 70%)`,
            }}
          >
            <div
              className="text-center pointer-events-auto"
              style={{
                transform: `translateY(${(1 - finalIn) * 20}px) scale(${0.96 + finalIn * 0.04})`,
              }}
            >
              <h2
                className="text-3xl md:text-5xl font-bold mb-4"
                style={{ fontFamily: "Outfit, sans-serif", color: "#fff" }}
              >
                Now make it <span style={{ color: LIME }}>yours.</span>
              </h2>
              <p
                className="text-base md:text-lg mb-6 max-w-md mx-auto"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                Open a real builder. Real blocks. Real publishing. Free to start.
              </p>
              <a
                href="https://app.lpstudio.ai"
                className="inline-block px-8 py-4 rounded-full text-base font-bold transition-all"
                style={{
                  background: LIME,
                  color: FOREST,
                  fontFamily: "Outfit, sans-serif",
                  boxShadow: "0 0 60px rgba(199,231,56,0.4)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.background = "#d6f54a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.background = LIME;
                }}
              >
                Start Building Free →
              </a>
            </div>
          </div>
        </div>

        {/* Scroll progress bar at bottom */}
        <div
          className="absolute bottom-0 left-0 h-0.5"
          style={{
            width: `${progress * 100}%`,
            background: `linear-gradient(90deg, transparent, ${LIME})`,
            opacity: 0.6,
          }}
        />
      </div>
    </section>
  );
}
