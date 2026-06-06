// Task #1138 — Strict Facts review modal. Lists every detected stat / claim /
// quote on the page that isn't already in the tenant's approved pool, grouped
// by kind, with per-row actions (approve-for-page, edit, swap, remove,
// save-to-library, undo). The values stay on the page — this is review, not
// removal (memory: strict-facts-no-scrub). Driven entirely by the persistent
// fact flags so a refresh / reopen always shows the live triage state.
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Replace,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { type FactFlag, type FactKind, type ProofPointOption, getProofPointsForKind } from "@/lib/fact-flags-api";
import type { UseFactFlags } from "@/hooks/use-fact-flags";

const KIND_LABEL: Record<FactKind, string> = {
  stat: "Stats",
  claim: "Claims",
  quote: "Quotes",
};

const STATE_BADGE: Partial<Record<FactFlag["triageState"], string>> = {
  approved_for_page: "Approved",
  edited: "Edited",
  swapped: "Swapped",
  removed: "Removed",
};

function FactRow({ flag, ff }: { flag: FactFlag; ff: UseFactFlags }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(flag.replacementText ?? flag.originalText);
  const [busy, setBusy] = useState<string | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [options, setOptions] = useState<ProofPointOption[]>([]);

  const resolved = flag.triageState !== "pending";
  const context = [flag.blockType, flag.fieldPath].filter(Boolean).join(" · ");
  const display = flag.replacementText ?? flag.originalText;

  const guard = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
    } catch (err) {
      toast({
        title: "Couldn't update",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const openSwap = async () => {
    setSwapOpen(true);
    if (options.length === 0) setOptions(await getProofPointsForKind(flag.factKind));
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        {context ? (
          <p className="text-[11px] text-muted-foreground truncate" title={context}>
            {context}
          </p>
        ) : <span />}
        {resolved && STATE_BADGE[flag.triageState] && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {STATE_BADGE[flag.triageState]}
          </Badge>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-9 text-sm flex-1" />
          <Button
            size="sm"
            disabled={busy !== null || !draft.trim()}
            onClick={() => guard("edit", async () => { await ff.edit(flag.id, draft.trim()); setEditing(false); })}
          >
            {busy === "edit" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(display); }}>
            Cancel
          </Button>
        </div>
      ) : swapOpen ? (
        <div className="flex items-center gap-2">
          <Select onValueChange={(v) => guard("swap", async () => { await ff.swap(flag.id, Number(v)); setSwapOpen(false); })}>
            <SelectTrigger className="h-9 text-sm flex-1">
              <SelectValue placeholder={options.length ? "Pick an approved fact…" : "No approved facts of this kind"} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.label ? `${o.label} — ${o.value}` : o.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => setSwapOpen(false)}>Cancel</Button>
        </div>
      ) : (
        <p className="text-sm font-medium break-words">{display}</p>
      )}

      {!editing && !swapOpen && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {resolved ? (
            <Button size="sm" variant="ghost" disabled={busy !== null}
              onClick={() => guard("undo", () => ff.undo(flag.id))}>
              {busy === "undo" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
              Undo
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" disabled={busy !== null}
                onClick={() => guard("approve", () => ff.approve(flag.id))}>
                {busy === "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                Approve
              </Button>
              <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setEditing(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
              </Button>
              <Button size="sm" variant="ghost" disabled={busy !== null} onClick={openSwap}>
                <Replace className="w-3.5 h-3.5 mr-1" /> Swap
              </Button>
              <Button size="sm" variant="ghost" disabled={busy !== null}
                onClick={() => guard("remove", () => ff.remove(flag.id))}>
                {busy === "remove" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                Remove
              </Button>
            </>
          )}
          {!flag.librarySaved && (
            <Button size="sm" variant="ghost" disabled={busy !== null}
              onClick={() => guard("lib", async () => { await ff.saveToLibrary(flag.id); toast({ title: "Saved to your facts library" }); })}>
              {busy === "lib" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
              Save to library
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function FactReviewModal({
  open,
  onOpenChange,
  ff,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ff: UseFactFlags;
}) {
  const { toast } = useToast();
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (open) void ff.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const grouped = useMemo(() => {
    const by: Record<FactKind, FactFlag[]> = { stat: [], claim: [], quote: [] };
    for (const f of ff.flags) by[f.factKind].push(f);
    return by;
  }, [ff.flags]);

  const kinds: FactKind[] = (["stat", "claim", "quote"] as FactKind[]).filter((k) => grouped[k].length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Review facts</DialogTitle>
          <DialogDescription>
            These stats, claims and quotes aren't in your approved facts yet. They stay on the page —
            approve, edit, swap or remove each one. Saving to your library lets the AI reuse it next time.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-4 mt-1">
          {kinds.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nothing to review — every fact on this page is approved.
            </p>
          )}
          {kinds.map((kind) => (
            <div key={kind} className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {KIND_LABEL[kind]}
              </p>
              {grouped[kind].map((flag) => (
                <FactRow key={flag.id} flag={flag} ff={ff} />
              ))}
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {ff.pendingCount > 0 && (
            <Button
              variant="outline"
              disabled={bulkBusy}
              onClick={async () => {
                setBulkBusy(true);
                try {
                  const n = await ff.bulkApprove();
                  toast({ title: `Approved ${n} fact${n === 1 ? "" : "s"} for this page` });
                } catch (err) {
                  toast({
                    title: "Couldn't approve all",
                    description: err instanceof Error ? err.message : "Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setBulkBusy(false);
                }
              }}
            >
              {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Approve all ({ff.pendingCount})
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
