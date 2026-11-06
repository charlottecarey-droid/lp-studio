import type { BrandConfig } from "@/lib/brand-config";
import { BrandLogo } from "@/components/BrandLogo";
import { InlineText } from "@/components/InlineText";
import {
  MINT_BODY, MINT_CSS, MINT_DISPLAY, MINT_WIDE,
  mintAnchorClick, resolveMintPalette,
  type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Footer — type "mint-footer"  (DSO Page (Light) family, Nov 2026)
 *
 * The v2 footer: a numbered "Sources and notes" list in two columns under
 * a hairline (hidden on the live page when there are none), then a
 * four-column footer under another hairline — the brand logo with a
 * display-face tagline and the legal line in a wider first column, then up
 * to three titled link columns. Pages that only carry the old flat `links`
 * (no columns) keep their single row: legal left, short link nav right.
 * In the builder every string edits in place and the links never navigate.
 * -------------------------------------------------------------------------- */

export interface MintFooterLink {
  label: string;
  url: string;
}

export interface MintFooterColumn {
  title: string;
  links: MintFooterLink[];
}

export interface MintFooterBlockProps extends MintStyleProps {
  /** Small uppercase heading above the notes; blank = none. */
  notesTitle?: string;
  /** Numbered footnotes; empty = the notes block is hidden. */
  notes: string[];
  /** Display-face line under the logo. */
  tagline?: string;
  /** The © line, under the tagline. */
  legal?: string;
  /** Up to three titled link columns beside the logo column. */
  columns?: MintFooterColumn[];
  /** Flat link nav: the fallback row (legal left, links right) when there are no columns. */
  links: MintFooterLink[];
  anchorId?: string;
}

interface Props {
  props: MintFooterBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: MintFooterBlockProps) => void;
}

export const MINT_FOOTER_DEFAULT_PROPS: MintFooterBlockProps = {
  notesTitle: "Sources and notes",
  notes: [
    "Practices activating on training day: implementation data, 2026.",
    "Average lab cost savings: customer case study, 2026.",
    "First-fit rate: internal quality data, trailing twelve months.",
  ],
  tagline: "The modern dental lab, built for scale.",
  legal: "© 2026 Northwind Health. All rights reserved.",
  columns: [
    { title: "For groups", links: [
      { label: "Your first lab strategy", url: "#" },
      { label: "Lab consolidation", url: "#" },
      { label: "Adoption and change management", url: "#" },
      { label: "Lab data and insights", url: "#" },
      { label: "Lab economics and ROI", url: "#" },
    ] },
    { title: "Lab services", links: [
      { label: "Crown and bridge", url: "#" },
      { label: "Implant solutions", url: "#" },
      { label: "Dentures", url: "#" },
      { label: "Clear aligners", url: "#" },
      { label: "Sleep devices", url: "#" },
    ] },
    { title: "Company", links: [
      { label: "Customer stories", url: "#" },
      { label: "Where it's made", url: "#" },
      { label: "Pricing", url: "#" },
      { label: "Careers", url: "#" },
      { label: "Privacy", url: "#" },
    ] },
  ],
  links: [],
  anchorId: "",
  backgroundStyle: "white",
};

/** Enumerated so Tailwind sees every literal: the logo column is 1.3fr, each link column 1fr. */
const GRID_COLS: Record<number, string> = {
  1: "min-[900px]:grid-cols-[1.3fr_1fr]",
  2: "min-[900px]:grid-cols-[1.3fr_1fr_1fr]",
  3: "min-[900px]:grid-cols-[1.3fr_1fr_1fr_1fr]",
};

export function BlockMintFooter({ props, brand, onFieldChange }: Props) {
  const p = { ...MINT_FOOTER_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const notes = (p.notes ?? []).map((n) => n.trim()).filter(Boolean);
  const showNotes = notes.length > 0 || isEditor;
  const notesList = isEditor ? (p.notes ?? []) : notes;
  const columns = (p.columns ?? []).slice(0, 3);
  const hasColumns = columns.length > 0;
  const links = (p.links ?? []).filter((l) => l.label?.trim() || isEditor);

  const field = (key: keyof MintFooterBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintFooterBlockProps[typeof key] }) : undefined;
  const updateNote = onFieldChange
    ? (i: number, v: string) => onFieldChange({ ...props, notes: (p.notes ?? []).map((n, idx) => (idx === i ? v : n)) })
    : undefined;
  const updateLink = onFieldChange
    ? (i: number, label: string) => onFieldChange({ ...props, links: (p.links ?? []).map((l, idx) => (idx === i ? { ...l, label } : l)) })
    : undefined;
  const updateColumn = onFieldChange
    ? (i: number, patch: Partial<MintFooterColumn>) => onFieldChange({ ...props, columns: (p.columns ?? []).map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
    : undefined;
  const updateColumnLink = onFieldChange
    ? (ci: number, li: number, label: string) => onFieldChange({ ...props, columns: (p.columns ?? []).map((c, idx) => (idx === ci ? { ...c, links: (c.links ?? []).map((l, j) => (j === li ? { ...l, label } : l)) } : c)) })
    : undefined;

  const dark = pal.dark;
  const ink = pal.ink;
  const muted = pal.inkMuted;
  const subtle = pal.inkSubtle;
  const hairline = pal.line;

  const linkNode = (l: MintFooterLink, onLabel?: (v: string) => void) =>
    isEditor ? (
      <span style={{ color: "inherit" }}>
        <InlineText as="span" value={l.label} onUpdate={onLabel} />
      </span>
    ) : (
      <a href={l.url || "#"} onClick={mintAnchorClick(l.url)} className="no-underline" style={{ color: "inherit" }}>{l.label}</a>
    );

  const brandColumn = (
    <div className="min-w-0">
      <BrandLogo brand={brand} tone={dark ? "onDark" : "onLight"} autoContrast alt={brand.brandName || "Logo"} className="h-[22px] w-auto" />
      {(p.tagline || isEditor) && (
        <p className="max-w-[22ch]" style={{ fontFamily: MINT_DISPLAY, fontSize: "1.05rem", lineHeight: 1.3, letterSpacing: "-0.02em", color: ink, margin: "14px 0 0" }}>
          <InlineText as="span" value={p.tagline ?? ""} onUpdate={field("tagline")} multiline />
        </p>
      )}
      {(p.legal || isEditor) && (
        <p className="text-[12px]" style={{ color: subtle, margin: "14px 0 0", lineHeight: 1.5 }}>
          <InlineText as="span" value={p.legal ?? ""} onUpdate={field("legal")} />
        </p>
      )}
    </div>
  );

  return (
    <footer
      id={p.anchorId || undefined}
      data-block="mint-footer"
      className="mint-footer relative"
      style={{ background: pal.bg, color: muted, fontFamily: MINT_BODY }}
    >
      <style>{`${MINT_CSS} .mint-footer a{transition:color .2s ease} @media (hover:hover){.mint-footer a:hover{color:${ink}}} @media (prefers-reduced-motion:reduce){.mint-footer a{transition:none}}`}</style>

      {showNotes && (
        <div style={{ borderTop: `1px solid ${hairline}`, paddingBlock: "36px 20px", fontSize: 12, lineHeight: 1.55 }}>
          <div className={MINT_WIDE}>
            {(p.notesTitle || isEditor) && (
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: subtle, marginBottom: 10 }}>
                <InlineText as="span" value={p.notesTitle ?? ""} onUpdate={field("notesTitle")} />
              </div>
            )}
            <ol className="m-0 list-decimal columns-1 pl-4 min-[760px]:columns-2" style={{ columnGap: 40 }}>
              {notesList.map((n, i) => (
                <li key={i} className="mb-1 break-inside-avoid">
                  <InlineText as="span" value={n} onUpdate={updateNote ? (v) => updateNote(i, v) : undefined} multiline />
                </li>
              ))}
            </ol>
            {isEditor && notesList.length === 0 && (
              <p className="text-[11px] italic" style={{ color: muted, margin: 0 }}>No notes yet — add them in the panel. The notes are hidden on the live page until there are some.</p>
            )}
          </div>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${hairline}`, paddingBlock: "28px 48px", fontSize: 12.5 }}>
        {hasColumns ? (
          <div className={cn(MINT_WIDE, "grid gap-[22px]", GRID_COLS[columns.length])}>
            {brandColumn}
            {columns.map((c, ci) => (
              <div key={ci} className="min-w-0">
                {(c.title || isEditor) && (
                  <h5 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: ink, margin: "0 0 10px" }}>
                    <InlineText as="span" value={c.title ?? ""} onUpdate={updateColumn ? (v) => updateColumn(ci, { title: v }) : undefined} />
                  </h5>
                )}
                <ul className="m-0 grid list-none gap-1.5 p-0">
                  {(c.links ?? []).map((l, li) => (
                    <li key={li}>{linkNode(l, updateColumnLink ? (v) => updateColumnLink(ci, li, v) : undefined)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(MINT_WIDE, "flex flex-wrap items-center justify-between gap-x-7 gap-y-3")}>
            {(p.legal || isEditor) && (
              <span>
                <InlineText as="span" value={p.legal ?? ""} onUpdate={field("legal")} />
              </span>
            )}
            {links.length > 0 && (
              <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
                {links.map((l, i) => (
                  <span key={i} className="contents">{linkNode(l, updateLink ? (v) => updateLink(i, v) : undefined)}</span>
                ))}
              </nav>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
