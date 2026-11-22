/**
 * Invite the customer's people to a partner room: the account's contacts
 * (from the workspace's Accounts) with a tick box each, plus any other
 * addresses. Each person gets an email with a personal link that opens the
 * room as them.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Eye, Gift } from "lucide-react";
import { parseTeamList } from "@/lib/room-team-import";

export interface RoomAccountContact {
  name: string;
  title: string;
  email: string;
  level: string;
  invited: boolean;
}

const INVITE_MAX = 25;

/** The hub's welcome gift settings, as the team sees them. */
export interface HubGifts {
  /** The hub has a gift step to offer. */
  hasStep: boolean;
  enabled: boolean;
  /** Lower-case emails the gift is turned off for. */
  off: string[];
  /** Lower-case emails of people who have accepted theirs. */
  accepted: string[];
}

/**
 * One person's welcome gift, on their row: a tick box (on = they are offered
 * one), or "Gift accepted" once they have sent where to ship it. Greyed out
 * while gifts are off for the whole hub.
 */
export function GiftToggle({ email, gifts, onChange }: { email: string; gifts: HubGifts; onChange: (email: string, on: boolean) => void }) {
  const e = email.trim().toLowerCase();
  if (gifts.accepted.includes(e)) return <Badge variant="secondary" className="gap-1 whitespace-nowrap" data-room-gift-accepted={e}><Gift className="h-3 w-3" /> Gift accepted</Badge>;
  const on = gifts.enabled && !gifts.off.includes(e);
  return (
    <label className={`flex shrink-0 items-center gap-1.5 text-xs ${gifts.enabled ? "cursor-pointer text-foreground" : "cursor-not-allowed text-muted-foreground"}`} title={gifts.enabled ? (on ? "They are offered a welcome gift in the hub" : "No welcome gift for this person") : "Welcome gifts are off for this hub"}>
      <input type="checkbox" checked={on} disabled={!gifts.enabled} onChange={(ev) => onChange(e, ev.target.checked)} aria-label={`Welcome gift for ${email}`} data-room-gift-toggle={e} />
      <Gift className="h-3.5 w-3.5" aria-hidden /> Gift
    </label>
  );
}

/** "View as": open the hub as this person sees it (read only). */
export function ViewAsButton({ email, name, onViewAs }: { email: string; name?: string | null; onViewAs: (email: string) => void }) {
  return (
    <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => onViewAs(email)} title={`Open the hub as ${name || email} sees it. Read only.`} aria-label={`View the hub as ${name || email}`} data-room-view-as-open={email.toLowerCase()}>
      <Eye className="h-3.5 w-3.5" /> View as
    </Button>
  );
}

export function RoomInviteSection({ pageId, onInvited, hideIntro = false, gifts, onGift, onViewAs }: { pageId: number; onInvited?: () => void; /** The card around it already says how invites work. */ hideIntro?: boolean; /** Welcome gifts: each contact row gets its own switch. */ gifts?: HubGifts | null; onGift?: (email: string, on: boolean) => void; /** Each contact row can open the hub as that person. */ onViewAs?: (email: string) => void }) {
  const [contacts, setContacts] = useState<RoomAccountContact[] | null>(null);
  const [found, setFound] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [extra, setExtra] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    fetch(`/api/lp/partner-rooms/${pageId}/account-contacts`)
      .then((r) => (r.ok ? r.json() : { found: false, contacts: [] }))
      .then((j: { found?: boolean; contacts?: RoomAccountContact[] }) => {
        setFound(!!j.found);
        setContacts(j.contacts ?? []);
      })
      .catch(() => setContacts([]));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (contacts ?? []).filter((c) => !q || `${c.name} ${c.title} ${c.email}`.toLowerCase().includes(q));
  }, [contacts, filter]);
  const typed = useMemo(() => parseTeamList(extra).people.filter((p) => p.email), [extra]);
  const total = picked.size + typed.filter((p) => !picked.has(p.email!)).length;

  const toggle = (email: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });

  const send = async () => {
    const people = [...(contacts ?? []).filter((c) => picked.has(c.email)).map((c) => ({ email: c.email, name: c.name })), ...typed.map((p) => ({ email: p.email!, name: p.name.includes("@") ? "" : p.name }))];
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/lp/partner-rooms/${pageId}/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ people, note }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; sent?: string[]; failed?: string[] };
      if (!r.ok) setMessage({ ok: false, text: j.error ?? "Could not send the invitations" });
      else {
        const sent = j.sent?.length ?? 0;
        const failed = j.failed ?? [];
        setMessage({ ok: failed.length === 0, text: `${sent} invitation${sent === 1 ? "" : "s"} sent.${failed.length ? ` Couldn't email: ${failed.join(", ")}.` : ""}` });
        setPicked(new Set());
        setExtra("");
        await load();
        onInvited?.();
      }
    } catch {
      setMessage({ ok: false, text: "Could not send the invitations" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3" data-room-invite>
      {!hideIntro && <p className="text-xs text-muted-foreground">Each person gets an email with their own link. The hub must be published first.</p>}
      {contacts === null ? (
        <p className="text-sm text-muted-foreground">Loading the account's contacts…</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{found ? "This account has no contacts with a work email yet." : "No matching account found, so there are no contacts to pick from. Add addresses below, or set the Salesforce account ID under Slack and connections."}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Search ${contacts.length} contacts`} className="h-8 max-w-xs text-sm" />
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setPicked(new Set(shown.filter((c) => !c.invited).slice(0, INVITE_MAX).map((c) => c.email)))}>Select the first {Math.min(INVITE_MAX, shown.filter((c) => !c.invited).length)}</Button>
            {picked.size > 0 && <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setPicked(new Set())}>Clear</Button>}
          </div>
          <div className="max-h-64 divide-y overflow-auto rounded-md border">
            {shown.map((c) => (
              <div key={c.email} className="flex items-center gap-3 px-3 py-2 text-sm">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={picked.has(c.email)} onChange={() => toggle(c.email)} data-room-invite-pick={c.email} aria-label={`Invite ${c.name}`} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{c.name}</span>
                    {c.title && <span className="text-muted-foreground"> · {c.title}</span>}
                    <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                  </span>
                  {c.invited && <Badge variant="secondary">Invited</Badge>}
                </label>
                {gifts?.hasStep && onGift && <GiftToggle email={c.email} gifts={gifts} onChange={onGift} />}
                {onViewAs && <ViewAsButton email={c.email} name={c.name} onViewAs={onViewAs} />}
              </div>
            ))}
            {shown.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Nobody matches that search.</p>}
          </div>
        </>
      )}
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Add people by email</span>
        <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} placeholder={"Dana Ruiz, dana@customer.com\nkai@customer.com"} className="text-sm" />
        <span className="block text-xs text-muted-foreground">One per line.</span>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Note in the email (optional)</span>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={600} className="text-sm" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="brand" disabled={busy || total === 0 || total > INVITE_MAX} onClick={send} data-room-invite-send>
          {busy ? "Sending…" : `Invite ${total || ""} ${total === 1 ? "person" : "people"}`.replace(/\s+/g, " ")}
        </Button>
        {total > INVITE_MAX && <span className="text-sm text-destructive">Up to {INVITE_MAX} at a time.</span>}
        {message && <span role="status" className={`text-sm ${message.ok ? "text-muted-foreground" : "text-destructive"}`}>{message.text}</span>}
      </div>
    </div>
  );
}
