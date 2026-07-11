/**
 * Superadmin › Support — triage desk for support_tickets (filed by the
 * in-app support bot's escalate_to_support action) plus a cross-tenant
 * AI clustering of what users ask the bot (the product-gap radar).
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, ChevronDown, ChevronRight, Inbox, Loader2, MessagesSquare,
  RefreshCw, RotateCcw, Sparkles,
} from "lucide-react";

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
    let msg = text;
    try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch { /* raw */ }
    throw new Error(msg || String(res.status));
  }
  return res.json();
}

interface Ticket {
  id: number;
  tenantId: number;
  tenantName: string | null;
  conversationId: number | null;
  userEmail: string | null;
  userName: string | null;
  summary: string;
  currentPath: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface TicketList {
  tickets: Ticket[];
  openCount: number;
  windowCount: number;
  conversationCount: number;
  period: string;
}

interface TranscriptMessage { role: string; content: string; createdAt: string }

interface InsightTheme { theme: string; count: number; examples: string[]; suggestion: string }
interface Insights { analyzedCount: number; summary: string; themes: InsightTheme[]; tooFewQuestions?: boolean }

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function StatChip({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border px-4 py-3 flex items-center gap-3">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div>
        <p className="text-lg font-bold leading-tight">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function TicketRow({ ticket, onUpdated }: { ticket: Ticket; onUpdated: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[] | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [notes, setNotes] = useState(ticket.adminNotes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!expanded || transcript !== null || ticket.conversationId == null) return;
    apiFetch(`/api/admin/support-tickets/${ticket.id}/transcript`)
      .then((d: { messages: TranscriptMessage[] }) => setTranscript(d.messages))
      .catch((e: Error) => setTranscriptError(e.message));
  }, [expanded, transcript, ticket.id, ticket.conversationId]);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/support-tickets/${ticket.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onUpdated();
    } catch {
      /* surfaced by the reload below staying stale */
    } finally {
      setSaving(false);
    }
  };

  const open = ticket.status === "open";

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-3 p-3 text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${open ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
              {ticket.status}
            </span>
            <span className="text-xs font-medium">{ticket.tenantName ?? `Tenant ${ticket.tenantId}`}</span>
            <span className="text-xs text-muted-foreground">{ticket.userEmail ?? "unknown user"}</span>
            <span className="text-xs text-muted-foreground ml-auto shrink-0">{fmtDate(ticket.createdAt)}</span>
          </div>
          <p className="text-sm mt-1 leading-snug">{ticket.summary}</p>
          {ticket.currentPath && (
            <p className="text-xs text-muted-foreground mt-0.5">asked from {ticket.currentPath}</p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Transcript */}
          {ticket.conversationId == null ? (
            <p className="text-xs text-muted-foreground">No transcript linked.</p>
          ) : transcriptError ? (
            <p className="text-xs text-destructive">{transcriptError}</p>
          ) : transcript === null ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2 rounded-md bg-muted/40 p-3">
              {transcript.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : ""}>
                  <span className={`inline-block max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs leading-snug text-left ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                    {m.content}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Notes + actions */}
          <div className="flex items-start gap-2">
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Internal notes…"
              rows={2}
              className="text-xs flex-1"
            />
            <div className="flex flex-col gap-1.5 shrink-0">
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={saving || notes === (ticket.adminNotes ?? "")} onClick={() => void patch({ adminNotes: notes })}>
                Save notes
              </Button>
              {open ? (
                <Button size="sm" className="h-7 text-xs gap-1" disabled={saving} onClick={() => void patch({ status: "resolved" })}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={saving} onClick={() => void patch({ status: "open" })}>
                  <RotateCcw className="w-3.5 h-3.5" /> Reopen
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminSupport() {
  const [status, setStatus] = useState<"open" | "resolved" | "all">("open");
  const [data, setData] = useState<TicketList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch(`/api/admin/support-tickets?status=${status}&days=90`)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const analyze = () => {
    setAnalyzing(true);
    setInsightsError(null);
    apiFetch("/api/admin/support-insights", { method: "POST", body: JSON.stringify({ days: 30 }) })
      .then(setInsights)
      .catch((e: Error) => setInsightsError(e.message))
      .finally(() => setAnalyzing(false));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Support</h2>
          <p className="text-sm text-muted-foreground">
            Tickets filed by the in-app support assistant, with the transcripts behind them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
            <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open" className="text-xs">Open</SelectItem>
              <SelectItem value="resolved" className="text-xs">Resolved</SelectItem>
              <SelectItem value="all" className="text-xs">All</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-xl">
        <StatChip label="Open tickets" value={data?.openCount ?? 0} icon={Inbox} />
        <StatChip label="Tickets · 90d" value={data?.windowCount ?? 0} icon={CheckCircle2} />
        <StatChip label="Conversations · 90d" value={data?.conversationCount ?? 0} icon={MessagesSquare} />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-sm px-4 py-3">{error}</div>
      )}

      <div className="grid lg:grid-cols-[1fr,380px] gap-6 items-start">
        {/* Ticket list */}
        <div className="space-y-2">
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
          ) : (data?.tickets.length ?? 0) === 0 ? (
            <div className="rounded-lg border py-10 text-center">
              <Inbox className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No {status === "all" ? "" : status} tickets in the last 90 days.</p>
            </div>
          ) : (
            data?.tickets.map(t => <TicketRow key={t.id} ticket={t} onUpdated={load} />)
          )}
        </div>

        {/* Product-gap radar */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-muted-foreground" /> What users ask (30d)
            </h3>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={analyze} disabled={analyzing}>
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {insights ? "Re-analyze" : "Analyze"}
            </Button>
          </div>
          {insightsError ? (
            <p className="text-sm text-destructive">{insightsError}</p>
          ) : !insights ? (
            <p className="text-xs text-muted-foreground">
              Cluster every support-bot question across all tenants into themes — where the product
              confuses people, and what to fix (docs, UX, or missing features).
            </p>
          ) : insights.tooFewQuestions ? (
            <p className="text-xs text-muted-foreground">Not enough questions yet to find patterns.</p>
          ) : (
            <div className="space-y-3">
              {insights.summary && <p className="text-xs text-muted-foreground">{insights.summary}</p>}
              {insights.themes.map(t => (
                <div key={t.theme} className="rounded-md border p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold">{t.theme}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0">{t.count}×</span>
                  </div>
                  {t.examples.length > 0 && (
                    <p className="text-[11px] text-muted-foreground italic mt-0.5">
                      {t.examples.map(e => `"${e}"`).join(" · ")}
                    </p>
                  )}
                  {t.suggestion && <p className="text-[11px] mt-1 text-emerald-700">→ {t.suggestion}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
