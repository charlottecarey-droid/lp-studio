import type { BrandConfig } from "@/lib/brand-config";
import { InlineText } from "@/components/InlineText";
import {
  MINT_BODY, MINT_CSS, MINT_WRAP,
  mintAnchorClick, resolveMintPalette,
  type MintStyleProps,
} from "./mint/mint-theme";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Mint Footer — type "mint-footer"  (DSO Page (Light) family, Nov 2026)
 *
 * The footnotes and the one-line footer: a top hairline, a numbered list
 * of sources in two columns (hidden on the live page when there are none,
 * with an optional small uppercase heading), then a single muted row with
 * the legal line on the left and a short link nav on the right. In the
 * builder every string edits in place and the links never navigate.
 * -------------------------------------------------------------------------- */

export interface MintFooterLink {
  label: string;
  url: string;
}

export interface MintFooterBlockProps extends MintStyleProps {
  /** Small uppercase heading above the notes; blank = none. */
  notesTitle?: string;
  /** Numbered footnotes; empty = the notes block is hidden. */
  notes: string[];
  /** The © line. */
  legal?: string;
  /** Short nav on the right of the legal line. */
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
  notesTitle: "",
  notes: [
    "Practices activating on training day: implementation data, 2026.",
    "Average lab cost savings: customer case study, 2026.",
    "First-fit rate: internal quality data, trailing twelve months.",
  ],
  legal: "© 2026 Northwind Health. The modern dental lab, built for scale.",
  links: [
    { label: "Lab services", url: "#" },
    { label: "Customer stories", url: "#" },
    { label: "Pricing", url: "#" },
    { label: "Where it's made", url: "#" },
    { label: "Privacy", url: "#" },
  ],
  anchorId: "",
  backgroundStyle: "white",
};

export function BlockMintFooter({ props, brand, onFieldChange }: Props) {
  const p = { ...MINT_FOOTER_DEFAULT_PROPS, ...props };
  const pal = resolveMintPalette(p, brand, "#FFFFFF");
  const isEditor = !!onFieldChange;
  const notes = (p.notes ?? []).map((n) => n.trim()).filter(Boolean);
  const showNotes = notes.length > 0 || isEditor;
  const notesList = isEditor ? (p.notes ?? []) : notes;
  const links = (p.links ?? []).filter((l) => l.label?.trim() || isEditor);

  const field = (key: keyof MintFooterBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as MintFooterBlockProps[typeof key] }) : undefined;
  const updateNote = onFieldChange
    ? (i: number, v: string) => onFieldChange({ ...props, notes: (p.notes ?? []).map((n, idx) => (idx === i ? v : n)) })
    : undefined;
  const updateLink = onFieldChange
    ? (i: number, label: string) => onFieldChange({ ...props, links: (p.links ?? []).map((l, idx) => (idx === i ? { ...l, label } : l)) })
    : undefined;

  const muted = pal.inkMuted;
  const ink = pal.ink;

  return (
    <footer
      id={p.anchorId || undefined}
      data-block="mint-footer"
      className="mint-footer relative"
      style={{ background: pal.bg, color: muted, fontFamily: MINT_BODY, fontSize: 12 }}
    >
      <style>{`${MINT_CSS} .mint-footer a{transition:color .2s ease} @media (hover:hover){.mint-footer a:hover{color:${ink}}}`}</style>

      {showNotes && (
        <div style={{ borderTop: `1px solid ${pal.line}`, paddingBlock: "40px 24px", lineHeight: 1.55 }}>
          <div className={MINT_WRAP}>
            {(p.notesTitle || isEditor) && (
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: ink }}>
                <InlineText as="span" value={p.notesTitle ?? ""} onUpdate={field("notesTitle")} />
              </div>
            )}
            <ol className="m-0 columns-1 pl-4 min-[760px]:columns-2" style={{ columnGap: 40 }}>
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

      <div style={{ paddingBlock: "16px 48px" }}>
        <div className={cn(MINT_WRAP, "flex flex-wrap items-center justify-between gap-x-7 gap-y-3")}>
          {(p.legal || isEditor) && (
            <span>
              <InlineText as="span" value={p.legal ?? ""} onUpdate={field("legal")} />
            </span>
          )}
          {links.length > 0 && (
            <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
              {links.map((l, i) => (
                isEditor ? (
                  <span key={i} style={{ color: "inherit" }}>
                    <InlineText as="span" value={l.label} onUpdate={updateLink ? (v) => updateLink(i, v) : undefined} />
                  </span>
                ) : (
                  <a key={i} href={l.url || "#"} onClick={mintAnchorClick(l.url)} className="no-underline" style={{ color: "inherit" }}>{l.label}</a>
                )
              ))}
            </nav>
          )}
        </div>
      </div>
    </footer>
  );
}
