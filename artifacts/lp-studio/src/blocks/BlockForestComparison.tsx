import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { contrastTextColor, isValidHex, relativeLuminance } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_CTA_DEFAULTS, FOREST_DISPLAY, FOREST_SECTION_PAD,
  ForestCtaButtons, ForestEyebrow, resolveForestPalette, useForestReveal,
  type ForestCtaProps, type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Comparison — type "forest-comparison"  (DSO Page family, Nov 2026)
 *
 * "Side by side": a white band, eyebrow + headline, then a rounded elevated
 * card holding a horizontally scrollable table. The bone thead carries 11px
 * uppercase headers; the provider column's header is painted the brand
 * primary with accent text, and its cells are tinted with the accent, set in
 * 500-weight accent ink with a 3px accent bar on the left. A cell value that
 * starts with "✓ " renders a check icon in front of the rest. Optional CTA
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
  firstColumnLabel?: string;
  providerLabel?: string;
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
  firstColumnLabel: "Per location",
  providerLabel: "Our platform",
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

/** A table cell: inline-editable, with the "✓ " prefix rendered as a check icon. */
function Cell({ value, onUpdate, color }: { value: string; onUpdate?: (v: string) => void; color: string }) {
  const checked = value.startsWith(CHECK_PREFIX);
  const rest = checked ? value.slice(CHECK_PREFIX.length) : value;
  if (!checked) return <InlineText as="span" value={value} onUpdate={onUpdate} multiline />;
  return (
    <span className="inline-flex items-center gap-2">
      <Check className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden style={{ color }} />
      <InlineText as="span" value={rest} onUpdate={onUpdate ? (v) => onUpdate(CHECK_PREFIX + v) : undefined} multiline />
    </span>
  );
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

  const cardBg = pal.dark ? pal.card : "#FFFFFF";
  const hairline = pal.dark ? "rgba(255,252,239,0.14)" : pal.hairline;
  // The provider header: the brand primary (the artifact's forest) with the accent on top; falls back to the heading ink.
  const primary = isValidHex(brand.primaryColor) ? brand.primaryColor : pal.heading;
  const headBg = pal.dark ? pal.deep : primary;
  const headInk = isValidHex(headBg) && relativeLuminance(headBg) < 0.4
    ? (isValidHex(pal.accentDeco) ? pal.accentDeco : pal.accent)
    : contrastTextColor(headBg);
  const showCta = !!p.ctaText || !!p.ctaSecondaryText || isEditor;

  const thBase: React.CSSProperties = { textAlign: "left", padding: "26px 22px 18px", borderBottom: `1px solid ${hairline}`, verticalAlign: "top", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: pal.muted, fontWeight: 600, background: pal.panel };
  const tdBase: React.CSSProperties = { textAlign: "left", padding: "20px 22px", borderBottom: `1px solid ${hairline}`, verticalAlign: "top" };

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="forest-comparison"
      className="forest-comparison relative"
      style={{ background: pal.bg, color: pal.text, fontFamily: FOREST_BODY, ...FOREST_SECTION_PAD }}
    >
      <style>{FOREST_CSS}</style>
      <div className={FOREST_CONTAINER}>
        {(p.eyebrow || isEditor) && (
          <motion.div {...rise(0)}>
            <ForestEyebrow palette={pal}>
              <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
            </ForestEyebrow>
          </motion.div>
        )}
        <motion.h2
          {...rise(0.08)}
          className="max-w-[18ch]"
          style={{ fontFamily: FOREST_DISPLAY, fontSize: "clamp(2rem, 4vw, 3.25rem)", lineHeight: 1.1, letterSpacing: "-0.03em", fontWeight: 400, color: pal.heading, margin: "18px 0 0", textWrap: "balance" } as React.CSSProperties}
        >
          <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
        </motion.h2>

        <motion.div {...rise(0.16)} className="cmp mt-11 overflow-hidden rounded-[28px]" style={{ background: cardBg, boxShadow: pal.shadowElev, border: `1px solid ${hairline}` }}>
          <div className="cmp-scroll overflow-x-auto">
            <table className="w-full border-collapse text-[15px]" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th scope="col" style={thBase}>
                    <InlineText as="span" value={p.firstColumnLabel ?? ""} onUpdate={field("firstColumnLabel")} />
                  </th>
                  <th scope="col" style={{ ...thBase, background: headBg, color: headInk }}>
                    <InlineText as="span" value={p.providerLabel ?? ""} onUpdate={field("providerLabel")} />
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
                      <td style={{ ...tdBase, borderBottom: border, fontWeight: 500, color: pal.text }}>
                        <Cell value={r.need} onUpdate={updateRow ? (v) => updateRow(i, { need: v }) : undefined} color={pal.accent} />
                      </td>
                      <td className="relative" style={{ ...tdBase, borderBottom: border, background: pal.accentTint, color: pal.accent, fontWeight: 500 }}>
                        <span aria-hidden className="absolute bottom-0 left-0 top-0 w-[3px]" style={{ background: pal.accentDeco }} />
                        <Cell value={r.provider} onUpdate={updateRow ? (v) => updateRow(i, { provider: v }) : undefined} color={pal.accent} />
                      </td>
                      <td style={{ ...tdBase, borderBottom: border, color: pal.muted }}>
                        <Cell value={r.b} onUpdate={updateRow ? (v) => updateRow(i, { b: v }) : undefined} color={pal.muted} />
                      </td>
                      {showC && (
                        <td style={{ ...tdBase, borderBottom: border, color: pal.muted }}>
                          <Cell value={r.c ?? ""} onUpdate={updateRow ? (v) => updateRow(i, { c: v }) : undefined} color={pal.muted} />
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
          <motion.div {...rise(0.24)} className={cn("mt-10")}>
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
