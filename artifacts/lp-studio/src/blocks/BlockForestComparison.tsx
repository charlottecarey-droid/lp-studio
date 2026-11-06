import { motion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { contrastTextColor, isValidHex, relativeLuminance } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_CTA_DEFAULTS,
  ForestCtaButtons, ForestDash, ForestEyebrow, ForestSectionHeader, forestAnchorClick, forestCard, forestDisplay, resolveForestPalette, useForestReveal,
  type ForestCtaProps, type ForestPalette, type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Comparison — type "forest-comparison"  (DSO Page family, Nov 2026)
 *
 * "Side by side": a white band opening with the v2 section header row
 * (eyebrow, 20ch headline, a quiet chevron link on the headline baseline),
 * then a ringed white card holding a horizontally scrollable table. The grey
 * thead carries 11.5px uppercase headers; the provider column's header is
 * painted the brand primary in cream with a small accent sub-label ("The lab
 * and the platform"); its cells carry an accent tint gradient, 500-weight
 * ink and a 2px accent bar. Competitor cells open with a short dash so the
 * provider column reads as the contrast. A cell value that starts with "✓ "
 * renders a small filled check disc in front of the rest. Optional CTA
 * buttons sit centred under the table.
 * -------------------------------------------------------------------------- */

export interface ForestComparisonRow {
  /** First column: the need ("Scanner", "Contract"). */
  need: string;
  /** The highlighted provider column. Prefix with "✓ " to render a check. */
  provider: string;
  b: string;
  c?: string;
}

export interface ForestComparisonBlockProps extends ForestStyleProps, ForestCtaProps {
  eyebrow?: string;
  headline: string;
  /** Quiet link on the headline baseline, right (empty = hidden). */
  headerLinkText?: string;
  headerLinkUrl?: string;
  firstColumnLabel?: string;
  providerLabel?: string;
  /** Small accent line under the provider header ("The lab and the platform"). */
  providerSubLabel?: string;
  columnBLabel?: string;
  columnCLabel?: string;
  showColumnC?: boolean;
  rows: ForestComparisonRow[];
  anchorId?: string;
}

interface Props {
  props: ForestComparisonBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ForestComparisonBlockProps) => void;
}

export const FOREST_COMPARISON_MAX_ROWS = 10;

export const FOREST_COMPARISON_DEFAULT_PROPS: ForestComparisonBlockProps = {
  ...FOREST_CTA_DEFAULTS,
  eyebrow: "Side by side",
  headline: "What a lab partner should cost a group. And what it usually does.",
  headerLinkText: "Full pricing",
  headerLinkUrl: "#",
  firstColumnLabel: "Per location",
  providerLabel: "Our platform",
  providerSubLabel: "The lab and the platform",
  columnBLabel: "Traditional lab network",
  columnCLabel: "In-office milling",
  showColumnC: true,
  rows: [
    { need: "Scanner", provider: "Scanner included at every location, $0 CapEx", b: "$40–75K purchase or lease", c: "$55–75K mill plus scanner" },
    { need: "Works with your existing scanners", provider: "✓ Stated policy for the major scanner fleets", b: "Varies by lab", c: "Closed system" },
    { need: "Network visibility", provider: "Remakes, turnaround, spend by provider and office", b: "Invoices, reconciled by hand", c: "Per-machine logs" },
    { need: "Remake policy", provider: "AI scan check before the case leaves the chair", b: "Remake credit after the fact", c: "Your staff, your time" },
    { need: "Rollout at scale", provider: "Rollout lead, training day on site, 90-day review", b: "Local rep", c: "Design labor hired per site" },
    { need: "Where the work is made", provider: "Two domestic manufacturing sites", b: "Often partly offshore", c: "In the operatory" },
    { need: "Contract", provider: "Month to month", b: "Annual, volume commitments", c: "Capital lease" },
  ],
  anchorId: "compare",
  backgroundStyle: "white",
};

const CHECK_PREFIX = "✓ ";
const SECTION_PAD: React.CSSProperties = { paddingBlock: "clamp(72px, 8vw, 120px)" };

/** The v2 `.link`: 15px/500 with a chevron that nudges on hover; a span in the builder so clicks never navigate. */
function HeaderLink({ text, url, color, onUpdate, isEditor }: { text?: string; url?: string; color: string; onUpdate?: (v: string) => void; isEditor: boolean }) {
  if (!text && !isEditor) return null;
  const cls = "forest-link inline-flex items-center gap-1 whitespace-nowrap text-[15px] font-medium no-underline";
  const style: React.CSSProperties = { color, fontFamily: FOREST_BODY };
  const inner = (
    <>
      <InlineText as="span" value={text ?? ""} onUpdate={onUpdate} />
      <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
    </>
  );
  if (isEditor) return <span className={cls} style={style}>{inner}</span>;
  return <a href={url || "#"} onClick={forestAnchorClick(url)} className={cls} style={style}>{inner}</a>;
}

/** A table cell: inline-editable; "✓ " renders a filled check disc, competitor cells open with a dash. */
function Cell({ value, onUpdate, pal, kind }: { value: string; onUpdate?: (v: string) => void; pal: ForestPalette; kind: "need" | "provider" | "other" }) {
  const checked = value.startsWith(CHECK_PREFIX);
  const rest = checked ? value.slice(CHECK_PREFIX.length) : value;
  if (checked) {
    return (
      <span className="inline">
        <span aria-hidden className="mr-2 inline-grid h-4 w-4 shrink-0 place-items-center rounded-full align-[-3px]" style={{ background: pal.dark ? pal.accentDeco : pal.heading }}>
          <Check className="h-[10px] w-[10px]" strokeWidth={3} style={{ color: pal.dark ? pal.onAccent : "#FFFFFF" }} aria-hidden />
        </span>
        <InlineText as="span" value={rest} onUpdate={onUpdate ? (v) => onUpdate(CHECK_PREFIX + v) : undefined} multiline />
      </span>
    );
  }
  if (kind === "other") {
    return (
      <span className="inline">
        <ForestDash color={pal.dark ? "rgba(255,252,239,0.22)" : pal.hairline} />
        <InlineText as="span" value={value} onUpdate={onUpdate} multiline />
      </span>
    );
  }
  return <InlineText as="span" value={value} onUpdate={onUpdate} multiline />;
}

export function BlockForestComparison({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const p = { ...FOREST_COMPARISON_DEFAULT_PROPS, ...props };
  const pal = resolveForestPalette(p, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const { ref, rise } = useForestReveal<HTMLElement>();

  const rows = (p.rows ?? []).slice(0, FOREST_COMPARISON_MAX_ROWS);
  const showC = p.showColumnC !== false;

  const field = (key: keyof ForestComparisonBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ForestComparisonBlockProps[typeof key] }) : undefined;
  const updateRow = onFieldChange
    ? (i: number, patch: Partial<ForestComparisonRow>) => onFieldChange({ ...props, rows: (p.rows ?? []).map((r, idx) => (idx === i ? { ...r, ...patch } : r)) })
    : undefined;

  const hairline = pal.dark ? "rgba(255,252,239,0.14)" : pal.hairline;
  const accentHex = isValidHex(pal.accentDeco) ? pal.accentDeco : pal.accent;
  // The provider header: the brand primary (the artifact's forest) in cream with the accent sub-label; falls back to the heading ink.
  const primary = isValidHex(brand.primaryColor) ? brand.primaryColor : pal.heading;
  const headBg = pal.dark ? pal.deep : primary;
  const headDark = isValidHex(headBg) && relativeLuminance(headBg) < 0.4;
  const headInk = headDark ? "#FFFCEF" : contrastTextColor(headBg);
  const headEm = headDark ? accentHex : pal.muted;
  const showCta = !!p.ctaText || !!p.ctaSecondaryText || isEditor;

  const thBase: React.CSSProperties = { textAlign: "left", padding: "18px 20px 14px", borderBottom: `1px solid ${hairline}`, verticalAlign: "top", fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.muted, fontWeight: 600, background: pal.panel, lineHeight: 1.3 };
  const tdBase: React.CSSProperties = { textAlign: "left", padding: "18px 20px", borderBottom: `1px solid ${hairline}`, verticalAlign: "top", lineHeight: 1.45 };

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="forest-comparison"
      className="forest-comparison relative"
      style={{ background: pal.bg, color: pal.text, fontFamily: FOREST_BODY, ...SECTION_PAD }}
    >
      <style>{FOREST_CSS}</style>
      <div className={FOREST_CONTAINER}>
        <motion.div {...rise(0)}>
          <ForestSectionHeader
            eyebrow={(p.eyebrow || isEditor) ? (
              <ForestEyebrow palette={pal}>
                <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
              </ForestEyebrow>
            ) : undefined}
            headline={(
              <h2 className="max-w-[20ch]" style={{ ...forestDisplay("clamp(1.9rem, 3.6vw, 3rem)", pal.heading), margin: 0 }}>
                <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
              </h2>
            )}
            link={<HeaderLink text={p.headerLinkText} url={p.headerLinkUrl} color={pal.dark ? pal.accent : pal.heading} onUpdate={field("headerLinkText")} isEditor={isEditor} />}
          />
        </motion.div>

        <motion.div {...rise(0.12)} className="cmp overflow-hidden" style={forestCard(pal, { radius: 20 })}>
          <div className="cmp-scroll overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-[14.5px]" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ ...thBase, width: "22%" }}>
                    <InlineText as="span" value={p.firstColumnLabel ?? ""} onUpdate={field("firstColumnLabel")} />
                  </th>
                  <th scope="col" style={{ ...thBase, background: headBg, color: headInk, borderBottomColor: headBg }}>
                    <InlineText as="span" value={p.providerLabel ?? ""} onUpdate={field("providerLabel")} />
                    {(p.providerSubLabel || isEditor) && (
                      <em className="mt-[3px] block not-italic text-[10px] font-semibold tracking-[0.14em]" style={{ color: headEm }}>
                        <InlineText as="span" value={p.providerSubLabel ?? ""} onUpdate={field("providerSubLabel")} />
                      </em>
                    )}
                  </th>
                  <th scope="col" style={thBase}>
                    <InlineText as="span" value={p.columnBLabel ?? ""} onUpdate={field("columnBLabel")} />
                  </th>
                  {showC && (
                    <th scope="col" style={thBase}>
                      <InlineText as="span" value={p.columnCLabel ?? ""} onUpdate={field("columnCLabel")} />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const last = i === rows.length - 1;
                  const border = last ? "0" : `1px solid ${hairline}`;
                  return (
                    <tr key={i}>
                      <td style={{ ...tdBase, borderBottom: border, fontWeight: 500, color: pal.muted }}>
                        <Cell value={r.need} onUpdate={updateRow ? (v) => updateRow(i, { need: v }) : undefined} pal={pal} kind="need" />
                      </td>
                      <td className="relative" style={{ ...tdBase, borderBottom: border, background: `linear-gradient(90deg, ${pal.accentTint}, color-mix(in srgb, ${accentHex} 5%, transparent))`, color: pal.text, fontWeight: 500 }}>
                        <span aria-hidden className="absolute bottom-0 left-0 top-0 w-[2px]" style={{ background: pal.accentDeco }} />
                        <Cell value={r.provider} onUpdate={updateRow ? (v) => updateRow(i, { provider: v }) : undefined} pal={pal} kind="provider" />
                      </td>
                      <td style={{ ...tdBase, borderBottom: border, color: pal.muted }}>
                        <Cell value={r.b} onUpdate={updateRow ? (v) => updateRow(i, { b: v }) : undefined} pal={pal} kind="other" />
                      </td>
                      {showC && (
                        <td style={{ ...tdBase, borderBottom: border, color: pal.muted }}>
                          <Cell value={r.c ?? ""} onUpdate={updateRow ? (v) => updateRow(i, { c: v }) : undefined} pal={pal} kind="other" />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        {showCta && (
          <motion.div {...rise(0.2)} className={cn("mt-12")}>
            <ForestCtaButtons
              props={p}
              brand={brand}
              palette={pal}
              pageId={pageId}
              variantId={variantId}
              onCtaClick={onCtaClick}
              onLabelChange={onFieldChange ? (k, v) => onFieldChange({ ...props, [k]: v }) : undefined}
              source="forest-comparison"
              align="center"
              primaryPlaceholder="Talk to the enterprise team"
              secondaryPlaceholder="See the proof"
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}
