import { useEffect, useRef, useState } from "react";

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
}: {
  x: number;
  y: number;
  visible: number;
  clicking: number;
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
      {/* click ripple */}
      {clicking > 0 && (
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
      )}
      <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
        <path
          d="M2 2 L2 16 L6 12.5 L8.5 18.5 L11 17.5 L8.5 11.5 L14 11 Z"
          fill={TEXT}
          stroke={INK}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
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

  return (
    <div className="relative h-full w-full" style={{ background: INK_2 }}>
      {/* hero section */}
      <div
        className="relative px-12 pt-14 pb-10"
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
              border: `1px solid ${LIME}`,
              borderRadius: 8,
              boxShadow: `0 0 0 4px rgba(75,71,229,0.08)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -22,
                left: -1,
                background: LIME,
                color: INK,
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "2px 6px",
                borderRadius: 3,
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
                  width: 7,
                  height: 7,
                  background: LIME,
                  border: `1.5px solid ${INK}`,
                  borderRadius: 1,
                  ...p,
                }}
              />
            ))}
          </div>
        )}

        {/* eyebrow */}
        <div
          className="text-[11px] uppercase mb-5"
          style={{
            letterSpacing: "0.22em",
            color: FAINT,
            minHeight: "1em",
          }}
        >
          {eyebrow}
          {typing === "eyebrow" && <Caret />}
        </div>

        {/* headline */}
        <h2
          style={{
            fontFamily: "'Fraunces', 'Iowan Old Style', Georgia, serif",
            fontWeight: 600,
            letterSpacing: "-0.04em",
            fontSize: 52,
            lineHeight: 1.02,
            color: TEXT,
            maxWidth: 720,
            minHeight: "2.04em",
          }}
        >
          {renderL1(headlineL1)}
          {typing === "l1" && <Caret />}
          {(headlineL2.length > 0 || typing === "l2") && <br />}
          {headlineL2}
          {typing === "l2" && <Caret />}
        </h2>

        {/* subtitle */}
        <p
          className="mt-5 text-[16px]"
          style={{
            color: MUTED,
            lineHeight: 1.55,
            maxWidth: 560,
            minHeight: "3.1em",
          }}
        >
          {subtitle}
          {typing === "subtitle" && <Caret />}
        </p>

        {/* CTAs */}
        <div className="mt-8 flex items-center gap-3">
          <button
            className="relative px-5 py-2.5 rounded-full text-[13.5px] font-medium"
            style={{
              background: ctaColor,
              color: INK,
              fontFamily: "'Fraunces', 'Iowan Old Style', Georgia, serif",
              letterSpacing: "-0.005em",
              transform: `scale(${1 - primaryClick * 0.05})`,
              transition: "background 220ms ease",
            }}
          >
            {ctaLabel}
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
          </button>
          <button
            className="px-4 py-2.5 rounded-full text-[13.5px]"
            style={{
              color: TEXT,
              border: `1px solid ${HAIRLINE_STRONG}`,
              background: "transparent",
              fontFamily: "'Fraunces', 'Iowan Old Style', Georgia, serif",
            }}
          >
            See a live page →
          </button>
        </div>
      </div>

      {/* below-the-fold — fades in after CTA click */}
      <div
        className="px-12 py-9"
        style={{ opacity: easeOut(visualsIn) }}
      >
        {/* logo strip */}
        <div
          className="text-[10px] uppercase mb-4"
          style={{ letterSpacing: "0.22em", color: FAINT }}
        >
          Trusted by 1,200+ revenue teams
        </div>
        <div
          className="flex items-center justify-between pb-7"
          style={{ borderBottom: `1px solid ${HAIRLINE}` }}
        >
          {["NORTHWIND", "ACME", "GLOBEX", "INITECH", "UMBRELLA", "VANDELAY"].map((n) => (
            <div
              key={n}
              className="text-[11px]"
              style={{
                color: "rgba(26,24,21,0.55)",
                letterSpacing: "0.18em",
                fontWeight: 500,
              }}
            >
              {n}
            </div>
          ))}
        </div>

        {/* feature row */}
        <div className="grid grid-cols-3 gap-8 pt-9">
          {[
            { num: "01", title: "Generated", body: "Pages composed from a brief in under a minute." },
            { num: "02", title: "On-brand", body: "Locked tokens and approved blocks — never off." },
            { num: "03", title: "Measured", body: "Variants, attribution, and learnings, built-in." },
          ].map((f) => (
            <div key={f.num}>
              <div
                className="text-[11px] mb-3"
                style={{
                  color: LIME,
                  letterSpacing: "0.18em",
                  fontFamily: "'Fraunces', 'Iowan Old Style', Georgia, serif",
                  fontWeight: 600,
                }}
              >
                {f.num}
              </div>
              <div
                className="text-[16px] mb-1.5"
                style={{
                  color: TEXT,
                  fontFamily: "'Fraunces', 'Iowan Old Style', Georgia, serif",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                }}
              >
                {f.title}
              </div>
              <div className="text-[13px]" style={{ color: MUTED, lineHeight: 1.55 }}>
                {f.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AssembleScene() {
  const { ref, progress, vw } = useScrollProgress<HTMLDivElement>();
  const isMobile = vw < 768;

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
      <style>{`@keyframes lpc-blink { 50% { opacity: 0; } }`}</style>

      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* very subtle baseline grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(26,24,21,0.04) 1px, transparent 1px)",
            backgroundSize: "100% 96px",
            opacity: 0.5,
          }}
        />

        {/* INTRO overlay */}
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center px-6 text-center"
          style={{
            opacity: 1 - introOut,
            transform: `translateY(${introOut * -20}px)`,
            pointerEvents: introOut > 0.5 ? "none" : "auto",
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
              fontFamily: "'Fraunces', 'Iowan Old Style', Georgia, serif",
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
            <span style={{ color: LIME }}>assembled</span> in real time.
          </h1>
          <p
            className="mt-7 max-w-lg"
            style={{ color: MUTED, fontSize: 17, lineHeight: 1.55 }}
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
            {/* App frame */}
            <div
              className="relative w-full h-full rounded-2xl overflow-hidden flex flex-col"
              style={{
                background: INK_2,
                border: `1px solid ${HAIRLINE_STRONG}`,
                boxShadow:
                  "0 50px 140px -20px rgba(0,0,0,0.7), 0 8px 30px -10px rgba(0,0,0,0.5)",
              }}
            >
              {/* App header */}
              <div
                className="flex items-center justify-between shrink-0"
                style={{
                  height: 44,
                  padding: "0 16px",
                  borderBottom: `1px solid ${HAIRLINE}`,
                  background: INK_3,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      background: LIME,
                    }}
                  />
                  <div
                    className="text-[12.5px]"
                    style={{
                      color: "rgba(26,24,21,0.85)",
                      fontFamily: "'Fraunces', 'Iowan Old Style', Georgia, serif",
                      fontWeight: 500,
                    }}
                  >
                    Untitled page
                  </div>
                  <div
                    className="text-[10px] uppercase ml-2 px-1.5 py-0.5 rounded"
                    style={{
                      color: FAINT,
                      letterSpacing: "0.18em",
                      background: "rgba(26,24,21,0.05)",
                    }}
                  >
                    Draft
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="text-[10.5px] uppercase flex items-center gap-1.5"
                    style={{ letterSpacing: "0.2em", color: FAINT }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: published ? LIME : (builderIn > 0.3 ? LIME : "rgba(26,24,21,0.4)"),
                        boxShadow: published || builderIn > 0.3 ? `0 0 8px ${LIME}` : "none",
                        display: "inline-block",
                      }}
                    />
                    <span style={{ color: published || builderIn > 0.3 ? "rgba(26,24,21,0.75)" : FAINT }}>
                      {published ? "Live" : builderIn > 0.3 ? "Editing" : "Building"}
                    </span>
                  </div>
                  <button
                    className="relative px-3.5 py-1.5 rounded-md text-[11.5px]"
                    style={{
                      background: published ? LIME : "rgba(26,24,21,0.08)",
                      color: published ? INK : TEXT,
                      border: `1px solid ${published ? LIME : HAIRLINE_STRONG}`,
                      fontFamily: "'Fraunces', 'Iowan Old Style', Georgia, serif",
                      fontWeight: 600,
                      letterSpacing: "-0.005em",
                      transform: `scale(${1 - publishClick * 0.05})`,
                      transition: "background 200ms ease, color 200ms ease, border-color 200ms ease",
                    }}
                  >
                    {published ? "Live ✓" : "Publish"}
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
                  </button>
                </div>
              </div>

              {/* Body — sidebars + canvas */}
              <div className="flex-1 flex min-h-0 relative">
                {/* LEFT BUILDER PANEL */}
                <div
                  className="shrink-0 overflow-hidden"
                  style={{
                    width: isMobile ? 0 : lerp(0, 220, builderIn),
                    background: INK_3,
                    borderRight: builderIn > 0.05 ? `1px solid ${HAIRLINE}` : "none",
                    opacity: builderIn,
                  }}
                >
                  <div className="p-4 w-[220px]">
                    <div
                      className="text-[10px] uppercase mb-3"
                      style={{ letterSpacing: "0.22em", color: FAINT }}
                    >
                      Blocks on page
                    </div>
                    {[
                      { name: "Hero", on: true, sel: true },
                      { name: "Logo strip", on: visualsIn > 0.4 },
                      { name: "Features", on: visualsIn > 0.7 },
                    ].map((b) => (
                      <div
                        key={b.name}
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-[12px] mb-0.5"
                        style={{
                          background: b.sel ? "rgba(75,71,229,0.10)" : "transparent",
                          color: b.sel ? LIME : b.on ? "rgba(26,24,21,0.75)" : FAINT,
                          fontWeight: b.sel ? 600 : 500,
                          fontFamily: "'Fraunces', 'Iowan Old Style', Georgia, serif",
                          letterSpacing: "-0.005em",
                        }}
                      >
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            background: b.on ? (b.sel ? LIME : "rgba(26,24,21,0.7)") : "rgba(26,24,21,0.08)",
                            border: b.on ? "none" : `1px solid ${HAIRLINE_STRONG}`,
                          }}
                        />
                        {b.name}
                      </div>
                    ))}
                    <div
                      className="text-[10px] uppercase mt-5 mb-2"
                      style={{ letterSpacing: "0.22em", color: FAINT }}
                    >
                      Library
                    </div>
                    {["Pricing", "Testimonials", "FAQ", "Footer"].map((n) => (
                      <div
                        key={n}
                        className="flex items-center gap-2 px-2 py-1 text-[11.5px]"
                        style={{
                          color: "rgba(26,24,21,0.45)",
                          fontFamily: "'Fraunces', 'Iowan Old Style', Georgia, serif",
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            border: `1px solid ${HAIRLINE_STRONG}`,
                            borderRadius: 2,
                          }}
                        />
                        {n}
                      </div>
                    ))}
                  </div>
                </div>

                {/* CENTER CANVAS — wraps the mock page; this is the cursor coordinate space */}
                <div
                  className="flex-1 min-w-0 relative overflow-hidden"
                  style={{ background: INK_2 }}
                >
                  {/* scaled canvas: design at 960px wide */}
                  <CanvasScaled
                    designWidth={CANVAS_W}
                    cursorX={cursorPos.x}
                    cursorY={cursorPos.y}
                    cursorVisible={cursorVisible}
                    cursorClickAmount={cursorClickAmount}
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

                {/* RIGHT BUILDER PANEL */}
                <div
                  className="shrink-0 overflow-hidden"
                  style={{
                    width: isMobile ? 0 : lerp(0, 260, builderIn),
                    background: INK_3,
                    borderLeft: builderIn > 0.05 ? `1px solid ${HAIRLINE}` : "none",
                    opacity: builderIn,
                  }}
                >
                  <div className="p-4 w-[260px]">
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="text-[10px] uppercase"
                        style={{ letterSpacing: "0.22em", color: FAINT }}
                      >
                        Hero properties
                      </div>
                      <div
                        className="text-[9px] uppercase px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(75,71,229,0.14)", color: LIME, letterSpacing: "0.16em" }}
                      >
                        Live
                      </div>
                    </div>

                    <div
                      className="text-[10px] uppercase mb-1.5"
                      style={{ color: FAINT, letterSpacing: "0.18em" }}
                    >
                      CTA color
                    </div>
                    <div className="flex items-center gap-1.5 mb-4">
                      {[TEXT, LIME, "#5fa9ff", "#ff8e6e"].map((c, i) => {
                        const isLime = c === LIME;
                        const isSelected = swatchClicked ? isLime : c === TEXT;
                        return (
                          <div
                            key={c}
                            className="relative"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              background: c,
                              border: `1.5px solid ${isSelected ? LIME : "rgba(26,24,21,0.14)"}`,
                              boxShadow: isSelected ? `0 0 0 2px rgba(75,71,229,0.32)` : "none",
                              transform: isLime && swatchClick > 0 ? `scale(${1 - swatchClick * 0.1})` : "none",
                            }}
                          >
                            {isLime && swatchClick > 0 && (
                              <span
                                style={{
                                  position: "absolute",
                                  inset: -2,
                                  borderRadius: 8,
                                  border: `2px solid ${LIME}`,
                                  transform: `scale(${1 + swatchClick * 0.6})`,
                                  opacity: 1 - swatchClick,
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div
                      className="text-[10px] uppercase mb-1.5"
                      style={{ color: FAINT, letterSpacing: "0.18em" }}
                    >
                      CTA label
                    </div>
                    <div
                      className="px-2.5 py-1.5 rounded text-[12px] mb-4"
                      style={{
                        background: "rgba(26,24,21,0.05)",
                        color: TEXT,
                        border: `1px solid ${HAIRLINE_STRONG}`,
                        fontFamily: "'Fraunces', 'Iowan Old Style', Georgia, serif",
                      }}
                    >
                      {ctaLabel}
                    </div>

                    <div
                      className="text-[10px] uppercase mb-1.5"
                      style={{ color: FAINT, letterSpacing: "0.18em" }}
                    >
                      Audience
                    </div>
                    <div
                      className="px-2.5 py-1.5 rounded text-[12px] mb-4 flex items-center justify-between"
                      style={{
                        background: "rgba(26,24,21,0.05)",
                        color: TEXT,
                        border: `1px solid ${HAIRLINE_STRONG}`,
                        fontFamily: "'Fraunces', 'Iowan Old Style', Georgia, serif",
                      }}
                    >
                      <span>Revenue teams</span>
                      <span style={{ color: FAINT }}>▾</span>
                    </div>

                    <div
                      className="text-[10px] uppercase mb-1.5"
                      style={{ color: FAINT, letterSpacing: "0.18em" }}
                    >
                      A/B variant
                    </div>
                    <div
                      className="px-2.5 py-1.5 rounded text-[12px] flex items-center justify-between"
                      style={{
                        background: "rgba(26,24,21,0.05)",
                        color: TEXT,
                        border: `1px solid ${HAIRLINE_STRONG}`,
                        fontFamily: "'Fraunces', 'Iowan Old Style', Georgia, serif",
                      }}
                    >
                      <span>2 active</span>
                      <span style={{ color: LIME }}>+</span>
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
}: {
  designWidth: number;
  children: React.ReactNode;
  cursorX: number;
  cursorY: number;
  cursorVisible: number;
  cursorClickAmount: number;
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
        />
      </div>
    </div>
  );
}

function PhaseLabel({ progress }: { progress: number }) {
  const labels: { at: number; text: string }[] = [
    { at: 0.06, text: "01 — Open a blank canvas" },
    { at: 0.10, text: "02 — Brief the page" },
    { at: 0.30, text: "03 — Page composes itself" },
    { at: 0.45, text: "04 — Convert with one CTA" },
    { at: 0.62, text: "05 — Open the builder to refine" },
    { at: 0.78, text: "06 — Tweak any property, live" },
    { at: 0.92, text: "07 — Publish" },
  ];
  const active = [...labels].reverse().find((l) => progress >= l.at) ?? labels[0];
  return (
    <div
      className="absolute -top-7 left-0 text-[11px] uppercase"
      style={{
        letterSpacing: "0.22em",
        color: FAINT,
        opacity: range(progress, 0.04, 0.10),
      }}
    >
      {active.text}
    </div>
  );
}
