import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2, RefreshCw, Download, History, Sparkles, Megaphone, AlertTriangle, Check, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ChannelField {
  key: string;
  label: string;
  max: number;
  count: number;
}
interface ChannelSpec {
  id: string;
  name: string;
  fields: ChannelField[];
}
interface Variant { value: string; overLimit: boolean }
interface ChannelOutput {
  id: string;
  name: string;
  fields: Record<string, Variant[]>;
}
interface RunRow {
  id: number;
  inputSummary: { tone?: string; audienceOverride?: string | null; channels?: string[]; pageTitle?: string };
  output: { channels?: ChannelOutput[] };
  createdBy: string | null;
  createdAt: string;
}

type Tone = "professional" | "playful" | "urgent";
type FollowUp = "punchier" | "urgency" | "proof";

interface AdCopyDialogProps {
  open: boolean;
  onClose: () => void;
  pageId: number;
  pageTitle: string;
}

function toCsv(channels: ChannelOutput[], specs: ChannelSpec[]): string {
  const rows: string[][] = [["channel", "field", "variant_index", "value", "char_count", "limit", "over_limit"]];
  for (const ch of channels) {
    const spec = specs.find((s) => s.id === ch.id);
    for (const f of spec?.fields ?? []) {
      const variants = ch.fields[f.key] ?? [];
      variants.forEach((v, i) => {
        rows.push([
          ch.name,
          f.label,
          String(i + 1),
          v.value,
          String(v.value.length),
          String(f.max),
          v.overLimit ? "yes" : "no",
        ]);
      });
    }
  }
  return rows.map((row) => row.map((cell) => {
    if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
    return cell;
  }).join(",")).join("\n");
}

export function AdCopyDialog({ open, onClose, pageId, pageTitle }: AdCopyDialogProps) {
  const { toast } = useToast();
  const [specs, setSpecs] = useState<ChannelSpec[]>([]);
  const [channels, setChannels] = useState<ChannelOutput[] | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [regenKey, setRegenKey] = useState<string | null>(null); // `${channelId}.${fieldKey}`
  const [tone, setTone] = useState<Tone>("professional");
  const [audience, setAudience] = useState("");
  const [activeTab, setActiveTab] = useState("google_rsa");

  // Load specs + run history when dialog opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/lp/pages/${pageId}/ad-copy/runs`, { credentials: "include" });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        setSpecs(data.channels ?? []);
        setRuns(data.runs ?? []);
        const latest = (data.runs ?? [])[0];
        if (latest?.output?.channels) {
          setChannels(latest.output.channels);
          if (latest.inputSummary?.tone) setTone(latest.inputSummary.tone as Tone);
          if (latest.inputSummary?.audienceOverride) setAudience(latest.inputSummary.audienceOverride ?? "");
        }
      } catch (err) {
        console.error("[ad-copy] load runs failed", err);
      }
    })();
    return () => { cancelled = true; };
  }, [open, pageId]);

  useEffect(() => {
    if (channels && channels.length > 0 && !channels.find((c) => c.id === activeTab)) {
      setActiveTab(channels[0].id);
    }
  }, [channels, activeTab]);

  const generate = useCallback(async (extraInstruction?: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/lp/pages/${pageId}/ad-copy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone,
          audienceOverride: audience.trim() || undefined,
          // Follow-up nudges (punchier/urgency/proof) ride on a dedicated
          // `instruction` field so the audience description isn't mutated.
          ...(extraInstruction ? { instruction: extraInstruction } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: "generation failed", description: data?.error ?? "unknown error", variant: "destructive" });
        return;
      }
      setChannels(data.channels ?? []);
      // Refresh history.
      const rh = await fetch(`/api/lp/pages/${pageId}/ad-copy/runs`, { credentials: "include" });
      if (rh.ok) {
        const dh = await rh.json();
        setRuns(dh.runs ?? []);
      }
      toast({ title: "ad copy generated", description: `${(data.channels ?? []).length} channels` });
    } catch (err) {
      toast({ title: "generation failed", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [pageId, tone, audience, toast]);

  const regenerateField = useCallback(async (channelId: string, fieldKey: string) => {
    const key = `${channelId}.${fieldKey}`;
    setRegenKey(key);
    try {
      const r = await fetch(`/api/lp/pages/${pageId}/ad-copy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone,
          audienceOverride: audience.trim() || undefined,
          regenerate: { channelId, fieldKey },
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: "regenerate failed", description: data?.error ?? "unknown", variant: "destructive" });
        return;
      }
      setChannels((prev) => prev?.map((ch) => ch.id === channelId
        ? { ...ch, fields: { ...ch.fields, [fieldKey]: data.regenerated.variants } }
        : ch) ?? prev);
    } catch (err) {
      toast({ title: "regenerate failed", description: String(err), variant: "destructive" });
    } finally {
      setRegenKey(null);
    }
  }, [pageId, tone, audience, toast]);

  function applyFollowUp(kind: FollowUp) {
    const note = kind === "punchier"
      ? "Make every variant punchier — shorter, stronger verbs, less filler."
      : kind === "urgency"
        ? "Inject urgency — scarcity, deadlines, immediate benefit. Avoid cliché 'act now'."
        : "Lead with proof — concrete numbers, customer counts, outcomes, named credentials.";
    generate(note);
  }

  function updateVariant(channelId: string, fieldKey: string, idx: number, value: string) {
    setChannels((prev) => prev?.map((ch) => {
      if (ch.id !== channelId) return ch;
      const arr = (ch.fields[fieldKey] ?? []).slice();
      const limit = specs.find((s) => s.id === channelId)?.fields.find((f) => f.key === fieldKey)?.max ?? 9999;
      arr[idx] = { value, overLimit: value.length > limit };
      return { ...ch, fields: { ...ch.fields, [fieldKey]: arr } };
    }) ?? prev);
  }

  function downloadCsv() {
    if (!channels) return;
    const csv = toCsv(channels, specs);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pageTitle || "page"}-ad-copy.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function loadRun(runId: number) {
    const run = runs.find((r) => r.id === runId);
    if (!run?.output?.channels) return;
    setChannels(run.output.channels);
    if (run.inputSummary?.tone) setTone(run.inputSummary.tone as Tone);
    if (run.inputSummary?.audienceOverride !== undefined) setAudience(run.inputSummary.audienceOverride ?? "");
  }

  function copyValue(value: string) {
    navigator.clipboard.writeText(value).then(() => {
      toast({ title: "copied", description: value.length > 60 ? value.slice(0, 60) + "…" : value });
    }).catch(() => {});
  }

  const hasContent = channels && channels.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            <span>Ad copy for {pageTitle || "this page"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-3 border-b bg-muted/30 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs text-muted-foreground">Tone</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="playful">Playful</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-[2] min-w-[220px]">
            <Label className="text-xs text-muted-foreground">Audience override (optional)</Label>
            <Input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. DSO operations leaders evaluating new clinical AI"
              className="h-8 text-xs"
            />
          </div>
          <Button onClick={() => generate()} disabled={loading} size="sm" className="gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {hasContent ? "Regenerate all" : "Generate"}
          </Button>
          <Button onClick={downloadCsv} disabled={!hasContent} variant="outline" size="sm" className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            CSV
          </Button>
        </div>

        {hasContent && (
          <div className="px-6 py-2 border-b flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Quick follow-ups:</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading} onClick={() => applyFollowUp("punchier")}>punchier</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading} onClick={() => applyFollowUp("urgency")}>urgency</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading} onClick={() => applyFollowUp("proof")}>proof</Button>
            {runs.length > 1 && (
              <div className="ml-auto flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-muted-foreground" />
                <Select onValueChange={(v) => loadRun(Number(v))}>
                  <SelectTrigger className="h-7 text-xs w-[200px]"><SelectValue placeholder="Previous runs" /></SelectTrigger>
                  <SelectContent>
                    {runs.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)} className="text-xs">
                        {new Date(r.createdAt).toLocaleString()} · {r.inputSummary?.tone ?? "?"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {!hasContent && !loading && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Megaphone className="w-10 h-10 mx-auto opacity-30 mb-3" />
              <p>No ad copy generated yet.</p>
              <p className="mt-1">Pick a tone and click Generate.</p>
            </div>
          )}
          {loading && !hasContent && (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p>Generating ad copy across channels…</p>
            </div>
          )}
          {hasContent && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6 py-4">
              <TabsList className="w-full">
                {channels!.map((ch) => (
                  <TabsTrigger key={ch.id} value={ch.id} className="flex-1 text-xs">
                    {ch.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {channels!.map((ch) => {
                const spec = specs.find((s) => s.id === ch.id);
                return (
                  <TabsContent key={ch.id} value={ch.id} className="mt-4 space-y-5">
                    {(spec?.fields ?? []).map((f) => {
                      const variants = ch.fields[f.key] ?? [];
                      const overCount = variants.filter((v) => v.overLimit).length;
                      const isRegen = regenKey === `${ch.id}.${f.key}`;
                      return (
                        <div key={f.key} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold">{f.label}</h4>
                            <Badge variant="outline" className="text-[10px]">≤ {f.max} chars</Badge>
                            <Badge variant="outline" className="text-[10px]">{variants.length}/{f.count}</Badge>
                            {overCount > 0 && (
                              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/50 gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {overCount} over
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-auto h-7 text-xs gap-1"
                              disabled={isRegen || loading}
                              onClick={() => regenerateField(ch.id, f.key)}
                            >
                              {isRegen ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                              regenerate
                            </Button>
                          </div>
                          <div className="space-y-1.5">
                            {variants.length === 0 && (
                              <p className="text-xs text-muted-foreground italic">No variants returned.</p>
                            )}
                            {variants.map((v, idx) => (
                              <VariantRow
                                key={idx}
                                variant={v}
                                max={f.max}
                                multiline={f.max > 90}
                                onChange={(val) => updateVariant(ch.id, f.key, idx, val)}
                                onCopy={() => copyValue(v.value)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VariantRow({ variant, max, multiline, onChange, onCopy }: {
  variant: Variant;
  max: number;
  multiline: boolean;
  onChange: (v: string) => void;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const len = variant.value.length;
  const over = len > max;
  function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className={cn(
      "flex items-start gap-2 rounded-md border p-2 bg-background",
      over && "border-destructive/60 bg-destructive/5",
    )}>
      {multiline ? (
        <Textarea
          value={variant.value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("flex-1 text-xs min-h-[44px] resize-y", over && "text-destructive")}
        />
      ) : (
        <Input
          value={variant.value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("flex-1 text-xs h-8", over && "text-destructive")}
        />
      )}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn("text-[10px] tabular-nums", over ? "text-destructive font-semibold" : "text-muted-foreground")}>
          {len}/{max}
        </span>
        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={handleCopy} title="Copy">
          {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );
}
