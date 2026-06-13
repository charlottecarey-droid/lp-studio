import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle, CheckCircle2, Loader2, RefreshCw, Plus, Trash2,
  ExternalLink, Upload, ArrowLeft, Eye, Globe, FileText,
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
  readingTimeMin: number;
  publishedAt: string | null;
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
  };
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
            posts in markdown (inline SVG infographics + images supported). Save a
            draft, then publish when it's ready.
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
                <th className="px-4 py-2 font-medium">Published</th>
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

function PostRow({ post, onEdit, onChanged }: { post: Post; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  const togglePublish = async () => {
    setBusy(true);
    try {
      // Re-send the full post with the flipped status (PUT replaces all fields).
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
      <td className="px-4 py-2.5">
        {post.status === "published" ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
            <Globe className="w-3 h-3" /> Published
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            <FileText className="w-3 h-3" /> Draft
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtDate(post.publishedAt)}</td>
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

function BlogEditor({
  id,
  draft: initial,
  onCancel,
  onSaved,
}: {
  id: number | null;
  draft: Draft;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async (status?: string) => {
    if (!draft.title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = draftToPayload(draft, status);
      if (id == null) {
        await apiFetch("/api/admin/blog/posts", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await apiFetch(`/api/admin/blog/posts/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  };

  // Reuse the existing /api/lp/upload media endpoint (same mechanism the
  // homepage featured-templates thumbnail uploader uses).
  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE}/api/lp/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      const data = await res.json();
      update({ coverImageUrl: `/api/storage${data.url}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cover upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back to posts
        </Button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={saving} onClick={() => save("draft")}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Save draft
          </Button>
          <Button size="sm" disabled={saving} onClick={() => save("published")}>
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
          <div className="space-y-1.5">
            <Label className="text-xs">Body <span className="text-muted-foreground">(markdown — headings, lists, quotes, code, images, inline &lt;svg&gt;)</span></Label>
            <Textarea
              rows={26}
              value={draft.body}
              onChange={(e) => update({ body: e.target.value })}
              placeholder={"## Lead with the answer\n\nFirst two sentences answer the title directly.\n\n- step one\n- step two"}
              className="font-mono text-[13px] leading-[1.6]"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
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
            <div className="space-y-1.5">
              <Label className="text-xs">Cover image</Label>
              <Input
                value={draft.coverImageUrl}
                onChange={(e) => update({ coverImageUrl: e.target.value })}
                placeholder="Paste a URL or upload…"
              />
              <input
                type="file"
                id="blog-cover-upload"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.currentTarget.value = "";
                  void uploadCover(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 w-full"
                disabled={uploading}
                onClick={() => document.getElementById("blog-cover-upload")?.click()}
              >
                {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</> : <><Upload className="w-3.5 h-3.5" /> Upload cover</>}
              </Button>
              {draft.coverImageUrl && (
                <img src={draft.coverImageUrl} alt="" className="w-full rounded border mt-1 object-cover" style={{ aspectRatio: "16/9" }} />
              )}
            </div>
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
            <div className="space-y-1.5">
              <Label className="text-xs">OG image <span className="text-muted-foreground">(falls back to cover)</span></Label>
              <Input value={draft.ogImageUrl} onChange={(e) => update({ ogImageUrl: e.target.value })} placeholder="1200×630 share image URL" />
            </div>
            {id != null && (
              <a
                href={`${PUBLIC_PREFIX}/${draft.slug}${import.meta.env.DEV ? "?preview=marketing" : ""}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Preview <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
