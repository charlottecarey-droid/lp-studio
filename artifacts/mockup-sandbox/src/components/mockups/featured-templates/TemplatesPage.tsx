import React, { useState } from "react";
import {
  Search,
  Star,
  Plus,
  Eye,
  Copy,
  X,
  Check,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)",
  "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
  "linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)",
];

type Template = {
  id: string;
  name: string;
  type: string;
  gradient: string;
};

const FEATURED: Template[] = [
  { id: "f1", name: "Product Webinar", type: "Webinar", gradient: GRADIENTS[0] },
  { id: "f2", name: "Ebook Download", type: "Lead magnet", gradient: GRADIENTS[1] },
  { id: "f3", name: "Request a Demo", type: "Demo", gradient: GRADIENTS[2] },
  { id: "f4", name: "Spring Pricing", type: "Pricing", gradient: GRADIENTS[3] },
  { id: "f5", name: "Customer Story", type: "Case study", gradient: GRADIENTS[4] },
  { id: "f6", name: "Event Signup", type: "Event", gradient: GRADIENTS[5] },
];

const LIBRARY: Template[] = [
  { id: "l1", name: "Free Trial Offer", type: "Custom", gradient: GRADIENTS[6] },
  { id: "l2", name: "Partner Microsite", type: "Custom", gradient: GRADIENTS[7] },
  { id: "l3", name: "Newsletter Signup", type: "Lead magnet", gradient: GRADIENTS[0] },
  { id: "l4", name: "Comparison Page", type: "Custom", gradient: GRADIENTS[2] },
  { id: "l5", name: "Holiday Promo", type: "Promo", gradient: GRADIENTS[3] },
  { id: "l6", name: "Whitepaper", type: "Lead magnet", gradient: GRADIENTS[4] },
];

function FeaturedCard({ tpl, onRemove }: { tpl: Template; onRemove: () => void }) {
  return (
    <div className="group relative w-[230px] shrink-0 snap-start">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border shadow-sm">
        <div className="absolute inset-0" style={{ background: tpl.gradient }} />
        {/* Featured chip */}
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
          Featured
        </div>
        {/* Remove-from-featured on hover */}
        <button
          onClick={onRemove}
          title="Remove from featured"
          className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-foreground opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        {/* Hover actions */}
        <div className="absolute inset-x-0 bottom-0 flex translate-y-2 items-center gap-2 bg-gradient-to-t from-black/55 to-transparent p-2.5 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
          <button className="flex items-center gap-1 rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-white">
            <Eye className="h-3 w-3" /> Preview
          </button>
          <button className="flex items-center gap-1 rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-white">
            <Copy className="h-3 w-3" /> Use
          </button>
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <div className="text-[13px] font-semibold text-foreground">{tpl.name}</div>
        <div className="text-[11px] text-muted-foreground">{tpl.type}</div>
      </div>
    </div>
  );
}

function LibraryCard({
  tpl,
  featured,
  onToggle,
}: {
  tpl: Template;
  featured: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/10] overflow-hidden">
        <div className="absolute inset-0" style={{ background: tpl.gradient }} />
        <button
          onClick={onToggle}
          title={featured ? "Remove from featured" : "Add to featured"}
          className={cn(
            "absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full shadow transition-colors",
            featured
              ? "bg-amber-400 text-white hover:bg-amber-500"
              : "bg-white/90 text-muted-foreground hover:bg-white hover:text-amber-500"
          )}
        >
          <Star className={cn("h-4 w-4", featured && "fill-white")} />
        </button>
      </div>
      <div className="p-3.5">
        <div className="text-[13px] font-semibold text-foreground">{tpl.name}</div>
        <div className="mb-3 text-[11px] text-muted-foreground">{tpl.type}</div>
        <div className="flex gap-2">
          <button className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted">
            <Eye className="h-3 w-3" /> Preview
          </button>
          <button className="flex flex-1 items-center justify-center gap-1 rounded-md bg-foreground px-2 py-1.5 text-[11px] font-medium text-background hover:opacity-90">
            <Copy className="h-3 w-3" /> Use
          </button>
        </div>
      </div>
    </div>
  );
}

export function TemplatesPage() {
  const [featuredIds, setFeaturedIds] = useState<string[]>(FEATURED.map((t) => t.id));
  const [libraryFeatured, setLibraryFeatured] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSelection, setPickerSelection] = useState<string[]>([]);

  const featured = FEATURED.filter((t) => featuredIds.includes(t.id));

  const togglePicker = (id: string) =>
    setPickerSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  return (
    <div className="min-h-screen bg-background p-8 font-sans text-foreground">
      <div className="mx-auto max-w-5xl space-y-7">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clone a ready-made layout to get started quickly, then customize it in the builder.
          </p>
        </div>

        {/* ===== Featured templates section (NEW) ===== */}
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <div className="mb-1 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Star className="h-4.5 w-4.5 fill-amber-400 text-amber-400" />
                <h2 className="text-lg font-semibold">Featured templates</h2>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                These show up as the starting points when you create a new page.
              </p>
            </div>
            <button
              onClick={() => {
                setPickerSelection([]);
                setPickerOpen(true);
              }}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add featured template
            </button>
          </div>

          {/* Horizontally scrollable card rail */}
          <div className="relative mt-4">
            <div className="flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
              {featured.map((tpl) => (
                <FeaturedCard
                  key={tpl.id}
                  tpl={tpl}
                  onRemove={() => setFeaturedIds((p) => p.filter((x) => x !== tpl.id))}
                />
              ))}
              {/* Add tile at the end of the rail */}
              <button
                onClick={() => {
                  setPickerSelection([]);
                  setPickerOpen(true);
                }}
                className="flex aspect-[16/10] w-[230px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-300 text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-100/40"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
                  <Plus className="h-5 w-5" />
                </div>
                <span className="text-[12px] font-medium">Add featured template</span>
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {featured.length} featured · drag or scroll to see them all
            </p>
          </div>
        </section>

        {/* Search + sort row */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search templates..."
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-foreground"
            />
          </div>
          <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium">
            <Star className="h-3.5 w-3.5" /> Featured
          </button>
        </div>

        {/* All templates grid — each card can be featured via its star */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">All templates</h3>
          <div className="grid grid-cols-3 gap-5">
            {LIBRARY.map((tpl) => (
              <LibraryCard
                key={tpl.id}
                tpl={tpl}
                featured={libraryFeatured.includes(tpl.id)}
                onToggle={() =>
                  setLibraryFeatured((p) =>
                    p.includes(tpl.id) ? p.filter((x) => x !== tpl.id) : [...p, tpl.id]
                  )
                }
              />
            ))}
          </div>
        </div>
      </div>

      {/* ===== Add-featured picker overlay ===== */}
      {pickerOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl">
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-base font-semibold">Add featured templates</h3>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Pick templates to feature as starting points.
                </p>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[320px] space-y-1 overflow-y-auto p-2">
              {LIBRARY.map((tpl) => {
                const selected = pickerSelection.includes(tpl.id);
                return (
                  <button
                    key={tpl.id}
                    onClick={() => togglePicker(tpl.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                      selected ? "bg-amber-50" : "hover:bg-muted"
                    )}
                  >
                    <div
                      className="h-10 w-14 shrink-0 rounded-md"
                      style={{ background: tpl.gradient }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{tpl.name}</div>
                      <div className="text-[11px] text-muted-foreground">{tpl.type}</div>
                    </div>
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                        selected
                          ? "border-amber-400 bg-amber-400 text-white"
                          : "border-border"
                      )}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
              <span className="text-[12px] text-muted-foreground">
                {pickerSelection.length} selected
              </span>
              <button
                onClick={() => setPickerOpen(false)}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-background hover:opacity-90"
              >
                Add to featured <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplatesPage;
