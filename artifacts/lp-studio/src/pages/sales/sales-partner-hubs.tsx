import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowLeft, Copy, ExternalLink, Eye, Pencil, Plus, Search, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SalesLayout } from "@/components/layout/sales-layout";
import { SalesPageHeader } from "@/components/sales/sales-page-header";
import { toast } from "@/hooks/use-toast";
import { fmtWhen } from "@/components/analytics/RoomPerformance";
import type { RoomPanelTab } from "@/components/analytics/PageRoomPanel";
import { filterHubs, hubFlags, hubLandingTab, hubStageText, needsLine, sortHubs, type HubRow } from "./sales-partner-hubs-shared";
import { SetupStatus, hubSetupState } from "@/components/analytics/RoomSetup";

/* ----------------------------------------------------------------------------
 * Sales Console → Partner Hubs. Where a rep finds their hubs, makes one for an
 * account, and manages it: the same pop-up the builder opens (performance,
 * activity, launch kit, practices, calendar, settings), one click from the row.
 * -------------------------------------------------------------------------- */

// The team's hub pop-up is large; load it only when a hub is opened.
const PageRoomPanel = lazy(() => import("@/components/analytics/PageRoomPanel").then((m) => ({ default: m.PageRoomPanel })));

interface HubSetup {
  pageId: number;
  title: string;
  name: string;
  status: "live" | "draft";
  url: string;
  stage?: "rollout" | "expansion";
  setup: { key: string; title: string; done: boolean; where: "account" | "team" | "kit" | "notify" | "publish" | "invite" }[];
}

async function json<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const r = await fetch(url, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = (await r.json().catch(() => ({}))) as T & { error?: string };
  return { ok: r.ok, status: r.status, data };
}

/** Open the published hub already recognised as the signed-in rep (the session cookie does not reach the customer's domain). */
async function openAsMe(pageId: number) {
  const r = await json<{ url?: string }>(`/api/lp/partner-rooms/${pageId}/my-link`);
  if (r.ok && r.data.url) window.open(r.data.url, "_blank", "noopener");
  else toast({ title: "Couldn't open the hub", description: r.data.error ?? "Try again in a moment.", variant: "destructive" });
}

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied" });
  } catch {
    toast({ title: "Couldn't copy the link", description: url, variant: "destructive" });
  }
}

function IconButton({ label, onClick, disabled, children, ...rest }: { label: string; onClick?: () => void; disabled?: boolean; children: React.ReactNode } & Record<`data-${string}`, string>) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── New hub ──────────────────────────────────────────────────────────────── */

interface AccountHit {
  id: number;
  name: string;
  owner: string | null;
  locations: number | null;
  hubPageId: number | null;
}

function NewHubDialog({ open, onClose, onOpenHub }: { open: boolean; onClose: () => void; onOpenHub: (pageId: number, created: boolean) => void }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState<AccountHit | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (open) {
      setQ("");
      setError("");
      setCreating(null);
    }
  }, [open]);
  const { data, isFetching } = useQuery({
    queryKey: ["partner-hub-accounts", term],
    enabled: open,
    queryFn: async () => (await json<{ accounts?: AccountHit[] }>(`/api/lp/partner-hub-accounts?q=${encodeURIComponent(term)}`)).data.accounts ?? [],
  });
  const create = async (a: AccountHit) => {
    setCreating(a);
    setError("");
    const r = await json<{ pageId?: number; existed?: boolean }>("/api/lp/partner-rooms", { method: "POST", body: JSON.stringify({ accountId: a.id }) });
    setCreating(null);
    if (r.ok && r.data.pageId) onOpenHub(r.data.pageId, !r.data.existed);
    else setError(r.data.error ?? "Couldn't create the hub. Try again.");
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !creating && onClose()}>
      <DialogContent className="max-w-lg" data-new-hub>
        <DialogHeader>
          <DialogTitle>New Partner Hub</DialogTitle>
          <DialogDescription>Pick the account. The hub starts as a draft with the customer's team, practices and standard files already filled in from what we know.</DialogDescription>
        </DialogHeader>
        {creating ? (
          <div className="space-y-2 py-6 text-center" role="status">
            <p className="text-sm font-medium">Creating the hub for {creating.name}…</p>
            <p className="text-sm text-muted-foreground">Filling in the team, practices and launch files. This can take a minute.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search accounts" className="pl-9" aria-label="Search accounts" />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
              {(data ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{a.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[a.owner, a.locations ? `${a.locations} locations` : ""].filter(Boolean).join(" · ") || "No owner listed"}</span>
                  </span>
                  {a.hubPageId ? (
                    <Button size="sm" variant="outline" onClick={() => onOpenHub(a.hubPageId as number, false)}>Open hub</Button>
                  ) : (
                    <Button size="sm" variant="brand" onClick={() => create(a)} data-new-hub-create={a.id}>Create</Button>
                  )}
                </li>
              ))}
              {data && data.length === 0 && !isFetching && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{term ? "No account by that name. Add it under Accounts first." : "No accounts yet. Add one under Accounts first."}</li>}
              {!data && <li className="px-3 py-3"><Skeleton className="h-10 w-full" /></li>}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── One hub: its own page ────────────────────────────────────────────────── */

/**
 * A hub's page in the Sales Console. Everything about one hub lives here at
 * full width: who it is and where it stands at the top, the few things a rep
 * does to it beside that, then the same tabs the builder's pop-up has. The
 * address carries the tab (and the Settings section), so a hub can be
 * bookmarked, sent to a teammate, or reloaded without losing the place.
 */
function HubPage({ pageId, tab }: { pageId: number; tab: RoomPanelTab }) {
  const qc = useQueryClient();
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["partner-hub-setup", pageId],
    queryFn: async () => {
      const r = await json<HubSetup>(`/api/lp/partner-rooms/${pageId}/setup`);
      return r.ok ? r.data : null;
    },
  });
  // Publishing, invites and uploads here change what the hub's row on the list shows.
  useEffect(() => () => void qc.invalidateQueries({ queryKey: ["partner-hubs"] }), [qc]);
  const [publishing, setPublishing] = useState(false);
  /** Publish the hub (or take it offline) from here, by the same rules as publishing any page. */
  const setLive = async (publish: boolean) => {
    if (!publish && !window.confirm("Unpublish this hub? The customer’s link stops working until you publish it again.")) return;
    setPublishing(true);
    const r = await json<{ code?: string }>(`/api/lp/partner-rooms/${pageId}/publish`, { method: "POST", body: JSON.stringify({ publish }) });
    setPublishing(false);
    if (!r.ok) return void toast({ title: publish ? "Couldn't publish the hub" : "Couldn't unpublish the hub", description: r.data.code === "fact_flags_pending" ? "Some facts on the page need a review first. Open Edit content to check them." : r.data.error, variant: "destructive" });
    toast({ title: publish ? "The hub is live" : "The hub is a draft again", description: publish ? "Copy the link, or invite the customer's team from Settings." : undefined });
    await Promise.all([refetch(), qc.invalidateQueries({ queryKey: ["partner-hubs"] }), qc.invalidateQueries({ queryKey: ["page-room", pageId] })]);
  };
  const live = data?.status === "live";
  const initialSection = typeof window === "undefined" ? undefined : (new URLSearchParams(window.location.search).get("section") ?? undefined);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5" data-hub-page>
      <Link href="/sales/partner-hubs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-hub-back>
        <ArrowLeft className="h-4 w-4" /> Partner Hubs
      </Link>
      {!isLoading && !data ? (
        <div className="rounded-md border border-dashed px-4 py-10 text-center">
          <p className="text-sm font-medium">This hub isn’t here</p>
          <p className="mt-1 text-sm text-muted-foreground">It may have been deleted, or it belongs to another workspace.</p>
        </div>
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{data?.name ?? <Skeleton className="h-8 w-64" />}</h1>
              {data && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                  <span className={`inline-flex items-center gap-1.5 ${live ? "text-emerald-700" : "text-muted-foreground"}`}>
                    <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-muted-foreground/40"}`} aria-hidden />
                    {live ? "Live" : "Draft: the customer can’t open it yet"}
                  </span>
                  <SetupStatus setup={hubSetupState(data.setup)} />
                </div>
              )}
            </div>
            {/* What a rep does to a hub, most used first. One strong button: publish while it is a draft, open it once it is live. */}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void openHub(pageId, true)} title="See the hub without anything that is your team's only" data-room-open-as-customer>
                <Eye className="h-3.5 w-3.5" /> View as the customer
              </Button>
              {live && data?.url && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyLink(data.url)}>
                  <Copy className="h-3.5 w-3.5" /> Copy link
                </Button>
              )}
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <a href={`/builder/${pageId}`} target="_blank" rel="noopener" data-hub-edit>
                  <Pencil className="h-3.5 w-3.5" /> Edit content
                </a>
              </Button>
              {data &&
                (live ? (
                  <>
                    <Button size="sm" variant="brand" className="gap-1.5" onClick={() => void openHub(pageId, false)} data-room-open-as-me>
                      <ExternalLink className="h-3.5 w-3.5" /> Open hub
                    </Button>
                    <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={publishing} onClick={() => void setLive(false)} data-hub-publish="live">
                      {publishing ? "Working…" : "Unpublish"}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="brand" disabled={publishing} onClick={() => void setLive(true)} data-hub-publish="draft">
                    {publishing ? "Publishing…" : "Publish"}
                  </Button>
                ))}
            </div>
          </header>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <PageRoomPanel
              pageId={pageId}
              initialTab={tab}
              initialSection={initialSection}
              layout="page"
              onNavigate={(t, section) => {
                // The address follows the tab without reloading anything, so Back still returns to the list.
                const q = new URLSearchParams();
                if (t !== "activity") q.set("tab", t);
                if (t === "settings" && section !== "account") q.set("section", section);
                const next = `/sales/partner-hubs/${pageId}${q.toString() ? `?${q}` : ""}`;
                if (window.location.pathname + window.location.search !== next) window.history.replaceState(window.history.state, "", next);
              }}
            />
          </Suspense>
        </>
      )}
    </div>
  );
}

/** Open the hub in a new tab, as yourself or as the customer sees it. */
async function openHub(pageId: number, asCustomer: boolean) {
  const r = await json<{ url?: string }>(`/api/lp/partner-rooms/${pageId}/my-link${asCustomer ? "?as=customer" : ""}`);
  if (r.ok && r.data.url) window.open(r.data.url, "_blank", "noopener");
  else toast({ title: "Couldn't open the hub", description: r.data.error ?? "Try again in a moment.", variant: "destructive" });
}

const HUB_TABS: RoomPanelTab[] = ["performance", "plays", "goals", "activity", "kit", "practices", "calendar", "settings"];
const tabFromSearch = (search: string): RoomPanelTab => {
  const t = new URLSearchParams(search).get("tab") as RoomPanelTab | null;
  return t && HUB_TABS.includes(t) ? t : "activity";
};

/* ── The list ─────────────────────────────────────────────────────────────── */

export default function SalesPartnerHubs() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/sales/partner-hubs/:id");
  const openId = params?.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const qc = useQueryClient();
  // The list and an open hub are two routes, so opening one remounts this page: the tab to land on rides in the URL.
  const [tab, setTab] = useState<RoomPanelTab>(() => tabFromSearch(typeof window === "undefined" ? "" : window.location.search));
  const [scope, setScope] = useState<"mine" | "all" | "archived">("mine");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: loaded, isLoading, isError } = useQuery({
    queryKey: ["partner-hubs"],
    queryFn: async () => {
      const r = await json<{ hubs?: HubRow[]; archived?: number }>("/api/lp/partner-rooms");
      if (!r.ok) throw new Error(r.data.error ?? "Could not load");
      return { hubs: r.data.hubs ?? [], archived: r.data.archived ?? 0 };
    },
  });
  // Retired hubs are fetched only when the rep opens the archive.
  const { data: archivedHubs } = useQuery({
    queryKey: ["partner-hubs", "archived"],
    enabled: scope === "archived",
    queryFn: async () => (await json<{ hubs?: HubRow[] }>("/api/lp/partner-rooms?archived=1")).data.hubs ?? [],
  });
  const hubs = loaded?.hubs ?? [];
  const archivedCount = loaded?.archived ?? 0;
  const anyMine = hubs.some((h) => h.mine);
  // A rep with no hubs of their own starts on everyone's rather than an empty table.
  const effectiveScope = scope === "mine" && !anyMine ? "all" : scope;
  const rows = useMemo(() => (effectiveScope === "archived" ? sortHubs(filterHubs(archivedHubs ?? [], { scope: "all", q })) : sortHubs(filterHubs(hubs, { scope: effectiveScope, q }))), [hubs, archivedHubs, effectiveScope, q]);
  // Needs you: every hub in view with something waiting on the account team, most waiting first.
  const inbox = useMemo(() => (effectiveScope === "archived" ? [] : filterHubs(hubs, { scope: effectiveScope, q: "" }).filter((h) => h.waitingOnUs > 0 && !h.test).sort((a, b) => b.waitingOnUs - a.waitingOnUs)), [hubs, effectiveScope]);

  const setArchived = async (h: HubRow, archived: boolean) => {
    if (archived && !window.confirm(`Archive the ${h.name} hub? It leaves this list, the customer’s link stops working and its weekly digest stops. Nothing is deleted, and you can bring it back from Archived.`)) return;
    const r = await json(`/api/lp/partner-rooms/${h.pageId}/archive`, { method: "POST", body: JSON.stringify({ archived }) });
    if (!r.ok) return void toast({ title: archived ? "Couldn't archive the hub" : "Couldn't bring the hub back", description: r.data.error, variant: "destructive" });
    toast({ title: archived ? "Hub archived" : "Hub is back on your list", description: archived ? undefined : "It's a draft: publish it when you're ready." });
    await qc.invalidateQueries({ queryKey: ["partner-hubs"] });
  };

  const open = (pageId: number, t: RoomPanelTab) => {
    setTab(t);
    navigate(`/sales/partner-hubs/${pageId}${t === "activity" ? "" : `?tab=${t}`}`);
  };

  // An open hub is its own page; the list is the other route.
  if (openId !== null) {
    return (
      <SalesLayout>
        <HubPage key={openId} pageId={openId} tab={tab} />
      </SalesLayout>
    );
  }

  return (
    <SalesLayout>
      <div className="space-y-6">
        <SalesPageHeader
          title="Partner Hubs"
          description="The shared workspace each partner gets: their plan, marketing, practices and requests in one place."
          actions={
            <Button variant="brand" className="gap-1.5" onClick={() => setCreating(true)} data-hub-new>
              <Plus className="h-4 w-4" /> New hub
            </Button>
          }
        />

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : isError ? (
          <p role="alert" className="text-sm text-destructive">Couldn't load your Partner Hubs. Refresh to try again.</p>
        ) : hubs.length === 0 ? (
          <div className="rounded-lg border border-dashed px-6 py-14 text-center">
            <p className="text-base font-medium">No Partner Hubs yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Make one for an account and it arrives as a draft with the customer's team, practices and standard files filled in.</p>
            <Button variant="brand" className="mt-4 gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New hub
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-md border p-0.5 text-sm" role="tablist" aria-label="Which hubs">
                {(["mine", "all", ...(archivedCount > 0 || scope === "archived" ? (["archived"] as const) : [])] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={effectiveScope === s}
                    disabled={s === "mine" && !anyMine}
                    onClick={() => setScope(s)}
                    className={`rounded px-3 py-1 disabled:opacity-40 ${effectiveScope === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                    data-hub-scope={s}
                  >
                    {s === "mine" ? "My hubs" : s === "all" ? "All hubs" : `Archived${archivedCount ? ` (${archivedCount})` : ""}`}
                  </button>
                ))}
              </div>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hubs" className="pl-9" aria-label="Search hubs" />
              </div>
            </div>

            {inbox.length > 0 && (
              <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4" data-hub-inbox={inbox.length}>
                <h2 className="text-sm font-semibold">
                  Needs you <span className="font-normal text-muted-foreground">· {inbox.reduce((n, h) => n + h.waitingOnUs, 0)} across {inbox.length} {inbox.length === 1 ? "hub" : "hubs"}</span>
                </h2>
                <ul className="mt-2 divide-y divide-amber-200/70">
                  {inbox.slice(0, 8).map((h) => (
                    <li key={h.pageId}>
                      <button type="button" className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:underline" onClick={() => open(h.pageId, hubLandingTab(h))} data-hub-inbox-row={h.pageId}>
                        <span className="min-w-0">
                          <span className="font-medium">{h.name}</span>
                          <span className="text-muted-foreground"> · {needsLine(h.needs)}</span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-amber-800">Open</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {inbox.length > 8 && <p className="mt-1 text-xs text-muted-foreground">and {inbox.length - 8} more hubs, marked in the list below.</p>}
              </section>
            )}

            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[820px] text-sm" data-hub-table>
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-normal">Account</th>
                    <th className="px-3 py-2.5 font-normal">Stage</th>
                    <th className="px-3 py-2.5 font-normal">Waiting on them</th>
                    <th className="px-3 py-2.5 font-normal">Waiting on us</th>
                    <th className="px-3 py-2.5 font-normal">Views, 30 days</th>
                    <th className="px-3 py-2.5 font-normal">Last visit</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h) => (
                    <tr key={h.pageId} className="cursor-pointer border-b last:border-0 hover:bg-muted/40" onClick={() => open(h.pageId, hubLandingTab(h))} data-hub-row={h.pageId}>
                      <td className="px-4 py-3">
                        <span className="block font-medium">{h.name}{h.test ? " (test)" : ""}</span>
                        <span className="block text-xs text-muted-foreground">
                          <span className={h.status === "live" ? "text-emerald-700" : ""}>{h.status === "live" ? "Live" : "Draft"}</span>
                          <SetupStatus setup={h.setup} className="ml-1.5" />
                          {h.account?.owner ? ` · ${h.account.owner}` : ""}
                        </span>
                        {hubFlags(h).length > 0 && <span className="mt-0.5 block text-xs font-medium text-amber-700" data-hub-flags>{hubFlags(h).join(" · ")}</span>}
                      </td>
                      <td className="px-3 py-3 tabular-nums" data-hub-stage={h.stage ?? "rollout"}>
                        <span className={`block ${h.stage !== "expansion" && h.day === null ? "text-muted-foreground" : ""}`}>{hubStageText(h)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {h.stage === "expansion" ? "Expansion" : "Rollout"}
                          {h.stagePrompt && <span className="ml-1.5 font-medium text-amber-700" data-hub-stage-prompt>· ready to move on</span>}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums">{h.waitingOnCustomer || <span className="text-muted-foreground">0</span>}</td>
                      <td className="px-3 py-3 tabular-nums" title={needsLine(h.needs) || undefined}>{h.waitingOnUs ? <span className="font-medium text-amber-700">{h.waitingOnUs}</span> : <span className="text-muted-foreground">0</span>}</td>
                      <td className="px-3 py-3 tabular-nums">
                        {h.views30}
                        {h.people30 > 0 && <span className="text-muted-foreground"> · {h.people30} {h.people30 === 1 ? "person" : "people"}</span>}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{fmtWhen(h.lastVisitAt)}</td>
                      <td className="px-3 py-2">
                        <span className="flex justify-end gap-0.5">
                          <IconButton label={h.status === "live" ? "Open the hub as me" : "Publish the hub to open it"} disabled={h.status !== "live"} onClick={() => openAsMe(h.pageId)} data-hub-open={String(h.pageId)}>
                            <ExternalLink className="h-4 w-4" />
                          </IconButton>
                          <IconButton label={h.url ? "Copy the customer's link" : "Publish the hub to get its link"} disabled={!h.url} onClick={() => copyLink(h.url)}>
                            <Copy className="h-4 w-4" />
                          </IconButton>
                          <Link href={`/builder/${h.pageId}`} onClick={(e) => e.stopPropagation()} title="Edit content" aria-label="Edit content" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <IconButton label="Settings" onClick={() => open(h.pageId, "settings")} data-hub-settings={String(h.pageId)}>
                            <Settings className="h-4 w-4" />
                          </IconButton>
                          {h.archived ? (
                            <IconButton label="Bring this hub back" onClick={() => void setArchived(h, false)} data-hub-restore={String(h.pageId)}>
                              <ArchiveRestore className="h-4 w-4" />
                            </IconButton>
                          ) : (
                            <IconButton label="Archive this hub" onClick={() => void setArchived(h, true)} data-hub-archive={String(h.pageId)}>
                              <Archive className="h-4 w-4" />
                            </IconButton>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">{q ? `No hubs match "${q}".` : effectiveScope === "archived" ? "No archived hubs." : "No hubs here."}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <NewHubDialog
        open={creating}
        onClose={() => setCreating(false)}
        onOpenHub={(pageId, created) => {
          setCreating(false);
          void qc.invalidateQueries({ queryKey: ["partner-hubs"] });
          if (created) toast({ title: "Hub created", description: "It's a draft. The checklist shows what's left." });
          open(pageId, created ? "kit" : hubLandingTab(hubs.find((h) => h.pageId === pageId) ?? {}));
        }}
      />
    </SalesLayout>
  );
}
