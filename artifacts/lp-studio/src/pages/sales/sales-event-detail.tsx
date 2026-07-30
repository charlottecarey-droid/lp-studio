import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  BarChart3, CalendarDays, Check, Copy, ExternalLink, FileDown, FileUp, Globe, MapPin, Pencil, Pin,
  Plus, RefreshCw, Sparkles, Trash2, Users, Zap, Loader2, AlertTriangle, Download, ChevronDown, Palette } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { fetchBrandConfig } from "@/lib/brand-config";
import { SalesLayout } from "@/components/layout/sales-layout";
import { SalesPageHeader } from "@/components/sales/sales-page-header";
import { toast } from "@/hooks/use-toast";

const API_BASE = "/api";

/* ----------------------------------------------------------------------------
 * Sales Console → Event detail: the agenda builder.
 *
 * Top half manages the event's session catalog (manual add/edit, CSV import
 * with header auto-mapping — upserts by title+day+start so re-imports update
 * instead of duplicating). Bottom half is per-account agendas: pick an
 * account (typeahead over synced accounts), name who's attending, and
 * deterministic matching proposes a conflict-free draft the rep adjusts —
 * every pick shows WHY it matched. Publish renders the `event-agenda`
 * full-page block as an lp_page share link; republishing updates the same
 * page/URL.
 * -------------------------------------------------------------------------- */

interface EventSession {
  id: number;
  title: string;
  description: string | null;
  day: string | null;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
  sessionType: string | null;
  track: string | null;
  speakers: { name: string; title?: string; org?: string }[];
  tags: { roles?: string[]; industries?: string[]; topics?: string[]; tiers?: string[] };
  isReservedSlot: boolean;
  /** 'active' | 'missing' — a session the RainFocus catalog no longer lists. */
  catalogStatus?: string;
  missingSince?: string | null;
}

interface EventDetail {
  id: number;
  name: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  /** Page whose event-agenda styling every agenda of this event inherits. */
  styleTemplatePageId?: number | null;
  /** Token-free RainFocus state (the API redacts apiToken). */
  rainfocusConfig?: {
    connected?: boolean;
    widgetId?: string;
    autoSync?: boolean;
    lastSyncAt?: string;
    lastSyncStatus?: "ok" | "error";
    lastSyncMessage?: string;
    lastSyncSummary?: { created?: number; updated?: number; missing?: number; restored?: number; total?: number };
  } | null;
}

interface AgendaRow {
  id: number;
  accountId: number | null;
  accountName: string | null;
  status: string;
  selections: { sessionId: number; blurbOverride?: string }[];
  attendeeRoles: string[];
  personalNote: string | null;
  segmentOverride?: string | null;
  pageUrl: string | null;
  lpPageId?: number | null;
}

/** A role the catalog actually tags, with how many sessions carry it. */
interface SegmentOption { segment: string; count: number }

/**
 * Brand Settings segments + the segments this catalog actually uses, in one
 * list. Brand segments come first (the tenant's taxonomy is the default
 * vocabulary); catalog-only names follow, so a conference that labels its
 * audiences differently is still pickable. Compared case-insensitively so the
 * same segment can't appear twice.
 */
function mergeSegmentOptions(catalog: SegmentOption[], brand: string[]): SegmentOption[] {
  const out: SegmentOption[] = [];
  const seen = new Set<string>();
  const push = (segment: string, count: number) => {
    const key = segment.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ segment, count });
  };
  for (const name of brand) {
    push(name, catalog.find((c) => c.segment.trim().toLowerCase() === name.trim().toLowerCase())?.count ?? 0);
  }
  for (const c of catalog) push(c.segment, c.count);
  return out;
}

interface RoleOption {
  role: string;
  count: number;
}

interface SessionScore {
  sessionId: number;
  score: number;
  reasons: string[];
  pinned: boolean;
  /** Declared for a different segment — kept off the draft, still listed so
   *  the rep can see it exists and add it deliberately. */
  excludedBySegment?: boolean;
}

interface EventAnalytics {
  summary: { agendas: number; published: number; visits: number; uniqueVisitors: number; leads: number; rsvps: number };
  agendas: {
    id: number;
    accountName: string;
    status: string;
    url: string | null;
    visits: number;
    uniqueVisitors: number;
    leads: number;
    rsvps: number;
  }[];
  topSessions: { sessionId: number; title: string; day: string | null; isReservedSlot: boolean; pickCount: number }[];
}

function formatDay(day: string | null): string {
  if (!day) return "No date";
  const d = new Date(`${day}T12:00:00Z`);
  if (isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
}

function timeLabel(s: EventSession): string {
  const fmt = (hhmm: string | null) => {
    if (!hhmm) return "";
    const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
    if (!m) return hhmm;
    const h = parseInt(m[1], 10);
    return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
  };
  const a = fmt(s.startTime);
  const b = fmt(s.endTime);
  return a && b ? `${a} – ${b}` : a || b || "";
}

function splitList(v: string): string[] {
  return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

/** Client twin of the publish route's formatDateRange: "Mar 10–12, 2026". */
function formatDateRangeLabel(start: string | null, end: string | null): string {
  if (!start) return "";
  const s = new Date(`${start}T12:00:00Z`);
  if (isNaN(s.getTime())) return start;
  const opts = { month: "short", day: "numeric", timeZone: "UTC" } as const;
  const sLabel = s.toLocaleDateString("en-US", opts);
  if (!end || end === start) return `${sLabel}, ${s.getUTCFullYear()}`;
  const e = new Date(`${end}T12:00:00Z`);
  if (isNaN(e.getTime())) return `${sLabel}, ${s.getUTCFullYear()}`;
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  const eLabel = sameMonth ? String(e.getUTCDate()) : e.toLocaleDateString("en-US", opts);
  return `${sLabel}–${eLabel}, ${e.getUTCFullYear()}`;
}

/* ── session add/edit dialog ─────────────────────────────────────────────── */

interface SessionForm {
  title: string;
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  sessionType: string;
  track: string;
  description: string;
  speakers: string; // "Name - Title" per line
  roles: string;
  industries: string;
  topics: string;
  isReservedSlot: boolean;
}

const EMPTY_FORM: SessionForm = {
  title: "", day: "", startTime: "", endTime: "", room: "", sessionType: "",
  track: "", description: "", speakers: "", roles: "", industries: "", topics: "",
  isReservedSlot: false,
};

function sessionToForm(s: EventSession): SessionForm {
  return {
    title: s.title,
    day: s.day ?? "",
    startTime: s.startTime ?? "",
    endTime: s.endTime ?? "",
    room: s.room ?? "",
    sessionType: s.sessionType ?? "",
    track: s.track ?? "",
    description: s.description ?? "",
    speakers: (s.speakers ?? []).map((sp) => (sp.title ? `${sp.name} - ${sp.title}` : sp.name)).join("\n"),
    roles: (s.tags?.roles ?? []).join(", "),
    industries: (s.tags?.industries ?? []).join(", "),
    topics: (s.tags?.topics ?? []).join(", "),
    isReservedSlot: s.isReservedSlot,
  };
}

function formToBody(f: SessionForm) {
  return {
    title: f.title.trim(),
    day: f.day || undefined,
    startTime: f.startTime || undefined,
    endTime: f.endTime || undefined,
    room: f.room || undefined,
    sessionType: f.sessionType || undefined,
    track: f.track || undefined,
    description: f.description || undefined,
    speakers: f.speakers
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, ...rest] = line.split(" - ");
        return { name: name.trim(), title: rest.join(" - ").trim() || undefined };
      }),
    tags: {
      roles: splitList(f.roles),
      industries: splitList(f.industries),
      topics: splitList(f.topics),
    },
    isReservedSlot: f.isReservedSlot,
  };
}

/**
 * Attendee/audience roles taken from THIS tenant's brand settings: the buyer
 * personas defined per audience segment, plus any roles named on the Sales
 * Console value-prop pairs. These are the same roles the rest of the console
 * personalizes against, so the agenda builder matches on vocabulary the tenant
 * actually uses — no hardcoded list (a dental "Clinical Director" chip means
 * nothing to another tenant). Empty when brand settings define none; every
 * caller keeps a free-text path.
 */
function useBrandRoleSuggestions(active: boolean): string[] {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      try {
        const brand = await fetchBrandConfig();
        if (cancelled) return;
        const fromPersonas = (brand.segments ?? []).flatMap((s) => (s.personas ?? []).map((p) => p.role));
        const fromValueProps = (brand.salesConsole?.valuePropPairs ?? []).flatMap((p) => p.roles ?? []);
        const seen = new Set<string>();
        const unique: string[] = [];
        for (const raw of [...fromPersonas, ...fromValueProps]) {
          const role = (raw ?? "").trim();
          if (!role) continue;
          const key = role.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(role);
        }
        setSuggestions(unique.slice(0, 12));
      } catch {
        // Brand unreachable — callers fall back to free text.
      }
    })();
    return () => { cancelled = true; };
  }, [active]);
  return suggestions;
}

function SessionDialog({
  open, onClose, onSaved, eventId, editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventId: number;
  editing: EventSession | null;
}) {
  const [form, setForm] = useState<SessionForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const brandRoles = useBrandRoleSuggestions(open);

  useEffect(() => {
    if (open) setForm(editing ? sessionToForm(editing) : EMPTY_FORM);
  }, [open, editing]);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const url = editing
        ? `${API_BASE}/sales/events/${eventId}/sessions/${editing.id}`
        : `${API_BASE}/sales/events/${eventId}/sessions`;
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToBody(form)),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onSaved();
      onClose();
    } catch {
      toast({ title: "Couldn't save the session", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const set = (patch: Partial<SessionForm>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit session" : "Add session"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Day</Label>
              <Input type="date" value={form.day} onChange={(e) => set({ day: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Room</Label>
              <Input value={form.room} onChange={(e) => set({ room: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Input value={form.sessionType} onChange={(e) => set({ sessionType: e.target.value })} placeholder="Workshop" />
            </div>
            <div className="space-y-1.5">
              <Label>Track</Label>
              <Input value={form.track} onChange={(e) => set({ track: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Speakers (Name - Title, one per line)</Label>
            <Textarea rows={2} value={form.speakers} onChange={(e) => set({ speakers: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Audience roles (comma-separated — drives matching)</Label>
            <Input
              value={form.roles}
              onChange={(e) => set({ roles: e.target.value })}
              placeholder={brandRoles.length > 0 ? brandRoles.slice(0, 3).join(", ") : "Add roles this session is for"}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Industries</Label>
              <Input value={form.industries} onChange={(e) => set({ industries: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Topics</Label>
              <Input value={form.topics} onChange={(e) => set({ topics: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Reserved slot</Label>
              <p className="text-xs text-muted-foreground">Account-team 1:1s, dinners — always included on every agenda.</p>
            </div>
            <Switch checked={form.isReservedSlot} onCheckedChange={(v) => set({ isReservedSlot: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" disabled={!form.title.trim() || saving} onClick={() => void save()}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── CSV import dialog ───────────────────────────────────────────────────── */

const CSV_FIELDS = [
  { key: "", label: "Ignore" },
  { key: "title", label: "Title" },
  { key: "day", label: "Day (YYYY-MM-DD)" },
  { key: "startTime", label: "Start time (HH:MM)" },
  { key: "endTime", label: "End time (HH:MM)" },
  { key: "room", label: "Room" },
  { key: "sessionType", label: "Session type" },
  { key: "track", label: "Track" },
  { key: "description", label: "Description" },
  { key: "speakers", label: "Speakers" },
  { key: "roles", label: "Audience roles" },
  { key: "industries", label: "Industries" },
  { key: "topics", label: "Topics" },
] as const;

function autoDetect(header: string): string {
  const n = header.toLowerCase().replace(/[\s_-]/g, "");
  if (/^(session)?(title|name)$/.test(n)) return "title";
  if (/^(day|date)$/.test(n)) return "day";
  if (/^start(time)?$/.test(n)) return "startTime";
  if (/^end(time)?$/.test(n)) return "endTime";
  if (/^(room|location|venue)$/.test(n)) return "room";
  if (/^(sessiontype|type|format)$/.test(n)) return "sessionType";
  if (/^track$/.test(n)) return "track";
  if (/^(description|overview|abstract|summary)$/.test(n)) return "description";
  if (/^speakers?$/.test(n)) return "speakers";
  if (/^(roles?|audience|whoitsfor|whofor)$/.test(n)) return "roles";
  if (/^industr(y|ies)$/.test(n)) return "industries";
  if (/^topics?$/.test(n)) return "topics";
  return "";
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  const parseRow = (line: string): string[] => {
    const vals: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { vals.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    vals.push(cur.trim());
    return vals;
  };
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).filter((l) => l.trim()).map((line) => {
    const vals = parseRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
  return { headers, rows };
}

/** Header names chosen so autoDetect() maps every column on re-upload.
 *  Sample rows stay industry-neutral — this file ships to every tenant, and
 *  the Roles/Industries values should come from their own vocabulary (see
 *  useBrandRoleSuggestions). Industries is left blank rather than guessing a
 *  vertical; the header alone teaches the format. */
const CSV_TEMPLATE = [
  "Title,Day,Start Time,End Time,Room,Session Type,Track,Description,Speakers,Roles,Industries,Topics",
  '"Opening Keynote: The Road Ahead",2026-10-20,09:00,10:00,Main Hall,Keynote,General,"Welcome keynote covering the vision, roadmap, and year ahead.",Jane Smith - CEO; Alex Lee - VP Product,Executive; Owner,,AI; Growth',
  '"Hands-on Workshop: Getting More from the Platform",2026-10-20,10:30,12:00,Room 204,Workshop,Operations,"Small-group workshop; bring a laptop.",Sam Patel - Director of Operations,Operations,,Workflows',
].join("\n");

function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "agenda-sessions-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function CsvImportDialog({
  open, onClose, onImported, eventId,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  eventId: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) { setHeaders([]); setRows([]); setMapping({}); }
  }, [open]);

  const onFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(Object.fromEntries(parsed.headers.map((h) => [h, autoDetect(h)])));
  };

  const mappedField = (field: string) => Object.entries(mapping).find(([, f]) => f === field)?.[0];

  const doImport = async () => {
    const titleHeader = mappedField("title");
    if (!titleHeader) {
      toast({ title: "Map a column to Title first", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const body = rows.map((r) => {
        const get = (field: string) => {
          const h = mappedField(field);
          return h ? r[h] ?? "" : "";
        };
        return {
          title: get("title"),
          day: get("day") || undefined,
          startTime: get("startTime") || undefined,
          endTime: get("endTime") || undefined,
          room: get("room") || undefined,
          sessionType: get("sessionType") || undefined,
          track: get("track") || undefined,
          description: get("description") || undefined,
          speakers: splitList(get("speakers")).map((s) => {
            const [name, ...rest] = s.split(" - ");
            return { name: name.trim(), title: rest.join(" - ").trim() || undefined };
          }),
          tags: {
            roles: splitList(get("roles")),
            industries: splitList(get("industries")),
            topics: splitList(get("topics")),
          },
        };
      }).filter((r) => r.title.trim());
      const res = await fetch(`${API_BASE}/sales/events/${eventId}/sessions/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: body }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      toast({ title: `Imported ${data.created} new, updated ${data.updated}` });
      onImported();
      onClose();
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import sessions from CSV</DialogTitle>
          <DialogDescription>
            Re-importing is safe: rows are matched by title + day + start time, so updates don't duplicate — and tags you've edited in the app are kept.
          </DialogDescription>
        </DialogHeader>
        {headers.length === 0 ? (
          <>
            <div
              className="border border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-foreground/40 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="w-6 h-6 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm">Choose a CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">One row per session. Headers like Title, Day, Start, Roles are auto-detected.</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Not sure about the format? Start from the template — it has the right headers and two example rows.
              </p>
              <Button variant="outline" size="sm" className="shrink-0" onClick={downloadCsvTemplate}>
                <FileDown className="w-3.5 h-3.5 mr-1.5" />
                CSV template
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{rows.length} rows parsed. Map columns:</p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-2">
                  <span className="text-xs font-mono w-40 truncate shrink-0" title={h}>{h}</span>
                  <select
                    className="flex-1 h-8 text-xs border rounded-md bg-background px-2"
                    value={mapping[h] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                  >
                    {CSV_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" disabled={rows.length === 0 || importing} onClick={() => void doImport()}>
            {importing ? "Importing…" : `Import ${rows.length} sessions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── URL import dialog ───────────────────────────────────────────────────── */

function UrlImportDialog({
  open, onClose, onImported, eventId,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  eventId: number;
}) {
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) { setUrl(""); setImporting(false); }
  }, [open]);

  const doImport = async () => {
    setImporting(true);
    try {
      const res = await fetch(`${API_BASE}/sales/events/${eventId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Import failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({
        title: `Imported ${data.created} new, updated ${data.updated}`,
        description: data.truncated
          ? "The page was very long and was truncated — spot-check the catalog and re-run or CSV-import anything missing."
          : "Review the sessions and add audience-role tags where the page didn't state them — tags drive matching.",
      });
      onImported();
      onClose();
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !importing && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import from an agenda URL</DialogTitle>
          <DialogDescription>
            Paste the public agenda page — the sessions are read off the rendered page, so calendar-widget agendas work too. Re-running refreshes times and rooms without duplicating, and keeps tags you've edited here.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Agenda page URL</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/conference/agenda"
            autoFocus
            disabled={importing}
          />
          {importing && (
            <p className="text-xs text-muted-foreground pt-1">
              Rendering the page and extracting sessions — large agendas can take a minute or two. Keep this open.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={importing} onClick={onClose}>Cancel</Button>
          <Button variant="brand" disabled={!/^https?:\/\/.+/.test(url.trim()) || importing} onClick={() => void doImport()}>
            {importing ? "Importing…" : "Import sessions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Which page styles this event's agendas.
 *
 * A rep styles ONE agenda in the builder, points the event at it here, and
 * every agenda published for the event inherits that look — Groundbreak pages
 * all match; an executive event can run premium styling. Content stays
 * per-account; only styling and house copy carry over. Takes effect on the
 * next publish/republish of each agenda.
 */
function AgendaStyleSelect({ eventId, value, agendas, onChanged }: {
  eventId: number;
  value: number | null | undefined;
  agendas: AgendaRow[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const candidates = agendas.filter((a) => a.lpPageId);
  if (candidates.length === 0 && !value) return null;

  const save = async (raw: string) => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/sales/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleTemplatePageId: raw === "default" ? null : Number(raw) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast({ title: "Couldn't set the styling", description: data.error, variant: "destructive" }); return; }
      toast({
        title: raw === "default" ? "Back to tenant default styling" : "Event styling set",
        description: raw === "default" ? undefined : "Every agenda picks this up the next time it's published.",
      });
      onChanged();
    } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-1.5 ml-auto" title="One page's styling, applied to every agenda of this event when it publishes">
      <Palette className="w-3.5 h-3.5 text-muted-foreground" />
      <Select value={value ? String(value) : "default"} onValueChange={(v) => void save(v)} disabled={busy}>
        <SelectTrigger className="h-8 w-52 text-xs">
          <SelectValue placeholder="Agenda styling" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Styling: tenant default</SelectItem>
          {candidates.map((a) => (
            <SelectItem key={a.id} value={String(a.lpPageId)}>
              Style like: {a.accountName ?? "agenda"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Auto-sync state for an event connected to RainFocus.
 *
 * Shows what the last run changed, because that's the only reason to care: a
 * catalog that added two sessions and dropped three is exactly what would
 * otherwise silently invalidate an agenda already sent to a customer.
 *
 * There is no seat count here on purpose — a public widget token doesn't expose
 * registrations or a sold-out flag (see lib/sales/rainfocus-sync.ts).
 */
function RainfocusSyncControls({ eventId, config, onChanged }: {
  eventId: number;
  config: NonNullable<EventDetail["rainfocusConfig"]>;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<"toggle" | "sync" | null>(null);

  const setAuto = async (autoSync: boolean) => {
    setBusy("toggle");
    try {
      const res = await fetch(`${API_BASE}/sales/events/${eventId}/rainfocus`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSync }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast({ title: "Couldn't change auto-sync", description: data.error, variant: "destructive" }); return; }
      onChanged();
    } finally { setBusy(null); }
  };

  const syncNow = async () => {
    setBusy("sync");
    try {
      const res = await fetch(`${API_BASE}/sales/events/${eventId}/rainfocus/sync`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast({ title: "Sync failed", description: data.error, variant: "destructive" }); return; }
      const parts = [
        data.created ? `${data.created} added` : "",
        data.updated ? `${data.updated} updated` : "",
        data.missing ? `${data.missing} no longer in the catalog` : "",
        data.restored ? `${data.restored} back` : "",
      ].filter(Boolean);
      toast({
        title: parts.length ? `Catalog changed: ${parts.join(", ")}` : "Catalog unchanged",
        description: data.missing
          ? "Sessions that left the catalog are flagged, not deleted — a published agenda may still reference one."
          : `${data.total} sessions checked.`,
      });
      onChanged();
    } finally { setBusy(null); }
  };

  const last = config.lastSyncAt ? new Date(config.lastSyncAt) : null;

  return (
    <div className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
      <div className="flex items-center gap-1.5">
        <Switch
          checked={config.autoSync === true}
          disabled={busy !== null}
          onCheckedChange={(v) => void setAuto(v)}
          aria-label="Auto-sync from RainFocus"
        />
        <span className="text-xs">Auto-sync</span>
      </div>
      <span className="text-[11px] text-muted-foreground">
        {config.lastSyncStatus === "error"
          ? (config.lastSyncMessage ?? "Last sync failed")
          : last
            ? `Checked ${last.toLocaleDateString()}`
            : "Never checked"}
      </span>
      <Button size="sm" variant="ghost" className="h-6 text-xs" disabled={busy !== null} onClick={() => void syncNow()}>
        {busy === "sync" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sync now"}
      </Button>
    </div>
  );
}

/* ── RainFocus import ────────────────────────────────────────────────────
 * Most large conferences run their catalog on RainFocus. The embed's apiToken
 * and widgetId are public (they ship in client-side HTML), so pasting the
 * snippet lets us query the catalog API directly — which returns session type,
 * track, Role and Audience as TYPED fields rather than something a model had
 * to infer from rendered HTML, plus real dates for calendar links.
 */
function RainfocusImportDialog({ open, onClose, onImported, eventId }: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  eventId: number;
}) {
  const [embed, setEmbed] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) { setEmbed(""); setImporting(false); }
  }, [open]);

  // Enough to be worth a round-trip; the server does the real validation.
  const hasToken = /apiToken/i.test(embed);
  const hasWidget = /widgetId/i.test(embed);
  const looksLikeEmbed = hasToken && hasWidget;
  /**
   * Why the button is disabled, in words.
   *
   * The most common paste is the LOADER half of the embed — the <link> and
   * <script src> tags — which contains no credentials at all. Greying the
   * button out without saying that just looks broken.
   */
  const blockedReason = (): string | null => {
    if (!embed.trim()) return null;
    if (looksLikeEmbed) return null;
    if (!hasToken && !hasWidget) {
      return "That's the loader part of the embed (the <link> and <script src> tags). Scroll down in RainFocus to the block that says new Rainfocus.Widget({ apiToken: '…', widgetId: '…' }) and paste that too — or just those two lines.";
    }
    return `Missing ${!hasToken ? "apiToken" : "widgetId"} — paste the whole new Rainfocus.Widget({ … }) block.`;
  };

  const doImport = async () => {
    setImporting(true);
    try {
      const res = await fetch(`${API_BASE}/sales/events/${eventId}/import-rainfocus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Import failed", description: data.error, variant: "destructive" });
        return;
      }
      const roles: string[] = data.vocabulary?.roles ?? [];
      const parts = [
        `${data.created} new, ${data.updated} updated`,
        roles.length ? `Audience roles came through: ${roles.slice(0, 5).join(", ")}${roles.length > 5 ? "…" : ""} — matching will work without hand-tagging.` : "No audience roles on these sessions — add tags or use Suggest role tags.",
        data.skipped ? `${data.skipped} item(s) had no title and were skipped.` : "",
        data.truncated ? "The catalog was larger than one import — re-run to pick up the rest." : "",
      ].filter(Boolean);
      toast({ title: `Imported ${data.extracted} of ${data.total} sessions`, description: parts.join(" ") });
      onImported();
      onClose();
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !importing && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from RainFocus</DialogTitle>
          <DialogDescription>
            Paste the event&rsquo;s RainFocus widget embed. This reads the catalog
            directly, so session types, tracks and audience roles come through as
            real data instead of being guessed — no hand-tagging needed. Re-running
            refreshes times and rooms without duplicating, and keeps tags you&rsquo;ve
            edited here.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Widget embed snippet</Label>
          <Textarea
            value={embed}
            onChange={(e) => setEmbed(e.target.value)}
            placeholder={"<script>\n  window.widget = new Rainfocus.Widget({\n    apiToken: '…',\n    widgetId: '…',\n    env: 'prod'\n  })\n</script>"}
            rows={7}
            className="font-mono text-[11px]"
            disabled={importing}
            autoFocus
          />
          {blockedReason() ? (
            <p className="text-[11px] text-amber-700 leading-relaxed">{blockedReason()}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Use the <strong>session</strong> catalog widget — a speaker-only widget
              has no agenda in it.
            </p>
          )}
          {importing && (
            <p className="text-xs text-muted-foreground pt-1">
              Reading the catalog — a few hundred sessions take a moment. Keep this open.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={importing} onClick={onClose}>Cancel</Button>
          <Button variant="brand" disabled={!looksLikeEmbed || importing} onClick={() => void doImport()}>
            {importing ? "Importing…" : "Import sessions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── new agenda dialog (account typeahead + attendee roles) ──────────────── */

interface AccountResult {
  id: number | null;
  name: string;
  domain?: string | null;
  /** CRM segment, shown as the placeholder so the rep can see the default. */
  segment?: string | null;
  source: string;
}

function NewAgendaDialog({
  open, onClose, eventId, onCreated, roleOptions, segmentOptions, presetAccountId,
}: {
  open: boolean;
  onClose: () => void;
  eventId: number;
  onCreated: (agendaId: number) => void;
  /** Roles this catalog actually tags, most-used first, with session counts. */
  roleOptions: RoleOption[];
  segmentOptions: SegmentOption[];
  /** Account to preselect (the assistant's "build an agenda for X" deep link). */
  presetAccountId?: number | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AccountResult[]>([]);
  const [picked, setPicked] = useState<AccountResult | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState("");
  // Blank = use the account's CRM segment. Set only when the conference names
  // its audiences differently, or the rep knows the attendee is coming as a
  // different persona than the account record says.
  const [segment, setSegment] = useState("");
  const [creating, setCreating] = useState(false);
  // Chips come from the CATALOG's own tags — picking a role that no session
  // carries can only ever return an empty match. Brand personas are a
  // different vocabulary, written by different people.
  const roleSuggestions = roleOptions;

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); setPicked(null); setRoles([]); setRoleInput(""); }
  }, [open]);

  // Resolve a deep-linked account into a real picked row, so the rep sees WHO
  // the agenda is for rather than an id they have to trust.
  useEffect(() => {
    if (!open || presetAccountId == null || picked) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/sales/accounts/${presetAccountId}`);
        if (!res.ok) return;
        const a = await res.json();
        if (cancelled || !a?.id) return;
        setPicked({ id: a.id, name: a.displayName || a.name, domain: a.domain, source: "local" });
      } catch {
        // Fall back to the typeahead — the rep can still pick manually.
      }
    })();
    return () => { cancelled = true; };
  }, [open, presetAccountId, picked]);

  useEffect(() => {
    if (picked || query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/sales/accounts/search?q=${encodeURIComponent(query.trim())}&limit=8`);
        if (!res.ok) return;
        const data = await res.json();
        // Agendas need a local account row — CRM-only matches have no id yet.
        setResults(((data.results ?? []) as AccountResult[]).filter((r) => typeof r.id === "number"));
      } catch {
        /* typeahead is best-effort */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, picked]);

  const addRole = () => {
    const v = roleInput.trim();
    if (v && !roles.includes(v)) setRoles([...roles, v]);
    setRoleInput("");
  };

  const create = async () => {
    if (!picked?.id) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/sales/events/${eventId}/agendas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: picked.id, attendeeRoles: roles, segmentOverride: segment.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      onCreated(data.agenda.id);
      onClose();
    } catch {
      toast({ title: "Couldn't create the agenda", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New account agenda</DialogTitle>
          <DialogDescription>
            Matching proposes sessions from the catalog based on the account's industry and who's attending — you adjust from there.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Account</Label>
            {picked ? (
              <div className="flex items-center justify-between border rounded-md px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{picked.name}</p>
                  {picked.domain && <p className="text-xs text-muted-foreground">{picked.domain}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>Change</Button>
              </div>
            ) : (
              <div className="relative">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search accounts…" autoFocus />
                {results.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full border rounded-md bg-popover shadow-md max-h-56 overflow-y-auto">
                    {results.map((r) => (
                      <button
                        key={`${r.id}`}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                        onClick={() => setPicked(r)}
                      >
                        <span className="font-medium">{r.name}</span>
                        {r.domain && <span className="text-muted-foreground ml-2 text-xs">{r.domain}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Segment</Label>
            {/* A picked list, not free text: segments come from Brand Settings
                plus whatever this catalog's sessions are tagged with, so the
                same vocabulary drives matching everywhere. Add a missing one in
                Brand Settings → Audience segments. */}
            <Select
              value={segment || "__account__"}
              onValueChange={(v) => setSegment(v === "__account__" ? "" : v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Use the account's segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__account__">
                  {picked?.segment ? `Account's segment: ${picked.segment}` : "Use the account's segment"}
                </SelectItem>
                {segmentOptions.map((o) => (
                  <SelectItem key={o.segment} value={o.segment}>
                    {o.segment}{o.count > 0 ? ` · ${o.count} session${o.count === 1 ? "" : "s"}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Sessions for a different segment are left off the draft. Manage the
              list in Brand Settings → Audience segments.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Who's attending (roles)</Label>
            <div className="flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <Badge key={r} variant="secondary" className="cursor-pointer" onClick={() => setRoles(roles.filter((x) => x !== r))}>
                  {r} ×
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRole(); } }}
                placeholder="Add a role and press Enter"
              />
            </div>
            {roleSuggestions.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {roleSuggestions
                    .filter((o) => !roles.some((r) => r.toLowerCase() === o.role.toLowerCase()))
                    .map((o) => (
                      <button
                        key={o.role}
                        type="button"
                        className="text-xs border rounded-full px-2.5 py-0.5 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                        onClick={() => setRoles([...roles, o.role])}
                        title={`${o.count} session${o.count === 1 ? "" : "s"} tagged ${o.role}`}
                      >
                        + {o.role} <span className="tabular-nums opacity-60">{o.count}</span>
                      </button>
                    ))}
                </div>
                <p className="text-[11px] text-muted-foreground pt-1">
                  From this event's session tags — the number is how many sessions carry each role.
                </p>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground pt-0.5">
                No sessions carry audience-role tags yet, so matching will fall back to keynotes and
                untagged sessions. Add roles to a few sessions in the catalog below for sharper picks.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="brand" disabled={!picked || creating} onClick={() => void create()}>
            <Sparkles className="w-4 h-4 mr-1.5" />
            {creating ? "Matching…" : "Build draft agenda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── agenda editor dialog ────────────────────────────────────────────────── */

function AgendaEditorDialog({
  agendaId, onClose, onChanged, sessions, event, segmentOptions,
}: {
  agendaId: number | null;
  onClose: () => void;
  onChanged: () => void;
  sessions: EventSession[];
  event: EventDetail | null;
  segmentOptions: SegmentOption[];
}) {
  const [loading, setLoading] = useState(true);
  const [accountName, setAccountName] = useState("");
  const [selected, setSelected] = useState<Map<number, string>>(new Map()); // sessionId → blurb
  const [scores, setScores] = useState<Map<number, SessionScore>>(new Map());
  const [personalNote, setPersonalNote] = useState("");
  // Conference segment for this agenda. Blank = the account's CRM segment;
  // changing it and hitting Re-match redraws the draft against that audience.
  const [segmentOverride, setSegmentOverride] = useState("");
  const [accountSegment, setAccountSegment] = useState<string | null>(null);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [lpPageId, setLpPageId] = useState<number | null>(null);
  const [busy, setBusy] = useState<"save" | "publish" | "rematch" | "blurbs" | "pdf" | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    if (!agendaId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sales/agendas/${agendaId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAccountName(data.account?.displayName || data.account?.name || data.agenda.accountNameSnapshot || "");
      setSelected(new Map(
        (data.agenda.selections ?? []).map((s: { sessionId: number; blurbOverride?: string }) => [s.sessionId, s.blurbOverride ?? ""]),
      ));
      setScores(new Map((data.scores ?? []).map((s: SessionScore) => [s.sessionId, s])));
      setPersonalNote(data.agenda.personalNote ?? "");
      setSegmentOverride(data.agenda.segmentOverride ?? "");
      setAccountSegment(data.account?.segment ?? null);
      setPageUrl(data.pageUrl ?? null);
      setLpPageId(data.agenda.lpPageId ?? null);
    } catch {
      toast({ title: "Couldn't load the agenda", variant: "destructive" });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (agendaId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendaId]);

  const byDay = useMemo(() => {
    const groups = new Map<string, EventSession[]>();
    for (const s of sessions) {
      const key = s.day ?? "";
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  const persist = async (): Promise<boolean> => {
    if (!agendaId) return false;
    const selections = sessions
      .filter((s) => selected.has(s.id))
      .map((s) => ({ sessionId: s.id, blurbOverride: selected.get(s.id) || undefined }));
    const res = await fetch(`${API_BASE}/sales/agendas/${agendaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections, personalNote, segmentOverride }),
    });
    return res.ok;
  };

  const save = async () => {
    setBusy("save");
    try {
      if (!(await persist())) throw new Error("save failed");
      toast({ title: "Agenda saved" });
      onChanged();
    } catch {
      toast({ title: "Couldn't save the agenda", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (!agendaId) return;
    setBusy("publish");
    try {
      if (!(await persist())) throw new Error("save failed");
      const res = await fetch(`${API_BASE}/sales/agendas/${agendaId}/publish`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPageUrl(data.url);
      setLpPageId(data.pageId ?? null);
      // Tokens that filled vs. tokens left on the page verbatim. A typo like
      // {{compnay}} is deliberately not blanked, so it has to be surfaced or it
      // ships unnoticed. DTR tokens ({{keyword}}, {{city}}) show up here too and
      // are fine — they resolve from the visitor's URL.
      const unfilled: string[] = data.tokens?.unfilled ?? [];
      toast({
        title: "Agenda page published",
        description: unfilled.length
          ? `Heads up — nothing filled in ${unfilled.map((t: string) => `{{${t}}}`).join(", ")}. That's expected for dynamic-text tokens, otherwise check the spelling.`
          : data.tokens?.replaced
            ? `Personalized ${data.tokens.replaced} token${data.tokens.replaced === 1 ? "" : "s"} with the account name.`
            : undefined,
      });
      onChanged();
    } catch {
      toast({ title: "Couldn't publish", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const draftBlurbs = async () => {
    if (!agendaId) return;
    setBusy("blurbs");
    try {
      // Persist the current picks first so the server drafts for exactly what's
      // checked; only sessions without a blurb are filled — edits are kept.
      if (!(await persist())) throw new Error("save failed");
      const res = await fetch(`${API_BASE}/sales/agendas/${agendaId}/generate-blurbs`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't draft blurbs", description: data.error, variant: "destructive" });
        return;
      }
      await load();
      toast({
        title: data.generated > 0 ? `Drafted ${data.generated} blurb${data.generated === 1 ? "" : "s"}` : "Nothing to draft",
        description: data.generated > 0
          ? "Review each line before publishing — they're grounded on synced account facts only."
          : "Every selected session already has a blurb.",
      });
    } catch {
      toast({ title: "Couldn't draft blurbs", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const rematch = async () => {
    // Persist first: re-match reads the stored segment, so running it before
    // saving would silently match against the previous audience.
    await persist();
    if (!agendaId) return;
    setBusy("rematch");
    try {
      const res = await fetch(`${API_BASE}/sales/agendas/${agendaId}/rematch`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
      toast({ title: "Re-matched against the current catalog" });
    } catch {
      toast({ title: "Couldn't re-match", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const copyUrl = async () => {
    if (!pageUrl) return;
    await navigator.clipboard.writeText(`${window.location.origin}${pageUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const exportPdf = async () => {
    setBusy("pdf");
    try {
      // Same grouping as the publish route: picked sessions by day,
      // chronologically (the catalog list is already day/start-time ordered).
      const picked = sessions.filter((s) => selected.has(s.id));
      if (picked.length === 0) return;
      const dayKeys = [...new Set(picked.map((s) => s.day ?? ""))].sort();
      const days = dayKeys.map((dayKey) => ({
        label: formatDay(dayKey || null),
        sessions: picked
          .filter((s) => (s.day ?? "") === dayKey)
          .map((s) => ({
            time: timeLabel(s),
            title: s.title,
            room: s.room ?? "",
            sessionType: s.sessionType ?? "",
            track: s.track ?? "",
            description: s.description ?? "",
            whyAttend: selected.get(s.id) || "",
            speakers: (s.speakers ?? []).map((sp) => ({
              name: sp.name,
              title: [sp.title, sp.org].filter(Boolean).join(", "),
            })),
            isReserved: s.isReservedSlot,
          })),
      }));
      // Lazy import — the PDF module pulls in jsPDF.
      const { exportAgendaPdf } = await import("@/lib/agenda-pdf");
      await exportAgendaPdf({
        eventName: event?.name || "Event",
        eventLocation: event?.location,
        eventDates: formatDateRangeLabel(event?.startDate ?? null, event?.endDate ?? null),
        accountName: accountName || "Your team",
        personalNote,
        days,
      });
    } catch {
      toast({ title: "Couldn't export the PDF", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={agendaId !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agenda — {accountName || "…"}</DialogTitle>
          <DialogDescription>
            Checked sessions make the page. Matched picks show why; add a one-line "why this matters" note to any session to personalize it.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : (
          <div className="space-y-4">
            {pageUrl && (
              <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/40">
                <span className="text-xs font-mono truncate flex-1">{pageUrl}</span>
                <Button variant="ghost" size="sm" onClick={() => void copyUrl()}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <a href={pageUrl} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm"><ExternalLink className="w-3.5 h-3.5" /></Button>
                </a>
                {lpPageId != null && (
                  /* Full page editor — hand-tune the published page (palette,
                     sections, extra blocks). Republish here overwrites blocks,
                     so deep design edits are best made after content is final. */
                  <a href={`/builder/${lpPageId}`} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit in builder
                    </Button>
                  </a>
                )}
              </div>
            )}

            {byDay.map(([dayKey, daySessions]) => (
              <div key={dayKey || "none"}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {formatDay(dayKey || null)}
                </p>
                <div className="space-y-2">
                  {daySessions.map((s) => {
                    const isOn = selected.has(s.id);
                    const score = scores.get(s.id);
                    return (
                      <div key={s.id} className={`border rounded-md px-3 py-2.5 ${isOn ? "border-foreground/30" : "opacity-70"}`}>
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={isOn}
                            onChange={(e) => {
                              const next = new Map(selected);
                              if (e.target.checked) next.set(s.id, next.get(s.id) ?? "");
                              else next.delete(s.id);
                              setSelected(next);
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{s.title}</span>
                              {s.catalogStatus === "missing" && (
                                <Badge variant="destructive" className="text-[10px]" title="RainFocus no longer lists this session — it may have been cancelled or unpublished. Flagged rather than deleted in case an agenda already references it.">
                                  <AlertTriangle className="w-3 h-3 mr-1" />Not in catalog
                                </Badge>
                              )}
                              {s.isReservedSlot && (
                                <Badge variant="secondary" className="text-[10px]"><Pin className="w-3 h-3 mr-1" />Reserved</Badge>
                              )}
                              {score?.excludedBySegment ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-amber-400 text-amber-700"
                                  title={`${score.reasons.join(" · ")} — left off the draft, but you can still add it.`}
                                >
                                  Other segment
                                </Badge>
                              ) : score && score.score > 0 ? (
                                <Badge variant="outline" className="text-[10px]" title={score.reasons.join(" · ")}>
                                  {score.reasons[0] ?? `Score ${score.score}`}{score.reasons.length > 1 ? ` +${score.reasons.length - 1}` : ""}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {[timeLabel(s), s.room, s.sessionType].filter(Boolean).join(" · ")}
                            </p>
                            {isOn && (
                              <Input
                                className="mt-2 h-8 text-xs"
                                placeholder={`Why this matters for ${accountName || "this account"} (optional)`}
                                value={selected.get(s.id) ?? ""}
                                onChange={(e) => setSelected(new Map(selected).set(s.id, e.target.value))}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="space-y-1.5">
              <Label>Segment</Label>
              {/* Same picked list as the create dialog — Brand Settings
                  segments plus this catalog's own tags. */}
              <Select
                value={segmentOverride || "__account__"}
                onValueChange={(v) => setSegmentOverride(v === "__account__" ? "" : v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Use the account's segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__account__">
                    {accountSegment ? `Account's segment: ${accountSegment}` : "Use the account's segment"}
                  </SelectItem>
                  {segmentOptions.map((o) => (
                    <SelectItem key={o.segment} value={o.segment}>
                      {o.segment}{o.count > 0 ? ` · ${o.count} session${o.count === 1 ? "" : "s"}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Sessions for another segment are marked and left off the draft.
                Change this and hit Re-match to redraw against a different audience.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Personal note (shown as a letter at the top of the page)</Label>
              <Textarea rows={3} value={personalNote} onChange={(e) => setPersonalNote(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void rematch()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Re-match
            </Button>
            <Button variant="outline" size="sm" disabled={busy !== null || selected.size === 0} onClick={() => void draftBlurbs()}>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> {busy === "blurbs" ? "Drafting…" : "Draft blurbs with AI"}
            </Button>
            <Button variant="outline" size="sm" disabled={busy !== null || selected.size === 0} onClick={() => void exportPdf()}>
              <FileDown className="w-3.5 h-3.5 mr-1.5" /> {busy === "pdf" ? "Exporting…" : "Export PDF"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy !== null} onClick={() => void save()}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </Button>
            <Button variant="brand" disabled={busy !== null || selected.size === 0} onClick={() => void publish()}>
              {busy === "publish" ? "Publishing…" : pageUrl ? "Republish page" : "Publish page"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── page ────────────────────────────────────────────────────────────────── */

export default function SalesEventDetail() {
  const [, params] = useRoute("/sales/events/:id");
  const [, navigate] = useLocation();
  const eventId = params?.id ? parseInt(params.id, 10) : NaN;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [agendas, setAgendas] = useState<AgendaRow[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [segmentOptions, setSegmentOptions] = useState<SegmentOption[]>([]);
  /**
   * Audience segments from Brand Settings — the tenant's own taxonomy, and the
   * source of truth for what a segment can be. Merged with the catalog's own
   * vocabulary (a conference names its audiences itself, and those names are
   * what the sessions are actually tagged with) so the picker covers both
   * without anyone typing free text.
   */
  const [brandSegments, setBrandSegments] = useState<string[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/lp/brand`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((brand: Record<string, unknown>) => {
        const config = (brand.config ?? brand) as Record<string, unknown>;
        const segs = Array.isArray(config.segments) ? config.segments : [];
        setBrandSegments(
          segs.map((s) => (s as { name?: string })?.name).filter((n): n is string => Boolean(n?.trim())),
        );
      })
      .catch(() => {});
  }, []);
  const [tagging, setTagging] = useState(false);
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<EventSession | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [urlImportOpen, setUrlImportOpen] = useState(false);
  const [rfImportOpen, setRfImportOpen] = useState(false);
  const [newAgendaOpen, setNewAgendaOpen] = useState(false);
  const [editorAgendaId, setEditorAgendaId] = useState<number | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<EventSession | null>(null);
  const [agendaToDelete, setAgendaToDelete] = useState<AgendaRow | null>(null);

  const load = async () => {
    try {
      const [eventRes, agendasRes, analyticsRes] = await Promise.all([
        fetch(`${API_BASE}/sales/events/${eventId}`),
        fetch(`${API_BASE}/sales/events/${eventId}/agendas`),
        fetch(`${API_BASE}/sales/events/${eventId}/analytics`),
      ]);
      if (!eventRes.ok) throw new Error(`HTTP ${eventRes.status}`);
      const eventData = await eventRes.json();
      setEvent(eventData.event);
      setSessions(eventData.sessions ?? []);
      setRoleOptions(eventData.roleOptions ?? []);
      setSegmentOptions(eventData.segmentOptions ?? []);
      if (agendasRes.ok) {
        const agendaData = await agendasRes.json();
        setAgendas(agendaData.agendas ?? []);
      }
      // Analytics are additive — the page works without them.
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
    } catch {
      toast({ title: "Couldn't load the event", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isNaN(eventId)) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  /**
   * `?newAgendaFor=<accountId>` — the Sales Console assistant's deep link for
   * "build an agenda for X". Opens the New-agenda dialog with that account
   * preselected, then strips the param so a refresh doesn't reopen it.
   */
  const [presetAccountId, setPresetAccountId] = useState<number | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("newAgendaFor");
    const id = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(id) || id <= 0) return;
    setPresetAccountId(id);
    setNewAgendaOpen(true);
    params.delete("newAgendaFor");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  /**
   * Ask the AI to infer audience roles for sessions that have none. Seeded
   * with the vocabulary already in use, so suggestions land on the same chips
   * the builder offers rather than inventing a parallel set.
   */
  const suggestTags = async () => {
    setTagging(true);
    try {
      const res = await fetch(`${API_BASE}/sales/events/${eventId}/suggest-tags`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Couldn't suggest tags", description: data.error, variant: "destructive" });
        return;
      }
      await load();
      toast({
        title: data.tagged > 0 ? `Tagged ${data.tagged} session${data.tagged === 1 ? "" : "s"}` : "Nothing to tag",
        description: data.tagged > 0
          ? `${data.leftOpen ?? 0} left open to everyone. Review the tags below — they drive matching.`
          : "Every session already has roles, or they're all open to everyone.",
      });
    } catch {
      toast({ title: "Couldn't suggest tags", variant: "destructive" });
    } finally {
      setTagging(false);
    }
  };

  const deleteSession = async () => {
    if (!sessionToDelete) return;
    const res = await fetch(`${API_BASE}/sales/events/${eventId}/sessions/${sessionToDelete.id}`, { method: "DELETE" });
    if (res.ok) void load();
    else toast({ title: "Couldn't delete the session", variant: "destructive" });
    setSessionToDelete(null);
  };

  const deleteAgenda = async () => {
    if (!agendaToDelete) return;
    const res = await fetch(`${API_BASE}/sales/agendas/${agendaToDelete.id}`, { method: "DELETE" });
    if (res.ok) void load();
    else toast({ title: "Couldn't delete the agenda", variant: "destructive" });
    setAgendaToDelete(null);
  };

  const byDay = useMemo(() => {
    const groups = new Map<string, EventSession[]>();
    for (const s of sessions) {
      const key = s.day ?? "";
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  const agendaStats = useMemo(
    () => new Map((analytics?.agendas ?? []).map((a) => [a.id, a])),
    [analytics],
  );
  const statLine = (agendaId: number): string => {
    const st = agendaStats.get(agendaId);
    if (!st || (st.visits === 0 && st.leads === 0)) return "";
    return ` · ${st.visits} view${st.visits === 1 ? "" : "s"} · ${st.rsvps} RSVP${st.rsvps === 1 ? "" : "s"}`;
  };

  return (
    <SalesLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        <SalesPageHeader
          title={loading ? "Loading…" : event?.name ?? "Event"}
          description={
            event ? (
              <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />{event.startDate ?? "Dates TBD"}{event.endDate && event.endDate !== event.startDate ? ` – ${event.endDate}` : ""}</span>
                {event.location && <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{event.location}</span>}
              </span>
            ) : undefined
          }
          back={{ onClick: () => navigate("/sales/events"), label: "Events" }}
          actions={
            <Button variant="brand" disabled={sessions.length === 0} onClick={() => setNewAgendaOpen(true)}>
              <Sparkles className="w-4 h-4 mr-1.5" /> New account agenda
            </Button>
          }
        />

        {/* Toolbar on its own row — six buttons beside the title crushed it
            into a one-word-per-line column and overlapped the dates/location.
            The three import doors collapse into one menu; the primary action
            stays up in the header. */}
        <div className="flex flex-wrap items-center gap-2 -mt-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Import sessions
                <ChevronDown className="w-3.5 h-3.5 ml-1.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setRfImportOpen(true)}>
                <Zap className="w-4 h-4 mr-2" /> From RainFocus
                <span className="ml-2 text-[10px] text-muted-foreground">best quality</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setUrlImportOpen(true)}>
                <Globe className="w-4 h-4 mr-2" /> From an agenda URL
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCsvOpen(true)}>
                <FileUp className="w-4 h-4 mr-2" /> From a CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-8" onClick={() => { setEditingSession(null); setSessionDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add session
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={sessions.length === 0 || tagging}
            onClick={() => void suggestTags()}
            title="Infer audience roles for untagged sessions"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> {tagging ? "Tagging…" : "Suggest role tags"}
          </Button>
          {event?.rainfocusConfig?.connected && (
            <RainfocusSyncControls
              eventId={eventId}
              config={event.rainfocusConfig}
              onChanged={() => void load()}
            />
          )}
          <AgendaStyleSelect
            eventId={eventId}
            value={event?.styleTemplatePageId}
            agendas={agendas}
            onChanged={() => void load()}
          />
        </div>

        {/* ── Engagement (only once something is published) ── */}
        {analytics && analytics.summary.published > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <BarChart3 className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              Engagement
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { label: "Published pages", value: analytics.summary.published },
                { label: "Page views", value: analytics.summary.visits },
                { label: "Unique visitors", value: analytics.summary.uniqueVisitors },
                { label: "RSVPs", value: analytics.summary.rsvps },
                { label: "Leads", value: analytics.summary.leads },
              ].map((t) => (
                <Card key={t.label} className="px-4 py-3">
                  <p className="text-2xl font-semibold tabular-nums">{t.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.label}</p>
                </Card>
              ))}
            </div>
            {analytics.topSessions.length > 0 && (
              <Card className="px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Most-picked sessions
                </p>
                <ul className="space-y-1.5">
                  {analytics.topSessions.slice(0, 5).map((s) => (
                    <li key={s.sessionId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        {s.title}
                        {s.isReservedSlot && (
                          <Badge variant="secondary" className="ml-2 text-[10px] align-middle">Reserved</Badge>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        on {s.pickCount} agenda{s.pickCount === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
        )}

        {/* ── Agendas ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Account agendas ({agendas.length})
          </h2>
          {agendas.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              No agendas yet. {sessions.length === 0 ? "Import or add the session catalog first, then" : "Pick an account and"} build the first one — matching does the heavy lifting.
            </Card>
          ) : (
            <div className="space-y-2">
              {agendas.map((a) => (
                <Card key={a.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{a.accountName ?? "Unknown account"}</p>
                        <Badge variant={a.status === "published" ? "default" : "secondary"} className="text-[10px]">
                          {a.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.selections.length} session{a.selections.length === 1 ? "" : "s"}
                        {a.attendeeRoles.length > 0 ? ` · ${a.attendeeRoles.join(", ")}` : ""}
                        {statLine(a.id)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {a.pageUrl && (
                        <a href={a.pageUrl} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="sm"><ExternalLink className="w-3.5 h-3.5" /></Button>
                        </a>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setEditorAgendaId(a.id)}>
                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setAgendaToDelete(a)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── Session catalog ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarDays className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Session catalog ({sessions.length})
          </h2>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : sessions.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="font-medium">No sessions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Import the conference CSV or add sessions by hand. Tag each with audience roles so matching has something to work with.
              </p>
            </Card>
          ) : (
            byDay.map(([dayKey, daySessions]) => (
              <div key={dayKey || "none"} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground pt-1">{formatDay(dayKey || null)}</p>
                {daySessions.map((s) => (
                  <Card key={s.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium truncate">{s.title}</p>
                          {s.catalogStatus === "missing" && (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                              title={`RainFocus no longer lists this session${s.missingSince ? ` (since ${new Date(s.missingSince).toLocaleDateString()})` : ""}. Flagged rather than deleted — a published agenda may already reference it.`}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" />Not in catalog
                            </Badge>
                          )}
                          {s.isReservedSlot && (
                            <Badge variant="secondary" className="text-[10px]"><Pin className="w-3 h-3 mr-1" />Reserved</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[timeLabel(s), s.room, s.sessionType, s.track].filter(Boolean).join(" · ")}
                        </p>
                        {(s.tags?.roles?.length || s.tags?.industries?.length) ? (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(s.tags.roles ?? []).map((r) => (
                              <span key={`r-${r}`} className="text-[10px] border rounded-full px-2 py-0.5 text-muted-foreground">{r}</span>
                            ))}
                            {(s.tags.industries ?? []).map((r) => (
                              <span key={`i-${r}`} className="text-[10px] border rounded-full px-2 py-0.5 text-muted-foreground bg-muted/50">{r}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingSession(s); setSessionDialogOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSessionToDelete(s)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ))
          )}
        </section>
      </div>

      <SessionDialog
        open={sessionDialogOpen}
        onClose={() => setSessionDialogOpen(false)}
        onSaved={() => void load()}
        eventId={eventId}
        editing={editingSession}
      />
      <CsvImportDialog open={csvOpen} onClose={() => setCsvOpen(false)} onImported={() => void load()} eventId={eventId} />
      <UrlImportDialog open={urlImportOpen} onClose={() => setUrlImportOpen(false)} onImported={() => void load()} eventId={eventId} />
      <RainfocusImportDialog open={rfImportOpen} onClose={() => setRfImportOpen(false)} onImported={() => void load()} eventId={eventId} />
      <NewAgendaDialog
        open={newAgendaOpen}
        onClose={() => { setNewAgendaOpen(false); setPresetAccountId(null); }}
        presetAccountId={presetAccountId}
        eventId={eventId}
        onCreated={(id) => { void load(); setEditorAgendaId(id); }}
        roleOptions={roleOptions}
        segmentOptions={mergeSegmentOptions(segmentOptions, brandSegments)}
      />
      <AgendaEditorDialog
        segmentOptions={mergeSegmentOptions(segmentOptions, brandSegments)}
        agendaId={editorAgendaId}
        onClose={() => setEditorAgendaId(null)}
        onChanged={() => void load()}
        sessions={sessions}
        event={event}
      />
      <ConfirmDialog
        open={sessionToDelete !== null}
        onOpenChange={(v) => !v && setSessionToDelete(null)}
        title="Delete this session?"
        description={`"${sessionToDelete?.title ?? ""}" will be removed from the catalog. Published agenda pages keep their content until republished.`}
        confirmLabel="Delete"
        onConfirm={() => void deleteSession()}
      />
      <ConfirmDialog
        open={agendaToDelete !== null}
        onOpenChange={(v) => !v && setAgendaToDelete(null)}
        title="Delete this agenda?"
        description={`The draft for ${agendaToDelete?.accountName ?? "this account"} will be removed. The published page (if any) stays live until you delete it from Pages.`}
        confirmLabel="Delete"
        onConfirm={() => void deleteAgenda()}
      />
    </SalesLayout>
  );
}
