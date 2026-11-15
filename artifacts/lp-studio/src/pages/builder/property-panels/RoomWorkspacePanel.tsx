/**
 * Panel for the Partner Room workspace (room-workspace).
 *
 * Order follows how a rep sets a room up: the account (who, kickoff date,
 * cover photo) → which modules this customer sees → the action plan → the
 * launch kit → the team. Who may act in the room, uploaded files and requests
 * live on the page's analytics screen, under Room.
 */
import {
  ROOM_MODULES,
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
} from "@/blocks/BlockRoomWorkspace";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PdfUploadButton } from "@/components/PdfUploadButton";
import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Field, ItemHeader, moveItem } from "./glow/GlowPanelKit";
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

export function RoomWorkspacePanel({ props, onChange }: { props: RoomWorkspaceBlockProps; onChange: (p: RoomWorkspaceBlockProps) => void }) {
  const update = (patch: Partial<RoomWorkspaceBlockProps>) => onChange({ ...props, ...patch });
  // One screen at a time: the list of modules, or one module's settings.
  const [active, setActive] = useState<string | null>(null);
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

  const MODULE_HINT: Partial<Record<RoomModuleKey, string>> = {
    overview: `${steps.length} setup item${steps.length === 1 ? "" : "s"} · ${phases.length} phases`,
    wins: "Posted from the room and from the page’s Room panel",
    goals: `${goalItems.length} goal${goalItems.length === 1 ? "" : "s"}`,
    plan: `${groups.reduce((n, g) => n + (g.rows ?? []).length, 0)} milestones in ${groups.length} phases`,
    practices: "The list is loaded in the page’s Room panel",
    marketing: `${mGroups.reduce((n, g) => n + (g.programs ?? []).length, 0)} programs`,
    kit: `${links.length} link${links.length === 1 ? "" : "s"} · ${assets.length} asset${assets.length === 1 ? "" : "s"}`,
    calendar: `${events.length} event${events.length === 1 ? "" : "s"}, plus synced meetings`,
    meetings: `${meetingItems.length} typed in, plus published minutes`,
    requests: "Managed in the page’s Room panel",
    team: `${team.reduce((n, g) => n + (g.members ?? []).length, 0)} people`,
  };
  const EDITABLE = new Set<string>(["overview", "goals", "plan", "marketing", "kit", "calendar", "meetings", "team"]);

  if (active === null) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setActive("account")} className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left hover:bg-muted/50">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{props.partnerName || "Account"}</span>
            <span className="block truncate text-[11px] text-muted-foreground">Name, logo, kickoff date and cover</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        <div>
          <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Modules</div>
          <div className="divide-y rounded-lg border">
            {ROOM_MODULES.map((m) => {
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
                </div>
              );
            })}
          </div>
        </div>
        <p className="px-1 text-[11px] leading-snug text-muted-foreground">Switch a module off to hide it from this customer; its content and data are kept. Most text can also be edited by clicking it on the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setActive(null)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> All modules
      </button>
      {active === "account" && (
      <SectionBody title="Account" hint="Who the room is for, the kickoff date and the cover">
        <Field label="Customer name"><Input value={props.partnerName ?? ""} onChange={(e) => update({ partnerName: e.target.value })} className="h-8 text-xs font-semibold" /></Field>
        <Field label="Short name (optional)"><Input value={props.partnerShort ?? ""} onChange={(e) => update({ partnerShort: e.target.value })} className="h-8 text-xs" placeholder="MB2" /></Field>
        <p className="text-[11px] leading-snug text-muted-foreground">The name fills in everywhere automatically. In any text, <code>{"{{account}}"}</code> is the customer name and <code>{"{{account_short}}"}</code> the short name; the template’s [Partner name] and [Partner] work the same way.</p>
        <div className="flex items-center gap-2">
          <ThumbButton value={props.partnerLogoUrl ?? ""} onChange={(url) => update({ partnerLogoUrl: url })} label="Customer logo (for the dark cover)" />
          <span className="text-[11px] text-muted-foreground">Customer logo, light version. Blank shows their name.</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Kickoff date"><Input type="date" value={props.kickoffDate ?? ""} onChange={(e) => update({ kickoffDate: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Rollout length (days)"><Input type="number" min={1} value={props.rolloutDays ?? 90} onChange={(e) => update({ rolloutDays: Math.max(1, Number(e.target.value) || 90) })} className="h-8 text-xs" /></Field>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">The kickoff date drives “Day N of 90” and which phase is in progress. Leave it blank to hide both.</p>
        <Field label="Label above the title"><Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Title (after “Customer × You”)"><Input value={props.title ?? ""} onChange={(e) => update({ title: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Intro line"><Textarea value={props.lede ?? ""} onChange={(e) => update({ lede: e.target.value })} rows={2} className="text-xs" /></Field>
        <div className="flex items-center gap-2">
          <ThumbButton value={props.heroImageUrl ?? ""} onChange={(url) => update({ heroImageUrl: url })} label="Cover photo" />
          <span className="text-[11px] text-muted-foreground">Cover photo. Blank gives a text-only cover.</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Next milestone (on the photo)"><Input value={props.nextMilestoneLabel ?? ""} onChange={(e) => update({ nextMilestoneLabel: e.target.value })} className="h-8 text-xs" placeholder="Business Review #2" /></Field>
          <Field label="Its date"><Input type="date" value={props.nextMilestoneDate ?? ""} onChange={(e) => update({ nextMilestoneDate: e.target.value })} className="h-8 text-xs" /></Field>
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
        <Field label="Intro line"><Textarea value={goals.intro ?? ""} onChange={(e) => setGoals({ intro: e.target.value })} rows={2} className="text-xs" /></Field>
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
              <Input value={g.owner ?? ""} onChange={(e) => setGoal(i, { owner: e.target.value })} className="h-7 text-xs" placeholder="Owner" />
              <HideToggle hidden={g.hidden} onChange={(h) => setGoal(i, { hidden: h })} />
            </div>
          </CollapseItem>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setGoals({ items: [...goalItems, { key: `goal-${Date.now().toString(36)}`, title: "New goal", metric: "manual", status: "on-track" }] })}>
          <Plus className="h-3 w-3" /> Add goal
        </Button>
        <p className="text-[11px] leading-snug text-muted-foreground">Counted goals update on their own from the room. The practice list is loaded on this page’s analytics, under Room.</p>
      </SectionBody>
      )}

      {active === "calendar" && (
      <SectionBody title={`Calendar (${events.length})`} hint="Meetings, trainings and sends. The next three also show on the overview">
        <Field label="Intro line"><Input value={calendar.intro ?? ""} onChange={(e) => setCalendar({ intro: e.target.value })} className="h-8 text-xs" /></Field>
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
        <p className="text-[11px] leading-snug text-muted-foreground">Events without a date stay off the page. Customers can add one event to their calendar or subscribe to all of them.</p>
      </SectionBody>
      )}

      {active === "meetings" && (
      <SectionBody title={`Meetings (${meetingItems.length})`} hint="Minutes: decisions and action items, newest first">
        <Field label="Intro line"><Input value={minutes.intro ?? ""} onChange={(e) => setMinutes({ intro: e.target.value })} className="h-8 text-xs" /></Field>
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
                    <Input value={a.owner ?? ""} onChange={(e) => setAction(i, ai, { owner: e.target.value })} className="h-7 text-xs" placeholder="Owner" />
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
        <p className="text-[11px] leading-snug text-muted-foreground">Everything here is visible to the customer. Keep internal notes out, and only link notes or recordings they may open.</p>
      </SectionBody>
      )}

      {active === "marketing" && (
      <SectionBody title="Marketing plan" hint="Programs the customer includes, skips or picks an option for">
        <Field label="Intro line"><Textarea value={marketing.intro ?? ""} onChange={(e) => setMarketing({ intro: e.target.value })} rows={2} className="text-xs" /></Field>
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
                <div className="grid grid-cols-2 gap-1">
                  <Input value={x.audience ?? ""} onChange={(e) => setProgram(gi, pi, { audience: e.target.value })} className="h-7 text-xs" placeholder="Who it reaches" />
                  <Input value={x.when ?? ""} onChange={(e) => setProgram(gi, pi, { when: e.target.value })} className="h-7 text-xs" placeholder="When (Day 15)" />
                </div>
                <div className="grid grid-cols-[1fr_auto] items-center gap-1">
                  <Input
                    value={(x.options ?? []).join(", ")}
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
        <p className="text-[11px] leading-snug text-muted-foreground">The customer’s choices show on this page’s analytics, under Room, and post to Slack.</p>
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
        <Field label="Intro line"><Textarea value={props.planIntro ?? ""} onChange={(e) => update({ planIntro: e.target.value })} rows={2} className="text-xs" /></Field>
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
                  <Input value={r.ourOwner ?? ""} onChange={(e) => setRow(gi, ri, { ourOwner: e.target.value })} className="h-7 text-xs" placeholder="Your owner" />
                  <Input value={r.partnerOwner ?? ""} onChange={(e) => setRow(gi, ri, { partnerOwner: e.target.value })} className="h-7 text-xs" placeholder="Their owner" />
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
        <p className="text-[11px] leading-snug text-muted-foreground">Files a customer uploads are private. They download from this page’s analytics, under Room, where you also set who is allowed to act.</p>
      </SectionBody>
      )}

      {active === "kit" && (
      <SectionBody title={`Launch kit (${assets.length})`} hint="Assets with View, Download and Request changes">
        <Field label="Intro line"><Textarea value={props.kitIntro ?? ""} onChange={(e) => update({ kitIntro: e.target.value })} rows={2} className="text-xs" /></Field>
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
