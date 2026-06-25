/**
 * MicrositeGenerationLive — the live "watch your microsite build" view for the
 * sales microsite generator (June 2026). It reuses the exact stage rail +
 * scaled live preview canvas the marketing builder shows (see
 * components/generation/*), streaming
 * `POST /api/sales/accounts/:id/generate-microsite?stream=1`.
 *
 * Differences from the marketing GenerationLiveView: the microsite generator
 * builds the page server-side in one shot (no per-block streaming and no copy
 * critique pass), so this view omits the "polish" stage, the layout receipt /
 * shuffle, and the auto-open countdown. Blocks appear when the server emits its
 * normalized/imaged snapshots; until then the canvas shows its shimmer.
 *
 * On the terminal `result` event the page already exists (the endpoint created
 * it), so this view hands the new page id back to the modal via `onResult`,
 * which runs the existing hotlink-linking flow and shows the success screen.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_BRAND,
  fetchBrandConfig,
  type BrandConfig,
} from "@/lib/brand-config";
import {
  streamGeneration,
  GenerationStreamError,
  type GenerationStageId,
} from "@/lib/generationStream";
import {
  DEFAULT_STAGE_DEFS,
  initialStageState,
  toEntries,
  type GenerationStageDef,
  type LiveEntry,
  type RefsMeta,
  type StageStatus,
} from "@/components/generation/liveBlocks";
import { GenerationStageRail } from "@/components/generation/GenerationStageRail";
import { LivePreviewCanvas } from "@/components/generation/LivePreviewCanvas";

/** Terminal payload from generate-microsite — the created page + its blocks. */
interface MicrositeResult {
  page: { id: number };
  blocks: unknown[];
}

/** The microsite checklist leads with a dedicated account-research step — the
 *  slow 30-90s of account research + brief synthesis the rep used to wait
 *  through with a blank rail — then mirrors the marketing pipeline (context →
 *  references → model → images → polish → finalize). The microsite generator
 *  writes copy in one pass, so the backend emits a brief polish boundary with no
 *  heavy work — the stage still ticks through. The "research" step lives only on
 *  this rail, never on the shared marketing one. */
const MICROSITE_STAGE_DEFS: GenerationStageDef[] = [
  { id: "research", label: "Researching the account" },
  ...DEFAULT_STAGE_DEFS,
];

type Phase = "streaming" | "fallback" | "ready" | "error";

export interface MicrositeGenerationLiveProps {
  /** Numeric account id (already resolved/imported by the modal). */
  accountId: string;
  /** Generation request body — identical to the non-streaming POST body. */
  body: Record<string, unknown>;
  /** Browser-chrome label for the preview (the target account name). */
  accountLabel: string;
  /** The page already exists on success — hand its id to the modal so it can
   *  run the hotlink-linking flow and show the success screen. Errors there are
   *  surfaced by the modal (it flips to its own error step). */
  onResult: (pageId: number) => void;
  /** Abort + return to the form. */
  onCancel: () => void;
}

export function MicrositeGenerationLive({
  accountId,
  body,
  accountLabel,
  onResult,
  onCancel,
}: MicrositeGenerationLiveProps) {
  const reduced = useReducedMotion() ?? false;

  // Latest-callback refs so the long-lived stream effect never goes stale.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

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
  const [stageState, setStageState] = useState<Record<GenerationStageId, StageStatus>>(
    initialStageState,
  );
  const [stageLabels, setStageLabels] = useState<Partial<Record<GenerationStageId, string>>>({});
  const [refsMeta, setRefsMeta] = useState<RefsMeta | null>(null);
  const [entries, setEntries] = useState<LiveEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Set once we've handed the page id to the modal — the modal is running the
   *  linking flow and will unmount us shortly; show a "finishing" overlay. */
  const [finishing, setFinishing] = useState(false);
  const triedAutoFallbackRef = useRef(false);

  const endpoint = `/api/sales/accounts/${accountId}/generate-microsite?stream=1`;

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

  // Hand the created page id back to the modal exactly once.
  const handoffDoneRef = useRef(false);
  const handoff = useCallback((pageId: number) => {
    if (handoffDoneRef.current) return;
    handoffDoneRef.current = true;
    setFinishing(true);
    onResultRef.current(pageId);
  }, []);

  // ── Non-streaming fallback (proxy can't pass SSE) ──────────────────────────
  const runFallback = useCallback(async () => {
    setPhase("fallback");
    setError(null);
    const res = await fetch(`/api/sales/accounts/${accountId}/generate-microsite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: "Generation failed" }))) as {
        error?: string;
      };
      throw new Error(err.error ?? "Generation failed");
    }
    const data = (await res.json()) as MicrositeResult;
    setEntries(toEntries(data.blocks));
    setPhase("ready");
    handoff(data.page.id);
  }, [accountId, body, handoff]);

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
    setFinishing(false);
    handoffDoneRef.current = false;
    startRef.current = Date.now();
    setElapsed(0);

    void (async () => {
      try {
        const streamed = await streamGeneration<Record<string, unknown>, MicrositeResult>(
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
            onBlocks: (e) => {
              if (cancelled) return;
              setEntries(toEntries(e.blocks)); // full replacement, reconciled by key+hash
            },
          },
          ac.signal,
          { endpoint },
        );
        if (cancelled) return;
        setEntries(toEntries(streamed.blocks));
        setPhase("ready");
        handoff(streamed.page.id);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof GenerationStreamError && err.kind === "aborted") return;

        // Silent one-shot fallback: the stream failed before ANYTHING was shown
        // (no stage event) for transport-ish reasons — e.g. a proxy that can't
        // pass SSE. 4xx JSON refusals would fail identically without streaming,
        // so those show the message instead.
        const streamErr = err instanceof GenerationStreamError ? err : null;
        const failedBeforeAnything = streamErr ? !streamErr.receivedStage : false;
        const isPlainRefusal =
          streamErr?.kind === "http" &&
          (streamErr.status ?? 0) >= 400 &&
          (streamErr.status ?? 0) < 500;
        if (failedBeforeAnything && !isPlainRefusal && !triedAutoFallbackRef.current) {
          triedAutoFallbackRef.current = true;
          try {
            await runFallback();
          } catch (fbErr) {
            if (!cancelled) {
              setPhase("error");
              setError(fbErr instanceof Error ? fbErr.message : "Failed to generate microsite");
            }
          }
          return;
        }

        setPhase("error");
        setError(err instanceof Error ? err.message : "Failed to generate microsite");
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
    // `body`/`endpoint` are stable for the lifetime of this mount (the modal
    // remounts the view per submit); `attempt` re-runs the stream for "Try
    // again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // ── Manual fallback from the error card ────────────────────────────────────
  const runStandardMode = useCallback(async () => {
    try {
      await runFallback();
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Failed to generate microsite");
    }
  }, [runFallback]);

  const streaming = phase === "streaming";

  return (
    <div className="flex flex-1 min-h-0">
      {/* ── LEFT RAIL ── */}
      <aside className="w-[260px] shrink-0 border-r border-border bg-muted/30 flex flex-col overflow-y-auto">
        <GenerationStageRail
          stageDefs={MICROSITE_STAGE_DEFS}
          stageState={stageState}
          stageLabels={stageLabels}
          refsMeta={refsMeta}
          elapsed={elapsed}
          onCancel={onCancel}
        />
      </aside>

      {/* ── CANVAS ── */}
      <LivePreviewCanvas
        entries={entries}
        brand={brand}
        streaming={streaming}
        reduced={reduced}
        title={accountLabel}
        resetFollowKey={attempt}
        overlay={
          <>
            {/* Silent / manual fallback in progress */}
            {phase === "fallback" && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <Loader2
                    className="w-5 h-5 animate-spin motion-reduce:animate-none text-primary"
                    aria-hidden
                  />
                  Generating your microsite…
                </div>
              </div>
            )}

            {/* Linking in progress — page is built, modal is creating links */}
            {finishing && phase === "ready" && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 rounded-full bg-foreground/90 text-background text-[11px] px-3 py-1.5 shadow">
                <Loader2 className="w-3 h-3 animate-spin motion-reduce:animate-none" aria-hidden />
                Finishing up…
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
          </>
        }
      />
    </div>
  );
}
