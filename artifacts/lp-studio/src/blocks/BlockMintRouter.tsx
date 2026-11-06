import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { useStaticRender } from "@/lib/reveal-fallback";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import {
  MINT_BODY, MINT_CSS, MINT_DISPLAY, MINT_RING, MINT_SECTION_PAD, MINT_SHADOW_2, MINT_WIDE, MINT_WRAP,
  MintCheckDot, MintEyebrow, MintKicker, MintLink, MintNumber, MintSectionHeader, mintAnchorClick, mintCard, mintDisplay, resolveMintPalette, useMintReveal,
  type MintPalette, type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Router — type "mint-router"  (DSO Page (Light) family, Nov 2026)
 *
 * "Where is your lab strategy today?" in three layouts:
 *
 *  - "cross" (default): the v2 section header row (eyebrow, h2, right link),
 *    then a 2×2 grid with one vertical and one horizontal hairline through
 *    the middle (each cell gets a bottom hairline on phones). Each cell: an
 *    uppercase lime-dot stage label, a big display quote (the “ ” marks are
 *    drawn; the stored text is the words) and a quiet chevron link. Cells
 *    tint pale grey on hover.
 *  - "rows": the bordered card list (quote, muted description, right link).
 *  - "picker": the v2 "Our lab strategy today is [doctors picking their own
 *    labs ▾]" display sentence. The dropdown (green, 3px lime underline, a
 *    lime caret) lists the cards as numbered options; picking one swaps a
 *    ringed white panel: kicker + h3 + body + lime-check bullets + link on
 *    the left, a grey side with a 16:10 frame image and two stat tiles on
 *    the right. 280ms fade swap (none under reduced motion), Escape closes,
 *    Enter/Space picks, aria-haspopup="listbox". The builder renders the
 *    sentence with `pickerActive` and that card's panel, all inline-editable.
 * -------------------------------------------------------------------------- */

export interface MintRouterStat {
  value: string;
  label: string;
}

export interface MintRouterCard {
  /** Uppercase stage label ("No strategy yet"). */
  stage: string;
  /** The archetype quote, stored WITHOUT quote marks; the live page draws “ ” around it. */
  quote: string;
  /** Muted description (rows layout only). */
  body?: string;
  linkText: string;
  linkUrl?: string;
  /** picker: the bold fragment that completes the sentence ("doctors picking their own labs"); blank = the quote. */
  optionText?: string;
  /** picker: the panel copy. */
  panelTitle?: string;
  panelBody?: string;
  /** picker: 0–4 lime-check bullets. */
  panelBullets?: string[];
  /** picker: the 16:10 frame image on the grey side. */
  imageUrl?: string;
  imageAlt?: string;
  imageFocal?: string;
  /** picker: 0–2 stat tiles under the image. */
  panelStats?: MintRouterStat[];
}

export type MintRouterLayout = "cross" | "rows" | "picker";

export interface MintRouterBlockProps extends MintStyleProps {
  /** Section eyebrow for the cross/rows header row; blank = none. */
  eyebrow?: string;
  eyebrowSuffix?: string;
  headline: string;
  subheadline?: string;
  /** Quiet chevron link at the right of the header row (cross/rows); blank = none. */
  headerLinkText?: string;
  headerLinkUrl?: string;
  /** "cross" = the 2×2 hairline cross (first 4 cards); "rows" = the bordered card list (up to 6); "picker" = the sentence + dropdown + panel. */
  layout?: MintRouterLayout;
  /** picker: the display sentence in front of the dropdown. */
  pickerLead?: string;
  /** picker: the card shown first (and in the builder), 0-based. */
  pickerActive?: number;
  /** 2–6 cards. */
  cards: MintRouterCard[];
  anchorId?: string;
}

interface Props {
  props: MintRouterBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MintRouterBlockProps) => void;
}

export const MINT_ROUTER_MAX_CARDS = 6;
export const MINT_ROUTER_MAX_BULLETS = 4;
export const MINT_ROUTER_MAX_PANEL_STATS = 2;

export const MINT_ROUTER_DEFAULT_PROPS: MintRouterBlockProps = {
  eyebrow: "Starting points",
  eyebrowSuffix: "· Four stages",
  headline: "Where is your lab strategy today?",
  subheadline: "",
  headerLinkText: "",
  headerLinkUrl: "#",
  layout: "cross",
  pickerLead: "Our lab strategy today is",
  pickerActive: 0,
  cards: [
    {
      stage: "No strategy yet",
      quote: "Doctors pick their own labs.",
      body: "You have never priced the category as one line.",
      linkText: "Your first lab strategy",
      linkUrl: "#",
      optionText: "doctors picking their own labs",
      panelTitle: "A plan, a scanner in every office and a dashboard from day one.",
      panelBody: "Lab strategy in a box: scanners with no upfront capital, every staff member trained, a technician on every case, and every location live in under three months.",
      panelBullets: [
        "Start with three locations; your current labs stay during the pilot",
        "Training day on site; most practices activate that day",
        "Month-to-month terms, no scanner CapEx",
      ],
      imageUrl: "",
      imageAlt: "",
      panelStats: [
        { value: "$0", label: "scanner CapEx per location" },
        { value: "90", label: "days to your first executive review" },
      ],
    },
    {
      stage: "Preferred labs",
      quote: "We have a list. Half the network ignores it.",
      body: "Consolidation stalls at the operatory door.",
      linkText: "Consolidation that sticks",
      linkUrl: "#",
      optionText: "a preferred list half the network ignores",
      panelTitle: "Consolidation that sticks because doctors choose it.",
      panelBody: "Replace the list with one lab doctors prefer: a scanner in every operatory, a technician on every case and the same quality in every office.",
      panelBullets: [
        "Office-by-office rollout, no mandate required",
        "Remakes and turnaround by office from the first month",
        "One invoice for the whole group",
      ],
      imageUrl: "",
      imageAlt: "",
      panelStats: [
        { value: "70%", label: "of practices activate on training day" },
        { value: "1", label: "invoice across the group" },
      ],
    },
    {
      stage: "Running a program",
      quote: "We have the contracts. We want outcomes.",
      body: "What you lack is remakes, turnaround and spend by office.",
      linkText: "Benchmark your network",
      linkUrl: "#",
      optionText: "a program we want better outcomes from",
      panelTitle: "Benchmark every office. Coach the ones that need it.",
      panelBody: "Remakes, turnaround, spend and scan quality by provider and by location, so the program has numbers behind it.",
      panelBullets: [
        "A network dashboard with remakes and turnaround by office",
        "Every scan checked at the chair",
        "A quarterly executive review with your account team",
      ],
      imageUrl: "",
      imageAlt: "",
      panelStats: [
        { value: "98%", label: "first-fit across the network" },
        { value: "7", label: "metrics tracked per office" },
      ],
    },
    {
      stage: "Procurement category",
      quote: "Tens of millions in lab spend. Model it.",
      body: "A real procurement team that wants the CFO case, modeled.",
      linkText: "Model it with our team",
      linkUrl: "#",
      optionText: "a procurement category worth millions",
      panelTitle: "Model the lab line with the team that will run it.",
      panelBody: "A CFO-ready model of spend, remakes and chair time across the group, built with your procurement team before the contract.",
      panelBullets: [
        "Group-wide volume pricing, modeled on your case mix",
        "Month-to-month terms, no CapEx",
        "Reporting your finance team can audit",
      ],
      imageUrl: "",
      imageAlt: "",
      panelStats: [
        { value: "1", label: "contract for the whole group" },
        { value: "<3", label: "months to every location live" },
      ],
    },
  ],
  anchorId: "start",
  backgroundStyle: "white",
};

const pad2 = (n: number) => `${n < 10 ? "0" : ""}${n}`;
const SWAP_MS = 280;

/* ── The picker layout ─────────────────────────────────────────────────── */

interface PickerProps {
  p: MintRouterBlockProps;
  pal: MintPalette;
  cards: MintRouterCard[];
  isEditor: boolean;
  reduced: boolean;
  staticRender: boolean;
  rise: ReturnType<typeof useMintReveal>["rise"];
  field: (key: keyof MintRouterBlockProps) => ((v: string) => void) | undefined;
  updateCard?: (i: number, patch: Partial<MintRouterCard>) => void;
}

function Picker({ p, pal, cards, isEditor, reduced, staticRender, rise, field, updateCard }: PickerProps) {
  const clampIdx = (n: number | undefined) => Math.max(0, Math.min(cards.length - 1, Number.isFinite(n) ? (n as number) : 0));
  const configured = clampIdx(p.pickerActive);
  const [active, setActive] = useState(configured);
  const [open, setOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const noMotion = reduced || staticRender;

  // The builder follows the panel setting; the live page keeps the visitor's pick.
  useEffect(() => { if (isEditor) setActive(configured); }, [isEditor, configured]);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ddRef.current && !ddRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const pick = (i: number) => {
    setOpen(false);
    if (i === active) return;
    if (noMotion) { setActive(i); return; }
    setSwapping(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setActive(i); setSwapping(false); }, SWAP_MS);
  };

  const idx = clampIdx(active);
  const card = cards[idx];
  if (!card) return null;
  const patch = updateCard ? (patchCard: Partial<MintRouterCard>) => updateCard(idx, patchCard) : undefined;
  const optionOf = (c: MintRouterCard) => (c.optionText?.trim() ? c.optionText : c.quote);
  const ink = pal.ink;
  const muted = pal.inkMuted;
  const green = pal.dark ? pal.lime : pal.green;
  const linkInk = pal.dark ? pal.lime : pal.green;
  const bullets = (card.panelBullets ?? []).slice(0, MINT_ROUTER_MAX_BULLETS);
  const stats = (card.panelStats ?? []).filter((s) => s.value?.trim() || isEditor).slice(0, MINT_ROUTER_MAX_PANEL_STATS);
  const patchBullet = patch ? (j: number, v: string) => patch({ panelBullets: (card.panelBullets ?? []).map((b, k) => (k === j ? v : b)) }) : undefined;
  const patchStat = patch ? (j: number, s: Partial<MintRouterStat>) => patch({ panelStats: (card.panelStats ?? []).map((x, k) => (k === j ? { ...x, ...s } : x)) }) : undefined;

  const sw: React.CSSProperties = {
    opacity: swapping ? 0 : 1,
    transform: swapping ? "translateY(8px)" : "none",
    transition: noMotion ? "none" : "opacity .35s cubic-bezier(.16,1,.3,1), transform .5s cubic-bezier(.16,1,.3,1)",
  };
  const sideBg = pal.dark ? pal.panel : pal.grey;
  const tileBg = pal.dark ? pal.card : "#FFFFFF";

  const caret = <span aria-hidden className="mint-car" style={{ borderColor: pal.lime }} />;

  return (
    <div className={MINT_WIDE}>
      {/* The sentence */}
      <motion.div
        {...rise(0, 18)}
        className="mint-pick flex flex-wrap items-center justify-center text-center"
        style={{ fontFamily: MINT_DISPLAY, fontSize: "clamp(1.8rem, 3.8vw, 3.1rem)", letterSpacing: "-0.03em", lineHeight: 1.15, color: pal.heading, gap: ".15em .3em" }}
      >
        {(p.pickerLead || isEditor) && (
          <span><InlineText as="span" value={p.pickerLead ?? ""} onUpdate={field("pickerLead")} /></span>
        )}
        <div ref={ddRef} className={cn("mint-dd relative inline-block max-w-full", open && "open")}>
          {isEditor ? (
            <span className="mint-dd-btn" style={{ color: green, borderBottomColor: pal.lime }}>
              <InlineText as="span" value={optionOf(card)} onUpdate={patch ? (v) => patch({ optionText: v }) : undefined} />
              {caret}
            </span>
          ) : (
            <button
              type="button"
              className="mint-dd-btn"
              style={{ color: green, borderBottomColor: pal.lime }}
              aria-haspopup="listbox"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <span>{optionOf(card)}</span>
              {caret}
            </button>
          )}
          {!isEditor && (
            <ul
              className="mint-dd-menu absolute left-1/2 m-0 list-none p-2 text-left"
              role="listbox"
              aria-label={p.headline || "Starting points"}
              style={{ top: "calc(100% + 14px)", minWidth: "min(92vw, 440px)", maxWidth: "calc(100vw - 32px)", background: tileBg, borderRadius: 16, boxShadow: `${MINT_RING}, 0 24px 70px rgba(0,38,31,.18)`, fontFamily: MINT_BODY, fontSize: 15, letterSpacing: 0, lineHeight: 1.3, zIndex: 20 }}
            >
              {cards.map((c, i) => {
                const selected = i === idx;
                const optBg = pal.dark ? "rgba(255,252,239,.10)" : pal.mint;
                const chipBg = selected ? pal.lime : pal.dark ? "rgba(255,252,239,.12)" : pal.grey;
                const chipInk = selected ? pal.onLime : pal.dark ? pal.cream : pal.green;
                return (
                  <li
                    key={i}
                    role="option"
                    aria-selected={selected}
                    tabIndex={open ? 0 : -1}
                    onClick={(e) => { e.stopPropagation(); pick(i); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(i); } }}
                    className="mint-dd-opt grid cursor-pointer items-center gap-x-3 gap-y-0.5 rounded-[10px] px-3.5 py-[13px]"
                    style={{ gridTemplateColumns: "auto minmax(0, 1fr)", background: selected ? optBg : undefined, "--mint-opt-hover": optBg } as CSSProperties}
                  >
                    <span className="row-span-2 grid h-7 w-7 place-items-center rounded-[8px] text-[11px] font-semibold tabular-nums" style={{ background: chipBg, color: chipInk }}>{pad2(i + 1)}</span>
                    <b className="font-medium" style={{ color: pal.dark ? pal.text : "#1D1D1F" }}>{optionOf(c)}</b>
                    <span className="text-[12.5px]" style={{ color: pal.dark ? pal.muted : "#6E6E73" }}>{c.stage}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </motion.div>

      {/* The panel */}
      <motion.div
        {...rise(0.1, 18)}
        className="grid overflow-hidden min-[900px]:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]"
        style={{ ...mintCard(pal, { lift: true }), marginTop: "clamp(36px, 5vw, 56px)" }}
        data-picker-active={idx}
      >
        <div style={{ padding: "clamp(26px, 4vw, 44px)" }}>
          {(card.stage || isEditor) && (
            <div style={sw}>
              <MintKicker palette={pal} uppercase>
                <InlineText as="span" value={card.stage ?? ""} onUpdate={patch ? (v) => patch({ stage: v }) : undefined} />
              </MintKicker>
            </div>
          )}
          {(card.panelTitle || isEditor) && (
            <h3 className="mt-3 max-w-[18ch]" style={{ ...mintDisplay("clamp(1.35rem, 2.2vw, 1.85rem)", ink), letterSpacing: "-0.025em", ...sw }}>
              <InlineText as="span" value={card.panelTitle ?? ""} onUpdate={patch ? (v) => patch({ panelTitle: v }) : undefined} multiline />
            </h3>
          )}
          {(card.panelBody || isEditor) && (
            <p className="max-w-[44ch] text-[16px] leading-[1.55]" style={{ color: muted, margin: "14px 0 0", ...sw }}>
              <InlineText as="span" value={card.panelBody ?? ""} onUpdate={patch ? (v) => patch({ panelBody: v }) : undefined} multiline />
            </p>
          )}
          {bullets.length > 0 && (
            <ul className="m-0 grid list-none gap-2.5 p-0" style={{ marginTop: 18, ...sw }}>
              {bullets.map((b, j) => (
                <li key={j} className="flex items-start gap-2.5 text-[15px] leading-[1.45]" style={{ color: ink }}>
                  <MintCheckDot palette={pal} lime className="mt-[3px]" />
                  <span><InlineText as="span" value={b} onUpdate={patchBullet ? (v) => patchBullet(j, v) : undefined} /></span>
                </li>
              ))}
            </ul>
          )}
          {(card.linkText || isEditor) && (
            <div style={{ marginTop: 22, ...sw }}>
              <MintLink href={card.linkUrl || "#"} color={linkInk} size={15} onClick={isEditor ? (e) => e.preventDefault() : mintAnchorClick(card.linkUrl)}>
                <InlineText as="span" value={card.linkText ?? ""} onUpdate={patch ? (v) => patch({ linkText: v }) : undefined} />
              </MintLink>
            </div>
          )}
        </div>
        <div className="grid content-center gap-3.5 border-t min-[900px]:border-l min-[900px]:border-t-0" style={{ background: sideBg, borderColor: pal.line, padding: "clamp(20px, 3vw, 32px)" }}>
          <div className="relative overflow-hidden rounded-[20px]" style={{ aspectRatio: "16 / 10", background: pal.mint, boxShadow: `${MINT_RING}, ${MINT_SHADOW_2}`, ...sw }}>
            {(card.imageUrl || isEditor) ? (
              <InlineImage
                src={card.imageUrl ?? ""}
                alt={card.imageAlt ?? ""}
                className="h-full w-full object-cover"
                wrapperClassName="absolute inset-0"
                style={{ filter: "saturate(.85)" }}
                focalPoint={card.imageFocal}
                onUpdate={patch ? (v) => patch({ imageUrl: v }) : undefined}
                onAltUpdate={patch ? (v) => patch({ imageAlt: v }) : undefined}
                onFocalUpdate={patch ? (v) => patch({ imageFocal: v }) : undefined}
              />
            ) : (
              <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${pal.mint} 0%, ${pal.mint2} 100%)` }} />
            )}
            <span aria-hidden className="pointer-events-none absolute inset-0 z-[2] rounded-[inherit]" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35)" }} />
          </div>
          {stats.length > 0 && (
            <div className="grid grid-cols-2 gap-3" style={sw}>
              {stats.map((s, j) => (
                <div key={j} className="min-w-0 rounded-[14px] px-4 py-3.5" style={{ background: tileBg, boxShadow: MINT_RING }}>
                  <MintNumber value={s.value} onUpdate={patchStat ? (v) => patchStat(j, { value: v }) : undefined} className="block" style={{ fontFamily: MINT_DISPLAY, fontSize: "1.8rem", letterSpacing: "-0.03em", color: ink }} />
                  {(s.label || isEditor) && (
                    <span className="mt-1.5 block text-[12.5px] leading-[1.35]" style={{ color: muted }}>
                      <InlineText as="span" value={s.label} onUpdate={patchStat ? (v) => patchStat(j, { label: v }) : undefined} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ── The block ──────────────────────────────────────────────────────────── */

export function BlockMintRouter({ props, brand, onFieldChange }: Props) {
  const p = { ...MINT_ROUTER_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const { ref, rise } = useMintReveal<HTMLElement>();
  const layout: MintRouterLayout = p.layout === "rows" ? "rows" : p.layout === "picker" ? "picker" : "cross";

  const cards = (p.cards ?? []).filter((c) => c.quote?.trim() || c.stage?.trim() || isEditor).slice(0, layout === "cross" ? 4 : MINT_ROUTER_MAX_CARDS);
  const field = (key: keyof MintRouterBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintRouterBlockProps[typeof key] }) : undefined;
  const updateCard = onFieldChange
    ? (i: number, patch: Partial<MintRouterCard>) => onFieldChange({ ...props, cards: (p.cards ?? []).map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
    : undefined;

  const ink = pal.ink;
  const muted = pal.inkMuted;
  const linkInk = pal.dark ? pal.lime : pal.green;
  const hoverBg = pal.dark ? pal.panel : pal.grey;


  const quoteText = (c: MintRouterCard, i: number, size: string) => (
    <p className="m-0 max-w-[16ch]" style={{ fontFamily: MINT_DISPLAY, fontSize: size, letterSpacing: "-0.03em", lineHeight: 1.1, color: ink, textWrap: "balance" } as CSSProperties}>
      {isEditor ? (
        <InlineText as="span" value={c.quote} onUpdate={updateCard ? (v) => updateCard(i, { quote: v }) : undefined} multiline />
      ) : (
        <>“{c.quote}”</>
      )}
    </p>
  );

  const header = (
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
          <InlineText as="span" value={p.headline ?? ""} onUpdate={field("headline")} multiline />
        </motion.h2>
      )}
      sub={(p.subheadline || isEditor) ? (
        <motion.p {...rise(0.1, 18)} className="max-w-[46ch]" style={{ fontFamily: MINT_BODY, fontSize: "clamp(1.05rem, 1.4vw, 1.25rem)", lineHeight: 1.5, color: muted, margin: "12px 0 0", textWrap: "pretty" } as CSSProperties}>
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
      gap="0"
    />
  );

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-router"
      data-layout={layout}
      className="mint-router relative"
      style={{ background: pal.bg, color: ink, fontFamily: MINT_BODY, overflowX: "clip", ...MINT_SECTION_PAD }}
    >
      <style>{MINT_CSS}{`
        .mint-cross::before, .mint-cross::after { content: ""; position: absolute; background: ${pal.line}; pointer-events: none; }
        @media (min-width: 720px) {
          .mint-cross::before { left: 50%; top: 0; bottom: 0; width: 1px; }
          .mint-cross::after { top: 50%; left: 0; right: 0; height: 1px; }
          .mint-cq { border-bottom: 0 !important; }
        }
        .mint-cq { transition: background .5s; }
        @media (hover: hover) { .mint-cq:hover { background: var(--mint-cq-hover); } }
        .mint-rrow { transition: transform .5s cubic-bezier(.16,1,.3,1), box-shadow .5s cubic-bezier(.16,1,.3,1); }
        @media (hover: hover) { .mint-rrow:hover { transform: translateY(-2px); box-shadow: ${MINT_RING}, ${MINT_SHADOW_2}; } }
        .mint-dd-btn { font: inherit; background: none; border: 0; padding: 0 .1em; display: inline-flex; align-items: center; gap: .25em; border-bottom: 3px solid; cursor: pointer; line-height: 1.15; white-space: normal; max-width: 100%; text-align: center; transition: background .3s; border-radius: 2px 2px 0 0; }
        span.mint-dd-btn { cursor: text; }
        @media (hover: hover) { button.mint-dd-btn:hover { background: color-mix(in srgb, ${pal.lime} 22%, transparent); } }
        .mint-car { width: .5em; height: .5em; border-right: 3px solid; border-bottom: 3px solid; transform: translateY(-.15em) rotate(45deg); transition: transform .4s cubic-bezier(.16,1,.3,1); flex: none; }
        .mint-dd.open .mint-car { transform: translateY(.1em) rotate(225deg); }
        .mint-dd-menu { opacity: 0; pointer-events: none; transform: translate(-50%, 8px); transition: opacity .35s cubic-bezier(.16,1,.3,1), transform .5s cubic-bezier(.16,1,.3,1); }
        .mint-dd.open .mint-dd-menu { opacity: 1; pointer-events: auto; transform: translate(-50%, 0); }
        .mint-dd-opt { transition: background .2s; }
        @media (hover: hover) { .mint-dd-opt:hover { background: var(--mint-opt-hover) !important; } }
        @media (prefers-reduced-motion: reduce) { .mint-cq, .mint-rrow, .mint-rrow:hover, .mint-dd-btn, .mint-car, .mint-dd-menu, .mint-dd-opt { transition: none; } .mint-rrow:hover { transform: none; } }
      `}</style>

      {layout === "picker" ? (
        <Picker p={p} pal={pal} cards={cards} isEditor={isEditor} reduced={reduced} staticRender={staticRender} rise={rise} field={field} updateCard={updateCard} />
      ) : layout === "cross" ? (
        <div className={MINT_WIDE}>
          {header}
          {cards.length > 0 && (
            <div className="mint-cross relative grid min-[720px]:grid-cols-2" style={{ marginTop: "clamp(28px, 4vw, 44px)" }}>
              {cards.map((c, i) => (
                <motion.div
                  key={i}
                  {...rise(0.1 + i * 0.08, 18)}
                  className="mint-cq flex min-w-0 flex-col gap-[18px]"
                  style={{ padding: "clamp(28px, 4vw, 56px) clamp(8px, 3vw, 48px)", borderBottom: `1px solid ${pal.line}`, "--mint-cq-hover": hoverBg } as CSSProperties}
                >
                  {(c.stage || isEditor) && (
                    <MintKicker palette={pal} uppercase>
                      <InlineText as="span" value={c.stage ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { stage: v }) : undefined} />
                    </MintKicker>
                  )}
                  {quoteText(c, i, "clamp(1.7rem, 3vw, 2.6rem)")}
                  {(c.linkText || isEditor) && (
                    <MintLink
                      href={c.linkUrl || "#"}
                      color={linkInk}
                      size={16}
                      style={{ marginTop: 4 }}
                      onClick={isEditor ? (e) => e.preventDefault() : mintAnchorClick(c.linkUrl)}
                    >
                      <InlineText as="span" value={c.linkText ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { linkText: v }) : undefined} />
                    </MintLink>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={MINT_WRAP}>
          {header}
          {cards.length > 0 && (
            <div className="grid gap-3" style={{ marginTop: "clamp(28px, 4vw, 44px)" }}>
              {cards.map((c, i) => {
                const inner = (
                  <>
                    <div className="min-w-0">
                      {(c.stage || isEditor) && (
                        <MintKicker palette={pal} uppercase className="mb-2.5">
                          <InlineText as="span" value={c.stage ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { stage: v }) : undefined} />
                        </MintKicker>
                      )}
                      {quoteText(c, i, "clamp(1.25rem, 2.2vw, 1.7rem)")}
                      {(c.body || isEditor) && (
                        <p className="mt-1.5 max-w-[60ch] text-[15px] leading-[1.5]" style={{ color: muted, margin: "6px 0 0" }}>
                          <InlineText as="span" value={c.body ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { body: v }) : undefined} multiline />
                        </p>
                      )}
                    </div>
                    {(c.linkText || isEditor) && (
                      isEditor || !c.linkUrl ? (
                        <MintLink href={c.linkUrl || "#"} color={linkInk} size={15} className="whitespace-nowrap" onClick={isEditor ? (e) => e.preventDefault() : mintAnchorClick(c.linkUrl)}>
                          <InlineText as="span" value={c.linkText ?? ""} onUpdate={updateCard ? (v) => updateCard(i, { linkText: v }) : undefined} />
                        </MintLink>
                      ) : (
                        <span className="mint-link whitespace-nowrap" style={{ color: linkInk, fontFamily: MINT_BODY, fontSize: 15 }}>{c.linkText}</span>
                      )
                    )}
                  </>
                );
                const rowClass = "mint-rrow grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 no-underline";
                const rowStyle = { ...mintCard(pal), color: ink, padding: 22 } as const;
                return (
                  <motion.div key={i} {...rise(0.1 + i * 0.06, 18)} className="flex min-w-0">
                    {c.linkUrl && !isEditor ? (
                      <a href={c.linkUrl} onClick={mintAnchorClick(c.linkUrl)} className={rowClass} style={rowStyle}>
                        {inner}
                      </a>
                    ) : (
                      <div className={rowClass} style={rowStyle}>
                        {inner}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
