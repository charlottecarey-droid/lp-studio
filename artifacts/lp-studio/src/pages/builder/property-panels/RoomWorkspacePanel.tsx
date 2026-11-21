/**
 * Panel for the Partner Room workspace (room-workspace).
 *
 * Order follows how a rep sets a room up: the account (who, kickoff date,
 * cover photo) → which modules this customer sees → the action plan → the
 * launch kit → the team. Who may act in the room, uploaded files and requests
 * live on the page's analytics screen, under Room.
 */
import { ROOM_LOOKS, roomLook } from "@/blocks/hub/room-look";
import {
  ROOM_ASSET_ICONS,
  ROOM_MODULES,
  roomProgramOptions,
  orderedModules,
  ROOM_STATUS_LABEL,
  resolveRoomStatus,
  roomMilestoneKey,
  type RoomAsset,
  type RoomAssetKind,
  type RoomEvent,
  type RoomEventKind,
  type RoomMeeting,
  type RoomMeetingAction,
  ROOM_EVENT_KIND_LABEL,
  standardCheckpoints,
  type RoomGoal,
  type RoomGoalMetric,
  type RoomMilestone,
  type RoomMilestoneStatus,
  type RoomModuleKey,
  type RoomOnboardingStep,
  type RoomPhase,
  type RoomPlanGroup,
  type RoomProgram,
  type RoomProgramGroup,
  type RoomStepAction,
  type RoomTeamGroup,
  type RoomTeamMember,
  type RoomWorkspaceBlockProps,
  roomHeadlineDefault,
} from "@/blocks/BlockRoomWorkspace";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PdfUploadButton } from "@/components/PdfUploadButton";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useRoute } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RoomKitAssetChange, RoomPanelTab } from "@/components/analytics/PageRoomPanel";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, DoorOpen, Plus, X } from "lucide-react";

// The team's Room panel (uploads, practices, launch kit, calendar, settings). Loaded only when opened.
const PageRoomPanel = lazy(() => import("@/components/analytics/PageRoomPanel").then((m) => ({ default: m.PageRoomPanel })));
import { Field, ItemHeader, moveItem } from "./glow/GlowPanelKit";
import { LibraryPicker } from "@/components/LibraryPicker";
import { mergeTeamMembers, parseTeamList, TEAM_IMPORT_COLUMNS, type ImportedPerson } from "@/lib/room-team-import";
import { ThumbButton } from "./HubPanels";

const STATUS_ORDER: RoomMilestoneStatus[] = ["not-started", "on-track", "pending", "blocking", "done"];
const GOAL_METRIC_LABEL: Record<RoomGoalMetric, string> = {
  manual: "Typed in by you",
  practices_live: "Counted: locations live",
  practices_trained: "Counted: locations trained",
  plan_complete: "Counted: plan items done",
};

const STEP_ACTION_LABEL: Record<RoomStepAction, string> = {
  upload: "Customer uploads a file",
  check: "Customer marks it done",
  team: "Customer adds their team",
  request: "Customer sends details (a request)",
  link: "Customer opens a link",
};

/** One module's settings, shown on their own. */
/** Add many people to the Team module at once: a pasted list, a CSV file, or the account's contacts. */
function TeamImport({ groups, pageId, onAdd }: { groups: string[]; pageId: number | null; onAdd: (people: ImportedPerson[], groupIndex: number) => number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [group, setGroup] = useState(Math.min(1, Math.max(0, groups.length - 1)));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = parseTeamList(text);
  const say = (added: number, of: number) => setNote(added ? `Added ${added} ${added === 1 ? "person" : "people"}${of > added ? ` (${of - added} already there)` : ""}.` : of ? "Everyone on the list is already there." : "No people found in that list.");
  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setOpen(true)} data-room-team-import>
        <Plus className="h-3 w-3" /> Add many people (paste, CSV, or from the account)
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded border p-2" data-room-team-import-open>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Add many people</span>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-1" aria-label="Close" onClick={() => setOpen(false)}><X className="h-3 w-3" /></Button>
      </div>
      <Field label="Add to">
        <Select value={String(group)} onValueChange={(v) => setGroup(Number(v))}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{groups.map((g, i) => <SelectItem key={i} value={String(i)}>{g}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Textarea value={text} onChange={(e) => { setText(e.target.value); setNote(""); }} rows={5} className="font-mono text-[11px]" />
      <p className="text-[11px] text-muted-foreground">One person per line: Name, Role, Email</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" className="h-7 text-[11px]" disabled={parsed.people.length === 0} onClick={() => { say(onAdd(parsed.people, group), parsed.people.length); setText(""); }}>
          Add {parsed.people.length || ""} {parsed.people.length === 1 ? "person" : "people"}
        </Button>
        <label className="cursor-pointer rounded border px-2 py-1 text-[11px]">
          Choose a CSV file
          <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setText((await f.text()).slice(0, 200_000)); setNote(""); } }} />
        </label>
        {pageId !== null && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await fetch(`/api/lp/partner-rooms/${pageId}/account-contacts`);
                const j = (await r.json().catch(() => ({}))) as { found?: boolean; contacts?: { name: string; title: string; email: string }[] };
                const top = (j.contacts ?? []).slice(0, 8).map((c) => ({ name: c.name, role: c.title, email: c.email }));
                if (!r.ok || top.length === 0) setNote(j.found ? "The account has no contacts with a work email." : "No matching account was found under Accounts.");
                else say(onAdd(top, group), top.length);
              } catch {
                setNote("Couldn't load the account's contacts.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Loading…" : "Add the account's top contacts"}
          </Button>
        )}
      </div>
      {note && <p role="status" className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

function SectionBody({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

/** A list item that stays closed until opened, so a long list reads as a list of names. */
function CollapseItem({ header, startOpen, children }: { header: ReactNode; startOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!startOpen);
  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-1 px-2 py-1">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? "Close" : "Open"} className="rounded p-1 text-muted-foreground hover:bg-muted">
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        <div className="min-w-0 flex-1">{header}</div>
      </div>
      {open && <div className="space-y-1.5 border-t p-2">{children}</div>}
    </div>
  );
}

/** "Hide from the customer" switch, used on every item that can be hidden. */
function HideToggle({ hidden, onChange }: { hidden?: boolean; onChange: (hidden: boolean) => void }) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
      <Switch checked={!hidden} onCheckedChange={(v) => onChange(!v)} aria-label="Show to the customer" />
      {hidden ? "Hidden" : "Shown"}
    </label>
  );
}

const KIND_LABEL: Record<RoomAssetKind, string> = { pdf: "PDF", video: "Video", image: "Image", text: "Copy (text)", link: "Link", file: "Other file" };

export function RoomWorkspacePanel({ props, onChange, brandName }: { props: RoomWorkspaceBlockProps; onChange: (p: RoomWorkspaceBlockProps) => void; brandName?: string }) {
  const update = (patch: Partial<RoomWorkspaceBlockProps>) => onChange({ ...props, ...patch });
  // One screen at a time: the list of modules, or one module's settings.
  const [active, setActive] = useState<string | null>(null);
  // The Room panel, in a pop-up, so managing the room doesn't mean leaving the builder.
  const [, params] = useRoute("/builder/:pageId");
  const pageId = Number(params?.pageId);
  const [roomTab, setRoomTab] = useState<RoomPanelTab | null>(null);
  // Files the Room panel puts in the launch kit are saved on the server straight away; apply them to the
  // builder's copy of the page as well, or the builder's next save would drop them.
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  }, [props]);
  const applyKitAssets = (changes: RoomKitAssetChange[]) => {
    const current = propsRef.current;
    let assets = current.assets ?? [];
    for (const c of changes) {
      const at = assets.findIndex((a) => (a.key || roomMilestoneKey({ task: a.title })) === c.key);
      assets = at >= 0 ? assets.map((a, i) => (i === at ? { ...a, kind: c.kind, fileUrl: c.fileUrl, hidden: false } : a)) : [...assets, { key: c.key, kind: c.kind, title: c.title, description: c.description, fileUrl: c.fileUrl }];
    }
    const next = { ...current, assets };
    propsRef.current = next;
    onChange(next);
  };
  const roomDialog = Number.isFinite(pageId) && pageId > 0 && (
    <Dialog open={roomTab !== null} onOpenChange={(open) => !open && setRoomTab(null)}>
      <DialogContent className="max-w-5xl" data-room-manager>
        <DialogHeader>
          <DialogTitle>Manage room</DialogTitle>
          <DialogDescription>What the customer has done and sent, and who has access.</DialogDescription>
        </DialogHeader>
        {roomTab !== null && (
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <PageRoomPanel
              pageId={pageId}
              initialTab={roomTab}
              embedded
              onKitAssets={applyKitAssets}
              onGoals={(g) => {
                // Goals were saved on the page from here: keep the builder's copy the same, or its next save would put the old ones back.
                const current = propsRef.current;
                const hiddenModules = (current.hiddenModules ?? []).filter((m) => m !== "goals");
                const next = { ...current, goals: { ...current.goals, intro: g.intro, askAgreement: g.askAgreement, items: g.items }, hiddenModules: g.moduleHidden ? [...hiddenModules, "goals" as const] : hiddenModules };
                propsRef.current = next;
                onChange(next);
              }}
              onStage={(st) => {
                // Saved on the page from the pop-up: keep the builder's copy in step, or its next save would undo it.
                const next = { ...propsRef.current, stage: st.stage, stageSince: st.stageSince ?? undefined, timelineView: st.timelineView, waves: st.waves };
                propsRef.current = next;
                onChange(next);
              }}
              onLinks={(links) => {
                // Links were changed on the saved page: keep the builder's copy the same, or its next save would undo it.
                const next = { ...propsRef.current, links };
                propsRef.current = next;
                onChange(next);
              }}
              onOverview={(hiddenOverview) => {
                // Sections were shown or hidden on the saved page: keep the builder's copy the same, or its next save would undo it.
                const next = { ...propsRef.current, hiddenOverview };
                propsRef.current = next;
                onChange(next);
              }}
              onCover={(c) => {
                const next = { ...propsRef.current, headline: c.headline, eyebrow: c.eyebrow, coverStyle: c.coverStyle, coverPhotoScrolls: c.coverPhotoScrolls };
                propsRef.current = next;
                onChange(next);
              }}
              onKitLink={(link) => {
                // The practice microsite was linked on the saved page: add it to the builder's copy too, or the next save here would drop it.
                const current = propsRef.current;
                const links = (current.links ?? []) as { key?: string; title: string; description?: string; url: string }[];
                if (links.some((l) => l.url === link.url)) return;
                const next = { ...current, links: [link, ...links.filter((l) => l.key !== link.key)] };
                propsRef.current = next;
                onChange(next);
              }}
            />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
  const hidden = new Set(props.hiddenModules ?? []);
  const groups = props.planGroups ?? [];
  const phases = props.phases ?? [];
  const assets = props.assets ?? [];
  const links = props.links ?? [];
  const team = props.team ?? [];

  const setGroup = (i: number, patch: Partial<RoomPlanGroup>) => update({ planGroups: groups.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) });
  const setRow = (gi: number, ri: number, patch: Partial<RoomMilestone>) => setGroup(gi, { rows: groups[gi].rows.map((r, idx) => (idx === ri ? { ...r, ...patch } : r)) });
  const setPhase = (i: number, patch: Partial<RoomPhase>) => update({ phases: phases.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  const setAsset = (i: number, patch: Partial<RoomAsset>) => update({ assets: assets.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) });
  const [repsOpen, setRepsOpen] = useState(false);
  const setTeam = (i: number, patch: Partial<RoomTeamGroup>) => update({ team: team.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) });
  const setMember = (gi: number, mi: number, patch: Partial<RoomTeamMember>) => setTeam(gi, { members: team[gi].members.map((m, idx) => (idx === mi ? { ...m, ...patch } : m)) });

  const onboarding = props.onboarding ?? { steps: [] };
  const steps = onboarding.steps ?? [];
  const setOnboarding = (patch: Partial<NonNullable<RoomWorkspaceBlockProps["onboarding"]>>) => update({ onboarding: { ...onboarding, steps, ...patch } });
  const setStep = (i: number, patch: Partial<RoomOnboardingStep>) => setOnboarding({ steps: steps.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });
  const marketing = props.marketing ?? { groups: [] };
  const mGroups = marketing.groups ?? [];
  const setMarketing = (patch: Partial<NonNullable<RoomWorkspaceBlockProps["marketing"]>>) => update({ marketing: { ...marketing, groups: mGroups, ...patch } });
  const setMGroup = (i: number, patch: Partial<RoomProgramGroup>) => setMarketing({ groups: mGroups.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) });
  const setProgram = (gi: number, pi: number, patch: Partial<RoomProgram>) => setMGroup(gi, { programs: mGroups[gi].programs.map((x, idx) => (idx === pi ? { ...x, ...patch } : x)) });

  const calendar = props.calendar ?? { events: [] };
  const events = calendar.events ?? [];
  const setCalendar = (patch: Partial<NonNullable<RoomWorkspaceBlockProps["calendar"]>>) => update({ calendar: { ...calendar, events, ...patch } });
  const setEvent = (i: number, patch: Partial<RoomEvent>) => setCalendar({ events: events.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });
  const minutes = props.meetings ?? { items: [] };
  const meetingItems = minutes.items ?? [];
  const setMinutes = (patch: Partial<NonNullable<RoomWorkspaceBlockProps["meetings"]>>) => update({ meetings: { ...minutes, items: meetingItems, ...patch } });
  const setMeeting = (i: number, patch: Partial<RoomMeeting>) => setMinutes({ items: meetingItems.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) });
  const setAction = (i: number, ai: number, patch: Partial<RoomMeetingAction>) => setMeeting(i, { actions: (meetingItems[i].actions ?? []).map((a, idx) => (idx === ai ? { ...a, ...patch } : a)) });
  const todayIso = new Date().toISOString().slice(0, 10);
  const goals = props.goals ?? { items: [] };
  const goalItems = goals.items ?? [];
  const setGoals = (patch: Partial<NonNullable<RoomWorkspaceBlockProps["goals"]>>) => update({ goals: { ...goals, items: goalItems, ...patch } });
  const setGoal = (i: number, patch: Partial<RoomGoal>) => setGoals({ items: goalItems.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) });

  const toggleModule = (key: RoomModuleKey, show: boolean) => {
    const next = new Set(hidden);
    if (show) next.delete(key);
    else next.add(key);
    update({ hiddenModules: ROOM_MODULES.map((m) => m.key).filter((k) => next.has(k)) });
  };

  // The launch kit has no entry of its own in the hub's menu (it sits inside the marketing module), so it is not part of the order.
  const ordered = orderedModules(props.moduleOrder);
  const moveModule = (key: RoomModuleKey, by: -1 | 1) => {
    const keys = ordered.map((m) => m.key);
    const at = keys.indexOf(key);
    const to = at + by;
    if (at < 0 || to < 0 || to >= keys.length) return;
    [keys[at], keys[to]] = [keys[to], keys[at]];
    update({ moduleOrder: keys });
  };

  const MODULE_HINT: Partial<Record<RoomModuleKey, string>> = {
    overview: `${steps.length} setup item${steps.length === 1 ? "" : "s"} · ${phases.length} phases`,
    wins: "Posts, photos and comments",
    goals: `${goalItems.length} goal${goalItems.length === 1 ? "" : "s"}`,
    plan: `${groups.reduce((n, g) => n + (g.rows ?? []).length, 0)} milestones in ${groups.length} phases`,
    practices: "Loaded under Manage → Practices & files",
    marketing: `${mGroups.reduce((n, g) => n + (g.programs ?? []).length, 0)} programs`,
    kit: `${links.length} link${links.length === 1 ? "" : "s"} · ${assets.length} asset${assets.length === 1 ? "" : "s"}`,
    calendar: `${events.length} event${events.length === 1 ? "" : "s"}, plus synced meetings`,
    meetings: `Shown inside Calendar · ${meetingItems.length} typed in`,
    requests: "Answered under Manage → Activity",
    team: `${team.reduce((n, g) => n + (g.members ?? []).length, 0)} people`,
  };
  const EDITABLE = new Set<string>(["overview", "goals", "plan", "marketing", "kit", "calendar", "meetings", "team"]);

  if (active === null) {
    return (
      <div className="space-y-3">
        {roomDialog}
        <button type="button" onClick={() => setActive("account")} className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left hover:bg-muted/50">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{props.partnerName || "Account"}</span>
            <span className="block truncate text-[11px] text-muted-foreground">Name, logo, kickoff date and cover</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Modules</span>
            {(props.moduleOrder ?? []).length > 0 && (
              <button type="button" onClick={() => update({ moduleOrder: [] })} className="font-medium normal-case tracking-normal underline-offset-2 hover:underline">Reset order</button>
            )}
          </div>
          <div className="divide-y rounded-lg border">
            {ordered.map((m, at) => {
              const shown = !hidden.has(m.key);
              const body = (
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium ${shown ? "" : "text-muted-foreground line-through"}`}>{m.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{MODULE_HINT[m.key]}</span>
                </span>
              );
              return (
                <div key={m.key} className="flex items-center gap-2 px-3 py-2.5">
                  <Switch checked={shown} onCheckedChange={(v) => toggleModule(m.key, v)} aria-label={`Show ${m.label}`} />
                  {EDITABLE.has(m.key) ? (
                    <button type="button" onClick={() => setActive(m.key)} className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-80" aria-label={`Edit ${m.label}`}>
                      {body}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ) : (
                    body
                  )}
                  <span className="flex shrink-0 items-center">
                    <button type="button" onClick={() => moveModule(m.key, -1)} disabled={at === 0} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent" aria-label={`Move ${m.label} up`} title="Move up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => moveModule(m.key, 1)} disabled={at === ordered.length - 1} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent" aria-label={`Move ${m.label} down`} title="Move down">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {Number.isFinite(pageId) && pageId > 0 && (
          <div>
            <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Manage</div>
            <div className="divide-y rounded-lg border">
              {(
                [
                  { tab: "kit", label: "Launch kit", hint: "Create the one-pager, graphics and media kit; see who opened what" },
                  { tab: "activity", label: "To do", hint: "Access requests, the marketing plan to send, customer requests" },
                  { tab: "practices", label: "Practices & files", hint: "The practice list and files the customer uploaded" },
                  { tab: "calendar", label: "Calendar", hint: "Connect a calendar, review minutes drafts" },
                  { tab: "settings", label: "Room settings", hint: "Who has access, Slack channel, weekly digest" },
                ] as { tab: RoomPanelTab; label: string; hint: string }[]
              ).map((m) => (
                <button key={m.tab} type="button" onClick={() => setRoomTab(m.tab)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50" data-room-manage={m.tab}>
                  <DoorOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{m.hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // People on our side who have a booking link: the calendars the "Schedule" button can use.
  const bookable = (team[0]?.members ?? []).filter((m) => /^https?:\/\//i.test((m.bookingUrl ?? "").trim()) && (m.name ?? "").trim()).map((m) => ({ name: m.name.trim(), role: m.role, bookingUrl: (m.bookingUrl ?? "").trim() }));
  // The people on the Team module, offered wherever an owner is typed (first group = ours, the rest = the customer's).
  const named = (g: RoomTeamGroup | undefined) => (g?.members ?? []).map((m) => (m.name ?? "").trim()).filter((n) => n && !/^\[.*\]$/.test(n) && n !== "New person");
  const oursList = named(team[0]);
  const theirsList = team.slice(1).flatMap(named);
  return (
    <div className="space-y-3">
      <datalist id="room-people-ours">{oursList.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="room-people-theirs">{theirsList.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="room-people-all">{[...new Set([...oursList, ...theirsList])].map((n) => <option key={n} value={n} />)}</datalist>
      <button type="button" onClick={() => setActive(null)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> All modules
      </button>
      {active === "account" && (
      <SectionBody title="Account" hint="Who the room is for, the kickoff date and the cover">
        <Field label="Customer name"><Input value={props.partnerName ?? ""} onChange={(e) => update({ partnerName: e.target.value })} className="h-8 text-xs font-semibold" /></Field>
        <Field label="Short name (optional)"><Input value={props.partnerShort ?? ""} onChange={(e) => update({ partnerShort: e.target.value })} className="h-8 text-xs" /></Field>
        <div className="flex items-center gap-2">
          <ThumbButton value={props.partnerLogoUrl ?? ""} onChange={(url) => update({ partnerLogoUrl: url })} label="Customer logo (for the dark cover)" />
          <span className="text-[11px] text-muted-foreground">Customer logo</span>
        </div>
        <div className="space-y-1 rounded border p-2" data-room-require-email>
          <label className="flex items-center gap-2 text-xs font-semibold">
            <Switch checked={!!props.requireEmail} onCheckedChange={(v) => update({ requireEmail: v })} aria-label="Ask for an email before showing the hub" />
            Ask for a work email before showing the hub
          </label>
        </div>
        <div className="space-y-1 rounded border p-2" data-room-share-map>
          <label className="flex items-center gap-2 text-xs font-semibold">
            <Switch checked={!!props.shareMap} onCheckedChange={(v) => update({ shareMap: v })} aria-label="Show the practice map to anyone who opens the hub" />
            Show the practice map to anyone who opens the hub
          </label>
        </div>
        <div className="space-y-1.5 rounded border p-2" data-room-look-setting>
          <div className="text-xs font-semibold">Look</div>
          <div className="grid grid-cols-2 gap-1.5">
            {ROOM_LOOKS.map((l) => {
              const on = roomLook(props.look) === l.id;
              return (
                <button key={l.id} type="button" onClick={() => update({ look: l.id })} aria-pressed={on} title={l.hint} className={`rounded-md border px-2 py-1.5 text-[11px] font-medium ${on ? "border-foreground bg-muted" : "text-muted-foreground hover:bg-muted/50"}`} data-room-look-option={l.id}>
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Switch checked={!!props.partnerLogoOriginal} onCheckedChange={(v) => update({ partnerLogoOriginal: v })} aria-label="Keep the logo's own colours" />
          Keep the logo’s own colours
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Field label={`Customer logo size · ${Math.round(props.partnerLogoScale ?? 100)}%`}>
            <input type="range" min={50} max={300} step={5} value={props.partnerLogoScale ?? 100} onChange={(e) => update({ partnerLogoScale: Number(e.target.value) })} className="w-full" aria-label="Customer logo size" data-room-logo-size="partner" />
          </Field>
          <Field label={`Your logo size · ${Math.round(props.brandLogoScale ?? 100)}%`}>
            <input type="range" min={50} max={300} step={5} value={props.brandLogoScale ?? 100} onChange={(e) => update({ brandLogoScale: Number(e.target.value) })} className="w-full" aria-label="Your logo size" data-room-logo-size="brand" />
          </Field>
        </div>
        <div className="space-y-1.5 rounded border p-2" data-room-schedule-settings>
          <span className="text-xs font-semibold">“Schedule” button (top bar)</span>
          <Field label="Whose calendar it books">
            <Select
              value={!props.scheduleUrl ? "off" : bookable.find((m) => m.bookingUrl === props.scheduleUrl)?.name ?? "custom"}
              onValueChange={(v) => {
                if (v === "off") update({ scheduleUrl: "", scheduleRep: "" });
                else if (v === "custom") update({ scheduleUrl: props.scheduleUrl || "https://", scheduleRep: "" });
                else update({ scheduleUrl: bookable.find((m) => m.name === v)?.bookingUrl ?? "", scheduleRep: v });
              }}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off" className="text-xs">No button</SelectItem>
                {bookable.map((m) => <SelectItem key={m.name} value={m.name} className="text-xs">{m.name}{m.role ? ` · ${m.role}` : ""}</SelectItem>)}
                <SelectItem value="custom" className="text-xs">Another booking link…</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {!!props.scheduleUrl && (
            <>
              <Input value={props.scheduleUrl} onChange={(e) => update({ scheduleUrl: e.target.value.trim(), scheduleRep: "" })} className="h-7 text-xs" placeholder="https://calendly.com/…" aria-label="Booking link" />
              <Input value={props.scheduleLabel ?? ""} onChange={(e) => update({ scheduleLabel: e.target.value })} className="h-7 text-xs" aria-label="Button text" />
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Kickoff date"><Input type="date" value={props.kickoffDate ?? ""} onChange={(e) => update({ kickoffDate: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Rollout length (days)"><Input type="number" min={1} value={props.rolloutDays ?? 90} onChange={(e) => update({ rolloutDays: Math.max(1, Number(e.target.value) || 90) })} className="h-8 text-xs" /></Field>
        </div>
        <Field label="Headline"><Input value={props.headline?.trim() ? props.headline : roomHeadlineDefault(brandName)} onChange={(e) => update({ headline: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Label above the headline"><Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Cover style">
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                { id: "fade", label: "Fading photo", hint: "The photo runs off the right edge and fades into the cover" },
                { id: "split", label: "Photo card", hint: "Text beside a framed photo" },
                { id: "fullbleed", label: "Full-bleed", hint: "The photo fills the cover" },
                { id: "light", label: "Light", hint: "Pale, editorial" },
              ] as const
            ).map((c) => {
              const on = (props.coverStyle ?? "fade") === c.id;
              return (
                <button key={c.id} type="button" onClick={() => update({ coverStyle: c.id })} aria-pressed={on} title={c.hint} className={`rounded-md border px-2 py-1.5 text-[11px] font-medium ${on ? "border-foreground bg-muted" : "text-muted-foreground hover:bg-muted/50"}`} data-room-cover-option={c.id}>
                  {c.label}
                </button>
              );
            })}
          </div>
        </Field>
        {(props.coverStyle ?? "fade") === "fade" && (
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Switch checked={!props.coverPhotoScrolls} onCheckedChange={(v) => update({ coverPhotoScrolls: !v })} aria-label="Photo stays in place while the page scrolls" />
            Photo stays in place while the page scrolls
          </label>
        )}
        <div className="flex items-center gap-2">
          <ThumbButton value={props.heroImageUrl ?? ""} onChange={(url) => update({ heroImageUrl: url })} label="Cover photo" />
          <span className="text-[11px] text-muted-foreground">Cover photo</span>
        </div>
        <div className="flex items-center gap-2" data-room-feed-photo>
          <ThumbButton value={props.feedPhotoUrl ?? ""} onChange={(url) => update({ feedPhotoUrl: url })} label="News Feed photo" />
          <span className="text-[11px] text-muted-foreground">News Feed photo (Overview)</span>
        </div>
      </SectionBody>
      )}


      {active === "overview" && (
      <SectionBody title={`Onboarding checklist (${steps.length})`} hint="Shows on the overview until every step is done">
        <label className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs">
          <span>Show the checklist</span>
          <Switch checked={!onboarding.hidden} onCheckedChange={(v) => setOnboarding({ hidden: !v })} aria-label="Show the onboarding checklist" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Title"><Input value={onboarding.title ?? ""} onChange={(e) => setOnboarding({ title: e.target.value })} className="h-8 text-xs" placeholder="Blank = Welcome, first name!" /></Field>
          <Field label="Intro"><Input value={onboarding.intro ?? ""} onChange={(e) => setOnboarding({ intro: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        {steps.map((x, i) => (
          <CollapseItem key={i} startOpen={String(x.title || `Step ${i + 1}`).startsWith("New ")} header={<ItemHeader label={x.title || `Step ${i + 1}`} index={i} total={steps.length} onMove={(dir) => setOnboarding({ steps: moveItem(steps, i, dir) })} onRemove={() => setOnboarding({ steps: steps.filter((_, idx) => idx !== i) })} />}>
            <Input value={x.title ?? ""} onChange={(e) => setStep(i, { title: e.target.value })} className="h-8 text-xs font-semibold" placeholder="Upload your logo" />
            <Input value={x.description ?? ""} onChange={(e) => setStep(i, { description: e.target.value })} className="h-7 text-xs" placeholder="Why we need it" />
            <div className="grid grid-cols-2 gap-1">
              <Select value={x.action} onValueChange={(v) => setStep(i, { action: v as RoomStepAction })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STEP_ACTION_LABEL) as RoomStepAction[]).map((a) => <SelectItem key={a} value={a} className="text-xs">{STEP_ACTION_LABEL[a]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={x.buttonLabel ?? ""} onChange={(e) => setStep(i, { buttonLabel: e.target.value })} className="h-7 text-xs" placeholder="Button label" />
            </div>
            {x.action === "link" && <Input value={x.url ?? ""} onChange={(e) => setStep(i, { url: e.target.value })} className="h-7 text-xs" placeholder="https://…" />}
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[11px]">
                <Switch checked={!!x.done} onCheckedChange={(v) => setStep(i, { done: v })} aria-label="Mark this step done" />
                {x.done ? "Checked off by you" : "Check off for the customer"}
              </label>
              <HideToggle hidden={x.hidden} onChange={(h) => setStep(i, { hidden: h })} />
            </div>
          </CollapseItem>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setOnboarding({ steps: [...steps, { key: `onboard-${Date.now().toString(36)}`, title: "New step", action: "check" }] })}>
          <Plus className="h-3 w-3" /> Add step
        </Button>
      </SectionBody>
      )}

      {active === "goals" && (
      <SectionBody title={`Goals (${goalItems.length})`} hint="What success looks like, and where each goal stands">
        <label className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs">
          <span>Ask the customer to agree to these goals</span>
          <Switch checked={!!goals.askAgreement} onCheckedChange={(v) => setGoals({ askAgreement: v })} aria-label="Ask the customer to agree" />
        </label>
        <Field label="What the customer calls a location"><Input value={props.locationsNoun ?? ""} onChange={(e) => update({ locationsNoun: e.target.value })} className="h-8 text-xs" placeholder="locations" /></Field>
        {goalItems.map((g, i) => (
          <CollapseItem key={i} startOpen={String(g.title || `Goal ${i + 1}`).startsWith("New ")} header={<ItemHeader label={g.title || `Goal ${i + 1}`} index={i} total={goalItems.length} onMove={(dir) => setGoals({ items: moveItem(goalItems, i, dir) })} onRemove={() => setGoals({ items: goalItems.filter((_, idx) => idx !== i) })} />}>
            <Input value={g.title ?? ""} onChange={(e) => setGoal(i, { title: e.target.value })} className="h-8 text-xs font-semibold" placeholder="Goal" />
            <Input value={g.detail ?? ""} onChange={(e) => setGoal(i, { detail: e.target.value })} className="h-7 text-xs" placeholder="Detail (optional)" />
            <div className="grid grid-cols-[1fr_90px] gap-1">
              <Input value={g.target ?? ""} onChange={(e) => setGoal(i, { target: e.target.value })} className="h-7 text-xs" placeholder="Target as it reads (40 by Day 90)" />
              <Input type="number" value={g.targetValue ?? ""} onChange={(e) => setGoal(i, { targetValue: e.target.value === "" ? undefined : Number(e.target.value) })} className="h-7 text-xs" placeholder="As a number" />
            </div>
            <Select value={g.metric ?? "manual"} onValueChange={(v) => setGoal(i, { metric: v as RoomGoalMetric })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(GOAL_METRIC_LABEL) as RoomGoalMetric[]).map((m) => <SelectItem key={m} value={m} className="text-xs">{GOAL_METRIC_LABEL[m]}</SelectItem>)}
              </SelectContent>
            </Select>
            {(g.metric ?? "manual") === "manual" && (
              <div className="grid grid-cols-[1fr_90px] gap-1">
                <Input value={g.current ?? ""} onChange={(e) => setGoal(i, { current: e.target.value })} className="h-7 text-xs" placeholder="Today as it reads (22%)" />
                <Input type="number" value={g.currentValue ?? ""} onChange={(e) => setGoal(i, { currentValue: e.target.value === "" ? undefined : Number(e.target.value) })} className="h-7 text-xs" placeholder="As a number" />
                <Input value={g.source ?? ""} onChange={(e) => setGoal(i, { source: e.target.value })} className="col-span-2 h-7 text-xs" placeholder="Where the number came from, and when" />
              </div>
            )}
            <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-1">
              <Select value={g.status ?? "on-track"} onValueChange={(v) => setGoal(i, { status: v as RoomGoal["status"] })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on-track" className="text-xs">On track</SelectItem>
                  <SelectItem value="pending" className="text-xs">Needs attention</SelectItem>
                  <SelectItem value="done" className="text-xs">Achieved</SelectItem>
                </SelectContent>
              </Select>
              <Input value={g.owner ?? ""} onChange={(e) => setGoal(i, { owner: e.target.value })} className="h-7 text-xs" placeholder="Owner" list="room-people-all" />
              <HideToggle hidden={g.hidden} onChange={(h) => setGoal(i, { hidden: h })} />
            </div>
          </CollapseItem>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setGoals({ items: [...goalItems, { key: `goal-${Date.now().toString(36)}`, title: "New goal", metric: "manual", status: "on-track" }] })}>
          <Plus className="h-3 w-3" /> Add goal
        </Button>
      </SectionBody>
      )}

      {active === "calendar" && (
      <SectionBody title={`Calendar (${events.length})`} hint="Meetings, trainings and sends. The next three also show on the overview">
        {events.map((ev, i) => (
          <CollapseItem key={i} startOpen={String(ev.title || `Event ${i + 1}`).startsWith("New ")} header={<ItemHeader label={ev.title || `Event ${i + 1}`} index={i} total={events.length} onMove={(dir) => setCalendar({ events: moveItem(events, i, dir) })} onRemove={() => setCalendar({ events: events.filter((_, idx) => idx !== i) })} />}>
            <Input value={ev.title ?? ""} onChange={(e) => setEvent(i, { title: e.target.value })} className="h-8 text-xs font-semibold" placeholder="Event" />
            <div className="grid grid-cols-2 gap-1">
              <Input type="date" value={ev.date ?? ""} onChange={(e) => setEvent(i, { date: e.target.value })} className="h-7 text-xs" aria-label="Date" />
              <Input value={ev.time ?? ""} onChange={(e) => setEvent(i, { time: e.target.value })} className="h-7 text-xs" placeholder="2:00 pm CT · 30 min" />
            </div>
            <Input value={ev.detail ?? ""} onChange={(e) => setEvent(i, { detail: e.target.value })} className="h-7 text-xs" placeholder="Detail (who it is for, where)" />
            <div className="grid grid-cols-[1fr_auto] items-center gap-1">
              <Select value={ev.kind ?? "meeting"} onValueChange={(v) => setEvent(i, { kind: v as RoomEventKind })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROOM_EVENT_KIND_LABEL) as RoomEventKind[]).map((k) => <SelectItem key={k} value={k} className="text-xs">{ROOM_EVENT_KIND_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
              <HideToggle hidden={ev.hidden} onChange={(h) => setEvent(i, { hidden: h })} />
            </div>
          </CollapseItem>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setCalendar({ events: [...events, { key: `event-${Date.now().toString(36)}`, title: "New event", date: todayIso, kind: "meeting" }] })}>
          <Plus className="h-3 w-3" /> Add event
        </Button>
        {standardCheckpoints(props.kickoffDate).some((c) => !events.some((e) => e.key === c.key)) && (
          <Button type="button" variant="outline" size="sm" className="ml-1 h-7 gap-1 text-[11px]" onClick={() => setCalendar({ events: [...events, ...standardCheckpoints(props.kickoffDate).filter((c) => !events.some((e) => e.key === c.key))] })}>
            <Plus className="h-3 w-3" /> Add kickoff and Day 30 / 60 / 90
          </Button>
        )}
      </SectionBody>
      )}

      {active === "meetings" && (
      <SectionBody title={`Meetings (${meetingItems.length})`} hint="Minutes: decisions and action items, newest first">
        {meetingItems.map((m, i) => (
          <CollapseItem key={i} startOpen={String(m.title || `Meeting ${i + 1}`).startsWith("New ")} header={<ItemHeader label={m.title || `Meeting ${i + 1}`} index={i} total={meetingItems.length} onMove={(dir) => setMinutes({ items: moveItem(meetingItems, i, dir) })} onRemove={() => setMinutes({ items: meetingItems.filter((_, idx) => idx !== i) })} />}>
            <div className="grid grid-cols-[1fr_130px] gap-1">
              <Input value={m.title ?? ""} onChange={(e) => setMeeting(i, { title: e.target.value })} className="h-8 text-xs font-semibold" placeholder="Meeting" />
              <Input type="date" value={m.date ?? ""} onChange={(e) => setMeeting(i, { date: e.target.value })} className="h-8 text-xs" aria-label="Date" />
            </div>
            <Input value={m.attendees ?? ""} onChange={(e) => setMeeting(i, { attendees: e.target.value })} className="h-7 text-xs" placeholder="Who attended" />
            <Textarea value={m.summary ?? ""} onChange={(e) => setMeeting(i, { summary: e.target.value })} rows={2} className="text-xs" placeholder="Summary (two or three sentences)" />
            <Field label="Decisions, one per line">
              <Textarea value={(m.decisions ?? []).join("\n")} onChange={(e) => setMeeting(i, { decisions: e.target.value.split("\n") })} rows={3} className="text-xs" />
            </Field>
            <Field label="Action items">
              <div className="space-y-1">
                {(m.actions ?? []).map((a, ai) => (
                  <div key={ai} className="grid grid-cols-[1fr_70px_70px_auto_auto] items-center gap-1">
                    <Input value={a.text ?? ""} onChange={(e) => setAction(i, ai, { text: e.target.value })} className="h-7 text-xs" placeholder="Action" />
                    <Input value={a.owner ?? ""} onChange={(e) => setAction(i, ai, { owner: e.target.value })} className="h-7 text-xs" placeholder="Owner (pick from Our Team)" list="room-people-all" />
                    <Input value={a.due ?? ""} onChange={(e) => setAction(i, ai, { due: e.target.value })} className="h-7 text-xs" placeholder="Due" />
                    <Switch checked={!!a.done} onCheckedChange={(v) => setAction(i, ai, { done: v })} aria-label="Done" title="Done" />
                    <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Remove action" onClick={() => setMeeting(i, { actions: (m.actions ?? []).filter((_, idx) => idx !== ai) })}><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-1 text-[11px]" onClick={() => setMeeting(i, { actions: [...(m.actions ?? []), { text: "" }] })}>
                  <Plus className="h-3 w-3" /> Add action
                </Button>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-1">
              <Input value={m.notesUrl ?? ""} onChange={(e) => setMeeting(i, { notesUrl: e.target.value })} className="h-7 text-xs" placeholder="Notes link" />
              <Input value={m.recordingUrl ?? ""} onChange={(e) => setMeeting(i, { recordingUrl: e.target.value })} className="h-7 text-xs" placeholder="Recording link" />
            </div>
            <HideToggle hidden={m.hidden} onChange={(h) => setMeeting(i, { hidden: h })} />
          </CollapseItem>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setMinutes({ items: [{ key: `meeting-${Date.now().toString(36)}`, title: "New meeting", date: todayIso, decisions: [], actions: [] }, ...meetingItems] })}>
          <Plus className="h-3 w-3" /> Add meeting
        </Button>
      </SectionBody>
      )}

      {active === "marketing" && (
      <SectionBody title="Marketing plan" hint="Programs the customer includes, skips or picks an option for">
        {mGroups.map((g, gi) => (
          <CollapseItem key={gi} startOpen={String(g.title || `Group ${gi + 1}`).startsWith("New ")} header={<ItemHeader label={g.title || `Group ${gi + 1}`} index={gi} total={mGroups.length} onMove={(dir) => setMarketing({ groups: moveItem(mGroups, gi, dir) })} onRemove={() => setMarketing({ groups: mGroups.filter((_, idx) => idx !== gi) })} />}>
            <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-1">
              <Input value={g.title ?? ""} onChange={(e) => setMGroup(gi, { title: e.target.value })} className="h-7 text-xs font-semibold" placeholder="Standard launch package" />
              <Input value={g.note ?? ""} onChange={(e) => setMGroup(gi, { note: e.target.value })} className="h-7 text-xs" placeholder="Note (Included)" />
              <HideToggle hidden={g.hidden} onChange={(h) => setMGroup(gi, { hidden: h })} />
            </div>
            {(g.programs ?? []).map((x, pi) => (
              <div key={pi} className="space-y-1 rounded border border-dashed p-1.5">
                <div className="flex items-center gap-2">
                  <ThumbButton value={x.imageUrl ?? ""} onChange={(url) => setProgram(gi, pi, { imageUrl: url })} label="Program image" size="sm" />
                  <Input value={x.title ?? ""} onChange={(e) => setProgram(gi, pi, { title: e.target.value })} className="h-7 flex-1 text-xs font-medium" placeholder="Program" />
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-muted-foreground" onClick={() => setMGroup(gi, { programs: g.programs.filter((_, idx) => idx !== pi) })}>Remove</Button>
                </div>
                <Input value={x.description ?? ""} onChange={(e) => setProgram(gi, pi, { description: e.target.value })} className="h-7 text-xs" placeholder="What it is" />
                <Textarea value={x.details ?? ""} onChange={(e) => setProgram(gi, pi, { details: e.target.value })} rows={3} className="text-xs" placeholder="More about it, shown when the row is opened: what it involves, what the customer needs to do" />
                {(x.links ?? []).map((l, li) => (
                  <div key={li} className="grid grid-cols-[1fr_1.4fr_auto] gap-1">
                    <Input value={l.label ?? ""} onChange={(e) => setProgram(gi, pi, { links: (x.links ?? []).map((y, yi) => (yi === li ? { ...y, label: e.target.value } : y)) })} className="h-7 text-xs" placeholder="Link text (See an example)" />
                    <Input value={l.url ?? ""} onChange={(e) => setProgram(gi, pi, { links: (x.links ?? []).map((y, yi) => (yi === li ? { ...y, url: e.target.value.trim() } : y)) })} className="h-7 text-xs" placeholder="https://…" />
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5" aria-label="Remove link" onClick={() => setProgram(gi, pi, { links: (x.links ?? []).filter((_, yi) => yi !== li) })}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="h-6 gap-1 px-2 text-[11px]" onClick={() => setProgram(gi, pi, { links: [...(x.links ?? []), { label: "", url: "" }] })}>
                  <Plus className="h-3 w-3" /> Add a link to more info
                </Button>
                <div className="grid grid-cols-2 gap-1">
                  <Input value={x.audience ?? ""} onChange={(e) => setProgram(gi, pi, { audience: e.target.value })} className="h-7 text-xs" placeholder="Who it reaches" />
                  <Input value={x.when ?? ""} onChange={(e) => setProgram(gi, pi, { when: e.target.value })} className="h-7 text-xs" placeholder="When (Day 15)" />
                </div>
                <div className="grid grid-cols-[1fr_auto] items-center gap-1">
                  <Input
                    value={roomProgramOptions(x).join(", ")}
                    onChange={(e) => setProgram(gi, pi, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                    className="h-7 text-xs"
                    placeholder="Choices, comma-separated (Include, Not now). Blank = fixed"
                  />
                  <HideToggle hidden={x.hidden} onChange={(h) => setProgram(gi, pi, { hidden: h })} />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setMGroup(gi, { programs: [...(g.programs ?? []), { key: `mk-${Date.now().toString(36)}`, title: "New program", options: ["Include", "Not now"] }] })}>
              <Plus className="h-3 w-3" /> Add program
            </Button>
          </CollapseItem>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setMarketing({ groups: [...mGroups, { title: "New group", programs: [] }] })}>
          <Plus className="h-3 w-3" /> Add group
        </Button>
      </SectionBody>
      )}

      {active === "overview" && (
      <SectionBody title={`Rollout phases (${phases.length})`} hint="The track on the overview">
        {phases.map((p, i) => (
          <CollapseItem key={i} startOpen={String(p.title || `Phase ${i + 1}`).startsWith("New ")} header={<ItemHeader label={p.title || `Phase ${i + 1}`} index={i} total={phases.length} onMove={(dir) => update({ phases: moveItem(phases, i, dir) })} onRemove={() => update({ phases: phases.filter((_, idx) => idx !== i) })} />}>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <Field label="Label"><Input value={p.label ?? ""} onChange={(e) => setPhase(i, { label: e.target.value })} className="h-8 text-xs" placeholder="Days 1–30" /></Field>
              <Field label="Ends on day"><Input type="number" min={1} value={p.endDay ?? ""} onChange={(e) => setPhase(i, { endDay: Number(e.target.value) || undefined })} className="h-8 text-xs" /></Field>
            </div>
            <Field label="Title"><Input value={p.title ?? ""} onChange={(e) => setPhase(i, { title: e.target.value })} className="h-8 text-xs font-semibold" /></Field>
            <Field label="One line"><Textarea value={p.summary ?? ""} onChange={(e) => setPhase(i, { summary: e.target.value })} rows={2} className="text-xs" /></Field>
          </CollapseItem>
        ))}
        {phases.length < 5 && (
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => update({ phases: [...phases, { label: "", title: "New phase", summary: "" }] })}>
            <Plus className="h-3 w-3" /> Add phase
          </Button>
        )}
      </SectionBody>
      )}

      {active === "plan" && (
      <SectionBody title="Action plan" hint="Milestones by phase, an owner on each side">
        {groups.map((g, gi) => (
          <CollapseItem key={gi} startOpen={String(g.title || `Phase ${gi + 1}`).startsWith("New ")} header={<ItemHeader label={g.title || `Phase ${gi + 1}`} index={gi} total={groups.length} onMove={(dir) => update({ planGroups: moveItem(groups, gi, dir) })} onRemove={() => update({ planGroups: groups.filter((_, idx) => idx !== gi) })} />}>
            <div className="flex items-center gap-2">
              <Input value={g.title ?? ""} onChange={(e) => setGroup(gi, { title: e.target.value })} className="h-8 flex-1 text-xs font-semibold" placeholder="Days 1–30 · Foundation" />
              <HideToggle hidden={g.hidden} onChange={(h) => setGroup(gi, { hidden: h })} />
            </div>
            <Input value={g.checkpoint ?? ""} onChange={(e) => setGroup(gi, { checkpoint: e.target.value })} className="h-7 text-xs" placeholder="Checkpoint: what done looks like for this phase" />
            {(g.rows ?? []).map((r, ri) => (
              <div key={ri} className="space-y-1 rounded border border-dashed p-1.5">
                <div className="flex items-center gap-1">
                  <Input value={r.task ?? ""} onChange={(e) => setRow(gi, ri, { task: e.target.value })} className="h-7 flex-1 text-xs font-medium" placeholder="Milestone" />
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-muted-foreground" onClick={() => setGroup(gi, { rows: g.rows.filter((_, idx) => idx !== ri) })}>Remove</Button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <Input value={r.target ?? ""} onChange={(e) => setRow(gi, ri, { target: e.target.value })} className="h-7 text-xs" placeholder="Target (Oct 22)" />
                  <Input value={r.ourOwner ?? ""} onChange={(e) => setRow(gi, ri, { ourOwner: e.target.value })} className="h-7 text-xs" placeholder="Your owner (pick from Our Team)" list="room-people-ours" />
                  <Input value={r.partnerOwner ?? ""} onChange={(e) => setRow(gi, ri, { partnerOwner: e.target.value })} className="h-7 text-xs" placeholder="Their owner (pick from Our Team)" list="room-people-theirs" />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Select value={resolveRoomStatus(r.status)} onValueChange={(v) => setRow(gi, ri, { status: v as RoomMilestoneStatus })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_ORDER.map((s) => <SelectItem key={s} value={s} className="text-xs">{ROOM_STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select
                    value={r.customerAction ?? "none"}
                    onValueChange={(v) => setRow(gi, ri, v === "none" ? { customerAction: undefined } : { customerAction: v as "check" | "upload", key: r.key || roomMilestoneKey(r) })}
                  >
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">Customer: view only</SelectItem>
                      <SelectItem value="check" className="text-xs">Customer marks it complete</SelectItem>
                      <SelectItem value="upload" className="text-xs">Customer uploads a file</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Input value={r.note ?? ""} onChange={(e) => setRow(gi, ri, { note: e.target.value })} className="h-7 text-xs" placeholder="Note (optional)" />
                  {r.customerAction === "upload" && <Input value={r.uploadLabel ?? ""} onChange={(e) => setRow(gi, ri, { uploadLabel: e.target.value })} className="h-7 text-xs" placeholder="Button label (Upload file)" />}
                </div>
                <div className="flex justify-end"><HideToggle hidden={r.hidden} onChange={(h) => setRow(gi, ri, { hidden: h })} /></div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setGroup(gi, { rows: [...(g.rows ?? []), { task: "New milestone", status: "not-started" }] })}>
              <Plus className="h-3 w-3" /> Add milestone
            </Button>
          </CollapseItem>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => update({ planGroups: [...groups, { title: "New phase", checkpoint: "", rows: [] }] })}>
          <Plus className="h-3 w-3" /> Add phase
        </Button>
      </SectionBody>
      )}

      {active === "kit" && (
      <SectionBody title={`Launch kit (${assets.length})`} hint="Assets with View, Download and Request changes">
        {assets.map((a, i) => (
          <CollapseItem key={i} startOpen={String(a.title || `Asset ${i + 1}`).startsWith("New ")} header={<ItemHeader label={a.title || `Asset ${i + 1}`} index={i} total={assets.length} onMove={(dir) => update({ assets: moveItem(assets, i, dir) })} onRemove={() => update({ assets: assets.filter((_, idx) => idx !== i) })} />}>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <Input value={a.title ?? ""} onChange={(e) => setAsset(i, { title: e.target.value })} className="h-8 text-xs font-semibold" placeholder="Title" />
              <Select value={a.kind} onValueChange={(v) => setAsset(i, { kind: v as RoomAssetKind })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABEL) as RoomAssetKind[]).map((k) => <SelectItem key={k} value={k} className="text-xs">{KIND_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Field label="Icon">
              <Select value={a.icon || "auto"} onValueChange={(v) => setAsset(i, { icon: v === "auto" ? "" : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" className="text-xs">Automatic (fits the item)</SelectItem>
                  {ROOM_ASSET_ICONS.map((ic) => (
                    <SelectItem key={ic.key} value={ic.key} className="text-xs"><span className="inline-flex items-center gap-2"><ic.Icon className="h-3.5 w-3.5" /> {ic.label}</span></SelectItem>
                  ))}
                  <SelectItem value="tag" className="text-xs">File-type tag (PDF, TXT)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
              <Input value={a.description ?? ""} onChange={(e) => setAsset(i, { description: e.target.value })} className="h-7 text-xs" placeholder="One line about it" />
              <HideToggle hidden={a.hidden} onChange={(h) => setAsset(i, { hidden: h })} />
            </div>
            {a.kind === "text" && <Textarea value={a.body ?? ""} onChange={(e) => setAsset(i, { body: e.target.value })} rows={5} className="text-xs" placeholder="The copy people will copy" />}
            {a.kind === "link" && <Input value={a.externalUrl ?? ""} onChange={(e) => setAsset(i, { externalUrl: e.target.value })} className="h-7 text-xs" placeholder="https://…" />}
            {a.kind === "image" && (
              <div className="flex items-center gap-2">
                <ThumbButton value={a.fileUrl ?? ""} onChange={(url) => setAsset(i, { fileUrl: url })} label="Image" />
                <span className="text-[11px] text-muted-foreground">{a.fileUrl ? "Image attached" : "No image yet"}</span>
              </div>
            )}
            {(a.kind === "pdf" || a.kind === "file") && (
              <div className="space-y-1">
                <Input value={a.fileUrl ?? ""} onChange={(e) => setAsset(i, { fileUrl: e.target.value })} className="h-7 text-xs" placeholder="File URL" />
                {a.kind === "pdf" && <PdfUploadButton onUploaded={(r) => setAsset(i, { fileUrl: r.url, title: a.title || r.title })} />}
              </div>
            )}
          </CollapseItem>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => update({ assets: [...assets, { kind: "pdf", title: "New asset", description: "" }] })}>
          <Plus className="h-3 w-3" /> Add asset
        </Button>
        <div className="space-y-2 pt-2">
          <span className="text-[11px] font-medium text-muted-foreground">Links</span>
          {links.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-1">
              <Input value={l.title} onChange={(e) => update({ links: links.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)) })} className="h-7 text-xs" placeholder="Title" />
              <Input value={l.url} onChange={(e) => update({ links: links.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)) })} className="h-7 text-xs" placeholder="https://…" />
              <HideToggle hidden={l.hidden} onChange={(h) => update({ links: links.map((x, idx) => (idx === i ? { ...x, hidden: h } : x)) })} />
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-muted-foreground" onClick={() => update({ links: links.filter((_, idx) => idx !== i) })}>Remove</Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => update({ links: [...links, { title: "New link", url: "" }] })}>
            <Plus className="h-3 w-3" /> Add link
          </Button>
        </div>
      </SectionBody>
      )}

      {active === "team" && (
      <SectionBody title="Team" hint="Named people on both sides">
        <Field label="Note beside the heading"><Input value={props.teamNote ?? ""} onChange={(e) => update({ teamNote: e.target.value })} className="h-8 text-xs" /></Field>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setRepsOpen(true)} data-room-team-library>
          <Plus className="h-3 w-3" /> Add from the Sales Reps library
        </Button>
        <LibraryPicker
          open={repsOpen}
          onClose={() => setRepsOpen(false)}
          type="team_member"
          title="Sales Reps library"
          onSelect={(items) => {
            // Reps go on our side (the first group), with their photo, email, phone and booking link.
            const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
            const reps = items.map((c) => ({ name: str(c.name), role: str(c.role), email: str(c.email) || undefined, phone: str(c.phone) || undefined, bookingUrl: str(c.chilipiperUrl) || str(c.calendlyUrl) || undefined, photoUrl: str(c.photo) || undefined })).filter((r) => r.name);
            if (reps.length === 0 || team.length === 0) return;
            const current = team[0].members ?? [];
            const fresh = reps.filter((r) => !current.some((m) => (r.email && (m.email ?? "").trim().toLowerCase() === r.email.toLowerCase()) || (m.name ?? "").trim().toLowerCase() === r.name.toLowerCase()));
            // Someone already there gets their missing contact details filled in rather than a second entry.
            const merged = current.map((m) => {
              const r = reps.find((x) => (x.email && (m.email ?? "").trim().toLowerCase() === x.email.toLowerCase()) || (m.name ?? "").trim().toLowerCase() === x.name.toLowerCase());
              return r ? { ...m, email: m.email || r.email, phone: m.phone || r.phone, bookingUrl: m.bookingUrl || r.bookingUrl, photoUrl: m.photoUrl || r.photoUrl } : m;
            });
            update({ team: team.map((g, i) => (i === 0 ? { ...g, members: [...merged.filter((m) => !/^\[.*\]$/.test((m.name ?? "").trim())), ...fresh] } : g)) });
          }}
          renderPreview={(item) => {
            const c = item.content as { role?: string; email?: string };
            return <div className="text-xs text-muted-foreground">{[c.role, c.email].filter(Boolean).join(" · ")}</div>;
          }}
        />
        <TeamImport
          groups={team.map((g) => g.title || "Group")}
          pageId={Number.isFinite(pageId) && pageId > 0 ? pageId : null}
          onAdd={(people, fallback) => {
            // A "team" column in the list decides the side (first group = ours, second = the customer's); otherwise the chosen group.
            let added = 0;
            const next = team.map((g, gi) => {
              const mine = people.filter((p) => (p.side ? (p.side === "ours" ? 0 : Math.min(1, team.length - 1)) : fallback) === gi);
              if (mine.length === 0) return g;
              const r = mergeTeamMembers(g.members ?? [], mine);
              added += r.added;
              return r.added ? { ...g, members: r.members as RoomTeamMember[] } : g;
            });
            if (added) update({ team: next });
            return added;
          }}
        />
        {team.map((g, gi) => (
          <CollapseItem key={gi} startOpen={String(g.title || `Group ${gi + 1}`).startsWith("New ")} header={<ItemHeader label={g.title || `Group ${gi + 1}`} index={gi} total={team.length} onMove={(dir) => update({ team: moveItem(team, gi, dir) })} onRemove={() => update({ team: team.filter((_, idx) => idx !== gi) })} />}>
            <div className="flex items-center gap-2">
              <Input value={g.title ?? ""} onChange={(e) => setTeam(gi, { title: e.target.value })} className="h-8 flex-1 text-xs font-semibold" />
              <HideToggle hidden={g.hidden} onChange={(h) => setTeam(gi, { hidden: h })} />
            </div>
            {(g.members ?? []).map((m, mi) => (
              <div key={mi} className="space-y-1 rounded border border-dashed p-1.5">
                <div className="flex items-center gap-2">
                  <ThumbButton value={m.photoUrl ?? ""} onChange={(url) => setMember(gi, mi, { photoUrl: url })} label="Photo" size="sm" />
                  <Input value={m.name ?? ""} onChange={(e) => setMember(gi, mi, { name: e.target.value })} className="h-7 flex-1 text-xs font-medium" placeholder="Name" />
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-muted-foreground" onClick={() => setTeam(gi, { members: g.members.filter((_, idx) => idx !== mi) })}>Remove</Button>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Input value={m.role ?? ""} onChange={(e) => setMember(gi, mi, { role: e.target.value })} className="h-7 text-xs" placeholder="Role" />
                  <Input value={m.email ?? ""} onChange={(e) => setMember(gi, mi, { email: e.target.value })} className="h-7 text-xs" placeholder="Email" />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Input value={m.phone ?? ""} onChange={(e) => setMember(gi, mi, { phone: e.target.value })} className="h-7 text-xs" placeholder="Phone (optional)" />
                  <Input value={m.bookingUrl ?? ""} onChange={(e) => setMember(gi, mi, { bookingUrl: e.target.value.trim() })} className="h-7 text-xs" placeholder="Booking link (optional)" />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Input value={m.owns ?? ""} onChange={(e) => setMember(gi, mi, { owns: e.target.value })} className="h-7 text-xs" placeholder="What they own" />
                  <Input value={m.when ?? ""} onChange={(e) => setMember(gi, mi, { when: e.target.value })} className="h-7 text-xs" placeholder="When they engage" />
                </div>
                <div className="flex justify-end"><HideToggle hidden={m.hidden} onChange={(h) => setMember(gi, mi, { hidden: h })} /></div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setTeam(gi, { members: [...(g.members ?? []), { name: "New person", role: "" }] })}>
              <Plus className="h-3 w-3" /> Add person
            </Button>
          </CollapseItem>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => update({ team: [...team, { title: "New group", members: [] }] })}>
          <Plus className="h-3 w-3" /> Add group
        </Button>
      </SectionBody>
      )}
    </div>
  );
}
