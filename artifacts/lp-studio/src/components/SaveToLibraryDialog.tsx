import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookmarkPlus } from "lucide-react";
import type { PageBlock } from "@/lib/block-types";
import { getBlockDef } from "@/lib/block-types";

const API_BASE = "/api";

interface Props {
  open: boolean;
  block: PageBlock | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SaveToLibraryDialog({ open, block, onClose, onSaved }: Props) {
  const defaultName = block ? (getBlockDef(block.type)?.label ?? block.type) : "";
  const [name, setName] = useState(defaultName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && block) {
      setName(getBlockDef(block.type)?.label ?? block.type);
      setError(null);
    }
  }, [open, block?.id]);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setError(null);
      onClose();
    }
  };

  const handleSave = async () => {
    if (!block) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a name.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/lp/custom-blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          block_type: block.type,
          props: block.props,
          block_settings: block.blockSettings ?? {},
        }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Save failed");
      }
      onSaved();
      onClose();
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="w-4 h-4 text-primary" />
            Save to Library
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Name</Label>
            <Input
              value={name}
              onChange={e => { setName(e.target.value); setError(null); }}
              placeholder="e.g. Homepage Hero"
              onKeyDown={e => { if (e.key === "Enter") void handleSave(); }}
              autoFocus
            />
          </div>
          {block && (
            <p className="text-xs text-muted-foreground">
              Saves the current <span className="font-medium">{getBlockDef(block.type)?.label ?? block.type}</span> block — content, colors, and layout settings — to your block library for reuse on any page.
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save to Library"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
