import { Fragment, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_DISPLAY,
  ForestEyebrow, ForestGrain, resolveForestPalette,
  type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Convergence — type "forest-convergence"  (DSO Page family, Nov 2026)
 *
 * The page's signature moment. A deep-forest band `scrollLength`vh tall with
 * a sticky full-height stage inside. A canvas scatters N "lab" dots in six
 * loose groups, each tethered by a hairline to a location dot; as the visitor
 * scrolls through the band the labs converge on one glowing accent hub —
 * links brighten, pulses travel toward the hub, the disc grows. The copy on
 * the left and the big count bottom-right swap from the "before" to the
 * "after" state past 70% progress.
 *
 * The v2 "ledger": an optional glass card (the deep surface at 55% + blur,
 * hairline rows of label + display number, an uppercase arrow row before the
 * last row, the last number in the accent) sits in a right column on wide
 * screens and under the copy on narrow ones; the hub shifts toward the
 * centre to make room for it.
 *
 * Reveal contract: reduced motion and the static render paint the converged
 * state (target = 1, "after" copy). In the builder the band is a single stage
 * (the builder canvas cannot scroll-drive a sticky section) paused at ~0.6
 * progress, with the "before" copy editable in place and the "after" copy in
 * a small stacked panel inside the stage.
 * -------------------------------------------------------------------------- */

export interface ForestLedgerRow {
  label: string;
  value: string;
  /** Set the number in the accent (the v2 sets the last row). */
  highlight?: boolean;
}

export interface ForestConvergenceBlockProps extends ForestStyleProps {
  eyebrow?: string;
  /** Headline while the labs are still scattered. */
  headlineBefore: string;
  /** Headline once the network has converged (past 70% progress). */
  headlineAfter?: string;
  bodyBefore?: string;
  bodyAfter?: string;
  /** The big count starts here… */
  countFrom?: number;
  /** …and lands here. */
  countTo?: number;
  labelBefore?: string;
  labelAfter?: string;
  /** How many lab dots the canvas scatters (12–120). */
  dots?: number;
  /** Height of the scroll band in vh (120–320); the stage stays pinned while the visitor scrolls through it. */
  scrollLength?: number;
  /** Optional image drawn inside the hub once it has formed (a logo, a mark). */
  hubImageUrl?: string;
  /** 0–6 glass-ledger rows beside the copy (empty = no ledger). */
  ledger?: ForestLedgerRow[];
  /** The uppercase arrow row shown before the last ledger row ("With one system ———"). */
  ledgerArrowText?: string;
  anchorId?: string;
}

export const FOREST_CONVERGENCE_MAX_LEDGER = 6;

interface Props {
  props: ForestConvergenceBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ForestConvergenceBlockProps) => void;
}

export const FOREST_CONVERGENCE_DEFAULT_PROPS: ForestConvergenceBlockProps = {
  eyebrow: "The thesis",
  headlineBefore: "Every lab your doctors use today. One system tomorrow.",
  headlineAfter: "One system. Every location in view.",
  bodyBefore: "Most groups run dozens of labs and call consolidation a priority. The ones that get there do not mandate a lab. They standardize a system doctors prefer, then let the volume follow.",
  bodyAfter: "One partner that is both the lab and the platform: the cases, the scanners, the training and the data in one place, measured by office. That is the wedge no traditional lab or procurement platform can claim.",
  countFrom: 47,
  countTo: 1,
  labelBefore: "labs across the network",
  labelAfter: "lab system, every location",
  dots: 47,
  scrollLength: 210,
  hubImageUrl: "",
  ledger: [
    { label: "Labs across a typical emerging group", value: "11–25" },
    { label: "Call consolidation a priority or under consideration", value: "96%" },
    { label: "Actually executing a consolidation plan", value: "1%" },
    { label: "Labs, platforms and scanners to manage", value: "1", highlight: true },
  ],
  ledgerArrowText: "With one system",
  anchorId: "thesis",
  backgroundStyle: "dandy-green",
};

/** Where the builder parks the canvas so both the scattered and converged states read. */
const EDITOR_PROGRESS = 0.6;

const clampNum = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
};
const ease = (t: number) => 1 - Math.pow(1 - t, 4);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** "#RRGGBB" → "r,g,b" for rgba() strings on the canvas. */
function rgbChannels(hex: string, fallback: string): string {
  const h = isValidHex(hex) ? hex : fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return "255,255,255";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

interface Dot {
  x0: number; y0: number; lx: number; ly: number; hx: number; hy: number;
  ph: number; cx: number; cy: number; sp: number; x: number; y: number;
}

export function BlockForestConvergence({ props, brand, onFieldChange }: Props) {
  const p = { ...FOREST_CONVERGENCE_DEFAULT_PROPS, ...props };
  const pal = resolveForestPalette(p, brand, "#003A30");
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const frozen = staticRender || reduced;

  const countFrom = clampNum(p.countFrom, 0, 9999, 47);
  const countTo = clampNum(p.countTo, 0, 9999, 1);
  const dotCount = Math.round(clampNum(p.dots, 12, 120, 47));
  const scrollLength = Math.round(clampNum(p.scrollLength, 120, 320, 210));

  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(isEditor ? EDITOR_PROGRESS : frozen ? 1 : 0);
  // The live page swaps copy + count from the scroll handler; the editor shows "before" in place.
  const [view, setView] = useState<{ labs: number; late: boolean }>(() => frozen && !isEditor ? { labs: countTo, late: true } : { labs: countFrom, late: false });
  const viewRef = useRef(view);

  const field = (key: keyof ForestConvergenceBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ForestConvergenceBlockProps[typeof key] }) : undefined;
  const numField = (key: "countFrom" | "countTo") =>
    onFieldChange ? (v: string) => { const n = Number(String(v).replace(/[^\d.]/g, "")); if (Number.isFinite(n)) onFieldChange({ ...props, [key]: n }); } : undefined;

  const dark = pal.dark;
  const cream = pal.cream;
  const onDarkMuted = dark ? "rgba(255,252,239,0.66)" : pal.muted;
  const hairline = dark ? "rgba(255,252,239,0.14)" : pal.hairline;
  const accentHex = isValidHex(pal.accentDeco) ? pal.accentDeco : pal.accent;
  const accent = rgbChannels(accentHex, pal.cta.bg);
  const creamRgb = rgbChannels(cream, "#FFFCEF");
  const hubInk = rgbChannels(pal.onAccent, "#0B1410");
  const hubImageUrl = (p.hubImageUrl ?? "").trim();
  const ledger = (p.ledger ?? []).slice(0, FOREST_CONVERGENCE_MAX_LEDGER).filter((r) => (r.label ?? "").trim() || (r.value ?? "").trim() || isEditor);
  const hasLedger = ledger.length > 0;
  const updateLedger = onFieldChange
    ? (i: number, patch: Partial<ForestLedgerRow>) => onFieldChange({ ...props, ledger: (p.ledger ?? []).map((r, idx) => (idx === i ? { ...r, ...patch } : r)) })
    : undefined;

  /* Canvas: a faithful port of the artifact's "Convergence canvas". */
  useEffect(() => {
    const cv = canvasRef.current;
    const stage = stageRef.current;
    if (!cv || !stage) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const N = dotCount;
    let W = 0, H = 0, dpr = 1, seed = 7, t = targetRef.current;
    let dots: Dot[] = [];
    let raf = 0;
    let img: HTMLImageElement | null = null;
    let disposed = false;

    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    function build() {
      const r = cv!.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv!.width = Math.max(1, Math.round(W * dpr));
      cv!.height = Math.max(1, Math.round(H * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed = 7; dots = [];
      // With a ledger in the right column the hub moves toward the centre and tightens so neither column covers it.
      const wide = W > 900, cx = wide ? W * (hasLedger ? 0.51 : 0.72) : W * 0.5, cy = wide ? H * 0.5 : H * 0.74;
      const ring = wide ? Math.min(W, H) * (hasLedger ? 0.2 : 0.25) : Math.min(W, H) * 0.36;
      for (let i = 0; i < N; i++) {
        // scattered "labs": clustered in 6 loose groups around the right half (left-centred on mobile)
        const gx = (wide ? W * 0.42 : W * 0.08) + rnd() * (wide ? W * 0.52 : W * 0.84);
        const gy = H * 0.12 + rnd() * H * 0.76;
        const a = rnd() * Math.PI * 2, rad = 18 + rnd() * 34;
        dots.push({
          x0: gx, y0: gy,
          lx: gx + Math.cos(a) * rad * 2.2, ly: gy + Math.sin(a) * rad * 2.2,
          hx: cx + Math.cos(i / N * Math.PI * 2) * ring, hy: cy + Math.sin(i / N * Math.PI * 2) * ring,
          ph: rnd() * Math.PI * 2, cx, cy, sp: 0.6 + rnd() * 0.8, x: gx, y: gy,
        });
      }
    }

    function frame(now: number) {
      const pr = Math.max(0, Math.min(1, t)), e = ease(pr);
      ctx!.clearRect(0, 0, W, H);
      const cx = dots.length ? dots[0].cx : W / 2, cy = dots.length ? dots[0].cy : H / 2, tm = now / 1000;
      // links
      for (const d of dots) {
        const bx = lerp(d.lx, d.hx, e), by = lerp(d.ly, d.hy, e);
        const x = bx + Math.cos(tm * d.sp + d.ph) * (4 - 2 * e), y = by + Math.sin(tm * d.sp * 0.9 + d.ph) * (4 - 2 * e);
        const tx = lerp(d.x0, cx, e), ty = lerp(d.y0, cy, e);
        d.x = x; d.y = y;
        ctx!.beginPath(); ctx!.moveTo(x, y); ctx!.lineTo(tx, ty);
        ctx!.strokeStyle = `rgba(${accent},${0.10 + 0.35 * e})`; ctx!.lineWidth = 1; ctx!.stroke();
        if (e > 0.02) { // travelling pulse toward the hub
          const q = (tm * 0.35 + d.ph / 6) % 1, px = lerp(x, tx, q), py = lerp(y, ty, q);
          ctx!.beginPath(); ctx!.arc(px, py, 1.6, 0, Math.PI * 2); ctx!.fillStyle = `rgba(${accent},${0.9 * e})`; ctx!.fill();
        }
      }
      // small lab nodes (scattered state)
      for (const d of dots) {
        ctx!.beginPath(); ctx!.arc(lerp(d.x0, cx, e), lerp(d.y0, cy, e), 3.5 * (1 - e) + 0.01, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${creamRgb},${0.55 * (1 - e)})`; ctx!.fill();
      }
      // location dots
      for (const d of dots) {
        ctx!.beginPath(); ctx!.arc(d.x, d.y, 2.4 + 1.2 * e, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${creamRgb},${0.5 + 0.4 * e})`; ctx!.fill();
      }
      // hub
      const R = 10 + 40 * e, pulse = 1 + Math.sin(tm * 2) * 0.04 * e;
      const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, R * 4);
      g.addColorStop(0, `rgba(${accent},${0.45 * e})`); g.addColorStop(1, `rgba(${accent},0)`);
      ctx!.beginPath(); ctx!.arc(cx, cy, R * 4, 0, Math.PI * 2); ctx!.fillStyle = g; ctx!.fill();
      ctx!.beginPath(); ctx!.arc(cx, cy, R * pulse, 0, Math.PI * 2); ctx!.fillStyle = `rgba(${accent},${0.15 + 0.85 * e})`; ctx!.fill();
      ctx!.beginPath(); ctx!.arc(cx, cy, R * pulse + 8, 0, Math.PI * 2); ctx!.strokeStyle = `rgba(${accent},${0.5 * e})`; ctx!.lineWidth = 1; ctx!.stroke();
      if (e > 0.5 && img && img.naturalWidth > 0) {
        // the artifact draws its logo here via Path2D; we draw the hub image, contained inside the disc
        const box = R * pulse * 1.5;
        const ar = img.naturalWidth / img.naturalHeight;
        const w = ar >= 1 ? box : box * ar, h = ar >= 1 ? box / ar : box;
        ctx!.save();
        ctx!.globalAlpha = Math.min(1, (e - 0.5) * 3);
        ctx!.drawImage(img, cx - w / 2, cy - h / 2, w, h);
        ctx!.restore();
      } else if (e > 0.5) {
        // no image: a quiet ink centre so the disc reads as a hub rather than a flat dot
        ctx!.beginPath(); ctx!.arc(cx, cy, R * pulse * 0.22, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${hubInk},${Math.min(1, (e - 0.5) * 3) * 0.9})`; ctx!.fill();
      }
    }

    function loop(now: number) {
      if (disposed) return;
      t += (targetRef.current - t) * 0.08;
      frame(now);
      raf = requestAnimationFrame(loop);
    }

    const paintStill = () => { t = targetRef.current; frame(0); };

    if (hubImageUrl) {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => { if (disposed) return; img = im; if (frozen) paintStill(); };
      im.src = hubImageUrl;
    }

    build();
    if (frozen) {
      paintStill();
    } else {
      raf = requestAnimationFrame(loop);
    }

    const onResize = () => { build(); if (frozen) paintStill(); };
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    if (ro) ro.observe(stage); else window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect(); else window.removeEventListener("resize", onResize);
    };
  }, [dotCount, accent, creamRgb, hubInk, hubImageUrl, frozen, isEditor, hasLedger]);

  /* Scroll progress → target + copy swap (live page only). */
  useEffect(() => {
    if (isEditor) { targetRef.current = EDITOR_PROGRESS; return; }
    if (frozen) {
      targetRef.current = 1;
      const next = { labs: countTo, late: true };
      viewRef.current = next; setView(next);
      return;
    }
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onConv = () => {
      const r = wrapper.getBoundingClientRect(), total = r.height - window.innerHeight;
      const prog = total > 0 ? Math.max(0, Math.min(1, -r.top / total)) : 1;
      const target = Math.max(0, Math.min(1, (prog - 0.15) / 0.6));
      targetRef.current = target;
      const labs = Math.round(lerp(countFrom, countTo, ease(target)));
      const late = target > 0.7;
      if (labs !== viewRef.current.labs || late !== viewRef.current.late) {
        const next = { labs, late };
        viewRef.current = next; setView(next);
      }
    };
    onConv();
    window.addEventListener("scroll", onConv, { passive: true });
    window.addEventListener("resize", onConv);
    return () => { window.removeEventListener("scroll", onConv); window.removeEventListener("resize", onConv); };
  }, [isEditor, frozen, countFrom, countTo]);

  const late = !isEditor && view.late;
  const headline = late ? (p.headlineAfter || p.headlineBefore) : p.headlineBefore;
  const body = late ? (p.bodyAfter ?? p.bodyBefore ?? "") : (p.bodyBefore ?? "");
  // The artifact swaps the label the moment the count lands (labs === 1 → "lab system, every location").
  const label = !isEditor && view.labs === countTo ? (p.labelAfter || p.labelBefore || "") : (p.labelBefore || "");
  const count = isEditor ? String(countFrom) : String(view.labs);

  const h2Style: React.CSSProperties = { fontFamily: FOREST_DISPLAY, fontSize: "clamp(2rem, 4vw, 3.25rem)", lineHeight: 1.1, letterSpacing: "-0.03em", fontWeight: 400, color: cream, margin: "22px 0 0", textWrap: "balance" } as React.CSSProperties;
  const ledeStyle: React.CSSProperties = { fontSize: "clamp(1.05rem, 1.4vw, 1.25rem)", lineHeight: 1.6, color: onDarkMuted, marginTop: 20 };

  /* The v2 ledger: a glass card of hairline rows (label + display number), an uppercase arrow row before the last row, the last number in the accent. */
  const ledgerCard = hasLedger && (
    <div
      className="forest-ledger grid gap-3.5 rounded-[18px] px-6 py-[22px] text-[13.5px]"
      style={{
        background: dark ? `color-mix(in srgb, ${pal.deep} 55%, transparent)` : "rgba(255,255,255,0.55)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${hairline}`,
        color: cream,
      }}
    >
      {ledger.map((r, i) => {
        const last = i === ledger.length - 1;
        return (
          <Fragment key={i}>
            {last && ledger.length > 1 && (p.ledgerArrowText || isEditor) && (
              <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: pal.accent }}>
                <InlineText as="span" value={p.ledgerArrowText ?? ""} onUpdate={field("ledgerArrowText")} />
                <span aria-hidden className="h-px min-w-6 flex-1" style={{ background: `linear-gradient(90deg, ${pal.accentDeco}, transparent)` }} />
              </div>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5" style={{ paddingBottom: last ? 0 : 12, borderBottom: last ? 0 : `1px solid ${hairline}` }}>
              <span className="leading-[1.4]" style={{ color: onDarkMuted }}>
                <InlineText as="span" value={r.label ?? ""} onUpdate={updateLedger ? (v) => updateLedger(i, { label: v }) : undefined} multiline />
              </span>
              <b className="tabular-nums" style={{ fontFamily: FOREST_DISPLAY, fontWeight: 400, fontSize: "1.5rem", letterSpacing: "-0.03em", lineHeight: 1, color: r.highlight ? pal.accent : cream }}>
                <InlineText as="span" value={r.value ?? ""} onUpdate={updateLedger ? (v) => updateLedger(i, { value: v }) : undefined} />
              </b>
            </div>
          </Fragment>
        );
      })}
    </div>
  );

  const stage = (
    <div
      ref={stageRef}
      className={cn("conv-stage relative grid w-full items-start overflow-hidden pt-[clamp(72px,12vh,120px)] md:items-center md:pt-0", isEditor ? "" : "sticky top-0")}
      style={isEditor ? { height: "auto", minHeight: 560 } : { height: "auto", minHeight: "max(560px, 100svh)" }}
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" style={{ zIndex: 0 }} />
      {dark && <ForestGrain opacity={0.04} />}
      <div
        className={cn(FOREST_CONTAINER, "relative", isEditor ? "pointer-events-auto pb-[160px] md:pb-[120px]" : cn("pointer-events-none", hasLedger && "pb-[150px] lg:pb-0"))}
        style={{ zIndex: 2 }}
      >
        <div className={cn("grid gap-10", hasLedger && "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-12")}>
        <div className="min-w-0">
        {(p.eyebrow || isEditor) && (
          <ForestEyebrow palette={pal}>
            <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
          </ForestEyebrow>
        )}
        <h2 className="max-w-[14ch] md:max-w-[11ch]" style={h2Style}>
          <InlineText as="span" value={headline} onUpdate={field("headlineBefore")} multiline />
        </h2>
        {(body || isEditor) && (
          <p className={cn("max-w-[60ch] md:max-w-[40ch]", hasLedger && "lg:max-w-[31ch]")} style={ledeStyle}>
            <InlineText as="span" value={body} onUpdate={field("bodyBefore")} multiline />
          </p>
        )}
        {isEditor && (
          <div className="mt-7 max-w-[560px] rounded-[22px] p-[18px]" style={{ background: dark ? "rgba(255,252,239,0.06)" : "rgba(0,0,0,0.04)", border: `1px solid ${hairline}`, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: onDarkMuted }}>After convergence (shown past 70% scroll)</span>
            <h3 className="mt-3 max-w-[16ch]" style={{ ...h2Style, fontSize: "clamp(1.5rem, 2.6vw, 2.1rem)", margin: "12px 0 0" }}>
              <InlineText as="span" value={p.headlineAfter ?? ""} onUpdate={field("headlineAfter")} multiline />
            </h3>
            <p className="max-w-[46ch]" style={{ ...ledeStyle, fontSize: "15.5px", marginTop: 12 }}>
              <InlineText as="span" value={p.bodyAfter ?? ""} onUpdate={field("bodyAfter")} multiline />
            </p>
            <div className="mt-4 flex items-baseline gap-3 tabular-nums">
              <b style={{ fontFamily: FOREST_DISPLAY, fontSize: "2.4rem", lineHeight: 1, letterSpacing: "-0.04em", fontWeight: 400, color: pal.accent }}>
                <InlineText as="span" value={String(countTo)} onUpdate={numField("countTo")} />
              </b>
              <span className="text-[13px] uppercase tracking-[0.14em]" style={{ color: onDarkMuted }}>
                <InlineText as="span" value={p.labelAfter ?? ""} onUpdate={field("labelAfter")} />
              </span>
            </div>
          </div>
        )}
        </div>
        {hasLedger && <div className="w-full min-w-0 lg:max-w-[400px] lg:justify-self-end">{ledgerCard}</div>}
        </div>
      </div>
      <div
        className="conv-count absolute right-4 bottom-10 text-right tabular-nums md:right-10 md:bottom-14"
        style={{ zIndex: 2, pointerEvents: isEditor ? "auto" : "none" }}
        aria-live="polite"
      >
        <b className="block" style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(3rem, 7vw, 6rem)", lineHeight: 0.9, letterSpacing: "-0.04em", fontWeight: 400, color: pal.accent }}>
          <InlineText as="span" value={count} onUpdate={numField("countFrom")} />
        </b>
        {(label || isEditor) && (
          <span className="mt-2.5 block text-[13px] uppercase tracking-[0.14em]" style={{ color: onDarkMuted }}>
            <InlineText as="span" value={label} onUpdate={field("labelBefore")} />
          </span>
        )}
      </div>
    </div>
  );

  return (
    <section
      id={p.anchorId || undefined}
      data-block="forest-convergence"
      className="forest-convergence relative"
      style={{ background: dark ? pal.deep : pal.bg, color: cream, fontFamily: FOREST_BODY, isolation: "isolate" }}
      aria-label={p.eyebrow || undefined}
    >
      <style>{FOREST_CSS}</style>
      {isEditor ? (
        <div ref={wrapperRef}>{stage}</div>
      ) : (
        <div ref={wrapperRef} className="conv-scroll" style={{ height: `${scrollLength}vh` }}>
          {stage}
        </div>
      )}
    </section>
  );
}
