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
import { parseTeamList } from "@/lib/room-team-import";

export interface RoomAccountContact {
  name: string;
  title: string;
  email: string;
  level: string;
  invited: boolean;
}

const INVITE_MAX = 25;

export function RoomInviteSection({ pageId, onInvited }: { pageId: number; onInvited?: () => void }) {
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
    <div className="space-y-3 rounded-md border p-3" data-room-invite>
      <div>
        <span className="text-sm font-medium">Invite the customer's team</span>
        <p className="text-xs text-muted-foreground">Each person gets an email with their own link, and can upload, comment and mark tasks done as themselves. The room must be published.</p>
      </div>
      {contacts === null ? (
        <p className="text-sm text-muted-foreground">Loading the account's contacts…</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{found ? "This account has no contacts with a work email yet." : "No matching account was found under Accounts, so there are no contacts to pick from. Add addresses below, or save the Salesforce account ID above."}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Search ${contacts.length} contacts`} className="h-8 max-w-xs text-sm" />
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setPicked(new Set(shown.filter((c) => !c.invited).slice(0, INVITE_MAX).map((c) => c.email)))}>Select the first {Math.min(INVITE_MAX, shown.filter((c) => !c.invited).length)}</Button>
            {picked.size > 0 && <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setPicked(new Set())}>Clear</Button>}
          </div>
          <div className="max-h-64 divide-y overflow-auto rounded-md border">
            {shown.map((c) => (
              <label key={c.email} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                <input type="checkbox" checked={picked.has(c.email)} onChange={() => toggle(c.email)} data-room-invite-pick={c.email} />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{c.name}</span>
                  {c.title && <span className="text-muted-foreground"> · {c.title}</span>}
                  <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                </span>
                {c.invited && <Badge variant="secondary">Invited</Badge>}
              </label>
            ))}
            {shown.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Nobody matches that search.</p>}
          </div>
        </>
      )}
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Anyone else</span>
        <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} placeholder={"Dana Ruiz, dana@customer.com\nkai@customer.com"} className="text-sm" />
        <span className="block text-xs text-muted-foreground">One person per line: a name and an address, or just the address.</span>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">A note to include (optional)</span>
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
