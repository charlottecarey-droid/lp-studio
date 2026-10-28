import { useState } from "react";
import { CheckCircle2, FileImage, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotAPdfError, createPdfThumbnail, looksLikeStoredPdf } from "@/lib/pdf-thumbnail";
import { cn } from "@/lib/utils";

/**
 * "Generate thumbnails" card for any block that lists PDFs with an optional cover image
 * (content hub library / featured, Resources, Webinar Hub resources). Renders page 1 of each
 * PDF in the browser, uploads it, and hands the caller EVERY result so far as one map — the
 * caller applies the whole map against its latest props. (Oct 2026: applying one result at a
 * time against click-time props undid each previous one; nothing stuck.)
 */
export interface PdfThumbnailCandidate {
  /** Caller's handle for the item (array index, or a composite the caller can decode). */
  index: number;
  title?: string;
  /** The PDF's URL. Only stored objects / *.pdf URLs are offered. */
  url?: string;
  /** Current cover image; items that already have one are left alone. */
  thumbnail?: string;
  /** Base name for the uploaded JPEG. */
  filename?: string;
}

export type PdfThumbnailResults = ReadonlyMap<number, string>;

interface Props {
  candidates: PdfThumbnailCandidate[];
  onThumbnails: (results: PdfThumbnailResults) => void;
  className?: string;
}

type Outcome = { title: string; reason: string; skipped: boolean };

export function PdfThumbnailGenerator({ candidates, onThumbnails, className }: Props) {
  const [busy, setBusy] = useState<{ title: string; n: number; of: number } | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [problems, setProblems] = useState<Outcome[]>([]);
  const pdfs = candidates.filter((c) => looksLikeStoredPdf(c.url));
  const todo = pdfs.filter((c) => !(c.thumbnail ?? "").trim());
  if (pdfs.length === 0) return null;

  const run = async (list: PdfThumbnailCandidate[]) => {
    setDone(null);
    setProblems([]);
    const results = new Map<number, string>();
    const bad: Outcome[] = [];
    for (const [i, c] of list.entries()) {
      const title = c.title?.trim() || `PDF ${i + 1}`;
      setBusy({ title, n: i + 1, of: list.length });
      try {
        const url = await createPdfThumbnail(c.url ?? "", c.filename || title);
        results.set(c.index, url);
        onThumbnails(new Map(results));
      } catch (err) {
        const skipped = err instanceof NotAPdfError;
        bad.push({ title, reason: err instanceof Error ? err.message : String(err), skipped });
        if (!skipped) console.warn("[thumbnails] PDF render failed", title, err);
      }
    }
    setBusy(null);
    setDone(results.size);
    setProblems(bad);
  };

  const failures = problems.filter((p) => !p.skipped);
  const skipped = problems.filter((p) => p.skipped);

  // Every PDF already has a cover: a one-line row with a re-render affordance instead of the
  // full card (covers deleted from the media library leave a dead URL behind; a swapped PDF
  // keeps its old cover). Removing a cover on a resource brings the full card back.
  if (todo.length === 0 && !busy && done === null && problems.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 rounded-md border border-border/70 px-2.5 py-1.5", className)} data-pdf-thumbnails="covered">
        <FileImage className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">Every PDF has a cover image.</span>
        <button type="button" onClick={() => void run(pdfs)} className="shrink-0 text-[11px] font-medium text-primary hover:underline" data-regenerate-thumbnails>
          Re-render {pdfs.length === 1 ? "it" : `all ${pdfs.length}`}
        </button>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-primary/20 bg-primary/[0.04] p-3", className)} data-pdf-thumbnails>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden>
          <FileImage className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight">Thumbnails from your PDFs</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {todo.length > 0
              ? `${todo.length === 1 ? "One PDF has" : `${todo.length} PDFs have`} no cover image yet. Use the first page of each as its thumbnail.`
              : "Every PDF has a cover image."}
          </p>
        </div>
      </div>

      {busy && (
        <div className="mt-2.5" role="status" aria-live="polite">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.max(6, Math.round(((busy.n - 1) / busy.of) * 100))}%` }} />
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            <span className="truncate">Rendering {busy.title}</span>
            <span className="ml-auto shrink-0 tabular-nums">{busy.n} of {busy.of}</span>
          </p>
        </div>
      )}

      {!busy && todo.length > 0 && (
        <Button type="button" size="sm" className="mt-2.5 h-8 w-full gap-1.5 text-xs" onClick={() => void run(todo)} data-generate-thumbnails>
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Generate {todo.length === 1 ? "thumbnail" : `${todo.length} thumbnails`}
        </Button>
      )}

      {!busy && todo.length === 0 && done !== null && (
        <button type="button" onClick={() => void run(pdfs)} className="mt-2.5 text-[11px] font-medium text-primary hover:underline" data-regenerate-thumbnails>
          Re-render {pdfs.length === 1 ? "it" : `all ${pdfs.length}`} from the PDFs
        </button>
      )}

      {!busy && done !== null && done > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700" data-thumbnail-done>
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          Added {done === 1 ? "one thumbnail" : `${done} thumbnails`}.
        </p>
      )}

      {!busy && failures.length > 0 && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900" data-thumbnail-failures>
          <p className="flex items-center gap-1.5 font-medium">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {failures.length === 1 ? "One PDF could not be rendered — set its thumbnail by hand." : `${failures.length} PDFs could not be rendered — set those by hand.`}
          </p>
          <ul className="mt-1 space-y-0.5 pl-5">
            {failures.map((f) => (
              <li key={f.title} className="list-disc">
                <span className="font-medium">{f.title}</span> — {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!busy && skipped.length > 0 && (
        <p className="mt-1.5 text-[11px] text-muted-foreground" data-thumbnail-skipped>
          Skipped {skipped.map((s) => s.title).join(", ")}: the linked file isn't a PDF.
        </p>
      )}
    </div>
  );
}
