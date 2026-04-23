import { useEffect, useRef, useState } from "react";

const LIME = "#D4F542";
const INK = "#0A0A0A";
const INK_2 = "#0F0F10";
const INK_3 = "#141416";
const TEXT = "#FAFAFA";
const MUTED = "rgba(250,250,250,0.55)";
const FAINT = "rgba(250,250,250,0.35)";
const HAIRLINE = "rgba(255,255,255,0.07)";
const HAIRLINE_STRONG = "rgba(255,255,255,0.14)";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

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

/* ---------- tiny inline icons (1.5px stroke) ---------- */
function Icon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
const ICON_BOLT = "M13 2 4 14h7l-1 8 9-12h-7l1-8Z";
const ICON_TARGET = "M12 2v4M12 18v4M2 12h4M18 12h4";
const ICON_LOCK = "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4";

/* ---------- block: stylized hero ---------- */
function MockHero({ in: vis }: { in: number }) {
  const v = easeOut(clamp01(vis));
  return (
    <div
      style={{
        opacity: v,
        transform: `translateY(${(1 - v) * 12}px)`,
        background: INK_2,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 14,
        padding: "26px 28px",
      }}
    >
      <div
        className="text-[9.5px] uppercase mb-3"
        style={{ letterSpacing: "0.22em", color: FAINT }}
      >
        For revenue teams
      </div>
      <div
        style={{
          fontFamily: "'Inter Tight', sans-serif",
          fontWeight: 600,
          letterSpacing: "-0.035em",
          fontSize: 30,
          lineHeight: 1.05,
          color: TEXT,
        }}
      >
        Landing pages that{" "}
        <span
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: "italic",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            color: LIME,
          }}
        >
          convert
        </span>
        ,<br />
        shipped before the brief is dry.
      </div>
      <div className="mt-3 text-[13px] max-w-md" style={{ color: MUTED, lineHeight: 1.55 }}>
        Personalized pages from your CRM data — written, designed, and live in
        under a minute.
      </div>
      <div className="mt-5 flex items-center gap-2">
        <div
          className="px-4 py-2 rounded-full text-[12px] font-medium"
          style={{ background: TEXT, color: INK }}
        >
          Start free
        </div>
        <div
          className="px-3.5 py-2 rounded-full text-[12px]"
          style={{ color: TEXT, border: `1px solid ${HAIRLINE_STRONG}` }}
        >
          See a live page →
        </div>
      </div>
    </div>
  );
}

/* ---------- block: visuals row ---------- */
function MockVisuals({ in: vis }: { in: number }) {
  const v = easeOut(clamp01(vis));
  const tiles = [
    { label: "Demo", grad: "linear-gradient(135deg, #1e2a0d 0%, #3a5410 60%, #6e8f1c 100%)" },
    { label: "Product", grad: "linear-gradient(135deg, #0e1a2a 0%, #1c3a5e 60%, #2f5e95 100%)" },
    { label: "Team", grad: "linear-gradient(135deg, #2a160d 0%, #5a2c1a 60%, #8a4a30 100%)" },
    { label: "Outcome", grad: "linear-gradient(135deg, #1c0d2a 0%, #3a1c5e 60%, #5e2f95 100%)" },
  ];
  return (
    <div
      className="grid grid-cols-4 gap-2"
      style={{
        opacity: v,
        transform: `translateY(${(1 - v) * 12}px)`,
      }}
    >
      {tiles.map((t, i) => (
        <div
          key={t.label}
          className="aspect-[4/3] rounded-lg relative overflow-hidden flex items-end p-2"
          style={{
            background: t.grad,
            border: `1px solid ${HAIRLINE}`,
            opacity: clamp01(v * 1.2 - i * 0.08),
            transform: `translateY(${(1 - v) * (8 + i * 4)}px)`,
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent 55%)" }}
          />
          <span
            className="relative text-[10px]"
            style={{
              color: "rgba(255,255,255,0.85)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {t.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- block: feature trio ---------- */
function MockFeatures({ in: vis }: { in: number }) {
  const v = easeOut(clamp01(vis));
  const items = [
    { icon: ICON_BOLT, title: "Ship in minutes", body: "AI copy and brand styles, baked in." },
    { icon: ICON_TARGET, title: "Convert more", body: "A/B variants with auto-significance." },
    { icon: ICON_LOCK, title: "On-brand always", body: "Locked tokens, approved blocks." },
  ];
  return (
    <div
      className="grid grid-cols-3"
      style={{
        opacity: v,
        transform: `translateY(${(1 - v) * 12}px)`,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 14,
        background: INK_2,
        overflow: "hidden",
      }}
    >
      {items.map((f, i) => (
        <div
          key={f.title}
          className="p-4"
          style={{
            borderLeft: i > 0 ? `1px solid ${HAIRLINE}` : "none",
          }}
        >
          <div style={{ color: LIME, marginBottom: 10 }}>
            <Icon d={f.icon} size={15} />
          </div>
          <div
            className="text-[12.5px] mb-1"
            style={{
              color: TEXT,
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {f.title}
          </div>
          <div className="text-[11px]" style={{ color: MUTED, lineHeight: 1.5 }}>
            {f.body}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- block: logo strip ---------- */
function MockLogos({ in: vis }: { in: number }) {
  const v = easeOut(clamp01(vis));
  const logos = ["NORTHWIND", "ACME", "GLOBEX", "INITECH", "UMBRELLA"];
  return (
    <div
      style={{
        opacity: v,
        transform: `translateY(${(1 - v) * 12}px)`,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 14,
        background: INK_2,
        padding: "16px 20px",
      }}
    >
      <div
        className="text-[9.5px] uppercase mb-3"
        style={{ letterSpacing: "0.22em", color: FAINT }}
      >
        Trusted by 1,200+ revenue teams
      </div>
      <div className="flex items-center justify-between gap-3">
        {logos.map((n) => (
          <div
            key={n}
            className="text-[11px]"
            style={{
              color: "rgba(250,250,250,0.6)",
              letterSpacing: "0.18em",
              fontWeight: 500,
            }}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- block: CTA band ---------- */
function MockCTA({ in: vis }: { in: number }) {
  const v = easeOut(clamp01(vis));
  return (
    <div
      className="flex items-center justify-between"
      style={{
        opacity: v,
        transform: `translateY(${(1 - v) * 12}px)`,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 14,
        background: `linear-gradient(180deg, ${INK_3}, ${INK_2})`,
        padding: "18px 22px",
      }}
    >
      <div>
        <div
          className="text-[15px] mb-0.5"
          style={{
            color: TEXT,
            fontFamily: "'Inter Tight', sans-serif",
            fontWeight: 600,
            letterSpacing: "-0.015em",
          }}
        >
          See it on a real{" "}
          <span
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontStyle: "italic",
              fontWeight: 400,
              color: LIME,
            }}
          >
            page
          </span>
          .
        </div>
        <div className="text-[11.5px]" style={{ color: MUTED }}>
          Drop your email — we'll spin up your workspace.
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div
          className="px-3 py-1.5 rounded-full text-[11px]"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: FAINT,
            border: `1px solid ${HAIRLINE}`,
          }}
        >
          you@company.com
        </div>
        <div
          className="px-3 py-1.5 rounded-full text-[11px] font-medium"
          style={{ background: LIME, color: INK }}
        >
          Get access
        </div>
      </div>
    </div>
  );
}

/* ---------- selection handle: shows the page is editable ---------- */
function SelectionFrame({ in: vis }: { in: number }) {
  const v = easeOut(clamp01(vis));
  if (v < 0.02) return null;
  const Handle = ({ pos }: { pos: React.CSSProperties }) => (
    <div
      style={{
        position: "absolute",
        width: 8,
        height: 8,
        background: LIME,
        border: `1.5px solid ${INK}`,
        borderRadius: 2,
        opacity: v,
        ...pos,
      }}
    />
  );
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        inset: "20px 24px auto 24px",
        height: "auto",
        top: 20,
        bottom: "auto",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: `1px solid ${LIME}`,
          borderRadius: 16,
          opacity: v * 0.9,
          boxShadow: `0 0 0 4px rgba(212,245,66,${v * 0.08})`,
          height: 188,
        }}
      >
        <Handle pos={{ top: -5, left: -5 }} />
        <Handle pos={{ top: -5, right: -5 }} />
        <Handle pos={{ bottom: -5, left: -5 }} />
        <Handle pos={{ bottom: -5, right: -5 }} />
        <Handle pos={{ top: -5, left: "50%", marginLeft: -4 }} />
        <Handle pos={{ bottom: -5, left: "50%", marginLeft: -4 }} />
        <Handle pos={{ top: "50%", left: -5, marginTop: -4 }} />
        <Handle pos={{ top: "50%", right: -5, marginTop: -4 }} />
      </div>
      <div
        style={{
          position: "absolute",
          top: -28,
          left: 0,
          padding: "3px 8px",
          background: LIME,
          color: INK,
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.04em",
          opacity: v,
        }}
      >
        Hero · editable
      </div>
    </div>
  );
}

/* ---------- left caption phase ---------- */
interface PhaseProps {
  active: number; // 0..1
  eyebrow: string;
  title: React.ReactNode;
  body: string;
}
function Phase({ active, eyebrow, title, body }: PhaseProps) {
  const v = clamp01(active);
  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: v,
        transform: `translateY(${(1 - v) * 14}px)`,
        pointerEvents: v > 0.5 ? "auto" : "none",
      }}
    >
      <div
        className="text-[11px] uppercase mb-4"
        style={{ letterSpacing: "0.22em", color: FAINT }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          fontFamily: "'Inter Tight', sans-serif",
          fontWeight: 600,
          letterSpacing: "-0.035em",
          fontSize: 44,
          lineHeight: 1.04,
          color: TEXT,
        }}
      >
        {title}
      </h2>
      <p
        className="mt-5 text-[16px]"
        style={{ color: MUTED, lineHeight: 1.6, maxWidth: 440 }}
      >
        {body}
      </p>
    </div>
  );
}

export default function AssembleScene() {
  const { ref, progress, vw } = useScrollProgress<HTMLDivElement>();
  const isMobile = vw < 768;

  // Five clean phases, with overlap windows for crossfade.
  // 0–0.10 intro · 0.10–0.30 hero · 0.30–0.50 body · 0.50–0.72 proof+cta · 0.72–1.00 editable
  const intro = 1 - range(progress, 0.05, 0.14);
  const heroIn = range(progress, 0.10, 0.24);
  const visualsIn = range(progress, 0.28, 0.42);
  const featuresIn = range(progress, 0.36, 0.50);
  const logosIn = range(progress, 0.50, 0.62);
  const ctaIn = range(progress, 0.62, 0.74);
  const editIn = range(progress, 0.78, 0.92);

  // Phase activations for the left caption column
  const pIntro = 1 - range(progress, 0.06, 0.13);
  const pHero = range(progress, 0.10, 0.18) * (1 - range(progress, 0.28, 0.34));
  const pBody = range(progress, 0.30, 0.38) * (1 - range(progress, 0.52, 0.58));
  const pProof = range(progress, 0.55, 0.62) * (1 - range(progress, 0.74, 0.80));
  const pEdit = range(progress, 0.76, 0.84);

  // Page translate Y inside the device frame: as more blocks stack, scroll up
  const stackProgress =
    heroIn * 0.18 +
    visualsIn * 0.18 +
    featuresIn * 0.22 +
    logosIn * 0.18 +
    ctaIn * 0.24;
  const pageY = -lerp(0, 240, clamp01(stackProgress));

  return (
    <section
      ref={ref}
      style={{
        height: "420vh",
        background: INK,
        position: "relative",
      }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* very subtle baseline grid, fades in as the device appears */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "100% 96px",
            opacity: 0.6,
          }}
        />

        {/* INTRO — full-bleed centered headline, dissolves into the scene */}
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center px-6 text-center"
          style={{
            opacity: intro,
            transform: `translateY(${(1 - intro) * -20}px)`,
            pointerEvents: intro > 0.5 ? "auto" : "none",
          }}
        >
          <div
            className="text-[11px] uppercase mb-6"
            style={{ letterSpacing: "0.22em", color: FAINT }}
          >
            Landing pages, on demand
          </div>
          <h1
            style={{
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              letterSpacing: "-0.045em",
              fontSize: isMobile ? 44 : 76,
              lineHeight: 0.98,
              color: TEXT,
              maxWidth: 980,
            }}
          >
            Your next landing page,
            <br />
            <span
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontStyle: "italic",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: LIME,
              }}
            >
              assembled
            </span>{" "}
            in real time.
          </h1>
          <p
            className="mt-7 max-w-lg"
            style={{
              color: MUTED,
              fontSize: 17,
              lineHeight: 1.55,
            }}
          >
            Scroll. Watch a complete, on-brand page build itself — the way it
            does inside LP Studio, in about a minute.
          </p>
          <div className="mt-12 flex flex-col items-center gap-2">
            <div
              className="text-[10px] uppercase"
              style={{ letterSpacing: "0.24em", color: FAINT }}
            >
              Scroll
            </div>
            <div
              style={{
                width: 1,
                height: 36,
                background: `linear-gradient(180deg, ${HAIRLINE_STRONG}, transparent)`,
              }}
            />
          </div>
        </div>

        {/* MAIN STAGE — split layout */}
        <div
          className="absolute inset-0 z-10"
          style={{
            opacity: 1 - intro * 0.92,
            pointerEvents: intro > 0.5 ? "none" : "auto",
          }}
        >
          <div className="h-full max-w-[1200px] mx-auto px-6 md:px-10 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 items-center">
            {/* LEFT — phase captions */}
            <div className="hidden md:block md:col-span-5 relative" style={{ height: 320 }}>
              <Phase
                active={pHero}
                eyebrow="Step 01"
                title={
                  <>
                    Start with a{" "}
                    <span
                      style={{
                        fontFamily: "'Instrument Serif', Georgia, serif",
                        fontStyle: "italic",
                        fontWeight: 400,
                        color: LIME,
                      }}
                    >
                      hero
                    </span>{" "}
                    that already knows your brand.
                  </>
                }
                body="Type a brief — or sync from your CRM. LP Studio writes the headline, picks the layout, and applies your tokens automatically."
              />
              <Phase
                active={pBody}
                eyebrow="Step 02"
                title={
                  <>
                    Visuals and{" "}
                    <span
                      style={{
                        fontFamily: "'Instrument Serif', Georgia, serif",
                        fontStyle: "italic",
                        fontWeight: 400,
                        color: LIME,
                      }}
                    >
                      features
                    </span>{" "}
                    fall into place.
                  </>
                }
                body="Imagery from your library, feature blocks pulled from your product taxonomy. Composed for the audience the page is targeting."
              />
              <Phase
                active={pProof}
                eyebrow="Step 03"
                title={
                  <>
                    Proof and a{" "}
                    <span
                      style={{
                        fontFamily: "'Instrument Serif', Georgia, serif",
                        fontStyle: "italic",
                        fontWeight: 400,
                        color: LIME,
                      }}
                    >
                      conversion
                    </span>{" "}
                    moment.
                  </>
                }
                body="Logos, testimonials, and a single, sharp CTA. Forms wired to your CRM and warehouse from the second the page goes live."
              />
              <Phase
                active={pEdit}
                eyebrow="Step 04"
                title={
                  <>
                    Then it's{" "}
                    <span
                      style={{
                        fontFamily: "'Instrument Serif', Georgia, serif",
                        fontStyle: "italic",
                        fontWeight: 400,
                        color: LIME,
                      }}
                    >
                      yours
                    </span>{" "}
                    to refine.
                  </>
                }
                body="Every block stays editable. Tokens, copy, layout, A/B variants — open the page in the visual builder and tune it like a real designer would."
              />
            </div>

            {/* RIGHT — device frame */}
            <div className="col-span-1 md:col-span-7 flex items-center justify-center">
              <div
                className="relative w-full"
                style={{
                  maxWidth: 620,
                  aspectRatio: "4 / 5",
                  background: INK_2,
                  border: `1px solid ${HAIRLINE_STRONG}`,
                  borderRadius: 18,
                  overflow: "hidden",
                  boxShadow:
                    "0 30px 80px -20px rgba(0,0,0,0.6), 0 8px 30px -10px rgba(0,0,0,0.5)",
                }}
              >
                {/* slim app header — no traffic lights, no URL bar */}
                <div
                  className="flex items-center justify-between"
                  style={{
                    height: 36,
                    padding: "0 14px",
                    borderBottom: `1px solid ${HAIRLINE}`,
                    background: INK_3,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: LIME,
                      }}
                    />
                    <div
                      className="text-[11px]"
                      style={{
                        color: "rgba(250,250,250,0.7)",
                        fontFamily: "'Inter Tight', sans-serif",
                        fontWeight: 500,
                        letterSpacing: "-0.005em",
                      }}
                    >
                      Untitled page
                    </div>
                    <div
                      className="text-[10px] uppercase"
                      style={{
                        color: FAINT,
                        letterSpacing: "0.18em",
                        marginLeft: 6,
                      }}
                    >
                      Draft
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="text-[10px] uppercase"
                      style={{
                        color: editIn > 0.3 ? LIME : FAINT,
                        letterSpacing: "0.2em",
                      }}
                    >
                      {editIn > 0.3 ? "Editing" : "Building"}
                    </div>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: editIn > 0.3 ? LIME : "rgba(250,250,250,0.45)",
                        boxShadow: editIn > 0.3 ? `0 0 8px ${LIME}` : "none",
                      }}
                    />
                  </div>
                </div>

                {/* canvas */}
                <div className="relative" style={{ height: "calc(100% - 36px)" }}>
                  {/* baseline grid behind blocks */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage:
                        `linear-gradient(${HAIRLINE} 1px, transparent 1px), linear-gradient(90deg, ${HAIRLINE} 1px, transparent 1px)`,
                      backgroundSize: "32px 32px",
                      opacity: clamp01(1 - heroIn * 1.3),
                    }}
                  />
                  {/* empty hint */}
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      opacity: clamp01(1 - heroIn * 2.2),
                    }}
                  >
                    <div
                      className="text-[11px] uppercase"
                      style={{
                        color: FAINT,
                        letterSpacing: "0.22em",
                      }}
                    >
                      Empty canvas
                    </div>
                  </div>

                  {/* stack of blocks — translates up as more are added */}
                  <div
                    className="absolute inset-x-0 top-0 px-5 pt-5 flex flex-col gap-3"
                    style={{
                      transform: `translateY(${pageY}px)`,
                      transition: "none",
                    }}
                  >
                    <MockHero in={heroIn} />
                    <MockVisuals in={visualsIn} />
                    <MockFeatures in={featuresIn} />
                    <MockLogos in={logosIn} />
                    <MockCTA in={ctaIn} />
                  </div>

                  {/* selection chrome (appears at the end) */}
                  <SelectionFrame in={editIn} />

                  {/* bottom fade so blocks dissolve out cleanly */}
                  <div
                    className="absolute inset-x-0 bottom-0 pointer-events-none"
                    style={{
                      height: 80,
                      background: `linear-gradient(180deg, transparent, ${INK_2})`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* progress indicator — minimal hairline */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: 1,
            background: HAIRLINE,
            opacity: 1 - intro,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress * 100}%`,
              background: LIME,
              opacity: 0.7,
            }}
          />
        </div>
      </div>
    </section>
  );
}
