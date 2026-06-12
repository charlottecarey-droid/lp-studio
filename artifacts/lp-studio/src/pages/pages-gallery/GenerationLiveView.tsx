/**
 * GenerationLiveView — "watch your page build itself" (June 2026).
 *
 * Rendered inside CreatePageModal after an AI-generate submit. Consumes the
 * SSE stream from POST /api/lp/generate-page?stream=1 (src/lib/generationStream)
 * and renders:
 *   • LEFT RAIL — pipeline stage list (pending dot / spinner / check) with
 *     the scraped/failed reference URLs and an elapsed-time counter; morphs
 *     into the provenance receipt card once the generation finishes.
 *   • CANVAS — a scaled-down live page preview. Blocks render through
 *     BlockRenderer in live (viewer) mode inside the same brand wrapper the
 *     landing-page viewer uses ([data-lp-page] + getBrandStyleVars +
 *     BrandFontLoader + brand button CSS). Snapshots are reconciled in place
 *     (keyed by index+type, memoized by a stable JSON hash) so unchanged
 *     blocks never remount or flicker as the images/polish passes land.
 *
 * Saving stays the frontend's job: on `result` we run the caller-provided
 * save flow (POST /api/lp/pages etc.), then arm the "Open in builder" CTA
 * with a 6-second auto-navigate countdown (paused while the user hovers or
 * scrolls the preview).
 *
 * Failure handling:
 *   • failure BEFORE any stage event → ONE silent automatic fallback to the
 *     existing non-streaming flow (no user-visible error);
 *   • mid-stream failure → friendly error card with "Try again" (re-streams)
 *     and "Use standard mode" (non-streaming flow);
 *   • unmount/cancel aborts the fetch — the backend treats the disconnect
 *     as an abort.
 */
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Check,
  Image as ImageIcon,
  Layout,
  Link2,
  Loader2,
  Monitor,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PageBlock } from "@/lib/block-types";
import {
  DEFAULT_BRAND,
  fetchBrandConfig,
  getBrandButtonCss,
  getBrandStyleVars,
  type BrandConfig,
} from "@/lib/brand-config";
import { BrandFontLoader } from "@/components/BrandFontLoader";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import {
  streamGeneration,
  GenerationStreamError,
  type GenerationRequestBody,
  type GenerationResult,
  type GenerationStageId,
  type GenerationReceipt,
  type GenerationReferenceFailure,
} from "@/lib/generationStream";

// ── Stage rail model ─────────────────────────────────────────────────────────

const STAGE_DEFS: { id: GenerationStageId; label: string }[] = [
  { id: "context", label: "Loading brand & content context" },
  { id: "references", label: "Studying reference pages" },
  { id: "model", label: "Designing your page with AI" },
  { id: "images", label: "Resolving page imagery" },
  { id: "polish", label: "Critiquing & polishing copy" },
  { id: "finalize", label: "Finalizing the page" },
];

type StageStatus = "pending" | "active" | "done";

function initialStageState(): Record<GenerationStageId, StageStatus> {
  return {
    context: "pending",
    references: "pending",
    model: "pending",
    images: "pending",
    polish: "pending",
    finalize: "pending",
  };
}

interface RefsMeta {
  scraped: string[];
  failed: GenerationReferenceFailure[];
  fromInspiration: string[];
}

type Phase = "streaming" | "saving" | "saved" | "fallback" | "error";

// ── Block reconciliation ─────────────────────────────────────────────────────

/** Deterministic JSON stringify (sorted object keys) so an unchanged block
 *  always hashes identically across snapshots and never re-renders. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

interface LiveEntry {
  /** Stable mount key: index + block type. A snapshot that keeps the same
   *  type at the same position re-renders in place; a structural change
   *  (different type) remounts just that slot. */
  key: string;
  /** Stable-stringify hash — memo gate for the rendered block. */
  hash: string;
  block: PageBlock;
}

function toEntry(block: unknown, index: number): LiveEntry | null {
  if (!block || typeof block !== "object") return null;
  const type = typeof (block as { type?: unknown }).type === "string"
    ? (block as { type: string }).type
    : "unknown";
  return { key: `${index}:${type}`, hash: stableStringify(block), block: block as PageBlock };
}

function toEntries(blocks: unknown[]): LiveEntry[] {
  const out: LiveEntry[] = [];
  blocks.forEach((b, i) => {
    const e = toEntry(b, i);
    if (e) out.push(e);
  });
  return out;
}

/** One rendered block. Memoized on the JSON hash so a `blocks` snapshot
 *  replacement re-renders ONLY blocks whose content actually changed —
 *  unchanged blocks keep their DOM untouched (no flicker, images keep
 *  loading). The entrance animation runs at mount only. */
const LiveBlock = memo(
  function LiveBlock({
    block,
    brand,
    reduced,
  }: {
    block: PageBlock;
    hash: string;
    brand: BrandConfig;
    reduced: boolean;
  }) {
    return (
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Live (viewer) mode: no isBuilder / onBlockChange. BlockRenderer
            wraps each block in its own error boundary, so one malformed
            streamed block can't blank the preview. Scroll-reveal animations
            are disabled — inside a scaled overflow container their viewport
            math is wrong and blocks would stay invisible. */}
        <BlockRenderer block={block} brand={brand} animationsEnabled={false} />
      </motion.div>
    );
  },
  (prev, next) =>
    prev.hash === next.hash && prev.brand === next.brand && prev.reduced === next.reduced,
);

// ── Receipt helpers ──────────────────────────────────────────────────────────

function humanizeRecipeId(id: string): string {
  const words = id
    .split(/[-_]/)
    .filter((w) => w.length > 0 && w.toLowerCase() !== "heavy");
  if (words.length === 0) return "Custom layout";
  const label = words
    .map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  return `${label} layout`;
}

function humanizeTemplateSlug(slug: string): string {
  const words = slug.split(/[-_]/).filter(Boolean);
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const IMAGE_URL_RE = /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i;
const IMAGE_PATH_RE = /\/(media|images?|imagedelivery|uploads|assets)\//i;

/** Distinct image URLs across the final blocks — drives the receipt's
 *  "N images from your library" line (the receipt payload itself carries no
 *  image count). */
function collectImageUrls(value: unknown, acc: Set<string>): void {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) && (IMAGE_URL_RE.test(value) || IMAGE_PATH_RE.test(value))) {
      acc.add(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectImageUrls(v, acc);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectImageUrls(v, acc);
  }
}

// ── Component ────────────────────────────────────────────────────────────────

const PAGE_DESIGN_WIDTH = 1200;

export interface GenerationLiveViewProps {
  /** Streaming request body — identical to the non-streaming POST body. */
  body: GenerationRequestBody;
  /** Label of the explicitly chosen starting-point template (null = freeform). */
  templateName: string | null;
  /** Existing save flow (POST /api/lp/pages + fact flags + critique stash).
   *  Resolves with the new page id. Navigation is NOT part of this. */
  onSave: (result: GenerationResult) => Promise<number>;
  /** Navigate to /builder/<pageId> and close the modal. */
  onOpen: (pageId: number) => void;
  /** Existing non-streaming flow (generates, saves AND navigates). Used by
   *  the silent auto-fallback and the "Use standard mode" button. */
  onFallback: () => Promise<void>;
  /** Abort + return to the create form. */
  onCancel: () => void;
}

export function GenerationLiveView({
  body,
  templateName,
  onSave,
  onOpen,
  onFallback,
  onCancel,
}: GenerationLiveViewProps) {
  const reduced = useReducedMotion() ?? false;

  // Latest-callback refs so the long-lived stream effect never goes stale.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const onFallbackRef = useRef(onFallback);
  onFallbackRef.current = onFallback;

  // ── Brand context (same plumbing as the landing-page viewer) ──────────────
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  useEffect(() => {
    let cancelled = false;
    fetchBrandConfig()
      .then((b) => {
        if (!cancelled) setBrand(b);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Stream state ───────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("streaming");
  const [attempt, setAttempt] = useState(0);
  const [stageState, setStageState] = useState<Record<GenerationStageId, StageStatus>>(initialStageState);
  const [stageLabels, setStageLabels] = useState<Partial<Record<GenerationStageId, string>>>({});
  const [refsMeta, setRefsMeta] = useState<RefsMeta | null>(null);
  const [entries, setEntries] = useState<LiveEntry[]>([]);
  const [restartMsg, setRestartMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<GenerationReceipt | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [savedPageId, setSavedPageId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triedAutoFallbackRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Elapsed timer ──────────────────────────────────────────────────────────
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (phase !== "streaming" && phase !== "saving" && phase !== "fallback") return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase, attempt]);

  // ── Canvas scaling + scroll following ─────────────────────────────────────
  const canvasRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.65);
  const [innerH, setInnerH] = useState(0);
  const [following, setFollowing] = useState(true);
  const followRef = useRef(true);
  const suppressScrollUntilRef = useRef(0);
  const lastUserScrollRef = useRef(0);
  const [hoveringPreview, setHoveringPreview] = useState(false);
  const hoveringRef = useRef(false);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth - 48; // canvas padding
      if (w > 0) setScale(Math.min(0.7, Math.max(0.35, w / PAGE_DESIGN_WIDTH)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setInnerH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const jumpToLatest = useCallback(
    (behavior?: ScrollBehavior) => {
      const el = canvasRef.current;
      if (!el) return;
      suppressScrollUntilRef.current = Date.now() + 800;
      followRef.current = true;
      setFollowing(true);
      el.scrollTo({ top: el.scrollHeight, behavior: behavior ?? (reduced ? "auto" : "smooth") });
    },
    [reduced],
  );

  // Auto-follow the newest content while streaming, unless the user scrolled
  // away (tracked below; "Jump to latest" pill resumes).
  useEffect(() => {
    if (phase !== "streaming") return;
    if (!followRef.current) return;
    jumpToLatest();
  }, [entries.length, innerH, phase, jumpToLatest]);

  const handleCanvasScroll = useCallback(() => {
    if (Date.now() < suppressScrollUntilRef.current) return; // our own auto-scroll
    lastUserScrollRef.current = Date.now();
    const el = canvasRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
    followRef.current = atBottom;
    setFollowing(atBottom);
  }, []);

  // ── Run the stream ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    setPhase("streaming");
    setError(null);
    setEntries([]);
    setStageState(initialStageState());
    setStageLabels({});
    setRefsMeta(null);
    setRestartMsg(null);
    setReceipt(null);
    setResult(null);
    setSavedPageId(null);
    startRef.current = Date.now();
    setElapsed(0);
    followRef.current = true;
    setFollowing(true);

    void (async () => {
      try {
        const streamed = await streamGeneration(
          body,
          {
            onStage: (e) => {
              if (cancelled) return;
              setStageState((prev) => ({
                ...prev,
                [e.id]: e.status === "start" ? "active" : "done",
              }));
              setStageLabels((prev) => ({ ...prev, [e.id]: e.label }));
              if (e.id === "references" && e.status === "done" && e.meta) {
                setRefsMeta({
                  scraped: Array.isArray(e.meta.scraped) ? e.meta.scraped : [],
                  failed: Array.isArray(e.meta.failed) ? e.meta.failed : [],
                  fromInspiration: Array.isArray(e.meta.fromInspiration)
                    ? e.meta.fromInspiration
                    : [],
                });
              }
            },
            onBlock: (e) => {
              if (cancelled) return;
              setEntries((prev) => {
                const entry = toEntry(e.block, e.index);
                if (!entry) return prev;
                const next = prev.slice(0, e.index);
                // Pad in case an index was skipped (shouldn't happen, but a
                // sparse array would crash React keys).
                while (next.length < e.index) {
                  const filler = prev[next.length];
                  if (filler) next.push(filler);
                  else break;
                }
                next[e.index] = entry;
                return next;
              });
            },
            onBlocks: (e) => {
              if (cancelled) return;
              setEntries(toEntries(e.blocks)); // full replacement, reconciled by key+hash
            },
            onRestart: () => {
              if (cancelled) return;
              setEntries([]);
              setRestartMsg(
                "That layout was too similar to a recent page — trying a fresh structure…",
              );
              if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
              restartTimerRef.current = setTimeout(() => setRestartMsg(null), 3500);
            },
            onReceipt: (r) => {
              if (!cancelled) setReceipt(r);
            },
          },
          ac.signal,
        );
        if (cancelled) return;
        setResult(streamed);
        setPhase("saving");
        const pageId = await onSaveRef.current(streamed);
        if (cancelled) return;
        setSavedPageId(pageId);
        setPhase("saved");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof GenerationStreamError && err.kind === "aborted") return;

        // Silent one-shot fallback: the stream failed before ANYTHING was
        // shown (no stage event) for transport-ish reasons — e.g. a proxy
        // that can't pass SSE. 4xx JSON refusals (rate limit, auth) would
        // fail identically in standard mode, so those show the message.
        const streamErr = err instanceof GenerationStreamError ? err : null;
        const failedBeforeAnything = streamErr ? !streamErr.receivedStage : false;
        const isPlainRefusal =
          streamErr?.kind === "http" && (streamErr.status ?? 0) >= 400 && (streamErr.status ?? 0) < 500;
        if (failedBeforeAnything && !isPlainRefusal && !triedAutoFallbackRef.current) {
          triedAutoFallbackRef.current = true;
          setPhase("fallback");
          try {
            await onFallbackRef.current(); // navigates away on success
          } catch (fbErr) {
            if (!cancelled) {
              setPhase("error");
              setError(fbErr instanceof Error ? fbErr.message : "Failed to generate page");
            }
          }
          return;
        }

        setPhase("error");
        setError(err instanceof Error ? err.message : "Failed to generate page");
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    };
    // `body` is stable for the lifetime of this mount (the modal remounts the
    // view per submit); `attempt` re-runs the stream for "Try again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // ── "Use standard mode" (manual fallback from the error card) ─────────────
  const runStandardMode = useCallback(async () => {
    setPhase("fallback");
    setError(null);
    try {
      await onFallbackRef.current(); // navigates away on success
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Failed to generate page");
    }
  }, []);

  // ── Auto-navigate countdown ────────────────────────────────────────────────
  const [countdown, setCountdown] = useState(6);
  useEffect(() => {
    if (phase !== "saved" || savedPageId === null) return;
    setCountdown(6);
    const id = setInterval(() => {
      // Pause while the user is hovering or just scrolled the preview.
      if (hoveringRef.current || Date.now() - lastUserScrollRef.current < 1500) return;
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          onOpenRef.current(savedPageId);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, savedPageId]);

  // ── Derived bits ───────────────────────────────────────────────────────────
  const streaming = phase === "streaming";
  const brandButtonCss = getBrandButtonCss(brand);
  const showReceiptCard = receipt !== null && (phase === "saving" || phase === "saved");
  const tenantName = brand.brandName?.trim() || "Your page";

  const imageCount = useMemo(() => {
    if (!result) return 0;
    const acc = new Set<string>();
    collectImageUrls(result.blocks, acc);
    return acc.size;
  }, [result]);

  const recipeLine = useMemo(() => {
    if (!receipt) return null;
    if (receipt.recipeId) return humanizeRecipeId(receipt.recipeId);
    if (templateName) return `Template: ${templateName}`;
    if (receipt.intentMatchedTemplate?.slug) {
      return `Template: ${humanizeTemplateSlug(receipt.intentMatchedTemplate.slug)}`;
    }
    return "Custom layout";
  }, [receipt, templateName]);

  const failedRefs = refsMeta?.failed ?? [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 min-h-0">
      {/* ── LEFT RAIL ── */}
      <aside className="w-[260px] shrink-0 border-r border-border bg-muted/30 flex flex-col overflow-y-auto">
        {showReceiptCard && receipt ? (
          <div className="p-4 space-y-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-primary" />
              </div>
              <p className="font-semibold text-foreground">Your page is ready</p>
            </div>

            <ul className="space-y-2.5 text-xs text-muted-foreground">
              {recipeLine && (
                <li className="flex items-start gap-2">
                  <Layout className="w-3.5 h-3.5 mt-0.5 shrink-0 text-foreground/60" />
                  <span className="text-foreground">{recipeLine}</span>
                </li>
              )}
              {receipt.scrapedUrls.length > 0 && (
                <li className="flex items-start gap-2">
                  <Link2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-foreground/60" />
                  <span>
                    Studied:{" "}
                    <span className="text-foreground">
                      {receipt.scrapedUrls.map(hostOf).join(", ")}
                    </span>
                  </span>
                </li>
              )}
              {failedRefs.map((f) => (
                <li key={f.url} className="flex items-start gap-2 text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Couldn't read {hostOf(f.url)} — retry next time</span>
                </li>
              ))}
              {receipt.inspirationReferences.length > 0 && (
                <li className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-foreground/60" />
                  <span>
                    Inspiration:{" "}
                    <span className="text-foreground">
                      {receipt.inspirationReferences.map((r) => hostOf(r.url)).join(", ")}
                    </span>
                  </span>
                </li>
              )}
              {imageCount > 0 && (
                <li className="flex items-start gap-2">
                  <ImageIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-foreground/60" />
                  <span>
                    {imageCount} image{imageCount === 1 ? "" : "s"} from your library
                  </span>
                </li>
              )}
              {receipt.imageFitFlagCount > 0 && (
                <li className="flex items-start gap-2 text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    {receipt.imageFitFlagCount} image{receipt.imageFitFlagCount === 1 ? "" : "s"} flagged for review
                  </span>
                </li>
              )}
              {receipt.critiqueCount > 0 && (
                <li className="flex items-start gap-2">
                  <Wand2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-foreground/60" />
                  <span>
                    Polished {receipt.critiqueCount} block{receipt.critiqueCount === 1 ? "" : "s"}
                  </span>
                </li>
              )}
              {receipt.usedScreenshot && (
                <li className="flex items-start gap-2">
                  <Monitor className="w-3.5 h-3.5 mt-0.5 shrink-0 text-foreground/60" />
                  <span>Used your screenshot for layout cues</span>
                </li>
              )}
            </ul>

            <div className="pt-1 space-y-2">
              <Button
                className="w-full gap-2"
                disabled={phase !== "saved" || savedPageId === null}
                onClick={() => savedPageId !== null && onOpen(savedPageId)}
              >
                {phase === "saving" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
                    Saving…
                  </>
                ) : (
                  <>
                    Open in builder{countdown > 0 ? ` (${countdown})` : ""}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
              {phase === "saved" && countdown > 0 && (
                <p className="text-[11px] text-muted-foreground text-center leading-snug">
                  Opening automatically in {countdown}s — hover the preview to pause.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* aria-live so screen readers hear each stage label as it starts/completes. */}
            <ol className="space-y-3" aria-live="polite" aria-label="Generation progress">
              {STAGE_DEFS.map((def) => {
                const status = stageState[def.id];
                const label = stageLabels[def.id] ?? def.label;
                return (
                  <li key={def.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 w-4 h-4 flex items-center justify-center shrink-0">
                      {status === "done" ? (
                        <Check className="w-4 h-4 text-primary" aria-hidden />
                      ) : status === "active" ? (
                        <Loader2
                          className="w-4 h-4 text-primary animate-spin motion-reduce:animate-none"
                          aria-hidden
                        />
                      ) : (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
                          aria-hidden
                        />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-xs leading-snug",
                          status === "pending" && "text-muted-foreground",
                          status === "active" && "text-foreground font-medium",
                          status === "done" && "text-foreground/80",
                        )}
                      >
                        {label}
                        <span className="sr-only">
                          {status === "done" ? " — done" : status === "active" ? " — in progress" : ""}
                        </span>
                      </p>
                      {def.id === "references" && refsMeta && (
                        <ul className="mt-1.5 space-y-1">
                          {refsMeta.scraped.map((u) => (
                            <li
                              key={u}
                              className="flex items-center gap-1 text-[11px] text-muted-foreground truncate"
                              title={u}
                            >
                              <Check className="w-3 h-3 text-primary shrink-0" aria-hidden />
                              <span className="truncate">{hostOf(u)}</span>
                            </li>
                          ))}
                          {refsMeta.failed.map((f) => (
                            <li
                              key={f.url}
                              className="flex items-center gap-1 text-[11px] text-amber-600 truncate"
                              title={`${f.url} — ${f.reason}`}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden />
                              <span className="truncate">
                                {hostOf(f.url)} ({f.reason.replace(/_/g, " ")})
                              </span>
                            </li>
                          ))}
                          {refsMeta.fromInspiration.map((u) => (
                            <li
                              key={`insp:${u}`}
                              className="flex items-center gap-1 text-[11px] text-muted-foreground/80 truncate"
                              title={`${u} (inspiration site)`}
                            >
                              <Sparkles className="w-3 h-3 shrink-0" aria-hidden />
                              <span className="truncate">{hostOf(u)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="pt-2 border-t border-border space-y-1.5">
              <p className="text-[11px] text-muted-foreground tabular-nums">
                Elapsed: {Math.floor(elapsed / 60) > 0 ? `${Math.floor(elapsed / 60)}m ` : ""}
                {elapsed % 60}s
              </p>
              <p className="text-[11px] text-muted-foreground/80">Usually under a minute.</p>
            </div>

            <Button variant="outline" size="sm" className="w-full" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        )}
      </aside>

      {/* ── CANVAS ── */}
      <div
        className="relative flex-1 min-h-0 bg-muted/50"
        onMouseEnter={() => {
          hoveringRef.current = true;
          setHoveringPreview(true);
        }}
        onMouseLeave={() => {
          hoveringRef.current = false;
          setHoveringPreview(false);
        }}
      >
        <div
          ref={canvasRef}
          onScroll={handleCanvasScroll}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden p-6"
          aria-busy={streaming}
          aria-label="Live page preview"
        >
          <div className="mx-auto" style={{ width: PAGE_DESIGN_WIDTH * scale }}>
            {/* Browser-chrome top bar */}
            <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-border bg-card px-3 py-2">
              <span className="flex gap-1.5" aria-hidden>
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
              </span>
              <span className="flex-1 text-center text-[11px] text-muted-foreground truncate">
                {tenantName}
              </span>
            </div>

            {/* Scaled page surface. Spacer height = content height × scale so
                the scroll container's height matches what's visible. */}
            <div
              className="relative overflow-hidden rounded-b-lg border border-border bg-white shadow-sm"
              style={{ height: innerH > 0 ? innerH * scale : undefined, minHeight: 240 }}
            >
              <div
                style={{
                  width: PAGE_DESIGN_WIDTH,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                {/* Page-level brand wrapper — same conventions as the
                    landing-page viewer: [data-lp-page] + brand CSS vars +
                    BrandFontLoader + brand button CSS. */}
                <div
                  ref={innerRef}
                  data-lp-page
                  className="w-full bg-white font-sans"
                  style={getBrandStyleVars(brand)}
                >
                  <BrandFontLoader brand={brand} />
                  {brandButtonCss && <style>{brandButtonCss}</style>}
                  {entries.map((entry) => (
                    <LiveBlock
                      key={entry.key}
                      block={entry.block}
                      hash={entry.hash}
                      brand={brand}
                      reduced={reduced}
                    />
                  ))}

                  {/* Shimmer skeleton: the "next section is being written"
                      placeholder while streaming (and the whole-page skeleton
                      on the template path, which emits no per-block events). */}
                  {streaming && (
                    <div className="px-16 py-14 space-y-6" aria-hidden>
                      {entries.length === 0 && (
                        <div className="space-y-6 pb-10">
                          <div className="h-64 rounded-2xl bg-slate-100 animate-pulse motion-reduce:animate-none" />
                          <div className="grid grid-cols-3 gap-6">
                            <div className="h-32 rounded-xl bg-slate-100 animate-pulse motion-reduce:animate-none" />
                            <div className="h-32 rounded-xl bg-slate-100 animate-pulse motion-reduce:animate-none" />
                            <div className="h-32 rounded-xl bg-slate-100 animate-pulse motion-reduce:animate-none" />
                          </div>
                        </div>
                      )}
                      <div className="h-7 w-1/3 rounded-md bg-slate-100 animate-pulse motion-reduce:animate-none" />
                      <div className="space-y-3">
                        <div className="h-4 w-5/6 rounded bg-slate-100 animate-pulse motion-reduce:animate-none" />
                        <div className="h-4 w-2/3 rounded bg-slate-100 animate-pulse motion-reduce:animate-none" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Jump-to-latest pill (auto-follow paused by a manual scroll-up) */}
        {!following && streaming && entries.length > 0 && (
          <button
            type="button"
            onClick={() => jumpToLatest()}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background text-xs font-medium px-3.5 py-1.5 shadow-lg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowDown className="w-3.5 h-3.5" aria-hidden />
            Jump to latest
          </button>
        )}

        {/* Repeat-guard restart notice */}
        {restartMsg && (
          <div
            className="absolute inset-x-0 top-6 z-20 flex justify-center px-6"
            role="status"
            aria-live="polite"
          >
            <motion.div
              initial={reduced ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-lg border border-border bg-card px-4 py-2.5 text-xs text-foreground shadow-md max-w-md text-center"
            >
              {restartMsg}
            </motion.div>
          </div>
        )}

        {/* Silent / manual fallback in progress */}
        {phase === "fallback" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-sm text-foreground">
              <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none text-primary" aria-hidden />
              Generating your page…
            </div>
          </div>
        )}

        {/* Error state */}
        {phase === "error" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
            <div
              className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center space-y-4 shadow-lg"
              role="alert"
            >
              <div className="mx-auto w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Generation hit a snag</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
              </div>
              <div className="flex justify-center gap-2">
                <Button size="sm" onClick={() => setAttempt((a) => a + 1)}>
                  Try again
                </Button>
                <Button size="sm" variant="outline" onClick={() => void runStandardMode()}>
                  Use standard mode
                </Button>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Back to the form
              </button>
            </div>
          </div>
        )}

        {/* Hover hint while the countdown is paused */}
        {phase === "saved" && hoveringPreview && countdown > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-foreground/90 text-background text-[11px] px-3 py-1 shadow">
            Auto-open paused
          </div>
        )}
      </div>
    </div>
  );
}
