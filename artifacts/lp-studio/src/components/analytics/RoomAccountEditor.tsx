/**
 * The hub's account settings and its team list, as fields. One editor, two
 * hosts: the page builder's panel (which edits the page as you type) and the
 * hub's manage pop-up (which keeps a draft and saves it), so a rep never has to
 * open the builder to rename a hub, swap a logo or add a teammate.
 */
import { useEffect, useState, type ReactNode } from "react";
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
import { CtaActionConfigSection } from "@/pages/builder/property-panels/CtaActionConfigSection";
import { pickCtaModalConfig, type CtaSuiteFields } from "@/lib/cta-modal";
import type { HeroCtaActionMode } from "@/lib/block-types";

/** The page props the account fields edit. The pop-up saves exactly these. */
export const ROOM_ACCOUNT_KEYS = ["partnerName", "partnerShort", "locationsNoun", "regionalsNoun", "partnerLogoUrl", "partnerLogoOriginal", "partnerLogoScale", "brandLogoScale", "requireEmail", "shareMap", "look", "scheduleUrl", "scheduleRep", "scheduleLabel", "scheduleAction", "scheduleChilipiperUrl", "scheduleVideoUrl", "modalChilipiperUrl", "modalFormSource", "modalFormId", "modalMarketoBaseUrl", "modalMarketoMunchkinId", "modalMarketoFormId", "modalChiliPiperHandoffUrl", "modalChiliPiperHandoffMode", "modalChiliPiperHandoffFieldMap", "modalHeadline", "modalSubheadline", "modalSubmitText", "modalSuccessMessage", "modalDisclaimer", "modalShowFirstName", "modalShowLastName", "modalShowPhone", "modalShowCompany", "kickoffDate", "rolloutDays", "headline", "eyebrow", "coverStyle", "coverPhotoScrolls", "heroImageUrl", "feedPhotoUrl"] as const;
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
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-[11px] text-muted-foreground" onClick={() => setOpen(true)} data-room-team-import>
        <Plus className="h-3 w-3" /> Paste a list or upload a CSV
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

/** A named cluster of settings, so a long form reads as a few short ones. */
function Group({ title, hint, children, ...rest }: { title: string; hint?: string; children: ReactNode } & Record<`data-${string}`, string | undefined>) {
  return (
    <div className="space-y-3 border-t pt-5 first:border-t-0 first:pt-0" {...rest}>
      <div>
        <div className="text-[13px] font-semibold text-muted-foreground">{title}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

/** A switch with its name and one line saying what it does. */
function Toggle({ checked, onChange, title, help, ...rest }: { checked: boolean; onChange: (v: boolean) => void; title: string; help?: string } & Record<`data-${string}`, string | undefined>) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5" {...rest}>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-xs font-medium">{title}</span>
        {help && <span className="block text-[11px] text-muted-foreground">{help}</span>}
      </span>
    </label>
  );
}

/** One choice out of a few, as a row of buttons. The chosen one says what it is underneath. */
function Choice<T extends string>({ value, options, onChange, name }: { value: T; options: readonly { id: T; label: string; hint: string }[]; onChange: (id: T) => void; name: string }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value === o.id;
          return (
            <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={on} title={o.hint} className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium ${on ? "border-foreground bg-muted" : "text-muted-foreground hover:bg-muted/50"}`} {...{ [`data-room-${name}-option`]: o.id }}>
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">{options.find((o) => o.id === value)?.hint}</p>
    </div>
  );
}

const COVER_STYLES = [
  { id: "fade", label: "Fading photo", hint: "The photo runs off the right edge and fades into the cover." },
  { id: "split", label: "Photo card", hint: "The headline sits beside a framed photo." },
  { id: "fullbleed", label: "Full-bleed", hint: "The photo fills the whole cover." },
  { id: "light", label: "Light", hint: "A pale cover with dark text." },
] as const;

/** Who the hub is for, who can open it, the rollout dates, the cover, and the "Schedule" button. */
export function RoomAccountFields({ props, update, team, brandName, note }: { props: Partial<RoomAccountProps>; update: (patch: Partial<RoomAccountProps>) => void; /** For the "Schedule" button: our people who have a booking link. */ team: RoomTeamGroup[]; brandName?: string; /** Said under the logo sizes (the builder reports the launch assets being remade). */ note?: string }) {
  const bookable = (team[0]?.members ?? []).filter((m) => /^https?:\/\//i.test((m.bookingUrl ?? "").trim()) && (m.name ?? "").trim()).map((m) => ({ name: m.name.trim(), role: m.role, bookingUrl: (m.bookingUrl ?? "").trim() }));
  // Off, booking with a named teammate, or the full set of button actions.
  const action = props.scheduleAction ?? "url";
  // "Books with <name>" is the rep picked from the list (`scheduleRep`). Choosing "A link, a form…" clears it, so the
  // list stays on that choice even while the link is still that rep's (it used to jump straight back to the rep, so
  // the form, Chili Piper and video choices could never be reached). A hub saved before `scheduleRep` existed
  // (never set) is still read from the link.
  const repNamed = (props.scheduleRep ?? "").trim();
  const teammate =
    action !== "url"
      ? undefined
      : repNamed
        ? bookable.find((m) => m.name === repNamed && m.bookingUrl === props.scheduleUrl)?.name
        : props.scheduleRep === undefined
          ? bookable.find((m) => m.bookingUrl === props.scheduleUrl)?.name
          : undefined;
  const scheduleMode = teammate ?? (action !== "url" || props.scheduleAction === "url" || !!(props.scheduleUrl ?? "").trim() ? "custom" : "off");
  const hasLogo = !!(props.partnerLogoUrl ?? "").trim();
  const coverStyle = props.coverStyle ?? "fade";
  return (
    <>
      <Group title="Customer" data-room-account-customer="">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Customer name"><Input value={props.partnerName ?? ""} onChange={(e) => update({ partnerName: e.target.value })} className="h-8 text-xs font-semibold" /></Field>
          <Field label="Short name (optional)"><Input value={props.partnerShort ?? ""} onChange={(e) => update({ partnerShort: e.target.value })} className="h-8 text-xs" placeholder="Used where space is tight" /></Field>
          <Field label="What they call a location"><Input value={props.locationsNoun ?? ""} onChange={(e) => update({ locationsNoun: e.target.value })} className="h-8 text-xs" placeholder="locations" maxLength={40} data-room-account-locations /></Field>
          <Field label="What they call regional managers"><Input value={props.regionalsNoun ?? ""} onChange={(e) => update({ regionalsNoun: e.target.value })} className="h-8 text-xs" placeholder="regional managers" maxLength={40} data-room-account-regionals /></Field>
        </div>
        <p className="text-[11px] text-muted-foreground">Plural, as they say it: “offices”, “DBOs”, “RDOs”, “RDs”, “regional directors”. The hub uses these words everywhere it would say “locations” or “regional managers”.</p>
        <div className="flex items-start gap-3">
          <ThumbButton value={props.partnerLogoUrl ?? ""} onChange={(url) => update({ partnerLogoUrl: url })} label="Customer logo" />
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <div className="text-xs font-medium">Customer logo</div>
              <div className="text-[11px] text-muted-foreground">{hasLogo ? "Shown in white on the cover, beside yours." : "No logo yet: their name is shown instead."}</div>
            </div>
            {hasLogo && <Toggle checked={!!props.partnerLogoOriginal} onChange={(v) => update({ partnerLogoOriginal: v })} title="Keep the logo’s own colours" help="Turn on if the logo should not be turned white." />}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={`Customer logo size · ${Math.round(props.partnerLogoScale ?? 100)}%`}>
            <input type="range" min={50} max={300} step={5} value={props.partnerLogoScale ?? 100} onChange={(e) => update({ partnerLogoScale: Number(e.target.value) })} className="w-full" aria-label="Customer logo size" data-room-logo-size="partner" />
          </Field>
          <Field label={`Your logo size · ${Math.round(props.brandLogoScale ?? 100)}%`}>
            <input type="range" min={50} max={300} step={5} value={props.brandLogoScale ?? 100} onChange={(e) => update({ brandLogoScale: Number(e.target.value) })} className="w-full" aria-label="Your logo size" data-room-logo-size="brand" />
          </Field>
        </div>
        <p className="text-[11px] text-muted-foreground" data-room-kit-follows>{note || "The social graphics, one-pager and media kit follow these logo sizes."}</p>
      </Group>

      <Group title="Who can open it">
        <Toggle checked={!!props.requireEmail} onChange={(v) => update({ requireEmail: v })} title="Ask for a work email first" help="Visitors confirm their email before they see the hub, so you know who was in it." data-room-require-email="" />
        <Toggle checked={!!props.shareMap} onChange={(v) => update({ shareMap: v })} title="Show the practice map to everyone" help="Off: only people with access see where the practices are." data-room-share-map="" />
      </Group>

      <Group title="Rollout dates" hint="The day count and the rollout track on the Overview run from these.">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Kickoff date"><Input type="date" value={props.kickoffDate ?? ""} onChange={(e) => update({ kickoffDate: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label="Rollout length (days)"><Input type="number" min={1} value={props.rolloutDays ?? 90} onChange={(e) => update({ rolloutDays: Math.max(1, Number(e.target.value) || 90) })} className="h-8 text-xs" /></Field>
        </div>
      </Group>

      <Group title="Cover" hint="The top of the hub.">
        <Field label="Headline"><Input value={props.headline?.trim() ? props.headline : roomHeadlineDefault(brandName)} onChange={(e) => update({ headline: e.target.value })} className="h-8 text-xs" /></Field>
        <p className="-mt-1.5 text-[11px] text-muted-foreground">{"{{account}}"} is replaced with the customer’s name.</p>
        <Field label="Small label above the headline"><Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} className="h-8 text-xs" placeholder="Leave blank for none" /></Field>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <ThumbButton value={props.heroImageUrl ?? ""} onChange={(url) => update({ heroImageUrl: url })} label="Cover photo" />
            <span className="text-xs font-medium">Cover photo</span>
          </div>
          <div className="flex items-center gap-2" data-room-feed-photo>
            <ThumbButton value={props.feedPhotoUrl ?? ""} onChange={(url) => update({ feedPhotoUrl: url })} label="News Feed photo" />
            <span className="text-xs font-medium">News Feed photo<span className="block text-[11px] font-normal text-muted-foreground">On the Overview</span></span>
          </div>
        </div>
        <Field label="Cover style"><Choice name="cover" value={coverStyle} options={COVER_STYLES} onChange={(id) => update({ coverStyle: id })} /></Field>
        {coverStyle === "fade" && <Toggle checked={!props.coverPhotoScrolls} onChange={(v) => update({ coverPhotoScrolls: !v })} title="Photo stays in place while the page scrolls" />}
        <div data-room-look-setting>
          <Field label="Look of the whole hub"><Choice name="look" value={roomLook(props.look)} options={ROOM_LOOKS} onChange={(id) => update({ look: id })} /></Field>
        </div>
      </Group>

      <Group title="Top-bar button" hint="A button in the hub’s top bar. Usually it books time with one of your team; it can also open a link, a form or a video." data-room-schedule-settings="">
        <Field label="What it does">
          <Select
            value={scheduleMode}
            onValueChange={(v) => {
              if (v === "off") update({ scheduleUrl: "", scheduleRep: "", scheduleAction: undefined });
              else if (v === "custom") update({ scheduleAction: props.scheduleAction ?? "url", scheduleUrl: props.scheduleUrl || "", scheduleRep: "" });
              else update({ scheduleAction: "url", scheduleUrl: bookable.find((m) => m.name === v)?.bookingUrl ?? "", scheduleRep: v });
            }}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="off" className="text-xs">No button</SelectItem>
              {bookable.map((m) => <SelectItem key={m.name} value={m.name} className="text-xs">Books with {m.name}{m.role ? ` · ${m.role}` : ""}</SelectItem>)}
              <SelectItem value="custom" className="text-xs">A link, a form, Chili Piper or a video…</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {bookable.length === 0 && scheduleMode === "off" && <p className="text-[11px] text-muted-foreground">Nobody on your team has a booking link yet. Add one under Team, or choose “A link, a form…” here.</p>}
        {scheduleMode !== "off" && (
          <Field label="Button text"><Input value={props.scheduleLabel ?? ""} onChange={(e) => update({ scheduleLabel: e.target.value })} className="h-8 text-xs" placeholder="Schedule" aria-label="Button text" /></Field>
        )}
        {/* The same choices every other button in LP Studio has: a link, a Chili Piper popup, a form (yours or a global one) or a video. */}
        {scheduleMode === "custom" && (
          <div className="rounded-md border p-2.5" data-room-schedule-cta>
            <CtaActionConfigSection
              value={{ ctaAction: props.scheduleAction ?? "url", ctaUrl: props.scheduleUrl, chilipiperUrl: props.scheduleChilipiperUrl, videoUrl: props.scheduleVideoUrl, ...pickCtaModalConfig(props) }}
              onChange={(v: CtaSuiteFields) => update({ scheduleAction: v.ctaAction as HeroCtaActionMode | undefined, scheduleUrl: (v.ctaUrl ?? "").trim(), scheduleChilipiperUrl: v.chilipiperUrl, scheduleVideoUrl: v.videoUrl, scheduleRep: "", ...pickCtaModalConfig(v) })}
            />
          </div>
        )}
      </Group>
    </>
  );
}

/**
 * One person: photo, name and role on a line, the rest (contact details, what
 * they own) behind "Details" so a team reads as a list of names. Someone just
 * added opens ready to fill in.
 */
function MemberRow({ member: m, onChange, onRemove }: { member: RoomTeamMember; onChange: (patch: Partial<RoomTeamMember>) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(!(m.name ?? "").trim());
  const filled = [m.email, m.phone, m.bookingUrl, m.owns, m.when].filter((v) => (v ?? "").trim()).length;
  return (
    <div className={`space-y-2 rounded-md border p-2 ${m.hidden ? "opacity-60" : ""}`} data-room-team-member>
      <div className="flex items-center gap-2">
        <ThumbButton value={m.photoUrl ?? ""} onChange={(url) => onChange({ photoUrl: url })} label="Photo" size="sm" />
        <Input value={m.name ?? ""} onChange={(e) => onChange({ name: e.target.value })} className="h-8 min-w-0 flex-1 text-xs font-medium" placeholder="Name" aria-label="Name" autoFocus={!(m.name ?? "").trim()} />
        <Input value={m.role ?? ""} onChange={(e) => onChange({ role: e.target.value })} className="h-8 min-w-0 flex-1 text-xs" placeholder="Role" aria-label="Role" />
        <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-[11px]" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Hide details" : filled ? "Details" : "Add details"}
        </Button>
      </div>
      {open && (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Email"><Input type="email" value={m.email ?? ""} onChange={(e) => onChange({ email: e.target.value })} className="h-8 text-xs" /></Field>
            <Field label="Phone"><Input value={m.phone ?? ""} onChange={(e) => onChange({ phone: e.target.value })} className="h-8 text-xs" /></Field>
            <Field label="Booking link"><Input value={m.bookingUrl ?? ""} onChange={(e) => onChange({ bookingUrl: e.target.value.trim() })} className="h-8 text-xs" placeholder="https://calendly.com/…" /></Field>
            <Field label="What they own"><Input value={m.owns ?? ""} onChange={(e) => onChange({ owns: e.target.value })} className="h-8 text-xs" placeholder="e.g. Training and onboarding" /></Field>
            <Field label="When to reach them"><Input value={m.when ?? ""} onChange={(e) => onChange({ when: e.target.value })} className="h-8 text-xs" placeholder="e.g. Questions about a case" /></Field>
          </div>
          <div className="flex items-center justify-between">
            <HideToggle hidden={m.hidden} onChange={(h) => onChange({ hidden: h })} />
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-destructive hover:text-destructive" onClick={onRemove}>Remove</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The customer's people, picked from the account's contacts: tick who belongs
 * on the hub's team and add them in one go, with their role and email filled
 * in. Anyone already on the list is left out.
 */
function AccountContactsPicker({ pageId, already, onAdd, onClose }: { pageId: number; already: RoomTeamMember[]; onAdd: (people: ImportedPerson[]) => number; onClose: () => void }) {
  const [state, setState] = useState<"loading" | "ready" | "none" | "error">("loading");
  const [contacts, setContacts] = useState<{ name: string; title: string; email: string }[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  useEffect(() => {
    let off = false;
    void (async () => {
      try {
        const r = await fetch(`/api/lp/partner-rooms/${pageId}/account-contacts`);
        const j = (await r.json().catch(() => ({}))) as { found?: boolean; contacts?: { name: string; title: string; email: string }[] };
        if (off) return;
        const have = new Set(already.flatMap((m) => [(m.email ?? "").trim().toLowerCase(), (m.name ?? "").trim().toLowerCase()]).filter(Boolean));
        const fresh = (j.contacts ?? []).filter((c) => c.name?.trim() && !have.has((c.email ?? "").trim().toLowerCase()) && !have.has(c.name.trim().toLowerCase()));
        setContacts(fresh);
        setState(!r.ok ? "error" : fresh.length ? "ready" : "none");
      } catch {
        if (!off) setState("error");
      }
    })();
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);
  const shown = contacts.filter((c) => !q.trim() || [c.name, c.title, c.email].some((v) => (v ?? "").toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="space-y-2 rounded-md border p-2.5" data-room-team-contacts-open>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">The account’s contacts</span>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-1" aria-label="Close" onClick={onClose}><X className="h-3 w-3" /></Button>
      </div>
      {state === "loading" && <p className="text-xs text-muted-foreground">Loading contacts…</p>}
      {state === "error" && <p className="text-xs text-destructive">Couldn’t load the account’s contacts. Add someone by hand instead.</p>}
      {state === "none" && <p className="text-xs text-muted-foreground">No contacts to add: either the account has none with a work email, or everyone is already on the team. Add someone by hand instead.</p>}
      {state === "ready" && (
        <>
          {contacts.length > 8 && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts" className="h-8 text-xs" aria-label="Search contacts" />}
          <ul className="max-h-56 divide-y overflow-auto rounded-md border">
            {shown.map((c) => (
              <li key={c.email || c.name}>
                <label className="flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5">
                  <input type="checkbox" className="h-4 w-4" checked={picked.has(c.email || c.name)} onChange={(e) => setPicked((prev) => { const next = new Set(prev); if (e.target.checked) next.add(c.email || c.name); else next.delete(c.email || c.name); return next; })} />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">{c.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{[c.title, c.email].filter(Boolean).join(" · ")}</span>
                  </span>
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="px-2.5 py-2 text-xs text-muted-foreground">No contacts match.</li>}
          </ul>
          <Button type="button" size="sm" variant="brand" className="h-8 text-xs" disabled={picked.size === 0} onClick={() => onAdd(contacts.filter((c) => picked.has(c.email || c.name)).map((c) => ({ name: c.name, role: c.title, email: c.email })))} data-room-team-contacts-add>
            {picked.size ? `Add ${picked.size} to the team` : "Tick who to add"}
          </Button>
        </>
      )}
    </div>
  );
}

/** The named people on both sides: our team first, then the customer's. */
export function RoomTeamFields({ props, update, pageId }: { props: RoomTeamProps; update: (patch: Partial<RoomTeamProps>) => void; pageId: number | null }) {
  const team = props.team ?? [];
  const [repsOpen, setRepsOpen] = useState(false);
  /** The group whose "from the account's contacts" list is open. */
  const [contactsFor, setContactsFor] = useState<number | null>(null);
  const setTeam = (i: number, patch: Partial<RoomTeamGroup>) => update({ team: team.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) });
  const setMember = (gi: number, mi: number, patch: Partial<RoomTeamMember>) => setTeam(gi, { members: team[gi].members.map((m, idx) => (idx === mi ? { ...m, ...patch } : m)) });
  return (
    <>
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
      {team.map((g, gi) => {
        const count = (g.members ?? []).length;
        const label = `${g.title || `Group ${gi + 1}`} · ${count} ${count === 1 ? "person" : "people"}${g.hidden ? " · hidden" : ""}`;
        const remove = () => {
          if (count > 0 && typeof window !== "undefined" && !window.confirm(`Remove "${g.title || "this group"}" and the ${count} ${count === 1 ? "person" : "people"} in it?`)) return;
          update({ team: team.filter((_, idx) => idx !== gi) });
        };
        return (
          <CollapseItem key={gi} startOpen={gi === 0 || count === 0} header={<ItemHeader label={label} index={gi} total={team.length} onMove={(dir) => update({ team: moveItem(team, gi, dir) })} onRemove={remove} />}>
            <div className="flex items-end gap-3">
              <div className="min-w-0 flex-1"><Field label="Group name"><Input value={g.title ?? ""} onChange={(e) => setTeam(gi, { title: e.target.value })} className="h-8 text-xs font-semibold" /></Field></div>
              <div className="pb-1.5"><HideToggle hidden={g.hidden} onChange={(h) => setTeam(gi, { hidden: h })} /></div>
            </div>
            {(g.members ?? []).map((m, mi) => (
              <MemberRow key={mi} member={m} onChange={(patch) => setMember(gi, mi, patch)} onRemove={() => setTeam(gi, { members: g.members.filter((_, idx) => idx !== mi) })} />
            ))}
            {count === 0 && <p className="text-[11px] text-muted-foreground">{gi === 0 ? "Nobody here yet. Add your team from the Sales Reps library." : "Nobody here yet. Add the customer’s people from the account’s contacts."}</p>}
            {/* Pull people in from where they already are; typing one in by hand is the fallback. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
              {gi === 0 ? (
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setRepsOpen(true)} data-room-team-library>
                  <Plus className="h-3.5 w-3.5" /> Add from the Sales Reps library
                </Button>
              ) : pageId !== null ? (
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setContactsFor(contactsFor === gi ? null : gi)} aria-expanded={contactsFor === gi} data-room-team-contacts>
                  <Plus className="h-3.5 w-3.5" /> Add from the account’s contacts
                </Button>
              ) : null}
              <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setTeam(gi, { members: [...(g.members ?? []), { name: "", role: "" }] })} data-room-team-add-person>
                {gi === 0 || pageId !== null ? "or add someone by hand" : "Add someone by hand"}
              </button>
            </div>
            {contactsFor === gi && pageId !== null && (
              <AccountContactsPicker
                pageId={pageId}
                already={g.members ?? []}
                onClose={() => setContactsFor(null)}
                onAdd={(people) => {
                  const r = mergeTeamMembers(g.members ?? [], people);
                  if (r.added) setTeam(gi, { members: (r.members as RoomTeamMember[]).filter((m) => !/^\[.*\]$/.test((m.name ?? "").trim())) });
                  setContactsFor(null);
                  return r.added;
                }}
              />
            )}
          </CollapseItem>
        );
      })}
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-[11px] text-muted-foreground" onClick={() => update({ team: [...team, { title: "New group", members: [] }] })}>
        <Plus className="h-3 w-3" /> Add another group
      </Button>
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
      <Field label="Line under the Team heading (optional)"><Input value={props.teamNote ?? ""} onChange={(e) => update({ teamNote: e.target.value })} className="h-8 text-xs" placeholder="e.g. Who to call for what" /></Field>
    </>
  );
}
