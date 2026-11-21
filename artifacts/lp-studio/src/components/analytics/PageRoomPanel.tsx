import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Download, DoorOpen, RotateCcw, Trash2, Upload, UserCheck, UserX, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PdfUploadButton } from "@/components/PdfUploadButton";
import { RoomInviteSection } from "./RoomInvite";
import { RoomPerformance } from "./RoomPerformance";
import { RoomGoalsSection, type HubGoals } from "./RoomGoals";
import { RoomCoverSection, type HubCover } from "./RoomCover";
import { RoomStagePrompt, RoomStageSection, STAGE_LABEL, type HubStage } from "./RoomStage";
import { OutreachSetting, RoomPlays } from "./RoomPlays";
import { RoomLinksSection, type HubLink } from "./RoomLinks";
import { RoomPlanQueueSection, type PlanQueueItem } from "./RoomPlanQueue";
import { RoomReminderSection } from "./RoomReminder";
import { RoomSlackPreview } from "./RoomSlackPreview";
import { ROOM_OVERVIEW_SECTIONS, roomMarketingNames, type RoomOverviewSection } from "@/blocks/BlockRoomWorkspace";

/**
 * Partner room — the team's side of a room page (a page whose plan has tasks
 * visitors can complete): who is allowed to act, what the customer has done,
 * and the files they uploaded. Uploaded files are downloadable ONLY here.
 * Reads GET /api/lp/partner-rooms/:pageId and renders nothing for a page
 * that is not a room.
 */
interface RoomDetail {
  isRoom: boolean;
  settings: { allowedDomains: string[]; slackChannelId: string | null; sfdcAccountId?: string | null; asanaProjectGid?: string | null };
  practices?: { total: number; byStage: Record<string, number>; regions: string[] };
  digest?: { enabled: boolean; recipients: string[]; lastSentAt: string | null };
  sheet?: { id: string | null; tab: string | null; syncedAt: string | null; note: string | null; filterColumn?: string | null; filterValue?: string | null };
  revopsSlackMention?: string | null;
  /** Post to Slack when someone from the customer opens the hub. */
  visitAlert?: boolean;
  /** How the hub tells the team about activity, and who an email goes to (null = no account owner we can match). */
  notify?: { via: "slack" | "email" | "both"; owner: string | null };
  /** Who a reminder can go to, and when the last one went. */
  reminder?: { lastAt: string | null; people: string[] };
  calendar?: { id: string | null; syncedAt: string | null; note: string | null; connection?: { googleEmail: string; status: string; mine: boolean } | null };
  events?: RoomEventRow[];
  /** The hub's goals as stored on the page (workspace hubs only). */
  goals?: HubGoals | null;
  /** The hub's cover text and style as stored on the page (workspace hubs only). */
  cover?: HubCover | null;
  /** Parts of the hub's Overview that are switched off (workspace hubs only). */
  overviewHidden?: RoomOverviewSection[] | null;
  /** The hub's Important links as stored on the page (workspace hubs only). */
  links?: HubLink[] | null;
  stage?: HubStage | null;
  kit?: { partnerName: string; partnerLogoUrl: string; heroImageUrl: string; partnerLogoScale?: number; brandLogoScale?: number; signupUrl: string; assets: { key: string; title: string; kind: string; hasFile: boolean; hidden: boolean; url?: string; madeFrom?: string }[]; texts?: { title: string; description: string; body: string }[]; links?: { title: string; url: string }[]; automatic?: boolean } | null;
  engagement?: {
    assets: { key: string; title: string; kind: string; views: number; downloads: number; seconds: number; maxProgress: number; people: string[]; anonymous: number; lastAt: string }[];
    recent: { title: string; action: string; value: number | null; who: string | null; at: string }[];
  };
  tasks: { key: string; title: string; action: "check" | "upload"; done: boolean; completedBy: string | null; completedAt: string | null }[];
  members: { id: number; email: string; status: "allowed" | "requested" | "denied"; updatedAt: string }[];
  isWorkspace?: boolean;
  /** False while the hub is a draft (the customer's link does not work yet). */
  published?: boolean;
  /** The marketing plan as a queue: what the customer said yes to, and whether marketing has it yet. */
  planQueue?: PlanQueueItem[];
  choices?: { key: string; title: string; options: string[]; value: string | null; chosenBy: string | null; chosenAt: string | null }[];
  contacts?: { id: number; name: string; role: string | null; email: string | null; addedBy: string; createdAt: string }[];
  wins?: { id: number; body: string; headline: string | null; side: string; by: string; createdAt: string; likes: number; comments: { id: number; body: string; by: string }[] }[];
  requests: { id: number; kind: string; subject: string; details: string | null; status: string; owner: string | null; due: string | null; requestedBy: string; createdAt: string; asanaTaskGid?: string | null }[];
  uploads: { id: number; taskKey: string; taskTitle: string; fileName: string; sizeBytes: number; uploadedBy: string; uploadedByEmail: string; createdAt: string }[];
}

interface RoomMinutesDraft {
  summary: string;
  decisions: string[];
  actions: { text: string; owner?: string; due?: string; done?: boolean }[];
}
interface RoomEventRow {
  id: number;
  title: string;
  startsAt: string;
  allDay: boolean;
  hidden: boolean;
  attendees: string | null;
  hasNotes: boolean;
  minutesStatus: "draft" | "published" | "dismissed" | null;
  minutes: RoomMinutesDraft | null;
}

/** "Send the roster | Levi | Feb 2" per line ↔ action items. A leading "x " marks one done. */
const actionsToText = (a: RoomMinutesDraft["actions"]) => a.map((x) => `${x.done ? "x " : ""}${[x.text, x.owner ?? "", x.due ?? ""].join(" | ").replace(/( \| )+$/, "")}`).join("\n");
const textToActions = (t: string): RoomMinutesDraft["actions"] =>
  t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const done = /^x\s+/i.test(l);
    const [text, owner, due] = l.replace(/^x\s+/i, "").split("|").map((p) => p.trim());
    return { text: text ?? "", ...(owner ? { owner } : {}), ...(due ? { due } : {}), ...(done ? { done: true } : {}) };
  });

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`);

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (r.ok) return null;
  try {
    const j = (await r.json()) as { error?: string };
    return j.error ?? "Something went wrong";
  } catch {
    return "Something went wrong";
  }
}

type PracticeSource = "sheet" | "salesforce" | "paste";
const PRACTICE_COLUMNS = "name, region, wave, stage, training date, live date";

/** A settings group that opens on click, so the Settings tab reads as a short list. */
function Fold({ title, hint, defaultOpen = false, children, ...rest }: { title: string; hint?: string; defaultOpen?: boolean; children: React.ReactNode } & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <details className="group rounded-md border" open={defaultOpen || undefined} {...rest}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t p-3">{children}</div>
    </details>
  );
}

export type RoomPanelTab = "performance" | "plays" | "goals" | "activity" | "kit" | "practices" | "calendar" | "settings";
/** A file the Room panel just put in the launch kit. The builder applies it to its own copy of the page too, so its next save keeps it. */
/** A link added to the launch kit from the Room panel (the practice microsite). */
export interface RoomKitLinkChange {
  key: string;
  title: string;
  description: string;
  url: string;
}

export interface RoomKitAssetChange { key: string; kind: "pdf" | "image"; title: string; description?: string; fileUrl: string; /** What a generated file was made from; absent for an upload. */ madeFrom?: string }

export function PageRoomPanel({ pageId, onKitAssets, onKitLink, onGoals, onCover, onOverview, onLinks, onStage, initialTab = "activity", embedded = false }: { pageId: number; onKitAssets?: (assets: RoomKitAssetChange[]) => void; /** Goals were saved on the page: lets an open builder update its own copy. */ onGoals?: (goals: HubGoals) => void; /** The cover was saved on the page: the builder keeps its copy the same. */ onCover?: (cover: HubCover) => void; /** Overview sections were shown or hidden on the page: the builder keeps its copy the same. */ onOverview?: (hidden: RoomOverviewSection[]) => void; /** Important links were changed on the page: the builder keeps its copy the same. */ onLinks?: (links: HubLink[]) => void; /** The stage, waves or timeline were saved on the page: lets an open builder update its own copy. */ onStage?: (stage: HubStage) => void; /** The practice microsite was linked in the launch kit: lets an open builder add it to its own copy. */ onKitLink?: (link: RoomKitLinkChange) => void; initialTab?: RoomPanelTab; /** Inside a pop-up that already names the hub: no card frame, title or intro. */ embedded?: boolean }) {
  // Plays used to be a tab of their own; they are part of To do now, so an old link to them lands there.
  // Goals are set once and rarely touched: they live in Settings now, so an old link to them lands there with Goals open.
  const [tab, setTab] = useState<RoomPanelTab>(initialTab === "plays" ? "activity" : initialTab === "goals" ? "settings" : initialTab);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["page-room", pageId],
    queryFn: async () => {
      const r = await fetch(`/api/lp/partner-rooms/${pageId}`);
      if (!r.ok) return null;
      return (await r.json()) as RoomDetail;
    },
  });
  const [domains, setDomains] = useState("");
  const [channel, setChannel] = useState("");
  const [sfdcId, setSfdcId] = useState("");
  const [asanaProject, setAsanaProject] = useState("");
  const [csv, setCsv] = useState("");
  const [fromCustomer, setFromCustomer] = useState(false);
  const [source, setSource] = useState<PracticeSource>("sheet");
  const [note, setNote] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetTab, setSheetTab] = useState("");
  const [filterCol, setFilterCol] = useState("");
  const [filterVal, setFilterVal] = useState("");
  const [revopsMention, setRevopsMention] = useState("");
  const [notifyVia, setNotifyVia] = useState<"slack" | "email" | "both">("slack");
  // The workspace's Slack channels, so a rep picks one by name instead of pasting an ID. Empty = Slack isn't connected.
  const { data: slackChannels } = useQuery({
    queryKey: ["slack-channels"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await fetch("/api/sales/slack/channels");
      if (!r.ok) return [] as { id: string; name: string }[];
      const j = (await r.json().catch(() => ({}))) as { channels?: { id: string; name: string }[] };
      return Array.isArray(j.channels) ? j.channels : [];
    },
  });
  const [digestOn, setDigestOn] = useState(false);
  const [digestTo, setDigestTo] = useState("");
  const [preview, setPreview] = useState<{ subject: string; html: string; recipients: string[]; slackText: string; slackHeader?: string; slackContext?: string; empty: boolean } | null>(null);
  const [digestNote, setDigestNote] = useState("");
  const [compare, setCompare] = useState<{ uploadId: number; fileName: string; practices: { uploaded: number; inRoom: number; matched: number; missingFromRoom: string[]; notOnUpload: string[]; sheet: string } | null; doctors: { count: number; sheet: string } | null } | null>(null);
  const [revops, setRevops] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<"" | "access" | "connections">("");
  const [openNote, setOpenNote] = useState("");

  useEffect(() => {
    if (!data) return;
    setDomains(data.settings.allowedDomains.join(", "));
    setChannel(data.settings.slackChannelId ?? "");
    setSfdcId(data.settings.sfdcAccountId ?? "");
    setAsanaProject(data.settings.asanaProjectGid ?? "");
    setSheetUrl(data.sheet?.id ? `https://docs.google.com/spreadsheets/d/${data.sheet.id}` : "");
    setSheetTab(data.sheet?.tab ?? "");
    setFilterCol(data.sheet?.filterColumn ?? "");
    setFilterVal(data.sheet?.filterValue ?? "");
    setRevopsMention(data.revopsSlackMention ?? "");
    setNotifyVia(data.notify?.via ?? "slack");
    setDigestOn(!!data.digest?.enabled);
    setDigestTo((data.digest?.recipients ?? []).join(", "));
  }, [data]);

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!data || !data.isRoom) return null;

  const base = `/api/lp/partner-rooms/${pageId}`;
  const refresh = () => qc.invalidateQueries({ queryKey: ["page-room", pageId] });
  const run = async (p: Promise<string | null>) => {
    setSaved("");
    const err = await p;
    setError(err ?? "");
    if (!err) await refresh();
    return !err;
  };

  const saveSettings = async (from: "access" | "connections") => {
    const list = domains.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean);
    if (await run(send(`${base}/settings`, "PATCH", { allowedDomains: list, slackChannelId: channel.trim(), sfdcAccountId: sfdcId.trim(), asanaProjectGid: asanaProject.trim(), revopsSlackMention: revopsMention.trim(), notifyVia }))) setSaved(from);
  };
  const baseSettings = () => ({ allowedDomains: domains.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean), slackChannelId: channel.trim(), sfdcAccountId: sfdcId.trim(), asanaProjectGid: asanaProject.trim() });
  const post = async (url: string, body?: unknown): Promise<{ ok: boolean; json: Record<string, unknown> }> => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    setError(r.ok ? "" : String(json.error ?? "Something went wrong"));
    return { ok: r.ok, json };
  };
  /** Save which sheet the practice list comes from ("" disconnects it), then read it. */
  const saveSheet = async (url: string) => {
    setNote("");
    const err = await send(`${base}/settings`, "PATCH", { ...baseSettings(), practicesSheet: url, practicesSheetTab: sheetTab.trim(), practicesSheetFilterColumn: filterCol.trim(), practicesSheetFilterValue: filterVal.trim() });
    setError(err ?? "");
    if (err) return;
    if (url) {
      const r = await post(`${base}/practices/sync-sheet`);
      if (r.ok) setNote(String(r.json.note ?? "Sheet read."));
    } else setNote("Sheet disconnected. The practices already loaded stay.");
    await refresh();
  };
  const setMember = (email: string, status: "allowed" | "denied" | null) => run(send(`${base}/members`, "POST", { email, status }));

  const requests = data.members.filter((m) => m.status === "requested");
  const others = data.members.filter((m) => m.status !== "requested");
  const openRequests = (data.requests ?? []).filter((q) => q.status !== "done");
  const doneRequests = (data.requests ?? []).filter((q) => q.status === "done");
  // What the To do tab is for: people asking to get in, programs to send to marketing, and requests nobody has picked up.
  const needsYou = requests.length + (data.planQueue ?? []).filter((i) => i.state === "queued").length + openRequests.filter((q) => q.status === "new").length;
  // "Launch kit" during the rollout, "Marketing" once the hub is past it.
  const kitNames = roomMarketingNames(data.stage?.stage);
  const goalAgreed = !!data.tasks.find((x) => x.key === "goals-agreed")?.done;
  const allowedPeople = others.filter((m) => m.status === "allowed").length;
  const noAccessYet = data.settings.allowedDomains.length === 0 && !data.members.some((m) => m.status === "allowed");

  return (
    <Card data-testid="page-room-panel" className={embedded ? "border-0 bg-transparent shadow-none" : undefined}>
      <CardHeader className={embedded ? "space-y-1 p-0 pb-4" : "space-y-1"}>
        {!embedded && (
          <>
            <CardTitle className="text-base flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-muted-foreground" />
              Hub
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              What the customer has done and sent, and who has access.
            </p>
          </>
        )}
        {data.isWorkspace && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-room-open-as-me
              onClick={async () => {
                setOpenNote("");
                const r = await fetch(`${base}/my-link`);
                const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
                if (r.ok && j.url) window.open(j.url, "_blank", "noopener");
                else setOpenNote(j.error ?? "Could not make your link");
              }}
            >
              Open the hub as me
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              title="Opens the hub without anything that is your team's only"
              data-room-open-as-customer
              onClick={async () => {
                setOpenNote("");
                const r = await fetch(`${base}/my-link?as=customer`);
                const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
                if (r.ok && j.url) window.open(j.url, "_blank", "noopener");
                else setOpenNote(j.error ?? "Could not make the link");
              }}
            >
              View as the customer
            </Button>
            {openNote && <span className="text-xs text-muted-foreground">{openNote}</span>}
          </div>
        )}
      </CardHeader>
      <CardContent className={embedded ? "space-y-6 p-0" : "space-y-6"}>
        {data.isWorkspace && data.stage && (
          <RoomStagePrompt
            pageId={pageId}
            stage={data.stage}
            onSaved={async (st) => {
              onStage?.(st);
              await refresh();
            }}
          />
        )}
        {/* How the partnership is going, on every tab: these numbers used to be a trip to the customer's Scorecard. */}
        {data.isWorkspace && !!data.practices?.total && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-room-rollout-strip>
            {(
              [
                ["Live", data.practices.byStage.live ?? 0, `of ${data.practices.total} practices`],
                ["Trained", (data.practices.byStage.trained ?? 0) + (data.practices.byStage.live ?? 0), "trained or live"],
                ["Being scheduled", (data.practices.byStage.training_booked ?? 0) + (data.practices.byStage.scheduling ?? 0), "training booked or in progress"],
                ["Not started", data.practices.byStage.not_started ?? 0, data.stage?.day ? `Day ${data.stage.day} of ${data.stage.rolloutDays}` : ""],
              ] as [string, number, string][]
            ).map(([label, n, note]) => (
              <div key={label} className="rounded-md border px-3 py-2">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-xl font-semibold tabular-nums">{n}</div>
                {note && <div className="truncate text-xs text-muted-foreground">{note}</div>}
              </div>
            ))}
          </div>
        )}
        {data.isWorkspace && (data.goals?.items ?? []).filter((g) => !g.hidden).length > 0 && (
          <p className="-mt-3 text-xs text-muted-foreground" data-room-goal-line>
            Goals:{" "}
            {(["on-track", "pending", "done"] as const)
              .map((st) => [st, data.goals!.items.filter((g) => !g.hidden && g.status === st).length] as const)
              .filter(([, n]) => n > 0)
              .map(([st, n]) => `${n} ${st === "on-track" ? "on track" : st === "pending" ? (n === 1 ? "needs attention" : "need attention") : "achieved"}`)
              .join(" · ")}
            {" · "}
            <button type="button" className="underline" onClick={() => setTab("settings")}>Edit in Settings</button>
          </p>
        )}
        <div className="flex flex-wrap gap-1 border-b" role="tablist" aria-label="Hub sections">
          {(
            [
              { id: "activity", label: "To do", count: needsYou },
              ...(data.isWorkspace ? [{ id: "performance", label: "Engagement", count: 0 }] : []),
              ...(data.isWorkspace ? [{ id: "kit", label: kitNames.kit, count: 0 }] : []),
              ...(data.isWorkspace ? [{ id: "practices" as const, label: "Practices", count: 0 }] : []),
              ...(data.isWorkspace ? [{ id: "calendar", label: "Calendar", count: (data.events ?? []).filter((e) => e.minutesStatus === "draft").length }] : []),
              { id: "settings", label: "Settings", count: 0 },
            ] as { id: RoomPanelTab; label: string; count: number }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.id ? "border-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-room-tab={t.id}
            >
              {t.label}
              {t.count > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">{t.count}</span>}
            </button>
          ))}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {tab === "performance" && data.isWorkspace && <RoomPerformance pageId={pageId} stage={data.stage?.stage} />}
        {tab === "activity" && (
          <div className="space-y-6" data-room-todo>
            {needsYou === 0 && <p className="rounded-md border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">Nothing needs you right now.</p>}

            {/* Most pressing first: someone locked out, then what the customer asked us for, then what we owe marketing,
                then what they sent, then what we are waiting on them for. Reference and ideas come last. */}
            {requests.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Asking for access</h4>
            {requests.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span className="text-sm">{m.email} <span className="text-muted-foreground">· asked {fmtDate(m.updatedAt)}</span></span>
                <span className="flex gap-2">
                  <Button size="sm" variant="brand" className="h-8 gap-1" onClick={() => setMember(m.email, "allowed")}><UserCheck className="h-3.5 w-3.5" /> Allow</Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setMember(m.email, "denied")}><UserX className="h-3.5 w-3.5" /> Decline</Button>
                </span>
              </div>
            ))}
              </section>
            )}

            {openRequests.length > 0 && (
              <section className="space-y-2">
                <div>
                  <h4 className="text-sm font-semibold">Requests from the customer</h4>
                  <p className="text-sm text-muted-foreground">They see the status, owner and due date you set.</p>
                </div>
                <div className="divide-y rounded-md border">
                  {openRequests.map((q) => (
                    <RequestRow key={q.id} q={q} onSave={(patch) => run(send(`${base}/requests/${q.id}`, "PATCH", patch))} />
                  ))}
                </div>
              </section>
            )}

            {data.isWorkspace && (data.planQueue ?? []).length > 0 && <RoomPlanQueueSection pageId={pageId} queue={data.planQueue!} onSent={refresh} />}

            {data.uploads.length > 0 && (
        <section className="space-y-2" data-room-files>
          <h4 className="text-sm font-semibold">Files the customer sent <span className="font-normal text-muted-foreground">· {data.uploads.length}</span></h4>
          {(
            <div className="divide-y rounded-md border">
              {data.uploads.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{u.fileName}</p>
                    <p className="text-xs text-muted-foreground">{u.taskTitle} · {u.uploadedBy} · {fmtDate(u.createdAt)} · {fmtSize(u.sizeBytes)}</p>
                  </div>
                  <span className="flex gap-2">
                    {data.isWorkspace && /\.(xlsx|csv|tsv|txt)$/i.test(u.fileName) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={async () => {
                          setRevops("");
                          const r = await post(`${base}/uploads/${u.id}/compare`);
                          if (r.ok) setCompare({ uploadId: u.id, ...(r.json as unknown as Omit<NonNullable<typeof compare>, "uploadId">) });
                        }}
                      >
                        Compare with practices
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline" className="h-8 gap-1">
                      <a href={`/api/lp/partner-rooms/uploads/${u.id}/download`}><Download className="h-3.5 w-3.5" /> Download</a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${u.fileName}`}
                      title="Delete this file"
                      data-room-upload-delete={u.id}
                      onClick={async () => {
                        const last = data.uploads.filter((x) => x.taskKey === u.taskKey).length === 1;
                        if (!window.confirm(`Delete “${u.fileName}”? This can’t be undone.${last ? ` “${u.taskTitle}” will be open again for the customer.` : ""}`)) return;
                        if (compare?.uploadId === u.id) setCompare(null);
                        await run(send(`${base}/uploads/${u.id}`, "DELETE"));
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
            )}

            {compare && (
          <section className="space-y-2 rounded-md border p-3" data-testid="room-compare">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold">Comparison: {compare.fileName}</h4>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" aria-label="Close comparison" onClick={() => setCompare(null)}><X className="h-4 w-4" /></Button>
            </div>
            {compare.practices ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Their list ({compare.practices.sheet}) has {compare.practices.uploaded} practices; we hold {compare.practices.inRoom}. {compare.practices.matched} match.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">On their list, not in ours ({compare.practices.missingFromRoom.length})</p>
                    <p className="text-xs text-muted-foreground">Salesforce is missing these.</p>
                    <ul className="mt-1 max-h-40 overflow-auto text-xs">{compare.practices.missingFromRoom.slice(0, 200).map((n) => <li key={n}>{n}</li>)}</ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium">In ours, not on their list ({compare.practices.notOnUpload.length})</p>
                    <p className="text-xs text-muted-foreground">Closed, renamed, or not in the rollout.</p>
                    <ul className="mt-1 max-h-40 overflow-auto text-xs">{compare.practices.notOnUpload.slice(0, 200).map((n) => <li key={n}>{n}</li>)}</ul>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No practice column found in this file.</p>
            )}
            {compare.doctors && <p className="text-sm text-muted-foreground">The roster ({compare.doctors.sheet}) lists {compare.doctors.count} doctors. Doctors can't be compared yet: LP Studio has no doctor records to compare against.</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="brand"
                disabled={!(compare.practices?.missingFromRoom.length || compare.doctors?.count)}
                onClick={async () => {
                  const r = await post(`${base}/revops-task`, { missing: compare.practices?.missingFromRoom ?? [], doctors: compare.practices ? 0 : compare.doctors?.count ?? 0, fileName: compare.fileName });
                  if (r.ok) setRevops(r.json.mentioned ? "Posted to the hub’s Slack channel, with RevOps mentioned. It also rides in the weekly Slack digest until the gap closes." : "Posted to the hub’s Slack channel. Nobody was mentioned: add a RevOps Slack mention under Settings.");
                }}
              >
                Post to Slack for RevOps
              </Button>
              {!!compare.practices?.missingFromRoom.length && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const blob = new Blob([["practice name", ...compare.practices!.missingFromRoom.map((n) => `"${n.replace(/"/g, '""')}"`)].join("\n")], { type: "text/csv" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "missing-from-salesforce.csv";
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  Download the missing list
                </Button>
              )}
              {revops && <span className="text-sm text-muted-foreground">{revops}</span>}
            </div>
          </section>
        )}

            {data.isWorkspace && (
              <RoomReminderSection
                pageId={pageId}
                waiting={[...data.tasks.filter((t) => !t.done).map((t) => t.title), ...(data.planQueue ?? []).filter((i) => i.state === "undecided").map((i) => `Decide: ${i.title}`)]}
                people={data.reminder?.people ?? []}
                lastAt={data.reminder?.lastAt ?? null}
                published={data.published !== false}
                onSent={refresh}
              />
            )}

            {/* Reference, not work: closed until someone wants it. */}
            <div className="space-y-2">
              {data.tasks.length > 0 && (
                <Fold title="What the customer has done" hint={`${data.tasks.filter((t) => t.done).length} of ${data.tasks.length} steps`}>
                  <div className="divide-y rounded-md border">
                    {data.tasks.map((t) => (
                      <div key={t.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{t.title}</p>
                          {t.done && <p className="text-xs text-muted-foreground">{[t.completedBy, fmtDate(t.completedAt)].filter(Boolean).join(" · ")}</p>}
                        </div>
                        {t.done ? (
                          <span className="flex items-center gap-2">
                            <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" /> Done</Badge>
                            <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" onClick={() => run(send(`${base}/tasks/${encodeURIComponent(t.key)}`, "DELETE"))}><RotateCcw className="h-3.5 w-3.5" /> Reopen</Button>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t.action === "upload" ? "Needs a file" : "Open"}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </Fold>
              )}
              {doneRequests.length > 0 && (
                <Fold title="Finished requests" hint={String(doneRequests.length)}>
                  <div className="divide-y rounded-md border">
                    {doneRequests.map((q) => (
                      <RequestRow key={q.id} q={q} onSave={(patch) => run(send(`${base}/requests/${q.id}`, "PATCH", patch))} />
                    ))}
                  </div>
                </Fold>
              )}
              {data.isWorkspace && (
                <Fold title="Wins" hint={(data.wins ?? []).length ? `${(data.wins ?? []).length} posted` : "Post one to the hub’s News Feed"}>
                  <WinsSection base={base} wins={data.wins ?? []} run={run} />
                </Fold>
              )}
              {(data.contacts ?? []).length > 0 && (
                <Fold title="People the customer added" hint={String(data.contacts!.length)}>
                  <div className="divide-y rounded-md border">
                    {data.contacts!.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="text-sm">{c.name}{c.role ? ` · ${c.role}` : ""}{c.email ? ` · ${c.email}` : ""} <span className="text-xs text-muted-foreground">added by {c.addedBy}</span></span>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Remove ${c.name}`} onClick={() => run(send(`${base}/contacts/${c.id}`, "DELETE"))}><X className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                </Fold>
              )}
              {/* Ideas, not obligations: last, and closed. */}
              {data.isWorkspace && (
                <Fold title="Suggested next moves" hint="Ideas worked out from this hub’s practices and what has already been sent" data-room-plays-fold>
                  <RoomPlays pageId={pageId} />
                </Fold>
              )}
            </div>
          </div>
        )}

        {tab === "practices" && data.isWorkspace && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold">Practices</h4>
                <p className="text-sm text-muted-foreground">
                  {data.practices?.total
                    ? `${data.practices.total} in the hub · ${data.practices.byStage.live ?? 0} live · ${(data.practices.byStage.trained ?? 0) + (data.practices.byStage.live ?? 0)} trained · ${data.practices.regions.length} regions`
                    : "None yet. Pick one way to add them."}
                </p>
              </div>
              {!!data.practices?.total && (
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => window.confirm("Remove every practice from this hub?") && run(send(`${base}/practices`, "DELETE"))}>Clear list</Button>
              )}
            </div>
            {/* One way of loading the list at a time, instead of all three stacked. */}
            <div className="flex w-fit gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="How to add practices">
              {([["sheet", data.sheet?.id ? "Google Sheet · connected" : "Google Sheet"], ["salesforce", "Salesforce"], ["paste", "Paste or upload"]] as [PracticeSource, string][]).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={source === id} onClick={() => { setSource(id); setNote(""); }} className={`rounded-md px-3 py-1.5 text-sm font-medium ${source === id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`} data-room-practice-source={id}>
                  {label}
                </button>
              ))}
            </div>
            {source === "sheet" && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Kept up to date from a sheet, checked about every hour. Columns: {PRACTICE_COLUMNS}.</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                  <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Sheet link</span><Input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" /></label>
                  <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Tab name</span><Input value={sheetTab} onChange={(e) => setSheetTab(e.target.value)} placeholder="Sheet1" /></label>
                </div>
                <details className="text-xs" open={!!(data.sheet?.filterColumn || data.sheet?.filterValue) || undefined}>
                  <summary className="cursor-pointer text-muted-foreground">The sheet lists other customers too</summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Column to check</span><Input value={filterCol} onChange={(e) => setFilterCol(e.target.value)} aria-label="Filter column" placeholder="Account" /></label>
                    <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Keep rows containing</span><Input value={filterVal} onChange={(e) => setFilterVal(e.target.value)} aria-label="Filter value" placeholder="This customer’s name" /></label>
                  </div>
                </details>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="brand" disabled={!sheetUrl.trim()} onClick={() => saveSheet(sheetUrl.trim())}>
                    {data.sheet?.id ? "Save and read again" : "Connect the sheet"}
                  </Button>
                  {data.sheet?.id && <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => { setSheetUrl(""); void saveSheet(""); }}>Disconnect</Button>}
                  {data.sheet?.id && (
                    <span className="text-xs text-muted-foreground">
                      Last read {fmtDate(data.sheet.syncedAt) || "never"}{data.sheet.note ? ` · ${data.sheet.note}` : ""}
                    </span>
                  )}
                </div>
              </div>
            )}
            {source === "salesforce" && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Adds this account’s practices from Salesforce and updates the ones already here.</p>
                <Button
                  size="sm"
                  variant="brand"
                  onClick={async () => {
                    setNote("");
                    const r = await fetch(`${base}/practices/sync-salesforce`, { method: "POST", headers: { "Content-Type": "application/json" } });
                    const j = (await r.json().catch(() => ({}))) as { error?: string; added?: number; updated?: number; note?: string };
                    setError(r.ok ? "" : j.error ?? "Sync failed");
                    if (r.ok) {
                      setNote(j.note ?? `${j.added ?? 0} added, ${j.updated ?? 0} updated from Salesforce.`);
                      await refresh();
                    }
                  }}
                >
                  Pull practices from Salesforce
                </Button>
              </div>
            )}
            {source === "paste" && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Updates practices by name and leaves the rest alone. First line: {PRACTICE_COLUMNS}.</p>
                <textarea
                  className="min-h-[88px] w-full rounded-md border bg-background p-2 font-mono text-xs"
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  placeholder={"name, region, wave, stage, training date, live date\nMain Street Clinic, West, 1, trained, 2026-01-12, 2026-01-20"}
                  aria-label="Paste a practice list"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={fromCustomer} onChange={(e) => setFromCustomer(e.target.checked)} data-room-import-from-customer />
                  The customer sent this list <span className="text-xs text-muted-foreground">(it then wins over the Google Sheet)</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="brand"
                    disabled={!csv.trim()}
                    onClick={async () => {
                      setNote("");
                      const r = await fetch(`${base}/practices/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv, fromCustomer }) });
                      const j = (await r.json().catch(() => ({}))) as { error?: string; added?: number; updated?: number };
                      setError(r.ok ? "" : j.error ?? "Import failed");
                      if (r.ok) {
                        setNote(`${j.added ?? 0} added, ${j.updated ?? 0} updated.`);
                        setCsv("");
                        await refresh();
                      }
                    }}
                  >
                    Import pasted list
                  </Button>
                  <span className="text-xs text-muted-foreground">or</span>
                  <label className="inline-flex h-8 cursor-pointer items-center whitespace-nowrap rounded-md border px-3 text-sm hover:bg-muted/50">
                    Upload .xlsx or .csv
                    <input
                      type="file"
                      accept=".xlsx,.csv"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        setNote("");
                        if (file.size > 7 * 1024 * 1024) return setError("That file is over 7 MB.");
                        const bytes = new Uint8Array(await file.arrayBuffer());
                        let bin = "";
                        for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
                        const r = await fetch(`${base}/practices/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, fileBase64: btoa(bin), fromCustomer }) });
                        const j = (await r.json().catch(() => ({}))) as { error?: string; added?: number; updated?: number; sheet?: string };
                        setError(r.ok ? "" : j.error ?? "Import failed");
                        if (r.ok) {
                          setNote(`${j.added ?? 0} added, ${j.updated ?? 0} updated${j.sheet ? ` from “${j.sheet}”` : ""}.`);
                          await refresh();
                        }
                      }}
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">Stages: not started, scheduling, training booked, trained, live. A scanner tracker export also adds scanner counts and models.</p>
              </div>
            )}
            {note && <p className="text-sm text-muted-foreground" role="status">{note}</p>}
          </section>
        )}

        {tab === "kit" && data.isWorkspace && data.links && (
          <RoomLinksSection
            pageId={pageId}
            links={data.links}
            moduleName={kitNames.module}
            views={data.engagement?.assets}
            onSaved={async (l) => {
              onLinks?.(l);
              await refresh();
            }}
          />
        )}

        {tab === "kit" && data.isWorkspace && data.kit && <LaunchAssetsSection expansion={data.stage?.stage === "expansion"} pageId={pageId} kit={data.kit} refresh={refresh} onKitAssets={onKitAssets} onKitLink={onKitLink} />}

        {tab === "kit" && data.isWorkspace && (
          <Fold title="Who opened what" hint={(data.engagement?.assets ?? []).length ? `${(data.engagement?.assets ?? []).length} opened in the last 90 days` : "Nothing opened yet"}>
            <EngagementSection engagement={data.engagement} kitName={kitNames.kit === "Marketing" ? "Marketing" : "the launch kit"} />
          </Fold>
        )}


        {tab === "calendar" && data.isWorkspace && <CalendarSection base={base} calendar={data.calendar} events={data.events ?? []} hasDomain={data.settings.allowedDomains.length > 0} refresh={refresh} />}

        {tab === "settings" && (
          <div className="space-y-2" data-room-settings>
            <Fold title="Who has access" hint={noAccessYet ? "No one yet" : [data.settings.allowedDomains.join(", "), allowedPeople ? `${allowedPeople} ${allowedPeople === 1 ? "person" : "people"}` : ""].filter(Boolean).join(" · ")} defaultOpen>
              <p className="text-xs text-muted-foreground">Anyone with the link can view. These people can also upload, comment and mark tasks done.</p>
              {noAccessYet && (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  No one is allowed yet. Add the customer’s email domain, or people one by one.
                </p>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <label className="block min-w-[240px] flex-1 space-y-1 text-xs">
                  <span className="font-medium text-muted-foreground">Everyone at these email domains</span>
                  <Input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="customer.com, customergroup.com" />
                </label>
                <Button size="sm" variant="brand" onClick={() => saveSettings("access")}>Save</Button>
                {saved === "access" && <span className="pb-2 text-sm text-muted-foreground">Saved</span>}
              </div>
            <form
              className="flex items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (newEmail.trim() && (await setMember(newEmail.trim(), "allowed"))) setNewEmail("");
              }}
            >
              <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Or allow one person</span><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-64" placeholder="dana@customer.com" /></label>
              <Button type="submit" size="sm" variant="outline">Allow</Button>
            </form>
            {others.length > 0 && (
              <div className="divide-y rounded-md border">
                {others.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm">{m.email}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant={m.status === "allowed" ? "secondary" : "outline"}>{m.status === "allowed" ? "Allowed" : "Declined"}</Badge>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Remove ${m.email}`} onClick={() => setMember(m.email, null)}><X className="h-4 w-4" /></Button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            </Fold>

            {data.isWorkspace && (
              <Fold title="Invite the customer’s team" hint="Email each person their own link">
                <RoomInviteSection pageId={pageId} onInvited={refresh} />
              </Fold>
            )}

            {data.isWorkspace && data.goals && (
              <Fold title="Goals" hint={data.goals.items.length ? `${data.goals.items.length} set${goalAgreed ? " · agreed by the customer" : ""}` : "None set yet"} defaultOpen={initialTab === "goals"} data-room-goals-fold>
              <RoomGoalsSection
                pageId={pageId}
                goals={data.goals}
                byStage={data.practices?.total ? data.practices.byStage : undefined}
                agreement={(() => {
                  const t = data.tasks.find((x) => x.key === "goals-agreed");
                  return t ? { done: t.done, by: t.completedBy, at: t.completedAt } : null;
                })()}
                onSaved={async (g) => {
                  onGoals?.(g);
                  await refresh();
                }}
              />
              </Fold>
            )}

            {data.isWorkspace && data.stage && (
              <Fold title="Stage and waves" hint={`${STAGE_LABEL[data.stage.stage]} · ${data.stage.waves.length} wave${data.stage.waves.length === 1 ? "" : "s"}`}>
                <RoomStageSection
                  pageId={pageId}
                  stage={data.stage}
                  onSaved={async (st) => {
                    onStage?.(st);
                    await refresh();
                  }}
                />
              </Fold>
            )}

            {data.isWorkspace && data.cover && (
              <Fold title="Cover" hint="Headline and photo style at the top of the hub">
                <RoomCoverSection
                  pageId={pageId}
                  cover={data.cover}
                  onSaved={async (c) => {
                    onCover?.(c);
                    await refresh();
                  }}
                />
              </Fold>
            )}

            {data.isWorkspace && data.overviewHidden && (
              <Fold title="Overview sections" hint={data.overviewHidden.length ? `${data.overviewHidden.length} hidden` : "All shown"} data-room-overview-settings>
                <p className="text-xs text-muted-foreground">What the customer sees on the hub’s Overview. Changes save straight away.</p>
                <div className="divide-y rounded-md border">
                  {ROOM_OVERVIEW_SECTIONS.map((sec) => {
                    const hidden = data.overviewHidden!.includes(sec.key);
                    return (
                      <label key={sec.key} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="font-medium">{sec.label}</span>
                          <span className="block text-xs text-muted-foreground">{sec.hint}</span>
                        </span>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!hidden}
                          aria-label={`Show ${sec.label} on the Overview`}
                          data-room-overview-toggle={sec.key}
                          onChange={async (e) => {
                            const next = ROOM_OVERVIEW_SECTIONS.map((x) => x.key).filter((k) => (k === sec.key ? !e.target.checked : data.overviewHidden!.includes(k)));
                            const r = await fetch(`${base}/overview`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hidden: next }) });
                            const j = (await r.json().catch(() => ({}))) as { hidden?: RoomOverviewSection[]; error?: string };
                            setError(r.ok ? "" : j.error ?? "Could not save the Overview");
                            if (r.ok) {
                              onOverview?.(j.hidden ?? next);
                              await refresh();
                            }
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </Fold>
            )}

            {data.isWorkspace && (
              <Fold title="Weekly digest" hint={data.digest?.enabled ? `On${data.digest.lastSentAt ? ` · last sent ${fmtDate(data.digest.lastSentAt)}` : ""}` : "Off"}>
                <p className="text-xs text-muted-foreground">Every Monday: an email to the customer and a Slack post.</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={digestOn} onChange={(e) => setDigestOn(e.target.checked)} />
              Send it for this hub
            </label>
            <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Customer emails</span><Input value={digestTo} onChange={(e) => setDigestTo(e.target.value)} placeholder="dana@customer.com, kai@customer.com" /></label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="brand"
                onClick={async () => {
                  setDigestNote("");
                  const err = await send(`${base}/settings`, "PATCH", { ...baseSettings(), digestEnabled: digestOn, digestRecipients: digestTo.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) });
                  setError(err ?? "");
                  if (!err) {
                    setDigestNote("Saved.");
                    await refresh();
                  }
                }}
              >
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={async () => { const r = await post(`${base}/digest/preview`); if (r.ok) setPreview(r.json as never); }}>Preview</Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!window.confirm("Send the digest now to the saved recipients and the Slack channel?")) return;
                  const r = await post(`${base}/digest/send`);
                  if (r.ok) setDigestNote(`Sent: ${String(r.json.emails ?? 0)} email${r.json.emails === 1 ? "" : "s"}${r.json.slack ? ", Slack posted" : ", Slack not posted"}.`);
                  await refresh();
                }}
              >
                Send now
              </Button>
              {digestNote && <span className="text-sm text-muted-foreground">{digestNote}</span>}
            </div>
            {preview && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm"><strong>{preview.subject}</strong><br /><span className="text-xs text-muted-foreground">To: {preview.recipients.length ? preview.recipients.join(", ") : "no recipients saved yet"}{preview.empty ? " · nothing to report this week, so the scheduled send would skip it" : ""}</span></p>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" aria-label="Close preview" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button>
                </div>
                <iframe title="Digest email preview" sandbox="" srcDoc={preview.html} className="h-[420px] w-full rounded border bg-white" />
                <p className="text-xs font-medium">Slack post, as your team will see it</p>
                <RoomSlackPreview header={preview.slackHeader || "Weekly digest"} text={preview.slackText} context={preview.slackContext} channel={slackChannels?.find((c) => c.id === channel)?.name} />
              </div>
            )}
              </Fold>
            )}

            <Fold title="Notifications and connections" hint={[notifyVia === "slack" ? "Slack" : notifyVia === "email" ? "Email to the account owner" : "Slack and email", ...(data.isWorkspace ? ["Salesforce, Asana"] : [])].join(" · ")}>
              <div className="space-y-1" data-room-notify>
                <label className="block max-w-sm space-y-1 text-xs">
                  <span className="font-medium text-muted-foreground">Tell us about activity in this hub by</span>
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={notifyVia} onChange={(e) => setNotifyVia(e.target.value as "slack" | "email" | "both")} data-room-notify-via>
                    <option value="slack">Slack</option>
                    <option value="email">Email to the account owner</option>
                    <option value="both">Both</option>
                  </select>
                </label>
                {notifyVia !== "slack" && (
                  <p className={`text-xs ${data.notify?.owner ? "text-muted-foreground" : "text-amber-700"}`}>
                    {data.notify?.owner ? `Emails go to ${data.notify.owner}.` : "No account owner could be matched to someone on your team, so no email would be sent. Set the owner on the account, or keep Slack on."}
                  </p>
                )}
                {notifyVia !== "email" && !channel.trim() && <p className="text-xs text-muted-foreground">With no channel ID below, posts go to your workspace’s default Slack channel.</p>}
              </div>
              <label className="block max-w-sm space-y-1 text-xs">
                <span className="font-medium text-muted-foreground">Slack channel</span>
                {slackChannels && slackChannels.length > 0 ? (
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={channel} onChange={(e) => setChannel(e.target.value)} data-room-slack-channel>
                    <option value="">The workspace’s default channel</option>
                    {/* A channel saved before, that the list no longer shows (archived, or the app was removed from it). */}
                    {channel && !slackChannels.some((c) => c.id === channel) && <option value={channel}>{channel}</option>}
                    {slackChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                ) : (
                  <Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Channel ID, e.g. C0123ABCD" />
                )}
              </label>
              {slackChannels && slackChannels.length === 0 && <p className="text-xs text-muted-foreground">Slack isn’t connected, or it has no channels to list. Connect it under Settings → Integrations, or paste a channel ID.</p>}
              {data.isWorkspace && (
                <details className="text-xs" open={!!(revopsMention || asanaProject) || undefined}>
                  <summary className="cursor-pointer font-medium text-muted-foreground">Advanced: Salesforce, Asana and RevOps</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1 text-xs">
                      <span className="font-medium text-muted-foreground">Salesforce account ID</span>
                      <Input value={sfdcId} onChange={(e) => setSfdcId(e.target.value)} placeholder="Filled in from the account" />
                    </label>
                    <label className="block space-y-1 text-xs">
                      <span className="font-medium text-muted-foreground">Asana project ID, if not the workspace’s</span>
                      <Input value={asanaProject} onChange={(e) => setAsanaProject(e.target.value)} placeholder="The long number in the project’s URL" />
                    </label>
                    <label className="block space-y-1 text-xs">
                      <span className="font-medium text-muted-foreground">Who to mention for RevOps</span>
                      <Input value={revopsMention} onChange={(e) => setRevopsMention(e.target.value)} placeholder="A Slack @mention" />
                    </label>
                  </div>
                </details>
              )}
              <div className="flex items-center gap-3">
                <Button size="sm" variant="brand" onClick={() => saveSettings("connections")}>Save</Button>
                {saved === "connections" && <span className="text-sm text-muted-foreground">Saved</span>}
              </div>
              {data.isWorkspace && <OutreachSetting pageId={pageId} />}
              {data.isWorkspace && (
                <label className="flex items-start gap-2 text-sm" data-room-visit-alert>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4"
                    checked={!!data.visitAlert}
                    onChange={async (e) => {
                      await run(send(`${base}/settings`, "PATCH", { visitAlert: e.target.checked }));
                    }}
                  />
                  <span>
                    <span className="font-medium">Post in Slack when the customer visits</span>
                    <span className="block text-xs text-muted-foreground">At most once per person every six hours. Your own team never triggers it.</span>
                  </span>
                </label>
              )}
            </Fold>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

const REQUEST_STATUS: [string, string][] = [["new", "Received"], ["in_progress", "In progress"], ["review", "Ready for their review"], ["done", "Done"]];
const REQUEST_KIND: Record<string, string> = { asset_change: "Asset change", marketing: "Marketing", training: "Training", event: "Event", reporting: "Reporting", other: "Other" };

function RequestRow({ q, onSave }: { q: RoomDetail["requests"][number]; onSave: (patch: { status?: string; owner?: string; due?: string }) => void }) {
  const [owner, setOwner] = useState(q.owner ?? "");
  const [due, setDue] = useState(q.due ?? "");
  // Owner and due date stay out of the way until someone wants to set them.
  const [editing, setEditing] = useState(false);
  const meta = [REQUEST_KIND[q.kind] ?? "Other", q.requestedBy, fmtDate(q.createdAt), q.owner ? `Owner: ${q.owner}` : "", q.due ? `Due: ${q.due}` : ""].filter(Boolean).join(" · ");
  return (
    <div className="px-3 py-2.5" data-room-request-row={q.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{q.subject}</p>
          <p className="truncate text-xs text-muted-foreground">
            {meta}
            {q.asanaTaskGid && !q.asanaTaskGid.startsWith("fake-") && (
              <>
                {" · "}
                <a className="underline" href={`https://app.asana.com/0/0/${q.asanaTaskGid}`} target="_blank" rel="noreferrer">In Asana</a>
              </>
            )}
          </p>
        </div>
        <select className="h-8 rounded-md border bg-background px-2 text-sm" value={q.status} onChange={(e) => onSave({ status: e.target.value })} aria-label={`Status of ${q.subject}`}>
          {REQUEST_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" aria-expanded={editing} onClick={() => setEditing((v) => !v)} data-room-request-edit>
          {editing ? "Close" : q.owner || q.due ? "Edit" : "Assign"}
        </Button>
      </div>
      {q.details && <p className={`mt-1 whitespace-pre-wrap text-sm text-muted-foreground ${editing ? "" : "line-clamp-2"}`}>{q.details}</p>}
      {editing && (
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Owner</span><Input value={owner} onChange={(e) => setOwner(e.target.value)} onBlur={() => owner !== (q.owner ?? "") && onSave({ owner })} className="h-8 w-56 text-sm" placeholder="Who is handling it" /></label>
          <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Due</span><Input value={due} onChange={(e) => setDue(e.target.value)} onBlur={() => due !== (q.due ?? "") && onSave({ due })} className="h-8 w-36 text-sm" placeholder="e.g. Dec 5" /></label>
        </div>
      )}
    </div>
  );
}

function WinsSection({ base, wins, run }: { base: string; wins: NonNullable<RoomDetail["wins"]>; run: (p: Promise<string | null>) => Promise<boolean> }) {
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  return (
    <section className="space-y-2">
      <form
        className="space-y-2 rounded-md border p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (body.trim() && (await run(send(`${base}/wins`, "POST", { headline: headline.trim(), body: body.trim() })))) {
            setHeadline("");
            setBody("");
          }
        }}
      >
        <label className="block space-y-1 text-xs flex-1"><span className="font-medium text-muted-foreground">Headline (optional)</span><Input value={headline} onChange={(e) => setHeadline(e.target.value)} className="h-8 text-sm" /></label>
        <label className="block space-y-1 text-xs flex-1"><span className="font-medium text-muted-foreground">Win</span><Input value={body} onChange={(e) => setBody(e.target.value)} className="h-8 text-sm" /></label>
        <Button type="submit" size="sm" variant="brand" disabled={!body.trim()}>Post to the hub</Button>
      </form>
      {wins.length > 0 && (
        <div className="divide-y rounded-md border">
          {wins.map((w) => (
            <div key={w.id} className="flex items-start justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm">{w.headline ? <strong>{w.headline}. </strong> : null}{w.body}</p>
                <p className="text-xs text-muted-foreground">{w.by} · {fmtDate(w.createdAt)} · {w.likes} likes · {w.comments.length} comments</p>
              </div>
              <Button size="sm" variant="ghost" className="h-8 w-8 shrink-0 p-0 text-muted-foreground" aria-label="Remove this win" onClick={() => run(send(`${base}/wins/${w.id}`, "DELETE"))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Calendar and minutes: connect a Google Calendar, hide a meeting from the
 * customer, and review the minutes drafted from a meeting's notes. A draft is
 * the team's only; Publish is what shows it to the customer.
 */
function CalendarSection({ base, calendar, events, hasDomain, refresh }: { base: string; calendar: RoomDetail["calendar"]; events: RoomEventRow[]; hasDomain: boolean; refresh: () => Promise<void> }) {
  const [calId, setCalId] = useState(calendar?.id ?? "");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [domain, setDomain] = useState("");
  /** The "add the domain first" message is already shown once, as a form; don't repeat it. */
  const domainFirst = (m: string | null | undefined) => !hasDomain && !!m && /email domain/i.test(m);
  useEffect(() => setCalId(calendar?.id ?? ""), [calendar?.id]);

  const { data: google, refetch: refetchGoogle } = useQuery({
    queryKey: ["google-connection"],
    queryFn: async () => {
      const r = await fetch("/api/lp/google/status");
      if (!r.ok) throw new Error("status");
      return (await r.json()) as {
        configured: boolean;
        setup?: { source: "workspace" | "signin"; redirectUri: string; clientIdTail: string; problem: string | null } | null;
        connection: { googleEmail: string; status: string; lastError: string | null } | null;
      };
    },
  });
  // Back from Google's consent screen: say how it went, then tidy the address bar.
  useEffect(() => {
    const u = new URL(window.location.href);
    const outcome = u.searchParams.get("google");
    if (!outcome) return;
    const msg: Record<string, string> = {
      connected: "Google is connected. Choose “Use my calendar for this hub” to start.",
      declined: "Google wasn’t connected: the request was cancelled.",
      missing_access: "Google wasn’t connected: both permissions (calendar and docs, read-only) need to stay ticked.",
      failed: "Google couldn’t be connected. Try again.",
    };
    if (outcome === "connected") setNote(msg.connected);
    else setErr(msg[outcome] ?? msg.failed);
    u.searchParams.delete("google");
    window.history.replaceState(null, "", u.toString());
  }, []);

  const connectGoogle = async () => {
    setBusy(true);
    const r = await fetch(`/api/lp/google/auth-url?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
    if (r.ok && j.url) window.location.href = j.url;
    else {
      setErr(j.error ?? "Could not start the Google connection");
      setBusy(false);
    }
  };
  const disconnectGoogle = async () => {
    setBusy(true);
    setErr((await send("/api/lp/google/connection", "DELETE")) ?? "");
    setNote("Google disconnected. Hubs that were reading your calendar have stopped; meetings already in them stay.");
    setBusy(false);
    await Promise.all([refetchGoogle(), refresh()]);
  };

  /** Save which calendar the room reads (through `via`), then read it. */
  const connect = async (via?: "mine" | null) => {
    setBusy(true);
    setNote("");
    const id = via === null ? "" : calId.trim() || (via === "mine" ? "primary" : "");
    let e = await send(`${base}/settings`, "PATCH", { calendarId: id, ...(via !== undefined ? { calendarConnection: via } : {}) });
    if (!e && id) {
      const r = await fetch(`${base}/calendar/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = (await r.json().catch(() => ({}))) as { note?: string; error?: string };
      if (r.ok) setNote(j.note ?? "Calendar read.");
      else e = j.error ?? "Could not read the calendar";
    } else if (!e) setNote("This hub stopped reading the calendar. Meetings already in the hub stay.");
    setErr(e ?? "");
    setBusy(false);
    await refresh();
  };
  const patch = async (id: number, body: unknown) => {
    const e = await send(`${base}/events/${id}`, "PATCH", body);
    setErr(e ?? "");
    await refresh();
    return !e;
  };

  const drafts = events.filter((e) => e.minutesStatus === "draft");
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.startsAt).getTime() >= now).reverse();
  const past = events.filter((e) => new Date(e.startsAt).getTime() < now);

  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">Calendar and minutes{drafts.length > 0 ? ` · ${drafts.length} draft${drafts.length === 1 ? "" : "s"} to review` : ""}</h4>
      {!hasDomain && (
        <form
          className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3"
          data-room-calendar-domain
          onSubmit={async (e) => {
            e.preventDefault();
            const list = domain.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean);
            if (list.length === 0) return;
            setBusy(true);
            const error = await send(`${base}/settings`, "PATCH", { allowedDomains: list });
            setErr(error ?? "");
            setNote(error ? "" : "Saved. Now read the calendar.");
            setBusy(false);
            if (!error) {
              setDomain("");
              await refresh();
            }
          }}
        >
          <p className="text-sm text-amber-900">Customer’s email domain</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} className="h-8 max-w-xs bg-white text-sm" aria-label="Customer email domain" />
            <Button type="submit" size="sm" variant="brand" disabled={busy || !domain.trim()}>Save domain</Button>
          </div>
        </form>
      )}
      <div className="space-y-2 rounded-md border p-3">
        {google?.connection ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">
              Your Google account: <span className="font-medium">{google.connection.googleEmail}</span>
              {google.connection.status !== "connected" && <span className="text-amber-700"> · needs reconnecting</span>}
            </span>
            {google.connection.status === "connected" ? (
              <Button size="sm" variant="brand" disabled={busy} onClick={() => connect("mine")}>{calendar?.connection?.mine ? "Read my calendar now" : "Use my calendar for this hub"}</Button>
            ) : (
              <Button size="sm" variant="brand" disabled={busy} onClick={connectGoogle}>Reconnect Google</Button>
            )}
            <Button size="sm" variant="ghost" disabled={busy} onClick={disconnectGoogle}>Disconnect Google</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="brand" disabled={busy || google?.configured === false} onClick={connectGoogle}>Connect Google</Button>
            {google?.configured === false && <span className="text-xs text-muted-foreground">Google isn’t set up on this server yet.</span>}
          </div>
        )}
        {google?.setup?.problem && (
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900" data-room-google-setup>Setup problem: {google.setup.problem}</p>
        )}
        {calendar?.connection && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              This hub reads {calendar.connection.mine ? "your" : `${calendar.connection.googleEmail}’s`} calendar{calendar.id && calendar.id !== "primary" ? ` (${calendar.id})` : ""}. Last read {fmtDate(calendar.syncedAt) || "never"}{calendar.note && !domainFirst(calendar.note) ? ` · ${calendar.note}` : ""}
            </span>
            <button type="button" className="underline" disabled={busy} onClick={() => connect(null)}>Stop reading</button>
          </div>
        )}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Use a shared calendar instead of the main one</summary>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Calendar ID</span><Input className="max-w-sm" value={calId} onChange={(e) => setCalId(e.target.value)} aria-label="Google Calendar ID" /></label>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => connect()}>Save and read</Button>
          </div>
        </details>
      </div>
      {note && !domainFirst(note) && <p className="text-sm text-muted-foreground">{note}</p>}
      {err && !domainFirst(err) && <p className="text-sm text-destructive">{err}</p>}

      {events.length > 0 && (
        <div className="divide-y rounded-md border">
          {[...upcoming, ...past].map((e) => (
            <div key={e.id} className="px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.allDay ? new Date(e.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) : fmtDate(e.startsAt)}
                    {e.attendees ? ` · ${e.attendees}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {e.hidden && <Badge variant="outline">Hidden from customer</Badge>}
                  {e.minutesStatus === "draft" && <Badge variant="secondary">Minutes draft</Badge>}
                  {e.minutesStatus === "published" && <Badge>Minutes published</Badge>}
                  {new Date(e.startsAt).getTime() < now && e.minutesStatus !== "dismissed" && (
                    <Button size="sm" variant="outline" onClick={() => setOpenId(openId === e.id ? null : e.id)}>
                      {e.minutesStatus === "draft" ? "Review" : e.minutesStatus === "published" ? "Edit minutes" : "Write minutes"}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => patch(e.id, { hidden: !e.hidden })}>{e.hidden ? "Show" : "Hide"}</Button>
                </div>
              </div>
              {openId === e.id && <MinutesEditor event={e} onSave={(body) => patch(e.id, body)} onClose={() => setOpenId(null)} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MinutesEditor({ event, onSave, onClose }: { event: RoomEventRow; onSave: (body: unknown) => Promise<boolean>; onClose: () => void }) {
  const [summary, setSummary] = useState(event.minutes?.summary ?? "");
  const [decisions, setDecisions] = useState((event.minutes?.decisions ?? []).join("\n"));
  const [actions, setActions] = useState(actionsToText(event.minutes?.actions ?? []));
  const minutes = () => ({ summary, decisions: decisions.split("\n").map((d) => d.trim()).filter(Boolean), actions: textToActions(actions) });
  const area = "w-full rounded-md border bg-background px-2 py-1.5 text-sm";
  return (
    <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">
        {event.minutesStatus === "draft" && event.hasNotes ? "Drafted from the meeting’s notes. Read it before publishing: remove anything internal." : "Everything here is shown to the customer once published."}
      </p>
      <label className="block space-y-1 text-xs font-medium">Summary<textarea className={area} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
      <label className="block space-y-1 text-xs font-medium">Decisions, one per line<textarea className={area} rows={3} value={decisions} onChange={(e) => setDecisions(e.target.value)} /></label>
      <label className="block space-y-1 text-xs font-medium">Action items, one per line: action | owner | due. Start a line with “x ” when it is done.<textarea className={area} rows={4} value={actions} onChange={(e) => setActions(e.target.value)} /></label>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="brand" onClick={async () => { if (await onSave({ minutes: minutes(), minutesStatus: "published" })) onClose(); }}>
          {event.minutesStatus === "published" ? "Save" : "Publish to the customer"}
        </Button>
        {event.minutesStatus !== "published" && <Button size="sm" variant="outline" onClick={async () => { if (await onSave({ minutes: minutes(), minutesStatus: "draft" })) onClose(); }}>Save draft</Button>}
        {event.minutesStatus === "published" && <Button size="sm" variant="outline" onClick={async () => { if (await onSave({ minutesStatus: "draft" })) onClose(); }}>Unpublish</Button>}
        {event.minutesStatus === "draft" && <Button size="sm" variant="ghost" onClick={async () => { if (await onSave({ minutesStatus: "dismissed" })) onClose(); }}>Discard</Button>}
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

const fmtDuration = (seconds: number) => (seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.round(seconds / 60)} min` : `${(seconds / 3600).toFixed(1)} hr`);
const ACTION_LABEL: Record<string, string> = { view: "viewed", open: "opened", download: "downloaded", time: "spent time on" };

/** Who opened which launch-kit item, for how long, and when. Last 90 days. */
function EngagementSection({ engagement, kitName = "the launch kit" }: { engagement: RoomDetail["engagement"]; kitName?: string }) {
  const [showAll, setShowAll] = useState(false);
  const assets = engagement?.assets ?? [];
  const recent = engagement?.recent ?? [];
  return (
    <section className="space-y-2">
      <p className="text-sm text-muted-foreground">Who opened what in {kitName}, and for how long. Last 90 days.</p>
      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing has been opened yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Asset</th>
                <th className="px-3 py-2 font-medium">Opened</th>
                <th className="px-3 py-2 font-medium">Downloads</th>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">Last</th>
              </tr>
            </thead>
            <tbody>
              {(showAll ? assets : assets.slice(0, 8)).map((a) => (
                <tr key={a.key} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{a.title}</td>
                  <td className="px-3 py-2 tabular-nums">{a.views}</td>
                  <td className="px-3 py-2 tabular-nums">{a.downloads}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {a.seconds > 0 ? fmtDuration(a.seconds) : "—"}
                    {a.maxProgress > 0 ? ` · watched ${a.maxProgress}%` : ""}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{[...a.people, ...(a.anonymous > 0 ? [`${a.anonymous} not identified`] : [])].join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(a.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {assets.length > 8 && <button type="button" className="text-xs underline" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `Show all ${assets.length}`}</button>}
      {recent.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground">Latest activity</summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {recent.map((r, i) => (
              <li key={i}>
                <span className="text-foreground">{r.who ?? "Someone not identified"}</span> {ACTION_LABEL[r.action] ?? r.action} <span className="text-foreground">{r.title}</span>
                {r.action === "time" && r.value ? ` (${fmtDuration(r.value)})` : ""} · {fmtDate(r.at)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/**
 * Launch assets made from what the room already knows (both names, both logos,
 * the cover photo): the partnership one-pager and two social graphics. Each is
 * generated here, uploaded, and filed into the room's launch kit.
 */
function LaunchAssetsSection({ pageId, kit, refresh, onKitAssets, onKitLink, expansion = false }: { /** Past the rollout: these are marketing assets, not a launch. */ expansion?: boolean; pageId: number; kit: NonNullable<RoomDetail["kit"]>; refresh: () => Promise<void>; onKitAssets?: (assets: RoomKitAssetChange[]) => void; onKitLink?: (link: RoomKitLinkChange) => void }) {
  const [state, setState] = useState<Record<string, "working" | "done" | string>>({});
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const SPECS = [
    { key: "partnership-one-pager", kind: "pdf", title: "Partnership one-pager", note: "PDF, from the New partner one-pager template" },
    { key: "social-image-1", kind: "image", title: "Social graphic, link preview", note: "1200 × 627, with the cover photo" },
    { key: "social-image-2", kind: "image", title: "Social graphic, square", note: "1080 × 1080" },
    { key: "media-kit", kind: "pdf", title: "Media kit", note: "PDF: the announcement copy, social posts and links in one document" },
  ] as const;
  /** Which asset the file picker was opened for, and the ones replaced with a rep's own file in this sitting. */
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState<(typeof SPECS)[number] | null>(null);
  const [own, setOwn] = useState<Record<string, true>>({});
  /** Put the rep's own file in the kit in place of the one we make. Same key, so the customer sees one asset, not two. */
  const replaceWith = async (spec: (typeof SPECS)[number], file: File) => {
    const image = file.type.startsWith("image/");
    const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (spec.kind === "image" ? !image : !pdf) return setState((s) => ({ ...s, [spec.key]: spec.kind === "image" ? "Upload an image (PNG or JPG)" : "Upload a PDF" }));
    if (file.size > (image ? 10 : 50) * 1024 * 1024) return setState((s) => ({ ...s, [spec.key]: image ? "That image is over 10 MB" : "That file is over 50 MB" }));
    setBusy(true);
    setState((s) => ({ ...s, [spec.key]: "working" }));
    try {
      const [{ uploadPdf }, { uploadImage }, { LAUNCH_ASSETS }] = await Promise.all([import("@/components/PdfUploadButton"), import("@/components/ImagePicker"), import("@/lib/room-launch-assets")]);
      const fileUrl = image ? await uploadImage(file) : (await uploadPdf(file)).url;
      const meta = LAUNCH_ASSETS.find((x) => x.key === spec.key);
      const asset = { key: spec.key, kind: spec.kind, title: meta?.title ?? spec.title, description: meta?.description, fileUrl };
      const r = await fetch(`/api/lp/partner-rooms/${pageId}/kit-asset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(asset) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not add it to the hub");
      onKitAssets?.([asset]);
      setPreviews((p) => ({ ...p, [spec.key]: fileUrl }));
      setOwn((o) => ({ ...o, [spec.key]: true }));
      setState((s) => ({ ...s, [spec.key]: "done" }));
    } catch (e) {
      setState((s) => ({ ...s, [spec.key]: e instanceof Error ? e.message : "Upload failed" }));
    } finally {
      setBusy(false);
      await refresh();
    }
  };
  const has = (key: string) => kit.assets.some((a) => a.key === key && a.hasFile);
  // Files that are the same for every customer: uploaded once for the workspace, added to each room.
  const { data: standard, refetch: refetchStandard } = useQuery({
    queryKey: ["room-standard-assets"],
    queryFn: async () => {
      const r = await fetch("/api/lp/room-standard-assets");
      if (!r.ok) throw new Error("standard");
      return ((await r.json()) as { assets: { key: string; title: string; description: string; fileUrl: string | null; updatedAt: string | null }[] }).assets;
    },
  });
  const [stdNote, setStdNote] = useState("");
  const addStandard = async (replace: boolean) => {
    const r = await fetch(`/api/lp/partner-rooms/${pageId}/standard-assets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replace }) });
    const j = (await r.json().catch(() => ({}))) as { added?: string[]; kept?: string[]; missing?: string[]; error?: string };
    setStdNote(
      !r.ok
        ? (j.error ?? "Could not add the standard files")
        : [j.added?.length ? `Added: ${j.added.join(", ")}.` : "", j.kept?.length ? `Kept this hub’s own file: ${j.kept.join(", ")}.` : "", j.missing?.length ? `Not uploaded yet: ${j.missing.join(", ")}.` : ""].filter(Boolean).join(" ") || "Nothing to add.",
    );
    // Tell the builder (when this panel is open inside it) which files just went into the kit.
    const added = (standard ?? []).filter((a) => a.fileUrl && (j.added ?? []).includes(a.title));
    if (r.ok && added.length) onKitAssets?.(added.map((a) => ({ key: a.key, kind: "pdf", title: a.title, description: a.description, fileUrl: a.fileUrl! })));
    await refresh();
  };

  // The practice microsite: the account's own page if there is one, else a draft from the template; linked in the kit either way.
  const [site, setSite] = useState<{ url: string; title: string; status: string; existing: boolean; pageId: number } | null>(null);
  const [siteNote, setSiteNote] = useState("");
  const ensureSite = async (): Promise<string> => {
    setSiteNote("");
    const r = await fetch(`/api/lp/partner-rooms/${pageId}/practice-site`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const j = (await r.json().catch(() => ({}))) as { url?: string; title?: string; status?: string; existing?: boolean; pageId?: number; error?: string; link?: RoomKitLinkChange };
    if (!r.ok || !j.url || !j.pageId) {
      setSiteNote(j.error ?? "Could not set up the practice microsite");
      return "";
    }
    setSite({ url: j.url, title: j.title ?? "", status: j.status ?? "", existing: !!j.existing, pageId: j.pageId });
    if (j.link) onKitLink?.(j.link);
    return j.url;
  };

  /** What the generated files are drawn from: both names' worth of cover settings, as the hub has them now. */
  const basis = { partnerName: kit.partnerName, partnerLogoUrl: kit.partnerLogoUrl, heroImageUrl: kit.heroImageUrl, partnerLogoScale: kit.partnerLogoScale, brandLogoScale: kit.brandLogoScale };
  const create = async (keys: readonly string[]) => {
    setBusy(true);
    try {
      // The whole kit starts with the practice microsite, so the one-pager and media kit carry its address.
      const siteUrl = keys.length > 1 ? await ensureSite() : "";
      const [{ createLaunchAsset }, { fetchBrandConfig }] = await Promise.all([import("@/lib/room-launch-assets"), import("@/lib/brand-config")]);
      const brand = await fetchBrandConfig();
      // Files made in this run (the one-pager, the graphics) so the media kit, made last, can link to them.
      const made: Record<string, string> = {};
      for (const key of keys) {
        setState((s) => ({ ...s, [key]: "working" }));
        try {
          const url = await createLaunchAsset(key as "partnership-one-pager", { ...basis, pageId, signupUrl: siteUrl || site?.url || kit.signupUrl, brand, texts: kit.texts ?? [], links: kit.links ?? [], files: kit.assets.filter((x) => !x.hidden && x.kind !== "text" && x.kind !== "link" && x.key !== "media-kit" && (x.hasFile || keys.includes(x.key))).map((x) => ({ title: x.title, url: made[x.key] ?? x.url ?? "" })) });
          made[key] = url;
          setPreviews((p) => ({ ...p, [key]: url }));
          const { LAUNCH_ASSETS, launchAssetSignature } = await import("@/lib/room-launch-assets");
          const spec = LAUNCH_ASSETS.find((x) => x.key === key);
          if (spec) onKitAssets?.([{ key, kind: spec.kind, title: spec.title, description: spec.description, fileUrl: url, madeFrom: launchAssetSignature(spec.key, basis) }]);
          setState((s) => ({ ...s, [key]: "done" }));
        } catch (e) {
          setState((s) => ({ ...s, [key]: e instanceof Error ? e.message : "Could not create it" }));
        }
      }
      // "Create launch kit" also brings in the standard guides (a room's own file is kept).
      if (keys.length > 1) await addStandard(false);
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  // A room created automatically from the signed-accounts sheet gets its kit made the first time someone on the
  // team opens this tab (the files are built in the browser, so the hourly check can't make them itself).
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !kit.automatic || !kit.partnerName || busy) return;
    if (SPECS.some((a) => has(a.key))) return;
    const flag = `lp-room-kit-auto-${pageId}`;
    try {
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, "1");
    } catch {
      /* no storage: run once per mount */
    }
    autoRan.current = true;
    void create(SPECS.map((a) => a.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit.automatic, kit.partnerName, pageId]);

  // A generated file made from an older name, logo, logo size or cover photo is made again here, on its own.
  // (A rep's own upload carries no record of what it was made from, so it is never touched.)
  const remadeFor = useRef("");
  useEffect(() => {
    if (busy || !kit.partnerName) return;
    let cancelled = false;
    void import("@/lib/room-launch-assets").then(({ staleLaunchAssets }) => {
      const stale = staleLaunchAssets(kit.assets, basis);
      const mark = `${stale.join(",")}|${JSON.stringify(basis)}`;
      if (cancelled || !stale.length || remadeFor.current === mark) return;
      remadeFor.current = mark;
      void create(stale);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit.assets, kit.partnerName, kit.partnerLogoUrl, kit.heroImageUrl, kit.partnerLogoScale, kit.brandLogoScale, busy]);

  const missing = [!kit.partnerName && "the customer’s name", !kit.partnerLogoUrl && "the customer’s logo (their name is used instead)", !kit.heroImageUrl && "a cover photo (the link-preview graphic is made without one)"].filter(Boolean) as string[];
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">{expansion ? "Marketing assets" : "Launch assets"}</h4>
      <p className="text-sm text-muted-foreground">
        Made for {kit.partnerName || "this customer"} from the hub’s names, logos and cover photo. Have your own version? Upload it in its place.
      </p>
      {missing.length > 0 && <p className="text-xs text-amber-700">Not set on the page yet: {missing.join("; ")}.</p>}
      <input
        ref={replaceRef}
        type="file"
        accept={replacing?.kind === "image" ? "image/png,image/jpeg,image/webp" : "application/pdf,.pdf"}
        className="hidden"
        data-room-asset-file
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && replacing) void replaceWith(replacing, file);
        }}
      />
      <div className="divide-y rounded-md border">
        {SPECS.map((a) => {
          const st = state[a.key];
          return (
            <div key={a.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {a.note}
                  {st && st !== "working" && st !== "done" ? <span className="text-destructive"> · {st}</span> : null}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {st === "done" || has(a.key) ? <Badge variant="secondary">{own[a.key] ? "Your file" : st === "done" ? "Created" : "In the kit"}</Badge> : null}
                {previews[a.key] && <a className="text-xs underline" href={previews[a.key]} target="_blank" rel="noreferrer">Open</a>}
                <Button size="sm" variant="outline" disabled={busy || !kit.partnerName} onClick={() => create([a.key])}>
                  {st === "working" ? "Working…" : has(a.key) || st === "done" ? "Create again" : "Create"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={busy}
                  title={`Upload your own ${a.kind === "image" ? "image" : "PDF"} to use in place of this one`}
                  data-room-asset-replace={a.key}
                  onClick={() => {
                    setReplacing(a);
                    // The accept list follows the asset: let it update before the picker opens.
                    setTimeout(() => replaceRef.current?.click(), 0);
                  }}
                >
                  <Upload className="h-3.5 w-3.5" /> {has(a.key) || st === "done" ? "Replace" : "Upload your own"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {/* Standard files are managed once for the workspace; here there is only the button that brings them into this hub. */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2" data-room-standard-files>
        <p className="min-w-0 text-sm">
          <span className="font-medium">Standard files</span>{" "}
          <span className="text-xs text-muted-foreground">
            {(standard ?? []).filter((a) => has(a.key)).length} of {(standard ?? []).length} in this hub · managed under <a className="underline" href="/settings/partner-hubs">Settings → Partner Hubs</a>
          </span>
        </p>
        <Button size="sm" variant="outline" disabled={busy || !(standard ?? []).some((a) => a.fileUrl)} onClick={() => addStandard(false)}>Add standard files</Button>
      </div>
      {stdNote && <p className="text-xs text-muted-foreground">{stdNote}</p>}
      <Fold title="Practice microsite" hint={site ? `${site.existing ? "Found" : "Drafted"}: ${site.title}` : "The page this customer’s practices sign up on"} data-room-practice-site>
        <p className="text-xs text-muted-foreground">The page this customer’s practices sign up on. If the account already has one it is linked here; if not, a draft is made from your practice-microsite template with their name filled in.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy || !kit.partnerName} onClick={async () => { setBusy(true); try { await ensureSite(); await refresh(); } finally { setBusy(false); } }}>Find or create it</Button>
          {site && (
            <span className="text-xs text-muted-foreground">
              {site.existing ? "Found" : "Drafted"}: <a className="underline" href={`/builder/${site.pageId}`}>{site.title}</a> ({site.status === "published" ? "published" : "a draft: review and publish it"}) · {site.url.replace(/^https?:\/\//, "")}
            </span>
          )}
          {siteNote && <span className="text-xs text-destructive">{siteNote}</span>}
        </div>
      </Fold>
      <Button size="sm" variant="brand" disabled={busy || !kit.partnerName} onClick={() => create(SPECS.map((a) => a.key))}>
        {busy ? "Creating…" : expansion ? "Create marketing assets" : "Create launch kit"}
      </Button>
      <p className="text-xs text-muted-foreground">Finds or drafts the practice microsite, creates the one-pager, both graphics and the media kit, and adds the standard files.</p>
    </section>
  );
}

/**
 * Automatic rooms (for the whole workspace, not just this page): watch a sheet
 * tab of signed accounts and create a draft room for each account added to it.
 */
/** Upload the launch-kit files that are the same for every customer (workspace-wide). */
export function StandardFilesManager() {
  const { data: standard, refetch } = useQuery({
    queryKey: ["room-standard-assets"],
    queryFn: async () => {
      const r = await fetch("/api/lp/room-standard-assets");
      if (!r.ok) throw new Error("standard");
      return ((await r.json()) as { assets: { key: string; title: string; description: string; fileUrl: string | null; updatedAt: string | null }[] }).assets;
    },
  });
  const [note, setNote] = useState("");
  const save = async (key: string, fileUrl: string) => {
    const e = await send(`/api/lp/room-standard-assets/${key}`, "PUT", { fileUrl });
    setNote(e ?? "Saved. New hubs get this file; add it to an existing hub from that hub’s Launch kit tab (Marketing, once it is past its rollout).");
    await refetch();
  };
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">Standard launch files</h4>
      <p className="text-sm text-muted-foreground">Files that are the same for every customer. Upload each one once; it is attached to every new hub, and can be added to any existing room.</p>
      <div className="divide-y rounded-md border">
        {(standard ?? []).map((a) => (
          <div key={a.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {a.description} · {a.fileUrl ? <>uploaded {fmtDate(a.updatedAt)} · <a className="underline" href={a.fileUrl} target="_blank" rel="noreferrer">Open</a></> : "not uploaded yet"}
              </p>
            </div>
            <PdfUploadButton label={a.fileUrl ? "Replace" : "Upload PDF"} onUploaded={(r) => void save(a.key, r.url)} />
          </div>
        ))}
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </section>
  );
}

export function AutomaticRoomsSection() {
  const { data, refetch } = useQuery({
    queryKey: ["room-autocreate"],
    queryFn: async () => {
      const r = await fetch("/api/lp/room-autocreate");
      if (!r.ok) throw new Error("autocreate");
      return (await r.json()) as { enabled: boolean; sheetId: string | null; sheetTab: string | null; practicesTab: string | null; alertOwner?: boolean; alertEmails?: string[]; logEnabled?: boolean; logSheetId?: string | null; logTab?: string | null; kitSheetId?: string | null; kitTab?: string | null; asanaProjectGid?: string | null; asanaAssigneeGid?: string | null; hubTemplate?: { id: number; label: string } | null; sfdcField?: string | null; syncedAt: string | null; note: string | null; shareWith?: string | null; accounts: { key: string; name: string; signedDate: string | null; owner: string | null; sfdcId?: string | null; pageId: number | null }[] };
    },
  });
  const [sheet, setSheet] = useState("");
  const [tab, setTab] = useState("");
  const [practicesTab, setPracticesTab] = useState("");
  const [alertOwner, setAlertOwner] = useState(false);
  const [alertEmails, setAlertEmails] = useState("");
  const [logEnabled, setLogEnabled] = useState(true);
  const [logSheet, setLogSheet] = useState("");
  const [logTab, setLogTab] = useState("");
  const [kitSheet, setKitSheet] = useState("");
  const [kitTab, setKitTab] = useState("");
  const [asanaProject, setAsanaProject] = useState("");
  const [asanaAssignee, setAsanaAssignee] = useState("");
  const [sfdcField, setSfdcField] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (!data) return;
    setSheet(data.sheetId ? `https://docs.google.com/spreadsheets/d/${data.sheetId}` : "");
    setTab(data.sheetTab ?? "");
    setPracticesTab(data.practicesTab ?? "");
    setAlertOwner(!!data.alertOwner);
    setAlertEmails((data.alertEmails ?? []).join(", "));
    setLogEnabled(data.logEnabled !== false);
    setLogSheet(data.logSheetId ? `https://docs.google.com/spreadsheets/d/${data.logSheetId}` : "");
    setLogTab(data.logTab ?? "");
    setKitSheet(data.kitSheetId ? `https://docs.google.com/spreadsheets/d/${data.kitSheetId}` : "");
    setKitTab(data.kitTab ?? "");
    setAsanaProject(data.asanaProjectGid ?? "");
    setAsanaAssignee(data.asanaAssigneeGid ?? "");
    setSfdcField(data.sfdcField ?? "");
  }, [data]);

  const save = async (enabled: boolean) => {
    setBusy(true);
    setNote("");
    let e = await send("/api/lp/room-autocreate", "PUT", { enabled, sheet: sheet.trim(), tab: tab.trim(), practicesTab: practicesTab.trim(), alertOwner, alertEmails: alertEmails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean), logEnabled, logSheet: logSheet.trim(), logTab: logTab.trim(), kitSheet: kitSheet.trim(), kitTab: kitTab.trim(), asanaProjectGid: asanaProject.trim(), asanaAssigneeGid: asanaAssignee.trim(), sfdcField: sfdcField.trim() });
    if (!e && enabled) {
      const r = await fetch("/api/lp/room-autocreate/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = (await r.json().catch(() => ({}))) as { note?: string; error?: string };
      if (r.ok) setNote(j.note ?? "Sheet read.");
      else e = j.error ?? "Could not read the sheet";
    } else if (!e) setNote("Automatic hubs are off. Hubs already created stay.");
    setErr(e ?? "");
    setBusy(false);
    await refetch();
  };
  const createFor = async (key: string) => {
    setBusy(true);
    const r = await fetch("/api/lp/room-autocreate/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setErr(r.ok ? "" : (j.error ?? "Could not create the hub"));
    setBusy(false);
    await refetch();
  };

  // A test run: the same room a new signed account gets, for a name typed here, then its launch kit.
  // The test runs for an account picked from Accounts, so it exercises the same matching a real hub gets (practices, team, owner).
  const [testAccount, setTestAccount] = useState<{ id: number; name: string; owner: string | null; salesforceId: string | null } | null>(null);
  const [testQuery, setTestQuery] = useState("");
  const [testTerm, setTestTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTestTerm(testQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [testQuery]);
  const { data: testHits, isFetching: testSearching } = useQuery({
    queryKey: ["partner-hub-accounts", "test", testTerm],
    enabled: !testAccount && testTerm.length >= 2,
    queryFn: async () => {
      const r = await fetch(`/api/lp/partner-hub-accounts?q=${encodeURIComponent(testTerm)}`);
      if (!r.ok) return [];
      return (((await r.json().catch(() => ({}))) as { accounts?: { id: number; name: string; owner: string | null; locations: number | null; salesforceId: string | null }[] }).accounts ?? []).slice(0, 8);
    },
  });
  const [testSteps, setTestSteps] = useState<{ label: string; state: "working" | "done" | "failed"; detail?: string }[]>([]);
  const [testPage, setTestPage] = useState<number | null>(null);
  const runTest = async () => {
    setBusy(true);
    setErr("");
    setTestPage(null);
    const steps: { label: string; state: "working" | "done" | "failed"; detail?: string }[] = [];
    const step = (label: string) => {
      steps.push({ label, state: "working" });
      setTestSteps([...steps]);
      return (state: "done" | "failed", detail?: string) => {
        steps[steps.findIndex((x) => x.label === label)] = { label, state, detail };
        setTestSteps([...steps]);
      };
    };
    try {
      const made = step("Create the draft hub");
      const r = await fetch("/api/lp/room-autocreate/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: testAccount?.name ?? "", ...(testAccount?.salesforceId && /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(testAccount.salesforceId) ? { sfdcId: testAccount.salesforceId } : {}), ...(testAccount?.owner ? { owner: testAccount.owner } : {}) }) });
      const j = (await r.json().catch(() => ({}))) as { pageId?: number; name?: string; standardFiles?: number; practicesLinked?: boolean; practices?: number; practicesNote?: string | null; practiceSite?: { title: string; existing: boolean; url: string; status: string } | null; teamFilled?: number; contacts?: number; domain?: string | null; error?: string; followUps?: { alerts: { sent: string[]; ownerMatched: boolean | null } | null; sheet: { ok: boolean; note: string } | null; sfdc: { ok: boolean; note: string } | null } };
      if (!r.ok || !j.pageId) {
        made("failed", j.error ?? "Could not create the hub");
        return;
      }
      made("done", `“${j.name} Partner Hub (test)”, a draft`);
      setTestPage(j.pageId);
      steps.push({ label: "Attach the standard files", state: j.standardFiles ? "done" : "failed", detail: j.standardFiles ? `${j.standardFiles} attached` : "None uploaded yet (see Standard launch files below)" });
      steps.push({ label: "Read the account's practices from the locations sheet", state: j.practices ? "done" : "failed", detail: j.practices ? `${j.practices} practices loaded into the Scorecard` : j.practicesNote || "No locations tab is set above, or no Salesforce ID was given to match on" });
      steps.push({ label: "Find or draft the practice microsite", state: j.practiceSite ? "done" : "failed", detail: j.practiceSite ? `${j.practiceSite.existing ? "Found" : "Drafted from your template"}: ${j.practiceSite.title} · ${j.practiceSite.url.replace(/^https?:\/\//, "")}` : "None exists for this account and no practice-microsite template was found" });
      steps.push({ label: "Fill the customer's team from the account", state: j.teamFilled ? "done" : "failed", detail: j.teamFilled ? `${j.teamFilled} people added to the Team module; ${j.contacts ?? 0} contacts can be invited` : "No account with that name (or Salesforce ID) and contacts was found under Accounts" });
      steps.push({ label: "Set the customer's email domain", state: j.domain ? "done" : "failed", detail: j.domain ?? "Couldn't work it out; add it under the hub's Settings" });
      steps.push({ label: "Tell the team in Slack", state: "done", detail: "Sent to your workspace channel with the setup checklist, marked as a test" });
      const f = j.followUps;
      if (f?.alerts) steps.push({ label: "Email alerts", state: f.alerts.sent.length ? "done" : "failed", detail: f.alerts.sent.length ? `Sent to ${f.alerts.sent.join(", ")}` : "Nobody to send to (a test has no account owner; add an email above)" });
      if (f?.sheet) steps.push({ label: "Add a row to the spreadsheet", state: f.sheet.ok ? "done" : "failed", detail: f.sheet.note });
      if (f?.sfdc) steps.push({ label: "Salesforce field", state: f.sfdc.ok ? "done" : "failed", detail: f.sfdc.note });
      setTestSteps([...steps]);
      const [{ createLaunchAsset, LAUNCH_ASSETS }, { fetchBrandConfig }] = await Promise.all([import("@/lib/room-launch-assets"), import("@/lib/brand-config")]);
      const [brand, detail] = await Promise.all([fetchBrandConfig(), fetch(`/api/lp/partner-rooms/${j.pageId}`).then((x) => x.json() as Promise<RoomDetail>)]);
      const kit = detail.kit;
      if (!kit) return;
      // Files made in this run, so the media kit (made last) can link to them.
      const madeUrls: Record<string, string> = {};
      for (const a of LAUNCH_ASSETS) {
        const done = step(`Create: ${a.title}`);
        try {
          madeUrls[a.key] = await createLaunchAsset(a.key, { pageId: j.pageId, partnerName: kit.partnerName, partnerLogoUrl: kit.partnerLogoUrl, heroImageUrl: kit.heroImageUrl, partnerLogoScale: kit.partnerLogoScale, brandLogoScale: kit.brandLogoScale, signupUrl: kit.signupUrl, brand, texts: kit.texts ?? [], links: kit.links ?? [], files: [...LAUNCH_ASSETS.filter((x) => x.key !== "media-kit").map((x) => ({ title: x.title, url: madeUrls[x.key] ?? "" })), ...kit.assets.filter((x) => !x.hidden && x.hasFile && x.kind === "pdf").map((x) => ({ title: x.title, url: x.url ?? "" }))] });
          done("done");
        } catch (e) {
          done("failed", e instanceof Error ? e.message : "Could not create it");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const accounts = data?.accounts ?? [];
  const withRoom = accounts.filter((a) => a.pageId);
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">Automatic hubs</h4>
      <p className="text-sm text-muted-foreground">Each account added to the sheet gets a draft hub.</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
        <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Signed accounts sheet link</span><Input value={sheet} onChange={(e) => setSheet(e.target.value)} aria-label="Signed accounts sheet" /></label>
        <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Tab name</span><Input value={tab} onChange={(e) => setTab(e.target.value)} aria-label="Tab name" /></label>
      </div>
      <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs" data-room-share-with>
        {data?.shareWith ? (
          <>Share the workbook with <b className="select-all font-mono">{data.shareWith}</b> as an <b>Editor</b> (the same Google service account that sends leads to Sheets). Do the same for the workbook the log row goes to, if it is a different one.</>
        ) : (
          <>No Google service account is set up for this workspace yet. Add one under Settings → Integrations → Google Sheets, then share the workbook with its address.</>
        )}
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
        <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Practices tab</span><Input value={practicesTab} onChange={(e) => setPracticesTab(e.target.value)} aria-label="Practices tab name" /></label>
      </div>
      {/* Closed by default: the sheet link above is the one thing most people set. */}
      <details className="rounded-md border p-3" data-room-followups>
        <summary className="cursor-pointer text-sm font-medium">When a hub is created</summary>
        <div className="mt-3 space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Email</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={alertOwner} onChange={(e) => setAlertOwner(e.target.checked)} />
            The account owner
          </label>
          <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Other emails</span><Input value={alertEmails} onChange={(e) => setAlertEmails(e.target.value)} aria-label="Other alert emails" /></label>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Spreadsheet</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={logEnabled} onChange={(e) => setLogEnabled(e.target.checked)} />
            Add a row for each new hub
          </label>
          <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
            <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Log sheet link</span><Input value={logSheet} onChange={(e) => setLogSheet(e.target.value)} aria-label="Log sheet" disabled={!logEnabled} /></label>
            <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Log tab</span><Input value={logTab} onChange={(e) => setLogTab(e.target.value)} aria-label="Log tab" disabled={!logEnabled} /></label>
          </div>
        </div>
        <div className="space-y-1.5" data-room-kit-settings>
          <p className="text-xs font-medium text-muted-foreground">Welcome kits</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
            <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Welcome kit sheet link</span><Input value={kitSheet} onChange={(e) => setKitSheet(e.target.value)} aria-label="Welcome kit sheet" /></label>
            <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Welcome kit tab</span><Input value={kitTab} onChange={(e) => setKitTab(e.target.value)} aria-label="Welcome kit tab" /></label>
          </div>
        </div>
        <div className="space-y-1.5" data-room-hub-template>
          <p className="text-xs font-medium text-muted-foreground">Template for new hubs</p>
          {data?.hubTemplate ? (
            <p className="text-sm">
              <span className="font-medium">{data.hubTemplate.label}</span>{" "}
              <a className="underline" href={`/builder/${data.hubTemplate.id}`}>Edit the template</a>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">The built-in template. To use your own, open a hub in the builder and save it as a template.</p>
          )}
        </div>
        <div className="space-y-1.5" data-room-asana-settings>
          <p className="text-xs font-medium text-muted-foreground">Asana (marketing requests and welcome kits, every hub)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Asana project ID</span><Input value={asanaProject} onChange={(e) => setAsanaProject(e.target.value)} inputMode="numeric" aria-label="Asana project ID" /></label>
            <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Assign to (Asana user ID)</span><Input value={asanaAssignee} onChange={(e) => setAsanaAssignee(e.target.value)} inputMode="numeric" aria-label="Asana assignee ID" /></label>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Salesforce</p>
          <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Salesforce account field (API name)</span><Input className="max-w-sm" value={sfdcField} onChange={(e) => setSfdcField(e.target.value)} aria-label="Salesforce field" /></label>
        </div>
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="brand" disabled={busy || !sheet.trim()} onClick={() => save(true)}>{data?.enabled ? "Save and check now" : "Turn on"}</Button>
        {data?.enabled && <Button size="sm" variant="ghost" disabled={busy} onClick={() => save(false)}>Turn off</Button>}
        {data?.enabled && <span className="text-xs text-muted-foreground">Checked about every hour. Last read {fmtDate(data.syncedAt) || "never"}{data.note ? ` · ${data.note}` : ""}</span>}
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}
      <details className="rounded-md border p-3" data-room-autotest>
        <summary className="cursor-pointer text-sm font-medium">Run a test</summary>
        <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full max-w-sm space-y-1 text-xs" data-room-autotest-account>
            <span className="font-medium text-muted-foreground">Account</span>
            {testAccount ? (
              <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{testAccount.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[testAccount.owner, testAccount.salesforceId ? "Linked to Salesforce" : "No Salesforce ID: practices can’t be matched"].filter(Boolean).join(" · ")}</span>
                </span>
                <Button size="sm" variant="ghost" className="h-7 shrink-0 text-muted-foreground" disabled={busy} onClick={() => { setTestAccount(null); setTestQuery(""); }}>Change</Button>
              </div>
            ) : (
              <>
                <Input value={testQuery} onChange={(e) => setTestQuery(e.target.value)} placeholder="Search accounts" aria-label="Search accounts to test with" />
                {testTerm.length >= 2 && (
                  <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
                    {(testHits ?? []).map((a) => (
                      <li key={a.id}>
                        <button type="button" className="flex w-full flex-col px-3 py-1.5 text-left text-sm hover:bg-muted/50" onClick={() => setTestAccount({ id: a.id, name: a.name, owner: a.owner, salesforceId: a.salesforceId })} data-room-autotest-pick={a.id}>
                          <span className="font-medium">{a.name}</span>
                          <span className="text-xs text-muted-foreground">{[a.owner, a.locations ? `${a.locations} locations` : ""].filter(Boolean).join(" · ") || "No owner listed"}</span>
                        </button>
                      </li>
                    ))}
                    {testHits && testHits.length === 0 && !testSearching && <li className="px-3 py-2 text-sm text-muted-foreground">No account by that name. Add it under Accounts first.</li>}
                    {!testHits && <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>}
                  </ul>
                )}
              </>
            )}
          </div>
          <Button size="sm" variant="brand" disabled={busy || !testAccount} onClick={runTest}>{busy && testSteps.length ? "Running…" : "Run a test"}</Button>
          {testPage && <a className="text-sm underline" href={`/builder/${testPage}`}>Open the test hub</a>}
        </div>
        {testSteps.length > 0 && (
          <ul className="space-y-1 text-sm">
            {testSteps.map((s) => (
              <li key={s.label} className={s.state === "failed" ? "text-destructive" : s.state === "working" ? "text-muted-foreground" : ""}>
                {s.state === "done" ? "✓" : s.state === "failed" ? "✕" : "…"} {s.label}
                {s.detail ? <span className="text-xs text-muted-foreground"> · {s.detail}</span> : null}
              </li>
            ))}
          </ul>
        )}
        </div>
      </details>
      {accounts.length > 0 && (
        <details className="text-sm" open={showAll} onToggle={(e) => setShowAll((e.currentTarget as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-xs text-muted-foreground">{accounts.length} accounts on the list · {withRoom.length} with a hub made here</summary>
          <div className="mt-2 max-h-72 divide-y overflow-y-auto rounded-md border">
            {accounts.map((a) => (
              <div key={a.key} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="min-w-0 truncate">{a.name}{a.signedDate ? <span className="text-xs text-muted-foreground"> · signed {a.signedDate}</span> : null}{a.sfdcId ? null : <span className="text-xs text-amber-700"> · no Salesforce ID</span>}</span>
                {a.pageId ? (
                  <a className="text-xs underline" href={`/builder/${a.pageId}`}>Open hub</a>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => createFor(a.key)}>Create hub</Button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
