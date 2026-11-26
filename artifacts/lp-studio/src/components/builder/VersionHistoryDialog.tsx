/**
 * Version history — lists a page's saved versions (api-server
 * routes/lp/page-versions.ts) and restores one, or saves a named checkpoint.
 *
 * Each version is the page as it was BEFORE a save, publish, restore or
 * delete. Restoring puts that content back on the server (the current saved
 * content is versioned first, so a restore can be undone), then the builder
 * reloads to show it. Slug and publish status are kept: restoring a live page
 * changes the live page.
 */
import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, History, Loader2, RotateCcw, Save } from "lucide-react";

const API_BASE = "/api";

export interface PageVersionSummary {
  id: number;
  createdAt: string;
  createdBy: string | null;
  reason: string;
  note: string | null;
  title: string;
  status: string;
  blockCount: number;
}

interface VersionHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  pageId: number;
  /** The builder has edits that aren't saved yet; restoring discards them. */
  isDirty: boolean;
  /** Is the page currently published (restoring changes the live page). */
  isLive: boolean;
  /** Called after a successful restore; the builder reloads the page. */
  onRestored: () => void;
}

/** What happened right after this snapshot was taken, in plain words. */
export function reasonLabel(reason: string): string {
  switch (reason) {
    case "checkpoint": return "Checkpoint";
    case "publish": return "Before publishing";
    case "unpublish": return "Before unpublishing";
    case "restore": return "Before a restore";
    case "delete": return "Before deleting";
    default: return "Before editing";
  }
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function VersionHistoryDialog({ open, onClose, pageId, isDirty, isLive, onRestored }: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<PageVersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [outline, setOutline] = useState<Record<number, string[]>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${pageId}/versions?limit=100`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't load the history.");
      setVersions((data?.versions ?? []) as PageVersionSummary[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the history.");
    }
  }, [pageId]);

  useEffect(() => {
    if (!open) return;
    setVersions(null);
    setConfirmId(null);
    setExpanded(null);
    void load();
  }, [open, load]);

  async function toggle(id: number) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (outline[id]) return;
    try {
      const res = await fetch(`${API_BASE}/lp/page-versions/${id}`);
      const data = await res.json();
      const blocks = (data?.snapshot?.blocks ?? []) as { type?: string }[];
      setOutline((o) => ({ ...o, [id]: blocks.map((b) => String(b.type ?? "block")) }));
    } catch {
      setOutline((o) => ({ ...o, [id]: [] }));
    }
  }

  async function restore(id: number) {
    setBusyId(id);
    try {
      const res = await fetch(`${API_BASE}/lp/page-versions/${id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't restore that version.");
      onRestored();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't restore that version.");
      setBusyId(null);
    }
  }

  async function checkpoint() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${pageId}/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || "Checkpoint" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't save a checkpoint.");
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save a checkpoint.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col" data-testid="version-history-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4" /> Version history
          </DialogTitle>
          <DialogDescription className="text-xs">
            A version is saved before edits (once per editing session), before publishing or unpublishing, and before a restore. Restoring keeps the page&apos;s URL and publish status, and can be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Name a checkpoint, e.g. Before CTA changes"
            className="h-8 text-xs"
            maxLength={500}
            onKeyDown={(e) => { if (e.key === "Enter" && !saving) void checkpoint(); }}
            data-testid="version-checkpoint-note"
          />
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs shrink-0" disabled={saving} onClick={() => void checkpoint()} data-testid="version-checkpoint-save">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save checkpoint
          </Button>
        </div>
        {isDirty && (
          <p className="text-[11px] text-amber-700 bg-amber-50 rounded-md px-2 py-1.5">
            You have unsaved changes. A checkpoint saves the last saved version, so save first if you want your current edits in it.
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1.5 min-h-[120px]">
          {versions === null && !error && (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}
          {versions?.length === 0 && (
            <p className="text-xs text-muted-foreground py-8 text-center">No versions yet. One is saved the next time this page is edited, or save a checkpoint now.</p>
          )}
          {versions?.map((v) => (
            <div key={v.id} className="rounded-lg border px-3 py-2 text-xs" data-testid="version-row">
              <div className="flex items-start gap-2">
                <button type="button" className="mt-0.5 text-muted-foreground" onClick={() => void toggle(v.id)} aria-label="Show blocks">
                  {expanded === v.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{fmt(v.createdAt)}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{reasonLabel(v.reason)}</Badge>
                  </div>
                  {v.note && <p className="mt-0.5 text-foreground break-words">{v.note}</p>}
                  <p className="mt-0.5 text-muted-foreground truncate">
                    {v.title} · {v.blockCount} block{v.blockCount === 1 ? "" : "s"}{v.createdBy ? ` · ${v.createdBy}` : ""}
                  </p>
                </div>
                {confirmId === v.id ? (
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmId(null)} disabled={busyId !== null}>Cancel</Button>
                    <Button size="sm" variant="brand" className="h-7 px-2 text-xs" onClick={() => void restore(v.id)} disabled={busyId !== null} data-testid="version-restore-confirm">
                      {busyId === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Restore"}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs shrink-0" onClick={() => setConfirmId(v.id)} disabled={busyId !== null} data-testid="version-restore">
                    <RotateCcw className="w-3 h-3" /> Restore
                  </Button>
                )}
              </div>
              {confirmId === v.id && (
                <p className="mt-1.5 text-[11px] text-amber-700">
                  {isLive ? "This page is live: the live page will change too. " : ""}
                  {isDirty ? "Your unsaved changes will be lost. " : ""}
                  The current version is saved first, so you can undo this.
                </p>
              )}
              {expanded === v.id && (
                <div className="mt-1.5 ml-5 text-[11px] text-muted-foreground">
                  {outline[v.id] === undefined ? "Loading…" : outline[v.id].length ? outline[v.id].join(" → ") : "No blocks"}
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
