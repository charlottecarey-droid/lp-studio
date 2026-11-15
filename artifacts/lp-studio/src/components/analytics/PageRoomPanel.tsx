import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, DoorOpen, RotateCcw, UserCheck, UserX, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/**
 * Partner room — the team's side of a room page (a page whose plan has tasks
 * visitors can complete): who is allowed to act, what the customer has done,
 * and the files they uploaded. Uploaded files are downloadable ONLY here.
 * Reads GET /api/lp/partner-rooms/:pageId and renders nothing for a page
 * that is not a room.
 */
interface RoomDetail {
  isRoom: boolean;
  settings: { allowedDomains: string[]; slackChannelId: string | null; sfdcAccountId?: string | null; asanaProjectGid?: string | null };
  practices?: { total: number; byStage: Record<string, number>; regions: string[] };
  tasks: { key: string; title: string; action: "check" | "upload"; done: boolean; completedBy: string | null; completedAt: string | null }[];
  members: { id: number; email: string; status: "allowed" | "requested" | "denied"; updatedAt: string }[];
  isWorkspace?: boolean;
  choices?: { key: string; title: string; options: string[]; value: string | null; chosenBy: string | null; chosenAt: string | null }[];
  contacts?: { id: number; name: string; role: string | null; email: string | null; addedBy: string; createdAt: string }[];
  wins?: { id: number; body: string; headline: string | null; side: string; by: string; createdAt: string; likes: number; comments: { id: number; body: string; by: string }[] }[];
  requests: { id: number; kind: string; subject: string; details: string | null; status: string; owner: string | null; due: string | null; requestedBy: string; createdAt: string; asanaTaskGid?: string | null }[];
  uploads: { id: number; taskKey: string; taskTitle: string; fileName: string; sizeBytes: number; uploadedBy: string; uploadedByEmail: string; createdAt: string }[];
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`);

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (r.ok) return null;
  try {
    const j = (await r.json()) as { error?: string };
    return j.error ?? "Something went wrong";
  } catch {
    return "Something went wrong";
  }
}

export function PageRoomPanel({ pageId }: { pageId: number }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["page-room", pageId],
    queryFn: async () => {
      const r = await fetch(`/api/lp/partner-rooms/${pageId}`);
      if (!r.ok) return null;
      return (await r.json()) as RoomDetail;
    },
  });
  const [domains, setDomains] = useState("");
  const [channel, setChannel] = useState("");
  const [sfdcId, setSfdcId] = useState("");
  const [asanaProject, setAsanaProject] = useState("");
  const [csv, setCsv] = useState("");
  const [note, setNote] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDomains(data.settings.allowedDomains.join(", "));
    setChannel(data.settings.slackChannelId ?? "");
    setSfdcId(data.settings.sfdcAccountId ?? "");
    setAsanaProject(data.settings.asanaProjectGid ?? "");
  }, [data]);

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!data || !data.isRoom) return null;

  const base = `/api/lp/partner-rooms/${pageId}`;
  const refresh = () => qc.invalidateQueries({ queryKey: ["page-room", pageId] });
  const run = async (p: Promise<string | null>) => {
    setSaved(false);
    const err = await p;
    setError(err ?? "");
    if (!err) await refresh();
    return !err;
  };

  const saveSettings = async () => {
    const list = domains.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean);
    if (await run(send(`${base}/settings`, "PATCH", { allowedDomains: list, slackChannelId: channel.trim(), sfdcAccountId: sfdcId.trim(), asanaProjectGid: asanaProject.trim() }))) setSaved(true);
  };
  const setMember = (email: string, status: "allowed" | "denied" | null) => run(send(`${base}/members`, "POST", { email, status }));

  const requests = data.members.filter((m) => m.status === "requested");
  const others = data.members.filter((m) => m.status !== "requested");
  const noAccessYet = data.settings.allowedDomains.length === 0 && !data.members.some((m) => m.status === "allowed");

  return (
    <Card data-testid="page-room-panel">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base flex items-center gap-2">
          <DoorOpen className="w-4 h-4 text-muted-foreground" />
          Room
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Who can upload files and mark tasks done on this page, and what they have sent. Anyone with the link can view the page.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {requests.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Waiting for approval</h4>
            {requests.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span className="text-sm">{m.email} <span className="text-muted-foreground">· asked {fmtDate(m.updatedAt)}</span></span>
                <span className="flex gap-2">
                  <Button size="sm" variant="brand" className="h-8 gap-1" onClick={() => setMember(m.email, "allowed")}><UserCheck className="h-3.5 w-3.5" /> Allow</Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setMember(m.email, "denied")}><UserX className="h-3.5 w-3.5" /> Decline</Button>
                </span>
              </div>
            ))}
          </section>
        )}

        {(data.requests ?? []).length > 0 && (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Requests</h4>
            <div className="divide-y rounded-md border">
              {data.requests.map((q) => (
                <RequestRow key={q.id} q={q} onSave={(patch) => run(send(`${base}/requests/${q.id}`, "PATCH", patch))} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">The customer sees the status, owner and due date in the room’s Requests module.</p>
          </section>
        )}

        {(data.choices ?? []).length > 0 && (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Marketing plan decisions</h4>
            <div className="divide-y rounded-md border">
              {data.choices!.map((c) => (
                <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="text-sm">{c.title}</span>
                  {c.value ? (
                    <span className="text-sm"><Badge variant="secondary">{c.value}</Badge> <span className="text-xs text-muted-foreground">{c.chosenBy} · {fmtDate(c.chosenAt)}</span></span>
                  ) : (
                    <Badge variant="outline">No decision yet</Badge>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.isWorkspace && (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Practices</h4>
            <p className="text-sm text-muted-foreground">
              {data.practices?.total
                ? `${data.practices.total} in the room · ${data.practices.byStage.live ?? 0} live · ${(data.practices.byStage.trained ?? 0) + (data.practices.byStage.live ?? 0)} trained · ${data.practices.regions.length} regions`
                : "No practices loaded yet."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  setNote("");
                  const r = await fetch(`${base}/practices/sync-salesforce`, { method: "POST", headers: { "Content-Type": "application/json" } });
                  const j = (await r.json().catch(() => ({}))) as { error?: string; added?: number; updated?: number; note?: string };
                  setError(r.ok ? "" : j.error ?? "Sync failed");
                  if (r.ok) {
                    setNote(j.note ?? `${j.added ?? 0} added, ${j.updated ?? 0} updated from Salesforce.`);
                    await refresh();
                  }
                }}
              >
                Pull practices from Salesforce
              </Button>
              {!!data.practices?.total && (
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => window.confirm("Remove every practice from this room?") && run(send(`${base}/practices`, "DELETE"))}>Clear list</Button>
              )}
              {note && <span className="text-sm text-muted-foreground">{note}</span>}
            </div>
            <textarea
              className="min-h-[88px] w-full rounded-md border bg-background p-2 font-mono text-xs"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={"Or paste a list (first line = column names):\nname,region,wave,stage,training date,live date\nMain Street Dental,North Texas,1,live,Nov 4,Nov 12"}
              aria-label="Paste a practice list"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="brand"
                disabled={!csv.trim()}
                onClick={async () => {
                  setNote("");
                  const r = await fetch(`${base}/practices/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv }) });
                  const j = (await r.json().catch(() => ({}))) as { error?: string; added?: number; updated?: number };
                  setError(r.ok ? "" : j.error ?? "Import failed");
                  if (r.ok) {
                    setNote(`${j.added ?? 0} added, ${j.updated ?? 0} updated.`);
                    setCsv("");
                    await refresh();
                  }
                }}
              >
                Import list
              </Button>
              <span className="text-xs text-muted-foreground">Stages: not started, scheduling, training booked, trained, live. Pasting again updates practices by name.</span>
            </div>
          </section>
        )}

        {data.isWorkspace && <WinsSection base={base} wins={data.wins ?? []} run={run} />}

        {(data.contacts ?? []).length > 0 && (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Contacts the customer added</h4>
            <div className="divide-y rounded-md border">
              {data.contacts!.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-sm">{c.name}{c.role ? ` · ${c.role}` : ""}{c.email ? ` · ${c.email}` : ""} <span className="text-xs text-muted-foreground">added by {c.addedBy}</span></span>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Remove ${c.name}`} onClick={() => run(send(`${base}/contacts/${c.id}`, "DELETE"))}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Files received</h4>
          {data.uploads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
          ) : (
            <div className="divide-y rounded-md border">
              {data.uploads.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{u.fileName}</p>
                    <p className="text-xs text-muted-foreground">{u.taskTitle} · {u.uploadedBy} · {fmtDate(u.createdAt)} · {fmtSize(u.sizeBytes)}</p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="h-8 gap-1">
                    <a href={`/api/lp/partner-rooms/uploads/${u.id}/download`}><Download className="h-3.5 w-3.5" /> Download</a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Customer tasks</h4>
          <div className="divide-y rounded-md border">
            {data.tasks.map((t) => (
              <div key={t.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.action === "upload" ? "Upload a file" : "Mark done"}
                    {t.done ? ` · ${t.completedBy} · ${fmtDate(t.completedAt)}` : ""}
                  </p>
                </div>
                {t.done ? (
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" /> Done</Badge>
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" onClick={() => run(send(`${base}/tasks/${encodeURIComponent(t.key)}`, "DELETE"))}><RotateCcw className="h-3.5 w-3.5" /> Reopen</Button>
                  </span>
                ) : (
                  <Badge variant="outline">Open</Badge>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold">Who can act</h4>
          {noAccessYet && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No one is allowed yet. Add the customer's email domain, or people one by one. Personal links from the Sales console always work.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Allowed email domains</span>
              <Input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="customer.com, customer-group.com" />
              <span className="block text-xs text-muted-foreground">Anyone with an address at these domains gets a link by email without approval.</span>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Slack channel ID</span>
              <Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="C0123ABCDEF" />
              <span className="block text-xs text-muted-foreground">Uploads, completed tasks and access requests post here. Blank uses your default channel.</span>
            </label>
            {data.isWorkspace && (
              <>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Salesforce account ID</span>
                  <Input value={sfdcId} onChange={(e) => setSfdcId(e.target.value)} placeholder="0015d000041HyXrAAK" />
                  <span className="block text-xs text-muted-foreground">The customer’s parent account. Its child accounts become the practice list.</span>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Asana project ID</span>
                  <Input value={asanaProject} onChange={(e) => setAsanaProject(e.target.value)} placeholder="Blank uses your connected Asana project" />
                  <span className="block text-xs text-muted-foreground">Marketing requests are filed here as “Expansion Support - customer - request”, with Intake status set to Submitted.</span>
                </label>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="brand" onClick={saveSettings}>Save</Button>
            {saved && <span className="text-sm text-muted-foreground">Saved</span>}
          </div>

          <div className="space-y-2 pt-2">
            <span className="text-sm font-medium">People</span>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (newEmail.trim() && (await setMember(newEmail.trim(), "allowed"))) setNewEmail("");
              }}
            >
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="person@anywhere.com" className="max-w-xs" />
              <Button type="submit" size="sm" variant="outline">Allow this person</Button>
            </form>
            {others.length > 0 && (
              <div className="divide-y rounded-md border">
                {others.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm">{m.email}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant={m.status === "allowed" ? "secondary" : "outline"}>{m.status === "allowed" ? "Allowed" : "Declined"}</Badge>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label={`Remove ${m.email}`} onClick={() => setMember(m.email, null)}><X className="h-4 w-4" /></Button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

const REQUEST_STATUS: [string, string][] = [["new", "Received"], ["in_progress", "In progress"], ["review", "Ready for their review"], ["done", "Done"]];
const REQUEST_KIND: Record<string, string> = { asset_change: "Asset change", marketing: "Marketing", training: "Training", event: "Event", reporting: "Reporting", other: "Other" };

function RequestRow({ q, onSave }: { q: RoomDetail["requests"][number]; onSave: (patch: { status?: string; owner?: string; due?: string }) => void }) {
  const [owner, setOwner] = useState(q.owner ?? "");
  const [due, setDue] = useState(q.due ?? "");
  return (
    <div className="space-y-2 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{q.subject}</p>
          <p className="text-xs text-muted-foreground">
            {REQUEST_KIND[q.kind] ?? "Other"} · {q.requestedBy} · {fmtDate(q.createdAt)}
            {q.asanaTaskGid && (
              <>
                {" · "}
                <a className="underline" href={`https://app.asana.com/0/0/${q.asanaTaskGid}`} target="_blank" rel="noreferrer">In Asana</a>
              </>
            )}
          </p>
          {q.details && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{q.details}</p>}
        </div>
        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={q.status}
          onChange={(e) => onSave({ status: e.target.value })}
          aria-label={`Status of ${q.subject}`}
        >
          {REQUEST_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input value={owner} onChange={(e) => setOwner(e.target.value)} onBlur={() => owner !== (q.owner ?? "") && onSave({ owner })} placeholder="Owner (name or team)" className="h-8 max-w-[220px] text-sm" />
        <Input value={due} onChange={(e) => setDue(e.target.value)} onBlur={() => due !== (q.due ?? "") && onSave({ due })} placeholder="Due (Nov 21)" className="h-8 max-w-[140px] text-sm" />
      </div>
    </div>
  );
}

function WinsSection({ base, wins, run }: { base: string; wins: NonNullable<RoomDetail["wins"]>; run: (p: Promise<string | null>) => Promise<boolean> }) {
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">Wins</h4>
      <form
        className="space-y-2 rounded-md border p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (body.trim() && (await run(send(`${base}/wins`, "POST", { headline: headline.trim(), body: body.trim() })))) {
            setHeadline("");
            setBody("");
          }
        }}
      >
        <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline, optional (1,000 cases submitted)" className="h-8 text-sm" />
        <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share a win with the customer" className="h-8 text-sm" />
        <Button type="submit" size="sm" variant="brand" disabled={!body.trim()}>Post to the room</Button>
      </form>
      {wins.length > 0 && (
        <div className="divide-y rounded-md border">
          {wins.map((w) => (
            <div key={w.id} className="flex items-start justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm">{w.headline ? <strong>{w.headline}. </strong> : null}{w.body}</p>
                <p className="text-xs text-muted-foreground">{w.by} · {fmtDate(w.createdAt)} · {w.likes} likes · {w.comments.length} comments</p>
              </div>
              <Button size="sm" variant="ghost" className="h-8 w-8 shrink-0 p-0 text-muted-foreground" aria-label="Remove this win" onClick={() => run(send(`${base}/wins/${w.id}`, "DELETE"))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
