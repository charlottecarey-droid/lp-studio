import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE, type Page } from "./types";

export function SaveTemplateDialog({
  page,
  onClose,
  onSaved,
}: {
  page: Page;
  onClose: () => void;
  onSaved: (updated: Page) => void;
}) {
  const [label, setLabel] = useState(page.templateLabel ?? page.title);
  const [description, setDescription] = useState(page.templateDescription ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${page.id}/mark-template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTemplate: true, templateLabel: label.trim() || page.title, templateDescription: description.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated: Page = await res.json();
      onSaved(updated);
      onClose();
    } catch {
      alert("Failed to save template. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            Save as Template
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            This page will appear in the sales team's template picker when they create a new microsite.
          </p>
          <div>
            <Label className="text-sm font-medium">Template Name</Label>
            <Input
              className="mt-1.5"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. DSO Dark Enterprise Skin"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <textarea
              className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              rows={2}
              placeholder="e.g. Dark-mode enterprise skin for large regional DSOs"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !label.trim()} className="gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
