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
 * Saving stays the frontend's job — but it's DEFERRED (June 2026, shuffle):
 * on `result` we hold the payload in state and arm the "Open in builder" CTA
 * with a 6-second auto-navigate countdown (paused while the user hovers or
 * scrolls the preview). The caller-provided save flow (POST /api/lp/pages
 * etc., incl. fact flags + critique stash) runs only when the user clicks
 * "Open in builder" or the countdown fires — so "Shuffle layout" can discard
 * the held result and re-stream without orphaning a saved page. Shuffling
 * accumulates the session's used recipe ids into `excludeRecipeIds` (cap 10)
 * and permanently stops the auto-open countdown (manual open only).
 *
 * Failure handling:
 *   • failure BEFORE any stage event → ONE silent automatic fallback to the
 *     existing non-streaming flow (no user-visible error);
 *   • mid-stream failure → friendly error card with "Try again" (re-streams)
 *     and "Use standard mode" (non-streaming flow);
 *   • unmount/cancel aborts the fetch — the backend treats the disconnect
 *     as an abort.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Dices,
  Image as ImageIcon,
  Layout,
  Link2,
  Loader2,
  Monitor,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_BRAND,
  fetchBrandConfig,
  type BrandConfig,
} from "@/lib/brand-config";
import {
  streamGeneration,
  streamGenerationViaJob,
  GenerationStreamError,
  type GenerationRequestBody,
  type GenerationResult,
  type GenerationStageId,
  type GenerationReceipt,
} from "@/lib/generationStream";
import {
  DEFAULT_STAGE_DEFS,
  initialStageState,
  hostOf,
  toEntry,
  toEntries,
  type LiveEntry,
  type RefsMeta,
  type StageStatus,
} from "@/components/generation/liveBlocks";
import { GenerationStageRail } from "@/components/generation/GenerationStageRail";
import { LivePreviewCanvas } from "@/components/generation/LivePreviewCanvas";

/** "ready" = result held in state, NOT yet saved (save-on-exit — see header
 *  comment); "saving" = the exit save is in flight. */
type Phase = "streaming" | "ready" | "saving" | "fallback" | "error";

/** Max recipe ids we'll ask the server to avoid across shuffles. */
const MAX_EXCLUDED_RECIPES = 10;

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
  const [error, setError] = useState<string | null>(null);
  /** Exit-save failure — shown inline on the receipt card so the (already
   *  generated) page isn't thrown away; "Open in builder" retries the save. */
  const [saveError, setSaveError] = useState<string | null>(null);
  const triedAutoFallbackRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Shuffle state ──────────────────────────────────────────────────────────
  // Recipe ids used in THIS modal session (accumulated across shuffles, cap
  // 10) — sent as `excludeRecipeIds` so a re-roll lands on a fresh layout.
  const excludedRecipeIdsRef = useRef<string[]>([]);
  const [shuffleCount, setShuffleCount] = useState(0);
  // Once the user shuffles (or an exit save fails), the auto-open countdown
  // stops permanently — only the manual "Open in builder" exits after that.
  const [autoOpenStopped, setAutoOpenStopped] = useState(false);
  const autoOpenStoppedRef = useRef(false);
  const stopAutoOpen = useCallback(() => {
    autoOpenStoppedRef.current = true;
    setAutoOpenStopped(true);
  }, []);

  // ── Elapsed timer ──────────────────────────────────────────────────────────
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (phase !== "streaming" && phase !== "fallback") return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase, attempt]);

  // ── Preview interaction ────────────────────────────────────────────────────
  // The scaled canvas (scaling, scroll-follow, shimmer) lives in
  // LivePreviewCanvas; we only track hover + manual-scroll here so the
  // auto-open countdown can pause while the user inspects the preview.
  const lastUserScrollRef = useRef(0);
  const [hoveringPreview, setHoveringPreview] = useState(false);
  const hoveringRef = useRef(false);

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
    setSaveError(null);
    startRef.current = Date.now();
    setElapsed(0);

    // Shuffles re-run this effect (attempt++) with the SAME body plus the
    // accumulated exclusion list. First run sends the body untouched.
    const excluded = excludedRecipeIdsRef.current;
    const effectiveBody: GenerationRequestBody =
      excluded.length > 0 ? { ...body, excludeRecipeIds: [...excluded] } : body;

    void (async () => {
      try {
        // July 2026: async job mode (dark behind VITE_GENERATION_JOBS=1) —
        // the generation survives connection drops and re-attaches once.
        const streamFn =
          import.meta.env.VITE_GENERATION_JOBS === "1" ? streamGenerationViaJob : streamGeneration;
        const streamed = await streamFn(
          effectiveBody,
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
        // DELAYED SAVE: hold the result in state. The save flow runs in
        // commitAndOpen() when the user clicks "Open in builder" or the
        // countdown fires — a shuffle before then discards this result
        // without ever creating a page row.
        setResult(streamed);
        setPhase("ready");
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

  // ── Exit: save the held result, then open the builder ─────────────────────
  // Save-on-exit (not save-on-result) so "Shuffle layout" never orphans a
  // saved page. Runs from the button click AND the countdown; the phase guard
  // makes double-fires (countdown tick racing a click) no-ops.
  const resultRef = useRef<GenerationResult | null>(null);
  resultRef.current = result;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const commitAndOpen = useCallback(async () => {
    const held = resultRef.current;
    if (held === null || phaseRef.current !== "ready") return;
    setPhase("saving");
    setSaveError(null);
    try {
      const pageId = await onSaveRef.current(held);
      onOpenRef.current(pageId);
    } catch (err) {
      // Don't discard a perfectly good generation over a save blip — back to
      // "ready" with an inline error; the button retries. Auto-open stops so
      // the countdown can't loop a failing save.
      stopAutoOpen();
      setSaveError(err instanceof Error ? err.message : "Could not save the page");
      setPhase("ready");
    }
  }, [stopAutoOpen]);

  // ── Shuffle layout (freeform generations only) ─────────────────────────────
  const handleShuffle = useCallback(() => {
    if (phaseRef.current !== "ready") return;
    const id = receipt?.recipeId;
    if (id) {
      const next = excludedRecipeIdsRef.current.filter((x) => x !== id);
      next.push(id);
      // Cap at 10 — drop the OLDEST exclusions first so recent layouts stay
      // excluded.
      excludedRecipeIdsRef.current = next.slice(-MAX_EXCLUDED_RECIPES);
    }
    stopAutoOpen(); // permanent — manual "Open in builder" only from now on
    setShuffleCount((c) => c + 1);
    setSaveError(null);
    setAttempt((a) => a + 1); // re-runs the stream effect (discards held result)
  }, [receipt, stopAutoOpen]);

  // ── Auto-navigate countdown (runs the delayed save when it fires) ─────────
  const [countdown, setCountdown] = useState(6);
  useEffect(() => {
    if (phase !== "ready" || result === null || autoOpenStopped) return;
    setCountdown(6);
    const id = setInterval(() => {
      // Pause while the user is hovering or just scrolled the preview; stop
      // outright once the user has shuffled.
      if (autoOpenStoppedRef.current) {
        clearInterval(id);
        return;
      }
      if (hoveringRef.current || Date.now() - lastUserScrollRef.current < 1500) return;
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          void commitAndOpen();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, result, autoOpenStopped, commitAndOpen]);

  // ── Derived bits ───────────────────────────────────────────────────────────
  const streaming = phase === "streaming";
  const showReceiptCard = receipt !== null && (phase === "ready" || phase === "saving");
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
              {/* Quality ledger — anything that silently fell back during
                  generation. warn = act before publishing; info = FYI. */}
              {(receipt.degradations ?? []).map((d, i) => (
                <li
                  key={`${d.code}-${i}`}
                  className={`flex items-start gap-2 ${d.severity === "warn" ? "text-amber-600" : "text-foreground/60"}`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{d.detail}</span>
                </li>
              ))}
            </ul>

            <div className="pt-1 space-y-2">
              <Button
                className="w-full gap-2"
                disabled={phase !== "ready"}
                onClick={() => void commitAndOpen()}
              >
                {phase === "saving" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
                    Saving…
                  </>
                ) : (
                  <>
                    Open in builder
                    {!autoOpenStopped && countdown > 0 ? ` (${countdown})` : ""}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
              {/* Shuffle — freeform generations only (recipeId is null on the
                  template path, where the layout is fixed by design). */}
              {receipt.recipeId !== null && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  disabled={phase !== "ready"}
                  onClick={handleShuffle}
                >
                  <Dices className="w-4 h-4" aria-hidden />
                  Shuffle layout
                </Button>
              )}
              {saveError && (
                <p className="text-[11px] text-red-600 text-center leading-snug" role="alert">
                  {saveError} — click "Open in builder" to retry.
                </p>
              )}
              {phase === "ready" && !autoOpenStopped && countdown > 0 && (
                <p className="text-[11px] text-muted-foreground text-center leading-snug">
                  Opening automatically in {countdown}s — hover the preview to pause.
                </p>
              )}
              {shuffleCount > 0 && !saveError && (
                <p className="text-[11px] text-muted-foreground text-center leading-snug">
                  We'll avoid the layouts you've already seen.
                </p>
              )}
            </div>
          </div>
        ) : (
          <GenerationStageRail
            stageDefs={DEFAULT_STAGE_DEFS}
            stageState={stageState}
            stageLabels={stageLabels}
            refsMeta={refsMeta}
            elapsed={elapsed}
            onCancel={onCancel}
          />
        )}
      </aside>

      {/* ── CANVAS ── */}
      <LivePreviewCanvas
        entries={entries}
        brand={brand}
        streaming={streaming}
        reduced={reduced}
        title={tenantName}
        restartMsg={restartMsg}
        onHoverChange={(h) => {
          hoveringRef.current = h;
          setHoveringPreview(h);
        }}
        onUserScroll={() => {
          lastUserScrollRef.current = Date.now();
        }}
        resetFollowKey={attempt}
        overlay={
          <>
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
            {phase === "ready" && !autoOpenStopped && hoveringPreview && countdown > 0 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-foreground/90 text-background text-[11px] px-3 py-1 shadow">
                Auto-open paused
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
