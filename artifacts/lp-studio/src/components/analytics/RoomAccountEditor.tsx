/**
 * The hub's account settings and its team list, as fields. One editor, two
 * hosts: the page builder's panel (which edits the page as you type) and the
 * hub's manage pop-up (which keeps a draft and saves it), so a rep never has to
 * open the builder to rename a hub, swap a logo or add a teammate.
 */
import { useState, type ReactNode } from "react";
import { ChevronRight, Plus, X } from "lucide-react";
import { ROOM_LOOKS, roomLook } from "@/blocks/hub/room-look";
import { roomHeadlineDefault, type RoomTeamGroup, type RoomTeamMember, type RoomWorkspaceBlockProps } from "@/blocks/BlockRoomWorkspace";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LibraryPicker } from "@/components/LibraryPicker";
import { mergeTeamMembers, parseTeamList, TEAM_IMPORT_COLUMNS, type ImportedPerson } from "@/lib/room-team-import";
import { Field, ItemHeader, moveItem } from "@/pages/builder/property-panels/glow/GlowPanelKit";
import { ThumbButton } from "@/pages/builder/property-panels/HubPanels";

/** The page props the account fields edit. The pop-up saves exactly these. */
export const ROOM_ACCOUNT_KEYS = ["partnerName", "partnerShort", "partnerLogoUrl", "partnerLogoOriginal", "partnerLogoScale", "brandLogoScale", "requireEmail", "shareMap", "look", "scheduleUrl", "scheduleRep", "scheduleLabel", "kickoffDate", "rolloutDays", "headline", "eyebrow", "coverStyle", "coverPhotoScrolls", "heroImageUrl", "feedPhotoUrl"] as const;
export type RoomAccountProps = Pick<RoomWorkspaceBlockProps, (typeof ROOM_ACCOUNT_KEYS)[number]>;
export type RoomTeamProps = Pick<RoomWorkspaceBlockProps, "team" | "teamNote">;

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

/** A list item that stays closed until opened, so a long list reads as a list of names. */
export function CollapseItem({ header, startOpen, children }: { header: ReactNode; startOpen?: boolean; children: ReactNode }) {
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
export function HideToggle({ hidden, onChange }: { hidden?: boolean; onChange: (hidden: boolean) => void }) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
      <Switch checked={!hidden} onCheckedChange={(v) => onChange(!v)} aria-label="Show to the customer" />
      {hidden ? "Hidden" : "Shown"}
    </label>
  );
}

/** Who the hub is for, how it opens, the logos, the "Schedule" button, the kickoff date and the cover. */
export function RoomAccountFields({ props, update, team, brandName, note }: { props: Partial<RoomAccountProps>; update: (patch: Partial<RoomAccountProps>) => void; /** For the "Schedule" button: our people who have a booking link. */ team: RoomTeamGroup[]; brandName?: string; /** Said under the logo sizes (the builder reports the launch assets being remade). */ note?: string }) {
  const kitNote = note ?? "";
  const bookable = (team[0]?.members ?? []).filter((m) => /^https?:\/\//i.test((m.bookingUrl ?? "").trim()) && (m.name ?? "").trim()).map((m) => ({ name: m.name.trim(), role: m.role, bookingUrl: (m.bookingUrl ?? "").trim() }));
  return (
    <>
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
      <p className="text-[11px] text-muted-foreground" data-room-kit-follows>{kitNote || "The social graphics, one-pager and media kit follow these logo sizes."}</p>
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
    </>
  );
}

/** The named people on both sides: our team first, then the customer's. */
export function RoomTeamFields({ props, update, pageId }: { props: RoomTeamProps; update: (patch: Partial<RoomTeamProps>) => void; pageId: number | null }) {
  const team = props.team ?? [];
  const [repsOpen, setRepsOpen] = useState(false);
  const setTeam = (i: number, patch: Partial<RoomTeamGroup>) => update({ team: team.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) });
  const setMember = (gi: number, mi: number, patch: Partial<RoomTeamMember>) => setTeam(gi, { members: team[gi].members.map((m, idx) => (idx === mi ? { ...m, ...patch } : m)) });
  return (
    <>
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
        pageId={pageId}
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
    </>
  );
}
