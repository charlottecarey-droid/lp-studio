import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, DoorOpen, RotateCcw, UserCheck, UserX, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PdfUploadButton } from "@/components/PdfUploadButton";

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
  digest?: { enabled: boolean; recipients: string[]; lastSentAt: string | null };
  sheet?: { id: string | null; tab: string | null; syncedAt: string | null; note: string | null; filterColumn?: string | null; filterValue?: string | null };
  revopsSlackMention?: string | null;
  calendar?: { id: string | null; syncedAt: string | null; note: string | null; connection?: { googleEmail: string; status: string; mine: boolean } | null };
  events?: RoomEventRow[];
  kit?: { partnerName: string; partnerLogoUrl: string; heroImageUrl: string; signupUrl: string; assets: { key: string; title: string; kind: string; hasFile: boolean; hidden: boolean }[]; texts?: { title: string; description: string; body: string }[]; links?: { title: string; url: string }[] } | null;
  engagement?: {
    assets: { key: string; title: string; kind: string; views: number; downloads: number; seconds: number; maxProgress: number; people: string[]; anonymous: number; lastAt: string }[];
    recent: { title: string; action: string; value: number | null; who: string | null; at: string }[];
  };
  tasks: { key: string; title: string; action: "check" | "upload"; done: boolean; completedBy: string | null; completedAt: string | null }[];
  members: { id: number; email: string; status: "allowed" | "requested" | "denied"; updatedAt: string }[];
  isWorkspace?: boolean;
  choices?: { key: string; title: string; options: string[]; value: string | null; chosenBy: string | null; chosenAt: string | null }[];
  contacts?: { id: number; name: string; role: string | null; email: string | null; addedBy: string; createdAt: string }[];
  wins?: { id: number; body: string; headline: string | null; side: string; by: string; createdAt: string; likes: number; comments: { id: number; body: string; by: string }[] }[];
  requests: { id: number; kind: string; subject: string; details: string | null; status: string; owner: string | null; due: string | null; requestedBy: string; createdAt: string; asanaTaskGid?: string | null }[];
  uploads: { id: number; taskKey: string; taskTitle: string; fileName: string; sizeBytes: number; uploadedBy: string; uploadedByEmail: string; createdAt: string }[];
}

interface RoomMinutesDraft {
  summary: string;
  decisions: string[];
  actions: { text: string; owner?: string; due?: string; done?: boolean }[];
}
interface RoomEventRow {
  id: number;
  title: string;
  startsAt: string;
  allDay: boolean;
  hidden: boolean;
  attendees: string | null;
  hasNotes: boolean;
  minutesStatus: "draft" | "published" | "dismissed" | null;
  minutes: RoomMinutesDraft | null;
}

/** "Send the roster | Levi | Feb 2" per line ↔ action items. A leading "x " marks one done. */
const actionsToText = (a: RoomMinutesDraft["actions"]) => a.map((x) => `${x.done ? "x " : ""}${[x.text, x.owner ?? "", x.due ?? ""].join(" | ").replace(/( \| )+$/, "")}`).join("\n");
const textToActions = (t: string): RoomMinutesDraft["actions"] =>
  t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const done = /^x\s+/i.test(l);
    const [text, owner, due] = l.replace(/^x\s+/i, "").split("|").map((p) => p.trim());
    return { text: text ?? "", ...(owner ? { owner } : {}), ...(due ? { due } : {}), ...(done ? { done: true } : {}) };
  });

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
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetTab, setSheetTab] = useState("");
  const [filterCol, setFilterCol] = useState("");
  const [filterVal, setFilterVal] = useState("");
  const [revopsMention, setRevopsMention] = useState("");
  const [digestOn, setDigestOn] = useState(false);
  const [digestTo, setDigestTo] = useState("");
  const [preview, setPreview] = useState<{ subject: string; html: string; recipients: string[]; slackText: string; empty: boolean } | null>(null);
  const [digestNote, setDigestNote] = useState("");
  const [compare, setCompare] = useState<{ uploadId: number; fileName: string; practices: { uploaded: number; inRoom: number; matched: number; missingFromRoom: string[]; notOnUpload: string[]; sheet: string } | null; doctors: { count: number; sheet: string } | null } | null>(null);
  const [revops, setRevops] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDomains(data.settings.allowedDomains.join(", "));
    setChannel(data.settings.slackChannelId ?? "");
    setSfdcId(data.settings.sfdcAccountId ?? "");
    setAsanaProject(data.settings.asanaProjectGid ?? "");
    setSheetUrl(data.sheet?.id ? `https://docs.google.com/spreadsheets/d/${data.sheet.id}` : "");
    setSheetTab(data.sheet?.tab ?? "");
    setFilterCol(data.sheet?.filterColumn ?? "");
    setFilterVal(data.sheet?.filterValue ?? "");
    setRevopsMention(data.revopsSlackMention ?? "");
    setDigestOn(!!data.digest?.enabled);
    setDigestTo((data.digest?.recipients ?? []).join(", "));
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
    if (await run(send(`${base}/settings`, "PATCH", { allowedDomains: list, slackChannelId: channel.trim(), sfdcAccountId: sfdcId.trim(), asanaProjectGid: asanaProject.trim(), revopsSlackMention: revopsMention.trim() }))) setSaved(true);
  };
  const baseSettings = () => ({ allowedDomains: domains.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean), slackChannelId: channel.trim(), sfdcAccountId: sfdcId.trim(), asanaProjectGid: asanaProject.trim() });
  const post = async (url: string, body?: unknown): Promise<{ ok: boolean; json: Record<string, unknown> }> => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    setError(r.ok ? "" : String(json.error ?? "Something went wrong"));
    return { ok: r.ok, json };
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
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Live Google Sheet</p>
              <p className="text-xs text-muted-foreground">
                The room re-reads this sheet about every hour and matches it exactly: rows removed from the sheet leave the room. First row = column names: name, region, wave, stage, training date, live date. Share the sheet with the Google account connected to LP Studio.
              </p>
              <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                <Input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
                <Input value={sheetTab} onChange={(e) => setSheetTab(e.target.value)} placeholder="Tab name (blank = first)" />
              </div>
              <p className="text-xs text-muted-foreground">
                A sheet that lists every customer’s locations needs narrowing to this one. If it has a “Parent Account ID” column, the room keeps the rows that match the Salesforce account ID saved below, and you can leave these blank. Otherwise name a column and the text its rows must contain.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={filterCol} onChange={(e) => setFilterCol(e.target.value)} placeholder="Only rows where this column… (Parent Account Name)" aria-label="Filter column" />
                <Input value={filterVal} onChange={(e) => setFilterVal(e.target.value)} placeholder="…contains this (Acme Group)" aria-label="Filter value" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="brand"
                  onClick={async () => {
                    setNote("");
                    const err = await send(`${base}/settings`, "PATCH", { ...baseSettings(), practicesSheet: sheetUrl.trim(), practicesSheetTab: sheetTab.trim(), practicesSheetFilterColumn: filterCol.trim(), practicesSheetFilterValue: filterVal.trim() });
                    setError(err ?? "");
                    if (err) return;
                    if (sheetUrl.trim()) {
                      const r = await post(`${base}/practices/sync-sheet`);
                      if (r.ok) setNote(String(r.json.note ?? "Sheet read."));
                    } else setNote("Sheet disconnected. The practices already loaded stay.");
                    await refresh();
                  }}
                >
                  {sheetUrl.trim() ? "Save and read the sheet" : "Disconnect"}
                </Button>
                {data.sheet?.id && (
                  <span className="text-xs text-muted-foreground">
                    Last read {fmtDate(data.sheet.syncedAt) || "never"}{data.sheet.note ? ` · ${data.sheet.note}` : ""}
                  </span>
                )}
              </div>
            </div>
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

        {data.isWorkspace && data.kit && <LaunchAssetsSection pageId={pageId} kit={data.kit} refresh={refresh} />}

        {data.isWorkspace && <EngagementSection engagement={data.engagement} />}

        {data.isWorkspace && <AutomaticRoomsSection />}

        {data.isWorkspace && <CalendarSection base={base} calendar={data.calendar} events={data.events ?? []} hasDomain={data.settings.allowedDomains.length > 0} refresh={refresh} />}

        {data.isWorkspace && (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Weekly digest</h4>
            <p className="text-sm text-muted-foreground">
              Every Monday morning: an email to the customer addresses below, and a post in this room’s Slack channel with what’s blocking and what’s waiting. A week with nothing to report is skipped.
              {data.digest?.lastSentAt ? ` Last sent ${fmtDate(data.digest.lastSentAt)}.` : ""}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={digestOn} onChange={(e) => setDigestOn(e.target.checked)} />
              Send the weekly digest for this room
            </label>
            <Input value={digestTo} onChange={(e) => setDigestTo(e.target.value)} placeholder="Customer emails, comma-separated" />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="brand"
                onClick={async () => {
                  setDigestNote("");
                  const err = await send(`${base}/settings`, "PATCH", { ...baseSettings(), digestEnabled: digestOn, digestRecipients: digestTo.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) });
                  setError(err ?? "");
                  if (!err) {
                    setDigestNote("Saved.");
                    await refresh();
                  }
                }}
              >
                Save digest settings
              </Button>
              <Button size="sm" variant="outline" onClick={async () => { const r = await post(`${base}/digest/preview`); if (r.ok) setPreview(r.json as never); }}>Preview</Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!window.confirm("Send the digest now to the saved recipients and the Slack channel?")) return;
                  const r = await post(`${base}/digest/send`);
                  if (r.ok) setDigestNote(`Sent: ${String(r.json.emails ?? 0)} email${r.json.emails === 1 ? "" : "s"}${r.json.slack ? ", Slack posted" : ", Slack not posted"}.`);
                  await refresh();
                }}
              >
                Send now
              </Button>
              {digestNote && <span className="text-sm text-muted-foreground">{digestNote}</span>}
            </div>
            {preview && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm"><strong>{preview.subject}</strong><br /><span className="text-xs text-muted-foreground">To: {preview.recipients.length ? preview.recipients.join(", ") : "no recipients saved yet"}{preview.empty ? " · nothing to report this week, so the scheduled send would skip it" : ""}</span></p>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" aria-label="Close preview" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button>
                </div>
                <iframe title="Digest email preview" sandbox="" srcDoc={preview.html} className="h-[420px] w-full rounded border bg-white" />
                <p className="text-xs font-medium">Slack post</p>
                <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">{preview.slackText}</pre>
              </div>
            )}
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
                  <span className="flex gap-2">
                    {data.isWorkspace && /\.(xlsx|csv|tsv|txt)$/i.test(u.fileName) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={async () => {
                          setRevops("");
                          const r = await post(`${base}/uploads/${u.id}/compare`);
                          if (r.ok) setCompare({ uploadId: u.id, ...(r.json as unknown as Omit<NonNullable<typeof compare>, "uploadId">) });
                        }}
                      >
                        Compare with practices
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline" className="h-8 gap-1">
                      <a href={`/api/lp/partner-rooms/uploads/${u.id}/download`}><Download className="h-3.5 w-3.5" /> Download</a>
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {compare && (
          <section className="space-y-2 rounded-md border p-3" data-testid="room-compare">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold">Comparison: {compare.fileName}</h4>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" aria-label="Close comparison" onClick={() => setCompare(null)}><X className="h-4 w-4" /></Button>
            </div>
            {compare.practices ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Their list ({compare.practices.sheet}) has {compare.practices.uploaded} practices; we hold {compare.practices.inRoom}. {compare.practices.matched} match.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">On their list, not in ours ({compare.practices.missingFromRoom.length})</p>
                    <p className="text-xs text-muted-foreground">Salesforce is missing these.</p>
                    <ul className="mt-1 max-h-40 overflow-auto text-xs">{compare.practices.missingFromRoom.slice(0, 200).map((n) => <li key={n}>{n}</li>)}</ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium">In ours, not on their list ({compare.practices.notOnUpload.length})</p>
                    <p className="text-xs text-muted-foreground">Closed, renamed, or not in the rollout.</p>
                    <ul className="mt-1 max-h-40 overflow-auto text-xs">{compare.practices.notOnUpload.slice(0, 200).map((n) => <li key={n}>{n}</li>)}</ul>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No practice column found in this file.</p>
            )}
            {compare.doctors && <p className="text-sm text-muted-foreground">The roster ({compare.doctors.sheet}) lists {compare.doctors.count} doctors. Doctors can't be compared yet: LP Studio has no doctor records to compare against.</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="brand"
                disabled={!(compare.practices?.missingFromRoom.length || compare.doctors?.count)}
                onClick={async () => {
                  const r = await post(`${base}/revops-task`, { missing: compare.practices?.missingFromRoom ?? [], doctors: compare.practices ? 0 : compare.doctors?.count ?? 0, fileName: compare.fileName });
                  if (r.ok) setRevops(r.json.mentioned ? "Posted to the room’s Slack channel, with RevOps mentioned. It also rides in the weekly Slack digest until the gap closes." : "Posted to the room’s Slack channel. Nobody was mentioned: add a RevOps Slack mention under Settings.");
                }}
              >
                Post to Slack for RevOps
              </Button>
              {!!compare.practices?.missingFromRoom.length && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const blob = new Blob([["practice name", ...compare.practices!.missingFromRoom.map((n) => `"${n.replace(/"/g, '""')}"`)].join("\n")], { type: "text/csv" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "missing-from-salesforce.csv";
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  Download the missing list
                </Button>
              )}
              {revops && <span className="text-sm text-muted-foreground">{revops}</span>}
            </div>
          </section>
        )}

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
                  <span className="font-medium">RevOps Slack mention</span>
                  <Input value={revopsMention} onChange={(e) => setRevopsMention(e.target.value)} placeholder="S0123ABCD (user group) or U0123ABCD (person)" />
                  <span className="block text-xs text-muted-foreground">Mentioned in the weekly Slack digest when Salesforce is missing practices or doctors the customer listed. RevOps never gets an Asana task.</span>
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

/**
 * Calendar and minutes: connect a Google Calendar, hide a meeting from the
 * customer, and review the minutes drafted from a meeting's notes. A draft is
 * the team's only; Publish is what shows it to the customer.
 */
function CalendarSection({ base, calendar, events, hasDomain, refresh }: { base: string; calendar: RoomDetail["calendar"]; events: RoomEventRow[]; hasDomain: boolean; refresh: () => Promise<void> }) {
  const [calId, setCalId] = useState(calendar?.id ?? "");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  useEffect(() => setCalId(calendar?.id ?? ""), [calendar?.id]);

  const { data: google, refetch: refetchGoogle } = useQuery({
    queryKey: ["google-connection"],
    queryFn: async () => {
      const r = await fetch("/api/lp/google/status");
      if (!r.ok) throw new Error("status");
      return (await r.json()) as { configured: boolean; connection: { googleEmail: string; status: string; lastError: string | null } | null };
    },
  });
  // Back from Google's consent screen: say how it went, then tidy the address bar.
  useEffect(() => {
    const u = new URL(window.location.href);
    const outcome = u.searchParams.get("google");
    if (!outcome) return;
    const msg: Record<string, string> = {
      connected: "Google is connected. Choose “Use my calendar for this room” to start.",
      declined: "Google wasn’t connected: the request was cancelled.",
      missing_access: "Google wasn’t connected: both permissions (calendar and docs, read-only) need to stay ticked.",
      failed: "Google couldn’t be connected. Try again.",
    };
    if (outcome === "connected") setNote(msg.connected);
    else setErr(msg[outcome] ?? msg.failed);
    u.searchParams.delete("google");
    window.history.replaceState(null, "", u.toString());
  }, []);

  const connectGoogle = async () => {
    setBusy(true);
    const r = await fetch(`/api/lp/google/auth-url?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
    if (r.ok && j.url) window.location.href = j.url;
    else {
      setErr(j.error ?? "Could not start the Google connection");
      setBusy(false);
    }
  };
  const disconnectGoogle = async () => {
    setBusy(true);
    setErr((await send("/api/lp/google/connection", "DELETE")) ?? "");
    setNote("Google disconnected. Rooms that were reading your calendar have stopped; meetings already in them stay.");
    setBusy(false);
    await Promise.all([refetchGoogle(), refresh()]);
  };

  /** Save which calendar the room reads (through `via`), then read it. */
  const connect = async (via?: "mine" | null) => {
    setBusy(true);
    setNote("");
    const id = via === null ? "" : calId.trim() || (via === "mine" ? "primary" : "");
    let e = await send(`${base}/settings`, "PATCH", { calendarId: id, ...(via !== undefined ? { calendarConnection: via } : {}) });
    if (!e && id) {
      const r = await fetch(`${base}/calendar/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = (await r.json().catch(() => ({}))) as { note?: string; error?: string };
      if (r.ok) setNote(j.note ?? "Calendar read.");
      else e = j.error ?? "Could not read the calendar";
    } else if (!e) setNote("This room stopped reading the calendar. Meetings already in the room stay.");
    setErr(e ?? "");
    setBusy(false);
    await refresh();
  };
  const patch = async (id: number, body: unknown) => {
    const e = await send(`${base}/events/${id}`, "PATCH", body);
    setErr(e ?? "");
    await refresh();
    return !e;
  };

  const drafts = events.filter((e) => e.minutesStatus === "draft");
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.startsAt).getTime() >= now).reverse();
  const past = events.filter((e) => new Date(e.startsAt).getTime() < now);

  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">Calendar and minutes{drafts.length > 0 ? ` · ${drafts.length} draft${drafts.length === 1 ? "" : "s"} to review` : ""}</h4>
      <p className="text-sm text-muted-foreground">
        Connect a Google Calendar and the room shows its meetings that have a guest at this customer’s email domain. Internal meetings never show. When a finished meeting has Gemini notes attached, minutes are drafted here for you to review; the customer sees them only after you publish.
      </p>
      {!hasDomain && <p className="text-sm text-amber-700">Add the customer’s email domain under Settings first: that is how the room knows which meetings are theirs.</p>}
      <div className="space-y-2 rounded-md border p-3">
        {google?.connection ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">
              Your Google account: <span className="font-medium">{google.connection.googleEmail}</span>
              {google.connection.status !== "connected" && <span className="text-amber-700"> · needs reconnecting</span>}
            </span>
            {google.connection.status === "connected" ? (
              <Button size="sm" variant="brand" disabled={busy} onClick={() => connect("mine")}>{calendar?.connection?.mine ? "Read my calendar now" : "Use my calendar for this room"}</Button>
            ) : (
              <Button size="sm" variant="brand" disabled={busy} onClick={connectGoogle}>Reconnect Google</Button>
            )}
            <Button size="sm" variant="ghost" disabled={busy} onClick={disconnectGoogle}>Disconnect Google</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="brand" disabled={busy || google?.configured === false} onClick={connectGoogle}>Connect Google</Button>
            <span className="text-xs text-muted-foreground">
              {google?.configured === false ? "Google isn’t set up on this server yet." : "Read-only access to your calendar events and Google Docs. Connect the account that runs this customer’s meetings."}
            </span>
          </div>
        )}
        {calendar?.connection && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              This room reads {calendar.connection.mine ? "your" : `${calendar.connection.googleEmail}’s`} calendar{calendar.id && calendar.id !== "primary" ? ` (${calendar.id})` : ""}. Last read {fmtDate(calendar.syncedAt) || "never"}{calendar.note ? ` · ${calendar.note}` : ""}
            </span>
            <button type="button" className="underline" disabled={busy} onClick={() => connect(null)}>Stop reading</button>
          </div>
        )}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Use a shared calendar instead of the main one</summary>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input className="max-w-sm" value={calId} onChange={(e) => setCalId(e.target.value)} placeholder="primary, or a calendar ID (team@group.calendar.google.com)" aria-label="Google Calendar ID" />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => connect()}>Save and read</Button>
          </div>
        </details>
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}

      {events.length > 0 && (
        <div className="divide-y rounded-md border">
          {[...upcoming, ...past].map((e) => (
            <div key={e.id} className="px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.allDay ? new Date(e.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) : fmtDate(e.startsAt)}
                    {e.attendees ? ` · ${e.attendees}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {e.hidden && <Badge variant="outline">Hidden from customer</Badge>}
                  {e.minutesStatus === "draft" && <Badge variant="secondary">Minutes draft</Badge>}
                  {e.minutesStatus === "published" && <Badge>Minutes published</Badge>}
                  {new Date(e.startsAt).getTime() < now && e.minutesStatus !== "dismissed" && (
                    <Button size="sm" variant="outline" onClick={() => setOpenId(openId === e.id ? null : e.id)}>
                      {e.minutesStatus === "draft" ? "Review" : e.minutesStatus === "published" ? "Edit minutes" : "Write minutes"}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => patch(e.id, { hidden: !e.hidden })}>{e.hidden ? "Show" : "Hide"}</Button>
                </div>
              </div>
              {openId === e.id && <MinutesEditor event={e} onSave={(body) => patch(e.id, body)} onClose={() => setOpenId(null)} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MinutesEditor({ event, onSave, onClose }: { event: RoomEventRow; onSave: (body: unknown) => Promise<boolean>; onClose: () => void }) {
  const [summary, setSummary] = useState(event.minutes?.summary ?? "");
  const [decisions, setDecisions] = useState((event.minutes?.decisions ?? []).join("\n"));
  const [actions, setActions] = useState(actionsToText(event.minutes?.actions ?? []));
  const minutes = () => ({ summary, decisions: decisions.split("\n").map((d) => d.trim()).filter(Boolean), actions: textToActions(actions) });
  const area = "w-full rounded-md border bg-background px-2 py-1.5 text-sm";
  return (
    <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">
        {event.minutesStatus === "draft" && event.hasNotes ? "Drafted from the meeting’s notes. Read it before publishing: remove anything internal." : "Everything here is shown to the customer once published."}
      </p>
      <label className="block space-y-1 text-xs font-medium">Summary<textarea className={area} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
      <label className="block space-y-1 text-xs font-medium">Decisions, one per line<textarea className={area} rows={3} value={decisions} onChange={(e) => setDecisions(e.target.value)} /></label>
      <label className="block space-y-1 text-xs font-medium">Action items, one per line: action | owner | due. Start a line with “x ” when it is done.<textarea className={area} rows={4} value={actions} onChange={(e) => setActions(e.target.value)} /></label>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="brand" onClick={async () => { if (await onSave({ minutes: minutes(), minutesStatus: "published" })) onClose(); }}>
          {event.minutesStatus === "published" ? "Save" : "Publish to the customer"}
        </Button>
        {event.minutesStatus !== "published" && <Button size="sm" variant="outline" onClick={async () => { if (await onSave({ minutes: minutes(), minutesStatus: "draft" })) onClose(); }}>Save draft</Button>}
        {event.minutesStatus === "published" && <Button size="sm" variant="outline" onClick={async () => { if (await onSave({ minutesStatus: "draft" })) onClose(); }}>Unpublish</Button>}
        {event.minutesStatus === "draft" && <Button size="sm" variant="ghost" onClick={async () => { if (await onSave({ minutesStatus: "dismissed" })) onClose(); }}>Discard</Button>}
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

const fmtDuration = (seconds: number) => (seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.round(seconds / 60)} min` : `${(seconds / 3600).toFixed(1)} hr`);
const ACTION_LABEL: Record<string, string> = { view: "viewed", open: "opened", download: "downloaded", time: "spent time on" };

/** Who opened which launch-kit item, for how long, and when. Last 90 days. */
function EngagementSection({ engagement }: { engagement: RoomDetail["engagement"] }) {
  const [showAll, setShowAll] = useState(false);
  const assets = engagement?.assets ?? [];
  const recent = engagement?.recent ?? [];
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">Asset engagement</h4>
      <p className="text-sm text-muted-foreground">Who opened what in the launch kit, for how long, and when. PDFs, images and videos open in a viewer on the page, which is how time and watch progress are measured. Last 90 days.</p>
      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing has been opened yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Asset</th>
                <th className="px-3 py-2 font-medium">Opened</th>
                <th className="px-3 py-2 font-medium">Downloads</th>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">Last</th>
              </tr>
            </thead>
            <tbody>
              {(showAll ? assets : assets.slice(0, 8)).map((a) => (
                <tr key={a.key} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{a.title}</td>
                  <td className="px-3 py-2 tabular-nums">{a.views}</td>
                  <td className="px-3 py-2 tabular-nums">{a.downloads}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {a.seconds > 0 ? fmtDuration(a.seconds) : "—"}
                    {a.maxProgress > 0 ? ` · watched ${a.maxProgress}%` : ""}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{[...a.people, ...(a.anonymous > 0 ? [`${a.anonymous} not identified`] : [])].join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(a.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {assets.length > 8 && <button type="button" className="text-xs underline" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `Show all ${assets.length}`}</button>}
      {recent.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground">Latest activity</summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {recent.map((r, i) => (
              <li key={i}>
                <span className="text-foreground">{r.who ?? "Someone not identified"}</span> {ACTION_LABEL[r.action] ?? r.action} <span className="text-foreground">{r.title}</span>
                {r.action === "time" && r.value ? ` (${fmtDuration(r.value)})` : ""} · {fmtDate(r.at)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/**
 * Launch assets made from what the room already knows (both names, both logos,
 * the cover photo): the partnership one-pager and two social graphics. Each is
 * generated here, uploaded, and filed into the room's launch kit.
 */
function LaunchAssetsSection({ pageId, kit, refresh }: { pageId: number; kit: NonNullable<RoomDetail["kit"]>; refresh: () => Promise<void> }) {
  const [state, setState] = useState<Record<string, "working" | "done" | string>>({});
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const SPECS = [
    { key: "partnership-one-pager", title: "Partnership one-pager", note: "PDF, from the New partner one-pager template" },
    { key: "social-image-1", title: "Social graphic, link preview", note: "1200 × 627, with the cover photo" },
    { key: "social-image-2", title: "Social graphic, square", note: "1080 × 1080" },
    { key: "media-kit", title: "Media kit", note: "PDF: the announcement copy, social posts and links in one document" },
  ] as const;
  const has = (key: string) => kit.assets.some((a) => a.key === key && a.hasFile);
  // Files that are the same for every customer: uploaded once for the workspace, added to each room.
  const { data: standard, refetch: refetchStandard } = useQuery({
    queryKey: ["room-standard-assets"],
    queryFn: async () => {
      const r = await fetch("/api/lp/room-standard-assets");
      if (!r.ok) throw new Error("standard");
      return ((await r.json()) as { assets: { key: string; title: string; description: string; fileUrl: string | null; updatedAt: string | null }[] }).assets;
    },
  });
  const [stdNote, setStdNote] = useState("");
  const setStandard = async (key: string, fileUrl: string) => {
    const e = await send(`/api/lp/room-standard-assets/${key}`, "PUT", { fileUrl });
    setStdNote(e ?? "Saved as the standard file for every room.");
    await refetchStandard();
  };
  const addStandard = async (replace: boolean) => {
    const r = await fetch(`/api/lp/partner-rooms/${pageId}/standard-assets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replace }) });
    const j = (await r.json().catch(() => ({}))) as { added?: string[]; kept?: string[]; missing?: string[]; error?: string };
    setStdNote(
      !r.ok
        ? (j.error ?? "Could not add the standard files")
        : [j.added?.length ? `Added: ${j.added.join(", ")}.` : "", j.kept?.length ? `Kept this room’s own file: ${j.kept.join(", ")}.` : "", j.missing?.length ? `Not uploaded yet: ${j.missing.join(", ")}.` : ""].filter(Boolean).join(" ") || "Nothing to add.",
    );
    await refresh();
  };

  const create = async (keys: readonly string[]) => {
    setBusy(true);
    try {
      const [{ createLaunchAsset }, { fetchBrandConfig }] = await Promise.all([import("@/lib/room-launch-assets"), import("@/lib/brand-config")]);
      const brand = await fetchBrandConfig();
      for (const key of keys) {
        setState((s) => ({ ...s, [key]: "working" }));
        try {
          const url = await createLaunchAsset(key as "partnership-one-pager", { pageId, partnerName: kit.partnerName, partnerLogoUrl: kit.partnerLogoUrl, heroImageUrl: kit.heroImageUrl, signupUrl: kit.signupUrl, brand, texts: kit.texts ?? [], links: kit.links ?? [], files: kit.assets.filter((x) => !x.hidden && x.kind !== "text" && x.kind !== "link" && x.key !== "media-kit" && (x.hasFile || keys.includes(x.key))).map((x) => x.title) });
          setPreviews((p) => ({ ...p, [key]: url }));
          setState((s) => ({ ...s, [key]: "done" }));
        } catch (e) {
          setState((s) => ({ ...s, [key]: e instanceof Error ? e.message : "Could not create it" }));
        }
      }
      // "Create launch kit" also brings in the standard guides (a room's own file is kept).
      if (keys.length > 1) await addStandard(false);
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const missing = [!kit.partnerName && "the customer’s name", !kit.partnerLogoUrl && "the customer’s logo (their name is used instead)", !kit.heroImageUrl && "a cover photo (the link-preview graphic is made without one)"].filter(Boolean) as string[];
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">Launch assets</h4>
      <p className="text-sm text-muted-foreground">
        Made for {kit.partnerName || "this customer"} from the room’s names, logos and cover photo, then added to the launch kit. Creating one again replaces the file in the kit; the customer’s “Request changes” still works on it.
      </p>
      {missing.length > 0 && <p className="text-xs text-amber-700">Not set on the page yet: {missing.join("; ")}.</p>}
      <div className="divide-y rounded-md border">
        {SPECS.map((a) => {
          const st = state[a.key];
          return (
            <div key={a.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {a.note}
                  {st && st !== "working" && st !== "done" ? <span className="text-destructive"> · {st}</span> : null}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {st === "done" || has(a.key) ? <Badge variant="secondary">{st === "done" ? "Created" : "In the kit"}</Badge> : null}
                {previews[a.key] && <a className="text-xs underline" href={previews[a.key]} target="_blank" rel="noreferrer">Open</a>}
                <Button size="sm" variant="outline" disabled={busy || !kit.partnerName} onClick={() => create([a.key])}>
                  {st === "working" ? "Creating…" : has(a.key) || st === "done" ? "Create again" : "Create"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">Standard files</p>
        <p className="text-xs text-muted-foreground">The same for every customer. Upload each one once; it is added to every room’s launch kit. A room with its own version keeps it.</p>
        {(standard ?? []).map((a) => (
          <div key={a.key} className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {a.fileUrl ? <>Uploaded {fmtDate(a.updatedAt)} · <a className="underline" href={a.fileUrl} target="_blank" rel="noreferrer">Open</a></> : "Not uploaded yet"}
                {has(a.key) ? " · in this room’s kit" : ""}
              </p>
            </div>
            <PdfUploadButton label={a.fileUrl ? "Replace" : "Upload PDF"} onUploaded={(r) => void setStandard(a.key, r.url)} />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy || !(standard ?? []).some((a) => a.fileUrl)} onClick={() => addStandard(false)}>Add to this room</Button>
          {stdNote && <span className="text-xs text-muted-foreground">{stdNote}</span>}
        </div>
      </div>
      <Button size="sm" variant="brand" disabled={busy || !kit.partnerName} onClick={() => create(SPECS.map((a) => a.key))}>
        {busy ? "Creating…" : "Create launch kit"}
      </Button>
      <p className="text-xs text-muted-foreground">Creates the one-pager, both graphics and the media kit, and adds the standard files.</p>
    </section>
  );
}

/**
 * Automatic rooms (for the whole workspace, not just this page): watch a sheet
 * tab of signed accounts and create a draft room for each account added to it.
 */
function AutomaticRoomsSection() {
  const { data, refetch } = useQuery({
    queryKey: ["room-autocreate"],
    queryFn: async () => {
      const r = await fetch("/api/lp/room-autocreate");
      if (!r.ok) throw new Error("autocreate");
      return (await r.json()) as { enabled: boolean; sheetId: string | null; sheetTab: string | null; practicesTab: string | null; syncedAt: string | null; note: string | null; accounts: { key: string; name: string; signedDate: string | null; owner: string | null; sfdcId?: string | null; pageId: number | null }[] };
    },
  });
  const [sheet, setSheet] = useState("");
  const [tab, setTab] = useState("");
  const [practicesTab, setPracticesTab] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (!data) return;
    setSheet(data.sheetId ? `https://docs.google.com/spreadsheets/d/${data.sheetId}` : "");
    setTab(data.sheetTab ?? "");
    setPracticesTab(data.practicesTab ?? "");
  }, [data]);

  const save = async (enabled: boolean) => {
    setBusy(true);
    setNote("");
    let e = await send("/api/lp/room-autocreate", "PUT", { enabled, sheet: sheet.trim(), tab: tab.trim(), practicesTab: practicesTab.trim() });
    if (!e && enabled) {
      const r = await fetch("/api/lp/room-autocreate/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = (await r.json().catch(() => ({}))) as { note?: string; error?: string };
      if (r.ok) setNote(j.note ?? "Sheet read.");
      else e = j.error ?? "Could not read the sheet";
    } else if (!e) setNote("Automatic rooms are off. Rooms already created stay.");
    setErr(e ?? "");
    setBusy(false);
    await refetch();
  };
  const createFor = async (key: string) => {
    setBusy(true);
    const r = await fetch("/api/lp/room-autocreate/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setErr(r.ok ? "" : (j.error ?? "Could not create the room"));
    setBusy(false);
    await refetch();
  };

  const accounts = data?.accounts ?? [];
  const withRoom = accounts.filter((a) => a.pageId);
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">Automatic rooms <span className="font-normal text-muted-foreground">(whole workspace)</span></h4>
      <p className="text-sm text-muted-foreground">
        Point LP Studio at the sheet tab that lists signed accounts. Each account added to it gets a draft room with the account’s name filled in and the standard files attached, and your Slack channel is told. Accounts already on the list when you turn this on are recorded, not created. Rooms stay drafts until someone publishes them.
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
        <Input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" aria-label="Signed accounts sheet" />
        <Input value={tab} onChange={(e) => setTab(e.target.value)} placeholder="Accounts with MSAs Signed" aria-label="Tab name" />
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
        <p className="text-xs text-muted-foreground">
          Practices: name the tab of the same workbook that lists every account’s locations. Each new room then reads its own practices from it, matched by Salesforce ID. This needs an “Account ID” column on the signed-accounts tab and a “Parent Account ID” column on the locations tab.
        </p>
        <Input value={practicesTab} onChange={(e) => setPracticesTab(e.target.value)} placeholder="Sheet14" aria-label="Practices tab name" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="brand" disabled={busy || !sheet.trim()} onClick={() => save(true)}>{data?.enabled ? "Save and check now" : "Turn on"}</Button>
        {data?.enabled && <Button size="sm" variant="ghost" disabled={busy} onClick={() => save(false)}>Turn off</Button>}
        {data?.enabled && <span className="text-xs text-muted-foreground">Checked about every hour. Last read {fmtDate(data.syncedAt) || "never"}{data.note ? ` · ${data.note}` : ""}</span>}
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}
      {accounts.length > 0 && (
        <details className="text-sm" open={showAll} onToggle={(e) => setShowAll((e.currentTarget as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-xs text-muted-foreground">{accounts.length} accounts on the list · {withRoom.length} with a room made here</summary>
          <div className="mt-2 max-h-72 divide-y overflow-y-auto rounded-md border">
            {accounts.map((a) => (
              <div key={a.key} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="min-w-0 truncate">{a.name}{a.signedDate ? <span className="text-xs text-muted-foreground"> · signed {a.signedDate}</span> : null}{a.sfdcId ? null : <span className="text-xs text-amber-700"> · no Salesforce ID</span>}</span>
                {a.pageId ? (
                  <a className="text-xs underline" href={`/pages/${a.pageId}`}>Open room</a>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => createFor(a.key)}>Create room</Button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
