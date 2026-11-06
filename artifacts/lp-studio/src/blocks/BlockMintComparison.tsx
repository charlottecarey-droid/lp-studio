import { motion } from "framer-motion";
import type { BrandConfig } from "@/lib/brand-config";
import { isValidHex } from "@/lib/brand-config";
import { mixHex } from "@/lib/section-ink";
import { InlineText } from "@/components/InlineText";
import {
  MINT_BODY, MINT_CSS, MINT_CTA_DEFAULTS, MINT_GREY, MINT_SECTION_PAD, MINT_WIDE,
  MintCheckDot, MintCtaButtons, MintEyebrow, MintLink, MintSectionHeader, mintAnchorClick, mintCard, mintDisplay, resolveMintPalette, useMintReveal,
  type MintCtaProps, type MintPalette, type MintStyleProps,
} from "./mint/mint-theme";

/* ----------------------------------------------------------------------------
 * Mint Comparison — type "mint-comparison"  (DSO Page (Light) family, Nov 2026)
 *
 * "What a lab partner should cost a DSO.": a pale grey band with the v2
 * section header row (eyebrow "Side by side · Per location", a left-set
 * display h2, a quiet chevron link on the headline baseline at the right),
 * then the table inside a white ringed card. The thead is a grey strip of
 * 11.5px tracked uppercase labels; the provider header is solid brand green
 * with cream text and a 10px lime sub-label ("The lab and the platform").
 * Provider cells carry a soft-lime gradient and a 2px lime bar at the left,
 * ink at 500, with a green check dot when the value starts with "✓ "; the
 * competitor cells are muted and open with a short dash; the first column
 * is muted at 500. 18/20 padding, 14.5px, hairlines between rows (none on
 * the last). Optional chevron links sit centred under the card.
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
  /** Eyebrow above the headline ("Side by side"); empty hides it. */
  eyebrow?: string;
  /** Muted suffix after the eyebrow ("· Per location"). */
  eyebrowSuffix?: string;
  /** The quiet chevron link at the right of the header row; empty hides it. */
  headerLinkText?: string;
  headerLinkUrl?: string;
  firstColumnLabel?: string;
  providerLabel?: string;
  /** Lime sub-label under the provider header ("The lab and the platform"). */
  providerSubLabel?: string;
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
  eyebrow: "Side by side",
  eyebrowSuffix: "· Per location",
  headerLinkText: "Full pricing",
  headerLinkUrl: "#",
  firstColumnLabel: "Per location",
  providerLabel: "Our platform",
  providerSubLabel: "The lab and the platform",
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

/**
 * A table cell: inline-editable. The "✓ " prefix renders as the green check
 * dot; `dash` (competitor columns) opens the cell with the v2 short dash.
 */
function Cell({ value, onUpdate, palette, dash }: { value: string; onUpdate?: (v: string) => void; palette: MintPalette; dash?: string }) {
  const checked = value.startsWith(CHECK_PREFIX);
  const rest = checked ? value.slice(CHECK_PREFIX.length) : value;
  if (checked) {
    return (
      <span className="inline">
        <MintCheckDot palette={palette} className="mr-2 align-[-3px]" />
        <InlineText as="span" value={rest} onUpdate={onUpdate ? (v) => onUpdate(CHECK_PREFIX + v) : undefined} multiline />
      </span>
    );
  }
  if (dash) {
    return (
      <span className="inline">
        <span aria-hidden className="mr-2 inline-block h-[2px] w-[14px] rounded-[1px] align-middle" style={{ background: dash }} />
        <InlineText as="span" value={value} onUpdate={onUpdate} multiline />
      </span>
    );
  }
  return <InlineText as="span" value={value} onUpdate={onUpdate} multiline />;
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
  const linkInk = pal.dark ? pal.lime : pal.green;
  // The v2 "line-2": a step darker than the hairline, for the competitor dash.
  const dash = pal.dark ? "rgba(255,252,239,0.28)" : mixHex(line, ink, 0.9);
  const theadBg = pal.dark ? "rgba(255,255,255,0.04)" : pal.grey;
  const providerCellBg = `linear-gradient(90deg, ${pal.limeSoft}, color-mix(in srgb, ${pal.limeSoft} 40%, transparent))`;
  const showCta = !!p.ctaText || !!p.ctaSecondaryText || isEditor;
  const showEyebrow = !!p.eyebrow || !!p.eyebrowSuffix || isEditor;
  const showLink = !!p.headerLinkText || isEditor;

  const thBase: React.CSSProperties = { textAlign: "left", padding: "18px 20px 14px", borderBottom: `1px solid ${line}`, verticalAlign: "top", fontSize: 11.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: muted, background: theadBg };
  const tdBase: React.CSSProperties = { textAlign: "left", padding: "18px 20px", borderBottom: `1px solid ${line}`, verticalAlign: "top" };

  return (
    <section
      ref={ref}
      id={p.anchorId || undefined}
      data-block="mint-comparison"
      className="mint-comparison relative"
      style={{ background: pal.bg, color: ink, fontFamily: MINT_BODY, ...MINT_SECTION_PAD }}
    >
      <style>{MINT_CSS}</style>
      <div className={MINT_WIDE}>
        <MintSectionHeader
          eyebrow={showEyebrow ? (
            <motion.div {...rise(0, 14)}>
              <MintEyebrow palette={pal} suffix={(p.eyebrowSuffix || isEditor) ? <InlineText as="span" value={p.eyebrowSuffix ?? ""} onUpdate={field("eyebrowSuffix")} /> : undefined}>
                <InlineText as="span" value={p.eyebrow ?? ""} onUpdate={field("eyebrow")} />
              </MintEyebrow>
            </motion.div>
          ) : undefined}
          headline={
            <motion.h2 {...rise(0.08, 18)} className="max-w-[20ch]" style={mintDisplay("clamp(1.9rem, 3.6vw, 3rem)", heading)}>
              <InlineText as="span" value={p.headline} onUpdate={field("headline")} multiline />
            </motion.h2>
          }
          link={showLink ? (
            <motion.div {...rise(0.16, 14)}>
              <MintLink href={p.headerLinkUrl || "#"} onClick={mintAnchorClick(p.headerLinkUrl)} color={linkInk} size={15} style={{ whiteSpace: "nowrap" }}>
                <InlineText as="span" value={p.headerLinkText ?? ""} onUpdate={field("headerLinkText")} />
              </MintLink>
            </motion.div>
          ) : undefined}
        />

        <motion.div {...rise(0.1, 18)} className="cmp overflow-hidden" style={mintCard(pal)}>
          <div className="cmp-scroll overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: 720, fontSize: 14.5, lineHeight: 1.5 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ ...thBase, width: "22%" }}>
                    <InlineText as="span" value={p.firstColumnLabel ?? ""} onUpdate={field("firstColumnLabel")} />
                  </th>
                  <th scope="col" style={{ ...thBase, background: pal.green, color: pal.cream, borderBottomColor: pal.green, position: "relative" }}>
                    <InlineText as="span" value={p.providerLabel ?? ""} onUpdate={field("providerLabel")} />
                    {(p.providerSubLabel || isEditor) && (
                      <span className="mt-[3px] block" style={{ fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, color: pal.lime }}>
                        <InlineText as="span" value={p.providerSubLabel ?? ""} onUpdate={field("providerSubLabel")} />
                      </span>
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
                  const border = last ? "0" : `1px solid ${line}`;
                  return (
                    <tr key={i}>
                      <td style={{ ...tdBase, borderBottom: border, color: muted, fontWeight: 500, width: "22%" }}>
                        <Cell value={r.need} onUpdate={updateRow ? (v) => updateRow(i, { need: v }) : undefined} palette={pal} />
                      </td>
                      <td style={{ ...tdBase, borderBottom: border, color: ink, fontWeight: 500, position: "relative", background: providerCellBg }}>
                        <span aria-hidden className="pointer-events-none absolute bottom-0 left-0 top-0 w-[2px]" style={{ background: pal.lime }} />
                        <Cell value={r.provider} onUpdate={updateRow ? (v) => updateRow(i, { provider: v }) : undefined} palette={pal} />
                      </td>
                      <td style={{ ...tdBase, borderBottom: border, color: muted }}>
                        <Cell value={r.b} onUpdate={updateRow ? (v) => updateRow(i, { b: v }) : undefined} palette={pal} dash={dash} />
                      </td>
                      {showC && (
                        <td style={{ ...tdBase, borderBottom: border, color: muted }}>
                          <Cell value={r.c ?? ""} onUpdate={updateRow ? (v) => updateRow(i, { c: v }) : undefined} palette={pal} dash={dash} />
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
