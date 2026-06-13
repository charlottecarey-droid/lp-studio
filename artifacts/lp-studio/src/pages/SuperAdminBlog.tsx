import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  History, RotateCcw, Circle, Sparkles, Wand2, X,
  Calendar, Settings, ListChecks, ShieldAlert, ThumbsUp, ThumbsDown,
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

// ── Phase 3: AI-assisted publishing ──────────────────────────────────────────
// Every AI output below lands in an editable field and is NEVER auto-saved or
// auto-published — the author accepts / regenerates / edits it. The endpoints
// reuse the app's OpenAI client + LP Studio brand-voice/strict-facts grounding
// and are superadmin-gated + rate-limited server-side.

// Maps a Draft field → the metadata field name the AI endpoint returns.
type AiMetaField =
  | "seoTitle" | "metaDescription" | "slug" | "excerpt"
  | "ogTitle" | "ogDescription" | "coverImagePrompt";

interface AiMetadataResponse {
  metadata: Partial<Record<AiMetaField, string>>;
  fields: AiMetaField[];
}

// Call the metadata endpoint for a subset of fields (or all). `improve` sharpens
// the existing values rather than starting fresh.
async function aiGenerateMetadata(args: {
  title: string;
  body: string;
  targetKeyword?: string;
  fields: AiMetaField[] | "all";
  improve?: boolean;
  existing?: Partial<Record<AiMetaField, string>>;
}): Promise<Partial<Record<AiMetaField, string>>> {
  const data: AiMetadataResponse = await apiFetch("/api/admin/blog/ai/metadata", {
    method: "POST",
    body: JSON.stringify({
      title: args.title,
      body: args.body,
      targetKeyword: args.targetKeyword || undefined,
      fields: args.fields,
      improve: args.improve === true,
      existing: args.existing,
    }),
  });
  return data.metadata ?? {};
}

// A subtle "AI" affordance button placed next to a field. Generates (or
// improves) just that field. Shows a spinner while running.
function AiFieldButton({
  title, body, targetKeyword, field, hasValue, onResult,
}: {
  title: string;
  body: string;
  targetKeyword: string;
  field: AiMetaField;
  hasValue: boolean;
  onResult: (value: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const meta = await aiGenerateMetadata({
        title, body, targetKeyword, fields: [field], improve: hasValue,
      });
      const v = meta[field];
      if (typeof v === "string" && v) onResult(v);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy || (!title.trim() && !body.trim())}
      title={hasValue ? "Improve with AI" : "Generate with AI"}
      className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      {err ? <span className="text-destructive">{err}</span> : (hasValue ? "Improve" : "AI")}
    </button>
  );
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

// Top-level tab switcher: the post authoring experience (Phases 1–3) and the
// Phase-4 Content Program (themes, program settings, topic queue, calendar).
export default function SuperAdminBlog() {
  const [tab, setTab] = useState<"posts" | "program">("posts");
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border bg-muted/30 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setTab("posts")}
          className={`px-3 py-1.5 rounded ${tab === "posts" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
        >
          Posts
        </button>
        <button
          type="button"
          onClick={() => setTab("program")}
          className={`px-3 py-1.5 rounded inline-flex items-center gap-1.5 ${tab === "program" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Content program
        </button>
      </div>
      {tab === "posts" ? <BlogPostsTab /> : <ContentProgramTab />}
    </div>
  );
}

function BlogPostsTab() {
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
  // Phase 3 AI helpers (editor-local; not persisted as post columns):
  //  - targetKeyword: optional SEO keyword that biases metadata + draft gen.
  //  - coverImagePrompt: AI-suggested image direction the author can copy.
  //  - aiAllBusy / aiAllErr: state for the "Generate all metadata" button.
  const [targetKeyword, setTargetKeyword] = useState("");
  const [coverImagePrompt, setCoverImagePrompt] = useState("");
  const [aiAllBusy, setAiAllBusy] = useState(false);
  const [aiAllErr, setAiAllErr] = useState<string | null>(null);
  const [showDraftGen, setShowDraftGen] = useState(false);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  // Generate ALL metadata fields at once. Lands every value in its field +
  // the cover-image prompt in its box; nothing is saved/published.
  const generateAllMetadata = async () => {
    setAiAllBusy(true);
    setAiAllErr(null);
    try {
      const meta = await aiGenerateMetadata({
        title: draftRef.current.title,
        body: draftRef.current.body,
        targetKeyword,
        fields: "all",
      });
      update({
        seoTitle: meta.seoTitle ?? draftRef.current.seoTitle,
        seoDescription: meta.metaDescription ?? draftRef.current.seoDescription,
        slug: meta.slug || draftRef.current.slug,
        excerpt: meta.excerpt ?? draftRef.current.excerpt,
      });
      if (meta.coverImagePrompt) setCoverImagePrompt(meta.coverImagePrompt);
    } catch (e) {
      setAiAllErr(e instanceof Error ? e.message : "AI failed");
    } finally {
      setAiAllBusy(false);
    }
  };

  // Accept a generated full draft into the editor (title, body, metadata).
  const applyGeneratedDraft = (d: {
    title: string;
    bodyHtml: string;
    metadata: Partial<Record<AiMetaField, string>>;
    droppedTags: string[];
  }) => {
    update({
      title: d.title || draftRef.current.title,
      body: d.bodyHtml,
      seoTitle: d.metadata.seoTitle ?? "",
      seoDescription: d.metadata.metaDescription ?? "",
      slug: d.metadata.slug || draftRef.current.slug,
      excerpt: d.metadata.excerpt ?? "",
    });
    if (d.metadata.coverImagePrompt) setCoverImagePrompt(d.metadata.coverImagePrompt);
    setShowDraftGen(false);
  };

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
          <Button size="sm" variant="outline" onClick={() => setShowDraftGen(true)}>
            <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Generate draft
          </Button>
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

      {showDraftGen && (
        <DraftGenPanel
          initialKeyword={targetKeyword}
          onClose={() => setShowDraftGen(false)}
          onApply={applyGeneratedDraft}
          onKeyword={(k) => setTargetKeyword(k)}
        />
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
            <div className="flex items-center justify-between">
              <Label className="text-xs">Slug <span className="text-muted-foreground">(leave blank to auto-generate from title)</span></Label>
              <AiFieldButton title={draft.title} body={draft.body} targetKeyword={targetKeyword} field="slug" hasValue={!!draft.slug.trim()} onResult={(v) => update({ slug: v })} />
            </div>
            <Input
              value={draft.slug}
              onChange={(e) => update({ slug: e.target.value })}
              placeholder="how-to-write-a-landing-page-that-converts"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Excerpt <span className="text-muted-foreground">(card dek + meta description fallback)</span></Label>
              <AiFieldButton title={draft.title} body={draft.body} targetKeyword={targetKeyword} field="excerpt" hasValue={!!draft.excerpt.trim()} onResult={(v) => update({ excerpt: v })} />
            </div>
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
              aiHint={coverImagePrompt || "Blog cover image"}
              previewClassName="w-full object-cover"
            />
            {/* AI-suggested cover image PROMPT — a text direction the author can
                copy into image gen / hand to a designer. Not a post field. */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Cover image prompt <span className="text-muted-foreground">(AI direction)</span></Label>
                <AiFieldButton title={draft.title} body={draft.body} targetKeyword={targetKeyword} field="coverImagePrompt" hasValue={!!coverImagePrompt.trim()} onResult={setCoverImagePrompt} />
              </div>
              <Textarea
                rows={3}
                value={coverImagePrompt}
                onChange={(e) => setCoverImagePrompt(e.target.value)}
                placeholder="Click AI to generate an on-brand image direction to paste into image gen."
                className="text-[13px]"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SEO / GEO</p>
              <button
                type="button"
                onClick={generateAllMetadata}
                disabled={aiAllBusy || (!draft.title.trim() && !draft.body.trim())}
                title="Generate every field from the title + body"
                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {aiAllBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Generate all
              </button>
            </div>
            {aiAllErr && <p className="text-[11px] text-destructive">{aiAllErr}</p>}
            <p className="text-[11px] text-muted-foreground -mt-1">
              AI uses LP Studio's brand voice + strict facts. Every field stays editable — nothing is saved until you do.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Target keyword <span className="text-muted-foreground">(optional — biases AI)</span></Label>
              <Input
                value={targetKeyword}
                onChange={(e) => setTargetKeyword(e.target.value)}
                placeholder="ai landing page builder"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">SEO title <span className="text-muted-foreground">(falls back to title)</span></Label>
                <AiFieldButton title={draft.title} body={draft.body} targetKeyword={targetKeyword} field="seoTitle" hasValue={!!draft.seoTitle.trim()} onResult={(v) => update({ seoTitle: v })} />
              </div>
              <Input value={draft.seoTitle} onChange={(e) => update({ seoTitle: e.target.value })} />
              <p className="text-[10px] text-muted-foreground text-right">{draft.seoTitle.length}/60</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Meta description <span className="text-muted-foreground">(falls back to excerpt)</span></Label>
                <AiFieldButton title={draft.title} body={draft.body} targetKeyword={targetKeyword} field="metaDescription" hasValue={!!draft.seoDescription.trim()} onResult={(v) => update({ seoDescription: v })} />
              </div>
              <Textarea rows={2} value={draft.seoDescription} onChange={(e) => update({ seoDescription: e.target.value })} />
              <p className="text-[10px] text-muted-foreground text-right">{draft.seoDescription.length}/155</p>
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

// ── Generate-draft flow ──────────────────────────────────────────────────────
// A modal panel: the author gives a brief (topic, audience, target keyword,
// notes); the AI returns an OUTLINE (H2/H3) shown first for quick review/edit;
// then a FULL DRAFT (clean semantic HTML, server-sanitized) + metadata. The
// generated content drops into the editor (Tiptap body + fields) and stays
// fully editable — it is NEVER auto-published.

interface OutlineSection {
  h2: string;
  h3?: string[];
}
interface Outline {
  title: string;
  sections: OutlineSection[];
}

function DraftGenPanel({
  initialKeyword, onClose, onApply, onKeyword,
}: {
  initialKeyword: string;
  onClose: () => void;
  onApply: (d: {
    title: string;
    bodyHtml: string;
    metadata: Partial<Record<AiMetaField, string>>;
    droppedTags: string[];
  }) => void;
  onKeyword: (k: string) => void;
}) {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [keyword, setKeyword] = useState(initialKeyword);
  const [notes, setNotes] = useState("");
  const [outline, setOutline] = useState<Outline | null>(null);
  const [phase, setPhase] = useState<"brief" | "outline">("brief");
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [error, setError] = useState<string | null>(null);

  const brief = () => ({
    topic: topic.trim(),
    audience: audience.trim() || undefined,
    targetKeyword: keyword.trim() || undefined,
    notes: notes.trim() || undefined,
  });

  const genOutline = async () => {
    if (!topic.trim()) { setError("A topic is required."); return; }
    setBusy(true); setBusyMsg("Drafting an outline…"); setError(null);
    onKeyword(keyword.trim());
    try {
      const data = await apiFetch("/api/admin/blog/ai/outline", {
        method: "POST",
        body: JSON.stringify(brief()),
      });
      setOutline(data.outline as Outline);
      setPhase("outline");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate outline");
    } finally {
      setBusy(false);
    }
  };

  const genDraft = async () => {
    setBusy(true); setBusyMsg("Writing the full draft…"); setError(null);
    try {
      const data = await apiFetch("/api/admin/blog/ai/draft", {
        method: "POST",
        body: JSON.stringify({ ...brief(), outline }),
      });
      onApply({
        title: String(data.title ?? ""),
        bodyHtml: String(data.bodyHtml ?? ""),
        metadata: (data.metadata ?? {}) as Partial<Record<AiMetaField, string>>,
        droppedTags: Array.isArray(data.droppedTags) ? data.droppedTags : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate draft");
      setBusy(false);
    }
  };

  const updateH2 = (i: number, v: string) =>
    setOutline((o) => o && { ...o, sections: o.sections.map((s, idx) => idx === i ? { ...s, h2: v } : s) });
  const removeSection = (i: number) =>
    setOutline((o) => o && { ...o, sections: o.sections.filter((_, idx) => idx !== i) });
  const addSection = () =>
    setOutline((o) => o && { ...o, sections: [...o.sections, { h2: "" }] });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-background rounded-lg border shadow-xl w-full max-w-2xl max-h-[88vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-background">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-indigo-600" /> Generate draft
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {phase === "brief" && (
            <>
              <p className="text-xs text-muted-foreground">
                The AI writes in LP Studio's voice with strict facts (no invented stats or fake logos).
                You'll review the outline before the full draft, and everything stays editable — nothing publishes automatically.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Topic <span className="text-destructive">*</span></Label>
                <Textarea rows={2} value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="What the post should cover, e.g. how to write a landing page that converts" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Audience</Label>
                  <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="founders, marketers…" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Target keyword(s)</Label>
                  <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="ai landing page builder" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes / guidance <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any angle, facts to include, must-mention points…" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
                <Button size="sm" onClick={genOutline} disabled={busy || !topic.trim()}>
                  {busy ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {busyMsg}</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate outline</>}
                </Button>
              </div>
            </>
          )}

          {phase === "outline" && outline && (
            <>
              <p className="text-xs text-muted-foreground">
                Review and edit the outline, then generate the full draft. Remove or rename sections as needed.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Working title</Label>
                <Input value={outline.title} onChange={(e) => setOutline({ ...outline, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Sections (H2)</Label>
                {outline.sections.map((s, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Input value={s.h2} onChange={(e) => updateH2(i, e.target.value)} className="text-sm" />
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeSection(i)} title="Remove section">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {s.h3 && s.h3.length > 0 && (
                      <ul className="pl-4 text-[11px] text-muted-foreground list-disc">
                        {s.h3.map((h, j) => <li key={j}>{h}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addSection}>
                  <Plus className="w-3 h-3 mr-1" /> Add section
                </Button>
              </div>
              <div className="flex justify-between gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setPhase("brief")} disabled={busy}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to brief
                </Button>
                <Button size="sm" onClick={genDraft} disabled={busy || outline.sections.length === 0}>
                  {busy ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {busyMsg}</> : <><Wand2 className="w-3.5 h-3.5 mr-1.5" /> Generate full draft</>}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
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

// ── Phase 4: Content Program ─────────────────────────────────────────────────
// Themes manager + program settings (mode toggle + cadence + guardrails +
// autopublish) + topic queue (approve/reject/generate) + publishing calendar.
// Oversight is made obvious + safe: REVIEW mode is the default, autopublish is
// OFF by default and carries a clear warning, and the autonomous pipeline only
// ever acts on PRE-APPROVED topics within the guardrails set here.

interface ProgramSettingsApi {
  mode: "review" | "autonomous";
  postsPerWeek: number;
  targetBacklogDays: number;
  publishDays: number[];
  publishHour: number;
  maxAutonomousPerWeek: number;
  autopublishEnabled: boolean;
  defaultThemeId: number | null;
}
interface ThemeApi {
  id: number; name: string; description: string; priority: number;
  targetKeywords: string[]; audience: string; active: boolean;
}
interface TopicApi {
  id: number; themeId: number | null; title: string; angle: string;
  targetKeyword: string; status: string; source: string; rationale: string;
  postId: number | null; createdAt: string | null;
}
interface CalendarItemApi { id: number; title: string; slug: string; scheduledAt: string | null; topicId: number | null; }

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ContentProgramTab() {
  const [settings, setSettings] = useState<ProgramSettingsApi | null>(null);
  const [themes, setThemes] = useState<ThemeApi[]>([]);
  const [topics, setTopics] = useState<TopicApi[]>([]);
  const [calendar, setCalendar] = useState<CalendarItemApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t, tp, c] = await Promise.all([
        apiFetch("/api/admin/blog/program/settings"),
        apiFetch("/api/admin/blog/program/themes"),
        apiFetch("/api/admin/blog/program/topics"),
        apiFetch("/api/admin/blog/program/calendar"),
      ]);
      setSettings(s.settings);
      setThemes(t.themes ?? []);
      setTopics(tp.topics ?? []);
      setCalendar(c.calendar ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load program");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const saveSettings = useCallback(async (next: ProgramSettingsApi) => {
    setBusy("settings");
    try {
      const res = await apiFetch("/api/admin/blog/program/settings", { method: "PUT", body: JSON.stringify(next) });
      setSettings(res.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally { setBusy(null); }
  }, []);

  const recommend = useCallback(async () => {
    setBusy("recommend");
    try {
      await apiFetch("/api/admin/blog/program/topics/recommend", { method: "POST", body: JSON.stringify({ count: 5 }) });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to recommend topics");
    } finally { setBusy(null); }
  }, [loadAll]);

  const decide = useCallback(async (id: number, decision: "approve" | "reject") => {
    setBusy(`decide-${id}`);
    try {
      await apiFetch(`/api/admin/blog/program/topics/${id}/decision`, { method: "POST", body: JSON.stringify({ decision }) });
      await loadAll();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  }, [loadAll]);

  const generate = useCallback(async (id: number) => {
    setBusy(`gen-${id}`);
    try {
      await apiFetch(`/api/admin/blog/program/topics/${id}/generate`, { method: "POST", body: JSON.stringify({}) });
      await loadAll();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to generate draft"); } finally { setBusy(null); }
  }, [loadAll]);

  const scheduleAll = useCallback(async () => {
    setBusy("schedule");
    try {
      await apiFetch("/api/admin/blog/program/schedule", { method: "POST", body: JSON.stringify({}) });
      await loadAll();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to schedule"); } finally { setBusy(null); }
  }, [loadAll]);

  if (loading && !settings) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const suggested = topics.filter((t) => t.status === "suggested");
  const approved = topics.filter((t) => t.status === "approved" || t.status === "drafting");
  const drafted = topics.filter((t) => t.status === "drafted");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Content program</h2>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Keep a 30–90 day publishing backlog full with minimal manual work. Define themes,
            let AI recommend topics, approve the ones worth pursuing, and generate + schedule
            drafts. Editorial oversight stays with you by default.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadAll} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Reload
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {settings && <ProgramSettingsCard settings={settings} themes={themes} onSave={saveSettings} saving={busy === "settings"} />}

      <ThemesCard themes={themes} onChanged={loadAll} />

      {/* Topic queue */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h3 className="text-sm font-semibold inline-flex items-center gap-1.5"><ListChecks className="w-4 h-4" /> Topic queue</h3>
          <Button size="sm" onClick={recommend} disabled={busy === "recommend"}>
            {busy === "recommend" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
            Recommend topics
          </Button>
        </div>
        <div className="p-4 space-y-4">
          <TopicGroup label="Suggested — approve to pursue" topics={suggested} themes={themes} busy={busy}
            actions={(t) => (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy === `decide-${t.id}`} onClick={() => decide(t.id, "approve")}>
                  <ThumbsUp className="w-3 h-3 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" disabled={busy === `decide-${t.id}`} onClick={() => decide(t.id, "reject")}>
                  <ThumbsDown className="w-3 h-3 mr-1" /> Reject
                </Button>
              </>
            )} />
          <TopicGroup label="Approved — generate a draft" topics={approved} themes={themes} busy={busy}
            actions={(t) => (
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy === `gen-${t.id}` || t.status === "drafting"} onClick={() => generate(t.id)}>
                {busy === `gen-${t.id}` || t.status === "drafting" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />}
                Generate draft
              </Button>
            )} />
          <TopicGroup label="Drafted — ready to schedule / review" topics={drafted} themes={themes} busy={busy} actions={() => null} />
          {topics.length === 0 && <p className="text-sm text-muted-foreground">No topics yet. Add themes, then click Recommend topics.</p>}
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h3 className="text-sm font-semibold inline-flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Publishing calendar</h3>
          <Button size="sm" variant="outline" onClick={scheduleAll} disabled={busy === "schedule"}>
            {busy === "schedule" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Clock className="w-3.5 h-3.5 mr-1.5" />}
            Schedule drafted posts
          </Button>
        </div>
        <div className="p-4">
          {calendar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled yet. Generate drafts from approved topics, then schedule them.</p>
          ) : (
            <ul className="divide-y text-sm">
              {calendar.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.title}</div>
                    <div className="text-xs text-muted-foreground">/{c.slug}{c.topicId ? " · from topic (autonomous)" : ""}</div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgramSettingsCard({ settings, themes, onSave, saving }: {
  settings: ProgramSettingsApi; themes: ThemeApi[];
  onSave: (s: ProgramSettingsApi) => void; saving: boolean;
}) {
  const [draft, setDraft] = useState<ProgramSettingsApi>(settings);
  useEffect(() => setDraft(settings), [settings]);
  const set = (patch: Partial<ProgramSettingsApi>) => setDraft((d) => ({ ...d, ...patch }));
  const toggleDay = (d: number) =>
    set({ publishDays: draft.publishDays.includes(d) ? draft.publishDays.filter((x) => x !== d) : [...draft.publishDays, d].sort((a, b) => a - b) });
  const autonomous = draft.mode === "autonomous";

  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-3"><h3 className="text-sm font-semibold inline-flex items-center gap-1.5"><Settings className="w-4 h-4" /> Program settings &amp; guardrails</h3></div>
      <div className="p-4 space-y-4">
        {/* Mode toggle */}
        <div>
          <Label className="text-xs">Mode</Label>
          <div className="mt-1 inline-flex rounded-md border bg-muted/30 p-0.5 text-sm">
            <button type="button" onClick={() => set({ mode: "review" })}
              className={`px-3 py-1.5 rounded ${!autonomous ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
              Review before publish
            </button>
            <button type="button" onClick={() => set({ mode: "autonomous" })}
              className={`px-3 py-1.5 rounded ${autonomous ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
              Autonomous
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {autonomous
              ? "AI generates, quality-checks, and schedules drafts from your APPROVED topics within the guardrails below. It never invents-and-publishes."
              : "Safest. AI only suggests topics for you to approve; you generate, review, and publish everything manually."}
          </p>
        </div>

        {/* Autopublish — the strongest gate, off by default, warned. */}
        <div className={`rounded-md border p-3 ${draft.autopublishEnabled ? "border-amber-400 bg-amber-50/60" : "bg-muted/20"}`}>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={draft.autopublishEnabled} onChange={(e) => set({ autopublishEnabled: e.target.checked })} />
            <span className="text-sm">
              <span className="font-medium inline-flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Auto-publish scheduled posts</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {draft.autopublishEnabled
                  ? "ON — autonomously-scheduled posts go LIVE automatically when due. Posts you schedule by hand always publish on time regardless."
                  : "OFF (recommended). Autonomously-scheduled posts wait as 'scheduled' for you to flip them live. Off by default for safety."}
              </span>
            </span>
          </label>
        </div>

        {/* Cadence + guardrails */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <Label className="text-xs">Posts / week</Label>
            <Input type="number" min={1} max={14} value={draft.postsPerWeek} onChange={(e) => set({ postsPerWeek: Number(e.target.value) })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Backlog days (30–90)</Label>
            <Input type="number" min={30} max={90} value={draft.targetBacklogDays} onChange={(e) => set({ targetBacklogDays: Number(e.target.value) })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Max autonomous / week</Label>
            <Input type="number" min={0} max={14} value={draft.maxAutonomousPerWeek} onChange={(e) => set({ maxAutonomousPerWeek: Number(e.target.value) })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Publish hour (0–23)</Label>
            <Input type="number" min={0} max={23} value={draft.publishHour} onChange={(e) => set({ publishHour: Number(e.target.value) })} className="mt-1" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Publish days</Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => (
              <button key={d} type="button" onClick={() => toggleDay(i)}
                className={`px-2.5 py-1 rounded text-xs border ${draft.publishDays.includes(i) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"}`}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs">Default theme weighting (optional)</Label>
          <select className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={draft.defaultThemeId ?? ""} onChange={(e) => set({ defaultThemeId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">None</option>
            {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => onSave(draft)} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
            Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}

function ThemesCard({ themes, onChanged }: { themes: ThemeApi[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await apiFetch("/api/admin/blog/program/themes", { method: "POST", body: JSON.stringify({ name, targetKeywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) }) });
      setName(""); setKeywords(""); setAdding(false); onChanged();
    } finally { setBusy(false); }
  };
  const remove = async (id: number) => {
    await apiFetch(`/api/admin/blog/program/themes/${id}`, { method: "DELETE" });
    onChanged();
  };

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="text-sm font-semibold inline-flex items-center gap-1.5"><FileText className="w-4 h-4" /> Themes</h3>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}><Plus className="w-3.5 h-3.5 mr-1.5" /> Add theme</Button>
      </div>
      <div className="p-4 space-y-3">
        {adding && (
          <div className="rounded-md border bg-muted/20 p-3 space-y-2">
            <Input placeholder="Theme name (e.g. GEO for B2B SaaS)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Target keywords, comma-separated" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" onClick={add} disabled={busy || !name.trim()}>Add</Button>
            </div>
          </div>
        )}
        {themes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No themes yet. Add a content pillar to ground topic recommendations.</p>
        ) : (
          <ul className="divide-y text-sm">
            {themes.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    {t.name}
                    {!t.active && <span className="text-xs text-muted-foreground">(inactive)</span>}
                    <span className="text-xs rounded bg-muted px-1.5 py-0.5 text-muted-foreground">P{t.priority}</span>
                  </div>
                  {t.targetKeywords.length > 0 && <div className="text-xs text-muted-foreground truncate">{t.targetKeywords.join(", ")}</div>}
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground shrink-0" onClick={() => remove(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TopicGroup({ label, topics, themes, busy, actions }: {
  label: string; topics: TopicApi[]; themes: ThemeApi[]; busy: string | null;
  actions: (t: TopicApi) => ReactNode;
}) {
  if (topics.length === 0) return null;
  const themeName = (id: number | null) => themes.find((t) => t.id === id)?.name;
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{label} ({topics.length})</div>
      <ul className="divide-y rounded-md border">
        {topics.map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <div className="font-medium text-sm">{t.title}</div>
              {t.rationale && <div className="text-xs text-muted-foreground mt-0.5">{t.rationale}</div>}
              <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                {t.targetKeyword && <span>kw: {t.targetKeyword}</span>}
                {themeName(t.themeId) && <span>· {themeName(t.themeId)}</span>}
                <span>· {t.source === "ai" ? "AI" : "manual"}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">{actions(t)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
