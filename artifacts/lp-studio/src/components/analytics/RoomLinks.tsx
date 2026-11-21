import { useEffect, useState } from "react";
import { ExternalLink, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** One of the hub's Important links as stored on the page. Mirrors the server's RoomLinkInput. */
export interface HubLink {
  key?: string;
  title: string;
  description?: string;
  url: string;
  hidden?: boolean;
}

/**
 * Important links, in the team's pop-up: add a resource (a name and a web
 * address), hide one from the customer, or remove it. The links live on the
 * hub page, under Launch & marketing, so a change here shows straight away.
 */
export function RoomLinksSection({ pageId, links, onSaved }: { pageId: number; links: HubLink[]; onSaved: (links: HubLink[]) => void | Promise<void> }) {
  const [list, setList] = useState<HubLink[]>(links);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => setList(links), [links]);

  const save = async (next: HubLink[]): Promise<boolean> => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/lp/partner-rooms/${pageId}/links`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ links: next }) });
      const j = (await r.json().catch(() => ({}))) as { links?: HubLink[]; error?: string };
      if (!r.ok || !j.links) {
        setErr(j.error ?? "Could not save the links");
        return false;
      }
      setList(j.links);
      await onSaved(j.links);
      return true;
    } catch {
      setErr("Could not save the links");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2" data-room-links>
      <div>
        <h4 className="text-sm font-semibold">Important links</h4>
        <p className="text-sm text-muted-foreground">Resources the customer sees at the top of Launch &amp; marketing.</p>
      </div>
      {list.length > 0 && (
        <div className="divide-y rounded-md border">
          {list.map((l, i) => (
            <div key={`${l.url}-${i}`} className={`flex items-center gap-2 px-3 py-2 ${l.hidden ? "opacity-60" : ""}`} data-room-link-row>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {l.title}
                  {l.hidden && <span className="ml-2 text-xs font-normal text-muted-foreground">Hidden from the customer</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{l.url.replace(/^https?:\/\//, "")}</p>
              </div>
              <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground">
                <a href={l.url} target="_blank" rel="noreferrer" aria-label={`Open ${l.title}`}><ExternalLink className="h-3.5 w-3.5" /></a>
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" disabled={busy} aria-label={`${l.hidden ? "Show" : "Hide"} ${l.title}`} onClick={() => save(list.map((x, k) => (k === i ? { ...x, hidden: !x.hidden } : x)))}>
                {l.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" disabled={busy} aria-label={`Remove ${l.title}`} onClick={() => window.confirm(`Remove “${l.title}”?`) && save(list.filter((_, k) => k !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim() || !url.trim()) return;
          if (await save([...list, { title: title.trim(), url: url.trim() }])) {
            setTitle("");
            setUrl("");
          }
        }}
      >
        <label className="block min-w-[180px] flex-1 space-y-1 text-xs"><span className="font-medium text-muted-foreground">Name</span><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Brand folder" data-room-link-title /></label>
        <label className="block min-w-[220px] flex-[2] space-y-1 text-xs"><span className="font-medium text-muted-foreground">Link</span><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" data-room-link-url /></label>
        <Button type="submit" size="sm" variant="brand" className="gap-1" disabled={busy || !title.trim() || !url.trim()} data-room-link-add><Plus className="h-3.5 w-3.5" /> Add link</Button>
      </form>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
    </section>
  );
}
