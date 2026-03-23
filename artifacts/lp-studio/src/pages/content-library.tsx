import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Star, Loader2, Pencil, Check, X, BookOpen } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ImagePicker } from "@/components/ImagePicker";

const API_BASE = "/api";

type LibraryType = "product_showcase" | "product_grid" | "case_study" | "resource";

interface LibraryItem {
  id: number;
  type: LibraryType;
  name: string;
  content: Record<string, unknown>;
  is_default: boolean;
  sort_order: number;
}

function useLibrary(type: LibraryType) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/lp/library/${type}`);
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, [type]);

  const create = async (name: string, content: Record<string, unknown>) => {
    await fetch(`${API_BASE}/lp/library/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content, is_default: false }),
    });
    reload();
  };

  const update = async (id: number, name: string, content: Record<string, unknown>, is_default: boolean) => {
    await fetch(`${API_BASE}/lp/library/${type}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content, is_default }),
    });
    reload();
  };

  const toggleDefault = async (id: number) => {
    await fetch(`${API_BASE}/lp/library/${type}/${id}/default`, { method: "PATCH" });
    reload();
  };

  const remove = async (id: number) => {
    await fetch(`${API_BASE}/lp/library/${type}/${id}`, { method: "DELETE" });
    reload();
  };

  return { items, loading, reload, create, update, toggleDefault, remove };
}

const TABS: { type: LibraryType; label: string; description: string }[] = [
  { type: "product_showcase", label: "Product Showcase", description: "Cards used in Product Showcase blocks" },
  { type: "product_grid", label: "Product Grid", description: "Items used in Product Grid blocks" },
  { type: "case_study", label: "Case Studies", description: "Case study cards across landing pages" },
  { type: "resource", label: "Resources", description: "Articles, guides, and resources" },
];

function ProductShowcaseForm({
  value, onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const v = value as { name?: string; description?: string; badge?: string; image?: string };
  return (
    <div className="space-y-2">
      <Input placeholder="Product name" value={v.name ?? ""} onChange={e => onChange({ ...v, name: e.target.value })} className="text-xs h-7" />
      <Textarea placeholder="Description" value={v.description ?? ""} onChange={e => onChange({ ...v, description: e.target.value })} rows={2} className="text-xs resize-none" />
      <Input placeholder="Badge e.g. FROM $99/UNIT" value={v.badge ?? ""} onChange={e => onChange({ ...v, badge: e.target.value })} className="text-xs h-7" />
      <ImagePicker label="Image (optional)" value={v.image ?? ""} onChange={url => onChange({ ...v, image: url })} />
    </div>
  );
}

function ProductGridForm({
  value, onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const v = value as { title?: string; description?: string; image?: string };
  return (
    <div className="space-y-2">
      <Input placeholder="Title" value={v.title ?? ""} onChange={e => onChange({ ...v, title: e.target.value })} className="text-xs h-7" />
      <Textarea placeholder="Description" value={v.description ?? ""} onChange={e => onChange({ ...v, description: e.target.value })} rows={2} className="text-xs resize-none" />
      <ImagePicker label="Image (optional)" value={v.image ?? ""} onChange={url => onChange({ ...v, image: url })} />
    </div>
  );
}

function CaseStudyForm({
  value, onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const v = value as { title?: string; categories?: string; url?: string; image?: string; logoUrl?: string };
  return (
    <div className="space-y-2">
      <Input placeholder="Title" value={v.title ?? ""} onChange={e => onChange({ ...v, title: e.target.value })} className="text-xs h-7" />
      <Input placeholder="Categories e.g. INDUSTRY / SIZE" value={v.categories ?? ""} onChange={e => onChange({ ...v, categories: e.target.value })} className="text-xs h-7" />
      <Input placeholder="Link URL" value={v.url ?? ""} onChange={e => onChange({ ...v, url: e.target.value })} className="text-xs h-7" />
      <ImagePicker label="Cover image" value={v.image ?? ""} onChange={url => onChange({ ...v, image: url })} />
      <ImagePicker label="Logo" value={v.logoUrl ?? ""} onChange={url => onChange({ ...v, logoUrl: url })} />
    </div>
  );
}

function ResourceForm({
  value, onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const v = value as { title?: string; description?: string; category?: string; url?: string; image?: string };
  return (
    <div className="space-y-2">
      <Input placeholder="Title" value={v.title ?? ""} onChange={e => onChange({ ...v, title: e.target.value })} className="text-xs h-7" />
      <Textarea placeholder="Description" value={v.description ?? ""} onChange={e => onChange({ ...v, description: e.target.value })} rows={2} className="text-xs resize-none" />
      <Input placeholder="Category e.g. Article, Guide" value={v.category ?? ""} onChange={e => onChange({ ...v, category: e.target.value })} className="text-xs h-7" />
      <Input placeholder="Link URL" value={v.url ?? ""} onChange={e => onChange({ ...v, url: e.target.value })} className="text-xs h-7" />
      <ImagePicker label="Image (optional)" value={v.image ?? ""} onChange={url => onChange({ ...v, image: url })} />
    </div>
  );
}

function getDefaultContent(type: LibraryType): Record<string, unknown> {
  if (type === "product_showcase") return { name: "", description: "", badge: "", image: "" };
  if (type === "product_grid") return { title: "", description: "", image: "" };
  if (type === "case_study") return { title: "", categories: "", url: "#", image: "", logoUrl: "" };
  return { title: "", description: "", category: "Article", url: "#", image: "" };
}

function ContentForm({ type, value, onChange }: { type: LibraryType; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  if (type === "product_showcase") return <ProductShowcaseForm value={value} onChange={onChange} />;
  if (type === "product_grid") return <ProductGridForm value={value} onChange={onChange} />;
  if (type === "case_study") return <CaseStudyForm value={value} onChange={onChange} />;
  return <ResourceForm value={value} onChange={onChange} />;
}

function getPreviewText(item: LibraryItem): string {
  const c = item.content as Record<string, unknown>;
  if (item.type === "product_showcase") return String(c.description ?? "").slice(0, 80);
  if (item.type === "product_grid") return String(c.description ?? "").slice(0, 80);
  if (item.type === "case_study") return String(c.categories ?? "");
  return String(c.category ?? "");
}

interface LibraryItemCardProps {
  item: LibraryItem;
  type: LibraryType;
  onToggleDefault: () => void;
  onDelete: () => void;
  onUpdate: (name: string, content: Record<string, unknown>, is_default: boolean) => void;
}

function LibraryItemCard({ item, type, onToggleDefault, onDelete, onUpdate }: LibraryItemCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [content, setContent] = useState<Record<string, unknown>>(item.content);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onUpdate(name, content, item.is_default);
    setSaving(false);
    setEditing(false);
  };

  const cancel = () => {
    setName(item.name);
    setContent(item.content);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="border rounded-xl p-4 space-y-3 bg-white shadow-sm">
        <div>
          <Label className="text-[11px] text-slate-500 mb-1 block">Library name (internal label)</Label>
          <Input value={name} onChange={e => setName(e.target.value)} className="text-xs h-7" placeholder="e.g. Crown & Bridge" />
        </div>
        <ContentForm type={type} value={content} onChange={setContent} />
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-7 text-xs gap-1" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={cancel}>
            <X className="w-3 h-3" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-4 flex items-start gap-3 bg-white hover:shadow-sm transition-shadow">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-slate-800 truncate">{item.name || "(unnamed)"}</span>
          {item.is_default && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-400 text-amber-600 gap-0.5 shrink-0">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> Default
            </Badge>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate">{getPreviewText(item)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          title={item.is_default ? "Remove from defaults" : "Mark as default"}
          onClick={onToggleDefault}
          className={`p-1.5 rounded-lg transition-colors ${item.is_default ? "text-amber-500 bg-amber-50" : "text-slate-300 hover:text-amber-400 hover:bg-amber-50"}`}
        >
          <Star className={`w-3.5 h-3.5 ${item.is_default ? "fill-amber-400" : ""}`} />
        </button>
        <button
          title="Edit"
          onClick={() => setEditing(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          title="Delete"
          onClick={onDelete}
          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function AddItemForm({ type, onCreate }: { type: LibraryType; onCreate: (name: string, content: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState<Record<string, unknown>>(getDefaultContent(type));
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    await onCreate(name, content);
    setName("");
    setContent(getDefaultContent(type));
    setOpen(false);
    setSaving(false);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" /> Add Item
      </Button>
    );
  }

  return (
    <div className="border-2 border-dashed border-[#C7E738]/60 rounded-xl p-4 space-y-3 bg-[#C7E738]/5">
      <div>
        <Label className="text-[11px] text-slate-500 mb-1 block">Library name (internal label)</Label>
        <Input value={name} onChange={e => setName(e.target.value)} className="text-xs h-7" placeholder="e.g. Crown & Bridge" />
      </div>
      <ContentForm type={type} value={content} onChange={setContent} />
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={handleCreate} disabled={saving}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add to Library
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function LibraryTab({ type }: { type: LibraryType }) {
  const lib = useLibrary(type);

  return (
    <div className="space-y-3">
      {lib.loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <>
          {lib.items.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No items yet. Add your first one below.</p>
            </div>
          )}
          {lib.items.map(item => (
            <LibraryItemCard
              key={item.id}
              item={item}
              type={type}
              onToggleDefault={() => lib.toggleDefault(item.id)}
              onDelete={() => {
                if (confirm(`Delete "${item.name || "this item"}"?`)) lib.remove(item.id);
              }}
              onUpdate={(name, content, is_default) => lib.update(item.id, name, content, is_default)}
            />
          ))}
          <AddItemForm type={type} onCreate={lib.create} />
        </>
      )}
    </div>
  );
}

export default function ContentLibrary() {
  const [activeTab, setActiveTab] = useState<LibraryType>("product_showcase");

  const activeTabMeta = TABS.find(t => t.type === activeTab)!;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-[#C7E738]" />
              Content Library
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Save and manage reusable content. Mark items as <strong>Default</strong> to auto-populate new blocks.
            </p>
          </div>

          <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl">
            {TABS.map(tab => (
              <button
                key={tab.type}
                onClick={() => setActiveTab(tab.type)}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === tab.type
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <p className="text-xs text-slate-500">{activeTabMeta.description}</p>
          </div>

          <LibraryTab key={activeTab} type={activeTab} />
        </motion.div>
      </div>
    </AppLayout>
  );
}
