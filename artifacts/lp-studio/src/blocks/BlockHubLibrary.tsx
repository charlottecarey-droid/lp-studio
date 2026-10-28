import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { useAnimInitial, useStaticRender } from "@/lib/reveal-fallback";
import { usePageContext } from "@/lib/page-context";
import { InlineText } from "@/components/InlineText";
import { HUB_BODY, HUB_CSS, HUB_DISPLAY, HubKicker, hubDisplayStyle, resolveHubPalette, type HubStyleProps } from "@/lib/hub-theme";
import { HubAssetCard, HubAssetRow } from "./hub/HubAssetCard";
import { HubAssetViewer, shouldOpenInline } from "./hub/HubAssetViewer";
import { HubGateModal } from "./hub/HubGate";
import { assetKey, opensInViewer, resolveAssetHref, resolveDownloadHref, trackHubAsset, trackHubInteraction, type HubAsset } from "./hub/hub-assets";
import { gateApplies, type HubGateConfig } from "./hub/hub-gate";
import { useHubSeen } from "./hub/use-hub-seen";

/* ----------------------------------------------------------------------------
 * Content Hub Library — type "hub-library"
 *
 * The library itself: assets grouped into SECTIONS (a stage, a topic, an
 * audience), each with a kicker ("Step 1 · When your kit arrives"), a title
 * and a line, then the assets — a grid of cards (hairline or flat, from the
 * preset) or hairline list rows (the "Index" preset). A sticky section rail
 * on the left lists the sections and tracks the one in view (cosmetic —
 * content never depends on it); on phones the rail becomes a horizontal row
 * of chips. An optional search box filters by title / description / meta.
 *
 * Clicking an asset opens the in-page viewer when the asset is ours (PDF file
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
  /** Resource gate (off by default): ask for an email before the first open, or before downloads only. */
  gate?: HubGateConfig;
}

interface Props {
  props: HubLibraryBlockProps;
  brand: BrandConfig;
  blockId?: string;
  onFieldChange?: (updated: HubLibraryBlockProps) => void;
}

export const HUB_LIBRARY_DEFAULT_PROPS: HubLibraryBlockProps = {
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
  const pal = resolveHubPalette(props, brand, "library");
  const t = pal.t;
  const isEditor = !!onFieldChange;
  const { pageId, sessionId } = usePageContext();
  const ctx = { pageId, sessionId, blockId };
  const sections = props.sections ?? [];
  const layout = props.layout ?? "rail";
  const cols = props.columns === 2 ? 2 : 3;
  const rows = t.cardStyle === "rows";
  const flat = t.cardStyle === "flat";
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<HubAsset | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const rootRef = useRef<HTMLElement | null>(null);
  // Resource gate: the action the visitor started is parked here while the
  // form is open and finished the moment they submit.
  const [pending, setPending] = useState<{ asset: HubAsset; action: "open" | "download" } | null>(null);
  const allItems = useMemo(() => sections.flatMap((s) => s.items ?? []), [sections]);
  useHubSeen(rootRef, allItems, ctx, !isEditor && !staticRender);

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

  const performOpen = useCallback(
    (a: HubAsset, viaGate: boolean): boolean => {
      if (opensInViewer(a) && shouldOpenInline(a)) {
        setViewing(a);
        trackHubAsset(ctx, a, "view");
        return true;
      }
      trackHubAsset(ctx, a, "open");
      if (viaGate) {
        const href = resolveAssetHref(a);
        if (href) window.open(href, "_blank", "noopener");
        return true;
      }
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageId, sessionId, blockId],
  );
  const openAsset = useCallback(
    (a: HubAsset): boolean => {
      if (gateApplies(props.gate, "open", { isEditor })) {
        setPending({ asset: a, action: "open" });
        return true;
      }
      return performOpen(a, false);
    },
    [props.gate, isEditor, performOpen],
  );
  const downloadAsset = useCallback(
    (a: HubAsset): boolean => {
      if (gateApplies(props.gate, "download", { isEditor })) {
        setPending({ asset: a, action: "download" });
        return true;
      }
      trackHubAsset(ctx, a, "download");
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.gate, isEditor, pageId, sessionId, blockId],
  );
  const finishPending = useCallback(() => {
    const p = pending;
    setPending(null);
    if (!p) return;
    if (p.action === "open") {
      performOpen(p.asset, true);
      return;
    }
    const href = resolveDownloadHref(p.asset);
    if (!href) return;
    trackHubAsset(ctx, p.asset, "download");
    const a = document.createElement("a");
    a.href = href;
    a.download = "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, performOpen]);
  const closeViewer = useCallback(() => setViewing(null), []);

  // Keep each section's ORIGINAL index so editor bindings and rail ids stay
  // stable while a search hides sections.
  const filtered = sections.map((s, index) => ({ section: s, index, items: filterAssets(s.items ?? [], query) }));
  const visible = query.trim() ? filtered.filter((f) => f.items.length > 0) : filtered;
  const totalItems = sections.reduce((n, s) => n + (s.items?.length ?? 0), 0);
  const jump = (i: number) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = sectionRefs.current[i];
    if (!isEditor) trackHubInteraction(ctx, "section", { detail: sections[i]?.title ?? String(i + 1), value: i + 1 });
    if (el) {
      e.preventDefault();
      const top = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    }
  };

  // Search terms: one beacon per settled query (600ms after the last keystroke),
  // with the match count — zero-match terms are what the hub is missing.
  const lastSearchRef = useRef<string>("");
  useEffect(() => {
    if (isEditor || staticRender) return;
    const q = query.trim().toLowerCase();
    if (q.length < 2 || q === lastSearchRef.current) return;
    const t = window.setTimeout(() => {
      lastSearchRef.current = q;
      const matches = sections.reduce((n, s) => n + filterAssets(s.items ?? [], q).length, 0);
      trackHubInteraction(ctx, "search", { detail: q, value: matches });
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isEditor, staticRender]);

  const gridClass = rows ? "" : cols === 2 ? `grid ${flat ? "gap-8" : "gap-5"} grid-cols-1 sm:grid-cols-2` : `grid ${flat ? "gap-8 gap-y-10" : "gap-5"} grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`;
  const railWidth = layout === "rail" ? "lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]" : "";
  const pillsRail = t.railStyle === "pills";

  return (
    <section id={props.anchorId || undefined} ref={rootRef} className="hub-library relative" style={{ background: pal.bg, color: pal.text, fontFamily: HUB_BODY }}>
      <style>{HUB_CSS}</style>
      <div className="mx-auto w-full max-w-page px-6 py-16 lg:px-10 lg:py-24">
        {/* Header row */}
        <div className="mb-10 flex flex-col gap-6 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[680px]">
            {(props.kicker || isEditor) && (
              <div className="mb-4">
                <HubKicker palette={pal}>
                  <InlineText as="span" value={props.kicker ?? ""} onUpdate={field("kicker")} />
                </HubKicker>
              </div>
            )}
            <h2 className="whitespace-pre-line" style={hubDisplayStyle(pal, t.theme === "gallery" ? "clamp(2.2rem, 4.6vw, 4rem)" : "clamp(2rem, 4vw, 3.4rem)")}>
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
                className="h-12 w-full pl-11 pr-4 text-[14px] outline-none"
                style={{ background: pal.card, color: pal.text, border: `1px solid ${pal.hairline}`, borderRadius: t.buttonRadius }}
                data-hub-search
              />
            </label>
          )}
        </div>

        <div className={`grid gap-10 lg:gap-14 ${railWidth}`}>
          {/* Rail. `min-w-0` on the grid item: the chip row inside is a scroll
              container, but a grid item's automatic minimum width is its
              content's min-content — six no-wrap chips would otherwise widen
              the whole page to ~1300px on a phone. */}
          {layout === "rail" && sections.length > 0 && (
            <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
              <div className={`hub-rail -mx-6 flex max-w-[calc(100%+3rem)] gap-2 overflow-x-auto px-6 pb-1 lg:mx-0 lg:max-w-none lg:flex-col lg:overflow-visible lg:px-0 ${pillsRail ? "lg:gap-1.5" : "lg:gap-0"}`}>
                {sections.map((s, i) => {
                  const isActive = i === activeIdx;
                  const count = s.items?.length ?? 0;
                  const style: React.CSSProperties = pillsRail
                    ? { color: isActive ? pal.onAccentFill : pal.muted, background: isActive ? pal.accentFill : pal.cardTint, border: "1px solid transparent", borderRadius: 9999 }
                    : { color: isActive ? pal.heading : pal.muted, borderColor: isActive ? pal.accentFill : pal.hairline, background: isActive ? pal.card : "transparent", border: `1px solid ${isActive ? pal.hairline : "transparent"}` };
                  return (
                    <a
                      key={i}
                      href={`#${sectionIds[i]}`}
                      onClick={jump(i)}
                      className={`group flex shrink-0 items-center gap-3 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold no-underline transition-colors lg:w-full lg:px-4 lg:py-3 lg:text-[14px] ${pillsRail ? "" : "lg:rounded-none lg:border-l-2"}`}
                      style={style}
                      data-hub-rail={isActive ? "active" : "inactive"}
                    >
                      {!pillsRail && <span className="font-mono text-[11px] tabular-nums" style={{ color: isActive ? pal.accent : pal.faint }}>{String(i + 1).padStart(2, "0")}</span>}
                      <span className="truncate">{s.title}</span>
                      <span className="ml-auto hidden text-[11px] tabular-nums lg:inline" style={{ color: pillsRail && isActive ? pal.onAccentFill : pal.faint, opacity: pillsRail && isActive ? 0.7 : 1 }}>{count}</span>
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
              <p className="p-10 text-center text-[15px]" style={{ background: pal.card, border: `1px solid ${pal.hairline}`, color: pal.muted, borderRadius: t.cardRadius }}>
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
                  <div className={`flex flex-col gap-2 ${t.sectionHeader === "rule" && !rows ? "mb-6 border-b pb-5 lg:mb-8" : rows ? "mb-2" : "mb-6 lg:mb-8"}`} style={{ borderColor: pal.hairline }}>
                    {(s.kicker || isEditor) && (
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: pal.accent }}>
                        <InlineText as="span" value={s.kicker ?? ""} onUpdate={updateSection ? (v) => updateSection(sectionIndex, { kicker: v }) : undefined} />
                      </p>
                    )}
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <h3
                        className={t.headingInk === "primary" ? "text-[24px] lg:text-[28px]" : "text-[22px] font-semibold tracking-[-0.015em] lg:text-[26px]"}
                        style={t.headingInk === "primary" ? { fontFamily: HUB_DISPLAY, fontWeight: t.headingWeight, letterSpacing: t.headingTracking, color: pal.heading, lineHeight: 1.15 } : { color: pal.heading }}
                      >
                        <InlineText as="span" value={s.title} onUpdate={updateSection ? (v) => updateSection(sectionIndex, { title: v }) : undefined} />
                      </h3>
                      {(s.description || isEditor) && (
                        <p className="text-[14px] lg:text-[15px]" style={{ color: pal.muted }}>
                          <InlineText as="span" value={s.description ?? ""} onUpdate={updateSection ? (v) => updateSection(sectionIndex, { description: v }) : undefined} />
                        </p>
                      )}
                    </div>
                  </div>
                  <div className={rows ? "flex flex-col" : gridClass} style={rows ? { borderBottom: `1px solid ${pal.hairline}` } : undefined}>
                    {items.map((a, ii) => {
                      const originalIndex = Math.max(0, (s.items ?? []).indexOf(a));
                      const newTab = !(opensInViewer(a) && (staticRender || shouldOpenInline(a)));
                      const Item = rows ? HubAssetRow : HubAssetCard;
                      return (
                        <motion.div
                          key={`${sectionIndex}-${originalIndex}-${a.title}`}
                          initial={reduced ? false : anim({ opacity: 0, y: rows ? 8 : 18 })}
                          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                          viewport={{ once: true, amount: 0.15 }}
                          transition={{ duration: 0.6, delay: Math.min(ii, 5) * 0.05, ease: [0.16, 1, 0.3, 1] }}
                          className={rows ? "block" : "flex"}
                          data-hub-seen={assetKey(a)}
                        >
                          <Item
                            asset={a}
                            palette={pal}
                            onOpen={openAsset}
                            newTab={newTab}
                            onDownload={downloadAsset}
                            onTitleChange={updateItem ? (v) => updateItem(sectionIndex, originalIndex, { title: v }) : undefined}
                            onDescriptionChange={updateItem ? (v) => updateItem(sectionIndex, originalIndex, { description: v }) : undefined}
                            onThumbnailChange={updateItem ? (v) => updateItem(sectionIndex, originalIndex, { thumbnailUrl: v }) : undefined}
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
      <HubAssetViewer asset={viewing} onClose={closeViewer} palette={pal} onDownload={(a) => trackHubAsset(ctx, a, "download")} onOpenExternal={(a) => trackHubAsset(ctx, a, "open")} onProgress={(a, pct) => trackHubAsset(ctx, a, "progress", { value: pct })} onTimeOpen={(a, seconds) => trackHubAsset(ctx, a, "time", { value: seconds })} />
      {props.gate?.enabled && !isEditor && (
        <HubGateModal gate={props.gate} open={!!pending} onClose={() => setPending(null)} onUnlocked={finishPending} palette={pal} brand={brand} />
      )}
    </section>
  );
}
