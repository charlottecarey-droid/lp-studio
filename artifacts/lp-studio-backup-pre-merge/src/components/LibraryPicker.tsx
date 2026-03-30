import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Star, Loader2, BookOpen, BookmarkPlus, Check } from "lucide-react";

const API_BASE = "/api";

export interface LibraryItem {
  id: number;
  type: string;
  name: string;
  content: Record<string, unknown>;
  is_default: boolean;
  sort_order: number;
}

interface LibraryPickerProps {
  open: boolean;
  onClose: () => void;
  type: "product_showcase" | "product_grid" | "case_study" | "resource";
  onSelect: (items: Record<string, unknown>[]) => void;
  title: string;
  renderPreview: (item: LibraryItem) => React.ReactNode;
}

export function LibraryPicker({ open, onClose, type, onSelect, title, renderPreview }: LibraryPickerProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(new Set());
    fetch(`${API_BASE}/lp/library/${type}`)
      .then(r => r.json())
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, type]);

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleAdd = () => {
    const picked = items.filter(i => selected.has(i.id)).map(i => i.content);
    onSelect(picked);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="w-4 h-4 text-[#C7E738]" />
            {title}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Loading library…</span>
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No items in library yet.</p>
              <p className="text-xs mt-1">Go to Content Library in Settings to add items.</p>
            </div>
          )}
          {!loading && items.map(item => (
            <label
              key={item.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selected.has(item.id)
                  ? "border-[#C7E738] bg-[#C7E738]/5"
                  : "border-border hover:border-border/80 hover:bg-muted/30"
              }`}
            >
              <Checkbox
                checked={selected.has(item.id)}
                onCheckedChange={() => toggle(item.id)}
                className="mt-0.5 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-semibold text-foreground truncate">{item.name || "(unnamed)"}</span>
                  {item.is_default && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-400 text-amber-600 gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                      Default
                    </Badge>
                  )}
                </div>
                {renderPreview(item)}
              </div>
            </label>
          ))}
        </div>

        <div className="border-t px-4 py-3 flex items-center gap-2">
          <Button
            className="flex-1"
            disabled={selected.size === 0}
            onClick={handleAdd}
          >
            Add {selected.size > 0 ? `${selected.size} ` : ""}Selected
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export type LibraryItemType = "product_showcase" | "product_grid" | "case_study" | "resource";

interface SaveItemToLibraryButtonProps {
  type: LibraryItemType;
  content: Record<string, unknown>;
  defaultName?: string;
}

export function SaveItemToLibraryButton({ type, content, defaultName = "" }: SaveItemToLibraryButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setName(defaultName);
    setSaved(false);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/lp/library/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), content, is_default: false }),
      });
      setSaved(true);
      setOpen(false);
      setTimeout(() => setSaved(false), 2500);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={handleOpen}
          title="Save to Content Library"
          className={`transition-colors ${
            saved
              ? "text-emerald-600"
              : "text-slate-400 hover:text-[#003A30]"
          }`}
        >
          {saved ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" className="w-56 p-3 space-y-2" onClick={e => e.stopPropagation()}>
        <p className="text-xs font-semibold text-foreground">Save to Library</p>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Item name…"
          className="h-7 text-xs"
          autoFocus
          onKeyDown={e => { if (e.key === "Enter") void handleSave(); if (e.key === "Escape") setOpen(false); }}
        />
        <div className="flex gap-1.5">
          <Button
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => void handleSave()}
            disabled={!name.trim() || saving}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface LibraryButtonsProps {
  type: "product_showcase" | "product_grid" | "case_study" | "resource";
  title: string;
  renderPreview: (item: LibraryItem) => React.ReactNode;
  onLoadDefaults: (items: Record<string, unknown>[]) => void;
  onAddFromLibrary: (items: Record<string, unknown>[]) => void;
}

export function LibraryButtons({ type, title, renderPreview, onLoadDefaults, onAddFromLibrary }: LibraryButtonsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLoadDefaults = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/lp/library/${type}`);
      const items: LibraryItem[] = await r.json();
      const defaults = items.filter(i => i.is_default).map(i => i.content);
      onLoadDefaults(defaults);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5 p-2 rounded-lg bg-[#C7E738]/10 border border-[#C7E738]/30">
        <BookOpen className="w-3.5 h-3.5 text-[#003A30] shrink-0" />
        <span className="text-[11px] font-semibold text-[#003A30] flex-1">Content Library</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] px-2 text-[#003A30] hover:bg-[#C7E738]/20"
          onClick={handleLoadDefaults}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Load Defaults"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] px-2 text-[#003A30] hover:bg-[#C7E738]/20"
          onClick={() => setPickerOpen(true)}
        >
          Browse
        </Button>
      </div>

      <LibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        type={type}
        title={title}
        renderPreview={renderPreview}
        onSelect={onAddFromLibrary}
      />
    </>
  );
}
