import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  AlertTriangle, CheckCircle2, Loader2, RefreshCw, Plus, Trash2,
  ArrowUp, ArrowDown, ExternalLink, Upload, Check, ChevronsUpDown,
} from "lucide-react";
import { LP_TEMPLATES, encodeGlobalTemplateId, parseGlobalTemplateId } from "@/lib/templates";
import { templateToBlocks } from "@/lib/block-types/block-registry";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || String(res.status));
  }
  return res.json();
}

// One editable entry. blocksCount is held as a string so the input can be
// cleared while editing (empty => 0 on save). `key` is a stable client-side id
// for React list keys + reorder (rows have no DB id until first save, and after
// a save-and-replace every id changes anyway).
interface Draft {
  key: string;
  templateId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  category: string;
  blocksCount: string;
  enabled: boolean;
}

interface AdminEntry {
  id: number;
  templateId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  category: string;
  blocksCount: number;
  enabled: boolean;
  sortOrder: number;
}

// A DB-backed global template (managed in the superadmin "Templates" tab),
// fetched from /lp/templates/enriched. Featured cards can point at one of these
// in addition to the built-in flagship LP_TEMPLATES. Identified to the picker /
// preview / clone paths by the encoded `global:<id>` form.
interface GlobalTemplate {
  /** Encoded `global:<dbId>` ref used as the card's templateId. */
  refId: string;
  dbId: number;
  name: string;
  description: string;
  thumbnailUrl: string;
  blockCount: number;
}

interface EnrichedTemplate {
  id: number;
  title: string;
  templateLabel?: string;
  templateDescription?: string;
  blockCount?: number;
  thumbnailUrl?: string | null;
  ogImage?: string;
  isGlobal?: boolean;
}

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `fh-${Date.now()}-${keySeq}`;
}

function toDraft(e: AdminEntry): Draft {
  return {
    key: nextKey(),
    templateId: e.templateId,
    title: e.title,
    description: e.description,
    thumbnailUrl: e.thumbnailUrl,
    category: e.category,
    blocksCount: String(e.blocksCount ?? 0),
    enabled: e.enabled,
  };
}

// Count the rendered blocks for a template so the editor can prefill the
// blocks count when a superadmin picks a new underlying template.
function blockCountFor(templateId: string): number {
  try {
    return templateToBlocks(templateId).length;
  } catch {
    return 0;
  }
}

// Searchable combobox for the "Underlying template" field. Keeps the two
// labeled groups (Flagship / Global) and filters items by name as the admin
// types. Selecting an option calls the same pickTemplate handler as before.
function TemplatePicker({
  value,
  selectedName,
  flagship,
  globals,
  onPick,
}: {
  /** The currently selected templateId, or "" when none/unknown. */
  value: string;
  /** Display name for the selected template, or "" to show the placeholder. */
  selectedName: string;
  flagship: { id: string; name: string }[];
  globals: GlobalTemplate[];
  onPick: (templateId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selectedName && "text-muted-foreground")}>
            {selectedName || "Pick a usable template…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search templates…" />
          <CommandList>
            <CommandEmpty>No templates found.</CommandEmpty>
            <CommandGroup heading="Flagship templates">
              {flagship.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.name} ${t.id}`}
                  onSelect={() => {
                    onPick(t.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === t.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{t.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {globals.length > 0 && (
              <CommandGroup heading="Global templates">
                {globals.map((g) => (
                  <CommandItem
                    key={g.refId}
                    value={`${g.name} ${g.refId}`}
                    onSelect={() => {
                      onPick(g.refId);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === g.refId ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{g.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function SuperAdminFeaturedTemplates() {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [globals, setGlobals] = useState<GlobalTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Key of the row whose thumbnail is mid-upload (null = none). Per-row so a
  // single shared file picker / spinner doesn't block other cards.
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/admin/lp/featured-templates");
      const entries: AdminEntry[] = data?.templates ?? [];
      setDrafts(entries.map(toDraft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load DB-backed global templates so the picker can feature them alongside the
  // built-in flagship templates. Best-effort: a failure just leaves the picker
  // showing only the flagship list (still fully usable).
  const loadGlobals = useCallback(async () => {
    try {
      const data: EnrichedTemplate[] = await apiFetch("/api/lp/templates/enriched");
      const rows = (Array.isArray(data) ? data : [])
        .filter((t) => t.isGlobal)
        .map<GlobalTemplate>((t) => ({
          refId: encodeGlobalTemplateId(t.id),
          dbId: t.id,
          name: t.templateLabel || t.title,
          description: t.templateDescription || "",
          thumbnailUrl: t.thumbnailUrl || t.ogImage || "",
          blockCount: t.blockCount ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setGlobals(rows);
    } catch {
      setGlobals([]);
    }
  }, []);

  useEffect(() => {
    load();
    loadGlobals();
  }, [load, loadGlobals]);

  // Lookup helpers across both sources. A templateId is "known" if it's a
  // built-in flagship slug or a `global:<id>` ref we successfully loaded.
  const findGlobal = (templateId: string): GlobalTemplate | undefined => {
    if (parseGlobalTemplateId(templateId) === null) return undefined;
    return globals.find((g) => g.refId === templateId);
  };
  const isKnownTemplate = (templateId: string): boolean =>
    LP_TEMPLATES.some((t) => t.id === templateId) || !!findGlobal(templateId);

  const update = (key: string, patch: Partial<Draft>) => {
    setSaved(false);
    setDrafts((prev) =>
      (prev ?? []).map((d) => (d.key === key ? { ...d, ...patch } : d)),
    );
  };

  // Upload a thumbnail image for a card. Mirrors the share-card uploader: POST
  // the file to /api/lp/upload, then store the served /api/storage path as the
  // card's thumbnailUrl. The text Input remains usable for pasting a URL.
  const handleThumbUpload = async (key: string, file: File | undefined) => {
    if (!file) return;
    setUploadingKey(key);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE}/api/lp/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      const data = await res.json();
      update(key, { thumbnailUrl: `/api/storage${data.url}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thumbnail upload failed");
    } finally {
      setUploadingKey(null);
    }
  };

  // Picking an underlying template prefills any empty display fields from the
  // chosen template's own metadata (title/description/blocks/thumbnail) —
  // resolved from whichever source the id came from (built-in flagship or
  // DB-backed global) — but never clobbers text the superadmin already entered.
  const pickTemplate = (key: string, templateId: string) => {
    setSaved(false);
    const tpl = LP_TEMPLATES.find((t) => t.id === templateId);
    const g = findGlobal(templateId);
    const name = tpl?.name ?? g?.name ?? "";
    const description = tpl?.description ?? g?.description ?? "";
    const thumb = g?.thumbnailUrl ?? "";
    const count = tpl ? blockCountFor(templateId) : (g?.blockCount ?? 0);
    setDrafts((prev) =>
      (prev ?? []).map((d) => {
        if (d.key !== key) return d;
        return {
          ...d,
          templateId,
          title: d.title.trim() ? d.title : name,
          description: d.description.trim() ? d.description : description,
          thumbnailUrl: d.thumbnailUrl.trim() ? d.thumbnailUrl : thumb,
          blocksCount:
            d.blocksCount.trim() && d.blocksCount !== "0"
              ? d.blocksCount
              : String(count),
        };
      }),
    );
  };

  const addRow = () => {
    setSaved(false);
    const firstTpl = LP_TEMPLATES[0];
    setDrafts((prev) => [
      ...(prev ?? []),
      {
        key: nextKey(),
        templateId: firstTpl?.id ?? "",
        title: firstTpl?.name ?? "",
        description: firstTpl?.description ?? "",
        thumbnailUrl: "",
        category: "",
        blocksCount: String(firstTpl ? blockCountFor(firstTpl.id) : 0),
        enabled: true,
      },
    ]);
  };

  const removeRow = (key: string) => {
    setSaved(false);
    setDrafts((prev) => (prev ?? []).filter((d) => d.key !== key));
  };

  const move = (key: string, dir: -1 | 1) => {
    setSaved(false);
    setDrafts((prev) => {
      const list = [...(prev ?? [])];
      const i = list.findIndex((d) => d.key === key);
      if (i < 0) return list;
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      [list[i], list[j]] = [list[j], list[i]];
      return list;
    });
  };

  const save = async () => {
    if (!drafts) return;
    // Client-side guard: every row needs a real, usable template id so the
    // preview iframe + clone handoff work on the homepage.
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      if (!d.templateId) {
        setError(`Card ${i + 1}: pick an underlying template`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        templates: drafts.map((d) => ({
          templateId: d.templateId,
          title: d.title,
          description: d.description,
          thumbnailUrl: d.thumbnailUrl,
          category: d.category,
          blocksCount: d.blocksCount.trim() === "" ? 0 : Number(d.blocksCount),
          enabled: d.enabled,
        })),
      };
      const data = await apiFetch("/api/admin/lp/featured-templates", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const entries: AdminEntry[] = data?.templates ?? [];
      setDrafts(entries.map(toDraft));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading && drafts === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const list = drafts ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Homepage Featured Templates</h2>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            The template cards shown in the marketing homepage gallery. Pick any
            usable template as the underlying preview/clone target, edit how each
            card is presented, reorder, enable/disable, or add and remove cards.
            The homepage falls back to its built-in list if this is empty.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={load} disabled={loading || saving}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Reload
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            )}
            Save changes
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}
      {saved && !error && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Saved — the homepage now reflects this list.
        </div>
      )}

      <div className="space-y-3">
        {list.length === 0 && (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            No featured templates configured. The homepage is using its built-in
            fallback list. Add a card to override it.
          </div>
        )}

        {list.map((d, i) => {
          const previewHref = d.templateId
            ? `${BASE}/preview/template/${encodeURIComponent(d.templateId)}`
            : null;
          const knownTemplate = isKnownTemplate(d.templateId);
          const selectedName = knownTemplate
            ? (LP_TEMPLATES.find((t) => t.id === d.templateId)?.name ??
              findGlobal(d.templateId)?.name ??
              "")
            : "";
          return (
            <div
              key={d.key}
              className="rounded-lg border bg-card p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Card {i + 1}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch
                      checked={d.enabled}
                      onCheckedChange={(v) => update(d.key, { enabled: v })}
                    />
                    {d.enabled ? "Enabled" : "Hidden"}
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={i === 0}
                    onClick={() => move(d.key, -1)}
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={i === list.length - 1}
                    onClick={() => move(d.key, 1)}
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeRow(d.key)}
                    title="Remove card"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Underlying template</Label>
                  <TemplatePicker
                    value={knownTemplate ? d.templateId : ""}
                    selectedName={selectedName}
                    flagship={LP_TEMPLATES}
                    globals={globals}
                    onPick={(v) => pickTemplate(d.key, v)}
                  />
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <code className="truncate">{d.templateId || "—"}</code>
                    {previewHref && (
                      <a
                        href={previewHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary hover:underline shrink-0"
                      >
                        Preview <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  {!knownTemplate && d.templateId && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-500">
                      This id isn't in the current template catalog — preview and
                      clone may not work. Pick one from the list.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Input
                    value={d.category}
                    onChange={(e) => update(d.key, { category: e.target.value })}
                    placeholder="e.g. Launch, Events, Marketing"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={d.title}
                    onChange={(e) => update(d.key, { title: e.target.value })}
                    placeholder="Card title"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Blocks count</Label>
                  <Input
                    type="number"
                    min={0}
                    value={d.blocksCount}
                    onChange={(e) => update(d.key, { blocksCount: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    rows={2}
                    value={d.description}
                    onChange={(e) => update(d.key, { description: e.target.value })}
                    placeholder="Short description shown on the card"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Thumbnail</Label>
                  <div className="flex items-start gap-3">
                    <Input
                      value={d.thumbnailUrl}
                      onChange={(e) => update(d.key, { thumbnailUrl: e.target.value })}
                      placeholder="Paste a URL or upload an image…"
                    />
                    <input
                      type="file"
                      id={`thumb-upload-${d.key}`}
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.currentTarget.value = "";
                        void handleThumbUpload(d.key, f);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      disabled={uploadingKey === d.key}
                      onClick={() =>
                        document.getElementById(`thumb-upload-${d.key}`)?.click()
                      }
                    >
                      {uploadingKey === d.key ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" /> Upload
                        </>
                      )}
                    </Button>
                    {d.thumbnailUrl && (
                      <img
                        src={d.thumbnailUrl}
                        alt=""
                        className="h-10 w-16 rounded object-cover border shrink-0"
                        onLoad={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = "visible";
                        }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button size="sm" variant="outline" onClick={addRow}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add card
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
          )}
          Save changes
        </Button>
      </div>
    </div>
  );
}
