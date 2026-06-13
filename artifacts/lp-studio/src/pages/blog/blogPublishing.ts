// Pure FE helpers for the blog publishing experience (Phase 2). Dependency-free
// so they can be unit-tested and shared by the editor + previews. Mirrors the
// server-side checklist/focal logic in api-server/src/lib/blog.ts.

/** Map a 0–1 focal point to a CSS object-position string ("X% Y%"). */
export function focalToObjectPosition(x: number, y: number): string {
  const clamp = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5);
  return `${Math.round(clamp(x) * 1000) / 10}% ${Math.round(clamp(y) * 1000) / 10}%`;
}

/** Parse a "X% Y%" object-position back into a 0–1 focal point. */
export function objectPositionToFocal(pos: string): { x: number; y: number } {
  const m = (pos || "").match(/(-?\d+(?:\.\d+)?)\s*%\s+(-?\d+(?:\.\d+)?)\s*%/);
  if (!m) return { x: 0.5, y: 0.5 };
  const clamp = (v: number) => Math.max(0, Math.min(1, v / 100));
  return { x: clamp(parseFloat(m[1])), y: clamp(parseFloat(m[2])) };
}

export interface ChecklistInput {
  title?: string;
  excerpt?: string;
  coverImageUrl?: string;
  ogImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  slug?: string;
  status?: string;
  scheduledAt?: string | null;
}
export interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
}

function nonEmpty(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Pre-publish checklist completeness — one item per requirement plus an `ok`
 * rollup. Identical semantics to the server's prePublishChecklist so the UI
 * warning matches any server-side enforcement.
 */
export function prePublishChecklist(input: ChecklistInput): {
  items: ChecklistItem[];
  ok: boolean;
} {
  const isScheduled = input.status === "scheduled";
  const publishDateOk = isScheduled ? nonEmpty(input.scheduledAt ?? "") : true;
  const items: ChecklistItem[] = [
    { key: "title", label: "Title added", ok: nonEmpty(input.title) },
    { key: "excerpt", label: "Excerpt added", ok: nonEmpty(input.excerpt) },
    { key: "cover", label: "Cover image added", ok: nonEmpty(input.coverImageUrl) },
    {
      key: "og",
      label: "Social (OG) image set",
      ok: nonEmpty(input.ogImageUrl) || nonEmpty(input.coverImageUrl),
    },
    { key: "seoTitle", label: "SEO title set", ok: nonEmpty(input.seoTitle) },
    { key: "seoDescription", label: "Meta description set", ok: nonEmpty(input.seoDescription) },
    { key: "slug", label: "Slug set", ok: nonEmpty(input.slug) },
    { key: "publishDate", label: "Publish date set", ok: publishDateOk },
  ];
  return { items, ok: items.every((i) => i.ok) };
}
