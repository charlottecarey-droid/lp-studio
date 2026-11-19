import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Pencil, Plus, Search, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SalesLayout } from "@/components/layout/sales-layout";
import { SalesPageHeader } from "@/components/sales/sales-page-header";
import { toast } from "@/hooks/use-toast";
import { fmtWhen } from "@/components/analytics/RoomPerformance";
import type { RoomPanelTab } from "@/components/analytics/PageRoomPanel";
import { filterHubs, sortHubs, type HubRow } from "./sales-partner-hubs-shared";

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
  setup: { key: string; title: string; done: boolean; where: "builder" | "kit" | "settings" }[];
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

/* ── One hub: the pop-up ──────────────────────────────────────────────────── */

function HubDialog({ pageId, tab, onTab, onClose }: { pageId: number | null; tab: RoomPanelTab; onTab: (t: RoomPanelTab) => void; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["partner-hub-setup", pageId],
    enabled: pageId !== null,
    queryFn: async () => {
      const r = await json<HubSetup>(`/api/lp/partner-rooms/${pageId}/setup`);
      return r.ok ? r.data : null;
    },
  });
  const todo = (data?.setup ?? []).filter((s) => !s.done);
  return (
    <Dialog open={pageId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto" data-hub-dialog>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {data?.name ?? "Partner Hub"}
            {data && <span className={`text-sm font-normal ${data.status === "live" ? "text-emerald-700" : "text-muted-foreground"}`}>{data.status === "live" ? "Live" : "Draft"}</span>}
          </DialogTitle>
          <DialogDescription className="sr-only">Manage this Partner Hub</DialogDescription>
        </DialogHeader>
        {pageId !== null && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <a href={`/builder/${pageId}`} target="_blank" rel="noopener" data-hub-edit>
                  <Pencil className="h-3.5 w-3.5" /> Edit content
                </a>
              </Button>
              {data?.url && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyLink(data.url)}>
                  <Copy className="h-3.5 w-3.5" /> Copy link
                </Button>
              )}
            </div>
            {todo.length > 0 && (
              <section className="rounded-md border px-4 py-3" data-hub-setup>
                <h4 className="text-sm font-semibold">
                  Still to do before the customer can use it <span className="font-normal text-muted-foreground">· {todo.length} of {data?.setup.length}</span>
                </h4>
                <ul className="mt-2 divide-y">
                  {todo.map((s) => (
                    <li key={s.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span>{s.title}</span>
                      {s.where === "builder" ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={`/builder/${pageId}`} target="_blank" rel="noopener">Open editor</a>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => onTab(s.where === "kit" ? "kit" : "settings")}>{s.where === "kit" ? "Launch kit" : "Invite"}</Button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <Suspense fallback={<Skeleton className="h-40 w-full" />}>
              {/* The panel reads its starting tab once, so a new tab choice remounts it. */}
              <PageRoomPanel key={`${pageId}-${tab}`} pageId={pageId} initialTab={tab} embedded />
            </Suspense>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const HUB_TABS: RoomPanelTab[] = ["performance", "goals", "activity", "kit", "practices", "calendar", "settings"];
const tabFromSearch = (search: string): RoomPanelTab => {
  const t = new URLSearchParams(search).get("tab") as RoomPanelTab | null;
  return t && HUB_TABS.includes(t) ? t : "performance";
};

/* ── The list ─────────────────────────────────────────────────────────────── */

export default function SalesPartnerHubs() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/sales/partner-hubs/:id");
  const openId = params?.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const qc = useQueryClient();
  // The list and an open hub are two routes, so opening one remounts this page: the tab to land on rides in the URL.
  const [tab, setTab] = useState<RoomPanelTab>(() => tabFromSearch(typeof window === "undefined" ? "" : window.location.search));
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["partner-hubs"],
    queryFn: async () => {
      const r = await json<{ hubs?: HubRow[] }>("/api/lp/partner-rooms");
      if (!r.ok) throw new Error(r.data.error ?? "Could not load");
      return r.data.hubs ?? [];
    },
  });
  const hubs = data ?? [];
  const anyMine = hubs.some((h) => h.mine);
  // A rep with no hubs of their own starts on everyone's rather than an empty table.
  const effectiveScope = scope === "mine" && !anyMine ? "all" : scope;
  const rows = useMemo(() => sortHubs(filterHubs(hubs, { scope: effectiveScope, q })), [hubs, effectiveScope, q]);

  const open = (pageId: number, t: RoomPanelTab) => {
    setTab(t);
    navigate(`/sales/partner-hubs/${pageId}${t === "performance" ? "" : `?tab=${t}`}`);
  };
  const close = () => {
    navigate("/sales/partner-hubs");
    // Publishing, invites and uploads in the pop-up change what the row shows.
    void qc.invalidateQueries({ queryKey: ["partner-hubs"] });
  };

  return (
    <SalesLayout>
      <div className="space-y-6">
        <SalesPageHeader
          title="Partner Hubs"
          description="The shared workspace each new partner gets: their plan, launch kit, practices and requests in one place."
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
                {(["mine", "all"] as const).map((s) => (
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
                    {s === "mine" ? "My hubs" : "All hubs"}
                  </button>
                ))}
              </div>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hubs" className="pl-9" aria-label="Search hubs" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[820px] text-sm" data-hub-table>
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-normal">Account</th>
                    <th className="px-3 py-2.5 font-normal">Rollout</th>
                    <th className="px-3 py-2.5 font-normal">Waiting on them</th>
                    <th className="px-3 py-2.5 font-normal">Waiting on us</th>
                    <th className="px-3 py-2.5 font-normal">Views, 30 days</th>
                    <th className="px-3 py-2.5 font-normal">Last visit</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h) => (
                    <tr key={h.pageId} className="cursor-pointer border-b last:border-0 hover:bg-muted/40" onClick={() => open(h.pageId, "performance")} data-hub-row={h.pageId}>
                      <td className="px-4 py-3">
                        <span className="block font-medium">{h.name}{h.test ? " (test)" : ""}</span>
                        <span className="block text-xs text-muted-foreground">
                          <span className={h.status === "live" ? "text-emerald-700" : ""}>{h.status === "live" ? "Live" : "Draft"}</span>
                          {h.account?.owner ? ` · ${h.account.owner}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums">{h.day === null ? <span className="text-muted-foreground">Not started</span> : `Day ${h.day}`}</td>
                      <td className="px-3 py-3 tabular-nums">{h.waitingOnCustomer || <span className="text-muted-foreground">0</span>}</td>
                      <td className="px-3 py-3 tabular-nums">{h.waitingOnUs ? <span className="font-medium text-amber-700">{h.waitingOnUs}</span> : <span className="text-muted-foreground">0</span>}</td>
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
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No hubs match "{q}".</td>
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
          open(pageId, created ? "kit" : "performance");
        }}
      />
      <HubDialog pageId={openId} tab={tab} onTab={setTab} onClose={close} />
    </SalesLayout>
  );
}
