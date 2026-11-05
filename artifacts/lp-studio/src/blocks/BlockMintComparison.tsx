import { motion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import {
  MINT_BODY, MINT_CSS, MINT_CTA_DEFAULTS, MINT_GREY, MINT_SECTION_PAD, MINT_WRAP,
  MintCheckDot, MintCtaButtons, mintDisplay, resolveMintPalette, useMintReveal,
  type MintCtaProps, type MintPalette, type MintStyleProps,
} from "./mint/mint-theme";

/* ----------------------------------------------------------------------------
 * Mint Comparison — type "mint-comparison"  (DSO Page (Light) family, Nov 2026)
 *
 * "What a lab partner should cost a DSO.": a pale grey band, a centred
 * display headline, then a plain hairline table in a horizontal-scroll
 * wrapper (min 680px, 15px). The thead is 13px muted with the provider
 * header in ink; rows carry 18px padding and hairline borders (none on
 * the last); the first column is muted at 24% width; provider cells are
 * ink at 500 with a green check dot in front when the value starts with
 * "✓ "; the other columns are muted. Optional chevron links sit centred
 * under the table through the CTA suite.
 * -------------------------------------------------------------------------- */

export interface MintComparisonRow {
  /** First column: the need ("Scanner", "Contract"). */
  need: string;
  /** The provider column. Prefix with "✓ " to render the check dot. */
  provider: string;
  b: string;
  c?: string;
}

export interface MintComparisonBlockProps extends MintStyleProps, MintCtaProps {
  headline: string;
  firstColumnLabel?: string;
  providerLabel?: string;
  columnBLabel?: string;
  columnCLabel?: string;
  showColumnC?: boolean;
  /** 2–10 rows. */
  rows: MintComparisonRow[];
  anchorId?: string;
}

interface Props {
  props: MintComparisonBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MintComparisonBlockProps) => void;
}

export const MINT_COMPARISON_MIN_ROWS = 2;
export const MINT_COMPARISON_MAX_ROWS = 10;

export const MINT_COMPARISON_DEFAULT_PROPS: MintComparisonBlockProps = {
  ...MINT_CTA_DEFAULTS,
  headline: "What a lab partner should cost a DSO.",
  firstColumnLabel: "Per location",
  providerLabel: "Our platform",
  columnBLabel: "Traditional lab network",
  columnCLabel: "In-office milling",
  showColumnC: true,
  rows: [
    { need: "Scanner", provider: "✓ Included, $0 CapEx", b: "$40–75K purchase or lease", c: "$55–75K mill plus scanner" },
    { need: "Existing scanners", provider: "✓ Stated policy for the major scanner fleets", b: "Varies by lab", c: "Closed system" },
    { need: "Network visibility", provider: "✓ By provider and office", b: "Invoices, reconciled by hand", c: "Per-machine logs" },
    { need: "Remakes", provider: "✓ Caught at the chair; first-fit tracked by office", b: "Credit after the fact", c: "Your staff, your time" },
    { need: "Rollout", provider: "✓ Rollout lead, training day, 90-day review", b: "Local rep", c: "Design labor per site" },
    { need: "Where it's made", provider: "✓ Two domestic sites", b: "Often partly offshore", c: "In the operatory" },
    { need: "Contract", provider: "✓ Month to month", b: "Annual, volume commitments", c: "Capital lease" },
  ],
  anchorId: "compare",
  backgroundStyle: "light-gray",
};

const CHECK_PREFIX = "✓ ";

/** A table cell: inline-editable, with the "✓ " prefix rendered as the green check dot. */
function Cell({ value, onUpdate, palette }: { value: string; onUpdate?: (v: string) => void; palette: MintPalette }) {
  const checked = value.startsWith(CHECK_PREFIX);
  const rest = checked ? value.slice(CHECK_PREFIX.length) : value;
  if (!checked) return <InlineText as="span" value={value} onUpdate={onUpdate} multiline />;
  return (
    <span className="inline">
      <MintCheckDot palette={palette} className="mr-2 align-[-3px]" />
      <InlineText as="span" value={rest} onUpdate={onUpdate ? (v) => onUpdate(CHECK_PREFIX + v) : undefined} multiline />
    </span>
  );
}

export function BlockMintComparison({ props, brand, pageId, variantId, onCtaClick, onFieldChange }: Props) {
  const p = { ...MINT_COMPARISON_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, MINT_GREY);
  const isEditor = !!onFieldChange;
  const { ref, rise } = useMintReveal<HTMLElement>();

  const rows = (p.rows ?? []).slice(0, MINT_COMPARISON_MAX_ROWS);
  const showC = p.showColumnC !== false;

  const field = (key: keyof MintComparisonBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintComparisonBlockProps[typeof key] }) : undefined;
  const updateRow = onFieldChange
    ? (i: number, patch: Partial<MintComparisonRow>) => onFieldChange({ ...props, rows: (p.rows ?? []).map((r, idx) => (idx === i ? { ...r, ...patch } : r)) })
    : undefined;

  const heading = p.headingColor && isValidHex(p.headingColor) ? pal.heading : pal.ink;
  const ink = pal.ink;
  const muted = pal.inkMuted;
  const line = pal.line;
  const showCta = !!p.ctaText || !!p.ctaSecondaryText || isEditor;

  const thBase: React.CSSProperties = { textAlign: "left", padding: "18px 16px 14px 0", borderBottom: `1px solid ${line}`, verticalAlign: "top", fontSize: 13, fontWeight: 500, color: muted };
  const tdBase: React.CSSProperties = { textAlign: "left", padding: "18px 16px 18px 0", borderBottom: `1px solid ${line}`, verticalAlign: "top" };

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-comparison"
      className="mint-comparison relative"
      style={{ background: pal.bg, color: ink, fontFamily: MINT_BODY, ...MINT_SECTION_PAD }}
    >
      <style>{MINT_CSS}</style>
      <div className={MINT_WRAP}>
        <div className="text-center">
          <motion.h2 {...rise(0, 18)} className="mx-auto" style={mintDisplay("clamp(2rem, 4.2vw, 3.4rem)", heading)}>
            <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
          </motion.h2>
        </div>

        <motion.div {...rise(0.1, 18)} className="cmp overflow-x-auto" style={{ marginTop: "clamp(36px, 5vw, 56px)" }}>
          <table className="w-full border-collapse text-[15px]" style={{ minWidth: 680 }}>
            <thead>
              <tr>
                <th scope="col" style={{ ...thBase, width: "24%" }}>
                  <InlineText as="span" value={p.firstColumnLabel ?? ""} onUpdate={field("firstColumnLabel")} />
                </th>
                <th scope="col" style={{ ...thBase, color: ink }}>
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
                const border = last ? "0" : `1px solid ${line}`;
                return (
                  <tr key={i}>
                    <td style={{ ...tdBase, borderBottom: border, color: muted, width: "24%" }}>
                      <Cell value={r.need} onUpdate={updateRow ? (v) => updateRow(i, { need: v }) : undefined} palette={pal} />
                    </td>
                    <td style={{ ...tdBase, borderBottom: border, color: ink, fontWeight: 500 }}>
                      <Cell value={r.provider} onUpdate={updateRow ? (v) => updateRow(i, { provider: v }) : undefined} palette={pal} />
                    </td>
                    <td style={{ ...tdBase, borderBottom: border, color: muted }}>
                      <Cell value={r.b} onUpdate={updateRow ? (v) => updateRow(i, { b: v }) : undefined} palette={pal} />
                    </td>
                    {showC && (
                      <td style={{ ...tdBase, borderBottom: border, color: muted }}>
                        <Cell value={r.c ?? ""} onUpdate={updateRow ? (v) => updateRow(i, { c: v }) : undefined} palette={pal} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>

        {showCta && (
          <motion.div {...rise(0.2, 18)} className="mt-10">
            <MintCtaButtons
              props={p}
              brand={brand}
              palette={pal}
              pageId={pageId}
              variantId={variantId}
              onCtaClick={onCtaClick}
              onLabelChange={onFieldChange ? (k, v) => onFieldChange({ ...props, [k]: v }) : undefined}
              source="mint-comparison"
              align="center"
              style="link"
              primaryPlaceholder="Talk to the enterprise team"
              secondaryPlaceholder="See the proof"
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}
