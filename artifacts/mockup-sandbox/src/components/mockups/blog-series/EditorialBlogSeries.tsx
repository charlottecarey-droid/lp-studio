import "./_group.css";
import {
  ArrowUpRight,
  ArrowRight,
  Twitter,
  Linkedin,
  Globe,
  Mail,
  Clock,
  Menu,
} from "lucide-react";

const NAV_LINKS = ["The Series", "Archive", "Topics", "Contributors"];

const TOPICS = [
  { label: "Design", count: 24 },
  { label: "Engineering", count: 31 },
  { label: "Culture", count: 18 },
  { label: "Research", count: 12 },
  { label: "Craft", count: 9 },
  { label: "Field Notes", count: 16 },
];

const FEATURED = {
  category: "Research",
  title: "The slow web: what we lose when everything loads instantly",
  excerpt:
    "Speed became the only metric that mattered. We spent a year studying readers who deliberately chose friction — and found something the analytics never showed us.",
  author: "Mara Velasquez",
  avatar: "/__mockup/images/blog-author-1.png",
  date: "March 4",
  read: "14 min",
  image: "/__mockup/images/blog-featured.png",
};

const POSTS = [
  {
    category: "Design",
    title: "Designing for the second read",
    excerpt:
      "How layout, rhythm, and restraint change what a returning reader notices the next time around.",
    author: "Jonas Auclair",
    avatar: "/__mockup/images/blog-author-2.png",
    date: "Feb 27",
    read: "8 min",
    image: "/__mockup/images/blog-thumb-1.png",
  },
  {
    category: "Engineering",
    title: "Building tools that stay out of the way",
    excerpt:
      "The quiet discipline of subtraction, and why our best feature this quarter was the one we removed.",
    author: "Priya Nair",
    avatar: "/__mockup/images/blog-author-3.png",
    date: "Feb 21",
    read: "11 min",
    image: "/__mockup/images/blog-thumb-2.png",
  },
  {
    category: "Craft",
    title: "Ink, paper, and the case for friction",
    excerpt:
      "A short study of why analog rituals keep returning to the most digital teams we know.",
    author: "Mara Velasquez",
    avatar: "/__mockup/images/blog-author-1.png",
    date: "Feb 14",
    read: "6 min",
    image: "/__mockup/images/blog-thumb-3.png",
  },
  {
    category: "Culture",
    title: "The empty room as a design brief",
    excerpt:
      "What gallery spaces taught us about negative space, attention, and the courage to leave things out.",
    author: "Jonas Auclair",
    avatar: "/__mockup/images/blog-author-2.png",
    date: "Feb 9",
    read: "9 min",
    image: "/__mockup/images/blog-thumb-4.png",
  },
  {
    category: "Field Notes",
    title: "Notes from a month without dashboards",
    excerpt:
      "We turned off the metrics and ran the studio on intuition. Here is what broke, and what didn't.",
    author: "Priya Nair",
    avatar: "/__mockup/images/blog-author-3.png",
    date: "Feb 2",
    read: "7 min",
    image: "/__mockup/images/blog-thumb-5.png",
  },
  {
    category: "Craft",
    title: "Letterpress lessons for the screen",
    excerpt:
      "Constraints of the press, reimagined for typography that has to survive any device.",
    author: "Mara Velasquez",
    avatar: "/__mockup/images/blog-author-1.png",
    date: "Jan 28",
    read: "10 min",
    image: "/__mockup/images/blog-thumb-6.png",
  },
];

const AUTHORS = [
  {
    name: "Mara Velasquez",
    role: "Editor in Chief",
    bio: "Writes about attention, craft, and the slow web. Previously design editor at a publication you've probably read on a train.",
    avatar: "/__mockup/images/blog-author-1.png",
  },
  {
    name: "Jonas Auclair",
    role: "Design Correspondent",
    bio: "Studies the spaces between things — typographic, architectural, and otherwise. Believes good layout is an act of generosity.",
    avatar: "/__mockup/images/blog-author-2.png",
  },
  {
    name: "Priya Nair",
    role: "Engineering at Large",
    bio: "Builds the quiet infrastructure behind the words. Has strong, well-reasoned opinions about footnotes and load times.",
    avatar: "/__mockup/images/blog-author-3.png",
  },
];

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`bs-serif font-semibold tracking-tight ${className}`}>
      The&nbsp;Margin
      <span style={{ color: "var(--bs-accent)" }}>.</span>
    </span>
  );
}

export function EditorialBlogSeries() {
  return (
    <div
      className="blog-series-root bs-sans min-h-screen w-full"
      style={{ backgroundColor: "var(--bs-paper)", color: "var(--bs-ink)" }}
    >
      {/* NAV */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{
          backgroundColor: "rgba(246,243,236,0.82)",
          borderBottom: "1px solid var(--bs-line)",
        }}
      >
        <nav className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-4 lg:px-10">
          <Wordmark className="text-xl" />
          <div className="hidden items-center gap-9 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l}
                href="#"
                className="bs-link-underline text-[13px] font-medium tracking-wide"
                style={{ color: "var(--bs-ink-soft)" }}
              >
                {l}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              className="hidden items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white transition-transform hover:scale-[1.03] sm:flex"
              style={{ backgroundColor: "var(--bs-ink)" }}
            >
              Subscribe
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full md:hidden"
              style={{ border: "1px solid var(--bs-line)" }}
              aria-label="Menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-[1240px] px-6 pt-14 pb-16 lg:px-10 lg:pt-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <div
              className="mb-7 inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em]"
              style={{ color: "var(--bs-accent)" }}
            >
              <span
                className="h-px w-8"
                style={{ backgroundColor: "var(--bs-accent)" }}
              />
              A Series on Attention
            </div>
            <h1
              className="bs-serif font-light leading-[1.02] tracking-[-0.02em]"
              style={{ fontSize: "clamp(2.6rem, 5.2vw, 4.6rem)" }}
            >
              Writing for people who
              <br />
              <span className="italic" style={{ fontWeight: 500 }}>
                still read closely.
              </span>
            </h1>
            <p
              className="mt-7 max-w-lg text-[17px] leading-relaxed"
              style={{ color: "var(--bs-ink-soft)" }}
            >
              A quarterly editorial series on craft, design, and the technology
              of attention — long essays, field notes, and the occasional
              quiet argument, published by the studio behind The Margin.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-6">
              <button
                className="group inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.03]"
                style={{ backgroundColor: "var(--bs-accent)" }}
              >
                Start reading
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
              <div
                className="flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.18em]"
                style={{ color: "var(--bs-muted)" }}
              >
                <span>Issue 04</span>
                <span className="h-1 w-1 rounded-full" style={{ backgroundColor: "var(--bs-muted)" }} />
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> 12 min read
                </span>
              </div>
            </div>
          </div>
          <div className="lg:col-span-6">
            <div className="relative">
              <div
                className="overflow-hidden"
                style={{ borderRadius: "2px" }}
              >
                <img
                  src="/__mockup/images/blog-hero.png"
                  alt="Editorial hero"
                  className="h-[440px] w-full object-cover lg:h-[540px]"
                />
              </div>
              <div
                className="absolute -bottom-5 -left-5 hidden bg-white/0 px-5 py-4 backdrop-blur sm:block"
                style={{
                  backgroundColor: "var(--bs-paper)",
                  border: "1px solid var(--bs-line)",
                }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.24em]"
                  style={{ color: "var(--bs-muted)" }}
                >
                  In this issue
                </p>
                <p className="bs-serif mt-1 text-lg">Six essays · Three contributors</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED LEAD ARTICLE */}
      <section className="mx-auto max-w-[1240px] px-6 lg:px-10">
        <div
          className="flex items-center justify-between border-b pb-4"
          style={{ borderColor: "var(--bs-line)" }}
        >
          <h2
            className="text-[12px] font-semibold uppercase tracking-[0.24em]"
            style={{ color: "var(--bs-ink-soft)" }}
          >
            Latest from the archive
          </h2>
          <a
            href="#"
            className="bs-link-underline inline-flex items-center gap-1.5 text-[12px] font-medium"
            style={{ color: "var(--bs-accent)" }}
          >
            View all 110 essays <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <article className="bs-card group mt-10 grid cursor-pointer grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="overflow-hidden" style={{ borderRadius: "2px" }}>
            <img
              src={FEATURED.image}
              alt={FEATURED.title}
              className="bs-card-img h-[300px] w-full object-cover sm:h-[400px]"
            />
          </div>
          <div className="flex flex-col justify-center">
            <div className="mb-5 flex items-center gap-3">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: "var(--bs-accent)" }}
              >
                {FEATURED.category}
              </span>
              <span
                className="text-[11px] font-medium uppercase tracking-[0.18em]"
                style={{ color: "var(--bs-muted)" }}
              >
                Featured Essay
              </span>
            </div>
            <h3
              className="bs-serif font-light leading-[1.08] tracking-[-0.01em]"
              style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.9rem)" }}
            >
              {FEATURED.title}
            </h3>
            <p
              className="mt-5 max-w-xl text-[16px] leading-relaxed"
              style={{ color: "var(--bs-ink-soft)" }}
            >
              {FEATURED.excerpt}
            </p>
            <div className="mt-8 flex items-center gap-3">
              <img
                src={FEATURED.avatar}
                alt={FEATURED.author}
                className="h-10 w-10 rounded-full object-cover"
              />
              <div className="text-[13px]">
                <p className="font-semibold">{FEATURED.author}</p>
                <p style={{ color: "var(--bs-muted)" }}>
                  {FEATURED.date} · {FEATURED.read} read
                </p>
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* POST GRID */}
      <section className="mx-auto max-w-[1240px] px-6 pt-16 lg:px-10 lg:pt-20">
        <div className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {POSTS.map((post) => (
            <article key={post.title} className="bs-card group cursor-pointer">
              <div className="overflow-hidden" style={{ borderRadius: "2px" }}>
                <img
                  src={post.image}
                  alt={post.title}
                  className="bs-card-img h-[230px] w-full object-cover"
                />
              </div>
              <div className="mt-5">
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: "var(--bs-accent)" }}
                >
                  {post.category}
                </span>
                <h3 className="bs-serif mt-3 text-[1.45rem] font-normal leading-[1.15] tracking-[-0.01em]">
                  {post.title}
                </h3>
                <p
                  className="mt-3 text-[14.5px] leading-relaxed"
                  style={{ color: "var(--bs-ink-soft)" }}
                >
                  {post.excerpt}
                </p>
                <div
                  className="mt-5 flex items-center justify-between border-t pt-4"
                  style={{ borderColor: "var(--bs-line)" }}
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={post.avatar}
                      alt={post.author}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                    <span className="text-[12.5px] font-medium">{post.author}</span>
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--bs-muted)" }}>
                    {post.date} · {post.read}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* TOPICS */}
      <section className="mx-auto max-w-[1240px] px-6 pt-20 lg:px-10 lg:pt-28">
        <div
          className="rounded-sm px-7 py-12 lg:px-14"
          style={{ backgroundColor: "var(--bs-paper-2)" }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.28em]"
                style={{ color: "var(--bs-accent)" }}
              >
                Browse
              </p>
              <h2 className="bs-serif mt-2 text-3xl font-light tracking-[-0.01em] lg:text-4xl">
                Read by topic
              </h2>
            </div>
            <p className="max-w-sm text-[14px]" style={{ color: "var(--bs-ink-soft)" }}>
              Every essay is filed under a theme we keep returning to. Pick a
              thread and follow it.
            </p>
          </div>
          <div className="mt-9 flex flex-wrap gap-3">
            {TOPICS.map((t) => (
              <button
                key={t.label}
                className="bs-pill inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-medium"
                style={{
                  border: "1px solid var(--bs-line)",
                  backgroundColor: "var(--bs-paper)",
                }}
              >
                {t.label}
                <span
                  className="text-[12px] font-normal"
                  style={{ color: "var(--bs-muted)" }}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CONTRIBUTORS */}
      <section className="mx-auto max-w-[1240px] px-6 pt-20 lg:px-10 lg:pt-28">
        <div
          className="flex items-center justify-between border-b pb-4"
          style={{ borderColor: "var(--bs-line)" }}
        >
          <h2
            className="text-[12px] font-semibold uppercase tracking-[0.24em]"
            style={{ color: "var(--bs-ink-soft)" }}
          >
            The contributors
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-3">
          {AUTHORS.map((a) => (
            <div key={a.name} className="flex flex-col items-start">
              <img
                src={a.avatar}
                alt={a.name}
                className="h-20 w-20 rounded-full object-cover"
              />
              <h3 className="bs-serif mt-5 text-2xl font-normal">{a.name}</h3>
              <p
                className="mt-1 text-[12px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--bs-accent)" }}
              >
                {a.role}
              </p>
              <p
                className="mt-4 text-[14.5px] leading-relaxed"
                style={{ color: "var(--bs-ink-soft)" }}
              >
                {a.bio}
              </p>
              <div className="mt-5 flex items-center gap-4" style={{ color: "var(--bs-muted)" }}>
                <a href="#" className="transition-colors hover:text-[var(--bs-ink)]" aria-label="Twitter">
                  <Twitter className="h-4 w-4" />
                </a>
                <a href="#" className="transition-colors hover:text-[var(--bs-ink)]" aria-label="LinkedIn">
                  <Linkedin className="h-4 w-4" />
                </a>
                <a href="#" className="transition-colors hover:text-[var(--bs-ink)]" aria-label="Website">
                  <Globe className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SUBSCRIBE */}
      <section className="mx-auto mt-24 max-w-[1240px] px-6 lg:mt-32 lg:px-10">
        <div
          className="relative overflow-hidden rounded-sm px-8 py-16 text-center lg:px-16 lg:py-24"
          style={{ backgroundColor: "var(--bs-ink)", color: "var(--bs-paper)" }}
        >
          <div
            className="mx-auto mb-7 inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em]"
            style={{ color: "var(--bs-accent-soft)" }}
          >
            <Mail className="h-3.5 w-3.5" />
            The Margin Letter
          </div>
          <h2
            className="bs-serif mx-auto max-w-2xl font-light leading-[1.06] tracking-[-0.02em]"
            style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)" }}
          >
            One considered essay,
            <br />
            <span className="italic">every other Sunday.</span>
          </h2>
          <p
            className="mx-auto mt-6 max-w-md text-[16px] leading-relaxed"
            style={{ color: "rgba(246,243,236,0.7)" }}
          >
            Join 38,000 readers who get the full series in their inbox — no
            tracking pixels, no growth hacks, just the writing.
          </p>
          <form
            className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="email"
              placeholder="you@example.com"
              className="h-12 flex-1 rounded-full px-5 text-[14px] text-white outline-none placeholder:text-white/40"
              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.16)",
              }}
            />
            <button
              type="submit"
              className="h-12 whitespace-nowrap rounded-full px-7 text-[14px] font-semibold text-white transition-transform hover:scale-[1.03]"
              style={{ backgroundColor: "var(--bs-accent)" }}
            >
              Subscribe free
            </button>
          </form>
          <p className="mt-5 text-[12px]" style={{ color: "rgba(246,243,236,0.45)" }}>
            Unsubscribe in one click. We'll never share your address.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mx-auto max-w-[1240px] px-6 pb-12 pt-20 lg:px-10 lg:pt-28">
        <div
          className="grid grid-cols-2 gap-10 border-t pb-12 pt-12 md:grid-cols-4"
          style={{ borderColor: "var(--bs-line)" }}
        >
          <div className="col-span-2 md:col-span-1">
            <Wordmark className="text-xl" />
            <p
              className="mt-4 max-w-[220px] text-[13.5px] leading-relaxed"
              style={{ color: "var(--bs-ink-soft)" }}
            >
              An editorial series on craft, design, and attention. Published
              quarterly since 2019.
            </p>
          </div>
          {[
            { h: "Read", items: ["Latest", "Archive", "Topics", "Issue 04"] },
            { h: "About", items: ["The Studio", "Contributors", "Ethics", "Contact"] },
            { h: "Follow", items: ["Newsletter", "Twitter", "LinkedIn", "RSS"] },
          ].map((col) => (
            <div key={col.h}>
              <h4
                className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: "var(--bs-muted)" }}
              >
                {col.h}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.items.map((it) => (
                  <li key={it}>
                    <a
                      href="#"
                      className="bs-link-underline text-[14px]"
                      style={{ color: "var(--bs-ink-soft)" }}
                    >
                      {it}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          className="flex flex-col items-start justify-between gap-3 border-t pt-6 text-[12.5px] sm:flex-row sm:items-center"
          style={{ borderColor: "var(--bs-line)", color: "var(--bs-muted)" }}
        >
          <p>© 2025 The Margin Editorial. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="bs-link-underline">Privacy</a>
            <a href="#" className="bs-link-underline">Terms</a>
            <a href="#" className="bs-link-underline">Colophon</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
