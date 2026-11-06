import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  MINT_BODY, MINT_CSS, MINT_DISPLAY, MINT_EASE, MINT_RING, MINT_SECTION_PAD, MINT_SHADOW_2, MINT_WIDE,
  MintCheckDot, MintChrome, MintEyebrow, MintLink, MintNumber, MintSectionHeader, mintAnchorClick, mintDisplay, mintStageDots, resolveMintPalette, useMintReveal,
  type MintPalette, type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Features — type "mint-features"  (DSO Page (Light) family, Nov 2026)
 *
 * "One lab your whole network runs on." The v2 section header row (eyebrow
 * with a lime dot + "· Four parts" suffix, a 20ch h2, a quiet chevron link
 * on the headline baseline), then a wide stack of feature rows: two columns
 * from 900px that alternate visual-left / visual-right, a hairline between
 * rows (the first row has neither hairline nor top padding). The text
 * column carries a kicker with a display-face index ("01 Adoption"), a 16ch
 * h3, a 42ch body, a two-stat `.meta` grid under a hairline and a chevron
 * link. The visual column is a 5:4 photo in a ringed frame, or a UI mock in
 * a browser window (three pastel dots, title, meta) on a dotted gradient
 * stage: an invoice (soft lime), a bar chart by office (mint) or a scan
 * photo with a lime grid, a slow sweep, a progress ring and a checklist.
 *
 * Reveal contract (fail-open): each row has its own useMintReveal; the bars,
 * the ring and the checklist are CSS transitions gated on that flag; the
 * static render and reduced motion paint the final frame (and skip the sweep).
 * -------------------------------------------------------------------------- */

export type MintFeatureVisual = "image" | "invoice" | "bars" | "scan";

/** One hairline row of the invoice mock. */
export interface MintFeatureLine {
  label: string;
  value: string;
  /** Paint the value in the brand green ("$0", "Included"). */
  emphasis?: boolean;
}

/** One office row of the bar-chart mock. */
export interface MintFeatureBar {
  label: string;
  value: string;
  /** Fill 0–100. */
  pct: number;
  /** Paint the fill in the warning terracotta. */
  bad?: boolean;
}

/** One line of the scan checklist. */
export interface MintFeatureCheck {
  text: string;
  /** Amber dot instead of the lime check. */
  warn?: boolean;
}

/** One cell of the two-stat `.meta` grid under a row's body. */
export interface MintFeatureStat {
  value: string;
  label: string;
}

export interface MintFeatureRow {
  /** Short label above the title ("Adoption"). */
  kicker: string;
  /** Display-face index in front of the kicker; blank = "01".."06" by position. */
  index?: string;
  title: string;
  body: string;
  /** Legacy single stat; rendered as one meta stat when `metaStats` is empty. */
  statValue?: string;
  statLabel?: string;
  /** Up to two stats in the hairline-topped meta grid. */
  metaStats?: MintFeatureStat[];
  linkText?: string;
  linkUrl?: string;
  visual: MintFeatureVisual;
  /** Blank = alternate automatically (first row visual-left). */
  visualSide?: "left" | "right";
  /** image + scan. */
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
  /** image only: "contain" sits a product shot on a mint stage. */
  imageFit?: "cover" | "contain";
  /** invoice + bars: window chrome title (left) / meta (right). */
  mockTitle?: string;
  mockMeta?: string;
  /** invoice: small uppercase label over the total. bars: footer strip text. */
  mockFooterLabel?: string;
  /** invoice: the display-size total ("$0"). */
  mockTotal?: string;
  /** invoice + bars: the lime pill. */
  mockPill?: string;
  lines?: MintFeatureLine[];
  bars?: MintFeatureBar[];
  checks?: MintFeatureCheck[];
  /** scan: the ring's percentage 0–100 (also its label). */
  ringPct?: number;
}

export interface MintFeaturesBlockProps extends MintStyleProps {
  /** Section eyebrow ("The system") and its muted suffix ("· Four parts"). */
  eyebrow?: string;
  eyebrowSuffix?: string;
  headline: string;
  subheadline?: string;
  /** The quiet chevron link at the right of the header row; blank = none. */
  headerLinkText?: string;
  headerLinkUrl?: string;
  /** 2–6 rows. */
  rows: MintFeatureRow[];
  anchorId?: string;
}

interface Props {
  props: MintFeaturesBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MintFeaturesBlockProps) => void;
}

export const MINT_FEATURES_MIN_ROWS = 2;
export const MINT_FEATURES_MAX_ROWS = 6;
export const MINT_FEATURES_MAX_LINES = 6;
export const MINT_FEATURES_MAX_BARS = 6;
export const MINT_FEATURES_MAX_CHECKS = 4;
export const MINT_FEATURES_MAX_META = 2;

export const MINT_FEATURES_DEFAULT_PROPS: MintFeaturesBlockProps = {
  eyebrow: "The system",
  eyebrowSuffix: "· Four parts",
  headline: "One lab your whole network runs on.",
  subheadline: "Adoption, economics, visibility and consistency, built as one lab rather than four vendors.",
  headerLinkText: "How it works",
  headerLinkUrl: "#",
  rows: [
    {
      kicker: "Adoption",
      title: "Change your doctors choose.",
      body: "A scanner in every operatory, a technician on every case, and training in the office on day one. Doctors switch because the work is better, not because they were told to.",
      metaStats: [
        { value: "70%", label: "of practices activate on training day" },
        { value: "<2 min", label: "to reach a technician" },
      ],
      linkText: "How rollout works",
      linkUrl: "#rollout",
      visual: "image",
      imageUrl: "",
      imageAlt: "",
      imageFit: "cover",
    },
    {
      kicker: "Economics",
      title: "Spend that falls as you grow.",
      body: "A scanner per location at $0 CapEx. Volume pricing across the group, one invoice, month-to-month terms. The lab line becomes something you can forecast.",
      metaStats: [
        { value: "$0", label: "scanner CapEx per location" },
        { value: "1", label: "invoice for the whole group" },
      ],
      linkText: "See the economics",
      linkUrl: "#compare",
      visual: "invoice",
      mockTitle: "Per location",
      mockMeta: "Month to month",
      lines: [
        { label: "Intraoral scanner", value: "$0", emphasis: true },
        { label: "Training day on site", value: "Included", emphasis: true },
        { label: "Technician on every case", value: "Included", emphasis: true },
        { label: "Lab work", value: "Volume pricing" },
      ],
      mockFooterLabel: "Scanner CapEx avoided",
      mockTotal: "$0",
      mockPill: "vs $40–75K",
    },
    {
      kicker: "Visibility",
      title: "Every lab metric. Every office. One view.",
      body: "Remakes, turnaround, spend and scan quality by provider and by location, in one dashboard. The lab-management layer other networks buy from a second vendor.",
      metaStats: [
        { value: "7", label: "metrics tracked per office" },
        { value: "90", label: "days to the first executive review" },
      ],
      linkText: "Explore the dashboard",
      linkUrl: "#",
      visual: "bars",
      mockTitle: "Remake rate by office",
      mockMeta: "Last 30 days",
      bars: [
        { label: "Northside", value: "1.1%", pct: 22 },
        { label: "Riverview", value: "1.5%", pct: 30 },
        { label: "Oak Park", value: "1.8%", pct: 36 },
        { label: "Midtown", value: "2.2%", pct: 44 },
        { label: "Lakeside", value: "4.3%", pct: 86, bad: true },
      ],
      mockFooterLabel: "Network average 1.9%",
      mockPill: "1 office to coach",
    },
    {
      kicker: "Consistency",
      title: "The same quality in every office.",
      body: "AI checks every scan at the chair and guided design keeps every case consistent. Made at two domestic sites, with a 360° quality check before it ships.",
      metaStats: [
        { value: "98%", label: "first-fit across the network" },
        { value: "360°", label: "quality check before it ships" },
      ],
      linkText: "Clinical consistency",
      linkUrl: "#",
      visual: "scan",
      imageUrl: "",
      imageAlt: "",
      ringPct: 98,
      checks: [
        { text: "Margins captured" },
        { text: "Occlusion clear" },
        { text: "Rescan distal of #30", warn: true },
        { text: "Checked before the patient leaves" },
      ],
    },
  ],
  anchorId: "system",
  backgroundStyle: "white",
};

const EASE = `cubic-bezier(${MINT_EASE.join(",")})`;
const clampPct = (n: number | undefined, fallback: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? (n as number) : fallback));
const RING_R = 23;
const RING_C = Math.round(2 * Math.PI * RING_R * 10) / 10; // 144.5, the v2 dasharray
const pad2 = (n: number) => `${n < 10 ? "0" : ""}${n}`;

/** The ink pair inside the white windows (the window is white on every surface). */
const WIN_INK = "#1D1D1F";
const WIN_MUTED = "#6E6E73";

/** The small lime pill inside the mocks ("vs $40–75K", "1 office to coach"). */
function Pill({ pal, value, onUpdate }: { pal: MintPalette; value: string; onUpdate?: (v: string) => void }) {
  return (
    <span className="inline-block rounded-full px-2 py-[3px] text-[11px] font-semibold leading-[1.3]" style={{ background: pal.lime, color: pal.onLime }}>
      <InlineText as="span" value={value} onUpdate={onUpdate} />
    </span>
  );
}

interface RowProps {
  row: MintFeatureRow;
  index: number;
  pal: MintPalette;
  /** A light palette for the window chrome (the window stays white on dark surfaces). */
  winPal: MintPalette;
  isEditor: boolean;
  reduced: boolean;
  staticRender: boolean;
  onPatch?: (patch: Partial<MintFeatureRow>) => void;
}

function FeatureRow({ row, index, pal, winPal, isEditor, reduced, staticRender, onPatch }: RowProps) {
  const { ref, show, rise } = useMintReveal<HTMLDivElement>("-40px");
  const settled = show || staticRender || reduced;
  const noMotion = reduced || staticRender;
  const side: "left" | "right" = row.visualSide ?? (index % 2 === 0 ? "left" : "right");
  const visualRight = side === "right";
  const ink = pal.ink;
  const muted = pal.inkMuted;
  const kickerInk = pal.dark ? pal.lime : pal.green;
  const linkInk = pal.dark ? pal.lime : pal.green;

  const patchLine = onPatch ? (j: number, patch: Partial<MintFeatureLine>) => onPatch({ lines: (row.lines ?? []).map((l, k) => (k === j ? { ...l, ...patch } : l)) }) : undefined;
  const patchBar = onPatch ? (j: number, patch: Partial<MintFeatureBar>) => onPatch({ bars: (row.bars ?? []).map((b, k) => (k === j ? { ...b, ...patch } : b)) }) : undefined;
  const patchCheck = onPatch ? (j: number, patch: Partial<MintFeatureCheck>) => onPatch({ checks: (row.checks ?? []).map((c, k) => (k === j ? { ...c, ...patch } : c)) }) : undefined;

  // The meta grid: the new `metaStats` list, or the legacy single stat as one cell.
  const legacyStat = !(row.metaStats && row.metaStats.length > 0);
  const stats: MintFeatureStat[] = legacyStat
    ? ((row.statValue || isEditor) ? [{ value: row.statValue ?? "", label: row.statLabel ?? "" }] : [])
    : (row.metaStats ?? []).slice(0, MINT_FEATURES_MAX_META);
  const patchStat = onPatch
    ? (j: number, patch: Partial<MintFeatureStat>) => {
        if (legacyStat) onPatch({ statValue: patch.value ?? row.statValue, statLabel: patch.label ?? row.statLabel });
        else onPatch({ metaStats: (row.metaStats ?? []).map((s, k) => (k === j ? { ...s, ...patch } : s)) });
      }
    : undefined;

  /* ── visual helpers ── */
  const frameShadow = `${MINT_RING}, ${MINT_SHADOW_2}`;
  const winShadow = `${MINT_RING}, 0 20px 50px rgba(0,38,31,.14)`;
  const frameHighlight = <span aria-hidden className="pointer-events-none absolute inset-0 z-[2] rounded-[inherit]" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35)" }} />;

  /** The dotted gradient stage behind a mock (mint, or soft lime for the invoice). */
  const stage = (tone: "mint" | "lime", children: React.ReactNode) => (
    <div
      className="relative grid place-items-center overflow-hidden rounded-[20px]"
      style={{
        background: tone === "lime"
          ? `linear-gradient(160deg, ${pal.limeSoft}, color-mix(in srgb, ${pal.lime} 36%, #FFFFFF))`
          : `linear-gradient(160deg, ${pal.mint}, ${pal.mint2})`,
        aspectRatio: "5 / 4",
        padding: "clamp(18px, 3vw, 32px)",
        boxShadow: MINT_RING,
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={mintStageDots(pal)} />
      <div className="relative flex w-full justify-center">{children}</div>
    </div>
  );

  /** A white browser window: chrome strip, padded body, optional grey footer strip. */
  const win = (children: React.ReactNode, footer?: React.ReactNode) => (
    <div className="relative w-full max-w-[430px] overflow-hidden rounded-[14px] bg-white text-[13px]" style={{ color: WIN_INK, boxShadow: winShadow, fontFamily: MINT_BODY }}>
      <MintChrome
        palette={winPal}
        title={<InlineText as="span" value={row.mockTitle ?? ""} onUpdate={onPatch ? (v) => onPatch({ mockTitle: v }) : undefined} />}
        right={(row.mockMeta || isEditor) ? <InlineText as="span" value={row.mockMeta ?? ""} onUpdate={onPatch ? (v) => onPatch({ mockMeta: v }) : undefined} /> : undefined}
      />
      <div className="px-[18px] pb-[18px] pt-4">{children}</div>
      {footer}
    </div>
  );

  let visual: React.ReactNode;
  if (row.visual === "invoice") {
    const lines = (row.lines ?? []).slice(0, MINT_FEATURES_MAX_LINES);
    visual = stage("lime", win(
      <>
        {lines.length > 0 && (
          <div className="grid gap-[9px]">
            {lines.map((l, j) => {
              const last = j === lines.length - 1;
              return (
                <div key={j} className="flex items-baseline justify-between gap-3 text-[13px]" style={{ paddingBottom: last ? 0 : 9, borderBottom: last ? 0 : `1px dashed ${winPal.line}` }}>
                  <span><InlineText as="span" value={l.label} onUpdate={patchLine ? (v) => patchLine(j, { label: v }) : undefined} /></span>
                  <b className="tabular-nums" style={{ fontWeight: l.emphasis ? 600 : 500, color: l.emphasis ? pal.green : WIN_INK }}>
                    <InlineText as="span" value={l.value} onUpdate={patchLine ? (v) => patchLine(j, { value: v }) : undefined} />
                  </b>
                </div>
              );
            })}
          </div>
        )}
        {(row.mockFooterLabel || isEditor) && (
          <div className="mt-3.5 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: WIN_MUTED }}>
            <InlineText as="span" value={row.mockFooterLabel ?? ""} onUpdate={onPatch ? (v) => onPatch({ mockFooterLabel: v }) : undefined} />
          </div>
        )}
        {(row.mockTotal || row.mockPill || isEditor) && (
          <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
            <b style={{ fontFamily: MINT_DISPLAY, fontWeight: 400, fontSize: "2.3rem", letterSpacing: "-0.03em", lineHeight: 1 }}>
              <InlineText as="span" value={row.mockTotal ?? ""} onUpdate={onPatch ? (v) => onPatch({ mockTotal: v }) : undefined} />
            </b>
            {(row.mockPill || isEditor) && <Pill pal={pal} value={row.mockPill ?? ""} onUpdate={onPatch ? (v) => onPatch({ mockPill: v }) : undefined} />}
          </div>
        )}
      </>,
    ));
  } else if (row.visual === "bars") {
    const bars = (row.bars ?? []).slice(0, MINT_FEATURES_MAX_BARS);
    const ticks = `repeating-linear-gradient(90deg, transparent 0 24px, color-mix(in srgb, ${pal.green} 8%, transparent) 24px 25px)`;
    visual = stage("mint", win(
      bars.length > 0 ? (
        <div className="grid gap-[9px]">
          {bars.map((b, j) => (
            <div key={j} className="grid grid-cols-[72px_minmax(0,1fr)_44px] items-center gap-2.5 text-[12.5px] sm:grid-cols-[92px_minmax(0,1fr)_44px]">
              <em className="truncate not-italic" style={{ color: WIN_MUTED }}>
                <InlineText as="span" value={b.label} onUpdate={patchBar ? (v) => patchBar(j, { label: v }) : undefined} />
              </em>
              <div className="relative h-2 overflow-hidden rounded-[4px]" style={{ background: pal.mint2 }}>
                <span aria-hidden className="absolute inset-0" style={{ backgroundImage: ticks }} />
                <i className="relative z-[1] block h-full rounded-[4px]" style={{ background: b.bad ? "#D97A5B" : pal.green, width: settled ? `${clampPct(b.pct, 40)}%` : 0, transition: noMotion ? "none" : `width 1.4s ${EASE}` }} />
              </div>
              <b className="text-right font-medium tabular-nums">
                <InlineText as="span" value={b.value} onUpdate={patchBar ? (v) => patchBar(j, { value: v }) : undefined} />
              </b>
            </div>
          ))}
        </div>
      ) : null,
      (row.mockFooterLabel || row.mockPill || isEditor) ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] py-3 text-[12px]" style={{ color: WIN_MUTED, borderTop: `1px solid ${winPal.line}`, background: winPal.grey }}>
          <span><InlineText as="span" value={row.mockFooterLabel ?? ""} onUpdate={onPatch ? (v) => onPatch({ mockFooterLabel: v }) : undefined} /></span>
          {(row.mockPill || isEditor) && <Pill pal={pal} value={row.mockPill ?? ""} onUpdate={onPatch ? (v) => onPatch({ mockPill: v }) : undefined} />}
        </div>
      ) : undefined,
    ));
  } else if (row.visual === "scan") {
    const checks = (row.checks ?? []).slice(0, MINT_FEATURES_MAX_CHECKS);
    const pct = clampPct(row.ringPct, 98);
    const offset = settled ? RING_C * (1 - pct / 100) : RING_C;
    const gridLine = `color-mix(in srgb, ${pal.lime} 18%, transparent)`;
    visual = stage("mint", (
      <div className="relative w-full max-w-[430px] overflow-hidden rounded-[14px]" style={{ boxShadow: winShadow, background: pal.mint2 }}>
        <div className="relative w-full" style={{ aspectRatio: "4 / 3" }}>
          {(row.imageUrl || isEditor) ? (
            <InlineImage
              src={row.imageUrl ?? ""}
              alt={row.imageAlt ?? ""}
              className="h-full w-full object-cover"
              wrapperClassName="absolute inset-0"
              style={{ filter: "saturate(.85)" }}
              focalPoint={row.imageFocal}
              onUpdate={onPatch ? (v) => onPatch({ imageUrl: v }) : undefined}
              onAltUpdate={onPatch ? (v) => onPatch({ imageAlt: v }) : undefined}
              onFocalUpdate={onPatch ? (v) => onPatch({ imageFocal: v }) : undefined}
            />
          ) : (
            <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${pal.mint2} 0%, ${pal.deep} 140%)` }} />
          )}
        </div>
        {/* lime scan grid + the slow sweep (the sweep is skipped under reduced motion / static render) */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: `linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`, backgroundSize: "36px 36px", mixBlendMode: "screen" }} />
        {!noMotion && (
          <div aria-hidden className="mint-sweep pointer-events-none absolute left-0 right-0" style={{ top: "-30%", height: "30%", background: `linear-gradient(180deg, transparent, color-mix(in srgb, ${pal.lime} 35%, transparent))` }} />
        )}
        {/* progress ring */}
        <div className="absolute right-3 top-3 h-14 w-14 rounded-full" style={{ background: `color-mix(in srgb, ${pal.deep} 62%, transparent)`, backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} aria-label={`${pct}%`} role="img">
          <svg viewBox="0 0 56 56" width="56" height="56" style={{ transform: "rotate(-90deg)" }} aria-hidden>
            <circle cx="28" cy="28" r={RING_R} fill="none" strokeWidth="4" stroke="rgba(255,255,255,.25)" />
            <circle cx="28" cy="28" r={RING_R} fill="none" strokeWidth="4" strokeLinecap="round" stroke={pal.lime} strokeDasharray={RING_C} strokeDashoffset={offset} style={{ transition: noMotion ? "none" : `stroke-dashoffset 1.6s ${EASE}` }} />
          </svg>
          <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums" style={{ color: "#FFFFFF" }}>{pct}%</span>
        </div>
        {/* glass checklist */}
        {checks.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 grid gap-[7px] rounded-[12px] px-3.5 py-3 text-[12.5px]" style={{ background: "rgba(255,255,255,.94)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", color: WIN_INK, boxShadow: MINT_RING }}>
            {checks.map((c, j) => (
              <div key={j} className="flex items-center gap-2" style={{ opacity: settled ? 1 : 0, transform: settled ? "none" : "translateX(-6px)", transition: noMotion ? "none" : `opacity .6s ${EASE} ${j * 0.25}s, transform .6s ${EASE} ${j * 0.25}s` }}>
                {c.warn ? <span aria-hidden className="inline-block h-4 w-4 shrink-0 rounded-full" style={{ background: "#F3D27A" }} /> : <MintCheckDot palette={pal} lime />}
                <InlineText as="span" value={c.text} onUpdate={patchCheck ? (v) => patchCheck(j, { text: v }) : undefined} />
              </div>
            ))}
          </div>
        )}
      </div>
    ));
  } else {
    const contain = row.imageFit === "contain";
    visual = (
      <div className="relative overflow-hidden rounded-[20px]" style={{ aspectRatio: "5 / 4", background: pal.mint, boxShadow: frameShadow }}>
        {(row.imageUrl || isEditor) ? (
          <InlineImage
            src={row.imageUrl ?? ""}
            alt={row.imageAlt ?? ""}
            className={cn("h-full w-full", contain ? "object-contain" : "object-cover")}
            wrapperClassName="absolute inset-0"
            style={{ filter: "saturate(.85)", transform: settled ? "scale(1)" : "scale(1.03)", transition: noMotion ? "none" : `transform 2s ${EASE}` }}
            focalPoint={row.imageFocal}
            onUpdate={onPatch ? (v) => onPatch({ imageUrl: v }) : undefined}
            onAltUpdate={onPatch ? (v) => onPatch({ imageAlt: v }) : undefined}
            onFocalUpdate={onPatch ? (v) => onPatch({ imageFocal: v }) : undefined}
          />
        ) : (
          <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${pal.mint} 0%, ${pal.mint2} 100%)` }} />
        )}
        {frameHighlight}
      </div>
    );
  }

  const rowPad = "clamp(36px, 5vw, 64px)";

  return (
    <div
      ref={ref}
      className="grid items-center gap-7 min-[900px]:grid-cols-2 min-[900px]:gap-16"
      style={{ paddingTop: index === 0 ? 0 : rowPad, paddingBottom: rowPad, borderTop: index > 0 ? `1px solid ${pal.line}` : undefined }}
      data-visual={row.visual}
      data-side={side}
    >
      <motion.div {...rise(0, 18)} className={cn("min-w-0", visualRight ? "min-[900px]:order-2" : "min-[900px]:order-1")}>
        {visual}
      </motion.div>
      <motion.div {...rise(0.1, 18)} className={cn("min-w-0", visualRight ? "min-[900px]:order-1" : "min-[900px]:order-2")}>
        {(row.kicker || isEditor) && (
          <p className="m-0 flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: kickerInk, fontFamily: MINT_BODY }}>
            <b className="normal-case" style={{ fontFamily: MINT_DISPLAY, fontWeight: 400, fontSize: "1.1rem", letterSpacing: "-0.02em", lineHeight: 1, color: pal.inkSubtle }}>
              <InlineText as="span" value={row.index || pad2(index + 1)} onUpdate={onPatch ? (v) => onPatch({ index: v }) : undefined} />
            </b>
            <InlineText as="span" value={row.kicker} onUpdate={onPatch ? (v) => onPatch({ kicker: v }) : undefined} />
          </p>
        )}
        <h3 className="mt-3.5 max-w-[16ch]" style={{ ...mintDisplay("clamp(1.35rem, 2.2vw, 1.85rem)", ink), letterSpacing: "-0.025em" }}>
          <InlineText as="span" value={row.title} onUpdate={onPatch ? (v) => onPatch({ title: v }) : undefined} multiline />
        </h3>
        {(row.body || isEditor) && (
          <p className="mt-3.5 max-w-[42ch] text-[16.5px] leading-[1.55]" style={{ color: muted, margin: "14px 0 0" }}>
            <InlineText as="span" value={row.body} onUpdate={onPatch ? (v) => onPatch({ body: v }) : undefined} multiline />
          </p>
        )}
        {stats.length > 0 && (
          <div className="mt-[22px] grid max-w-[420px] grid-cols-2 gap-[18px]" style={{ paddingTop: 18, borderTop: `1px solid ${pal.line}` }}>
            {stats.map((s, j) => (
              <div key={j} className="min-w-0">
                <MintNumber value={s.value} onUpdate={patchStat ? (v) => patchStat(j, { value: v }) : undefined} className="block" style={{ fontFamily: MINT_DISPLAY, fontSize: "1.9rem", letterSpacing: "-0.035em", color: ink }} />
                {(s.label || isEditor) && (
                  <span className="mt-1.5 block text-[12.5px] leading-[1.35]" style={{ color: muted }}>
                    <InlineText as="span" value={s.label} onUpdate={patchStat ? (v) => patchStat(j, { label: v }) : undefined} />
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {(row.linkText || isEditor) && (
          <MintLink href={row.linkUrl || "#"} onClick={mintAnchorClick(row.linkUrl)} color={linkInk} className="mt-5" size={15}>
            <InlineText as="span" value={row.linkText ?? ""} onUpdate={onPatch ? (v) => onPatch({ linkText: v }) : undefined} />
          </MintLink>
        )}
      </motion.div>
    </div>
  );
}

export function BlockMintFeatures({ props, brand, onFieldChange }: Props) {
  const p = { ...MINT_FEATURES_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, "#FFFFFF");
  // The windows stay white on every surface, so their chrome reads from the light palette.
  const winPal = pal.dark ? resolveMintPalette({ backgroundStyle: "white", accentColor: p.accentColor }, brand, "#FFFFFF") : pal;
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const { ref, rise } = useMintReveal<HTMLElement>();

  const field = (key: keyof MintFeaturesBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintFeaturesBlockProps[typeof key] }) : undefined;
  const rows = (p.rows ?? []).slice(0, MINT_FEATURES_MAX_ROWS);
  const updateRow = onFieldChange
    ? (i: number, patch: Partial<MintFeatureRow>) => onFieldChange({ ...props, rows: (p.rows ?? []).map((r, idx) => (idx === i ? { ...r, ...patch } : r)) })
    : undefined;
  const linkInk = pal.dark ? pal.lime : pal.green;

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-features"
      className="mint-features relative overflow-hidden"
      style={{ background: pal.bg, color: pal.ink, fontFamily: MINT_BODY, ...MINT_SECTION_PAD }}
    >
      <style>{MINT_CSS}{`
        @keyframes mint-feat-sweep { 0% { top: -30%; } 60% { top: 100%; } 100% { top: 100%; } }
        [data-block="mint-features"] .mint-sweep { animation: mint-feat-sweep 5s cubic-bezier(.16,1,.3,1) infinite; }
        @media (prefers-reduced-motion: reduce) { [data-block="mint-features"] .mint-sweep { animation: none; display: none; } }
      `}</style>
      <div className={MINT_WIDE}>
        <MintSectionHeader
          eyebrow={(p.eyebrow || isEditor) ? (
            <motion.div {...rise(0, 14)}>
              <MintEyebrow
                palette={pal}
                suffix={(p.eyebrowSuffix || isEditor) ? <InlineText as="span" value={p.eyebrowSuffix ?? ""} onUpdate={field("eyebrowSuffix")} /> : undefined}
              >
                <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
              </MintEyebrow>
            </motion.div>
          ) : undefined}
          headline={(
            <motion.h2 {...rise(0.05, 18)} className="max-w-[20ch]" style={mintDisplay("clamp(1.9rem, 3.6vw, 3rem)", pal.heading)}>
              <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
            </motion.h2>
          )}
          sub={(p.subheadline || isEditor) ? (
            <motion.p {...rise(0.1, 18)} className="max-w-[46ch]" style={{ fontFamily: MINT_BODY, fontSize: "clamp(1.05rem, 1.4vw, 1.25rem)", lineHeight: 1.5, color: pal.inkMuted, margin: "12px 0 0", textWrap: "pretty" } as React.CSSProperties}>
              <InlineText as="span" value={p.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
            </motion.p>
          ) : undefined}
          link={(p.headerLinkText || isEditor) ? (
            <motion.div {...rise(0.15, 14)}>
              <MintLink href={p.headerLinkUrl || "#"} onClick={isEditor ? (e) => e.preventDefault() : mintAnchorClick(p.headerLinkUrl)} color={linkInk} size={15} className="whitespace-nowrap">
                <InlineText as="span" value={p.headerLinkText ?? ""} onUpdate={field("headerLinkText")} />
              </MintLink>
            </motion.div>
          ) : undefined}
        />
        {rows.length > 0 && (
          <div>
            {rows.map((row, i) => (
              <FeatureRow
                key={i}
                row={row}
                index={i}
                pal={pal}
                winPal={winPal}
                isEditor={isEditor}
                reduced={reduced}
                staticRender={staticRender}
                onPatch={updateRow ? (patch) => updateRow(i, patch) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
