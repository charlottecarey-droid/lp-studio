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
import { Plus, X } from "lucide-react";
import { Field, ItemHeader, PanelSection, moveItem } from "./glow/GlowPanelKit";
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

/** "Hide from the customer" switch, used on every item that can be hidden. */
function HideToggle({ hidden, onChange }: { hidden?: boolean; onChange: (hidden: boolean) => void }) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
      <Switch checked={!hidden} onCheckedChange={(v) => onChange(!v)} aria-label="Show to the customer" />
      {hidden ? "Hidden" : "Shown"}
    </label>
  );
}

const KIND_LABEL: Record<RoomAssetKind, string> = { pdf: "PDF", image: "Image", text: "Copy (text)", link: "Link", file: "Other file" };

export function RoomWorkspacePanel({ props, onChange }: { props: RoomWorkspaceBlockProps; onChange: (p: RoomWorkspaceBlockProps) => void }) {
  const update = (patch: Partial<RoomWorkspaceBlockProps>) => onChange({ ...props, ...patch });
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

  return (
    <div className="space-y-3">
      <PanelSection title="Account" hint="Who the room is for, the kickoff date and the cover" defaultOpen>
        <Field label="Customer name"><Input value={props.partnerName ?? ""} onChange={(e) => update({ partnerName: e.target.value })} className="h-8 text-xs font-semibold" /></Field>
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
      </PanelSection>

      <PanelSection title="Modules" hint="Show or hide each one for this customer" defaultOpen>
        {ROOM_MODULES.map((m) => (
          <label key={m.key} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs">
            <span>{m.label}</span>
            <Switch checked={!hidden.has(m.key)} onCheckedChange={(v) => toggleModule(m.key, v)} aria-label={`Show ${m.label}`} />
          </label>
        ))}
        <p className="text-[11px] leading-snug text-muted-foreground">A hidden module keeps its content and its data. Hiding Requests also removes “Make a request” and “Request changes”. Single items (a milestone, an asset, a person, a program, an onboarding step) each have their own Shown / Hidden switch below.</p>
      </PanelSection>

      <PanelSection title={`Onboarding checklist (${steps.length})`} hint="Shows on the overview until every step is done" defaultOpen>
        <label className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs">
          <span>Show the checklist</span>
          <Switch checked={!onboarding.hidden} onCheckedChange={(v) => setOnboarding({ hidden: !v })} aria-label="Show the onboarding checklist" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Title"><Input value={onboarding.title ?? ""} onChange={(e) => setOnboarding({ title: e.target.value })} className="h-8 text-xs" placeholder="Blank = Welcome, first name!" /></Field>
          <Field label="Intro"><Input value={onboarding.intro ?? ""} onChange={(e) => setOnboarding({ intro: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        {steps.map((x, i) => (
          <div key={i} className="space-y-1.5 rounded-md border p-2">
            <ItemHeader label={x.title || `Step ${i + 1}`} index={i} total={steps.length} onMove={(dir) => setOnboarding({ steps: moveItem(steps, i, dir) })} onRemove={() => setOnboarding({ steps: steps.filter((_, idx) => idx !== i) })} />
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
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setOnboarding({ steps: [...steps, { key: `onboard-${Date.now().toString(36)}`, title: "New step", action: "check" }] })}>
          <Plus className="h-3 w-3" /> Add step
        </Button>
      </PanelSection>

      <PanelSection title={`Goals (${goalItems.length})`} hint="What success looks like, and where each goal stands">
        <Field label="Intro line"><Textarea value={goals.intro ?? ""} onChange={(e) => setGoals({ intro: e.target.value })} rows={2} className="text-xs" /></Field>
        <label className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs">
          <span>Ask the customer to agree to these goals</span>
          <Switch checked={!!goals.askAgreement} onCheckedChange={(v) => setGoals({ askAgreement: v })} aria-label="Ask the customer to agree" />
        </label>
        <Field label="What the customer calls a location"><Input value={props.locationsNoun ?? ""} onChange={(e) => update({ locationsNoun: e.target.value })} className="h-8 text-xs" placeholder="locations" /></Field>
        {goalItems.map((g, i) => (
          <div key={i} className="space-y-1.5 rounded-md border p-2">
            <ItemHeader label={g.title || `Goal ${i + 1}`} index={i} total={goalItems.length} onMove={(dir) => setGoals({ items: moveItem(goalItems, i, dir) })} onRemove={() => setGoals({ items: goalItems.filter((_, idx) => idx !== i) })} />
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
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setGoals({ items: [...goalItems, { key: `goal-${Date.now().toString(36)}`, title: "New goal", metric: "manual", status: "on-track" }] })}>
          <Plus className="h-3 w-3" /> Add goal
        </Button>
        <p className="text-[11px] leading-snug text-muted-foreground">Counted goals update on their own from the room. The practice list is loaded on this page’s analytics, under Room.</p>
      </PanelSection>

      <PanelSection title={`Calendar (${events.length})`} hint="Meetings, trainings and sends. The next three also show on the overview">
        <Field label="Intro line"><Input value={calendar.intro ?? ""} onChange={(e) => setCalendar({ intro: e.target.value })} className="h-8 text-xs" /></Field>
        {events.map((ev, i) => (
          <div key={i} className="space-y-1.5 rounded-md border p-2">
            <ItemHeader label={ev.title || `Event ${i + 1}`} index={i} total={events.length} onMove={(dir) => setCalendar({ events: moveItem(events, i, dir) })} onRemove={() => setCalendar({ events: events.filter((_, idx) => idx !== i) })} />
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
          </div>
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
      </PanelSection>

      <PanelSection title={`Meetings (${meetingItems.length})`} hint="Minutes: decisions and action items, newest first">
        <Field label="Intro line"><Input value={minutes.intro ?? ""} onChange={(e) => setMinutes({ intro: e.target.value })} className="h-8 text-xs" /></Field>
        {meetingItems.map((m, i) => (
          <div key={i} className="space-y-1.5 rounded-md border p-2">
            <ItemHeader label={m.title || `Meeting ${i + 1}`} index={i} total={meetingItems.length} onMove={(dir) => setMinutes({ items: moveItem(meetingItems, i, dir) })} onRemove={() => setMinutes({ items: meetingItems.filter((_, idx) => idx !== i) })} />
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
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setMinutes({ items: [{ key: `meeting-${Date.now().toString(36)}`, title: "New meeting", date: todayIso, decisions: [], actions: [] }, ...meetingItems] })}>
          <Plus className="h-3 w-3" /> Add meeting
        </Button>
        <p className="text-[11px] leading-snug text-muted-foreground">Everything here is visible to the customer. Keep internal notes out, and only link notes or recordings they may open.</p>
      </PanelSection>

      <PanelSection title="Marketing plan" hint="Programs the customer includes, skips or picks an option for">
        <Field label="Intro line"><Textarea value={marketing.intro ?? ""} onChange={(e) => setMarketing({ intro: e.target.value })} rows={2} className="text-xs" /></Field>
        {mGroups.map((g, gi) => (
          <div key={gi} className="space-y-2 rounded-md border p-2">
            <ItemHeader label={g.title || `Group ${gi + 1}`} index={gi} total={mGroups.length} onMove={(dir) => setMarketing({ groups: moveItem(mGroups, gi, dir) })} onRemove={() => setMarketing({ groups: mGroups.filter((_, idx) => idx !== gi) })} />
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
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setMarketing({ groups: [...mGroups, { title: "New group", programs: [] }] })}>
          <Plus className="h-3 w-3" /> Add group
        </Button>
        <p className="text-[11px] leading-snug text-muted-foreground">The customer’s choices show on this page’s analytics, under Room, and post to Slack.</p>
      </PanelSection>

      <PanelSection title={`Rollout phases (${phases.length})`} hint="The track on the overview">
        {phases.map((p, i) => (
          <div key={i} className="space-y-2 rounded-md border p-2">
            <ItemHeader label={p.title || `Phase ${i + 1}`} index={i} total={phases.length} onMove={(dir) => update({ phases: moveItem(phases, i, dir) })} onRemove={() => update({ phases: phases.filter((_, idx) => idx !== i) })} />
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <Field label="Label"><Input value={p.label ?? ""} onChange={(e) => setPhase(i, { label: e.target.value })} className="h-8 text-xs" placeholder="Days 1–30" /></Field>
              <Field label="Ends on day"><Input type="number" min={1} value={p.endDay ?? ""} onChange={(e) => setPhase(i, { endDay: Number(e.target.value) || undefined })} className="h-8 text-xs" /></Field>
            </div>
            <Field label="Title"><Input value={p.title ?? ""} onChange={(e) => setPhase(i, { title: e.target.value })} className="h-8 text-xs font-semibold" /></Field>
            <Field label="One line"><Textarea value={p.summary ?? ""} onChange={(e) => setPhase(i, { summary: e.target.value })} rows={2} className="text-xs" /></Field>
          </div>
        ))}
        {phases.length < 5 && (
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => update({ phases: [...phases, { label: "", title: "New phase", summary: "" }] })}>
            <Plus className="h-3 w-3" /> Add phase
          </Button>
        )}
      </PanelSection>

      <PanelSection title="Action plan" hint="Milestones by phase, an owner on each side" defaultOpen>
        <Field label="Intro line"><Textarea value={props.planIntro ?? ""} onChange={(e) => update({ planIntro: e.target.value })} rows={2} className="text-xs" /></Field>
        {groups.map((g, gi) => (
          <div key={gi} className="space-y-2 rounded-md border p-2">
            <ItemHeader label={g.title || `Phase ${gi + 1}`} index={gi} total={groups.length} onMove={(dir) => update({ planGroups: moveItem(groups, gi, dir) })} onRemove={() => update({ planGroups: groups.filter((_, idx) => idx !== gi) })} />
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
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => update({ planGroups: [...groups, { title: "New phase", checkpoint: "", rows: [] }] })}>
          <Plus className="h-3 w-3" /> Add phase
        </Button>
        <p className="text-[11px] leading-snug text-muted-foreground">Files a customer uploads are private. They download from this page’s analytics, under Room, where you also set who is allowed to act.</p>
      </PanelSection>

      <PanelSection title={`Launch kit (${assets.length})`} hint="Assets with View, Download and Request changes">
        <Field label="Intro line"><Textarea value={props.kitIntro ?? ""} onChange={(e) => update({ kitIntro: e.target.value })} rows={2} className="text-xs" /></Field>
        {assets.map((a, i) => (
          <div key={i} className="space-y-2 rounded-md border p-2">
            <ItemHeader label={a.title || `Asset ${i + 1}`} index={i} total={assets.length} onMove={(dir) => update({ assets: moveItem(assets, i, dir) })} onRemove={() => update({ assets: assets.filter((_, idx) => idx !== i) })} />
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
          </div>
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
      </PanelSection>

      <PanelSection title="Team" hint="Named people on both sides">
        <Field label="Note beside the heading"><Input value={props.teamNote ?? ""} onChange={(e) => update({ teamNote: e.target.value })} className="h-8 text-xs" /></Field>
        {team.map((g, gi) => (
          <div key={gi} className="space-y-2 rounded-md border p-2">
            <ItemHeader label={g.title || `Group ${gi + 1}`} index={gi} total={team.length} onMove={(dir) => update({ team: moveItem(team, gi, dir) })} onRemove={() => update({ team: team.filter((_, idx) => idx !== gi) })} />
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
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => update({ team: [...team, { title: "New group", members: [] }] })}>
          <Plus className="h-3 w-3" /> Add group
        </Button>
      </PanelSection>
    </div>
  );
}
