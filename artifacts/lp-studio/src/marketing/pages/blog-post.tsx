import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { usePageMeta } from "../hooks/usePageMeta";
import { usePageJsonLd } from "../hooks/usePageJsonLd";
import { sanitizeBlogHtml } from "../lib/sanitizeBlogHtml";
import {
  fetchBlogPost,
  buildBlogPostingLd,
  formatDate,
  absoluteImage,
  type BlogPostFull,
} from "../lib/blog";
import NotFound from "./not-found";

type LoadState = "loading" | "found" | "missing";

export default function BlogPost() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug ?? "";
  const [post, setPost] = useState<BlogPostFull | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setPost(null);
    fetchBlogPost(slug).then((p) => {
      if (cancelled) return;
      if (p) {
        setPost(p);
        setState("found");
      } else {
        setState("missing");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const canonical = `https://lpstudio.ai/blog/${slug}`;
  const ogImage = post
    ? absoluteImage(post.ogImageUrl) ?? absoluteImage(post.coverImageUrl)
    : undefined;

  usePageMeta({
    title: post ? `${post.seoTitle?.trim() || post.title} — LP Studio` : "LP Studio Blog",
    description: post?.seoDescription?.trim() || post?.excerpt || "LP Studio blog.",
    canonical,
    ogType: "article",
    ogImage,
    ogImageWidth: ogImage ? 1200 : undefined,
    ogImageHeight: ogImage ? 630 : undefined,
    ogImageAlt: post?.title,
    siteName: "LP Studio",
  });
  usePageJsonLd("blog-posting", post ? buildBlogPostingLd(post) : null);

  if (state === "missing") return <NotFound />;

  // Bodies are stored as HTML authored by superadmins; ALWAYS re-sanitize on
  // this PUBLIC render — never trust the stored markup.
  const bodyHtml = post ? sanitizeBlogHtml(post.body) : "";
  const tag = post?.tags[0];
  const cover = post ? absoluteImage(post.coverImageUrl) : undefined;

  return (
    <div className="min-h-screen paper-grain" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <Navbar />
      <main className="pt-32 pb-8">
        {state === "loading" && (
          <div className="max-w-[720px] mx-auto px-6 py-20 text-center">
            <p className="text-[14px]" style={{ color: "var(--ink-mute)" }}>
              Loading…
            </p>
          </div>
        )}

        {post && (
          <article className="max-w-[720px] mx-auto px-6">
            {/* Breadcrumb back to index */}
            <Link
              href="/blog"
              className="font-mono uppercase inline-flex items-center gap-1.5 mb-8 transition-colors"
              style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.14em" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              All posts
            </Link>

            {/* Kicker: tag · date · reading time */}
            <div
              className="font-mono uppercase flex flex-wrap items-center gap-2.5 mb-5"
              style={{ color: "var(--ink-mute)", fontSize: 11.5, letterSpacing: "0.14em" }}
            >
              {tag && <span style={{ color: "var(--indigo)" }}>{tag}</span>}
              {tag && <span style={{ color: "var(--ink-faint)" }}>·</span>}
              {post.publishedAt && (
                <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              )}
              <span style={{ color: "var(--ink-faint)" }}>·</span>
              <span>{post.readingTimeMin} min read</span>
            </div>

            {/* Title */}
            <h1
              className="font-display"
              style={{
                color: "var(--ink)",
                fontSize: "clamp(32px, 4.6vw, 50px)",
                lineHeight: 1.06,
                fontWeight: 500,
                letterSpacing: "-0.026em",
                marginBottom: 16,
              }}
            >
              {post.title}
            </h1>

            {/* Excerpt / dek */}
            {post.excerpt && (
              <p
                className="text-[18px] leading-[1.5] mb-7"
                style={{ color: "var(--ink-soft)" }}
              >
                {post.excerpt}
              </p>
            )}

            {/* Byline */}
            <div
              className="text-[13px] mb-8 pb-8"
              style={{ color: "var(--ink-mute)", borderBottom: "1px solid var(--hairline)" }}
            >
              By {post.authorName}
            </div>

            {/* Cover */}
            {cover && (
              <img
                src={cover}
                alt={post.title}
                className="w-full mb-10"
                style={{ borderRadius: 14, border: "1px solid var(--hairline)" }}
                loading="eager"
                decoding="async"
              />
            )}

            {/* Body */}
            <div
              className="lp-blog-prose"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />

            {/* End-of-post CTA */}
            <aside
              className="mt-14 mb-4 p-7 sm:p-9"
              style={{
                background: "var(--paper)",
                border: "1px solid var(--hairline-strong)",
                borderRadius: 16,
              }}
            >
              <div
                className="font-mono uppercase mb-3"
                style={{ color: "var(--indigo)", fontSize: 11, letterSpacing: "0.16em" }}
              >
                Try it yourself
              </div>
              <h2
                className="font-display"
                style={{
                  color: "var(--ink)",
                  fontSize: 26,
                  lineHeight: 1.15,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  marginBottom: 10,
                }}
              >
                Build an on-brand page in minutes.
              </h2>
              <p className="text-[15px] leading-[1.55] mb-6" style={{ color: "var(--ink-soft)" }}>
                Describe what you need, and LP Studio drafts a page that obeys your
                fonts, colors, and voice. Edit any block inline. Publish when it's
                right.
              </p>
              <a
                href="https://app.lpstudio.ai"
                className="inline-flex items-center gap-2 transition-all"
                style={{
                  background: "var(--ink)",
                  color: "var(--cream)",
                  padding: "13px 24px",
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--ink)")}
              >
                Create your workspace
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </a>
            </aside>
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
}
