import { useEffect, useState } from "react";
import { Link } from "wouter";
import { fetchBlogIndex, formatDate, absoluteImage, type BlogCard } from "../lib/blog";

// "From the blog" — homepage section surfacing the latest 2-3 published posts.
// Renders nothing until at least one post loads, so the homepage never shows an
// empty shell when the blog has no content yet (or the API is unreachable).
export default function FromTheBlog() {
  const [posts, setPosts] = useState<BlogCard[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchBlogIndex({ pageSize: 3 }).then((res) => {
      if (cancelled || !res) return;
      setPosts(res.posts.slice(0, 3));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (posts.length === 0) return null;

  return (
    <section id="blog" className="px-6 py-20 md:py-28" style={{ background: "var(--cream)" }}>
      <div className="max-w-[1180px] mx-auto">
        <div className="flex items-end justify-between gap-6 mb-10 flex-wrap">
          <div className="max-w-[560px]">
            <div className="marker marker-rule mb-5">From the blog</div>
            <h2
              className="font-display"
              style={{
                color: "var(--ink)",
                fontSize: "clamp(30px, 4vw, 44px)",
                lineHeight: 1.08,
                fontWeight: 500,
                letterSpacing: "-0.025em",
              }}
            >
              How to ship better pages, faster.
            </h2>
          </div>
          <Link
            href="/blog"
            className="font-mono uppercase inline-flex items-center gap-1.5 transition-colors shrink-0"
            style={{ color: "var(--ink-mute)", fontSize: 11.5, letterSpacing: "0.14em" }}
          >
            All posts
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => {
            const cover = absoluteImage(post.coverImageUrl);
            const tag = post.tags[0];
            return (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="flex flex-col overflow-hidden transition-all"
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    aspectRatio: "16 / 9",
                    background: cover
                      ? `center/cover no-repeat url("${cover}")`
                      : "var(--cream-2)",
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
                  <h3
                    className="font-display"
                    style={{
                      color: "var(--ink)",
                      fontSize: 19,
                      lineHeight: 1.2,
                      fontWeight: 500,
                      letterSpacing: "-0.015em",
                      marginBottom: 8,
                    }}
                  >
                    {post.title}
                  </h3>
                  <p className="text-[14px] leading-[1.55] flex-1" style={{ color: "var(--ink-soft)" }}>
                    {post.excerpt}
                  </p>
                  <div
                    className="font-mono uppercase mt-4"
                    style={{ color: "var(--ink-faint)", fontSize: 10.5, letterSpacing: "0.12em" }}
                  >
                    {formatDate(post.publishedAt)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
