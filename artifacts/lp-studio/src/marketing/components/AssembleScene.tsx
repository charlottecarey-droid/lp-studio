import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { useMadLibsPlaceholder } from "../lib/madLibsPlaceholder";

// Palette retargeted from "dark + lime" to "warm cream + ink + indigo" to match
// the app. Names preserved so call sites don't need rewrites.
const LIME = "#4B47E5";          // primary accent (indigo, matches app)
const INK = "#F6F2E9";           // page background (cream paper)
const INK_2 = "#FFFFFF";         // card / panel surface (pure white)
const INK_3 = "#FAF7EE";         // nested inner panel
const INK_4 = "#F1ECDE";         // deeper panel / divider band
const TEXT = "#1A1815";          // warm near-black ink text
const MUTED = "rgba(26,24,21,0.55)";
const FAINT = "rgba(26,24,21,0.35)";
const HAIRLINE = "rgba(26,24,21,0.10)";
const HAIRLINE_STRONG = "rgba(26,24,21,0.18)";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

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

/* Slice text by scroll progress, character-by-character. */
function typed(text: string, p: number) {
  const n = Math.floor(text.length * clamp01(p) + 0.0001);
  return text.slice(0, n);
}

/* Animated cursor (arrow pointer) */
function Cursor({
  x,
  y,
  visible,
  clicking,
  label,
}: {
  x: number;
  y: number;
  visible: number;
  clicking: number;
  /** Optional badge that follows the cursor (e.g. "AI · writing" while text
   *  is typing). Renders below-right of the pointer with a soft glow. */
  label?: string | null;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${x}px, ${y}px)`,
        transition: "none",
        pointerEvents: "none",
        opacity: visible,
        zIndex: 40,
      }}
    >
      {/* Outer pulse ring during click — slower, larger than the inner one
       *  so the moment reads as a real button click, not a hover. */}
      {clicking > 0 && (
        <>
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 6,
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "rgba(75,71,229,0.18)",
              transform: `translate(-50%, -50%) scale(${0.6 + clicking * 1.8})`,
              opacity: (1 - clicking) * 0.9,
              filter: "blur(2px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 6,
              width: 8,
              height: 8,
              borderRadius: 999,
              border: `2px solid ${LIME}`,
              transform: `translate(-50%, -50%) scale(${1 + clicking * 4})`,
              opacity: 1 - clicking,
            }}
          />
        </>
      )}
      <svg width="22" height="24" viewBox="0 0 20 22" fill="none" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))" }}>
        <path
          d="M2 2 L2 16 L6 12.5 L8.5 18.5 L11 17.5 L8.5 11.5 L14 11 Z"
          fill={TEXT}
          stroke="#FFFFFF"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      {label && (
        <div
          style={{
            position: "absolute",
            top: 22,
            left: 16,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 7px 3px 5px",
            borderRadius: 999,
            background: `linear-gradient(180deg, ${LIME} 0%, #6C68F0 100%)`,
            color: "#FFFFFF",
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.04em",
            fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
            boxShadow: "0 4px 12px -2px rgba(75,71,229,0.5), inset 0 1px 0 rgba(255,255,255,0.35)",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "#FFFFFF",
              boxShadow: "0 0 6px rgba(255,255,255,0.9)",
              animation: "lpc-blink 1s steps(2,end) infinite",
            }}
          />
          {label}
        </div>
      )}
    </div>
  );
}

type TypingTarget = "eyebrow" | "l1" | "l2" | "subtitle" | "none";

interface SceneProps {
  ctaColor: string;
  ctaLabel: string;
  eyebrow: string;
  headlineL1: string;
  headlineL2: string;
  subtitle: string;
  typing: TypingTarget;
  primaryClick: number;
  visualsIn: number;
  showSelection: boolean;
}

/* Render headline L1 with the word "convert" highlighted in lime as it types in. */
function renderL1(typed: string) {
  const pre = "Landing pages that ";
  const accent = "convert";
  const post = ",";
  const n = typed.length;
  const preShown = typed.slice(0, Math.min(n, pre.length));
  const accentShown =
    n > pre.length
      ? typed.slice(pre.length, Math.min(n, pre.length + accent.length))
      : "";
  const postShown =
    n > pre.length + accent.length ? typed.slice(pre.length + accent.length) : "";
  return (
    <>
      {preShown}
      <span style={{ color: LIME }}>{accentShown}</span>
      {postShown}
    </>
  );
}

/* The mock landing page that builds itself */
function MockPage({
  ctaColor,
  ctaLabel,
  eyebrow,
  headlineL1,
  headlineL2,
  subtitle,
  typing,
  primaryClick,
  visualsIn,
  showSelection,
}: SceneProps) {
  const Caret = () => (
    <span
      style={{
        display: "inline-block",
        width: 2,
        height: "0.95em",
        background: LIME,
        marginLeft: 2,
        verticalAlign: "text-bottom",
        animation: "lpc-blink 0.9s steps(2,end) infinite",
      }}
    />
  );

  // Stagger ramps inside the below-the-fold reveal so logo strip → bento →
  // stats → testimonial cascade in instead of all popping at once.
  const ramp = (start: number) => clamp01((visualsIn - start) * 2.5);

  return (
    <div className="relative h-full w-full" style={{ background: INK_2 }}>
      {/* Hero accent orb — sits behind the headline, never moves out of frame */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: -120,
          right: -80,
          width: 480,
          height: 480,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at center, rgba(75,71,229,0.18) 0%, rgba(75,71,229,0.06) 45%, rgba(75,71,229,0) 70%)",
          filter: "blur(8px)",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: 40,
          right: 220,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at center, rgba(255,170,120,0.16) 0%, rgba(255,170,120,0) 70%)",
          filter: "blur(8px)",
        }}
      />

      {/* hero section — asymmetric: copy left, mock dashboard preview right */}
      <div
        className="relative px-12 pt-14 pb-12"
        style={{
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        {/* selection rectangle around hero when builder is open */}
        {showSelection && (
          <div
            className="absolute pointer-events-none"
            style={{
              inset: "10px 16px 10px 16px",
              border: `1.5px solid ${LIME}`,
              borderRadius: 10,
              boxShadow: `0 0 0 5px rgba(75,71,229,0.08), 0 0 0 1px rgba(255,255,255,0.6) inset`,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -22,
                left: -1,
                background: `linear-gradient(180deg, ${LIME} 0%, #6C68F0 100%)`,
                color: "#FFFFFF",
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "3px 8px",
                borderRadius: 4,
                boxShadow: "0 2px 6px rgba(75,71,229,0.4)",
              }}
            >
              Hero
            </div>
            {[
              { top: -4, left: -4 },
              { top: -4, right: -4 },
              { bottom: -4, left: -4 },
              { bottom: -4, right: -4 },
            ].map((p, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: 8,
                  height: 8,
                  background: "#FFFFFF",
                  border: `2px solid ${LIME}`,
                  borderRadius: 2,
                  ...p,
                }}
              />
            ))}
          </div>
        )}

        <div className="grid grid-cols-12 gap-8 relative">
          {/* Left column: copy */}
          <div className="col-span-7 relative">
            {/* eyebrow as a pill */}
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 mb-5"
              style={{
                background: "rgba(75,71,229,0.06)",
                border: `1px solid rgba(75,71,229,0.18)`,
                minHeight: 24,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: LIME,
                  boxShadow: `0 0 6px ${LIME}`,
                }}
              />
              <span
                className="text-[10px] uppercase"
                style={{ letterSpacing: "0.22em", color: LIME, fontWeight: 700, minHeight: "1em" }}
              >
                {eyebrow}
                {typing === "eyebrow" && <Caret />}
              </span>
            </div>

            {/* headline */}
            <h2
              style={{
                fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                fontWeight: 600,
                letterSpacing: "-0.045em",
                fontSize: 54,
                lineHeight: 1.0,
                color: TEXT,
                maxWidth: 540,
                minHeight: "2em",
              }}
            >
              {renderL1(headlineL1)}
              {typing === "l1" && <Caret />}
              {(headlineL2.length > 0 || typing === "l2") && " "}
              {headlineL2}
              {typing === "l2" && <Caret />}
            </h2>

            {/* subtitle */}
            <p
              className="mt-5 text-[15.5px]"
              style={{
                color: MUTED,
                lineHeight: 1.55,
                maxWidth: 480,
                minHeight: "3.1em",
              }}
            >
              {subtitle}
              {typing === "subtitle" && <Caret />}
            </p>

            {/* CTAs */}
            <div className="mt-7 flex items-center gap-3">
              <button
                className="relative px-5 py-2.5 rounded-full text-[13.5px] font-medium overflow-hidden inline-flex items-center gap-1.5"
                style={{
                  background:
                    ctaColor === LIME
                      ? `linear-gradient(180deg, #6C68F0 0%, ${LIME} 100%)`
                      : ctaColor,
                  color: "#FFFFFF",
                  fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                  letterSpacing: "-0.005em",
                  transform: `scale(${1 - primaryClick * 0.05})`,
                  transition: "background 220ms ease, transform 120ms ease",
                  boxShadow:
                    ctaColor === LIME
                      ? "0 8px 22px -6px rgba(75,71,229,0.5), inset 0 1px 0 rgba(255,255,255,0.35)"
                      : "0 6px 18px -6px rgba(26,24,21,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
                }}
              >
                {ctaLabel}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14"/>
                  <path d="M13 5l7 7-7 7"/>
                </svg>
                {primaryClick > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 999,
                      border: `2px solid ${LIME}`,
                      transform: `scale(${1 + primaryClick * 0.45})`,
                      opacity: 1 - primaryClick,
                      pointerEvents: "none",
                    }}
                  />
                )}
                {ctaColor === LIME && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)",
                      backgroundSize: "200% 100%",
                      animation: "lpc-shimmer 2.6s linear infinite",
                      mixBlendMode: "overlay",
                      pointerEvents: "none",
                    }}
                  />
                )}
              </button>
              <button
                className="px-4 py-2.5 rounded-full text-[13.5px] inline-flex items-center gap-1.5"
                style={{
                  color: TEXT,
                  border: `1px solid ${HAIRLINE_STRONG}`,
                  background: INK_2,
                  fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                  fontWeight: 500,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
                }}
              >
                See a live page
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14"/>
                  <path d="M13 5l7 7-7 7"/>
                </svg>
              </button>
            </div>

            {/* Beta status line — honest framing for an invite-only product.
             *  Previously claimed "1,200+ teams shipped pages this quarter";
             *  removed in the marketing accuracy pass — see home.tsx note. */}
            <div className="mt-6 flex items-center gap-2.5">
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: LIME,
                  boxShadow: `0 0 8px ${LIME}`,
                }}
              />
              <div className="text-[12px]" style={{ color: MUTED, lineHeight: 1.35 }}>
                <strong style={{ color: TEXT, fontWeight: 600 }}>Skip the marketing queue.</strong> ·
                Every page on-brand, every time — AEs included.
              </div>
            </div>
          </div>

          {/* Right column: dashboard preview card */}
          <div className="col-span-5 relative">
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                background: INK_2,
                border: `1px solid ${HAIRLINE_STRONG}`,
                boxShadow:
                  "0 24px 60px -16px rgba(26,24,21,0.18), 0 8px 22px -10px rgba(75,71,229,0.18), inset 0 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ borderBottom: `1px solid ${HAIRLINE}`, background: INK_3 }}
              >
                <div className="flex items-center gap-1.5">
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: "rgba(26,24,21,0.18)" }} />
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: "rgba(26,24,21,0.18)" }} />
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: "rgba(26,24,21,0.18)" }} />
                  <span
                    className="ml-1.5 text-[10px] uppercase"
                    style={{ color: FAINT, letterSpacing: "0.2em", fontWeight: 600 }}
                  >
                    This week
                  </span>
                </div>
                <span
                  className="inline-flex items-center gap-1 text-[9px] uppercase px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(75,71,229,0.10)", color: LIME, letterSpacing: "0.16em", fontWeight: 700, border: `1px solid rgba(75,71,229,0.22)` }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: LIME, boxShadow: `0 0 5px ${LIME}` }} />
                  Live
                </span>
              </div>
              <div className="px-4 pt-4 pb-4">
                <div className="flex items-baseline gap-2">
                  <span
                    style={{
                      fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                      fontSize: 32,
                      fontWeight: 600,
                      letterSpacing: "-0.03em",
                      color: TEXT,
                      lineHeight: 1,
                    }}
                  >
                    18.2%
                  </span>
                  <span
                    className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-md"
                    style={{ background: "rgba(63,143,92,0.10)", color: "#2F7C4A", fontWeight: 600, border: "1px solid rgba(63,143,92,0.22)" }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 19V5"/>
                      <path d="M5 12l7-7 7 7"/>
                    </svg>
                    +4.6
                  </span>
                </div>
                <div className="text-[11px] mt-1" style={{ color: FAINT, letterSpacing: "0.06em" }}>
                  Conversion · variant B
                </div>

                {/* Mini sparkline */}
                <svg
                  viewBox="0 0 320 88"
                  preserveAspectRatio="none"
                  width="100%"
                  height={88}
                  className="mt-4"
                >
                  <defs>
                    <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(75,71,229,0.32)" />
                      <stop offset="100%" stopColor="rgba(75,71,229,0)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,72 L26,64 L52,68 L78,52 L104,58 L130,40 L156,46 L182,30 L208,38 L234,22 L260,28 L286,14 L320,8 L320,88 L0,88 Z"
                    fill="url(#spark-fill)"
                  />
                  <path
                    d="M0,72 L26,64 L52,68 L78,52 L104,58 L130,40 L156,46 L182,30 L208,38 L234,22 L260,28 L286,14 L320,8"
                    fill="none"
                    stroke={LIME}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="320" cy="8" r="4" fill="#FFFFFF" stroke={LIME} strokeWidth="2" />
                </svg>

                {/* Tiny metric row */}
                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                  {[
                    { label: "Sessions", value: "4,812" },
                    { label: "Demos", value: "246" },
                    { label: "Pipeline", value: "$1.4M" },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="text-[10px] uppercase" style={{ color: FAINT, letterSpacing: "0.16em", fontWeight: 600 }}>
                        {m.label}
                      </div>
                      <div className="text-[14px] mt-0.5" style={{ color: TEXT, fontWeight: 600, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating annotation chip */}
            <div
              className="absolute"
              style={{
                bottom: -14,
                left: -22,
                background: INK_2,
                border: `1px solid ${HAIRLINE_STRONG}`,
                borderRadius: 999,
                padding: "5px 11px",
                fontSize: 10.5,
                color: TEXT,
                fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                fontWeight: 600,
                letterSpacing: "-0.005em",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 6px 18px -4px rgba(26,24,21,0.18)",
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  background: `linear-gradient(135deg, ${LIME} 0%, #6C68F0 100%)`,
                  color: "#FFFFFF",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 700,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
                }}
              >
                ✦
              </span>
              Generated in 47s
            </div>
          </div>
        </div>
      </div>

      {/* below-the-fold — fades in after CTA click */}
      <div
        className="px-12 pt-9 pb-10"
        style={{ opacity: easeOut(visualsIn) }}
      >
        {/* Customer-logos block — renders as an empty placeholder strip until
            real customer logos are available + permission lands. The header
            previously read "Trusted by revenue teams at · +1,194 more" but
            both lines were fabricated social proof and the now-empty grid
            below made it stranded. Replaced with a neutral block label so
            the mockup reads as "here's what a logos block looks like —
            drop your customers in" rather than a false trust claim. */}
        <div className="flex items-center justify-between mb-4">
          <div
            className="text-[10px] uppercase"
            style={{ letterSpacing: "0.22em", color: FAINT, fontWeight: 600 }}
          >
            Customer logos block
          </div>
          <div className="text-[10px] uppercase" style={{ color: FAINT, letterSpacing: "0.18em" }}>
            Add yours
          </div>
        </div>
        <div
          className="grid grid-cols-6 gap-6 pb-8"
          style={{ borderBottom: `1px solid ${HAIRLINE}`, opacity: ramp(0) }}
        >
          {/* Fake "Northwind/Acme/Globex/Initech/Umbrella/Vandelay" logos
              removed (May 2026) — every name was a famous fictional company
              (Office Space, Resident Evil, Seinfeld). When real customer logos
              are available + permission lands, repopulate this array with
              objects of shape { name: string; mark: string }. Until then,
              this strip renders empty and the Dandy trust line in the hero
              carries the social proof. */}
          {([] as { name: string; mark: string }[]).map((b) => (
            <div key={b.name} className="flex items-center gap-2">
              {b.mark === "circle" && (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="7" fill="none" stroke="rgba(26,24,21,0.55)" strokeWidth="2"/>
                  <circle cx="12" cy="12" r="2.5" fill="rgba(26,24,21,0.55)"/>
                </svg>
              )}
              {b.mark === "triangle" && (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4l8 14H4z" fill="rgba(26,24,21,0.55)"/>
                </svg>
              )}
              {b.mark === "square" && (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="5" width="14" height="14" rx="2" fill="rgba(26,24,21,0.55)"/>
                  <rect x="9" y="9" width="6" height="6" rx="1" fill={INK_2}/>
                </svg>
              )}
              {b.mark === "wave" && (
                <svg width="22" height="14" viewBox="0 0 32 18" aria-hidden="true">
                  <path d="M0 9 Q 4 0, 8 9 T 16 9 T 24 9 T 32 9" fill="none" stroke="rgba(26,24,21,0.55)" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              )}
              {b.mark === "hex" && (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3l7 4.5v9L12 21l-7-4.5v-9z" fill="none" stroke="rgba(26,24,21,0.55)" strokeWidth="2"/>
                </svg>
              )}
              {b.mark === "diamond" && (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3l9 9-9 9-9-9z" fill="none" stroke="rgba(26,24,21,0.55)" strokeWidth="2"/>
                </svg>
              )}
              <span
                style={{
                  color: "rgba(26,24,21,0.6)",
                  fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                }}
              >
                {b.name}
              </span>
            </div>
          ))}
        </div>

        {/* Stat band */}
        <div
          className="grid grid-cols-3 gap-6 mt-8 mb-8 pb-8"
          style={{ borderBottom: `1px solid ${HAIRLINE}`, opacity: ramp(0.08) }}
        >
          {/* Mock in-product dashboard metrics — values represent a sample
           *  customer's workspace view, not platform-wide claims. Kept small
           *  and dashboard-shaped (not headline marketing stats). */}
          {[
            { value: "47s", label: "Median page generation" },
            { value: "+12%", label: "Top variant lift" },
            { value: "18", label: "Live landing pages" },
          ].map((s, i) => (
            <div key={s.label} className="relative">
              {i > 0 && (
                <div
                  aria-hidden
                  className="absolute"
                  style={{
                    left: -12,
                    top: 4,
                    bottom: 4,
                    width: 1,
                    background: HAIRLINE_STRONG,
                  }}
                />
              )}
              <div
                style={{
                  fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                  fontSize: 36,
                  fontWeight: 600,
                  letterSpacing: "-0.035em",
                  color: TEXT,
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.value}
              </div>
              <div className="text-[12px] mt-1.5" style={{ color: MUTED, letterSpacing: "0.02em" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Bento feature grid — 1 big + 2 small */}
        <div className="grid grid-cols-3 grid-rows-2 gap-4" style={{ opacity: ramp(0.18) }}>
          {/* Big card */}
          <div
            className="col-span-2 row-span-2 relative rounded-xl overflow-hidden p-6"
            style={{
              background:
                "linear-gradient(140deg, rgba(75,71,229,0.06) 0%, rgba(255,255,255,1) 60%)",
              border: `1px solid ${HAIRLINE_STRONG}`,
              minHeight: 230,
            }}
          >
            <div
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                top: -60,
                right: -40,
                width: 260,
                height: 260,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(75,71,229,0.16) 0%, rgba(75,71,229,0) 70%)",
                filter: "blur(6px)",
              }}
            />
            <div className="relative">
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase px-2 py-1 rounded-full mb-4" style={{ background: "rgba(75,71,229,0.10)", color: LIME, letterSpacing: "0.2em", fontWeight: 700, border: `1px solid rgba(75,71,229,0.22)` }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: LIME, boxShadow: `0 0 6px ${LIME}` }} />
                01 · AI generation
              </div>
              <div
                className="text-[20px] mb-2"
                style={{
                  color: TEXT,
                  fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                  maxWidth: 360,
                }}
              >
                A complete page from a one-line brief
              </div>
              <div className="text-[13px]" style={{ color: MUTED, lineHeight: 1.55, maxWidth: 340 }}>
                Copy, layout, imagery — composed in under a minute, on-brand and ready for the builder.
              </div>

              {/* Mini block preview */}
              <div className="mt-5 flex items-center gap-2.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="rounded-md relative overflow-hidden"
                    style={{
                      flex: i === 0 ? 1.8 : 1,
                      height: 38,
                      background: i === 0
                        ? `linear-gradient(135deg, ${LIME} 0%, #6C68F0 100%)`
                        : i === 1
                          ? "rgba(26,24,21,0.78)"
                          : i === 2
                            ? "rgba(75,71,229,0.10)"
                            : "rgba(26,24,21,0.06)",
                      border: `1px solid ${i === 0 ? "transparent" : HAIRLINE}`,
                      boxShadow: i === 0 ? "0 4px 10px -2px rgba(75,71,229,0.35)" : "none",
                    }}
                  >
                    {i === 0 && (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.32) 50%, transparent 70%)",
                          backgroundSize: "200% 100%",
                          animation: "lpc-shimmer 3.2s linear infinite",
                          mixBlendMode: "overlay",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Small card 1 */}
          <div
            className="rounded-xl p-4 relative overflow-hidden"
            style={{ background: INK_2, border: `1px solid ${HAIRLINE_STRONG}` }}
          >
            <div className="text-[10px] uppercase mb-2" style={{ color: LIME, letterSpacing: "0.2em", fontWeight: 700 }}>
              02 · On-brand
            </div>
            <div className="text-[15px]" style={{ color: TEXT, fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif", fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              Locked tokens, every block
            </div>
            <div className="mt-2 flex items-center gap-1">
              {[LIME, "#6C68F0", "#F4A172", "#1A1815", "#FAF7EE"].map((c, i) => (
                <span
                  key={i}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    background: c,
                    border: c === "#FAF7EE" ? `1px solid ${HAIRLINE_STRONG}` : "none",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Small card 2 */}
          <div
            className="rounded-xl p-4 relative overflow-hidden"
            style={{ background: INK_2, border: `1px solid ${HAIRLINE_STRONG}` }}
          >
            <div className="text-[10px] uppercase mb-2" style={{ color: LIME, letterSpacing: "0.2em", fontWeight: 700 }}>
              03 · Measured
            </div>
            <div className="text-[15px]" style={{ color: TEXT, fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif", fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              Variants, built-in
            </div>
            <div className="mt-2.5 flex items-center gap-1">
              {[60, 35, 80, 45].map((h, i) => (
                <span
                  key={i}
                  style={{
                    width: 8,
                    height: h * 0.32 + 6,
                    borderRadius: 1.5,
                    background: i === 2 ? LIME : "rgba(26,24,21,0.55)",
                    alignSelf: "flex-end",
                  }}
                />
              ))}
              <span
                className="text-[10px] ml-1.5"
                style={{ color: "#2F7C4A", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
              >
                +24%
              </span>
            </div>
          </div>
        </div>

        {/* Testimonial card */}
        <div
          className="mt-6 rounded-xl p-5 relative"
          style={{
            background: INK_2,
            border: `1px solid ${HAIRLINE_STRONG}`,
            boxShadow: "0 6px 22px -10px rgba(26,24,21,0.12)",
            opacity: ramp(0.28),
          }}
        >
          <div className="flex items-start gap-4">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                background: "linear-gradient(135deg,#F4A172 0%,#E37051 100%)",
                color: "#FFFFFF",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.02em",
                flexShrink: 0,
                boxShadow: "0 2px 6px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3)",
              }}
            >
              D
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-[14px]"
                style={{
                  color: TEXT,
                  lineHeight: 1.5,
                  letterSpacing: "-0.005em",
                  fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                }}
              >
                "Built a pilot landing page in 10–15 minutes to onboard 16 new
                locations. This thing is so useful — mass outreach, post-MSA,
                cold outreach, LinkedIn posts."
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[12px]" style={{ color: TEXT, fontWeight: 600 }}>
                  Account Executive
                </span>
                <span style={{ color: FAINT }}>·</span>
                <span className="text-[12px]" style={{ color: MUTED }}>
                  Dandy
                </span>
                <span className="ml-auto inline-flex items-center gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={LIME} aria-hidden="true">
                      <path d="M12 2l2.7 6.7L22 9.6l-5.4 4.7L18 22l-6-3.5L6 22l1.4-7.7L2 9.6l7.3-.9z"/>
                    </svg>
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Small inline-SVG icons used in the hero generator card. Avoiding a
 * lucide-react dep here keeps this marketing chunk lean — the rest of the
 * marketing site is icon-light by design. */
function IconLink({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}
function IconImage({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
function IconArrow({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </svg>
  );
}
function IconSparkle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4L12 3z" />
      <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" />
    </svg>
  );
}

const SUGGESTION_PILLS: { label: string; prompt: string }[] = [
  { label: "Pricing page", prompt: "A pricing page for a B2B platform aimed at COOs" },
  { label: "Event landing", prompt: "An event landing page for a fintech roadshow in October" },
  { label: "Product hero", prompt: "A product hero for a new clear aligner launch" },
  { label: "Demo-request page", prompt: "A demo-request page for an HR analytics product targeting mid-market" },
];

export default function AssembleScene() {
  const { ref, progress, vw } = useScrollProgress<HTMLDivElement>();
  const isMobile = vw < 768;

  // Hero generator state — kept local to the scene so we don't introduce a
  // store dependency on the marketing chunk. The textarea is decorative on
  // submit; "Generate" deep-links into the SaaS app with the prompt as a
  // query param so the actual generator flow can pre-fill it.
  const [heroPrompt, setHeroPrompt] = useState("");
  const [heroFocused, setHeroFocused] = useState(false);
  const [heroError, setHeroError] = useState(false);
  const heroTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Mad-Libs placeholder: rotates through fresh random combos so visitors see
  // a variety of examples, with an SSR-safe default on first paint so prerender
  // + hydration match. Rotation pauses while the field is focused or has text.
  // Rendered as a fading overlay (below) — the native placeholder can't animate.
  const madLibsPlaceholder = useMadLibsPlaceholder(heroFocused || heroPrompt.length > 0);
  const showHeroPlaceholder = !heroFocused && heroPrompt.length === 0;
  const submitHero = (override?: string) => {
    const value = (override ?? heroPrompt).trim();
    const url = value
      ? `https://app.lpstudio.ai/pages?new=ai&prompt=${encodeURIComponent(value)}`
      : "https://app.lpstudio.ai/pages?new=ai";
    window.location.href = url;
  };
  // Generate action — requires a real brief. The placeholder is inspiration,
  // never input, so an empty Generate shows a soft validation instead of
  // submitting the placeholder string.
  const handleGenerate = () => {
    if (!heroPrompt.trim()) {
      setHeroError(true);
      heroTextareaRef.current?.focus();
      return;
    }
    submitHero();
  };

  // ---------- phase plan ----------
  // 0.00–0.06  intro overlay fades out, device frame fades in
  // 0.06–0.10  empty canvas, cursor blinks in top-left
  // 0.10–0.14  type eyebrow
  // 0.14–0.30  type headline (L1 then L2)
  // 0.30–0.40  type subtitle
  // 0.40–0.45  cursor moves to primary CTA
  // 0.45–0.50  primary CTA click → triggers below-the-fold reveal
  // 0.50–0.62  visuals (logo strip + features) build in
  // 0.62–0.70  builder sidebars slide in (left blocks panel, right properties)
  // 0.70–0.78  cursor moves to a color swatch in right panel
  // 0.78–0.83  swatch click → primary CTA color shifts from white to lime + label edits to "Try it free"
  // 0.83–0.92  cursor moves to "Publish" button in header
  // 0.92–0.97  publish click → "Building" pill turns "Live"
  // 0.97–1.00  hold

  const introOut = range(progress, 0.0, 0.06);
  const frameIn = range(progress, 0.03, 0.09);

  // typing
  const typeEyebrow = range(progress, 0.10, 0.14);
  const typeHeadlineL1 = range(progress, 0.14, 0.22);
  const typeHeadlineL2 = range(progress, 0.22, 0.30);
  const typeSubtitle = range(progress, 0.30, 0.40);

  // CTA click
  const primaryClickWindow = range(progress, 0.45, 0.50);
  const primaryClick = primaryClickWindow * (1 - primaryClickWindow); // peaks at 0.5
  const primaryClicked = progress >= 0.48;

  // visuals reveal
  const visualsIn = range(progress, 0.50, 0.62);

  // builder open
  const builderIn = range(progress, 0.62, 0.72);

  // swatch click
  const swatchClickWindow = range(progress, 0.78, 0.83);
  const swatchClick = swatchClickWindow * (1 - swatchClickWindow);
  const swatchClicked = progress >= 0.81;

  // publish click
  const publishClickWindow = range(progress, 0.92, 0.97);
  const publishClick = publishClickWindow * (1 - publishClickWindow);
  const published = progress >= 0.95;

  // ---------- text values ----------
  const eyebrowFull = "FOR REVENUE TEAMS";
  const headlineL1Full = "Landing pages that convert,";
  const headlineL2Full = "shipped before the brief is dry.";
  const subtitleFull =
    "Personalized pages from your CRM data — written, designed, and live in under a minute.";

  const eyebrow = typed(eyebrowFull, typeEyebrow);
  const headlineL1 = typed(headlineL1Full, typeHeadlineL1);
  const headlineL2 = typed(headlineL2Full, typeHeadlineL2);
  const subtitle = typed(subtitleFull, typeSubtitle);

  // typing target — drives caret placement
  let typing: TypingTarget = "none";
  if (progress >= 0.10 && progress < 0.14) typing = "eyebrow";
  else if (progress >= 0.14 && progress < 0.22) typing = "l1";
  else if (progress >= 0.22 && progress < 0.30) typing = "l2";
  else if (progress >= 0.30 && progress < 0.40) typing = "subtitle";

  // CTA after edit
  const ctaColor = swatchClicked ? LIME : TEXT;
  const ctaLabel = swatchClicked ? "Try it free" : "Get started";

  // ---------- cursor positions (relative to device canvas) ----------
  // Coordinates are in canvas-local px assuming a ~960px wide device. Will scale below.
  const CANVAS_W = 960;
  const cursorKeyframes: { at: number; pos: { x: number; y: number } }[] = [
    { at: 0.07, pos: { x: 80, y: 60 } },
    { at: 0.13, pos: { x: 100, y: 90 } },     // hovering near eyebrow
    { at: 0.28, pos: { x: 480, y: 200 } },    // end of headline
    { at: 0.39, pos: { x: 520, y: 320 } },    // end of subtitle
    { at: 0.45, pos: { x: 130, y: 400 } },    // on primary CTA
    { at: 0.50, pos: { x: 130, y: 400 } },    // hold during click
    { at: 0.66, pos: { x: 600, y: 280 } },    // moving toward right panel area
    { at: 0.78, pos: { x: 870, y: 360 } },    // on color swatch (right panel)
    { at: 0.83, pos: { x: 870, y: 360 } },    // hold during swatch click
    { at: 0.92, pos: { x: 870, y: 60 } },     // up to Publish button in header
    { at: 0.97, pos: { x: 870, y: 60 } },     // hold during publish click
  ];

  const cursorPos = (() => {
    if (progress < cursorKeyframes[0].at) return cursorKeyframes[0].pos;
    for (let i = 0; i < cursorKeyframes.length - 1; i++) {
      const a = cursorKeyframes[i];
      const b = cursorKeyframes[i + 1];
      if (progress >= a.at && progress <= b.at) {
        const t = easeInOut((progress - a.at) / (b.at - a.at));
        return { x: lerp(a.pos.x, b.pos.x, t), y: lerp(a.pos.y, b.pos.y, t) };
      }
    }
    return cursorKeyframes[cursorKeyframes.length - 1].pos;
  })();

  const cursorVisible = (1 - introOut) * (1 - publishClickWindow * 0.5);
  const cursorClickAmount = Math.max(primaryClick, swatchClick, publishClick) * 4;

  return (
    <section
      ref={ref}
      style={{
        height: "560vh",
        background: INK,
        position: "relative",
      }}
    >
      <style>{`
        @keyframes lpc-blink { 50% { opacity: 0; } }
        @keyframes lpc-aurora-drift {
          0%   { transform: translate3d(0, 0, 0) scale(1); }
          50%  { transform: translate3d(2%, -1.5%, 0) scale(1.04); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes lpc-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes lpc-pulse-ring {
          0%   { transform: scale(0.85); opacity: 0.55; }
          70%  { transform: scale(1.6);  opacity: 0;    }
          100% { transform: scale(1.6);  opacity: 0;    }
        }
        @keyframes lpc-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Aurora glow — soft indigo radials drifting behind the device. The
         *  device frame sits on top of these so the whole stage gains depth
         *  without overwhelming the editorial palette. Parallax-tied to
         *  scroll for a touch of motion as you read down the section. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.55,
            transform: `translateY(${progress * -40}px)`,
            transition: "transform 80ms linear",
          }}
        >
          <div
            className="absolute"
            style={{
              top: "-12%",
              left: "8%",
              width: 720,
              height: 720,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at center, rgba(75,71,229,0.22) 0%, rgba(75,71,229,0.10) 35%, rgba(75,71,229,0) 70%)",
              filter: "blur(8px)",
              animation: "lpc-aurora-drift 14s ease-in-out infinite",
            }}
          />
          <div
            className="absolute"
            style={{
              top: "8%",
              right: "-6%",
              width: 580,
              height: 580,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at center, rgba(255,170,120,0.16) 0%, rgba(255,170,120,0.06) 40%, rgba(255,170,120,0) 70%)",
              filter: "blur(8px)",
              animation: "lpc-aurora-drift 18s ease-in-out infinite reverse",
            }}
          />
          <div
            className="absolute"
            style={{
              bottom: "-18%",
              left: "30%",
              width: 820,
              height: 820,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at center, rgba(75,71,229,0.10) 0%, rgba(75,71,229,0) 65%)",
              filter: "blur(12px)",
              animation: "lpc-aurora-drift 22s ease-in-out infinite",
            }}
          />
        </div>

        {/* Fine dot pattern — adds editorial texture without competing with
         *  the device. Two layers: a denser inner mesh that fades at the edges
         *  via a radial mask, plus the horizontal hairline grid we already had. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(26,24,21,0.10) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            opacity: 0.45,
            WebkitMaskImage:
              "radial-gradient(ellipse at center, rgba(0,0,0,1) 35%, rgba(0,0,0,0) 85%)",
            maskImage:
              "radial-gradient(ellipse at center, rgba(0,0,0,1) 35%, rgba(0,0,0,0) 85%)",
          }}
        />
        {/* very subtle baseline grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(26,24,21,0.04) 1px, transparent 1px)",
            backgroundSize: "100% 96px",
            opacity: 0.35,
          }}
        />

        {/* INTRO overlay — hero with embedded prompt generator. Mirrors the
         *  actual product UI (textarea + reference URL/screenshot affordances
         *  + Generate CTA) so first impression conveys what LP Studio does
         *  instead of just telling visitors to scroll. */}
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center px-6"
          style={{
            opacity: 1 - introOut,
            transform: `translateY(${introOut * -20}px)`,
            pointerEvents: introOut > 0.5 ? "none" : "auto",
          }}
        >
          {/* Eyebrow badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-7"
            style={{
              background: INK_2,
              border: `1px solid ${HAIRLINE_STRONG}`,
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: LIME,
                boxShadow: `0 0 0 3px rgba(75,71,229,0.18)`,
              }}
            />
            <span
              className="text-[11px] uppercase"
              style={{ letterSpacing: "0.18em", color: MUTED, fontWeight: 500 }}
            >
              The revenue workspace · Now in private beta
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-center"
            style={{
              fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
              fontWeight: 600,
              letterSpacing: "-0.045em",
              fontSize: isMobile ? 42 : 72,
              lineHeight: 0.98,
              color: TEXT,
              maxWidth: 980,
            }}
          >
            Describe a page.<br />
            <span style={{ color: LIME }}>Watch it build.</span>
          </h1>
          <p
            className="mt-5 text-center"
            style={{
              color: MUTED,
              fontSize: isMobile ? 15 : 17,
              lineHeight: 1.55,
              maxWidth: 620,
            }}
          >
            Type a prompt, paste a URL, drop a screenshot — get a real,
            on-brand page in under a minute.
          </p>

          {/* Prompt generator card */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerate();
            }}
            className="mt-9 w-full"
            style={{ maxWidth: 680 }}
          >
            <div
              className="rounded-2xl overflow-hidden transition-shadow"
              style={{
                background: INK_2,
                border: `1px solid ${heroFocused ? LIME : HAIRLINE_STRONG}`,
                boxShadow: heroFocused
                  ? `0 0 0 4px rgba(75,71,229,0.10), 0 12px 40px -12px rgba(26,24,21,0.18)`
                  : `0 12px 40px -16px rgba(26,24,21,0.18)`,
                transition: "border-color 160ms ease, box-shadow 160ms ease",
              }}
            >
              <div className="relative">
                <textarea
                  ref={heroTextareaRef}
                  value={heroPrompt}
                  onChange={(e) => {
                    setHeroPrompt(e.target.value);
                    if (heroError) setHeroError(false);
                  }}
                  onFocus={() => setHeroFocused(true)}
                  onBlur={() => setHeroFocused(false)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                  placeholder=""
                  rows={isMobile ? 3 : 2}
                  aria-label="Describe the landing page you want"
                  aria-invalid={heroError}
                  spellCheck={false}
                  className="w-full resize-none outline-none"
                  style={{
                    fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                    fontSize: 16,
                    lineHeight: 1.5,
                    color: TEXT,
                    background: "transparent",
                    padding: "18px 18px 6px 18px",
                  }}
                />
                {/* Animated placeholder overlay — fades on each rotation so the
                    text eases in/out instead of snapping. pointer-events:none so
                    clicks pass through to the textarea; aria-hidden since the
                    textarea already carries an aria-label. */}
                {showHeroPlaceholder && (
                  <div
                    aria-hidden="true"
                    className="absolute left-0 top-0 right-0 select-none"
                    style={{
                      fontFamily:
                        "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                      fontSize: 16,
                      lineHeight: 1.5,
                      color: FAINT,
                      padding: "18px 18px 6px 18px",
                      pointerEvents: "none",
                      opacity: madLibsPlaceholder.visible ? 1 : 0,
                      transition: "opacity 320ms ease-in-out",
                    }}
                  >
                    {madLibsPlaceholder.text}
                  </div>
                )}
              </div>

              {/* Card footer — affordances + generate CTA */}
              <div
                className="flex items-center justify-between gap-3 px-3 py-2.5"
                style={{ borderTop: `1px solid ${HAIRLINE}` }}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => submitHero()}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors"
                    style={{ color: MUTED, background: "transparent", fontWeight: 500 }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = INK_3;
                      e.currentTarget.style.color = TEXT;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = MUTED;
                    }}
                    aria-label="Add a reference URL"
                  >
                    <IconLink />
                    {!isMobile && <span>Reference URL</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => submitHero()}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors"
                    style={{ color: MUTED, background: "transparent", fontWeight: 500 }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = INK_3;
                      e.currentTarget.style.color = TEXT;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = MUTED;
                    }}
                    aria-label="Attach a screenshot"
                  >
                    <IconImage />
                    {!isMobile && <span>Screenshot</span>}
                  </button>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-[13px] transition-all"
                  style={{
                    background: LIME,
                    color: "#FFFFFF",
                    fontWeight: 600,
                    letterSpacing: "-0.005em",
                    boxShadow: "0 4px 12px -2px rgba(75,71,229,0.45)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
                >
                  <IconSparkle />
                  <span>Generate page</span>
                  <IconArrow />
                </button>
              </div>
            </div>
          </form>

          {/* Soft validation — the placeholder is inspiration, never input,
              so an empty Generate prompts for a brief instead of submitting. */}
          {heroError && (
            <div
              role="alert"
              className="mt-2 text-[13px]"
              style={{ color: "#C2410C", fontWeight: 500 }}
            >
              Type a brief to continue
            </div>
          )}

          {/* Suggestion pills */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2" style={{ maxWidth: 680 }}>
            <span
              className="text-[11.5px] mr-1"
              style={{ color: FAINT, letterSpacing: "0.02em" }}
            >
              Or start from:
            </span>
            {SUGGESTION_PILLS.map((pill) => (
              <button
                key={pill.label}
                type="button"
                onClick={() => {
                  setHeroPrompt(pill.prompt);
                  // Slight delay so the textarea fills visibly before the
                  // navigation happens — feels less like a hard redirect.
                  setTimeout(() => submitHero(pill.prompt), 180);
                }}
                className="text-[12.5px] rounded-full px-3 py-1.5 transition-all"
                style={{
                  background: INK_2,
                  color: MUTED,
                  border: `1px solid ${HAIRLINE_STRONG}`,
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = TEXT;
                  e.currentTarget.style.color = INK_2;
                  e.currentTarget.style.borderColor = TEXT;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = INK_2;
                  e.currentTarget.style.color = MUTED;
                  e.currentTarget.style.borderColor = HAIRLINE_STRONG;
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Social proof */}
          <div
            className="mt-9 flex items-center gap-3 text-[12px]"
            style={{ color: FAINT, letterSpacing: "0.02em" }}
          >
            <span
              style={{
                display: "inline-block",
                width: 28,
                height: 1,
                background: HAIRLINE_STRONG,
              }}
            />
            <span>
              Built inside Dandy. Shipped by AEs every day across 10,000+ practices and 3 of the top 5 DSOs.
            </span>
            <span
              style={{
                display: "inline-block",
                width: 28,
                height: 1,
                background: HAIRLINE_STRONG,
              }}
            />
          </div>

          {/* Scroll hint */}
          <div className="mt-10 flex flex-col items-center gap-1.5">
            <div
              className="text-[10px] uppercase"
              style={{ letterSpacing: "0.26em", color: FAINT }}
            >
              Or scroll to see one build
            </div>
            <div
              style={{
                width: 1,
                height: 28,
                background: `linear-gradient(180deg, ${HAIRLINE_STRONG}, transparent)`,
              }}
            />
          </div>
        </div>

        {/* DEVICE STAGE — full bleed */}
        <div
          className="absolute inset-0 z-10 flex items-center justify-center px-4 md:px-8 py-6"
          style={{
            opacity: frameIn,
            pointerEvents: frameIn < 0.5 ? "none" : "auto",
          }}
        >
          <div
            className="relative w-full max-w-[1200px]"
            style={{
              height: "min(82vh, 760px)",
              transform: `translateY(${(1 - frameIn) * 30}px) scale(${0.96 + frameIn * 0.04})`,
              transition: "none",
            }}
          >
            {/* App frame — adds a subtle gradient bevel + halo glow so the
             *  device reads as a polished, multi-layered surface rather than
             *  a flat rectangle. */}
            <div
              className="relative w-full h-full rounded-2xl overflow-hidden flex flex-col"
              style={{
                background: INK_2,
                border: `1px solid ${HAIRLINE_STRONG}`,
                boxShadow:
                  "0 60px 160px -30px rgba(75,71,229,0.25), 0 50px 140px -20px rgba(0,0,0,0.55), 0 8px 30px -10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              {/* Top-edge highlight — a 1px gradient line that gives the
               *  app chrome a "glass" feel. */}
              <div
                aria-hidden
                className="absolute top-0 left-0 right-0 pointer-events-none"
                style={{
                  height: 1,
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 100%)",
                }}
              />

              {/* App header — true builder chrome: macOS-style traffic
               *  lights, breadcrumb, device-size toggle, collaborators,
               *  status pill, and a refined Publish CTA. */}
              <div
                className="flex items-center shrink-0 relative"
                style={{
                  height: 48,
                  padding: "0 14px",
                  borderBottom: `1px solid ${HAIRLINE}`,
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(250,247,238,0.95) 100%)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                {/* Left cluster — traffic lights + wordmark + breadcrumb + AI badge */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-1.5 mr-1">
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: "#FF6259", border: "1px solid rgba(0,0,0,0.06)" }} />
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: "#FEBC2E", border: "1px solid rgba(0,0,0,0.06)" }} />
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: "#28C840", border: "1px solid rgba(0,0,0,0.06)" }} />
                  </div>
                  <div
                    aria-hidden
                    style={{
                      width: 1,
                      height: 18,
                      background: HAIRLINE_STRONG,
                    }}
                  />
                  <div className="flex items-center">
                    <Logo variant="wordmark" height={16} />
                  </div>
                  <div className="hidden md:flex items-center gap-1.5 ml-1 min-w-0">
                    <span className="text-[12px]" style={{ color: FAINT }}>/</span>
                    <span className="text-[12px]" style={{ color: MUTED }}>Pages</span>
                    <span className="text-[12px]" style={{ color: FAINT }}>/</span>
                    <span
                      className="text-[12.5px] truncate"
                      style={{
                        color: "rgba(26,24,21,0.92)",
                        fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                        fontWeight: 600,
                        letterSpacing: "-0.005em",
                      }}
                    >
                      Untitled page
                    </span>
                    <span
                      className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                      style={{
                        background: "rgba(75,71,229,0.10)",
                        border: `1px solid rgba(75,71,229,0.22)`,
                      }}
                    >
                      <span
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 999,
                          background: LIME,
                          boxShadow: `0 0 6px ${LIME}`,
                        }}
                      />
                      <span
                        className="text-[9.5px] uppercase"
                        style={{ color: LIME, letterSpacing: "0.18em", fontWeight: 600 }}
                      >
                        AI · Draft
                      </span>
                    </span>
                  </div>
                </div>

                {/* Center cluster — device-size toggle */}
                <div className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2 p-0.5 rounded-lg"
                  style={{
                    background: INK_4,
                    border: `1px solid ${HAIRLINE}`,
                  }}
                >
                  {[
                    { label: "Desktop", active: true, icon: (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/></svg>
                    ) },
                    { label: "Tablet", active: false, icon: (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/></svg>
                    ) },
                    { label: "Mobile", active: false, icon: (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>
                    ) },
                  ].map((t) => (
                    <div
                      key={t.label}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]"
                      style={{
                        background: t.active ? INK_2 : "transparent",
                        color: t.active ? TEXT : MUTED,
                        boxShadow: t.active ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                        fontWeight: t.active ? 600 : 500,
                        letterSpacing: "-0.005em",
                        fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                      }}
                    >
                      {t.icon}
                      <span className="hidden lg:inline">{t.label}</span>
                    </div>
                  ))}
                </div>

                {/* Right cluster — collaborators + status + publish */}
                <div className="flex items-center gap-3 ml-auto">
                  {/* Collaborators */}
                  <div className="hidden md:flex items-center">
                    {[
                      { initials: "JM", color: "linear-gradient(135deg,#F4A172 0%,#E37051 100%)" },
                      { initials: "AR", color: "linear-gradient(135deg,#6C68F0 0%,#4B47E5 100%)" },
                      { initials: "SK", color: "linear-gradient(135deg,#7BBE8B 0%,#3F8F5C 100%)" },
                    ].map((a, i) => (
                      <div
                        key={a.initials}
                        className="flex items-center justify-center text-[9.5px]"
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          background: a.color,
                          color: "#FFFFFF",
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          border: `1.5px solid ${INK_2}`,
                          marginLeft: i === 0 ? 0 : -6,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                          fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                        }}
                      >
                        {a.initials}
                      </div>
                    ))}
                    <button
                      className="flex items-center justify-center text-[12px] ml-1"
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: INK_2,
                        color: MUTED,
                        border: `1px dashed ${HAIRLINE_STRONG}`,
                        fontWeight: 500,
                      }}
                    >
                      +
                    </button>
                  </div>
                  {/* Divider */}
                  <div
                    aria-hidden
                    className="hidden md:block"
                    style={{ width: 1, height: 18, background: HAIRLINE_STRONG }}
                  />
                  {/* Status pill */}
                  <div
                    className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md"
                    style={{
                      background: published ? "rgba(75,71,229,0.10)" : INK_4,
                      border: `1px solid ${published ? "rgba(75,71,229,0.30)" : HAIRLINE}`,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: published || builderIn > 0.3 ? LIME : "rgba(26,24,21,0.4)",
                        boxShadow: published || builderIn > 0.3 ? `0 0 10px ${LIME}` : "none",
                        display: "inline-block",
                      }}
                    />
                    <span
                      className="text-[10.5px] uppercase"
                      style={{
                        letterSpacing: "0.2em",
                        color: published ? LIME : (builderIn > 0.3 ? "rgba(26,24,21,0.75)" : FAINT),
                        fontWeight: 600,
                      }}
                    >
                      {published ? "Live" : builderIn > 0.3 ? "Editing" : "Generating"}
                    </span>
                  </div>
                  <button
                    className="relative px-3.5 py-1.5 rounded-md text-[11.5px] inline-flex items-center gap-1.5 overflow-hidden"
                    style={{
                      background: published
                        ? `linear-gradient(180deg, #6C68F0 0%, ${LIME} 100%)`
                        : "linear-gradient(180deg, rgba(26,24,21,0.04) 0%, rgba(26,24,21,0.10) 100%)",
                      color: published ? "#FFFFFF" : TEXT,
                      border: `1px solid ${published ? LIME : HAIRLINE_STRONG}`,
                      fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                      fontWeight: 600,
                      letterSpacing: "-0.005em",
                      transform: `scale(${1 - publishClick * 0.05})`,
                      transition: "background 220ms ease, color 220ms ease, border-color 220ms ease, transform 120ms ease",
                      boxShadow: published
                        ? "0 6px 18px -4px rgba(75,71,229,0.55), inset 0 1px 0 rgba(255,255,255,0.35)"
                        : "inset 0 1px 0 rgba(255,255,255,0.5)",
                    }}
                  >
                    {published ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5L10 17.5L20 7.5"/></svg>
                        Published
                      </>
                    ) : (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
                        Publish
                      </>
                    )}
                    {publishClick > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 6,
                          border: `2px solid ${LIME}`,
                          transform: `scale(${1 + publishClick * 0.5})`,
                          opacity: 1 - publishClick,
                          pointerEvents: "none",
                        }}
                      />
                    )}
                    {published && (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%)",
                          backgroundSize: "200% 100%",
                          animation: "lpc-shimmer 2.6s linear infinite",
                          mixBlendMode: "overlay",
                        }}
                      />
                    )}
                  </button>
                </div>
              </div>

              {/* Body — sidebars + canvas */}
              <div className="flex-1 flex min-h-0 relative">
                {/* LEFT BUILDER PANEL — layer tree, hierarchical, with
                 *  search affordance and a + Block button at the top. The
                 *  on/off + selection state is still driven by visualsIn /
                 *  builderIn so the animation phasing is unchanged. */}
                <div
                  className="shrink-0 overflow-hidden"
                  style={{
                    width: isMobile ? 0 : lerp(0, 240, builderIn),
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(250,247,238,0.95) 100%)",
                    borderRight: builderIn > 0.05 ? `1px solid ${HAIRLINE}` : "none",
                    opacity: builderIn,
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                  }}
                >
                  <div className="w-[240px] flex flex-col h-full">
                    {/* Toolbar */}
                    <div className="flex items-center gap-1.5 px-3 pt-3 pb-2">
                      <div
                        className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]"
                        style={{
                          background: INK_2,
                          border: `1px solid ${HAIRLINE}`,
                          color: FAINT,
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="11" cy="11" r="7"/>
                          <path d="M21 21l-4.3-4.3"/>
                        </svg>
                        <span>Search blocks…</span>
                      </div>
                      <button
                        className="flex items-center justify-center"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          background: LIME,
                          color: "#FFFFFF",
                          boxShadow: "0 2px 6px -1px rgba(75,71,229,0.45), inset 0 1px 0 rgba(255,255,255,0.3)",
                        }}
                        aria-label="Add block"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 5v14M5 12h14"/>
                        </svg>
                      </button>
                    </div>

                    {/* Layer tree */}
                    <div className="px-2 py-2 flex-1 overflow-hidden">
                      <div
                        className="flex items-center justify-between px-2 mb-1.5"
                      >
                        <span
                          className="text-[10px] uppercase"
                          style={{ letterSpacing: "0.22em", color: FAINT, fontWeight: 600 }}
                        >
                          Layers
                        </span>
                        <span
                          className="text-[10px]"
                          style={{ color: FAINT }}
                        >
                          {[true, visualsIn > 0.4, visualsIn > 0.7].filter(Boolean).length}/3
                        </span>
                      </div>

                      {[
                        {
                          name: "Hero",
                          on: true,
                          sel: true,
                          children: [
                            { name: "Eyebrow", kind: "T" },
                            { name: "Headline", kind: "T" },
                            { name: "Subhead", kind: "T" },
                            { name: "Primary CTA", kind: "B" },
                            { name: "Secondary CTA", kind: "B" },
                          ],
                        },
                        { name: "Logo strip", on: visualsIn > 0.4, sel: false, kind: "G" },
                        { name: "Features", on: visualsIn > 0.7, sel: false, kind: "F" },
                      ].map((b, idx) => {
                        const isParent = "children" in b && Array.isArray((b as { children?: unknown }).children);
                        return (
                          <div key={b.name}>
                            <div
                              className="group flex items-center gap-1.5 pl-1 pr-2 py-1.5 rounded-md text-[12px] mb-0.5 relative"
                              style={{
                                background: b.sel ? "linear-gradient(180deg, rgba(75,71,229,0.10) 0%, rgba(75,71,229,0.05) 100%)" : "transparent",
                                color: b.sel ? LIME : b.on ? "rgba(26,24,21,0.85)" : FAINT,
                                fontWeight: b.sel ? 600 : 500,
                                fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                                letterSpacing: "-0.005em",
                                border: b.sel ? `1px solid rgba(75,71,229,0.22)` : "1px solid transparent",
                              }}
                            >
                              {/* Drag handle */}
                              <span
                                style={{
                                  display: "inline-flex",
                                  flexDirection: "column",
                                  gap: 1.5,
                                  paddingLeft: 2,
                                  paddingRight: 2,
                                  opacity: 0.45,
                                }}
                                aria-hidden
                              >
                                <span style={{ width: 2, height: 2, borderRadius: 999, background: "currentColor" }} />
                                <span style={{ width: 2, height: 2, borderRadius: 999, background: "currentColor" }} />
                                <span style={{ width: 2, height: 2, borderRadius: 999, background: "currentColor" }} />
                              </span>
                              {/* Disclosure caret */}
                              <span
                                style={{
                                  display: "inline-flex",
                                  width: 10,
                                  color: FAINT,
                                  fontSize: 8,
                                  transform: isParent && b.sel ? "rotate(90deg)" : "rotate(0deg)",
                                  transition: "transform 200ms ease",
                                }}
                              >
                                {isParent ? "▶" : ""}
                              </span>
                              {/* Block-type icon */}
                              <span
                                style={{
                                  width: 14,
                                  height: 14,
                                  borderRadius: 3,
                                  background: b.on
                                    ? b.sel
                                      ? `linear-gradient(135deg, ${LIME} 0%, #6C68F0 100%)`
                                      : "rgba(26,24,21,0.55)"
                                    : "rgba(26,24,21,0.08)",
                                  border: b.on ? "none" : `1px solid ${HAIRLINE_STRONG}`,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: b.on ? "#FFFFFF" : FAINT,
                                  fontSize: 8,
                                  fontWeight: 700,
                                  boxShadow: b.on && b.sel ? `0 0 0 2px rgba(75,71,229,0.18)` : "none",
                                }}
                              >
                                {b.on ? (isParent ? "H" : ("kind" in b ? (b as { kind?: string }).kind : "·")) : ""}
                              </span>
                              <span className="flex-1 truncate">{b.name}</span>
                              {/* Eye toggle */}
                              {b.on && (
                                <span style={{ color: b.sel ? LIME : FAINT, opacity: 0.7 }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                                    <circle cx="12" cy="12" r="2.6"/>
                                  </svg>
                                </span>
                              )}
                              {/* Generating shimmer when a block is just appearing */}
                              {!b.on && idx > 0 && (
                                <span
                                  className="ml-auto inline-flex items-center gap-1 text-[9.5px] uppercase"
                                  style={{ color: FAINT, letterSpacing: "0.16em" }}
                                >
                                  <span
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: 999,
                                      background: FAINT,
                                      animation: "lpc-blink 1.2s steps(2,end) infinite",
                                    }}
                                  />
                                </span>
                              )}
                            </div>
                            {/* Children */}
                            {isParent && b.sel && (
                              <div className="ml-6 mb-1">
                                {(b as { children: { name: string; kind: string }[] }).children.map((c) => (
                                  <div
                                    key={c.name}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px]"
                                    style={{
                                      color: "rgba(26,24,21,0.65)",
                                      fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                                    }}
                                  >
                                    <span style={{ width: 1, height: 12, background: HAIRLINE_STRONG, marginLeft: -8, marginRight: 4 }} />
                                    <span
                                      style={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: 2,
                                        background: "rgba(26,24,21,0.06)",
                                        border: `1px solid ${HAIRLINE_STRONG}`,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 8,
                                        fontWeight: 700,
                                        color: MUTED,
                                      }}
                                    >
                                      {c.kind}
                                    </span>
                                    <span className="truncate">{c.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div
                        className="flex items-center justify-between mt-4 mb-1.5 px-2"
                      >
                        <span
                          className="text-[10px] uppercase"
                          style={{ letterSpacing: "0.22em", color: FAINT, fontWeight: 600 }}
                        >
                          From library
                        </span>
                      </div>
                      {[
                        { name: "Pricing", kind: "P" },
                        { name: "Testimonials", kind: "Q" },
                        { name: "FAQ", kind: "?" },
                        { name: "Footer", kind: "F" },
                      ].map((n) => (
                        <div
                          key={n.name}
                          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11.5px]"
                          style={{
                            color: "rgba(26,24,21,0.55)",
                            fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                          }}
                        >
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              border: `1px dashed ${HAIRLINE_STRONG}`,
                              borderRadius: 2,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 8,
                              fontWeight: 700,
                              color: FAINT,
                            }}
                          >
                            {n.kind}
                          </span>
                          <span>{n.name}</span>
                          <span className="ml-auto" style={{ color: FAINT, fontSize: 13 }}>+</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* CENTER CANVAS — wraps the mock page; this is the cursor coordinate space */}
                <div
                  className="flex-1 min-w-0 relative overflow-hidden"
                  style={{ background: INK_2 }}
                >
                  {/* Floating status pill — sits over the canvas in the
                   *  bottom-right corner during the active phases. Reads as
                   *  the "system" status, distinct from the cursor's local
                   *  label, so the viewer always knows what's happening. */}
                  {(() => {
                    let text = "";
                    let phase = 0;
                    if (typing !== "none") {
                      const phaseMap: Record<TypingTarget, [string, number]> = {
                        eyebrow:  ["Composing eyebrow", 1],
                        l1:       ["Drafting headline · matching brand voice", 2],
                        l2:       ["Drafting headline · matching brand voice", 2],
                        subtitle: ["Writing subhead · pulling proof from library", 3],
                        none:     ["", 0],
                      };
                      [text, phase] = phaseMap[typing];
                    } else if (visualsIn > 0 && visualsIn < 1) {
                      text = "Streaming in logo strip, stats, and testimonial";
                      phase = 4;
                    } else if (builderIn > 0 && builderIn < 1) {
                      text = "Opening builder for refinement";
                      phase = 5;
                    } else if (swatchClickWindow > 0 && swatchClickWindow < 1) {
                      text = "Applying brand-matched accent color";
                      phase = 6;
                    } else if (publishClickWindow > 0 && publishClickWindow < 1 && !published) {
                      text = "Publishing to a live URL";
                      phase = 7;
                    } else if (published) {
                      text = "Page is live · brand voice locked, variants tracking";
                      phase = 8;
                    }
                    if (!text) return null;
                    const isFinal = published;
                    return (
                      <div
                        className="absolute z-30 inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                        style={{
                          right: 12,
                          bottom: 12,
                          background: isFinal
                            ? `linear-gradient(180deg, #6C68F0 0%, ${LIME} 100%)`
                            : "rgba(255,255,255,0.95)",
                          color: isFinal ? "#FFFFFF" : TEXT,
                          border: `1px solid ${isFinal ? "rgba(75,71,229,0.5)" : HAIRLINE_STRONG}`,
                          backdropFilter: "blur(10px)",
                          WebkitBackdropFilter: "blur(10px)",
                          fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                          fontSize: 11.5,
                          fontWeight: 600,
                          letterSpacing: "-0.005em",
                          boxShadow: isFinal
                            ? "0 8px 22px -6px rgba(75,71,229,0.5), inset 0 1px 0 rgba(255,255,255,0.35)"
                            : "0 6px 18px -4px rgba(26,24,21,0.18), inset 0 1px 0 rgba(255,255,255,0.6)",
                        }}
                      >
                        <span
                          style={{ position: "relative", display: "inline-flex", width: 12, height: 12 }}
                        >
                          {!isFinal ? (
                            <>
                              <span
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  borderRadius: 999,
                                  border: `1.5px solid ${LIME}`,
                                  borderTopColor: "transparent",
                                  animation: "lpc-spin-slow 1.1s linear infinite",
                                }}
                              />
                              <span
                                style={{
                                  position: "absolute",
                                  left: "50%",
                                  top: "50%",
                                  width: 4,
                                  height: 4,
                                  borderRadius: 999,
                                  background: LIME,
                                  transform: "translate(-50%,-50%)",
                                  boxShadow: `0 0 6px ${LIME}`,
                                }}
                              />
                            </>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 12.5L10 17.5L20 7.5"/>
                            </svg>
                          )}
                        </span>
                        <span>{text}</span>
                        <span
                          className="text-[10px] uppercase ml-1 px-1.5 py-0.5 rounded-full"
                          style={{
                            background: isFinal ? "rgba(255,255,255,0.18)" : "rgba(26,24,21,0.06)",
                            color: isFinal ? "rgba(255,255,255,0.95)" : MUTED,
                            letterSpacing: "0.18em",
                            fontWeight: 700,
                          }}
                        >
                          {String(phase).padStart(2, "0")}/08
                        </span>
                      </div>
                    );
                  })()}
                  {/* scaled canvas: design at 960px wide */}
                  <CanvasScaled
                    designWidth={CANVAS_W}
                    cursorX={cursorPos.x}
                    cursorY={cursorPos.y}
                    cursorVisible={cursorVisible}
                    cursorClickAmount={cursorClickAmount}
                    cursorLabel={
                      typing !== "none"
                        ? "AI · writing"
                        : (swatchClickWindow > 0 && swatchClickWindow < 1)
                          ? "Editing"
                          : (publishClickWindow > 0 && publishClickWindow < 1 && !published)
                            ? "Publishing"
                            : null
                    }
                  >
                    <MockPage
                      ctaColor={ctaColor}
                      ctaLabel={ctaLabel}
                      eyebrow={eyebrow}
                      headlineL1={headlineL1}
                      headlineL2={headlineL2}
                      subtitle={subtitle}
                      typing={typing}
                      primaryClick={primaryClick}
                      visualsIn={visualsIn}
                      showSelection={builderIn > 0.5}
                    />
                  </CanvasScaled>
                </div>

                {/* RIGHT BUILDER PANEL — Style / Content / Logic tabs, AI
                 *  suggestion badges, and richer property controls (slider,
                 *  segmented selects, toggle pill). */}
                <div
                  className="shrink-0 overflow-hidden"
                  style={{
                    width: isMobile ? 0 : lerp(0, 280, builderIn),
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(250,247,238,0.95) 100%)",
                    borderLeft: builderIn > 0.05 ? `1px solid ${HAIRLINE}` : "none",
                    opacity: builderIn,
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                  }}
                >
                  <div className="w-[280px] flex flex-col h-full">
                    {/* Selected block header */}
                    <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2.5">
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 5,
                          background: `linear-gradient(135deg, ${LIME} 0%, #6C68F0 100%)`,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#FFFFFF",
                          fontSize: 10,
                          fontWeight: 700,
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                        }}
                      >
                        H
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[12.5px] truncate"
                          style={{
                            color: TEXT,
                            fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                            fontWeight: 600,
                            letterSpacing: "-0.005em",
                          }}
                        >
                          Hero
                        </div>
                        <div className="text-[10.5px]" style={{ color: FAINT, letterSpacing: "0.02em" }}>
                          Block · Selected
                        </div>
                      </div>
                      <button
                        className="flex items-center justify-center"
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 5,
                          background: INK_2,
                          color: MUTED,
                          border: `1px solid ${HAIRLINE}`,
                        }}
                        aria-label="More"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
                        </svg>
                      </button>
                    </div>

                    {/* Tabs */}
                    <div className="px-3.5 pb-2">
                      <div className="flex items-center gap-0 p-0.5 rounded-md" style={{ background: INK_4, border: `1px solid ${HAIRLINE}` }}>
                        {[
                          { label: "Style", active: true },
                          { label: "Content", active: false },
                          { label: "Logic", active: false },
                        ].map((t) => (
                          <div
                            key={t.label}
                            className="flex-1 text-center py-1 rounded-[5px] text-[11px]"
                            style={{
                              background: t.active ? INK_2 : "transparent",
                              color: t.active ? TEXT : MUTED,
                              boxShadow: t.active ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                              fontWeight: t.active ? 600 : 500,
                              letterSpacing: "-0.005em",
                              fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                            }}
                          >
                            {t.label}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Property fields */}
                    <div className="px-3.5 pb-4 overflow-hidden">
                      {/* CTA color */}
                      <div className="flex items-center justify-between mb-1.5 mt-2">
                        <span className="text-[10px] uppercase" style={{ color: MUTED, letterSpacing: "0.18em", fontWeight: 600 }}>
                          CTA color
                        </span>
                        {swatchClicked && (
                          <span
                            className="inline-flex items-center gap-1 text-[9px] uppercase px-1.5 py-0.5 rounded-full"
                            style={{
                              background: "rgba(75,71,229,0.10)",
                              border: `1px solid rgba(75,71,229,0.24)`,
                              color: LIME,
                              letterSpacing: "0.16em",
                              fontWeight: 600,
                            }}
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M12 2l1.8 4.6 4.7 1.4-4.7 1.4L12 14l-1.8-4.6L5.5 8l4.7-1.4L12 2z" />
                            </svg>
                            AI · brand match
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mb-3">
                        {[TEXT, LIME, "#5fa9ff", "#ff8e6e", "#1A1815"].map((c) => {
                          const isLime = c === LIME;
                          const isSelected = swatchClicked ? isLime : c === TEXT;
                          return (
                            <div
                              key={c}
                              className="relative"
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 7,
                                background: c,
                                border: `1.5px solid ${isSelected ? LIME : "rgba(26,24,21,0.14)"}`,
                                boxShadow: isSelected
                                  ? `0 0 0 2px rgba(75,71,229,0.32), inset 0 1px 0 rgba(255,255,255,0.18)`
                                  : "inset 0 1px 0 rgba(255,255,255,0.18)",
                                transform: isLime && swatchClick > 0 ? `scale(${1 - swatchClick * 0.1})` : "none",
                                transition: "transform 80ms ease",
                              }}
                            >
                              {isSelected && (
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#FFFFFF"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{
                                    position: "absolute",
                                    top: "50%",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)",
                                    filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
                                  }}
                                  aria-hidden
                                >
                                  <path d="M5 12.5L10 17.5L20 7.5"/>
                                </svg>
                              )}
                              {isLime && swatchClick > 0 && (
                                <span
                                  style={{
                                    position: "absolute",
                                    inset: -3,
                                    borderRadius: 10,
                                    border: `2px solid ${LIME}`,
                                    transform: `scale(${1 + swatchClick * 0.6})`,
                                    opacity: 1 - swatchClick,
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                        <button
                          className="flex items-center justify-center"
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 7,
                            background: INK_2,
                            border: `1px dashed ${HAIRLINE_STRONG}`,
                            color: FAINT,
                          }}
                          aria-label="Custom color"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 5v14M5 12h14"/>
                          </svg>
                        </button>
                      </div>

                      {/* CTA label */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase" style={{ color: MUTED, letterSpacing: "0.18em", fontWeight: 600 }}>
                          CTA label
                        </span>
                        {ctaLabel === "Try it free" && (
                          <span
                            className="inline-flex items-center gap-1 text-[9px] uppercase px-1.5 py-0.5 rounded-full"
                            style={{
                              background: "rgba(75,71,229,0.10)",
                              border: `1px solid rgba(75,71,229,0.24)`,
                              color: LIME,
                              letterSpacing: "0.16em",
                              fontWeight: 600,
                            }}
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M12 2l1.8 4.6 4.7 1.4-4.7 1.4L12 14l-1.8-4.6L5.5 8l4.7-1.4L12 2z" />
                            </svg>
                            AI · variant
                          </span>
                        )}
                      </div>
                      <div
                        className="px-2.5 py-2 rounded-md text-[12px] mb-3 flex items-center justify-between"
                        style={{
                          background: INK_2,
                          color: TEXT,
                          border: `1px solid ${HAIRLINE_STRONG}`,
                          fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
                        }}
                      >
                        <span>{ctaLabel}</span>
                        <span
                          style={{
                            display: "inline-block",
                            width: 1.5,
                            height: 12,
                            background: LIME,
                            animation: "lpc-blink 0.9s steps(2,end) infinite",
                          }}
                        />
                      </div>

                      {/* Padding slider */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase" style={{ color: MUTED, letterSpacing: "0.18em", fontWeight: 600 }}>
                          Padding
                        </span>
                        <span className="text-[10.5px]" style={{ color: FAINT, fontVariantNumeric: "tabular-nums" }}>
                          96 px
                        </span>
                      </div>
                      <div className="relative mb-3" style={{ height: 18 }}>
                        <div
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: 0,
                            right: 0,
                            height: 4,
                            borderRadius: 2,
                            background: INK_4,
                            border: `1px solid ${HAIRLINE}`,
                            transform: "translateY(-50%)",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: 0,
                            width: "62%",
                            height: 4,
                            borderRadius: 2,
                            background: `linear-gradient(90deg, ${LIME} 0%, #6C68F0 100%)`,
                            transform: "translateY(-50%)",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: "62%",
                            width: 14,
                            height: 14,
                            borderRadius: 999,
                            background: "#FFFFFF",
                            border: `1.5px solid ${LIME}`,
                            transform: "translate(-50%, -50%)",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                          }}
                        />
                      </div>

                      {/* Audience */}
                      <div className="text-[10px] uppercase mb-1.5" style={{ color: MUTED, letterSpacing: "0.18em", fontWeight: 600 }}>
                        Audience
                      </div>
                      <div
                        className="px-2.5 py-2 rounded-md text-[12px] mb-3 flex items-center justify-between"
                        style={{
                          background: INK_2,
                          color: TEXT,
                          border: `1px solid ${HAIRLINE_STRONG}`,
                          fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              background: LIME,
                              boxShadow: `0 0 6px ${LIME}`,
                            }}
                          />
                          <span>Revenue teams</span>
                        </div>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: FAINT }} aria-hidden="true">
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </div>

                      {/* A/B variants */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase" style={{ color: MUTED, letterSpacing: "0.18em", fontWeight: 600 }}>
                          A/B variant
                        </span>
                        <span className="text-[9.5px] uppercase" style={{ color: LIME, letterSpacing: "0.16em", fontWeight: 600 }}>
                          + 1 winning
                        </span>
                      </div>
                      <div
                        className="rounded-md text-[12px] flex items-center gap-2 px-2.5 py-2"
                        style={{
                          background: INK_2,
                          color: TEXT,
                          border: `1px solid ${HAIRLINE_STRONG}`,
                          fontFamily: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
                        }}
                      >
                        <div className="flex items-center gap-1 flex-1">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              background: "rgba(75,71,229,0.10)",
                              color: LIME,
                              fontWeight: 600,
                              border: `1px solid rgba(75,71,229,0.20)`,
                            }}
                          >
                            A
                          </span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              background: INK_4,
                              color: MUTED,
                              fontWeight: 600,
                              border: `1px solid ${HAIRLINE}`,
                            }}
                          >
                            B
                          </span>
                          <span className="ml-1 text-[11px]" style={{ color: MUTED }}>2 active</span>
                        </div>
                        <button
                          className="flex items-center justify-center"
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 5,
                            background: INK_4,
                            border: `1px solid ${HAIRLINE}`,
                            color: LIME,
                          }}
                          aria-label="Add variant"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 5v14M5 12h14"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Caption above frame describing what's happening */}
            <PhaseLabel progress={progress} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* Scales the design (CANVAS_W) into whatever the parent gives, and renders an animated cursor at design coordinates. */
function CanvasScaled({
  designWidth,
  children,
  cursorX,
  cursorY,
  cursorVisible,
  cursorClickAmount,
  cursorLabel,
}: {
  designWidth: number;
  children: React.ReactNode;
  cursorX: number;
  cursorY: number;
  cursorVisible: number;
  cursorClickAmount: number;
  cursorLabel?: string | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setScale(Math.max(0.4, Math.min(1.4, w / designWidth)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [designWidth]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: designWidth,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
          height: `${100 / scale}%`,
        }}
      >
        {children}
        <Cursor
          x={cursorX}
          y={cursorY}
          visible={cursorVisible}
          clicking={cursorClickAmount}
          label={cursorLabel}
        />
      </div>
    </div>
  );
}

function PhaseLabel({ progress }: { progress: number }) {
  // Each step has a label + a one-line sub-caption so the strip reads as a
  // narrated walkthrough rather than just chapter numbers.
  const labels: { at: number; n: string; text: string; sub: string }[] = [
    { at: 0.06, n: "01", text: "Open a blank canvas",       sub: "Brief in plain English — no template wrangling" },
    { at: 0.10, n: "02", text: "Brief the page",            sub: "Type the audience and angle; the AI takes the rest" },
    { at: 0.30, n: "03", text: "Page composes itself",      sub: "On-brand copy, layout, and imagery in under a minute" },
    { at: 0.45, n: "04", text: "Convert with one CTA",      sub: "Primary action, secondary, social proof — already wired" },
    { at: 0.62, n: "05", text: "Open the builder to refine", sub: "Layer tree, inspector, live preview — same screen" },
    { at: 0.78, n: "06", text: "Tweak any property, live",  sub: "Brand-aware suggestions next to every field" },
    { at: 0.92, n: "07", text: "Publish",                   sub: "Variants live in seconds with attribution attached" },
  ];
  const activeIdx = (() => {
    for (let i = labels.length - 1; i >= 0; i--) if (progress >= labels[i].at) return i;
    return 0;
  })();
  const active = labels[activeIdx];
  const opacity = range(progress, 0.04, 0.10);
  return (
    <div
      className="absolute -top-16 left-0 right-0"
      style={{ opacity }}
    >
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] uppercase mb-1.5 flex items-center gap-2 flex-wrap"
            style={{ letterSpacing: "0.26em", fontWeight: 700 }}
          >
            <span style={{ color: LIME }}>{active.n}</span>
            <span style={{ color: FAINT }}>·</span>
            <span style={{ color: TEXT }}>{active.text}</span>
          </div>
          <div
            className="text-[12.5px] truncate"
            style={{ color: MUTED, letterSpacing: "-0.005em" }}
          >
            {active.sub}
          </div>
        </div>

        {/* Step indicator dots */}
        <div className="flex items-center gap-1.5 shrink-0">
          {labels.map((l, i) => {
            const isActive = i === activeIdx;
            const isPast = i < activeIdx;
            return (
              <div
                key={l.n}
                className="flex items-center"
                style={{
                  gap: 4,
                  opacity: isActive ? 1 : isPast ? 0.7 : 0.3,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: isActive ? 20 : 6,
                    height: 6,
                    borderRadius: 999,
                    background: isActive
                      ? `linear-gradient(90deg, ${LIME} 0%, #6C68F0 100%)`
                      : isPast
                        ? "rgba(26,24,21,0.55)"
                        : "rgba(26,24,21,0.20)",
                    boxShadow: isActive ? `0 0 10px rgba(75,71,229,0.45)` : "none",
                    transition: "width 240ms ease, background 200ms ease",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
