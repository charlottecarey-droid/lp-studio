import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, ArrowUp, ArrowDown, Pin, Eye, EyeOff, Download, RefreshCw, Users, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import { FontSelect } from "@/components/FontSelect";
import { suggestCopy } from "@/lib/copy-api";
import { episodeSlug } from "@/blocks/BlockContentSeries";
import { ModalFormSourcePanel } from "./ModalFormSourcePanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  ContentSeriesBlockProps,
  ContentSeriesTheme,
  ContentSeriesEpisode,
  ContentSeriesHost,
  ContentSeriesCta,
  ContentSeriesNavLink,
  EpisodeStatus,
} from "@/lib/block-types";
import type { FormStep, FormField, FormFieldType } from "@/lib/block-types";

const THEME_DEFAULTS: Required<ContentSeriesTheme> = {
  bg: "#0c0f12",
  cardBg: "#141619",
  fg: "#eeeae3",
  headingColor: "#eeeae3",
  primary: "#b59a6e",
  muted: "#7a8088",
  border: "#262a2f",
  navBg: "#0c0f12",
  navBgOpacity: 0.6,
  navText: "#eeeae3",
  displayFontFamily: "EB Garamond",
  bodyFontFamily: "Inter",
};

function ColorRow({ label, value, fallback, onChange }: { label: string; value: string | undefined; fallback: string; onChange: (v: string) => void }) {
  const v = (value && value.trim()) || fallback;
  return (
    <div className="flex items-center gap-1.5">
      <Input type="color" value={v} onChange={e => onChange(e.target.value)} className="h-6 w-7 p-0.5 cursor-pointer shrink-0 rounded" />
      <Label className="text-xs min-w-0 truncate shrink-0" style={{ maxWidth: "5rem" }}>{label}</Label>
      <Input value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={fallback} className="text-[11px] h-6 flex-1 font-mono min-w-0" />
      <BrandSwatches className="shrink-0 flex-nowrap" current={value} onPick={onChange} />
    </div>
  );
}

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border hover:text-foreground transition-colors"
    >
      {label}
      {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
    </button>
  );
}

function RssSyncControls({ p, set }: { p: ContentSeriesBlockProps; set: (patch: Partial<ContentSeriesBlockProps>) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const merge = (parsed: Array<{ guid?: string; title: string; description: string; publishDate?: string; audioUrl?: string; thumbnailUrl?: string }>) => {
    const existing = p.episodes ?? [];
    const byGuid = new Map<string, number>();
    const byUrl = new Map<string, number>();
    existing.forEach((ep, i) => {
      if (ep.rssGuid) byGuid.set(ep.rssGuid, i);
      if (ep.ctaUrl) byUrl.set(ep.ctaUrl, i);
    });
    const next = [...existing];
    let added = 0;
    let updated = 0;
    for (const item of parsed) {
      let idx = -1;
      if (item.guid && byGuid.has(item.guid)) idx = byGuid.get(item.guid)!;
      else if (item.audioUrl && byUrl.has(item.audioUrl)) idx = byUrl.get(item.audioUrl)!;
      if (idx >= 0) {
        const cur = next[idx];
        next[idx] = {
          ...cur,
          title: cur.title || item.title,
          description: cur.description || item.description,
          publishDate: cur.publishDate || item.publishDate || cur.publishDate,
          thumbnailUrl: cur.thumbnailUrl || item.thumbnailUrl,
          ctaUrl: cur.ctaUrl || item.audioUrl || "#",
          rssGuid: cur.rssGuid ?? item.guid,
        };
        updated += 1;
      } else {
        next.push({
          title: item.title,
          description: item.description,
          publishDate: item.publishDate ?? new Date().toISOString(),
          thumbnailUrl: item.thumbnailUrl,
          ctaUrl: item.audioUrl ?? p.rssFeedUrl ?? "#",
          ctaText: "Listen Now",
          rssGuid: item.guid,
          status: "on-demand",
        });
        added += 1;
      }
    }
    set({ episodes: next, rssLastSyncedAt: new Date().toISOString() });
    setInfo(`${added} new, ${updated} updated, ${parsed.length} in feed`);
  };

  // Podcast feeds carry no structured guest field — the guest's name only lives
  // in the episode title/description prose. This asks the server to read that
  // prose with AI and fill the per-episode guest fields (which drive the hero
  // when a visitor lands via ?episode=<slug>). Only episodes that are missing a
  // guest name are touched, so manually-entered guests are never overwritten.
  const handleExtractGuests = async () => {
    setError(null);
    setInfo(null);
    const all = p.episodes ?? [];
    const targets = all
      .map((ep, idx) => ({ ep, idx }))
      .filter(({ ep }) => !(ep.guestName && ep.guestName.trim()));
    if (targets.length === 0) {
      setInfo("Every episode already has a guest name.");
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch("/api/lp/rss/extract-guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodes: targets.map(({ ep }) => ({
            title: ep.title ?? "",
            description: ep.description ?? "",
          })),
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        guests?: Array<{ guestName?: string; guestTitle?: string; guestCompany?: string }>;
        error?: string;
      };
      if (!resp.ok) {
        setError(data.error ?? `Extraction failed (${resp.status})`);
        return;
      }
      const guests = data.guests ?? [];
      const next = [...all];
      let filled = 0;
      targets.forEach(({ idx }, i) => {
        const g = guests[i];
        if (!g || !g.guestName) return;
        // Only fill blank fields — never overwrite a manually-entered title or
        // company (these episodes were selected because guestName was blank, but
        // title/company may already have been typed by hand).
        next[idx] = {
          ...next[idx],
          guestName: g.guestName,
          guestTitle: next[idx].guestTitle?.trim() ? next[idx].guestTitle : g.guestTitle,
          guestCompany: next[idx].guestCompany?.trim() ? next[idx].guestCompany : g.guestCompany,
        };
        filled += 1;
      });
      if (filled === 0) {
        setInfo("No guest names could be found in the episode descriptions.");
        return;
      }
      set({ episodes: next });
      setInfo(`Filled guests for ${filled} of ${targets.length} episode${targets.length === 1 ? "" : "s"}. Review, then publish.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setError(null);
    setInfo(null);
    if (!p.rssFeedUrl) {
      setError("Add an RSS Feed URL above first.");
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch("/api/lp/rss/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: p.rssFeedUrl }),
      });
      const data = await resp.json().catch(() => ({})) as { episodes?: Array<{ guid?: string; title: string; description: string; publishDate?: string; audioUrl?: string; thumbnailUrl?: string }>; error?: string };
      if (!resp.ok) {
        setError(data.error ?? `Sync failed (${resp.status})`);
        return;
      }
      if (!data.episodes || data.episodes.length === 0) {
        setError("Feed parsed but contained no episodes.");
        return;
      }
      merge(data.episodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  const lastSynced = p.rssLastSyncedAt ? new Date(p.rssLastSyncedAt).toLocaleString() : null;

  return (
    <div className="space-y-2 border border-border rounded-md p-2.5 bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">RSS Episode Sync</Label>
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy || !(p.episodes && p.episodes.length)} onClick={handleExtractGuests} title="Use AI to read each episode's description and fill in missing guest name, title, and company.">
            {busy ? "Working…" : "Extract guests"}
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy || !p.rssFeedUrl} onClick={handleSync}>
            {busy ? "Syncing…" : "Sync now"}
          </Button>
        </div>
      </div>
      <label className="flex items-start gap-2 text-[11px] text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={!!p.rssAutoSync}
          onChange={e => set({ rssAutoSync: e.target.checked || undefined })}
        />
        <span>
          <span className="font-medium text-foreground">Auto-sync on page load.</span> Visitors always see the latest episodes from your feed without you re-publishing. Manual edits to existing episodes are kept.
        </span>
      </label>
      {info && <p className="text-[11px] text-emerald-600">{info}</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {lastSynced && !info && !error && (
        <p className="text-[11px] text-muted-foreground">Last manual sync: {lastSynced}</p>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Header row + a few upcoming-weekday example rows matching exactly what the
// /api/lp/podcast-availability parser expects (reads columns C:E — Status,
// Date, Time Range — so columns A & B are filler so Status lands in column C).
const SCHEDULING_TEMPLATE_HEADERS = ["Notes (optional)", "Guest (optional)", "Status", "Date", "Time Range"];

function buildSampleAvailabilityRows(): string[][] {
  const rows: string[][] = [];
  const ranges = ["10:00 AM - 11:00 AM", "1:00 PM - 4:00 PM", "9:00 AM - 12:00 PM", "2:00 PM - 3:00 PM"];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 7);
  let added = 0;
  while (added < ranges.length) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      rows.push(["", "", "OPEN", iso, ranges[added]]);
      added++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
}

function toCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [headers, ...rows].map(r => r.map(esc).join(",")).join("\r\n");
}

function SchedulingTemplate() {
  const [copied, setCopied] = useState(false);
  const rows = buildSampleAvailabilityRows();
  const csv = toCsv(SCHEDULING_TEMPLATE_HEADERS, rows);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — download is still offered */
    }
  };

  const handleDownload = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recording-availability-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded border border-border bg-muted/30 p-2.5 space-y-2">
      <p className="text-[11px] font-semibold text-foreground">How to set up your availability sheet</p>
      <ol className="text-[11px] text-muted-foreground leading-snug space-y-1 list-decimal pl-4">
        <li>Create a Google Sheet and choose a tab. Its name must match the <span className="font-medium text-foreground">Sheet Tab</span> field below (defaults to <code className="font-mono">Scheduled</code>).</li>
        <li>Use row 1 for headers; put your slots from row 2 down in these columns:
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li><span className="font-medium text-foreground">Column C — Status:</span> type <code className="font-mono">OPEN</code> for any slot you want bookable. Anything else is ignored.</li>
            <li><span className="font-medium text-foreground">Column D — Date:</span> <code className="font-mono">YYYY-MM-DD</code> or <code className="font-mono">M/D/YYYY</code>. Past dates are skipped automatically.</li>
            <li><span className="font-medium text-foreground">Column E — Time Range:</span> e.g. <code className="font-mono">10:00 AM - 11:00 AM</code>. Ranges longer than 1 hour split into hourly slots.</li>
          </ul>
        </li>
        <li>Share the sheet so the Google account connected to this workspace can read it.</li>
        <li>Copy the Sheet ID from the URL — <code className="font-mono break-all">/spreadsheets/d/&lt;ID&gt;/edit</code> — into the field below.</li>
      </ol>
      <div className="rounded bg-background border border-border/60 p-1.5 overflow-x-auto">
        <table className="text-[10px] font-mono border-collapse">
          <thead>
            <tr className="text-muted-foreground">
              {["A", "B", "C", "D", "E"].map(c => (
                <th key={c} className="text-left font-normal px-1.5 pb-0.5 border-b border-border/60">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-foreground">
            <tr className="text-muted-foreground">
              {SCHEDULING_TEMPLATE_HEADERS.map((h, i) => (
                <td key={i} className="px-1.5 py-0.5 whitespace-nowrap">{h}</td>
              ))}
            </tr>
            {rows.slice(0, 3).map((r, ri) => (
              <tr key={ri}>
                {r.map((cell, ci) => (
                  <td key={ci} className="px-1.5 py-0.5 whitespace-nowrap">{cell || "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-1.5">
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px] flex-1" onClick={handleCopy}>
          {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
          {copied ? "Copied" : "Copy sample layout"}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px] flex-1" onClick={handleDownload}>
          <Download className="w-3 h-3 mr-1" /> Download CSV
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">Paste the copied rows into cell A1 of your sheet (or import the CSV) — Status lands in column C automatically.</p>
    </div>
  );
}

interface Props {
  props: ContentSeriesBlockProps;
  onChange: (props: ContentSeriesBlockProps) => void;
  brandVoiceSet?: boolean;
  /** Current page id — required for the "Notify subscribers" feature. */
  pageId?: number;
}

const slugifyEpisodeKey = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const episodeKeyOf = (ep: ContentSeriesEpisode) =>
  (ep.slug?.trim() || ep.rssGuid?.trim() || slugifyEpisodeKey(ep.title ?? ""));

interface SubscriberRow {
  email: string;
  subscribedAt: string | null;
  optedOut: boolean;
}

export function ContentSeriesPanel({ props: p, onChange, brandVoiceSet, pageId }: Props) {
  const [notifyBusy, setNotifyBusy] = useState<Record<string, boolean>>({});
  const [notifyMsg, setNotifyMsg] = useState<Record<string, string>>({});

  const [subsLoading, setSubsLoading] = useState(false);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [subsLoaded, setSubsLoaded] = useState(false);
  const [subscribers, setSubscribers] = useState<SubscriberRow[]>([]);
  const [subsExporting, setSubsExporting] = useState(false);

  const loadSubscribers = async () => {
    if (pageId == null) return;
    setSubsLoading(true);
    setSubsError(null);
    try {
      const res = await fetch(`/api/lp/content-series/subscribers?pageId=${pageId}`);
      if (!res.ok) throw new Error("load");
      const data = (await res.json()) as { subscribers?: SubscriberRow[] };
      setSubscribers(data.subscribers ?? []);
      setSubsLoaded(true);
    } catch {
      setSubsError("Couldn't load subscribers — try again.");
    } finally {
      setSubsLoading(false);
    }
  };

  const exportSubscribersCsv = async () => {
    if (pageId == null) return;
    setSubsExporting(true);
    setSubsError(null);
    try {
      const res = await fetch(`/api/lp/content-series/subscribers.csv?pageId=${pageId}`);
      if (!res.ok) throw new Error("export");
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] || `content-series-subscribers-${pageId}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setSubsError("Export failed — try again.");
    } finally {
      setSubsExporting(false);
    }
  };

  const handleNotify = async (ep: ContentSeriesEpisode) => {
    if (pageId == null) return;
    const key = episodeKeyOf(ep);
    if (!key) return;
    setNotifyBusy(b => ({ ...b, [key]: true }));
    setNotifyMsg(m => ({ ...m, [key]: "" }));
    try {
      const statusRes = await fetch(
        `/api/lp/content-series/notify-status?pageId=${pageId}&episodeKey=${encodeURIComponent(key)}`,
      );
      if (!statusRes.ok) throw new Error("status");
      const status = (await statusRes.json()) as {
        totalSubscribers: number; optedOut: number; alreadyNotified: number; pending: number;
      };
      if (status.pending === 0) {
        setNotifyMsg(m => ({
          ...m,
          [key]: status.totalSubscribers === 0
            ? "No subscribers yet."
            : `Everyone's already been notified (${status.alreadyNotified} sent${status.optedOut ? `, ${status.optedOut} opted out` : ""}).`,
        }));
        return;
      }
      const ok = window.confirm(
        `Email ${status.pending} subscriber${status.pending === 1 ? "" : "s"} about “${ep.title}”?` +
          (status.alreadyNotified ? ` ${status.alreadyNotified} already notified.` : "") +
          (status.optedOut ? ` ${status.optedOut} opted out.` : ""),
      );
      if (!ok) return;
      const res = await fetch(`/api/lp/content-series/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, episodeKey: key }),
      });
      if (!res.ok) throw new Error("notify");
      const r = (await res.json()) as { sent: number; failed: number; alreadyNotified: number };
      setNotifyMsg(m => ({ ...m, [key]: `Sent ${r.sent}${r.failed ? `, ${r.failed} failed` : ""}.` }));
    } catch {
      setNotifyMsg(m => ({ ...m, [key]: "Failed — try again." }));
    } finally {
      setNotifyBusy(b => ({ ...b, [key]: false }));
    }
  };

  const [open, setOpen] = useState<Record<string, boolean>>({
    visibility: false,
    theme: false,
    hero: true,
    episodes: false,
    hosts: false,
    about: false,
    form: false,
    subscribe: false,
    cta: false,
    nav: false,
  });
  const [openEpisodes, setOpenEpisodes] = useState<Record<number, boolean>>({});

  const toggle = (key: string) => setOpen(s => ({ ...s, [key]: !s[key] }));
  const set = (patch: Partial<ContentSeriesBlockProps>) => onChange({ ...p, ...patch });

  const theme: ContentSeriesTheme = p.theme ?? {};
  const setTheme = (patch: Partial<ContentSeriesTheme>) => set({ theme: { ...theme, ...patch } });
  const resetTheme = () => set({ theme: { ...THEME_DEFAULTS } });

  const episodes = p.episodes ?? [];
  const updateEpisode = (i: number, patch: Partial<ContentSeriesEpisode>) => {
    const next = episodes.map((ep, idx) => idx === i ? { ...ep, ...patch } : ep);
    set({ episodes: next });
  };
  const addEpisode = () => set({
    episodes: [...episodes, { title: "New Episode", guestName: "", description: "", publishDate: new Date().toISOString().split("T")[0], ctaUrl: "#", isFeatured: false, status: "on-demand" as EpisodeStatus }],
  });
  const removeEpisode = (i: number) => set({ episodes: episodes.filter((_, idx) => idx !== i) });
  const moveEpisode = (from: number, to: number) => {
    if (to < 0 || to >= episodes.length) return;
    const next = [...episodes];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set({ episodes: next });
  };
  const pinEpisodeAsHero = (i: number) => {
    const next = episodes.map((ep, idx) => ({ ...ep, pinHero: idx === i }));
    set({ episodes: next, heroSourceMode: "auto" as const });
  };
  const unpinAllHeroes = () => {
    const next = episodes.map(ep => ({ ...ep, pinHero: false }));
    set({ episodes: next });
  };

  const hosts = p.hosts ?? [];
  const updateHost = (i: number, patch: Partial<ContentSeriesHost>) => {
    const next = hosts.map((h, idx) => idx === i ? { ...h, ...patch } : h);
    set({ hosts: next });
  };
  const addHost = () => set({ hosts: [...hosts, { name: "New Host", title: "Host", bio: "" }] });
  const removeHost = (i: number) => set({ hosts: hosts.filter((_, idx) => idx !== i) });

  const ctas = p.ctas ?? [];
  const updateCta = (i: number, patch: Partial<ContentSeriesCta>) => {
    const next = ctas.map((c, idx) => idx === i ? { ...c, ...patch } : c);
    set({ ctas: next });
  };
  const addCta = () => set({ ctas: [...ctas, { label: "New CTA", url: "#", variant: "outline" }] });
  const removeCta = (i: number) => set({ ctas: ctas.filter((_, idx) => idx !== i) });

  const navLinks = p.navLinks ?? [];
  const updateNavLink = (i: number, patch: Partial<ContentSeriesNavLink>) => {
    const next = navLinks.map((l, idx) => idx === i ? { ...l, ...patch } : l);
    set({ navLinks: next });
  };
  const addNavLink = () => set({ navLinks: [...navLinks, { label: "Section", href: "#section" }] });
  const removeNavLink = (i: number) => set({ navLinks: navLinks.filter((_, idx) => idx !== i) });

  const topics = p.aboutTopics ?? [];
  const updateTopic = (i: number, value: string) => {
    const next = topics.map((t, idx) => idx === i ? value : t);
    set({ aboutTopics: next });
  };
  const addTopic = () => set({ aboutTopics: [...topics, ""] });
  const removeTopic = (i: number) => set({ aboutTopics: topics.filter((_, idx) => idx !== i) });

  const formSteps = p.formSteps ?? [];
  const updateFormStep = (si: number, patch: Partial<FormStep>) =>
    set({ formSteps: formSteps.map((s, idx) => idx === si ? { ...s, ...patch } : s) });
  const addFormStep = () =>
    set({ formSteps: [...formSteps, { title: "New Step", fields: [] }] });
  const removeFormStep = (si: number) =>
    set({ formSteps: formSteps.filter((_, idx) => idx !== si) });

  const updateFormField = (si: number, fi: number, patch: Partial<FormField>) => {
    const steps = formSteps.map((s, idx) =>
      idx === si ? { ...s, fields: (s.fields ?? []).map((f, fidx) => fidx === fi ? { ...f, ...patch } : f) } : s
    );
    set({ formSteps: steps });
  };
  const addFormField = (si: number) => {
    const newField: FormField = { id: `field_${Date.now()}`, type: "text", label: "New Field", placeholder: "", required: false };
    set({ formSteps: formSteps.map((s, idx) => idx === si ? { ...s, fields: [...(s.fields ?? []), newField] } : s) });
  };
  const removeFormField = (si: number, fi: number) => {
    set({ formSteps: formSteps.map((s, idx) => idx === si ? { ...s, fields: (s.fields ?? []).filter((_, fidx) => fidx !== fi) } : s) });
  };

  // Subscribe-modal form (separate from the guest application form above).
  const subscribeFormSteps = p.subscribeFormSteps ?? [];
  const updateSubscribeStep = (si: number, patch: Partial<FormStep>) =>
    set({ subscribeFormSteps: subscribeFormSteps.map((s, idx) => idx === si ? { ...s, ...patch } : s) });
  const addSubscribeStep = () =>
    set({ subscribeFormSteps: [...subscribeFormSteps, { title: "New Step", fields: [] }] });
  const removeSubscribeStep = (si: number) =>
    set({ subscribeFormSteps: subscribeFormSteps.filter((_, idx) => idx !== si) });
  const updateSubscribeField = (si: number, fi: number, patch: Partial<FormField>) => {
    const steps = subscribeFormSteps.map((s, idx) =>
      idx === si ? { ...s, fields: (s.fields ?? []).map((f, fidx) => fidx === fi ? { ...f, ...patch } : f) } : s
    );
    set({ subscribeFormSteps: steps });
  };
  const addSubscribeField = (si: number) => {
    const newField: FormField = { id: `field_${Date.now()}`, type: "text", label: "New Field", placeholder: "", required: false };
    set({ subscribeFormSteps: subscribeFormSteps.map((s, idx) => idx === si ? { ...s, fields: [...(s.fields ?? []), newField] } : s) });
  };
  const removeSubscribeField = (si: number, fi: number) => {
    set({ subscribeFormSteps: subscribeFormSteps.map((s, idx) => idx === si ? { ...s, fields: (s.fields ?? []).filter((_, fidx) => fidx !== fi) } : s) });
  };

  return (
    <div className="space-y-0 p-4">
      <BlockRefreshButton
        blockType="content-series"
        fields={["seriesTitle", "seriesSubtitle"]}
        values={{ seriesTitle: p.seriesTitle, seriesSubtitle: p.seriesSubtitle ?? "" }}
        onApply={(u) => set(u)}
      />

      {/* ── Series Type ──────────────────────────────────────────────────── */}
      <div className="pb-3 space-y-2">
        <Field label="Series Type" hint="Changes default labels and icons">
          <Select value={p.seriesType} onValueChange={(v) => set({ seriesType: v as ContentSeriesBlockProps["seriesType"] })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="podcast">Podcast</SelectItem>
              <SelectItem value="webinar">Webinar</SelectItem>
              <SelectItem value="series">Video Series</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Series Title">
          <AiTextField type="input" value={p.seriesTitle} onChange={v => set({ seriesTitle: v })} fieldLabel="Series Title" brandVoiceSet={brandVoiceSet}
            onSuggest={() => suggestCopy("content-series", "seriesTitle", p.seriesTitle, {})} />
        </Field>
        <Field label="Subtitle">
          <AiTextField type="textarea" value={p.seriesSubtitle ?? ""} onChange={v => set({ seriesSubtitle: v })} rows={2} fieldLabel="Subtitle" brandVoiceSet={brandVoiceSet}
            onSuggest={() => suggestCopy("content-series", "seriesSubtitle", p.seriesSubtitle ?? "", {})} />
        </Field>
        <Field label="Logo URL" hint="Leave blank for text + icon in nav">
          <ImagePicker value={p.logoUrl ?? ""} onChange={v => set({ logoUrl: v || undefined })} />
        </Field>
        <Field label="RSS Feed URL" hint="Paste your podcast RSS URL. Used for the public 'RSS' button and (optionally) live episode sync.">
          <Input value={p.rssFeedUrl ?? ""} onChange={e => set({ rssFeedUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="https://…" />
        </Field>
        <RssSyncControls p={p} set={set} />
      </div>

      {/* ── Theme & Style ────────────────────────────────────────────────── */}
      <SectionHeader label="Theme & Style" open={open.theme} onToggle={() => toggle("theme")} />
      {open.theme && (
        <div className="space-y-2 pt-3 pb-4">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Fonts</Label>
          <Field label="Heading Font" hint="Headlines and display text">
            <FontSelect
              value={theme.displayFontFamily}
              onChange={(v) => setTheme({ displayFontFamily: v ?? THEME_DEFAULTS.displayFontFamily })}
              inheritLabel={`Default (${THEME_DEFAULTS.displayFontFamily})`}
            />
          </Field>
          <Field label="Body Font" hint="Paragraphs, nav, buttons, form fields">
            <FontSelect
              value={theme.bodyFontFamily}
              onChange={(v) => setTheme({ bodyFontFamily: v ?? THEME_DEFAULTS.bodyFontFamily })}
              inheritLabel={`Default (${THEME_DEFAULTS.bodyFontFamily})`}
            />
          </Field>

          <div className="border-t border-border pt-2 mt-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Page Colors</Label>
            <div className="space-y-1">
              <ColorRow label="Background" value={theme.bg} fallback={THEME_DEFAULTS.bg} onChange={v => setTheme({ bg: v })} />
              <ColorRow label="Card BG" value={theme.cardBg} fallback={THEME_DEFAULTS.cardBg} onChange={v => setTheme({ cardBg: v })} />
              <ColorRow label="Text" value={theme.fg} fallback={THEME_DEFAULTS.fg} onChange={v => setTheme({ fg: v })} />
              <ColorRow label="Headings" value={theme.headingColor} fallback={THEME_DEFAULTS.headingColor} onChange={v => setTheme({ headingColor: v })} />
              <ColorRow label="Accent" value={theme.primary} fallback={THEME_DEFAULTS.primary} onChange={v => setTheme({ primary: v })} />
              <ColorRow label="Muted" value={theme.muted} fallback={THEME_DEFAULTS.muted} onChange={v => setTheme({ muted: v })} />
              <ColorRow label="Border" value={theme.border} fallback={THEME_DEFAULTS.border} onChange={v => setTheme({ border: v })} />
            </div>
          </div>

          <div className="border-t border-border pt-2 mt-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Nav Bar</Label>
            <div className="space-y-1">
              <ColorRow label="Nav BG" value={theme.navBg} fallback={THEME_DEFAULTS.navBg} onChange={v => setTheme({ navBg: v })} />
              <ColorRow label="Nav Text" value={theme.navText} fallback={THEME_DEFAULTS.navText} onChange={v => setTheme({ navText: v })} />
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <Label className="text-[11px] shrink-0">Opacity {Math.round(((theme.navBgOpacity ?? THEME_DEFAULTS.navBgOpacity) as number) * 100)}%</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(((theme.navBgOpacity ?? THEME_DEFAULTS.navBgOpacity) as number) * 100)}
                onChange={e => setTheme({ navBgOpacity: Number(e.target.value) / 100 })}
                className="flex-1 h-4"
              />
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] w-full mt-1" onClick={resetTheme}>
            Reset to defaults
          </Button>
        </div>
      )}

      {/* ── Section Visibility ─────────────────────────────────────────── */}
      <SectionHeader label="Section Visibility" open={open.visibility} onToggle={() => toggle("visibility")} />
      {open.visibility && (
        <div className="space-y-1 pt-3 pb-4">
          <p className="text-[11px] text-muted-foreground mb-2">Toggle sections on or off. Hidden sections won't render on the page.</p>
          {([
            ["showNav", "Navigation Bar"],
            ["showHero", "Hero"],
            ["showEpisodes", "Episodes"],
            ["showHosts", "Hosts / Guests"],
            ["showAbout", "About"],
            ["showForm", "Form / Apply"],
            ["showCta", "CTA Section"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => set({ [key]: !(p[key] !== false) })}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                p[key] !== false
                  ? "bg-primary/10 text-foreground"
                  : "bg-muted/30 text-muted-foreground line-through"
              }`}
            >
              {p[key] !== false ? <Eye className="w-3.5 h-3.5 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <SectionHeader label="Hero" open={open.hero} onToggle={() => toggle("hero")} />
      {open.hero && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Hero Layout" hint="Controls how the hero image is displayed">
            <Select value={p.heroLayout ?? "half-bleed"} onValueChange={(v) => set({ heroLayout: v as ContentSeriesBlockProps["heroLayout"] })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full-bleed">Full Bleed (immersive bg)</SelectItem>
                <SelectItem value="half-bleed">Half Bleed (split layout)</SelectItem>
                <SelectItem value="text-only">Text Only (no image)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {(p.heroLayout === "full-bleed") && (
            <>
              <div className="flex items-center gap-2">
                <Label className="text-[11px] shrink-0">Overlay {Math.round((p.heroOverlayOpacity ?? 0.7) * 100)}%</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((p.heroOverlayOpacity ?? 0.7) * 100)}
                  onChange={e => set({ heroOverlayOpacity: Number(e.target.value) / 100 })}
                  className="flex-1 h-4"
                />
              </div>
              <Field label="Full-Bleed Hero Background Image" hint="Optional. When set, this image is used as the hero background instead of the featured episode thumbnail, and the featured episode card is hidden so the hero shows just the series title.">
                <ImagePicker value={p.heroBackgroundImageUrl ?? ""} onChange={v => set({ heroBackgroundImageUrl: v || undefined })} />
                {p.heroBackgroundImageUrl && (
                  <button
                    type="button"
                    onClick={() => set({ heroBackgroundImageUrl: undefined })}
                    className="mt-1 text-[11px] text-muted-foreground hover:text-foreground underline"
                  >
                    Clear (use featured episode image instead)
                  </button>
                )}
              </Field>
            </>
          )}
          <Field label="Hero Source" hint="Auto fills hero from newest (or pinned) episode. Manual lets you edit hero fields directly.">
            <Select value={p.heroSourceMode ?? "auto"} onValueChange={(v) => set({ heroSourceMode: v as "auto" | "manual" })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (from episodes)</SelectItem>
                <SelectItem value="manual">Manual (edit below)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {(p.heroSourceMode ?? "auto") === "auto" && (
            <p className="text-[11px] text-muted-foreground bg-muted/30 rounded p-2">
              Hero is auto-populated from {episodes.some(ep => ep.pinHero) ? "the pinned episode" : "the newest visible episode"}. Switch to Manual to edit hero fields directly, or pin an episode in the Episodes section below.
            </p>
          )}
          {(p.heroSourceMode === "manual") && (
            <>
              <Field label="Hero Eyebrow" hint="Small label above the title">
                <AiTextField type="input" value={p.heroEyebrow ?? ""} onChange={v => set({ heroEyebrow: v })} fieldLabel="Hero Eyebrow" brandVoiceSet={brandVoiceSet}
                  onSuggest={() => suggestCopy("content-series", "heroEyebrow", p.heroEyebrow ?? "", {})} />
              </Field>
              <Field label="Hero Image">
                <ImagePicker value={p.heroImageUrl ?? ""} onChange={v => set({ heroImageUrl: v || undefined })} />
              </Field>
              <Field label="Featured Episode Title">
                <AiTextField type="input" value={p.heroEpisodeTitle} onChange={v => set({ heroEpisodeTitle: v })} fieldLabel="Episode Title" brandVoiceSet={brandVoiceSet}
                  onSuggest={() => suggestCopy("content-series", "heroEpisodeTitle", p.heroEpisodeTitle, {})} />
              </Field>
              <Field label="Episode Description">
                <AiTextField type="textarea" value={p.heroEpisodeDescription ?? ""} onChange={v => set({ heroEpisodeDescription: v })} rows={3} fieldLabel="Episode Description" brandVoiceSet={brandVoiceSet}
                  onSuggest={() => suggestCopy("content-series", "heroEpisodeDescription", p.heroEpisodeDescription ?? "", {})} />
              </Field>
              <Field label="Guest Name">
                <Input value={p.heroGuestName ?? ""} onChange={e => set({ heroGuestName: e.target.value })} className="text-xs h-7" placeholder="Dr. Sarah Chen" />
              </Field>
              <Field label="Guest Title">
                <Input value={p.heroGuestTitle ?? ""} onChange={e => set({ heroGuestTitle: e.target.value })} className="text-xs h-7" placeholder="CEO & Founder" />
              </Field>
              <Field label="CTA Text">
                <Input value={p.heroCtaText ?? ""} onChange={e => set({ heroCtaText: e.target.value })} className="text-xs h-7" placeholder="Listen Now" />
              </Field>
              <Field label="CTA URL">
                <Input value={p.heroCtaUrl ?? ""} onChange={e => set({ heroCtaUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="https://…" />
              </Field>
            </>
          )}
        </div>
      )}

      {/* ── Nav Links ────────────────────────────────────────────────────── */}
      <SectionHeader label="Nav Links" open={open.nav} onToggle={() => toggle("nav")} />
      {open.nav && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Nav CTA Text">
            <Input value={p.navCtaText ?? ""} onChange={e => set({ navCtaText: e.target.value })} className="text-xs h-7" placeholder="Listen Now" />
          </Field>
          <Field label="Nav CTA URL">
            <Input value={p.navCtaUrl ?? ""} onChange={e => set({ navCtaUrl: e.target.value })} className="text-xs h-7 font-mono" />
          </Field>
          <Field label="Secondary CTA Text">
            <Input value={p.navSecondaryCtaText ?? ""} onChange={e => set({ navSecondaryCtaText: e.target.value })} className="text-xs h-7" placeholder="Apply to be a Guest" />
          </Field>
          <Field label="Secondary CTA URL">
            <Input value={p.navSecondaryCtaUrl ?? ""} onChange={e => set({ navSecondaryCtaUrl: e.target.value })} className="text-xs h-7 font-mono" placeholder="#apply" />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Links</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addNavLink}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {navLinks.map((link, i) => (
              <div key={i} className="flex gap-1 items-center">
                <Input value={link.label} onChange={e => updateNavLink(i, { label: e.target.value })} placeholder="Label" className="text-xs h-7 flex-1" />
                <Input value={link.href} onChange={e => updateNavLink(i, { href: e.target.value })} placeholder="#section" className="text-xs h-7 flex-1" />
                <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeNavLink(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Episodes ─────────────────────────────────────────────────────── */}
      <SectionHeader label={`Episodes (${episodes.length})`} open={open.episodes} onToggle={() => toggle("episodes")} />
      {open.episodes && (
        <div className="space-y-3 pt-3 pb-4">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{episodes.filter(e => !e.hidden).length} visible · {episodes.filter(e => e.hidden).length} hidden</span>
            {episodes.some(ep => ep.pinHero) && (
              <Button type="button" variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={unpinAllHeroes}>
                Unpin hero
              </Button>
            )}
          </div>
          {episodes.map((ep, i) => {
            const isCollapsed = !openEpisodes[i];
            return (
              <div key={i} className={`border rounded-md p-3 space-y-2 ${ep.hidden ? "border-border/50 opacity-60" : ep.pinHero ? "border-primary/50 bg-primary/5" : "border-border"}`}>
                <div className="flex items-center gap-1">
                  <button type="button" className="flex-1 flex items-center gap-1.5 text-left" onClick={() => setOpenEpisodes(s => ({ ...s, [i]: !s[i] }))}>
                    {isCollapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />}
                    <span className="text-xs font-medium text-muted-foreground truncate">{ep.title || `Episode ${i + 1}`}</span>
                    {ep.pinHero && <Pin className="w-3 h-3 text-primary shrink-0" />}
                    {ep.hidden && <EyeOff className="w-3 h-3 text-muted-foreground shrink-0" />}
                    {ep.status && ep.status !== "on-demand" && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ep.status === "live" ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"}`}>
                        {ep.status === "live" ? "Live" : "Upcoming"}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveEpisode(i, i - 1)} disabled={i === 0} title="Move up">
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveEpisode(i, i + 1)} disabled={i === episodes.length - 1} title="Move down">
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateEpisode(i, { hidden: !ep.hidden })} title={ep.hidden ? "Show" : "Hide"}>
                      {ep.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className={`h-6 w-6 ${ep.pinHero ? "text-primary" : ""}`} onClick={() => ep.pinHero ? unpinAllHeroes() : pinEpisodeAsHero(i)} title={ep.pinHero ? "Unpin from hero" : "Pin as hero"}>
                      <Pin className="w-3 h-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeEpisode(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="space-y-2 pt-1">
                    <ImagePicker value={ep.thumbnailUrl ?? ""} onChange={v => updateEpisode(i, { thumbnailUrl: v || undefined })} />
                    <Input value={ep.title} onChange={e => updateEpisode(i, { title: e.target.value })} className="h-7 text-xs" placeholder="Episode title" />
                    <div className="space-y-1">
                      <Input
                        value={ep.slug ?? ""}
                        onChange={e => updateEpisode(i, { slug: e.target.value || undefined })}
                        className="h-7 text-xs font-mono"
                        placeholder={`URL slug (auto: ${episodeSlug({ ...ep, slug: undefined })})`}
                      />
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Ad URL: <span className="font-mono">?episode={episodeSlug(ep)}</span> — also matches <span className="font-mono">utm_content</span>.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input value={ep.guestName ?? ""} onChange={e => updateEpisode(i, { guestName: e.target.value })} className="h-7 text-xs" placeholder="Guest name" />
                      <Input value={ep.guestTitle ?? ""} onChange={e => updateEpisode(i, { guestTitle: e.target.value })} className="h-7 text-xs" placeholder="Guest title" />
                    </div>
                    <Input value={ep.guestCompany ?? ""} onChange={e => updateEpisode(i, { guestCompany: e.target.value })} className="h-7 text-xs" placeholder="Guest company" />
                    <Textarea value={ep.description} onChange={e => updateEpisode(i, { description: e.target.value })} className="text-xs min-h-[3rem]" rows={2} placeholder="Episode description" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input type="date" value={ep.publishDate} onChange={e => updateEpisode(i, { publishDate: e.target.value })} className="h-7 text-xs" />
                      <Select value={ep.status ?? "on-demand"} onValueChange={v => updateEpisode(i, { status: v as EpisodeStatus })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="on-demand">On Demand</SelectItem>
                          <SelectItem value="live">Live</SelectItem>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input value={ep.ctaText ?? ""} onChange={e => updateEpisode(i, { ctaText: e.target.value })} className="h-7 text-xs" placeholder="CTA label" />
                      <Input value={ep.ctaUrl} onChange={e => updateEpisode(i, { ctaUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="CTA URL" />
                    </div>
                    <div className="space-y-1 pt-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Platform Links</Label>
                      <Input value={ep.applePodcastsUrl ?? ""} onChange={e => updateEpisode(i, { applePodcastsUrl: e.target.value || undefined })} className="h-7 text-xs font-mono" placeholder="Apple Podcasts URL" />
                      <Input value={ep.spotifyUrl ?? ""} onChange={e => updateEpisode(i, { spotifyUrl: e.target.value || undefined })} className="h-7 text-xs font-mono" placeholder="Spotify URL" />
                      <Input value={ep.youtubeUrl ?? ""} onChange={e => updateEpisode(i, { youtubeUrl: e.target.value || undefined })} className="h-7 text-xs font-mono" placeholder="YouTube URL" />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={!!ep.isFeatured} onChange={e => updateEpisode(i, { isFeatured: e.target.checked })} className="w-3 h-3" />
                      Featured in library
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addEpisode}>
            <Plus className="w-3 h-3 mr-1" /> Add Episode
          </Button>
        </div>
      )}

      {/* ── Host ─────────────────────────────────────────────────────────── */}
      <SectionHeader label={hosts.length <= 1 ? "Host" : "Hosts & Guests"} open={open.hosts} onToggle={() => toggle("hosts")} />
      {open.hosts && (
        <div className="space-y-3 pt-3 pb-4">
          {hosts.length <= 1 && (
            <>
              {hosts.length === 0 && (
                <p className="text-[11px] text-muted-foreground bg-muted/30 rounded p-2">No host configured yet. Add one below to show a "Your Host" spotlight section.</p>
              )}
              {hosts.length === 1 && (
                <div className="space-y-2">
                  <Field label="Photo">
                    <ImagePicker value={hosts[0].photoUrl ?? ""} onChange={v => updateHost(0, { photoUrl: v || undefined })} />
                  </Field>
                  <Field label="Name">
                    <Input value={hosts[0].name} onChange={e => updateHost(0, { name: e.target.value })} className="h-7 text-xs" placeholder="Dr. Eric DeVore" />
                  </Field>
                  <Field label="Title">
                    <Input value={hosts[0].title} onChange={e => updateHost(0, { title: e.target.value })} className="h-7 text-xs" placeholder="CEO & Founder" />
                  </Field>
                  <Field label="Company">
                    <Input value={hosts[0].company ?? ""} onChange={e => updateHost(0, { company: e.target.value })} className="h-7 text-xs" placeholder="Acme" />
                  </Field>
                  <Field label="Bio">
                    <Textarea value={hosts[0].bio ?? ""} onChange={e => updateHost(0, { bio: e.target.value })} className="text-xs min-h-[3rem]" rows={3} placeholder="A brief bio…" />
                  </Field>
                  <Field label="LinkedIn URL">
                    <Input value={hosts[0].linkedinUrl ?? ""} onChange={e => updateHost(0, { linkedinUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="https://linkedin.com/in/…" />
                  </Field>
                  <Field label="Website URL">
                    <Input value={hosts[0].websiteUrl ?? ""} onChange={e => updateHost(0, { websiteUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="https://…" />
                  </Field>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px] text-destructive hover:text-destructive w-full" onClick={() => removeHost(0)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Remove Host
                  </Button>
                </div>
              )}
              {hosts.length === 0 && (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addHost}>
                  <Plus className="w-3 h-3 mr-1" /> Add Host
                </Button>
              )}
              {hosts.length === 1 && (
                <div className="border-t border-border pt-2 mt-1">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addHost}>
                    <Plus className="w-3 h-3 mr-1" /> Add Another (multi-host grid)
                  </Button>
                </div>
              )}
            </>
          )}
          {hosts.length > 1 && (
            <>
              {hosts.map((host, i) => (
                <div key={i} className="border border-border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{host.name || `Host ${i + 1}`}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeHost(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <Input value={host.name} onChange={e => updateHost(i, { name: e.target.value })} className="h-7 text-xs" placeholder="Name" />
                  <Input value={host.title} onChange={e => updateHost(i, { title: e.target.value })} className="h-7 text-xs" placeholder="Title" />
                  <Input value={host.company ?? ""} onChange={e => updateHost(i, { company: e.target.value })} className="h-7 text-xs" placeholder="Company" />
                  <Textarea value={host.bio ?? ""} onChange={e => updateHost(i, { bio: e.target.value })} className="text-xs min-h-[3rem]" rows={2} placeholder="Bio" />
                  <ImagePicker value={host.photoUrl ?? ""} onChange={v => updateHost(i, { photoUrl: v || undefined })} />
                  <Input value={host.linkedinUrl ?? ""} onChange={e => updateHost(i, { linkedinUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="LinkedIn URL" />
                  <Input value={host.websiteUrl ?? ""} onChange={e => updateHost(i, { websiteUrl: e.target.value })} className="h-7 text-xs font-mono" placeholder="Website URL" />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addHost}>
                <Plus className="w-3 h-3 mr-1" /> Add Host
              </Button>
            </>
          )}
        </div>
      )}

      {/* ── About ────────────────────────────────────────────────────────── */}
      <SectionHeader label="About Section" open={open.about} onToggle={() => toggle("about")} />
      {open.about && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Headline">
            <AiTextField type="input" value={p.aboutHeadline ?? ""} onChange={v => set({ aboutHeadline: v })} fieldLabel="About Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "aboutHeadline", p.aboutHeadline ?? "", {})} />
          </Field>
          <Field label="Description">
            <AiTextField type="textarea" value={p.aboutDescription ?? ""} onChange={v => set({ aboutDescription: v })} rows={4} fieldLabel="About Description" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "aboutDescription", p.aboutDescription ?? "", {})} />
          </Field>
          <Field label="Audience" hint="Who this series is for">
            <AiTextField type="input" value={p.aboutAudience ?? ""} onChange={v => set({ aboutAudience: v })} fieldLabel="Audience" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "aboutAudience", p.aboutAudience ?? "", {})} />
          </Field>
          <div className="space-y-2">
            <Label className="text-xs">Topics</Label>
            {topics.map((topic, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <Input value={topic} onChange={e => updateTopic(i, e.target.value)} className="h-7 text-xs flex-1" placeholder={`Topic ${i + 1}`} />
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeTopic(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addTopic}>
              <Plus className="w-3 h-3 mr-1" /> Add Topic
            </Button>
          </div>
        </div>
      )}

      {/* ── Guest Application Form ───────────────────────────────────────── */}
      <SectionHeader label="Guest Application Form" open={open.form} onToggle={() => toggle("form")} />
      {open.form && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Eyebrow">
            <AiTextField type="input" value={p.formEyebrow ?? ""} onChange={v => set({ formEyebrow: v })} fieldLabel="Form Eyebrow" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "formEyebrow", p.formEyebrow ?? "", {})} />
          </Field>
          <Field label="Headline">
            <AiTextField type="input" value={p.formHeadline ?? ""} onChange={v => set({ formHeadline: v })} fieldLabel="Form Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "formHeadline", p.formHeadline ?? "", {})} />
          </Field>
          <Field label="Subtitle">
            <AiTextField type="textarea" value={p.formSubheadline ?? ""} onChange={v => set({ formSubheadline: v })} rows={2} fieldLabel="Form Subtitle" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "formSubheadline", p.formSubheadline ?? "", {})} />
          </Field>
          <Field label="Submit URL" hint="Where form data is sent. Leave blank for default lead system.">
            <Input value={p.formSubmitUrl ?? ""} onChange={e => set({ formSubmitUrl: e.target.value || undefined })} className="text-xs h-7 font-mono" placeholder="https://… (leave blank for default)" />
          </Field>
          <Field label="Success Message" hint="Shown after successful submission">
            <AiTextField type="input" value={p.formSuccessMessage ?? ""} onChange={v => set({ formSuccessMessage: v })} fieldLabel="Success Message" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "formSuccessMessage", p.formSuccessMessage ?? "", {})} />
          </Field>
          <Field label="Open-Form Button Label" hint="Text on the button that opens the application modal">
            <Input value={p.formButtonLabel ?? ""} onChange={e => set({ formButtonLabel: e.target.value || undefined })} className="text-xs h-7" placeholder="Apply to be a Guest" />
          </Field>

          <div className="border-t border-border pt-3 mt-2 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recording Slot Picker</Label>
            <p className="text-[11px] text-muted-foreground leading-snug">Reads "OPEN" rows from a Google Sheet and renders date cards as the final step of the guest form. Leave Sheet ID blank to disable.</p>
            <SchedulingTemplate />
            <Field label="Google Sheet ID" hint="From the sheet URL: /spreadsheets/d/<ID>/edit">
              <Input value={p.availabilitySheetId ?? ""} onChange={e => set({ availabilitySheetId: e.target.value || undefined })} className="text-xs h-7 font-mono" placeholder="19le6P9-bhUDm-1EteGhYBUXA_TDqbKeRzWMVGgkE664" />
            </Field>
            <Field label="Sheet Tab" hint="Defaults to 'Scheduled'">
              <Input value={p.availabilitySheetTab ?? ""} onChange={e => set({ availabilitySheetTab: e.target.value || undefined })} className="text-xs h-7" placeholder="Scheduled" />
            </Field>
            <Field label="Step Title">
              <Input value={p.availabilityStepTitle ?? ""} onChange={e => set({ availabilityStepTitle: e.target.value || undefined })} className="text-xs h-7" placeholder="Pick a Recording Date" />
            </Field>
            <Field label="Helper Text" hint="Shown above the date cards">
              <AiTextField type="textarea" value={p.availabilityHelperText ?? ""} onChange={v => set({ availabilityHelperText: v || undefined })} rows={3} fieldLabel="Availability Helper Text" brandVoiceSet={brandVoiceSet}
                onSuggest={() => suggestCopy("content-series", "availabilityHelperText", p.availabilityHelperText ?? "", {})} />
            </Field>
          </div>
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Form Steps</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addFormStep}>
                <Plus className="w-3 h-3 mr-1" /> Step
              </Button>
            </div>
            {formSteps.map((fStep, si) => (
              <div key={si} className="border border-border rounded p-2 space-y-2">
                <div className="flex items-center gap-1">
                  <Input value={fStep.title} onChange={e => updateFormStep(si, { title: e.target.value })} placeholder="Step title" className="text-xs h-7 flex-1" />
                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeFormStep(si)} disabled={formSteps.length <= 1}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="space-y-1.5 pl-2">
                  {(fStep.fields ?? []).map((field, fi) => (
                    <div key={fi} className="border border-border/50 rounded p-1.5 space-y-1.5">
                      <Input value={field.label} onChange={e => updateFormField(si, fi, { label: e.target.value })} placeholder="Field label" className="text-xs h-6 w-full" />
                      <div className="flex items-center gap-1">
                        <select
                          value={field.type}
                          onChange={e => updateFormField(si, fi, { type: e.target.value as FormFieldType })}
                          className="text-xs h-6 border border-border rounded px-1 bg-background flex-1 min-w-0"
                        >
                          {(["text", "email", "phone", "textarea", "select", "hidden"] as FormFieldType[]).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => removeFormField(si, fi)}>
                          <Trash2 className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                      <Input value={field.placeholder ?? ""} onChange={e => updateFormField(si, fi, { placeholder: e.target.value })} placeholder="Placeholder" className="text-xs h-6" />
                      {field.type === "select" && (
                        <Textarea
                          value={(field.options ?? []).join("\n")}
                          onChange={e => updateFormField(si, fi, { options: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
                          placeholder="One option per line"
                          className="text-xs min-h-[3rem]"
                          rows={2}
                        />
                      )}
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={field.required} onChange={e => updateFormField(si, fi, { required: e.target.checked })} className="w-3 h-3" />
                        Required
                      </label>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs w-full border border-dashed border-border" onClick={() => addFormField(si)}>
                    <Plus className="w-3 h-3 mr-1" /> Add Field
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Subscribe Form (Modal) ───────────────────────────────────────── */}
      <SectionHeader label="Subscribe Form (Modal)" open={open.subscribe} onToggle={() => toggle("subscribe")} />
      {open.subscribe && (
        <div className="space-y-3 pt-3 pb-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Opens when someone submits the email input in the nav. This is a <span className="font-medium text-foreground">separate form</span> from the Guest Application above — give it its own headline, subhead, and fields (typically just email + name).
          </p>
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={p.subscribeEnabled !== false}
              onChange={e => set({ subscribeEnabled: e.target.checked })}
              className="w-3.5 h-3.5"
            />
            Enable subscribe input in nav
          </label>
          {p.subscribeEnabled !== false && (
            <>
              <Field label="Nav Input Placeholder">
                <Input value={p.subscribePlaceholder ?? ""} onChange={e => set({ subscribePlaceholder: e.target.value || undefined })} className="text-xs h-7" placeholder="your@email.com" />
              </Field>
              <Field label="Nav Button Label">
                <Input value={p.subscribeButtonLabel ?? ""} onChange={e => set({ subscribeButtonLabel: e.target.value || undefined })} className="text-xs h-7" placeholder="Subscribe" />
              </Field>
              <div className="border-t border-border pt-3 mt-3 space-y-3">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Form Source</Label>
                <ModalFormSourcePanel
                  value={{
                    modalFormSource: p.subscribeFormSource,
                    modalFormId: p.subscribeLinkedFormId,
                    modalMarketoBaseUrl: p.subscribeMarketoBaseUrl,
                    modalMarketoMunchkinId: p.subscribeMarketoMunchkinId,
                    modalMarketoFormId: p.subscribeMarketoFormId,
                  }}
                  onChange={next => set({
                    subscribeFormSource: next.modalFormSource,
                    subscribeLinkedFormId: next.modalFormId,
                    subscribeMarketoBaseUrl: next.modalMarketoBaseUrl,
                    subscribeMarketoMunchkinId: next.modalMarketoMunchkinId,
                    subscribeMarketoFormId: next.modalMarketoFormId,
                  })}
                />
              </div>
              <div className="border-t border-border pt-3 mt-3 space-y-3">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Modal Copy</Label>
                <Field label="Eyebrow">
                  <AiTextField type="input" value={p.subscribeFormEyebrow ?? ""} onChange={v => set({ subscribeFormEyebrow: v })} fieldLabel="Subscribe Eyebrow" brandVoiceSet={brandVoiceSet}
                    onSuggest={() => suggestCopy("content-series", "subscribeFormEyebrow", p.subscribeFormEyebrow ?? "", {})} />
                </Field>
                <Field label="Headline">
                  <AiTextField type="input" value={p.subscribeFormHeadline ?? ""} onChange={v => set({ subscribeFormHeadline: v })} fieldLabel="Subscribe Headline" brandVoiceSet={brandVoiceSet}
                    onSuggest={() => suggestCopy("content-series", "subscribeFormHeadline", p.subscribeFormHeadline ?? "", {})} />
                </Field>
                <Field label="Subtitle">
                  <AiTextField type="textarea" value={p.subscribeFormSubheadline ?? ""} onChange={v => set({ subscribeFormSubheadline: v })} rows={2} fieldLabel="Subscribe Subtitle" brandVoiceSet={brandVoiceSet}
                    onSuggest={() => suggestCopy("content-series", "subscribeFormSubheadline", p.subscribeFormSubheadline ?? "", {})} />
                </Field>
                <Field label="Success Message">
                  <Input value={p.subscribeSuccessMessage ?? ""} onChange={e => set({ subscribeSuccessMessage: e.target.value || undefined })} className="text-xs h-7" placeholder="You're in. Watch your inbox." />
                </Field>
                <Field label="Submit URL" hint="Falls back to Subscribe Submit URL, then Form Submit URL, then default lead system.">
                  <Input value={p.subscribeFormSubmitUrl ?? ""} onChange={e => set({ subscribeFormSubmitUrl: e.target.value || undefined })} className="text-xs h-7 font-mono" placeholder="https://… (optional)" />
                </Field>
              </div>
              <div className="border-t border-border pt-3 mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Subscribe Form Steps</Label>
                  <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addSubscribeStep}>
                    <Plus className="w-3 h-3 mr-1" /> Step
                  </Button>
                </div>
                {subscribeFormSteps.length === 0 && (
                  <p className="text-[10px] text-muted-foreground italic">No custom fields — modal will show a single email input.</p>
                )}
                {subscribeFormSteps.map((fStep, si) => (
                  <div key={si} className="border border-border rounded p-2 space-y-2">
                    <div className="flex items-center gap-1">
                      <Input value={fStep.title} onChange={e => updateSubscribeStep(si, { title: e.target.value })} placeholder="Step title" className="text-xs h-7 flex-1" />
                      <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeSubscribeStep(si)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="space-y-1.5 pl-2">
                      {(fStep.fields ?? []).map((field, fi) => (
                        <div key={fi} className="border border-border/50 rounded p-1.5 space-y-1.5">
                          <Input value={field.label} onChange={e => updateSubscribeField(si, fi, { label: e.target.value })} placeholder="Field label" className="text-xs h-6 w-full" />
                          <div className="flex items-center gap-1">
                            <select
                              value={field.type}
                              onChange={e => updateSubscribeField(si, fi, { type: e.target.value as FormFieldType })}
                              className="text-xs h-6 border border-border rounded px-1 bg-background flex-1 min-w-0"
                            >
                              {(["text", "email", "phone", "textarea", "select", "hidden"] as FormFieldType[]).map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                            <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => removeSubscribeField(si, fi)}>
                              <Trash2 className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                          <Input value={field.placeholder ?? ""} onChange={e => updateSubscribeField(si, fi, { placeholder: e.target.value })} placeholder="Placeholder" className="text-xs h-6" />
                          {field.type === "select" && (
                            <Textarea
                              value={(field.options ?? []).join("\n")}
                              onChange={e => updateSubscribeField(si, fi, { options: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
                              placeholder="One option per line"
                              className="text-xs min-h-[3rem]"
                              rows={2}
                            />
                          )}
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                            <input type="checkbox" checked={field.required} onChange={e => updateSubscribeField(si, fi, { required: e.target.checked })} className="w-3 h-3" />
                            Required
                          </label>
                        </div>
                      ))}
                      <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs w-full border border-dashed border-border" onClick={() => addSubscribeField(si)}>
                        <Plus className="w-3 h-3 mr-1" /> Add Field
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 mt-3 space-y-3">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Email Subscribers</Label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Subscribers are people who signed up via the built-in Subscribe form on this page. Email them when a new episode goes live.
                </p>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p.subscribeNotifyAutoSend === true}
                    onChange={e => set({ subscribeNotifyAutoSend: e.target.checked })}
                    className="w-3.5 h-3.5"
                  />
                  Auto-email subscribers when a new episode is published
                </label>
                {pageId == null ? (
                  <p className="text-[10px] text-muted-foreground italic">Save &amp; publish this page first to view subscribers.</p>
                ) : (
                  <div className="space-y-2 border border-border rounded-md p-2.5 bg-muted/20">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        Subscribers{subsLoaded ? ` (${subscribers.length})` : ""}
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={subsLoading}
                          onClick={loadSubscribers}
                          title="Load the list of people subscribed to this Content Series."
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 ${subsLoading ? "animate-spin" : ""}`} />
                          {subsLoaded ? "Refresh" : subsLoading ? "Loading…" : "View list"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={subsExporting}
                          onClick={exportSubscribersCsv}
                          title="Download all subscribers as a CSV file."
                        >
                          <Download className="w-3 h-3 mr-1" />
                          {subsExporting ? "Exporting…" : "Export CSV"}
                        </Button>
                      </div>
                    </div>
                    {subsError && <p className="text-[11px] text-destructive">{subsError}</p>}
                    {subsLoaded && subscribers.length === 0 && !subsError && (
                      <p className="text-[11px] text-muted-foreground italic">No subscribers yet.</p>
                    )}
                    {subsLoaded && subscribers.length > 0 && (
                      <div className="space-y-1 max-h-56 overflow-y-auto">
                        {subscribers.map((s, i) => (
                          <div key={`${s.email}-${i}`} className="flex items-center gap-2 text-[11px] border-b border-border/60 last:border-0 py-1">
                            <span className="flex-1 truncate font-mono" title={s.email}>{s.email}</span>
                            <span className="text-muted-foreground shrink-0 tabular-nums">
                              {s.subscribedAt ? new Date(s.subscribedAt).toLocaleDateString() : "—"}
                            </span>
                            {s.optedOut && (
                              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">
                                Opted out
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {pageId == null ? null : episodes.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">Add episodes above to notify subscribers.</p>
                ) : (
                  <div className="space-y-1.5">
                    {episodes.map((ep, i) => {
                      const key = episodeKeyOf(ep);
                      return (
                        <div key={i} className="flex items-center gap-2 border border-border rounded p-1.5">
                          <span className="text-xs flex-1 truncate" title={ep.title}>{ep.title || "Untitled episode"}</span>
                          {notifyMsg[key] && <span className="text-[10px] text-muted-foreground shrink-0">{notifyMsg[key]}</span>}
                          <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs shrink-0" disabled={notifyBusy[key]} onClick={() => handleNotify(ep)}>
                            {notifyBusy[key] ? "Sending…" : "Notify"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── CTA Section ──────────────────────────────────────────────────── */}
      <SectionHeader label="CTA Section" open={open.cta} onToggle={() => toggle("cta")} />
      {open.cta && (
        <div className="space-y-3 pt-3 pb-4">
          <Field label="Headline">
            <AiTextField type="input" value={p.ctaSectionHeadline ?? ""} onChange={v => set({ ctaSectionHeadline: v })} fieldLabel="CTA Headline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "ctaSectionHeadline", p.ctaSectionHeadline ?? "", {})} />
          </Field>
          <Field label="Subheadline">
            <AiTextField type="textarea" value={p.ctaSectionSubheadline ?? ""} onChange={v => set({ ctaSectionSubheadline: v })} rows={2} fieldLabel="CTA Subheadline" brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy("content-series", "ctaSectionSubheadline", p.ctaSectionSubheadline ?? "", {})} />
          </Field>

          <div className="border border-border rounded-md p-2.5 bg-muted/30">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              The subscribe input renders here in the CTA section. The nav has a Subscribe button that anchors to it. Edit subscribe copy and the modal in the <span className="font-medium text-foreground">Subscribe Form (Modal)</span> section below.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">CTA Buttons</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addCta}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {ctas.map((cta, i) => (
              <div key={i} className="border border-border rounded-md p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{cta.label || `CTA ${i + 1}`}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeCta(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <Input value={cta.label} onChange={e => updateCta(i, { label: e.target.value })} className="h-7 text-xs" placeholder="Label" />
                <Input value={cta.url} onChange={e => updateCta(i, { url: e.target.value })} className="h-7 text-xs font-mono" placeholder="URL" />
                <Select value={cta.variant ?? "primary"} onValueChange={v => updateCta(i, { variant: v as "primary" | "outline" })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary (solid)</SelectItem>
                    <SelectItem value="outline">Outline (ghost)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
