import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ChevronUp, ChevronDown, Eye, EyeOff, RotateCcw, Loader2, Pencil, Check, X,
} from "lucide-react";
import type { ResolvedBlockDef } from "@/hooks/use-block-catalog";
import {
  EMPTY_PREFS,
  applyCategoryOrder,
  categoryLabel as resolveCategoryLabel,
  type BlockLibraryPrefs,
} from "@/lib/block-library-prefs";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Catalog-resolved blocks BEFORE prefs are applied — needed so we can
   *  toggle hidden ones back on. */
  catalogBlocks: ResolvedBlockDef[];
  prefs: BlockLibraryPrefs;
  saving: boolean;
  onSave: (next: BlockLibraryPrefs) => Promise<boolean>;
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function CustomizeBlockLibraryDialog({ open, onClose, catalogBlocks, prefs, saving, onSave }: Props) {
  const [draft, setDraft] = useState<BlockLibraryPrefs>(prefs);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Reset the working draft each time the dialog (re)opens.
  useEffect(() => {
    if (open) {
      setDraft(prefs);
      setEditingCategory(null);
    }
  }, [open, prefs]);

  // Build the working view from the unmodified catalog so hidden items are
  // still shown (toggleable). Apply only label/category overrides.
  const viewBlocks = useMemo(() => {
    return catalogBlocks.map(b => {
      const ov = draft.blockOverrides[b.type];
      return {
        ...b,
        label: ov?.label || b.label,
        category: (ov?.category as BlockCategory) || b.category,
      };
    });
  }, [catalogBlocks, draft.blockOverrides]);

  // Default category list = unique categories present in the catalog.
  const defaultCategoryOrder = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const b of viewBlocks) {
      if (!seen.has(b.category)) {
        seen.add(b.category);
        out.push(b.category);
      }
    }
    return out;
  }, [viewBlocks]);

  const orderedCategories = useMemo(
    () => applyCategoryOrder(defaultCategoryOrder, draft),
    [defaultCategoryOrder, draft],
  );

  const blocksByCategory = useMemo(() => {
    const map = new Map<string, ResolvedBlockDef[]>();
    for (const b of viewBlocks) {
      const arr = map.get(b.category) ?? [];
      arr.push(b);
      map.set(b.category, arr);
    }
    // For each category, apply explicit blockOrder if present, else sortOrder/label.
    for (const [cat, arr] of map) {
      const explicit = draft.blockOrder[cat] ?? [];
      const idx = new Map<string, number>();
      explicit.forEach((t, i) => idx.set(t, i));
      arr.sort((a, b) => {
        const ai = idx.get(a.type);
        const bi = idx.get(b.type);
        if (ai !== undefined && bi !== undefined) return ai - bi;
        if (ai !== undefined) return -1;
        if (bi !== undefined) return 1;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label);
      });
    }
    return map;
  }, [viewBlocks, draft.blockOrder]);

  const hiddenSet = useMemo(() => new Set(draft.hiddenBlockTypes), [draft.hiddenBlockTypes]);

  const toggleHidden = (type: string) => {
    setDraft(d => {
      const set = new Set(d.hiddenBlockTypes);
      if (set.has(type)) set.delete(type);
      else set.add(type);
      return { ...d, hiddenBlockTypes: Array.from(set) };
    });
  };

  const moveCategory = (cat: string, direction: -1 | 1) => {
    const idx = orderedCategories.indexOf(cat);
    if (idx < 0) return;
    const next = moveItem(orderedCategories, idx, idx + direction);
    setDraft(d => ({ ...d, categoryOrder: next }));
  };

  const moveBlock = (cat: string, type: string, direction: -1 | 1) => {
    const arr = (blocksByCategory.get(cat) ?? []).map(b => b.type);
    const idx = arr.indexOf(type);
    if (idx < 0) return;
    const next = moveItem(arr, idx, idx + direction);
    setDraft(d => ({
      ...d,
      blockOrder: { ...d.blockOrder, [cat]: next },
    }));
  };

  const startRenameCategory = (cat: string) => {
    setEditingCategory(cat);
    setRenameValue(resolveCategoryLabel(cat, draft));
  };

  const commitRenameCategory = () => {
    if (!editingCategory) return;
    const trimmed = renameValue.trim();
    setDraft(d => {
      const labels = { ...d.categoryLabels };
      if (!trimmed || trimmed === editingCategory) {
        delete labels[editingCategory];
      } else {
        labels[editingCategory] = trimmed;
      }
      return { ...d, categoryLabels: labels };
    });
    setEditingCategory(null);
    setRenameValue("");
  };

  const handleReset = () => {
    setDraft(EMPTY_PREFS);
  };

  const handleSave = async () => {
    const ok = await onSave(draft);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize block library</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Hide blocks you don't use, rename and reorder groups, and reorder blocks within each group.
            Changes apply to everyone in your tenant&apos;s builder.
          </p>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-6 px-6 space-y-6 py-2">
          {orderedCategories.map((cat, catIdx) => {
            const blocks = blocksByCategory.get(cat) ?? [];
            const isEditing = editingCategory === cat;
            return (
              <div key={cat} className="rounded-lg border bg-card">
                <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30">
                  <div className="flex flex-col">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0"
                      title="Move group up"
                      disabled={catIdx === 0}
                      onClick={() => moveCategory(cat, -1)}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0"
                      title="Move group down"
                      disabled={catIdx === orderedCategories.length - 1}
                      onClick={() => moveCategory(cat, 1)}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </div>
                  {isEditing ? (
                    <>
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") commitRenameCategory();
                          if (e.key === "Escape") setEditingCategory(null);
                        }}
                        className="h-7 text-sm"
                      />
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={commitRenameCategory} title="Save">
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingCategory(null)} title="Cancel">
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 flex items-baseline gap-2 min-w-0">
                        <span className="text-sm font-semibold truncate">{resolveCategoryLabel(cat, draft)}</span>
                        {draft.categoryLabels[cat] && (
                          <span className="text-[10px] text-muted-foreground truncate">(was {cat})</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="Rename group"
                        onClick={() => startRenameCategory(cat)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <span className="text-[10px] text-muted-foreground">{blocks.length}</span>
                    </>
                  )}
                </div>

                <ul className="divide-y">
                  {blocks.map((b, i) => {
                    const hidden = hiddenSet.has(b.type);
                    return (
                      <li key={b.type} className="flex items-center gap-2 px-3 py-1.5">
                        <div className="flex flex-col">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0"
                            title="Move up"
                            disabled={i === 0}
                            onClick={() => moveBlock(cat, b.type, -1)}
                          >
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0"
                            title="Move down"
                            disabled={i === blocks.length - 1}
                            onClick={() => moveBlock(cat, b.type, 1)}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className={`flex-1 min-w-0 ${hidden ? "opacity-50" : ""}`}>
                          <div className="text-sm truncate">{b.label}</div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate">{b.type}</div>
                        </div>
                        <Label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                          {hidden ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5" />}
                          <Switch
                            checked={!hidden}
                            onCheckedChange={() => toggleHidden(b.type)}
                          />
                        </Label>
                      </li>
                    );
                  })}
                  {blocks.length === 0 && (
                    <li className="px-3 py-2 text-xs text-muted-foreground italic">No blocks in this group.</li>
                  )}
                </ul>
              </div>
            );
          })}
          {orderedCategories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No blocks available to customize.
            </p>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-3">
          <Button variant="ghost" onClick={handleReset} className="gap-1.5 text-xs" disabled={saving}>
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
