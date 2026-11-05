import type { BrandConfig } from "@/lib/brand-config";
import { BrandLogo } from "@/components/BrandLogo";
import { InlineText } from "@/components/InlineText";
import {
  FOREST_BODY, FOREST_CONTAINER, FOREST_CSS, FOREST_DISPLAY,
  forestAnchorClick, resolveForestPalette,
  type ForestStyleProps,
} from "./forest/forest-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Forest Footer — type "forest-footer"  (DSO Page family, Nov 2026)
 *
 * The page footer on the deep-forest band: a top hairline, the brand logo
 * with a display-face tagline, up to three link columns with tracked titles,
 * then the "Sources and notes" block — a numbered list in two columns that
 * carries the page's footnotes — and an optional legal line. The notes are
 * hidden entirely on the live page when there are none.
 * -------------------------------------------------------------------------- */

export interface ForestFooterLink {
  label: string;
  url: string;
}

export interface ForestFooterColumn {
  title: string;
  links: ForestFooterLink[];
}

export interface ForestFooterBlockProps extends ForestStyleProps {
  tagline?: string;
  /** 0–3 link columns. */
  columns?: ForestFooterColumn[];
  notesTitle?: string;
  /** Numbered footnotes; empty = the notes block is hidden. */
  notes?: string[];
  /** © line under everything. */
  legal?: string;
  anchorId?: string;
}

interface Props {
  props: ForestFooterBlockProps;
  brand: BrandConfig;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onFieldChange?: (updated: ForestFooterBlockProps) => void;
}

export const FOREST_FOOTER_DEFAULT_PROPS: ForestFooterBlockProps = {
  tagline: "The modern dental lab, built for scale.",
  columns: [
    { title: "For groups", links: [
      { label: "Your first lab strategy", url: "#" },
      { label: "Lab consolidation", url: "#" },
      { label: "Adoption and change management", url: "#" },
      { label: "Lab data and insights", url: "#" },
      { label: "Lab economics and ROI", url: "#" },
      { label: "Clinical consistency", url: "#" },
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
      { label: "Login", url: "#" },
    ] },
  ],
  notesTitle: "Sources and notes",
  notes: [
    "Practices activating on training day: implementation data, 2026.",
    "Average lab cost savings: customer case study, 2026.",
    "First-fit rate: internal quality data, trailing twelve months.",
  ],
  legal: "",
  anchorId: "",
  backgroundStyle: "dandy-green",
};

/** Enumerated so Tailwind sees every grid literal (1.4fr brand column + n link columns). */
const GRID_COLS: Record<number, string> = {
  0: "",
  1: "md:grid-cols-[1.4fr_1fr]",
  2: "md:grid-cols-[1.4fr_1fr_1fr]",
  3: "md:grid-cols-[1.4fr_1fr_1fr_1fr]",
};

export function BlockForestFooter({ props, brand, onFieldChange }: Props) {
  const p = { ...FOREST_FOOTER_DEFAULT_PROPS, ...props };
  const pal = resolveForestPalette(p, brand, "#003A30");
  const isEditor = !!onFieldChange;
  const columns = (p.columns ?? []).slice(0, 3);
  const notes = (p.notes ?? []).map((n) => n.trim()).filter(Boolean);
  const showNotes = notes.length > 0 || isEditor;

  const field = (key: keyof ForestFooterBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as ForestFooterBlockProps[typeof key] }) : undefined;
  const updateColumn = onFieldChange
    ? (i: number, patch: Partial<ForestFooterColumn>) => onFieldChange({ ...props, columns: (p.columns ?? []).map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
    : undefined;
  const updateLink = onFieldChange
    ? (ci: number, li: number, label: string) => onFieldChange({ ...props, columns: (p.columns ?? []).map((c, idx) => (idx === ci ? { ...c, links: (c.links ?? []).map((l, j) => (j === li ? { ...l, label } : l)) } : c)) })
    : undefined;
  const updateNote = onFieldChange
    ? (i: number, v: string) => onFieldChange({ ...props, notes: (p.notes ?? []).map((n, idx) => (idx === i ? v : n)) })
    : undefined;

  const dark = pal.dark;
  const cream = pal.cream;
  const onDarkMuted = dark ? "rgba(255,252,239,0.66)" : pal.muted;
  const hairline = dark ? "rgba(255,252,239,0.14)" : pal.hairline;
  const notesList = isEditor ? (p.notes ?? []) : notes;

  return (
    <footer
      id={p.anchorId || undefined}
      data-block="forest-footer"
      className="forest-footer relative"
      style={{ background: dark ? pal.deep : pal.bg, color: onDarkMuted, fontFamily: FOREST_BODY, fontSize: 13, borderTop: `1px solid ${hairline}` }}
    >
      <style>{`${FOREST_CSS} .forest-footer a{transition:color .2s ease} @media (hover:hover){.forest-footer a:hover{color:${cream}}}`}</style>
      <div className={cn(FOREST_CONTAINER, "grid gap-7 pt-12 pb-10", GRID_COLS[columns.length])}>
        <div className="min-w-0">
          <BrandLogo brand={brand} tone={dark ? "onDark" : "onLight"} autoContrast alt={brand.brandName || "Logo"} className="h-8 w-auto" />
          {(p.tagline || isEditor) && (
            <p className="mt-4 max-w-[22ch]" style={{ fontFamily: FOREST_DISPLAY, fontSize: "1.15rem", lineHeight: 1.25, letterSpacing: "-0.02em", color: cream, margin: "16px 0 0" }}>
              <InlineText as="span" value={p.tagline ?? ""} onUpdate={field("tagline")} multiline />
            </p>
          )}
        </div>
        {columns.map((c, ci) => (
          <div key={ci} className="min-w-0">
            {(c.title || isEditor) && (
              <h5 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: cream, margin: "0 0 12px" }}>
                <InlineText as="span" value={c.title ?? ""} onUpdate={updateColumn ? (v) => updateColumn(ci, { title: v }) : undefined} />
              </h5>
            )}
            <ul className="m-0 grid list-none gap-2 p-0">
              {(c.links ?? []).map((l, li) => (
                <li key={li}>
                  {isEditor ? (
                    <span style={{ color: "inherit" }}>
                      <InlineText as="span" value={l.label} onUpdate={updateLink ? (v) => updateLink(ci, li, v) : undefined} />
                    </span>
                  ) : (
                    <a href={l.url || "#"} onClick={forestAnchorClick(l.url)} className="no-underline" style={{ color: "inherit" }}>{l.label}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {showNotes && (
        <div className={cn(FOREST_CONTAINER, "pb-10")} style={{ fontSize: 12, lineHeight: 1.6 }}>
          <div className="mb-3 pt-7 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: cream, borderTop: `1px solid ${hairline}` }}>
            <InlineText as="span" value={p.notesTitle ?? ""} onUpdate={field("notesTitle")} />
          </div>
          <ol className="m-0 max-w-[1000px] columns-1 pl-[18px] md:columns-2" style={{ columnGap: 40 }}>
            {notesList.map((n, i) => (
              <li key={i} className="mb-1 break-inside-avoid">
                <InlineText as="span" value={n} onUpdate={updateNote ? (v) => updateNote(i, v) : undefined} multiline />
              </li>
            ))}
          </ol>
          {isEditor && notesList.length === 0 && (
            <p className="text-[11px] italic" style={{ color: onDarkMuted, margin: 0 }}>No notes yet — add them in the panel. This block is hidden on the live page until there are some.</p>
          )}
        </div>
      )}

      {(p.legal || isEditor) && (
        <div className={cn(FOREST_CONTAINER, "pb-8")}>
          <p className="pt-5 text-[12px]" style={{ color: onDarkMuted, borderTop: `1px solid ${hairline}`, margin: 0 }}>
            <InlineText as="span" value={p.legal ?? ""} onUpdate={field("legal")} />
          </p>
        </div>
      )}
    </footer>
  );
}
