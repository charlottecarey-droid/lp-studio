import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CalendarDays, MapPin, MoreVertical, Plus, Trash2, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SalesLayout } from "@/components/layout/sales-layout";
import { SalesPageHeader } from "@/components/sales/sales-page-header";
import { toast } from "@/hooks/use-toast";

const API_BASE = "/api";

/* ----------------------------------------------------------------------------
 * Sales Console → Events. The agenda builder's home: one row per conference/
 * summit. Each event holds a session catalog (entered once) that per-account
 * agendas are assembled from on the event detail page.
 * -------------------------------------------------------------------------- */

interface SalesEvent {
  id: number;
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  session_count: number;
  agenda_count: number;
}

/**
 * Confirm deleting an event.
 *
 * The delete cascades to the whole session catalog and every agenda built from
 * it, with no undo, so the dialog states the actual counts rather than a
 * generic "are you sure". Two levels, proportionate to what's lost:
 *
 *   • Nothing published — plain confirm with the counts.
 *   • Published agendas exist — the server refuses the first request (409) and
 *     returns them; we then require the event NAME to be typed. Those pages
 *     stay live at their URLs, but the agenda behind each one is gone, so
 *     nobody can edit or republish them afterwards. That's worth a deliberate
 *     act, not one more click.
 */
function DeleteEventDialog({ event, onClose, onDeleted }: {
  event: SalesEvent | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<number | null>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    // Reset when a different event is targeted, so a previous escalation
    // can't carry over and pre-authorize this one.
    setPublished(null);
    setTyped("");
  }, [event?.id]);

  if (!event) return null;

  const needsName = published !== null && published > 0;
  const nameMatches = typed.trim().toLowerCase() === event.name.trim().toLowerCase();

  const remove = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/sales/events/${event.id}${needsName ? "?force=true" : ""}`, {
        method: "DELETE",
      });
      if (res.status === 409) {
        // Published agendas — escalate rather than delete.
        const data = await res.json().catch(() => ({}));
        setPublished(Number(data?.impact?.published ?? 1));
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: `Deleted "${event.name}"` });
      onDeleted();
      onClose();
    } catch {
      toast({ title: "Couldn't delete the event", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{event.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            This also deletes {event.session_count} session{event.session_count === 1 ? "" : "s"}
            {" and "}{event.agenda_count} account agenda{event.agenda_count === 1 ? "" : "s"}. It can&rsquo;t be undone.
          </DialogDescription>
        </DialogHeader>

        {needsName && (
          <div className="space-y-2.5">
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">
                {published} of these agendas {published === 1 ? "is" : "are"} published.
              </p>
              <p className="mt-1 text-[13px] leading-relaxed">
                Those pages stay live at their URLs, so anyone you&rsquo;ve already sent
                them can still open them. But the agenda behind each one is deleted —
                you won&rsquo;t be able to edit or republish them.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Type the event name to confirm</Label>
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={event.name}
                autoFocus
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => void remove()}
            disabled={busy || (needsName && !nameMatches)}
          >
            {busy ? "Deleting…" : needsName ? "Delete anyway" : "Delete event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatRange(start: string | null, end: string | null): string {
  if (!start) return "Dates TBD";
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function SalesEvents() {
  const [, navigate] = useLocation();
  const [events, setEvents] = useState<SalesEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<SalesEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", startDate: "", endDate: "", description: "" });

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/sales/events`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch {
      toast({ title: "Couldn't load events", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createEvent = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/sales/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          location: form.location || undefined,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          description: form.description || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCreateOpen(false);
      navigate(`/sales/events/${data.event.id}`);
    } catch {
      toast({ title: "Couldn't create the event", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <SalesLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <SalesPageHeader
          title="Events"
          description="Enter a conference's session catalog once, then generate a personalized agenda page for every strategic account — no more per-account decks."
          actions={
            <Button variant="brand" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> New event
            </Button>
          }
        />

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : events.length === 0 ? (
          <Card className="p-10 text-center">
            <CalendarDays className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="mt-3 font-medium">Set up your first event</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create the event, import its sessions from a CSV (or add them by hand), then build per-account agendas.
            </p>
            <Button variant="brand" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> New event
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <Card
                key={event.id}
                className="p-5 cursor-pointer hover:border-foreground/25 transition-colors"
                onClick={() => navigate(`/sales/events/${event.id}`)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <p className="font-semibold truncate">{event.name}</p>
                      {event.status !== "active" && (
                        <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {event.status}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" /> {formatRange(event.start_date, event.end_date)}
                      </span>
                      {event.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" /> {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-sm text-muted-foreground shrink-0">
                    <span>{event.session_count} session{event.session_count === 1 ? "" : "s"}</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> {event.agenda_count} agenda{event.agenda_count === 1 ? "" : "s"}
                    </span>
                    {/* The whole card navigates, so the menu must stop the click
                        from bubbling — otherwise opening it opens the event. */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${event.name}`}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleting(event); }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete event
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <DeleteEventDialog
        event={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => void load()}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Event name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Summit 2026" />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Austin, TX" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="brand" disabled={!form.name.trim() || creating} onClick={() => void createEvent()}>
              {creating ? "Creating…" : "Create event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SalesLayout>
  );
}
