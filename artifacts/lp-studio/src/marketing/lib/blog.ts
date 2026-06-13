/**
 * Marketing-side blog data layer + JSON-LD builders.
 *
 * The public blog API is served by the api-server under app.lpstudio.ai/api/lp/
 * blog/* (same origin pattern the rest of the marketing components use — see
 * TemplatesEmbed). Posts are read with credentials: "omit" (CORS-open public
 * endpoints). The pure JSON-LD builders (buildBlogPostingLd / buildBlogListLd)
 * are dependency-free so they can be unit-tested.
 */

// The api-server origin. Same constant the marketing components use to read
// other public superadmin-config endpoints cross-origin from the apex.
export const APP_BASE = "https://app.lpstudio.ai";
// The public apex where posts are rendered — used for canonical + JSON-LD URLs.
export const BLOG_PUBLIC_BASE = "https://lpstudio.ai";

const PUBLISHER = {
  "@type": "Organization",
  name: "LP Studio",
  url: BLOG_PUBLIC_BASE,
  logo: {
    "@type": "ImageObject",
    url: `${BLOG_PUBLIC_BASE}/lpstudio-icon.svg`,
  },
} as const;

export interface BlogCard {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  authorName: string;
  tags: string[];
  readingTimeMin: number;
  publishedAt: string | null;
}

export interface BlogPostFull extends BlogCard {
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  // OG/social-card focal point (0–1). Maps to CSS object-position so the
  // 1200×630 share crop frames the subject. Phase 2.
  ogFocalX?: number;
  ogFocalY?: number;
  updatedAt: string | null;
  // Present only on preview fetches — the raw status so the renderer can show
  // a "Preview · draft/scheduled" ribbon.
  status?: string;
}

/** Map a 0–1 focal point to a CSS object-position string ("X% Y%"). */
export function focalToObjectPosition(
  x: number | null | undefined,
  y: number | null | undefined,
): string {
  const clamp = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
  return `${Math.round(clamp(x) * 1000) / 10}% ${Math.round(clamp(y) * 1000) / 10}%`;
}

export interface BlogIndexResponse {
  posts: BlogCard[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/** Absolutize an /api/storage-relative image URL onto the apex for OG/JSON-LD. */
export function absoluteImage(url: string | null | undefined): string | undefined {
  const u = (url ?? "").trim();
  if (!u) return undefined;
  if (/^https?:\/\//i.test(u) || u.startsWith("data:")) return u;
  if (u.startsWith("//")) return `https:${u}`;
  return `${BLOG_PUBLIC_BASE}${u.startsWith("/") ? "" : "/"}${u}`;
}

/** Fetch the published index (CORS-open, no creds). Returns null on failure. */
export async function fetchBlogIndex(opts?: {
  page?: number;
  pageSize?: number;
  tag?: string;
}): Promise<BlogIndexResponse | null> {
  const params = new URLSearchParams();
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts?.tag) params.set("tag", opts.tag);
  const qs = params.toString();
  try {
    const res = await fetch(`${APP_BASE}/api/lp/blog/posts${qs ? `?${qs}` : ""}`, {
      credentials: "omit",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.posts)) return null;
    return data as BlogIndexResponse;
  } catch {
    return null;
  }
}

/** Fetch a single published post by slug. null = not found / not published. */
export async function fetchBlogPost(slug: string): Promise<BlogPostFull | null> {
  try {
    const res = await fetch(`${APP_BASE}/api/lp/blog/posts/${encodeURIComponent(slug)}`, {
      credentials: "omit",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.post) return null;
    return data.post as BlogPostFull;
  } catch {
    return null;
  }
}

/**
 * Fetch ANY post (incl. draft/scheduled) by id using a signed preview token
 * minted by the superadmin editor. Returns null if the token is missing,
 * expired, or invalid — drafts are never reachable without a fresh token.
 */
export async function fetchBlogPreview(
  id: number,
  token: string,
): Promise<BlogPostFull | null> {
  try {
    const res = await fetch(
      `${APP_BASE}/api/lp/blog/preview/${id}?token=${encodeURIComponent(token)}`,
      { credentials: "omit" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.post) return null;
    return data.post as BlogPostFull;
  } catch {
    return null;
  }
}

/**
 * Count words in an HTML blog body (bodies are stored as HTML; legacy markdown
 * noise is still stripped so the count is stable across the migration). Strips
 * inline SVG + code blocks first (they aren't prose), then tags + entities. The
 * BlogPosting JSON-LD wordCount is recomputed from this, so the SEO/GEO payload
 * reflects the rendered text content rather than markup.
 */
export function wordCount(body: string): number {
  const text = (body || "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#>*_`~|]/g, " ");
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Build schema.org BlogPosting JSON-LD for a post page. This is the GEO payload
 * that makes the post citable by AI engines: headline, dates, author,
 * publisher (+logo), image, description, mainEntityOfPage, wordCount.
 */
export function buildBlogPostingLd(post: BlogPostFull): Record<string, unknown> {
  const url = `${BLOG_PUBLIC_BASE}/blog/${post.slug}`;
  const image = absoluteImage(post.ogImageUrl) ?? absoluteImage(post.coverImageUrl);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.seoTitle?.trim() || post.title,
    description: post.seoDescription?.trim() || post.excerpt,
    ...(image ? { image: [image] } : {}),
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt ?? post.publishedAt ?? undefined,
    author: { "@type": "Organization", name: post.authorName || "LP Studio" },
    publisher: PUBLISHER,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    wordCount: wordCount(post.body),
    ...(post.tags.length ? { keywords: post.tags.join(", ") } : {}),
  };
}

/**
 * Build schema.org Blog + ItemList JSON-LD for the index page so AI engines see
 * the full set of posts as a citable collection.
 */
export function buildBlogListLd(posts: BlogCard[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "LP Studio Blog",
    description:
      "How-to guides on landing pages, brand-consistent design, A/B testing, and AI page generation from the LP Studio team.",
    url: `${BLOG_PUBLIC_BASE}/blog`,
    publisher: PUBLISHER,
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.excerpt,
      url: `${BLOG_PUBLIC_BASE}/blog/${p.slug}`,
      datePublished: p.publishedAt ?? undefined,
      author: { "@type": "Organization", name: p.authorName || "LP Studio" },
    })),
  };
}

/** Format an ISO timestamp as "Jun 13, 2026" (UTC, stable for prerender). */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
