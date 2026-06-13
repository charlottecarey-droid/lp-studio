import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import FinalCta from "../components/FinalCta";
import { usePageMeta } from "../hooks/usePageMeta";
import { usePageJsonLd } from "../hooks/usePageJsonLd";
import {
  fetchBlogIndex,
  buildBlogListLd,
  formatDate,
  absoluteImage,
  type BlogCard,
} from "../lib/blog";

const PAGE_SIZE = 12;

export default function BlogIndex() {
  const [posts, setPosts] = useState<BlogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string>("");

  usePageMeta({
    title: "Blog — LP Studio",
    description:
      "How-to guides on landing pages, brand-consistent design, A/B testing, and AI page generation from the LP Studio team.",
    canonical: "https://lpstudio.ai/blog",
    ogImage: "https://lpstudio.ai/opengraph.jpg",
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageType: "image/jpeg",
    siteName: "LP Studio",
  });
  usePageJsonLd("blog-list", posts.length ? buildBlogListLd(posts) : null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBlogIndex({ pageSize: PAGE_SIZE, tag: activeTag || undefined }).then((res) => {
      if (cancelled) return;
      setPosts(res?.posts ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTag]);

  // Tag chips derived from the loaded posts (only meaningful on the unfiltered
  // list; once filtered we keep the active chip selectable to clear it).
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of posts) for (const t of p.tags) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  return (
    <div className="min-h-screen paper-grain" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <Navbar />
      <main className="max-w-[1180px] mx-auto px-6 pt-36 pb-16">
        {/* Header */}
        <header className="mb-12 max-w-[760px]">
          <div className="marker marker-rule mb-6">01 / The blog</div>
          <h1
            className="font-display"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(40px, 5.5vw, 64px)",
              lineHeight: 1.02,
              fontWeight: 500,
              letterSpacing: "-0.028em",
              marginBottom: 16,
            }}
          >
            Guides for shipping better pages, faster.
          </h1>
          <p className="text-[17px] leading-[1.6]" style={{ color: "var(--ink-soft)" }}>
            Plainspoken how-tos on landing page structure, brand consistency, A/B
            testing, and briefing AI to build on-brand pages. Real mechanics, no
            fluff.
          </p>
        </header>

        {/* Tag filter */}
        {(allTags.length > 0 || activeTag) && (
          <div className="flex flex-wrap items-center gap-2 mb-10">
            <button
              onClick={() => setActiveTag("")}
              className="font-mono uppercase transition-colors"
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid var(--hairline-strong)",
                background: activeTag === "" ? "var(--ink)" : "transparent",
                color: activeTag === "" ? "var(--cream)" : "var(--ink-mute)",
              }}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className="font-mono uppercase transition-colors"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--hairline-strong)",
                  background: activeTag === tag ? "var(--ink)" : "transparent",
                  color: activeTag === tag ? "var(--cream)" : "var(--ink-mute)",
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <p className="text-[14px]" style={{ color: "var(--ink-mute)" }}>
            Loading posts…
          </p>
        ) : posts.length === 0 ? (
          <div
            className="rounded-xl px-6 py-16 text-center"
            style={{ border: "1px dashed var(--hairline-strong)", color: "var(--ink-mute)" }}
          >
            No posts yet. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </main>
      <FinalCta />
      <Footer />
    </div>
  );
}

function PostCard({ post }: { post: BlogCard }) {
  const cover = absoluteImage(post.coverImageUrl);
  const tag = post.tags[0];
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden transition-all"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        borderRadius: 14,
      }}
    >
      <div
        style={{
          aspectRatio: "16 / 9",
          background: cover ? `center/cover no-repeat url("${cover}")` : "var(--cream-2)",
          borderBottom: "1px solid var(--hairline)",
        }}
        aria-hidden={!cover}
      />
      <div className="flex flex-col flex-1 p-5">
        <div
          className="font-mono uppercase flex items-center gap-2 mb-3"
          style={{ color: "var(--ink-mute)", fontSize: 10.5, letterSpacing: "0.14em" }}
        >
          {tag && <span style={{ color: "var(--indigo)" }}>{tag}</span>}
          {tag && <span style={{ color: "var(--ink-faint)" }}>·</span>}
          <span>{post.readingTimeMin} min read</span>
        </div>
        <h2
          className="font-display"
          style={{
            color: "var(--ink)",
            fontSize: 20,
            lineHeight: 1.2,
            fontWeight: 500,
            letterSpacing: "-0.015em",
            marginBottom: 8,
          }}
        >
          {post.title}
        </h2>
        <p
          className="text-[14px] leading-[1.55] flex-1"
          style={{ color: "var(--ink-soft)" }}
        >
          {post.excerpt}
        </p>
        <div
          className="font-mono uppercase mt-4 pt-3"
          style={{
            color: "var(--ink-faint)",
            fontSize: 10.5,
            letterSpacing: "0.12em",
            borderTop: "1px solid var(--hairline)",
          }}
        >
          {formatDate(post.publishedAt)}
        </div>
      </div>
    </Link>
  );
}
