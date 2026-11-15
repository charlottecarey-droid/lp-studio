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
  type RoomMilestone,
  type RoomMilestoneStatus,
  type RoomModuleKey,
  type RoomPhase,
  type RoomPlanGroup,
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
import { Plus } from "lucide-react";
import { Field, ItemHeader, PanelSection, moveItem } from "./glow/GlowPanelKit";
import { ThumbButton } from "./HubPanels";

const STATUS_ORDER: RoomMilestoneStatus[] = ["not-started", "on-track", "pending", "blocking", "done"];
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
        <p className="text-[11px] leading-snug text-muted-foreground">A hidden module keeps its content and its data. Hiding Requests also removes “Make a request” and “Request changes”.</p>
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
            <Input value={g.title ?? ""} onChange={(e) => setGroup(gi, { title: e.target.value })} className="h-8 text-xs font-semibold" placeholder="Days 1–30 · Foundation" />
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
            <Input value={a.description ?? ""} onChange={(e) => setAsset(i, { description: e.target.value })} className="h-7 text-xs" placeholder="One line about it" />
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
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1">
              <Input value={l.title} onChange={(e) => update({ links: links.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)) })} className="h-7 text-xs" placeholder="Title" />
              <Input value={l.url} onChange={(e) => update({ links: links.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)) })} className="h-7 text-xs" placeholder="https://…" />
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
            <Input value={g.title ?? ""} onChange={(e) => setTeam(gi, { title: e.target.value })} className="h-8 text-xs font-semibold" />
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
