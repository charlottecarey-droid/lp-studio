import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CalendarDays, MapPin, Plus, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

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
