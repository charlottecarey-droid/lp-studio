import { useState, useEffect, useCallback } from "react";
import { Loader2, Copy, Check, Download, Send, AlertTriangle, Link2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "/api";

interface LinkRow {
  contactId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  company: string;
  title: string;
  link: string;
}

interface BuildResult {
  pageId: number;
  pageTitle: string;
  pageSlug: string;
  skippedNoEmail: number;
  rows: LinkRow[];
}

interface DestinationOption {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

interface Destination {
  id: string;
  displayName: string;
  description: string;
  resultType: "file" | "message";
  configured: boolean;
  options: DestinationOption[];
}

interface Props {
  pageId: number;
  contactIds: number[];
  onError?: (msg: string | null) => void;
}

/**
 * No-email "Generate personalized links only" panel.
 *
 * Builds a personalized microsite hotlink per contact, lists them with
 * copy-to-clipboard, and exports the normalized rows to a destination from the
 * server-driven registry (CSV download / Google Sheet / Marketo static list).
 * Destinations are rendered from `/sales/link-export/destinations` — no
 * hardcoded buttons — so a future destination appears here automatically.
 */
export function LinkExportPanel({ pageId, contactIds, onError }: Props) {
  const { toast } = useToast();
  const [building, setBuilding] = useState(false);
  const [build, setBuild] = useState<BuildResult | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [optionValues, setOptionValues] = useState<Record<string, Record<string, string>>>({});

  const setErr = useCallback((m: string | null) => onError?.(m), [onError]);

  const buildRows = useCallback(async () => {
    setBuilding(true);
    setErr(null);
    try {
      const r = await fetch(`${API_BASE}/sales/link-export/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, contactIds }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Failed to generate personalized links");
      setBuild(data as BuildResult);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to generate personalized links");
    } finally {
      setBuilding(false);
    }
  }, [pageId, contactIds, setErr]);

  // Build rows + load destinations when the panel mounts.
  useEffect(() => {
    buildRows();
    fetch(`${API_BASE}/sales/link-export/destinations`)
      .then(r => r.ok ? r.json() : { destinations: [] })
      .then(d => setDestinations(Array.isArray(d.destinations) ? d.destinations : []))
      .catch(() => setDestinations([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copyLink(row: LinkRow) {
    try {
      await navigator.clipboard.writeText(row.link);
      setCopiedId(row.contactId);
      setTimeout(() => setCopiedId(c => (c === row.contactId ? null : c)), 1800);
    } catch {
      setErr("Couldn't copy to clipboard — copy the link manually.");
    }
  }

  function setOption(destId: string, key: string, value: string) {
    setOptionValues(prev => ({ ...prev, [destId]: { ...(prev[destId] ?? {}), [key]: value } }));
  }

  async function runExport(dest: Destination) {
    // Validate required options client-side before hitting the server.
    const opts = optionValues[dest.id] ?? {};
    for (const o of dest.options) {
      if (o.required && !(opts[o.key] ?? "").trim()) {
        setErr(`${o.label} is required for ${dest.displayName}.`);
        return;
      }
    }
    setExportingId(dest.id);
    setErr(null);
    try {
      const r = await fetch(`${API_BASE}/sales/link-export/${dest.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, contactIds, options: opts }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? `${dest.displayName} export failed`);
      }
      if (dest.resultType === "file") {
        // Stream the file to a download.
        const blob = await r.blob();
        const cd = r.headers.get("Content-Disposition") || "";
        const match = /filename="([^"]+)"/.exec(cd);
        const filename = match?.[1] || `${build?.pageSlug || "personalized-links"}.csv`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast({ title: "Downloaded", description: `Saved ${filename}.` });
      } else {
        const data = await r.json().catch(() => ({}));
        toast({ title: dest.displayName, description: data.message ?? "Export complete." });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : `${dest.displayName} export failed`);
    } finally {
      setExportingId(null);
    }
  }

  const rows = build?.rows ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          {building ? (
            "Generating personalized links…"
          ) : build ? (
            <>
              <span className="font-semibold text-foreground">{rows.length}</span>{" "}
              personalized {rows.length === 1 ? "link" : "links"} for{" "}
              <span className="font-semibold text-foreground">{build.pageTitle}</span>
              {build.skippedNoEmail > 0 && (
                <span className="block text-[11px] text-amber-600 mt-0.5">
                  {build.skippedNoEmail} contact{build.skippedNoEmail === 1 ? "" : "s"} skipped (no email or inactive).
                </span>
              )}
            </>
          ) : (
            "No links yet."
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={buildRows} disabled={building} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${building ? "animate-spin" : ""}`} /> Regenerate
        </Button>
      </div>

      {/* Link list */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="max-h-[300px] overflow-y-auto divide-y divide-border">
          {building ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-5/6" />
              <Skeleton className="h-5 w-4/6" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              No contacts with an email address to generate links for.
            </div>
          ) : (
            rows.map(row => (
              <div key={row.contactId} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">
                    {row.fullName || row.email}
                    {row.company && <span className="text-muted-foreground font-normal"> · {row.company}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                    <Link2 className="w-3 h-3 shrink-0" />
                    <span className="truncate font-mono">{row.link}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyLink(row)}
                  className="gap-1.5 shrink-0"
                >
                  {copiedId === row.contactId
                    ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied</>
                    : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Export destinations (rendered from the registry) */}
      <div className="border border-border rounded-xl p-4 bg-muted/20">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Export these links
        </div>
        <div className="flex flex-col gap-3">
          {destinations.length === 0 ? (
            <div className="text-xs text-muted-foreground">No export destinations available.</div>
          ) : (
            destinations.map(dest => (
              <div key={dest.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{dest.displayName}</div>
                    <div className="text-[11px] text-muted-foreground">{dest.description}</div>
                    {!dest.configured && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-600 mt-1">
                        <AlertTriangle className="w-3 h-3" /> Not connected for this workspace.
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => runExport(dest)}
                    disabled={!dest.configured || rows.length === 0 || exportingId !== null || building}
                    className="gap-1.5 shrink-0"
                  >
                    {exportingId === dest.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : dest.resultType === "file"
                        ? <Download className="w-3.5 h-3.5" />
                        : <Send className="w-3.5 h-3.5" />}
                    {dest.resultType === "file" ? "Download" : "Send"}
                  </Button>
                </div>
                {dest.configured && dest.options.length > 0 && (
                  <div className="flex flex-col gap-2 mt-3">
                    {dest.options.map(o => (
                      <div key={o.key}>
                        <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                          {o.label}{o.required ? " *" : ""}
                        </label>
                        <Input
                          value={(optionValues[dest.id]?.[o.key]) ?? ""}
                          onChange={e => setOption(dest.id, o.key, e.target.value)}
                          placeholder={o.placeholder}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
