/**
 * PrePublishDialog — the "ready to publish?" review shown when the user hits
 * Publish. Replaces the native confirm(): zero findings = a clean confirm
 * state; otherwise warnings + notes, each deep-linking to the offending block
 * on the canvas. Publishing is NEVER blocked — "Publish anyway" is always
 * available (the checks are advisory; the Strict-Facts 409 gate stays the
 * only hard stop, enforced server-side).
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, CheckCircle2, Info } from "lucide-react";
import type { PrePublishFinding } from "@/lib/pre-publish-checks";

export function PrePublishDialog({
  open,
  findings,
  publishing,
  onClose,
  onPublish,
  onGoToBlock,
}: {
  open: boolean;
  findings: PrePublishFinding[];
  publishing: boolean;
  onClose: () => void;
  onPublish: () => void;
  onGoToBlock: (blockId: string) => void;
}) {
  const warnings = findings.filter(f => f.severity === "warning");
  const notes = findings.filter(f => f.severity === "note");
  const clean = findings.length === 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !publishing) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[75vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {clean ? (
              <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Ready to publish</>
            ) : (
              <>Review before publishing</>
            )}
          </DialogTitle>
        </DialogHeader>

        {clean ? (
          <p className="text-sm text-muted-foreground">
            No issues found. The page will be publicly accessible.
          </p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {[...warnings, ...notes].map(f => (
              <div
                key={f.id}
                className={`rounded-lg border p-3 ${f.severity === "warning" ? "border-amber-200 bg-amber-50/60" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {f.severity === "warning" ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  ) : (
                    <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">{f.title}</p>
                    {f.detail && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{f.detail}</p>}
                  </div>
                  {f.blockId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 shrink-0"
                      onClick={() => onGoToBlock(f.blockId!)}
                    >
                      Go to block <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={publishing}>
            {clean ? "Cancel" : "Keep editing"}
          </Button>
          <Button onClick={onPublish} disabled={publishing}>
            {publishing ? "Publishing…" : clean ? "Publish" : warnings.length > 0 ? "Publish anyway" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
