import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TiptapEditor } from "@/components/TiptapEditor";
import { ImagePicker } from "@/components/ImagePicker";
import { FocalPointPicker } from "@/components/FocalPointPicker";
import {
  prePublishChecklist,
  focalToObjectPosition,
  objectPositionToFocal,
} from "@/pages/blog/blogPublishing";
import {
  AlertTriangle, CheckCircle2, Loader2, RefreshCw, Plus, Trash2,
  ArrowLeft, Eye, Globe, FileText, Code2, Type, Clock,
  History, RotateCcw, Circle,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
// Posts are rendered on the public apex. In dev the marketing site needs
// ?preview=marketing to mount; in prod the apex serves it directly.
const PUBLIC_PREFIX = import.meta.env.DEV
  ? "/blog"
  : "https://lpstudio.ai/blog";

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers: { "content-type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || String(res.status));
  }
  return res.json();
}

interface Post {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  authorName: string;
  tags: string[];
  status: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  ogFocalX: number;
  ogFocalY: number;
  readingTimeMin: number;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface Draft {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  authorName: string;
  tags: string; // comma-separated in the form
  status: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  ogFocalX: number;
  ogFocalY: number;
  scheduledAt: string | null; // ISO
}

interface Revision {
  id: number;
  reason: string;
  authorEmail: string | null;
  createdAt: string | null;
  snapshot: Record<string, unknown>;
}

function emptyDraft(): Draft {
  return {
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    coverImageUrl: "",
    authorName: "LP Studio",
    tags: "",
    status: "draft",
    seoTitle: "",
    seoDescription: "",
    ogImageUrl: "",
    ogFocalX: 0.5,
    ogFocalY: 0.5,
    scheduledAt: null,
  };
}

function postToDraft(p: Post): Draft {
  return {
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    body: p.body,
    coverImageUrl: p.coverImageUrl,
    authorName: p.authorName,
    tags: p.tags.join(", "),
    status: p.status,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    ogImageUrl: p.ogImageUrl,
    ogFocalX: typeof p.ogFocalX === "number" ? p.ogFocalX : 0.5,
    ogFocalY: typeof p.ogFocalY === "number" ? p.ogFocalY : 0.5,
    scheduledAt: p.scheduledAt,
  };
}

function draftToPayload(d: Draft, status?: string) {
  return {
    title: d.title.trim(),
    slug: d.slug.trim(),
    excerpt: d.excerpt,
    body: d.body,
    coverImageUrl: d.coverImageUrl.trim(),
    authorName: d.authorName.trim() || "LP Studio",
    tags: d.tags.split(",").map((t) => t.trim()).filter(Boolean),
    status: status ?? d.status,
    seoTitle: d.seoTitle.trim(),
    seoDescription: d.seoDescription.trim(),
    ogImageUrl: d.ogImageUrl.trim(),
    ogFocalX: d.ogFocalX,
    ogFocalY: d.ogFocalY,
    scheduledAt: d.scheduledAt,
  };
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// <input type=datetime-local> wants "YYYY-MM-DDTHH:mm" in LOCAL time; convert
// to/from the ISO string we store.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function SuperAdminBlog() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = list view; otherwise editing (id null => new post).
  const [editing, setEditing] = useState<{ id: number | null; draft: Draft } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/admin/blog/posts");
      setPosts(data?.posts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load posts");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (editing) {
    return (
      <BlogEditor
        id={editing.id}
        draft={editing.draft}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
        onIdAssigned={(newId) =>
          setEditing((e) => (e ? { ...e, id: newId } : e))
        }
      />
    );
  }

  if (loading && posts === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const list = posts ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Blog</h2>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            LP Studio's own marketing blog, rendered on lpstudio.ai/blog. Write
            posts in the rich-text editor, set the cover + social card, then save
            a draft, schedule for later, or publish now.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Reload
          </Button>
          <Button size="sm" onClick={() => setEditing({ id: null, draft: emptyDraft() })}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New post
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No posts yet. Create your first one.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground text-left border-b bg-muted/30">
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Published / Scheduled</th>
                <th className="px-4 py-2 font-medium">Updated</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <PostRow
                  key={p.id}
                  post={p}
                  onEdit={() => setEditing({ id: p.id, draft: postToDraft(p) })}
                  onChanged={load}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
        <Globe className="w-3 h-3" /> Published
      </span>
    );
  }
  if (status === "scheduled") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
        <Clock className="w-3 h-3" /> Scheduled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
      <FileText className="w-3 h-3" /> Draft
    </span>
  );
}

function PostRow({ post, onEdit, onChanged }: { post: Post; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  const togglePublish = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/blog/posts/${post.id}`, {
        method: "PUT",
        body: JSON.stringify(
          draftToPayload(postToDraft(post), post.status === "published" ? "draft" : "published"),
        ),
      });
      onChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/blog/posts/${post.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  };

  const previewHref =
    post.status === "published"
      ? `${PUBLIC_PREFIX}/${post.slug}${import.meta.env.DEV ? "?preview=marketing" : ""}`
      : null;

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="px-4 py-2.5">
        <button className="font-medium text-left hover:underline" onClick={onEdit}>
          {post.title || "(untitled)"}
        </button>
        <div className="text-xs text-muted-foreground font-mono">/blog/{post.slug}</div>
      </td>
      <td className="px-4 py-2.5"><StatusBadge status={post.status} /></td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground">
        {post.status === "scheduled" ? fmtDateTime(post.scheduledAt) : fmtDate(post.publishedAt)}
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtDate(post.updatedAt)}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1">
          {previewHref && (
            <a href={previewHref} target="_blank" rel="noreferrer" title="View live post">
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <Eye className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={togglePublish}>
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : post.status === "published" ? "Unpublish" : "Publish"}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEdit}>
            Edit
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            disabled={busy}
            onClick={remove}
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// Body editor — Tiptap WYSIWYG + raw-HTML/SVG code-view toggle (unchanged from
// Phase 1; see the long note that previously lived here).
function BodyField({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [view, setView] = useState<"rich" | "html">("rich");
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">
          Body{" "}
          <span className="text-muted-foreground">
            (rich text — headings, lists, links, tables, images, embeds; use HTML for inline &lt;svg&gt;)
          </span>
        </Label>
        <div className="inline-flex rounded-md border overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setView("rich")}
            className={`inline-flex items-center gap-1 px-2 py-1 ${view === "rich" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
          >
            <Type className="w-3 h-3" /> Rich text
          </button>
          <button
            type="button"
            onClick={() => setView("html")}
            className={`inline-flex items-center gap-1 px-2 py-1 border-l ${view === "html" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
          >
            <Code2 className="w-3 h-3" /> HTML
          </button>
        </div>
      </div>
      {view === "rich" ? (
        <TiptapEditor
          content={value}
          onChange={onChange}
          placeholder="Lead with the answer in the first two sentences…"
          className="min-h-[420px]"
        />
      ) : (
        <Textarea
          rows={26}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={'<h2>Lead with the answer</h2>\n<p>First two sentences answer the title directly.</p>'}
          className="font-mono text-[13px] leading-[1.6]"
        />
      )}
      <p className="text-[11px] text-muted-foreground">
        Switch to HTML to paste inline SVG infographics or embed blocks. The
        public page re-sanitizes all HTML on render.
      </p>
    </div>
  );
}

// Social-card (OG) preview: a 1200×630 (1.91:1) framed mock that renders the OG
// image cropped to the chosen focal point (CSS object-position), with the
// title + excerpt overlaid the way a share unfurl shows them. Lets the author
// see the exact share card before publishing. We do NOT derive a cropped image
// server-side — the focal point + object-position handles the crop.
function SocialCardPreview({
  imageUrl, focalX, focalY, title, excerpt,
}: { imageUrl: string; focalX: number; focalY: number; title: string; excerpt: string }) {
  return (
    <div className="rounded-lg border overflow-hidden bg-white max-w-[420px]">
      <div className="relative w-full bg-muted" style={{ aspectRatio: "1200 / 630" }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: focalToObjectPosition(focalX, focalY) }}
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            No image — add a cover or OG image
          </div>
        )}
      </div>
      <div className="px-3 py-2 border-t">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">lpstudio.ai</div>
        <div className="text-sm font-semibold leading-snug line-clamp-2">{title || "Post title"}</div>
        {excerpt && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{excerpt}</div>}
      </div>
    </div>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

function BlogEditor({
  id,
  draft: initial,
  onCancel,
  onSaved,
  onIdAssigned,
}: {
  id: number | null;
  draft: Draft;
  onCancel: () => void;
  onSaved: () => void;
  onIdAssigned: (id: number) => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [postId, setPostId] = useState<number | null>(id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  // ── Save (explicit + autosave share this path) ─────────────────────────
  // statusOverride lets the explicit Publish/Schedule buttons force a status;
  // autosave omits it (preserves the draft's current status).
  const doSave = useCallback(
    async (statusOverride?: string): Promise<boolean> => {
      const payload = draftToPayload(draftRef.current, statusOverride);
      if (!payload.title) {
        setError("Title is required");
        return false;
      }
      setError(null);
      try {
        let resp: { post?: Post };
        if (postIdRef.current == null) {
          resp = await apiFetch("/api/admin/blog/posts", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          if (resp.post?.id) {
            setPostId(resp.post.id);
            postIdRef.current = resp.post.id;
            onIdAssigned(resp.post.id);
          }
        } else {
          resp = await apiFetch(`/api/admin/blog/posts/${postIdRef.current}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        }
        if (resp.post) {
          // Sync server-derived fields (slug collision handling, status).
          setDraft((d) => ({
            ...d,
            slug: resp.post!.slug,
            status: statusOverride ?? d.status,
            scheduledAt: resp.post!.scheduledAt,
          }));
        }
        setLastSavedAt(new Date().toISOString());
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
        return false;
      }
    },
    [onIdAssigned],
  );

  // Keep refs so the debounced autosave always sees the latest draft/id
  // without re-arming the timer on every keystroke.
  const draftRef = useRef(draft);
  const postIdRef = useRef(postId);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { postIdRef.current = postId; }, [postId]);

  // ── Autosave: debounced (1.2s) draft save once a title exists. Reuses the
  // same setTimeout/ref debounce pattern the sales one-pager editor uses.
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = true;
    if (!draft.title.trim()) return; // nothing to autosave yet
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      if (!dirtyRef.current) return;
      setSaveState("saving");
      const ok = await doSave(); // no status override → keep current status
      dirtyRef.current = false;
      setSaveState(ok ? "saved" : "error");
    }, 1200);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Explicit save / publish / schedule.
  const explicitSave = async (status?: string) => {
    setSaving(true);
    setSaveState("saving");
    const ok = await doSave(status);
    setSaving(false);
    setSaveState(ok ? "saved" : "error");
    if (ok && status) onSaved(); // returning to the list on publish/schedule
  };

  const checklist = prePublishChecklist({
    title: draft.title,
    excerpt: draft.excerpt,
    coverImageUrl: draft.coverImageUrl,
    ogImageUrl: draft.ogImageUrl,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    slug: draft.slug,
    status: draft.status,
    scheduledAt: draft.scheduledAt,
  });

  const publishWithChecklist = async (status: "published" | "scheduled") => {
    const cl = prePublishChecklist({ ...draftToPayload(draft, status) });
    if (!cl.ok) {
      const missing = cl.items.filter((i) => !i.ok).map((i) => `• ${i.label}`).join("\n");
      const verb = status === "scheduled" ? "schedule" : "publish";
      if (!window.confirm(`This post is missing:\n\n${missing}\n\n${verb} anyway?`)) return;
    }
    if (status === "scheduled" && !draft.scheduledAt) {
      setError("Pick a schedule date/time first.");
      return;
    }
    await explicitSave(status);
  };

  // ── Preview link (token-gated render of draft/scheduled posts) ─────────
  const openPreview = async () => {
    if (postId == null) {
      // Save first so we have an id to preview.
      const ok = await doSave();
      if (!ok || postIdRef.current == null) return;
    }
    try {
      const { token } = await apiFetch(`/api/admin/blog/posts/${postIdRef.current}/preview-token`);
      const devSuffix = import.meta.env.DEV ? "&preview=marketing" : "";
      const url = `${PUBLIC_PREFIX}/${draft.slug || "preview"}?previewId=${postIdRef.current}&previewToken=${encodeURIComponent(token)}${devSuffix}`;
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mint preview link");
    }
  };

  const ogPreviewImage = draft.ogImageUrl.trim() || draft.coverImageUrl.trim();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back to posts
        </Button>
        <div className="flex items-center gap-2">
          <SaveIndicator state={saveState} lastSavedAt={lastSavedAt} />
          {postId != null && (
            <Button size="sm" variant="outline" onClick={() => setShowHistory((v) => !v)}>
              <History className="w-3.5 h-3.5 mr-1.5" /> History
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={openPreview}>
            <Eye className="w-3.5 h-3.5 mr-1.5" /> Preview
          </Button>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => explicitSave("draft")}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Save draft
          </Button>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => publishWithChecklist("scheduled")}>
            <Clock className="w-3.5 h-3.5 mr-1.5" /> Schedule
          </Button>
          <Button size="sm" disabled={saving} onClick={() => publishWithChecklist("published")}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
            Publish
          </Button>
        </div>
      </div>

      <h2 className="text-lg font-semibold">{id == null ? "New post" : "Edit post"}</h2>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {showHistory && postId != null && (
        <RevisionHistory
          postId={postId}
          onRestored={(p) => {
            setDraft(postToDraft(p));
            setShowHistory(false);
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="How to write a landing page that converts"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Slug <span className="text-muted-foreground">(leave blank to auto-generate from title)</span></Label>
            <Input
              value={draft.slug}
              onChange={(e) => update({ slug: e.target.value })}
              placeholder="how-to-write-a-landing-page-that-converts"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Excerpt <span className="text-muted-foreground">(card dek + meta description fallback)</span></Label>
            <Textarea
              rows={2}
              value={draft.excerpt}
              onChange={(e) => update({ excerpt: e.target.value })}
              placeholder="A short, scannable summary that leads with the answer."
            />
          </div>
          <BodyField value={draft.body} onChange={(html) => update({ body: html })} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Pre-publish checklist */}
          <Checklist checklist={checklist} />

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Schedule</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Publish date/time <span className="text-muted-foreground">(local)</span></Label>
              <Input
                type="datetime-local"
                value={isoToLocalInput(draft.scheduledAt)}
                onChange={(e) => update({ scheduledAt: localInputToIso(e.target.value) })}
              />
              <p className="text-[11px] text-muted-foreground">
                Set a future time, then click <strong>Schedule</strong>. The post
                auto-publishes at that time and stays hidden until then.
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Presentation</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Author</Label>
              <Input value={draft.authorName} onChange={(e) => update({ authorName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tags <span className="text-muted-foreground">(comma-separated)</span></Label>
              <Input
                value={draft.tags}
                onChange={(e) => update({ tags: e.target.value })}
                placeholder="landing pages, conversion"
              />
            </div>
            {/* Cover image — reuse the shared ImagePicker (media drawer + upload). */}
            <ImagePicker
              label="Cover image"
              value={draft.coverImageUrl}
              onChange={(url) => update({ coverImageUrl: url })}
              placeholder="Paste a URL, upload, or browse media"
              aiHint="Blog cover image"
              previewClassName="w-full object-cover"
            />
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SEO / GEO</p>
            <div className="space-y-1.5">
              <Label className="text-xs">SEO title <span className="text-muted-foreground">(falls back to title)</span></Label>
              <Input value={draft.seoTitle} onChange={(e) => update({ seoTitle: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Meta description <span className="text-muted-foreground">(falls back to excerpt)</span></Label>
              <Textarea rows={2} value={draft.seoDescription} onChange={(e) => update({ seoDescription: e.target.value })} />
            </div>
          </div>

          {/* Social share card (OG) — image picker + focal point + live preview */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Social share card (OG)</p>
            <ImagePicker
              label="OG image (falls back to cover)"
              value={draft.ogImageUrl}
              onChange={(url) => update({ ogImageUrl: url })}
              placeholder="1200×630 share image — paste, upload, or browse"
              aiHint="Social share card image, 1200x630"
              previewClassName="w-full object-cover"
            />
            <FocalPointPicker
              label="Crop focal point (for the 1200×630 share card)"
              value={focalPxObjectPos(draft.ogFocalX, draft.ogFocalY)}
              previewUrl={ogPreviewImage || undefined}
              onChange={(pos) => {
                const f = objectPositionToFocal(pos);
                update({ ogFocalX: f.x, ogFocalY: f.y });
              }}
            />
            <div className="space-y-1.5">
              <Label className="text-xs">Share preview</Label>
              <SocialCardPreview
                imageUrl={ogPreviewImage}
                focalX={draft.ogFocalX}
                focalY={draft.ogFocalY}
                title={draft.seoTitle.trim() || draft.title}
                excerpt={draft.seoDescription.trim() || draft.excerpt}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// FocalPointPicker speaks "X% Y%"; bridge from our 0–1 focal store.
function focalPxObjectPos(x: number, y: number): string {
  return focalToObjectPosition(x, y);
}

function SaveIndicator({ state, lastSavedAt }: { state: SaveState; lastSavedAt: string | null }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
        <AlertTriangle className="w-3 h-3" /> Save failed
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
        <CheckCircle2 className="w-3 h-3" /> Saved{lastSavedAt ? ` ${fmtDateTime(lastSavedAt).split(", ").slice(-1)[0]}` : ""}
      </span>
    );
  }
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Circle className="w-2.5 h-2.5" /> Autosave on</span>;
}

function Checklist({ checklist }: { checklist: { items: { key: string; label: string; ok: boolean }[]; ok: boolean } }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pre-publish checklist</p>
        {checklist.ok ? (
          <span className="text-[11px] text-green-600 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Ready</span>
        ) : (
          <span className="text-[11px] text-amber-600 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Incomplete</span>
        )}
      </div>
      <ul className="space-y-1">
        {checklist.items.map((i) => (
          <li key={i.key} className="flex items-center gap-2 text-xs">
            {i.ok ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            <span className={i.ok ? "text-foreground" : "text-muted-foreground"}>{i.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RevisionHistory({
  postId, onRestored,
}: { postId: number; onRestored: (p: Post) => void }) {
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch(`/api/admin/blog/posts/${postId}/revisions`);
      setRevisions(data?.revisions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
      setRevisions([]);
    }
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  const restore = async (revId: number) => {
    if (!window.confirm("Restore this version? Your current content is saved as a new revision first, so this is undoable.")) return;
    setRestoringId(revId);
    try {
      const data = await apiFetch(`/api/admin/blog/posts/${postId}/revisions/${revId}/restore`, { method: "POST" });
      if (data?.post) onRestored(data.post as Post);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restore");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Revision history</p>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={load}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {revisions === null ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : revisions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No revisions yet.</p>
      ) : (
        <ul className="divide-y max-h-64 overflow-auto">
          {revisions.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
              <div className="min-w-0">
                <span className="font-medium capitalize">{r.reason}</span>
                <span className="text-muted-foreground"> · {fmtDateTime(r.createdAt)}</span>
                {r.authorEmail && <span className="text-muted-foreground"> · {r.authorEmail}</span>}
                <div className="text-muted-foreground truncate">
                  {(r.snapshot?.title as string) || "(untitled)"}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs shrink-0"
                disabled={restoringId === r.id}
                onClick={() => restore(r.id)}
              >
                {restoringId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RotateCcw className="w-3 h-3 mr-1" /> Restore</>}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
