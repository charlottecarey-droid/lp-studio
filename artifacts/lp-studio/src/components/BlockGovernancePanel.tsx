import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useBlockCatalog, type ResolvedBlockDef } from "@/hooks/use-block-catalog";
import { useTenantBlockGovernance } from "@/hooks/use-tenant-block-governance";
import type { AiMode, TenantBlockGovernanceEntry } from "@/lib/block-governance-client";
import type { AudienceSegment } from "@/lib/brand-config";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

/**
 * Tenant block-governance editor (task #4). Per built-in block: an Enabled
 * toggle (builder visibility), an AI-mode select (Locked / Copy only / Open),
 * and a checkbox per brand segment (segment approval). Grouped by category and
 * searchable. Persists via PUT /api/tenant/block-governance (full-replace; the
 * server drops all-default rows so an untouched tenant keeps today's behaviour).
 */

type WorkingEntry = {
  enabled: boolean | null;
  aiMode: AiMode;
  segments: Set<string>;
};

const AI_MODE_LABELS: Record<AiMode, string> = {
  locked: "Locked (place only)",
  copy: "Copy only",
  open: "Open (default)",
};

function isDefault(e: WorkingEntry): boolean {
  return e.enabled === null && e.aiMode === "open" && e.segments.size === 0;
}

export function BlockGovernancePanel({ segments }: { segments: AudienceSegment[] }) {
  const { blocks, loading: catalogLoading } = useBlockCatalog();
  const { entries, save, saving, loading: govLoading } = useTenantBlockGovernance();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  // Local working copy keyed by blockType. Seeded lazily from the loaded
  // governance entries; once the user edits, `overrides` holds the in-flight
  // state for that block.
  const [overrides, setOverrides] = useState<Record<string, WorkingEntry>>({});

  const seeded = useMemo<Record<string, WorkingEntry>>(() => {
    const out: Record<string, WorkingEntry> = {};
    for (const e of entries) {
      out[e.blockType] = {
        enabled: e.enabled,
        aiMode: e.aiMode,
        segments: new Set(e.segments),
      };
    }
    return out;
  }, [entries]);

  const entryFor = (type: string): WorkingEntry =>
    overrides[type] ??
    seeded[type] ?? { enabled: null, aiMode: "open", segments: new Set<string>() };

  const setEntry = (type: string, next: WorkingEntry) =>
    setOverrides((prev) => ({ ...prev, [type]: next }));

  const dirty = Object.keys(overrides).length > 0;

  const q = search.trim().toLowerCase();
  const grouped = useMemo(() => {
    const byCategory = new Map<string, ResolvedBlockDef[]>();
    for (const b of blocks) {
      if (q && !(b.label.toLowerCase().includes(q) || b.type.toLowerCase().includes(q) || b.category.toLowerCase().includes(q))) {
        continue;
      }
      const arr = byCategory.get(b.category) ?? [];
      arr.push(b);
      byCategory.set(b.category, arr);
    }
    return Array.from(byCategory.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [blocks, q]);

  const handleSave = async () => {
    // Merge seeded + overrides, then emit only non-default entries.
    const merged: Record<string, WorkingEntry> = { ...seeded, ...overrides };
    const payload: TenantBlockGovernanceEntry[] = [];
    for (const [blockType, e] of Object.entries(merged)) {
      if (isDefault(e)) continue;
      payload.push({
        blockType,
        enabled: e.enabled,
        aiMode: e.aiMode,
        segments: Array.from(e.segments),
      });
    }
    const ok = await save(payload);
    if (ok) {
      setOverrides({});
      toast({ title: "Governance saved", description: "Block governance updated for your team." });
    } else {
      toast({ title: "Couldn't save", description: "Please try again.", variant: "destructive" });
    }
  };

  const loading = catalogLoading || govLoading;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Block Governance</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            Control which blocks your team can use, how AI may edit each one, and
            which audience segments a block belongs to. Disabled blocks disappear
            from the builder; segment-approved blocks appear under that segment's
            tab. Untouched blocks keep their normal behaviour.
          </p>
        </div>
        <Button onClick={handleSave} disabled={!dirty || saving} size="sm">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blocks…"
          className="h-8 pl-7 text-xs"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-6">Loading blocks…</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">No blocks match "{search}".</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, catBlocks]) => (
            <div key={category}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {category}
              </p>
              <div className="rounded-lg border border-border divide-y divide-border">
                {catBlocks.map((b) => {
                  const e = entryFor(b.type);
                  const enabled = e.enabled !== false;
                  return (
                    <div key={b.type} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-3 py-3">
                      <div className="flex items-center gap-3 min-w-[200px] flex-1">
                        <Switch
                          checked={enabled}
                          onCheckedChange={(checked) =>
                            setEntry(b.type, { ...e, segments: new Set(e.segments), enabled: checked ? null : false })
                          }
                          aria-label={`Enable ${b.label}`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{b.label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{b.type}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">AI</span>
                        <Select
                          value={e.aiMode}
                          onValueChange={(v) =>
                            setEntry(b.type, { ...e, segments: new Set(e.segments), aiMode: v as AiMode })
                          }
                        >
                          <SelectTrigger className="h-8 w-[180px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(["locked", "copy", "open"] as AiMode[]).map((m) => (
                              <SelectItem key={m} value={m} className="text-xs">
                                {AI_MODE_LABELS[m]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {segments.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                          {segments.map((seg) => {
                            const sid = String(seg.id);
                            const checked = e.segments.has(sid);
                            return (
                              <label key={sid} className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) => {
                                    const nextSegs = new Set(e.segments);
                                    if (c) nextSegs.add(sid);
                                    else nextSegs.delete(sid);
                                    setEntry(b.type, { ...e, segments: nextSegs });
                                  }}
                                />
                                <span className="truncate max-w-[120px]">{seg.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
