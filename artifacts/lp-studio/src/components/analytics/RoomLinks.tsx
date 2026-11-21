import { useEffect, useRef, useState } from "react";
import { ExternalLink, Eye, EyeOff, FileText, Image as ImageIcon, Link2, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { MAX_PDF_BYTES, uploadPdf } from "@/components/PdfUploadButton";
import { uploadImage } from "@/components/ImagePicker";
import { roomLinkAsset } from "@/blocks/BlockRoomWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** One of the hub's Important links as stored on the page. Mirrors the server's RoomLinkInput. */
export interface HubLink {
  key?: string;
  title: string;
  description?: string;
  url: string;
  hidden?: boolean;
  /** An uploaded file instead of a web page: it opens in the hub's viewer. */
  fileUrl?: string;
  kind?: "pdf" | "image";
  /** The name its opens are counted under, kept when it is renamed. */
  viewKey?: string;
}

/** How often one resource was opened, from the hub's asset events (last 90 days). */
export interface HubLinkViews {
  key: string;
  views: number;
  seconds: number;
  people: string[];
  anonymous: number;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const minutes = (s: number) => (s < 60 ? `${s}s` : `${Math.round(s / 60)} min`);

/**
 * Important links, in the team's pop-up: add a resource (a web address, or an
 * uploaded PDF or image), hide one from the customer, or remove it. They live
 * on the hub page, under Launch & marketing, so a change shows straight away.
 * Each row says how often the customer has opened it.
 */
export function RoomLinksSection({ pageId, links, views = [], onSaved }: { pageId: number; links: HubLink[]; views?: HubLinkViews[]; onSaved: (links: HubLink[]) => void | Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  /** The row being edited, and what is typed for its name and description. */
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ title: "", description: "" });
  const startEdit = (i: number) => {
    setDraft({ title: list[i].title, description: list[i].description ?? "" });
    setEditing(i);
  };
  const saveEdit = async (i: number) => {
    const l = list[i];
    const title = draft.title.trim();
    if (!title) return;
    // Opens are counted under the name it had: keep that key when the name changes, so the count carries over.
    const next: HubLink = { ...l, title, description: draft.description.trim() || undefined, ...(title !== l.title ? { viewKey: roomLinkAsset(l).key } : {}) };
    if (await save(list.map((x, k) => (k === i ? next : x)))) setEditing(null);
  };
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

  /** Upload a PDF or an image and add it as a resource. The Name box names it; left empty, the file's own name does. */
  const upload = async (file: File) => {
    const image = file.type.startsWith("image/");
    const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!image && !pdf) return setErr("Upload a PDF or an image.");
    if (file.size > (image ? MAX_IMAGE_BYTES : MAX_PDF_BYTES)) return setErr(image ? "That image is over 10 MB." : "That file is over 50 MB.");
    setUploading(true);
    setErr("");
    try {
      const fileUrl = image ? await uploadImage(file) : (await uploadPdf(file)).url;
      const name = title.trim() || file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Resource";
      if (await save([...list, { title: name.slice(0, 120), url: fileUrl, fileUrl, kind: image ? "image" : "pdf" }])) setTitle("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="space-y-2" data-room-links>
      <div>
        <h4 className="text-sm font-semibold">Important links</h4>
        <p className="text-sm text-muted-foreground">Resources the customer sees at the top of Launch &amp; marketing. Files open in the hub’s viewer.</p>
      </div>
      {list.length > 0 && (
        <div className="divide-y rounded-md border">
          {list.map((l, i) => {
            const seen = views.find((v) => v.key === roomLinkAsset(l).key);
            const who = seen ? [...seen.people, ...(seen.anonymous > 0 ? [`${seen.anonymous} not identified`] : [])].join(", ") : "";
            if (editing === i) {
              return (
                <form key={`${l.url}-${i}`} className="space-y-2 bg-muted/30 px-3 py-3" data-room-link-editor onSubmit={(e) => { e.preventDefault(); void saveEdit(i); }}>
                  <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Name the customer sees</span><Input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} data-room-link-edit-title /></label>
                  <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Description (optional)</span><Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={200} placeholder="One line on what it is and who it is for" data-room-link-edit-description /></label>
                  <div className="flex items-center gap-2">
                    <Button type="submit" size="sm" variant="brand" disabled={busy || !draft.title.trim()}>Save</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </form>
              );
            }
            return (
            <div key={`${l.url}-${i}`} className={`flex items-center gap-2 px-3 py-2 ${l.hidden ? "opacity-60" : ""}`} data-room-link-row={l.fileUrl ? "file" : "link"}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground" aria-hidden>
                {l.fileUrl ? l.kind === "image" ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {l.title}
                  {l.hidden && <span className="ml-2 text-xs font-normal text-muted-foreground">Hidden from the customer</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground" data-room-link-views={seen?.views ?? 0}>
                  {l.description || (l.fileUrl ? (l.kind === "image" ? "Image" : "PDF") : l.url.replace(/^https?:\/\//, ""))}
                  {" · "}
                  {seen?.views ? `Opened ${seen.views} time${seen.views === 1 ? "" : "s"}${seen.seconds > 0 ? ` · ${minutes(seen.seconds)}` : ""}${who ? ` · ${who}` : ""}` : "Not opened yet"}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" disabled={busy} aria-label={`Edit the name and description of ${l.title}`} title="Edit name and description" onClick={() => startEdit(i)} data-room-link-edit>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground">
                <a href={l.url} target="_blank" rel="noreferrer" aria-label={`Open ${l.title}`} title="Open"><ExternalLink className="h-3.5 w-3.5" /></a>
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" disabled={busy} aria-label={`${l.hidden ? "Show" : "Hide"} ${l.title}`} title={l.hidden ? "Show to the customer" : "Hide from the customer"} onClick={() => save(list.map((x, k) => (k === i ? { ...x, hidden: !x.hidden } : x)))}>
                {l.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" disabled={busy} aria-label={`Remove ${l.title}`} title="Remove" onClick={() => window.confirm(`Remove “${l.title}”?`) && save(list.filter((_, k) => k !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            );
          })}
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
        <Button type="submit" size="sm" variant="brand" className="gap-1" disabled={busy || uploading || !title.trim() || !url.trim()} data-room-link-add><Plus className="h-3.5 w-3.5" /> Add link</Button>
        <span className="pb-2 text-xs text-muted-foreground">or</span>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf,image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
          data-room-link-file
        />
        <Button type="button" size="sm" variant="outline" className="gap-1" disabled={busy || uploading} onClick={() => fileRef.current?.click()} data-room-link-upload>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : "Upload a file"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">Upload a PDF or an image. Use the pencil to give it a proper name and a description.</p>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
    </section>
  );
}
