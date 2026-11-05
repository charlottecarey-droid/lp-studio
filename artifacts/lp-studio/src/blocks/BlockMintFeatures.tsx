import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  MINT_BODY, MINT_CSS, MINT_DISPLAY, MINT_EASE, MINT_SECTION_PAD, MINT_WIDE, MINT_WRAP,
  MintCheckDot, MintKicker, MintLink, MintNumber, mintAnchorClick, mintDisplay, mintSub, resolveMintPalette, useMintReveal,
  type MintPalette, type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Features — type "mint-features"  (DSO Page (Light) family, Nov 2026)
 *
 * "Four parts. One system." A centred display headline and sub in the
 * reading column, then a wide stack of feature rows: two columns from 860px
 * that alternate visual-left / visual-right, a hairline between rows. The
 * text column carries a lime-dot kicker, a 16ch h3, 40ch body, an optional
 * big number with a label and a quiet chevron link. The visual column is a
 * 5:4 photo or one of three small "UI mock" cards on a tinted stage: an
 * invoice (soft lime), a bar chart by office (mint) or a scan photo with a
 * progress ring and a glass checklist (mint).
 *
 * Reveal contract (fail-open): each row has its own useMintReveal; the bars,
 * the ring and the checklist are CSS transitions gated on that flag; the
 * static render and reduced motion paint the final frame.
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

export interface MintFeatureRow {
  /** Short label above the title ("Adoption"). */
  kicker: string;
  title: string;
  body: string;
  statValue?: string;
  statLabel?: string;
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
  /** invoice + bars: card header left / right. */
  mockTitle?: string;
  mockMeta?: string;
  /** invoice: small uppercase label over the total. bars: footer text. */
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
  headline: string;
  subheadline?: string;
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

export const MINT_FEATURES_DEFAULT_PROPS: MintFeaturesBlockProps = {
  headline: "Four parts. One system.",
  subheadline: "Adoption, economics, visibility and consistency, built as one lab rather than four vendors.",
  rows: [
    {
      kicker: "Adoption",
      title: "Change your doctors choose.",
      body: "A scanner in every operatory, a technician on every case, and training in the office on day one. Doctors switch because the work is better, not because they were told to.",
      statValue: "70%",
      statLabel: "of practices activate on training day",
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
      statValue: "$0",
      statLabel: "scanner CapEx per location",
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
      statValue: "98%",
      statLabel: "first-fit across the network",
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
const RING_C = 138; // 2π·22, the artifact's dasharray

/** The small lime pill inside the mocks ("vs $40–75K", "1 office to coach"). */
function Pill({ pal, value, onUpdate }: { pal: MintPalette; value: string; onUpdate?: (v: string) => void }) {
  return (
    <span className="inline-block rounded-full px-2 py-[3px] text-[11px] font-semibold leading-[1.3]" style={{ background: pal.lime, color: pal.onLime }}>
      <InlineText as="span" value={value} onUpdate={onUpdate} />
    </span>
  );
}

/** Card header: bold title left, muted meta right. */
function MockHeader({ pal, title, meta, onTitle, onMeta, isEditor }: { pal: MintPalette; title?: string; meta?: string; onTitle?: (v: string) => void; onMeta?: (v: string) => void; isEditor: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px] font-semibold">
      <InlineText as="span" value={title ?? ""} onUpdate={onTitle} />
      {(meta || isEditor) && (
        <span className="text-[12px] font-medium" style={{ color: pal.inkMuted }}>
          <InlineText as="span" value={meta ?? ""} onUpdate={onMeta} />
        </span>
      )}
    </div>
  );
}

interface RowProps {
  row: MintFeatureRow;
  index: number;
  pal: MintPalette;
  isEditor: boolean;
  reduced: boolean;
  staticRender: boolean;
  onPatch?: (patch: Partial<MintFeatureRow>) => void;
}

function FeatureRow({ row, index, pal, isEditor, reduced, staticRender, onPatch }: RowProps) {
  const { ref, show, rise } = useMintReveal<HTMLDivElement>("-40px");
  const settled = show || staticRender || reduced;
  const noMotion = reduced || staticRender;
  const side: "left" | "right" = row.visualSide ?? (index % 2 === 0 ? "left" : "right");
  const visualRight = side === "right";
  const ink = pal.ink;
  const muted = pal.inkMuted;
  const cardInk = "#1D1D1F";
  const cardMuted = "#6E6E73";

  const patchLine = onPatch ? (j: number, patch: Partial<MintFeatureLine>) => onPatch({ lines: (row.lines ?? []).map((l, k) => (k === j ? { ...l, ...patch } : l)) }) : undefined;
  const patchBar = onPatch ? (j: number, patch: Partial<MintFeatureBar>) => onPatch({ bars: (row.bars ?? []).map((b, k) => (k === j ? { ...b, ...patch } : b)) }) : undefined;
  const patchCheck = onPatch ? (j: number, patch: Partial<MintFeatureCheck>) => onPatch({ checks: (row.checks ?? []).map((c, k) => (k === j ? { ...c, ...patch } : c)) }) : undefined;

  const stage = (bg: string, children: React.ReactNode) => (
    <div className="relative grid place-items-center overflow-hidden rounded-[20px]" style={{ background: bg, aspectRatio: "5 / 4", padding: "clamp(18px, 3vw, 34px)" }}>
      {children}
    </div>
  );
  const card = (children: React.ReactNode) => (
    <div className="w-full max-w-[420px] rounded-[16px] bg-white px-[22px] py-5 text-[13px]" style={{ color: cardInk, boxShadow: "0 12px 40px rgba(0,38,31,.10)", fontFamily: MINT_BODY }}>
      {children}
    </div>
  );

  let visual: React.ReactNode;
  if (row.visual === "invoice") {
    const lines = (row.lines ?? []).slice(0, MINT_FEATURES_MAX_LINES);
    visual = stage(pal.limeSoft, card(
      <>
        <MockHeader pal={pal} title={row.mockTitle} meta={row.mockMeta} onTitle={onPatch ? (v) => onPatch({ mockTitle: v }) : undefined} onMeta={onPatch ? (v) => onPatch({ mockMeta: v }) : undefined} isEditor={isEditor} />
        {lines.length > 0 && (
          <div className="mt-3.5 grid gap-2.5">
            {lines.map((l, j) => {
              const last = j === lines.length - 1;
              return (
                <div key={j} className="flex items-baseline justify-between gap-3 text-[13px]" style={{ paddingBottom: last ? 0 : 10, borderBottom: last ? 0 : `1px solid ${pal.line}`, fontWeight: last ? 600 : 400 }}>
                  <span><InlineText as="span" value={l.label} onUpdate={patchLine ? (v) => patchLine(j, { label: v }) : undefined} /></span>
                  <b className="tabular-nums" style={{ fontWeight: l.emphasis ? 600 : 500, color: l.emphasis ? pal.green : cardInk }}>
                    <InlineText as="span" value={l.value} onUpdate={patchLine ? (v) => patchLine(j, { value: v }) : undefined} />
                  </b>
                </div>
              );
            })}
          </div>
        )}
        {(row.mockFooterLabel || isEditor) && (
          <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: cardMuted }}>
            <InlineText as="span" value={row.mockFooterLabel ?? ""} onUpdate={onPatch ? (v) => onPatch({ mockFooterLabel: v }) : undefined} />
          </div>
        )}
        {(row.mockTotal || row.mockPill || isEditor) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5" style={{ fontFamily: MINT_DISPLAY, fontSize: "2.2rem", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
            <InlineText as="span" value={row.mockTotal ?? ""} onUpdate={onPatch ? (v) => onPatch({ mockTotal: v }) : undefined} />
            {(row.mockPill || isEditor) && <Pill pal={pal} value={row.mockPill ?? ""} onUpdate={onPatch ? (v) => onPatch({ mockPill: v }) : undefined} />}
          </div>
        )}
      </>,
    ));
  } else if (row.visual === "bars") {
    const bars = (row.bars ?? []).slice(0, MINT_FEATURES_MAX_BARS);
    visual = stage(pal.mint, card(
      <>
        <MockHeader pal={pal} title={row.mockTitle} meta={row.mockMeta} onTitle={onPatch ? (v) => onPatch({ mockTitle: v }) : undefined} onMeta={onPatch ? (v) => onPatch({ mockMeta: v }) : undefined} isEditor={isEditor} />
        {bars.length > 0 && (
          <div className="mt-3.5 grid gap-2.5">
            {bars.map((b, j) => (
              <div key={j} className="grid grid-cols-[72px_minmax(0,1fr)_44px] items-center gap-2.5 text-[12.5px] sm:grid-cols-[96px_minmax(0,1fr)_44px]">
                <em className="truncate not-italic" style={{ color: cardMuted }}>
                  <InlineText as="span" value={b.label} onUpdate={patchBar ? (v) => patchBar(j, { label: v }) : undefined} />
                </em>
                <div className="h-2 overflow-hidden rounded-[4px]" style={{ background: pal.mint2 }}>
                  <i className="block h-full rounded-[4px]" style={{ background: b.bad ? "#D97A5B" : pal.green, width: settled ? `${clampPct(b.pct, 40)}%` : 0, transition: noMotion ? "none" : `width 1.4s ${EASE}` }} />
                </div>
                <b className="text-right font-medium tabular-nums">
                  <InlineText as="span" value={b.value} onUpdate={patchBar ? (v) => patchBar(j, { value: v }) : undefined} />
                </b>
              </div>
            ))}
          </div>
        )}
        {(row.mockFooterLabel || row.mockPill || isEditor) && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px]" style={{ color: cardMuted }}>
            <span><InlineText as="span" value={row.mockFooterLabel ?? ""} onUpdate={onPatch ? (v) => onPatch({ mockFooterLabel: v }) : undefined} /></span>
            {(row.mockPill || isEditor) && <Pill pal={pal} value={row.mockPill ?? ""} onUpdate={onPatch ? (v) => onPatch({ mockPill: v }) : undefined} />}
          </div>
        )}
      </>,
    ));
  } else if (row.visual === "scan") {
    const checks = (row.checks ?? []).slice(0, MINT_FEATURES_MAX_CHECKS);
    const pct = clampPct(row.ringPct, 98);
    const offset = settled ? RING_C * (1 - pct / 100) : RING_C;
    visual = stage(pal.mint, (
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-[16px]" style={{ boxShadow: "0 12px 40px rgba(0,38,31,.12)", background: pal.mint2 }}>
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
        {/* progress ring */}
        <div className="absolute right-3.5 top-3.5 h-[54px] w-[54px] rounded-full" style={{ background: `color-mix(in srgb, ${pal.deep} 60%, transparent)`, backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} aria-label={`${pct}%`} role="img">
          <svg viewBox="0 0 54 54" width="54" height="54" style={{ transform: "rotate(-90deg)" }} aria-hidden>
            <circle cx="27" cy="27" r="22" fill="none" strokeWidth="5" stroke="rgba(255,255,255,.5)" />
            <circle cx="27" cy="27" r="22" fill="none" strokeWidth="5" stroke={pal.lime} strokeDasharray={RING_C} strokeDashoffset={offset} style={{ transition: noMotion ? "none" : `stroke-dashoffset 1.6s ${EASE}` }} />
          </svg>
          <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums" style={{ color: pal.cream }}>{pct}%</span>
        </div>
        {/* glass checklist */}
        {checks.length > 0 && (
          <div className="absolute bottom-3.5 left-3.5 right-3.5 grid gap-[7px] rounded-[12px] px-3.5 py-3 text-[12.5px]" style={{ background: "rgba(255,255,255,.92)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", color: cardInk }}>
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
      <div className="relative overflow-hidden rounded-[20px]" style={{ aspectRatio: "5 / 4", background: contain ? pal.mint : pal.grey }}>
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
      </div>
    );
  }

  const linkInk = pal.dark ? pal.lime : pal.green;

  return (
    <div
      ref={ref}
      className="grid items-center gap-7 min-[860px]:grid-cols-2 min-[860px]:gap-16"
      style={{ paddingBlock: "clamp(40px, 5vw, 64px)", borderTop: index > 0 ? `1px solid ${pal.line}` : undefined }}
      data-visual={row.visual}
      data-side={side}
    >
      <motion.div {...rise(0, 18)} className={cn("min-w-0", visualRight ? "min-[860px]:order-2" : "min-[860px]:order-1")}>
        {visual}
      </motion.div>
      <motion.div {...rise(0.1, 18)} className={cn("min-w-0", visualRight ? "min-[860px]:order-1" : "min-[860px]:order-2")}>
        {(row.kicker || isEditor) && (
          <MintKicker palette={pal}>
            <InlineText as="span" value={row.kicker} onUpdate={onPatch ? (v) => onPatch({ kicker: v }) : undefined} />
          </MintKicker>
        )}
        <h3 className="mt-3 max-w-[16ch]" style={{ ...mintDisplay("clamp(1.5rem, 2.6vw, 2.1rem)", ink), letterSpacing: "-0.025em", lineHeight: 1.12 }}>
          <InlineText as="span" value={row.title} onUpdate={onPatch ? (v) => onPatch({ title: v }) : undefined} multiline />
        </h3>
        {(row.body || isEditor) && (
          <p className="mt-4 max-w-[40ch] text-[17px] leading-[1.5]" style={{ color: muted }}>
            <InlineText as="span" value={row.body} onUpdate={onPatch ? (v) => onPatch({ body: v }) : undefined} multiline />
          </p>
        )}
        {(row.statValue || isEditor) && (
          <div className="mt-[22px] flex flex-wrap items-baseline gap-2.5">
            <MintNumber value={row.statValue ?? ""} onUpdate={onPatch ? (v) => onPatch({ statValue: v }) : undefined} style={{ fontFamily: MINT_DISPLAY, fontSize: "2.4rem", letterSpacing: "-0.035em", color: ink }} />
            {(row.statLabel || isEditor) && (
              <span className="text-[14px]" style={{ color: muted }}>
                <InlineText as="span" value={row.statLabel ?? ""} onUpdate={onPatch ? (v) => onPatch({ statLabel: v }) : undefined} />
              </span>
            )}
          </div>
        )}
        {(row.linkText || isEditor) && (
          <MintLink href={row.linkUrl || "#"} onClick={mintAnchorClick(row.linkUrl)} color={linkInk} className="mt-[18px]" size={15}>
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

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-features"
      className="mint-features relative overflow-hidden"
      style={{ background: pal.bg, color: pal.ink, fontFamily: MINT_BODY, ...MINT_SECTION_PAD }}
    >
      <style>{MINT_CSS}</style>
      <div className={cn(MINT_WRAP, "text-center")}>
        <motion.h2 {...rise(0, 18)} className="mx-auto" style={mintDisplay("clamp(2rem, 4.2vw, 3.4rem)", pal.heading)}>
          <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
        </motion.h2>
        {(p.subheadline || isEditor) && (
          <motion.p {...rise(0.1, 18)} className="mx-auto" style={mintSub(pal.inkMuted)}>
            <InlineText as="span" value={p.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
          </motion.p>
        )}
      </div>
      {rows.length > 0 && (
        <div className={MINT_WIDE} style={{ marginTop: "clamp(24px, 3vw, 40px)" }}>
          {rows.map((row, i) => (
            <FeatureRow
              key={i}
              row={row}
              index={i}
              pal={pal}
              isEditor={isEditor}
              reduced={reduced}
              staticRender={staticRender}
              onPatch={updateRow ? (patch) => updateRow(i, patch) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
