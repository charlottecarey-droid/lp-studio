import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial, useStaticRender } from "@/lib/reveal-fallback";
import { usePageContext } from "@/lib/page-context";
import { InlineText } from "@/components/InlineText";
import { HUB_BODY, HUB_CSS, HubKicker, hubDisplayStyle, resolveHubPalette, type HubStyleProps } from "@/lib/hub-theme";
import { HubAssetCard } from "./hub/HubAssetCard";
import { HubAssetViewer, shouldOpenInline } from "./hub/HubAssetViewer";
import { opensInViewer, trackHubAsset, type HubAsset } from "./hub/hub-assets";

/* ----------------------------------------------------------------------------
 * Content Hub Library — type "hub-library"
 *
 * The library itself: assets grouped into SECTIONS (a stage, a topic, an
 * audience), each with a kicker ("Step 1 · When your kit arrives"), a title
 * and a line, then a grid of asset cards. A sticky numbered rail on the left
 * lists the sections and tracks the one in view (cosmetic — content never
 * depends on it); on phones the rail becomes a horizontal row of chips.
 * An optional search box filters cards by title / description / meta.
 *
 * Clicking a card opens the in-page viewer when the asset is ours (PDF file
 * or video), otherwise the link opens in a new tab. Every open / view /
 * download is beaconed to /api/lp/track/asset when the page is live.
 * -------------------------------------------------------------------------- */

export interface HubSection {
  kicker?: string;
  title: string;
  description?: string;
  items: HubAsset[];
}

export interface HubLibraryBlockProps extends HubStyleProps {
  kicker?: string;
  headline?: string;
  subheadline?: string;
  sections: HubSection[];
  /** "rail" = sticky section rail + content; "stacked" = sections only. */
  layout?: "rail" | "stacked";
  /** Cards per row on wide screens: 2 or 3. */
  columns?: 2 | 3;
  showSearch?: boolean;
  searchPlaceholder?: string;
  anchorId?: string;
}

interface Props {
  props: HubLibraryBlockProps;
  brand: BrandConfig;
  blockId?: string;
  onFieldChange?: (updated: HubLibraryBlockProps) => void;
}

export const HUB_LIBRARY_DEFAULT_PROPS: HubLibraryBlockProps = {
  surface: "light",
  kicker: "The library",
  headline: "Pick the stage you're at.",
  subheadline: "Every guide, video and reference sheet, grouped the way you'll actually use them.",
  layout: "rail",
  columns: 3,
  showSearch: true,
  searchPlaceholder: "Search the library",
  anchorId: "library",
  sections: [
    {
      kicker: "Step 1 · Getting started",
      title: "Set up",
      description: "Everything for your first week.",
      items: [
        { kind: "pdf", title: "Quick-start guide", description: "The one-page overview to read first — what's included and where to begin.", fileUrl: "", meta: "4 pages" },
        { kind: "video", title: "A two-minute tour", description: "A short walkthrough of the workspace and the three things to do on day one.", videoUrl: "", meta: "2 min" },
        { kind: "link", title: "Help center", description: "Step-by-step articles for anything this hub doesn't cover.", externalUrl: "", meta: "Help center" },
      ],
    },
    {
      kicker: "Step 2 · Day to day",
      title: "Run it",
      description: "Reference sheets for the routine.",
      items: [
        { kind: "pdf", title: "Reference sheet", description: "The numbers, codes and contacts you'll reach for every week.", fileUrl: "", meta: "2 pages" },
        { kind: "pdf", title: "Checklist", description: "A printable checklist for the full workflow, start to finish.", fileUrl: "", meta: "1 page" },
      ],
    },
  ],
};

const slugify = (s: string, fallback: string) =>
  (s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-") || fallback;

/** Items matching a free-text query (title / description / meta / kind). */
export function filterAssets(items: HubAsset[], query: string): HubAsset[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((a) => [a.title, a.description, a.meta, a.kind].some((s) => (s ?? "").toLowerCase().includes(q)));
}

export function BlockHubLibrary({ props, brand, blockId, onFieldChange }: Props) {
  const reduced = useReducedMotion() ?? false;
  const staticRender = useStaticRender();
  const anim = useAnimInitial();
  const pal = resolveHubPalette(props, brand, "light");
  const isEditor = !!onFieldChange;
  const { pageId, sessionId } = usePageContext();
  const ctx = { pageId, sessionId, blockId };
  const sections = props.sections ?? [];
  const layout = props.layout ?? "rail";
  const cols = props.columns === 2 ? 2 : 3;
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<HubAsset | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  const field = (key: keyof HubLibraryBlockProps) =>
    onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v as HubLibraryBlockProps[typeof key] }) : undefined;
  const updateSection = onFieldChange
    ? (si: number, patch: Partial<HubSection>) => onFieldChange({ ...props, sections: sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) })
    : undefined;
  const updateItem = onFieldChange
    ? (si: number, ii: number, patch: Partial<HubAsset>) =>
        onFieldChange({ ...props, sections: sections.map((s, i) => (i === si ? { ...s, items: s.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : s)) })
    : undefined;

  // Section ids for the rail's jump links — stable per title.
  const sectionIds = useMemo(() => sections.map((s, i) => `hub-s-${slugify(s.title, String(i + 1))}`), [sections]);

  // Rail highlight: the first section whose heading is at or above the
  // upper third of the viewport. Cosmetic only (fail-open: no content gates).
  useEffect(() => {
    if (staticRender || layout !== "rail" || typeof window === "undefined" || sections.length < 2) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const line = window.innerHeight * 0.34;
        let idx = 0;
        sectionRefs.current.forEach((el, i) => {
          if (el && el.getBoundingClientRect().top <= line) idx = i;
        });
        setActiveIdx(idx);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [staticRender, layout, sections.length]);

  const openAsset = useCallback(
    (a: HubAsset): boolean => {
      if (opensInViewer(a) && shouldOpenInline(a)) {
        setViewing(a);
        trackHubAsset(ctx, a, "view");
        return true;
      }
      trackHubAsset(ctx, a, "open");
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageId, sessionId, blockId],
  );
  const closeViewer = useCallback(() => setViewing(null), []);

  // Keep each section's ORIGINAL index so editor bindings and rail ids stay
  // stable while a search hides sections.
  const filtered = sections.map((s, index) => ({ section: s, index, items: filterAssets(s.items ?? [], query) }));
  const visible = query.trim() ? filtered.filter((f) => f.items.length > 0) : filtered;
  const totalItems = sections.reduce((n, s) => n + (s.items?.length ?? 0), 0);
  const jump = (i: number) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = sectionRefs.current[i];
    if (el) {
      e.preventDefault();
      const top = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    }
  };

  const gridClass = cols === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
  const railWidth = layout === "rail" ? "lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]" : "";

  return (
    <section id={props.anchorId || undefined} className="hub-library relative" style={{ background: pal.bg, color: pal.text, fontFamily: HUB_BODY }}>
      <style>{HUB_CSS}</style>
      <div className="mx-auto w-full max-w-page px-6 py-16 lg:px-10 lg:py-24">
        {/* Header row */}
        <div className="mb-10 flex flex-col gap-6 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[640px]">
            {(props.kicker || isEditor) && (
              <div className="mb-4">
                <HubKicker palette={pal}>
                  <InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} />
                </HubKicker>
              </div>
            )}
            <h2 className="whitespace-pre-line" style={hubDisplayStyle("clamp(2rem, 4vw, 3.4rem)")}>
              <InlineText as="span" value={props.headline ?? ""} onUpdate={field("headline")} multiline />
            </h2>
            {(props.subheadline || isEditor) && (
              <p className="mt-4 max-w-[56ch] text-[15px] leading-relaxed lg:text-[17px]" style={{ color: pal.muted }}>
                <InlineText as="span" value={props.subheadline ?? ""} onUpdate={field("subheadline")} multiline />
              </p>
            )}
          </div>
          {props.showSearch !== false && (
            <label className="relative block w-full lg:w-[320px]">
              <span className="sr-only">Search the library</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: pal.faint }} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={props.searchPlaceholder || "Search"}
                className="h-12 w-full rounded-full pl-11 pr-4 text-[14px] outline-none"
                style={{ background: pal.card, color: pal.text, border: `1px solid ${pal.hairline}` }}
                data-hub-search
              />
            </label>
          )}
        </div>

        <div className={`grid gap-10 lg:gap-14 ${railWidth}`}>
          {/* Rail */}
          {layout === "rail" && sections.length > 0 && (
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="hub-rail -mx-6 flex gap-2 overflow-x-auto px-6 pb-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0" style={{ borderLeft: undefined }}>
                {sections.map((s, i) => {
                  const isActive = i === activeIdx;
                  const count = s.items?.length ?? 0;
                  return (
                    <a
                      key={i}
                      href={`#${sectionIds[i]}`}
                      onClick={jump(i)}
                      className="group flex shrink-0 items-center gap-3 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold no-underline transition-colors lg:w-full lg:rounded-none lg:border-l-2 lg:px-4 lg:py-3 lg:text-[14px]"
                      style={{
                        color: isActive ? pal.text : pal.muted,
                        borderColor: isActive ? pal.accentFill : pal.hairline,
                        background: isActive ? pal.card : "transparent",
                        border: `1px solid ${isActive ? pal.hairline : "transparent"}`,
                      }}
                      data-hub-rail={isActive ? "active" : "inactive"}
                    >
                      <span className="font-mono text-[11px] tabular-nums" style={{ color: isActive ? pal.accent : pal.faint }}>{String(i + 1).padStart(2, "0")}</span>
                      <span className="truncate">{s.title}</span>
                      <span className="ml-auto hidden text-[11px] tabular-nums lg:inline" style={{ color: pal.faint }}>{count}</span>
                    </a>
                  );
                })}
                {totalItems > 0 && (
                  <p className="mt-4 hidden text-[11px] font-semibold uppercase tracking-[0.2em] lg:block" style={{ color: pal.faint }}>
                    {totalItems} {totalItems === 1 ? "resource" : "resources"}
                  </p>
                )}
              </div>
            </aside>
          )}

          {/* Sections */}
          <div className="min-w-0 space-y-16 lg:space-y-20">
            {visible.length === 0 && (
              <p className="rounded-[20px] p-10 text-center text-[15px]" style={{ background: pal.card, border: `1px solid ${pal.hairline}`, color: pal.muted }}>
                Nothing matches “{query.trim()}”. Try a different word.
              </p>
            )}
            {visible.map(({ section: s, index: sectionIndex, items }) => {
              return (
                <section
                  key={sectionIds[sectionIndex] ?? s.title}
                  id={sectionIds[sectionIndex]}
                  ref={(el) => {
                    sectionRefs.current[sectionIndex] = el;
                  }}
                  className="scroll-mt-24"
                >
                  <div className="mb-6 flex flex-col gap-2 border-b pb-5 lg:mb-8" style={{ borderColor: pal.hairline }}>
                    {(s.kicker || isEditor) && (
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: pal.accent }}>
                        <InlineText as="span" value={s.kicker ?? ""} onUpdate={updateSection ? (v) => updateSection(sectionIndex, { kicker: v }) : undefined} />
                      </p>
                    )}
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <h3 className="text-[22px] font-semibold tracking-[-0.015em] lg:text-[26px]">
                        <InlineText as="span" value={s.title} onUpdate={updateSection ? (v) => updateSection(sectionIndex, { title: v }) : undefined} />
                      </h3>
                      {(s.description || isEditor) && (
                        <p className="text-[14px] lg:text-[15px]" style={{ color: pal.muted }}>
                          <InlineText as="span" value={s.description ?? ""} onUpdate={updateSection ? (v) => updateSection(sectionIndex, { description: v }) : undefined} />
                        </p>
                      )}
                    </div>
                  </div>
                  <div className={`grid gap-5 ${gridClass}`}>
                    {items.map((a, ii) => {
                      const originalIndex = Math.max(0, (s.items ?? []).indexOf(a));
                      const newTab = !(opensInViewer(a) && (staticRender || shouldOpenInline(a)));
                      return (
                        <motion.div
                          key={`${sectionIndex}-${originalIndex}-${a.title}`}
                          initial={reduced ? false : anim({ opacity: 0, y: 18 })}
                          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                          viewport={{ once: true, amount: 0.15 }}
                          transition={{ duration: 0.6, delay: Math.min(ii, 5) * 0.05, ease: [0.16, 1, 0.3, 1] }}
                          className="flex"
                        >
                          <HubAssetCard
                            asset={a}
                            palette={pal}
                            onOpen={openAsset}
                            newTab={newTab}
                            onDownload={(x) => trackHubAsset(ctx, x, "download")}
                            onTitleChange={updateItem ? (v) => updateItem(sectionIndex, originalIndex, { title: v }) : undefined}
                            onDescriptionChange={updateItem ? (v) => updateItem(sectionIndex, originalIndex, { description: v }) : undefined}
                          />
                        </motion.div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
      <HubAssetViewer asset={viewing} onClose={closeViewer} palette={pal} onDownload={(a) => trackHubAsset(ctx, a, "download")} onOpenExternal={(a) => trackHubAsset(ctx, a, "open")} />
    </section>
  );
}
