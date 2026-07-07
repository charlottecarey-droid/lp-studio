import Navbar from "../components/Navbar";
import AnnouncementBanner from "../components/AnnouncementBanner";
import { normalizeBannerBg } from "@/lib/banner-color";
import HeroScene from "../components/HeroScene";
import PromptCard from "../components/PromptCard";
import { BuildSection } from "../components/BuildSection";
import UseCases from "../components/UseCases";
import IdentityWedge from "../components/IdentityWedge";
import AnalyticsScene from "../components/AnalyticsScene";
import Integrations from "../components/Integrations";
import Pricing from "../components/Pricing";
import FAQ from "../components/FAQ";
import FinalCta from "../components/FinalCta";
import FromTheBlog from "../components/FromTheBlog";
import Footer from "../components/Footer";
import { useEffect, useState } from "react";
import { usePageMeta } from "../hooks/usePageMeta";

// Built-in defaults for the marketing homepage share card (Open Graph). These
// are the fallback whenever a field is unset in the superadmin-editable
// `marketing_homepage_og` config or the config can't be read. og:image must be
// an absolute URL to a small file — opengraph.jpg is 1280×720 / ~61KB; the
// legacy opengraph.png is 6.5MB and large images frequently time out in
// scrapers' short fetch windows.
const HOMEPAGE_OG_DEFAULTS = {
  title: "LP Studio — The AI Revenue Workspace for One-Team GTM",
  description:
    "Generate on-brand pages, personalize for every account, and know exactly who's reading them. The AI revenue workspace for one-team GTM.",
  imageUrl: "https://lpstudio.ai/opengraph.jpg",
  imageWidth: 1200,
  imageHeight: 630,
} as const;

interface HomepageOgConfig {
  title: string;
  description: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
}

// The marketing prerender (scripts/prerender-marketing.mjs) injects the
// superadmin-configured row as window.__LP_HOMEPAGE_OG__ before page scripts
// run, so the OG tags baked into the static HTML that non-JS social scrapers
// fetch reflect the operator's edits. At runtime in a real browser the global
// isn't present, so we also fetch /api/lp/homepage-og to converge the live
// document head. Either source falls back, field by field, to the built-ins.
declare global {
  interface Window {
    __LP_HOMEPAGE_OG__?: Partial<HomepageOgConfig>;
    __LP_ANNOUNCEMENT_BANNER__?: Partial<AnnouncementBannerConfig>;
  }
}

// Slim promo bar at the very top of the homepage. Superadmin-editable
// (marketing_announcement_banner) and off by default; the bar only renders when
// it's enabled and has both a message and a link. Like the share card, the
// prerender injects window.__LP_ANNOUNCEMENT_BANNER__ so it's baked into the
// static HTML (no flash); the runtime fetch below converges the live value.
interface AnnouncementBannerConfig {
  enabled: boolean;
  text: string;
  linkUrl: string;
  ctaLabel: string;
  bgColor: string;
}

function resolveAnnouncementBanner(
  raw: Partial<AnnouncementBannerConfig> | null | undefined,
): AnnouncementBannerConfig {
  return {
    enabled: raw?.enabled === true,
    text: typeof raw?.text === "string" ? raw.text.trim() : "",
    linkUrl: typeof raw?.linkUrl === "string" ? raw.linkUrl.trim() : "",
    ctaLabel: typeof raw?.ctaLabel === "string" ? raw.ctaLabel.trim() : "",
    bgColor: normalizeBannerBg(raw?.bgColor),
  };
}

// og:image must be an absolute URL for scrapers. Operator-uploaded images are
// stored relative (e.g. /api/storage/…), so normalize to the apex domain.
function normalizeOgImage(url: string): string {
  const u = url.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u) || u.startsWith("data:")) return u;
  if (u.startsWith("//")) return `https:${u}`;
  return `https://lpstudio.ai${u.startsWith("/") ? "" : "/"}${u}`;
}

function resolveHomepageOg(raw: Partial<HomepageOgConfig> | null | undefined): HomepageOgConfig {
  const title = typeof raw?.title === "string" && raw.title.trim() ? raw.title : HOMEPAGE_OG_DEFAULTS.title;
  const description =
    typeof raw?.description === "string" && raw.description.trim()
      ? raw.description
      : HOMEPAGE_OG_DEFAULTS.description;
  const rawImage = typeof raw?.imageUrl === "string" && raw.imageUrl.trim() ? raw.imageUrl : "";
  const imageUrl = normalizeOgImage(rawImage) || HOMEPAGE_OG_DEFAULTS.imageUrl;
  const toDim = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  };
  const imageWidth = toDim(raw?.imageWidth) ?? HOMEPAGE_OG_DEFAULTS.imageWidth;
  const imageHeight = toDim(raw?.imageHeight) ?? HOMEPAGE_OG_DEFAULTS.imageHeight;
  return { title, description, imageUrl, imageWidth, imageHeight };
}

// Homepage at the apex /. Order is intentional:
//
//   1   HeroScene + PromptCard — v3 editorial hero + Mad Libs prompt card
//   2   BuildSection           — pinned scroll-saga page-assembles demo
//   3   UseCases               — 4 concrete page types (ABM · A/B variants ·
//                                 brand-locked blocks · success page)
//   4   WhatsInside            — "What's inside" zigzag: Brand →
//                                 For Marketing → For Sales → Compare
//   9   IdentityWedge          — Analytics page mock; the deterministic-identity wedge
//  10   AnalyticsScene         — Page Detail / Conversion Score + visit timeline
//  11   Integrations           — Marketo / SF / HubSpot / Apollo / RB2B / etc.
//  12   Pricing                — Full 4-tier + Enterprise + collapsible map
//  13   FAQ                    — 6-7 questions, corrected Mutiny answer
//  14   FinalCta + Footer      — Dark "Skip the brief. Ship the page." closer
//
// CampaignsScene was on this page (used to be #9, between Sales Console
// and IdentityWedge). It got pulled out and moved to /for-marketing
// because the orchestration + backflow story it tells is a marketing-
// persona story, not a generic homepage story. IdentityWedge + Analytics
// now carry the "reveal → optimize" arc by themselves on the homepage.
//
// The Generate / Templates / Sales Console FeatureRows that used to sit
// between WhatsInside (#4) and IdentityWedge (#9) were removed to shorten
// the homepage — WhatsInside already routes to those stories and the same
// embeds still live on /features (the depth page) and the persona routes.

export default function Home() {
  // Marketing homepage share card (Open Graph). The values are superadmin-
  // editable (marketing_homepage_og) with built-in fallbacks. The prerender
  // injects window.__LP_HOMEPAGE_OG__ so the OG tags baked into the static
  // dist/public/index.html that lpstudio.ai serves reflect the edits for
  // non-JS social scrapers; the runtime fetch below converges the live head.
  const [og, setOg] = useState<HomepageOgConfig>(() =>
    resolveHomepageOg(typeof window !== "undefined" ? window.__LP_HOMEPAGE_OG__ : undefined),
  );

  const [banner, setBanner] = useState<AnnouncementBannerConfig>(() =>
    resolveAnnouncementBanner(typeof window !== "undefined" ? window.__LP_ANNOUNCEMENT_BANNER__ : undefined),
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lp/homepage-og")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setOg(resolveHomepageOg(data));
      })
      .catch(() => {
        /* best-effort — the built-in defaults already render */
      });
    fetch("/api/lp/announcement-banner")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setBanner(resolveAnnouncementBanner(data));
      })
      .catch(() => {
        /* best-effort — no banner is a valid state */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showBanner = banner.enabled && !!banner.text && !!banner.linkUrl;

  usePageMeta({
    title: og.title,
    description: og.description,
    canonical: "https://lpstudio.ai/",
    ogImage: og.imageUrl,
    ogImageWidth: og.imageWidth,
    ogImageHeight: og.imageHeight,
    ogImageType: "image/jpeg",
    ogImageAlt: "LP Studio — the AI revenue workspace",
    siteName: "LP Studio",
  });

  return (
    <div
      style={{
        background: "var(--cream)",
        color: "var(--ink)",
        minHeight: "100vh",
        paddingTop: "var(--lp-banner-h, 0px)",
      }}
    >
      {showBanner ? (
        <AnnouncementBanner text={banner.text} linkUrl={banner.linkUrl} ctaLabel={banner.ctaLabel} bgColor={banner.bgColor} />
      ) : null}
      <Navbar />
      <main>
        {/* 1 — v3 editorial hero + Mad Libs prompt card */}
        <HeroScene />
        <PromptCard />

        {/* 2 — Watch a page assemble: the Lovable scroll-saga pinned
            scrollytelling (BuildSection) — page assembles inside a browser
            frame, then the frame gets wrapped by the builder UI with live
            layers / accent / inline-edit interactions. Replaces
            AssembleSceneV2 (kept on disk for reference). */}
        <BuildSection />

        {/* 3 — Use cases: 4 concrete page types with mini live-page
            previews (ABM hero · A/B variants · brand-locked blocks ·
            success page). */}
        <UseCases />

        {/* 4 — "What's inside" — OG DeepFeatures-style zigzag with four
            rows (Brand · For Marketing · For Sales · Compare) on a
            shared spine. The Brand row used to be a heavy standalone
            FeatureRow lower on the page; it's now a compact mock here. */}
        <WhatsInside />

        {/* 9 — Identity wedge: the "know exactly who's on the page,
            not just which account" differentiator vs Mutiny. */}
        <IdentityWedge />

        {/* 10 — Analytics: Page Detail Conversion Score with "why this
            score" + visit timeline. Closes the reveal → optimize loop.
            (CampaignsScene moved to /for-marketing — it's a persona-
            page story, not a homepage story.) */}
        <AnalyticsScene />

        {/* 11 — Integrations: Marketo / Salesforce / HubSpot / Apollo /
            Google Sheets / GA4 / RB2B / Chili Piper / Resend / Asana /
            Webhooks. */}
        <Integrations />

        {/* 12 — Pricing: full 4-tier + Enterprise + collapsible feature map
            (collapsed by default on the homepage; open on /pricing). */}
        <Pricing />

        {/* 13 — FAQ: 6-7 questions including the corrected Mutiny answer */}
        <FAQ />

        {/* 13.5 — From the blog: latest 2-3 published posts. Self-hides when the
            blog is empty / unreachable so the homepage never shows a blank shell. */}
        <FromTheBlog />

        {/* 14 — Final CTA + Footer */}
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

// WhatsInside — OG DeepFeatures-style "What's inside" section: hairline
// eyebrow + big headline + subhead, then a vertical spine on the left
// connecting four zigzag FeatureRow rows that alternate
// visual-left/text-right ↔ text-left/visual-right. The lead-off row is
// the brand-tokens story ("On-brand in 20 seconds"), which used to be
// its own oversized FeatureRow lower on the page — it's now compact and
// pulls weight in the right spot. The remaining rows point at the deep-
// dive marketing routes: /for-marketing, /for-sales, /compare.
interface WhatsInsideRow {
  marker: string;
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  bullets: string[];
  cta: { label: string; href: string };
  visual: React.ReactNode;
  /** "left" puts the visual on the left, text on the right. "right" reverses. */
  side: "left" | "right";
}

const WHATS_INSIDE_INDIGO = "#3C38B8";

function WhatsInside() {
  const rows: WhatsInsideRow[] = [
    {
      marker: "01",
      eyebrow: "Brand & content",
      title: (
        <>
          <span style={{ color: WHATS_INSIDE_INDIGO }}>On-brand</span> in twenty
          seconds.
        </>
      ),
      body: "Paste your site. LP Studio extracts your logos, colors, type, voice and content — then proposes every brand token for you to review and apply. Everything you ship after is on-brand by default.",
      bullets: [
        "Scrapes your homepage + sub-pages",
        "Logos, colors, type, voice, photography",
        "Approved-facts library powers AI copy",
      ],
      cta: { label: "Explore features", href: "/features#brand" },
      visual: <BrandVisual />,
      side: "left",
    },
    {
      marker: "02",
      eyebrow: "For Marketing",
      title: (
        <>
          <span style={{ color: WHATS_INSIDE_INDIGO }}>Campaigns</span> without the
          design queue.
        </>
      ),
      body: "Generate on-brand pages from a prompt, A/B test every variant with Smart Traffic auto-routing the winner, and hand off leads to the MAP your demand-gen team already runs.",
      bullets: [
        "Prompt-to-page in under a minute",
        "A/B + Smart Traffic auto-routing",
        "Marketo + HubSpot + GA4 lead handoff",
      ],
      cta: { label: "Explore for marketing", href: "/for-marketing" },
      visual: <MarketingVisual />,
      side: "right",
    },
    {
      marker: "03",
      eyebrow: "For Sales & RevOps",
      title: (
        <>
          <span style={{ color: WHATS_INSIDE_INDIGO }}>ABM</span> that hits the
          right person.
        </>
      ),
      body: "A microsite for every account, AI-drafted outreach grounded in a contact brief, and per-recipient identity baked into every link — synced back to Salesforce on the right contact.",
      bullets: [
        "One-click per-account microsites",
        "AI outreach drafted from contact briefs",
        "Per-recipient identity in every URL",
      ],
      cta: { label: "Explore for sales", href: "/for-sales" },
      visual: <SalesVisual />,
      side: "left",
    },
    {
      marker: "04",
      eyebrow: "Side-by-side",
      title: (
        <>
          See where{" "}
          <span style={{ color: WHATS_INSIDE_INDIGO }}>we win</span>.
        </>
      ),
      body: "A straight comparison vs Webflow, Unbounce, and Mutiny — where each one is strong, and the specific moments LP Studio is the better call.",
      bullets: [
        "Capability matrix across 4 vendors",
        "Where each competitor is genuinely strong",
        "Migration plan — point your DNS in an afternoon",
      ],
      cta: { label: "See the matrix", href: "/compare" },
      visual: <CompareVisual />,
      side: "right",
    },
  ];

  return (
    <section
      className="px-6 py-28 md:py-36 relative overflow-hidden"
      style={{ background: "var(--cream)", borderTop: "1px solid var(--hairline)" }}
    >
      {/* Soft accent orb at the section's top */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          top: "8%",
          right: "-10%",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(75,71,229,0.10) 0%, rgba(75,71,229,0) 70%)",
          filter: "blur(6px)",
        }}
      />

      <div className="max-w-[1180px] mx-auto relative">
        <div className="max-w-3xl mb-20 md:mb-24">
          <div className="flex items-center gap-3 mb-6">
            <span
              aria-hidden="true"
              style={{
                width: 36,
                height: 1,
                background: "var(--ink-faint)",
              }}
            />
            <span
              className="font-mono uppercase"
              style={{
                color: "var(--ink-soft)",
                fontSize: 11,
                letterSpacing: "0.22em",
                fontWeight: 600,
              }}
            >
              What&apos;s inside
            </span>
          </div>
          <h2
            className="font-display text-display-lg"
            style={{ color: "var(--ink)" }}
          >
            Brand-locked AI that doesn&apos;t sound like AI.
          </h2>
          <p
            className="mt-6 text-[17px] leading-[1.55]"
            style={{ color: "var(--ink-soft)", maxWidth: 580 }}
          >
            Three things the cobbled-together stack of Webflow, Mutiny, and
            Outreach can&apos;t do.
          </p>
        </div>

        {/* Connecting spine on the left, behind the row stack */}
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute hidden md:block pointer-events-none"
            style={{
              left: -4,
              top: 0,
              bottom: 0,
              width: 1,
              background:
                "linear-gradient(180deg, rgba(26,24,21,0) 0%, rgba(26,24,21,0.18) 8%, rgba(26,24,21,0.18) 92%, rgba(26,24,21,0) 100%)",
            }}
          />

          <div className="space-y-32 md:space-y-40">
            {rows.map((r, i) => (
              <WhatsInsideRowEl key={r.marker} row={r} index={i} total={rows.length} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatsInsideRowEl({
  row,
  index,
  total,
}: {
  row: WhatsInsideRow;
  index: number;
  total: number;
}) {
  const textCol = (
    <div className="relative">
      {/* Spine marker — square indigo tile with the marker number */}
      <div
        aria-hidden="true"
        className="absolute hidden md:flex items-center justify-center"
        style={{
          left: -22,
          top: 4,
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${WHATS_INSIDE_INDIGO} 0%, color-mix(in srgb, ${WHATS_INSIDE_INDIGO} 60%, #000) 100%)`,
          color: "#FFFFFF",
          boxShadow: `0 6px 16px -6px color-mix(in srgb, ${WHATS_INSIDE_INDIGO} 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.3)`,
        }}
      >
        <span
          style={{
            fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "-0.005em",
          }}
        >
          {row.marker}
        </span>
      </div>

      <div className="flex items-baseline gap-3 mb-5 md:pl-5">
        <span
          className="font-mono uppercase md:hidden"
          style={{ color: WHATS_INSIDE_INDIGO, fontSize: 11, letterSpacing: "0.18em", fontWeight: 700 }}
        >
          {row.marker}
        </span>
        <span
          className="font-mono uppercase inline-flex items-center gap-1.5 px-2 py-1 rounded-full"
          style={{
            color: WHATS_INSIDE_INDIGO,
            background: "rgba(75,71,229,0.08)",
            border: "1px solid rgba(75,71,229,0.18)",
            fontSize: 10.5,
            letterSpacing: "0.18em",
            fontWeight: 700,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: WHATS_INSIDE_INDIGO,
              boxShadow: `0 0 5px ${WHATS_INSIDE_INDIGO}`,
            }}
          />
          {row.eyebrow}
        </span>
      </div>
      {/* Same display treatment as the Analytics h2 (text-display-md) so
          the row headlines carry the same weight as sibling sections. */}
      <h3
        className="font-display text-display-md md:pl-5"
        style={{ color: "var(--ink)", margin: 0 }}
      >
        {row.title}
      </h3>
      <p
        className="mt-6 text-[16px] leading-[1.6] md:pl-5"
        style={{ color: "var(--ink-soft)", maxWidth: 520 }}
      >
        {row.body}
      </p>
      <ul className="mt-7 space-y-3 md:pl-5" style={{ listStyle: "none", padding: 0, margin: "28px 0 0" }}>
        {row.bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 text-[14.5px]" style={{ color: "var(--ink-2)" }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={WHATS_INSIDE_INDIGO}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginTop: 4, flexShrink: 0 }}
              aria-hidden="true"
            >
              <path d="M5 12.5L10 17.5L20 7.5" />
            </svg>
            {b}
          </li>
        ))}
      </ul>

      {/* CTA + step indicator */}
      <div className="mt-8 md:pl-5 flex items-center gap-6 flex-wrap">
        <a
          href={row.cta.href}
          className="px-4 py-2 text-[13px] font-medium transition-all inline-flex items-center gap-1.5"
          style={{
            background: "var(--navy)",
            color: "var(--cream)",
            borderRadius: 8,
            textDecoration: "none",
            boxShadow:
              "0 1px 2px rgba(26, 24, 21, 0.10), 0 4px 12px -6px rgba(26, 24, 21, 0.25)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--navy-2)";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow =
              "0 1px 2px rgba(26, 24, 21, 0.10), 0 8px 18px -6px rgba(26, 24, 21, 0.32)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--navy)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow =
              "0 1px 2px rgba(26, 24, 21, 0.10), 0 4px 12px -6px rgba(26, 24, 21, 0.25)";
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="var(--coral)" aria-hidden="true">
            <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13 6.5 8.5 2 7l4.5-1.5L8 1z" />
          </svg>
          {row.cta.label}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </a>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                width: i === index ? 20 : 6,
                height: 6,
                borderRadius: 999,
                background:
                  i === index
                    ? `linear-gradient(90deg, ${WHATS_INSIDE_INDIGO} 0%, #6C68F0 100%)`
                    : "rgba(26,24,21,0.18)",
                transition: "width 240ms ease",
              }}
            />
          ))}
          <span
            className="ml-2 text-[11px] uppercase"
            style={{ color: "var(--ink-mute)", letterSpacing: "0.18em", fontWeight: 600 }}
          >
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center relative">
      {row.side === "left" ? (
        <>
          <div className="order-2 md:order-1">{row.visual}</div>
          <div className="order-1 md:order-2">{textCol}</div>
        </>
      ) : (
        <>
          {textCol}
          {row.visual}
        </>
      )}
    </div>
  );
}

// ── Mini visuals ─────────────────────────────────────────────────────────

// ── Visual chrome scaffolding ───────────────────────────────────────────
// Every WhatsInside visual sits inside a card with a small browser/app
// chrome at the top — traffic-light dots, a faint URL pill, and an
// optional right-aligned status chip. The goal is to read as a real
// product surface, not a marketing illustration. Keep the inner padding
// minimal so the mock content carries the weight.

function VisualCard({
  url,
  status,
  accent = WHATS_INSIDE_INDIGO,
  children,
}: {
  url: string;
  status?: { label: string; color?: string; pulse?: boolean };
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: 14,
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.8) inset, 0 24px 50px -24px rgba(26,24,21,0.22), 0 10px 22px -14px rgba(26,24,21,0.12)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top chrome bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "color-mix(in srgb, var(--ink) 3%, var(--paper))",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
          {[
            "#F25C54",
            "#E8B339",
            "#3DB158",
          ].map((dot) => (
            <span
              key={dot}
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: dot,
                boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.18)",
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            padding: "3px 9px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span
            className="font-mono"
            style={{
              fontSize: 10.5,
              color: "var(--ink-mute)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              letterSpacing: 0,
            }}
          >
            {url}
          </span>
        </div>
        {status && (
          <span
            className="font-mono uppercase inline-flex items-center gap-1.5"
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: status.color ?? accent,
              background: `color-mix(in srgb, ${status.color ?? accent} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${status.color ?? accent} 22%, transparent)`,
              padding: "2px 7px",
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            {status.pulse !== false && (
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: status.color ?? accent,
                  boxShadow: `0 0 5px ${status.color ?? accent}`,
                }}
              />
            )}
            {status.label}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "18px 20px 20px" }}>{children}</div>
    </div>
  );
}

function BrandVisual() {
  const colors: { name: string; hex: string; role: string }[] = [
    { name: "Primary", hex: "#3C38B8", role: "CTA · links" },
    { name: "Ink", hex: "#0F1217", role: "Text · headers" },
    { name: "Cream", hex: "#F6F2E9", role: "Surface" },
    { name: "Coral", hex: "#E26F5C", role: "Accent" },
    { name: "Sage", hex: "#5C9B6E", role: "Success" },
  ];
  return (
    <VisualCard
      url="app.lpstudio.ai/brand"
      status={{ label: "Synced · 142 pages", color: "var(--sage)" }}
    >
      {/* Sub-tabs */}
      <div
        style={{
          display: "flex",
          gap: 18,
          borderBottom: "1px solid var(--hairline)",
          marginBottom: 16,
        }}
      >
        {[
          { label: "Brand", active: true },
          { label: "Content" },
          { label: "Voice" },
          { label: "Photography" },
        ].map((t) => (
          <span
            key={t.label}
            style={{
              fontSize: 12,
              fontWeight: t.active ? 600 : 500,
              color: t.active ? "var(--ink)" : "var(--ink-mute)",
              padding: "0 0 10px",
              borderBottom: t.active ? `2px solid ${WHATS_INSIDE_INDIGO}` : "2px solid transparent",
              marginBottom: -1,
              letterSpacing: "-0.005em",
            }}
          >
            {t.label}
          </span>
        ))}
      </div>

      {/* Logo card */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "13px 14px",
          background: "var(--cream-2)",
          border: "1px solid var(--hairline)",
          borderRadius: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background:
              "linear-gradient(135deg, #FFFFFF 0%, color-mix(in srgb, var(--ink) 4%, #FFFFFF) 100%)",
            border: "1px solid var(--hairline)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            position: "relative",
          }}
        >
          {/* Faux wordmark: A inside a circle */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="#0F1217" strokeWidth="1.4" />
            <path d="M6.5 16.5L12 6L17.5 16.5M8.5 13.5H15.5" stroke="#0F1217" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="font-display"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ink)",
              letterSpacing: "-0.014em",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Acme Robotics
            <span
              className="font-mono uppercase"
              style={{
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "var(--sage)",
                background: "color-mix(in srgb, var(--sage) 12%, transparent)",
                padding: "2px 5px",
                borderRadius: 3,
              }}
            >
              ✓ Verified
            </span>
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 2 }}
          >
            acmerobotics.com · imported in 18s · 8 sub-pages scraped
          </div>
        </div>
      </div>

      {/* Colors */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          className="font-mono uppercase"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.18em",
            fontWeight: 700,
            color: "var(--ink-mute)",
          }}
        >
          Color tokens
        </span>
        <span
          className="font-mono"
          style={{ fontSize: 9.5, color: "var(--ink-faint)", letterSpacing: 0 }}
        >
          5 of 12
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {colors.map((c) => (
          <div
            key={c.hex}
            style={{
              flex: 1,
              minWidth: 0,
              padding: 5,
              background: "var(--paper)",
              border: "1px solid var(--hairline)",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                width: "100%",
                height: 28,
                borderRadius: 5,
                background: c.hex,
                border: c.hex === "#F6F2E9" ? "1px solid var(--hairline)" : "none",
              }}
            />
            <div
              style={{
                fontSize: 9.5,
                color: "var(--ink-2)",
                marginTop: 5,
                fontWeight: 600,
                letterSpacing: "-0.005em",
                textAlign: "center",
              }}
            >
              {c.name}
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: 8.5,
                color: "var(--ink-mute)",
                textAlign: "center",
                letterSpacing: 0,
              }}
            >
              {c.hex}
            </div>
          </div>
        ))}
      </div>

      {/* Typography card */}
      <div
        style={{
          padding: "12px 14px",
          background: "var(--cream-2)",
          border: "1px solid var(--hairline)",
          borderRadius: 10,
          marginBottom: 12,
        }}
      >
        <div
          className="font-mono uppercase"
          style={{
            fontSize: 9,
            letterSpacing: "0.18em",
            fontWeight: 700,
            color: "var(--ink-mute)",
            marginBottom: 6,
          }}
        >
          Type pairing
        </div>
        <div
          className="font-display"
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.026em",
            lineHeight: 1,
            marginBottom: 4,
          }}
        >
          On-brand, by default.
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-soft)",
            lineHeight: 1.45,
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          }}
        >
          Built for revenue teams who ship a lot of pages.
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: 9.5,
            color: "var(--ink-faint)",
            marginTop: 6,
            letterSpacing: 0,
          }}
        >
          Editorial New / 500 · Inter / 400 · 500
        </div>
      </div>

      {/* Voice axis */}
      <div
        style={{
          padding: "10px 14px",
          background: "rgba(75,71,229,0.05)",
          border: "1px solid rgba(75,71,229,0.18)",
          borderRadius: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: WHATS_INSIDE_INDIGO,
            }}
          >
            Voice
          </span>
          <span
            style={{
              fontSize: 11.5,
              color: "var(--ink-2)",
              fontWeight: 500,
            }}
          >
            Confident · technical · warm
          </span>
        </div>
        {/* Tone axis */}
        {[
          { left: "Formal", right: "Casual", pos: 38 },
          { left: "Concise", right: "Expansive", pos: 32 },
          { left: "Serious", right: "Playful", pos: 46 },
        ].map((a) => (
          <div
            key={a.left}
            className="grid grid-cols-[52px_1fr] sm:grid-cols-[70px_1fr_70px]"
            style={{
              alignItems: "center",
              gap: 8,
              marginTop: 5,
            }}
          >
            <span
              className="font-mono uppercase"
              style={{
                fontSize: 8.5,
                color: "var(--ink-mute)",
                fontWeight: 700,
                letterSpacing: "0.16em",
                textAlign: "right",
              }}
            >
              {a.left}
            </span>
            <div
              style={{
                position: "relative",
                height: 4,
                background: "rgba(75,71,229,0.12)",
                borderRadius: 999,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: `calc(${a.pos}% - 5px)`,
                  top: -3,
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: WHATS_INSIDE_INDIGO,
                  boxShadow: `0 0 0 3px color-mix(in srgb, ${WHATS_INSIDE_INDIGO} 20%, transparent)`,
                }}
              />
            </div>
            <span
              className="font-mono uppercase hidden sm:inline"
              style={{
                fontSize: 8.5,
                color: "var(--ink-mute)",
                fontWeight: 700,
                letterSpacing: "0.16em",
              }}
            >
              {a.right}
            </span>
          </div>
        ))}
      </div>
    </VisualCard>
  );
}

// Tiny variant thumbnail — a centered hero block above a couple of
// faux content rows. The "kind" toggles the layout so each variant
// reads distinct at a glance (no need for real screenshots).
function VariantThumb({
  kind,
  active,
}: {
  kind: "control" | "outcome" | "social";
  active?: boolean;
}) {
  const border = active
    ? `1px solid ${WHATS_INSIDE_INDIGO}`
    : "1px solid var(--hairline)";
  const accent = active ? WHATS_INSIDE_INDIGO : "rgba(26,24,21,0.45)";
  return (
    <div
      style={{
        width: 44,
        height: 36,
        borderRadius: 5,
        background: "var(--paper)",
        border,
        padding: 4,
        display: "flex",
        flexDirection: "column",
        gap: 2.5,
        flexShrink: 0,
        boxShadow: active
          ? `0 0 0 3px color-mix(in srgb, ${WHATS_INSIDE_INDIGO} 18%, transparent)`
          : undefined,
      }}
    >
      {kind === "control" && (
        <>
          <div style={{ height: 3, borderRadius: 1, background: accent, width: "70%" }} />
          <div style={{ height: 2, borderRadius: 1, background: "var(--hairline-strong)", width: "92%" }} />
          <div style={{ height: 2, borderRadius: 1, background: "var(--hairline-strong)", width: "85%" }} />
          <div
            style={{
              marginTop: "auto",
              height: 4,
              width: 18,
              borderRadius: 1,
              background: accent,
            }}
          />
        </>
      )}
      {kind === "outcome" && (
        <>
          <div style={{ height: 4, borderRadius: 1, background: accent, width: "85%" }} />
          <div style={{ height: 4, borderRadius: 1, background: accent, width: "55%" }} />
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              gap: 3,
            }}
          >
            <div style={{ height: 5, flex: 1, borderRadius: 1, background: accent }} />
            <div
              style={{
                height: 5,
                flex: 1,
                borderRadius: 1,
                background: "var(--hairline-strong)",
              }}
            />
          </div>
        </>
      )}
      {kind === "social" && (
        <>
          <div style={{ height: 3, borderRadius: 1, background: accent, width: "60%" }} />
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: "var(--hairline-strong)",
                  border: "1px solid var(--paper)",
                  marginLeft: i === 0 ? 0 : -3,
                }}
              />
            ))}
            <span
              style={{
                marginLeft: 3,
                height: 3,
                width: 14,
                borderRadius: 1,
                background: accent,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function MarketingVisual() {
  const variants: {
    kind: "control" | "outcome" | "social";
    name: string;
    label: string;
    traffic: number;
    cvr: string;
    lift: string;
    winning?: boolean;
  }[] = [
    { kind: "control", name: "A", label: "Control", traffic: 15, cvr: "3.37%", lift: "—" },
    { kind: "outcome", name: "B", label: "Outcome-led", traffic: 70, cvr: "6.15%", lift: "+82%", winning: true },
    { kind: "social", name: "C", label: "Social proof", traffic: 15, cvr: "2.91%", lift: "−14%" },
  ];
  return (
    <VisualCard
      url="app.lpstudio.ai/pages/q3-summit/ab"
      status={{ label: "Live · 99% sig", color: WHATS_INSIDE_INDIGO }}
    >
      {/* Stat strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginBottom: 14,
        }}
      >
        {[
          { label: "Visitors", value: "12,664" },
          { label: "Conversions", value: "682" },
          { label: "Lift", value: "+82%", accent: true },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: "8px 10px",
              background: s.accent ? "rgba(75,71,229,0.06)" : "var(--cream-2)",
              border: s.accent
                ? "1px solid rgba(75,71,229,0.22)"
                : "1px solid var(--hairline)",
              borderRadius: 8,
            }}
          >
            <div
              className="font-mono uppercase"
              style={{
                fontSize: 8.5,
                letterSpacing: "0.18em",
                fontWeight: 700,
                color: "var(--ink-mute)",
                marginBottom: 2,
              }}
            >
              {s.label}
            </div>
            <div
              className="font-display text-[14px] sm:text-[18px]"
              style={{
                fontWeight: 600,
                letterSpacing: "-0.018em",
                color: s.accent ? WHATS_INSIDE_INDIGO : "var(--ink)",
                lineHeight: 1,
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Variant rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {variants.map((v) => (
          <div
            key={v.name}
            style={{
              background: v.winning
                ? "color-mix(in srgb, #3C38B8 7%, var(--paper))"
                : "var(--paper)",
              border: v.winning
                ? "1px solid color-mix(in srgb, #3C38B8 32%, transparent)"
                : "1px solid var(--hairline)",
              borderRadius: 9,
              padding: "9px 11px",
              display: "flex",
              alignItems: "center",
              gap: 11,
            }}
          >
            <div className="hidden sm:block" style={{ flexShrink: 0 }}>
              <VariantThumb kind={v.kind} active={v.winning} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 3,
                }}
              >
                <span
                  className="font-mono"
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: v.winning ? WHATS_INSIDE_INDIGO : "var(--ink-mute)",
                    letterSpacing: 0,
                  }}
                >
                  {v.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--ink)",
                    letterSpacing: "-0.005em",
                  }}
                >
                  {v.label}
                </span>
                {v.winning && (
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: "0.18em",
                      color: "#fff",
                      background: WHATS_INSIDE_INDIGO,
                      padding: "2px 5px",
                      borderRadius: 3,
                    }}
                  >
                    Winner
                  </span>
                )}
              </div>
              <div
                style={{
                  height: 4,
                  background: "rgba(26,24,21,0.06)",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${v.traffic}%`,
                    height: "100%",
                    background: v.winning
                      ? `linear-gradient(90deg, ${WHATS_INSIDE_INDIGO} 0%, #6C68F0 100%)`
                      : "rgba(26,24,21,0.30)",
                    borderRadius: 999,
                    transition: "width 240ms ease",
                  }}
                />
              </div>
            </div>
            <div
              style={{
                textAlign: "right",
                minWidth: 64,
                flexShrink: 0,
              }}
            >
              <div
                className="font-display"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: v.winning ? WHATS_INSIDE_INDIGO : "var(--ink-2)",
                  letterSpacing: "-0.012em",
                  lineHeight: 1,
                }}
              >
                {v.cvr}
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: 9.5,
                  color:
                    v.lift.startsWith("+")
                      ? "var(--sage)"
                      : v.lift.startsWith("−")
                      ? "var(--coral)"
                      : "var(--ink-faint)",
                  fontWeight: 600,
                  letterSpacing: 0,
                  marginTop: 2,
                }}
              >
                {v.lift}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Smart Traffic footer */}
      <div
        style={{
          marginTop: 12,
          padding: "9px 12px",
          background: "rgba(75,71,229,0.06)",
          border: "1px solid rgba(75,71,229,0.18)",
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: WHATS_INSIDE_INDIGO,
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </span>
        <span style={{ fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.4, flex: 1 }}>
          <strong style={{ color: WHATS_INSIDE_INDIGO, fontWeight: 700 }}>
            Smart Traffic
          </strong>{" "}
          routed 70% of new visits to B — no manual cutover.
        </span>
      </div>
    </VisualCard>
  );
}

function SalesVisual() {
  const score = 88;
  return (
    <VisualCard
      url="app.lpstudio.ai/sales/cobalt-systems"
      status={{ label: "Hot account", color: "var(--coral)" }}
    >
      {/* Account header */}
      <div
        className="flex-wrap"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          background: "var(--cream-2)",
          border: "1px solid var(--hairline)",
          borderRadius: 10,
          marginBottom: 12,
        }}
      >
        {/* Faux company mark */}
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background:
              "linear-gradient(135deg, #0F1217 0%, #2A2D38 100%)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            position: "relative",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12L8 7L13 12L18 7L21 10" />
            <path d="M3 17H21" opacity="0.55" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="font-display"
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ink)",
              letterSpacing: "-0.014em",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            Cobalt Systems
            <span
              className="font-mono uppercase"
              style={{
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "#92670C",
                background: "#FEF3C7",
                padding: "2px 5px",
                borderRadius: 3,
              }}
            >
              Enterprise
            </span>
          </div>
          <div
            style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}
          >
            Industrial automation · $400M ARR · Halifax Capital
          </div>
        </div>
        {/* Engagement gauge */}
        <div className="w-full sm:w-auto" style={{ flexShrink: 0, textAlign: "right" }}>
          <div
            className="font-mono uppercase"
            style={{
              fontSize: 8.5,
              letterSpacing: "0.18em",
              fontWeight: 700,
              color: "var(--ink-mute)",
            }}
          >
            Engaged
          </div>
          <div
            className="font-display"
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.024em",
              color: "var(--coral)",
              lineHeight: 1,
            }}
          >
            {score}
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 500 }}>
              /100
            </span>
          </div>
        </div>
      </div>

      {/* Identity-reveal pill — the deterministic-identity wedge */}
      <div
        style={{
          padding: "10px 12px",
          background:
            "linear-gradient(135deg, rgba(75,71,229,0.07) 0%, rgba(226,111,92,0.05) 100%)",
          border: "1px solid rgba(75,71,229,0.20)",
          borderRadius: 10,
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            background:
              "linear-gradient(135deg, var(--indigo) 0%, var(--coral) 100%)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
            fontWeight: 700,
            fontSize: 11.5,
            flexShrink: 0,
            boxShadow: "0 4px 10px -4px rgba(75,71,229,0.45)",
          }}
        >
          SC
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              color: "var(--ink)",
              fontWeight: 600,
              letterSpacing: "-0.005em",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Sarah Chen
            <span style={{ fontSize: 10.5, color: "var(--ink-mute)", fontWeight: 500 }}>
              · VP, Strategic Sourcing
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: WHATS_INSIDE_INDIGO,
              marginTop: 2,
              fontWeight: 600,
            }}
          >
            On the page right now · 3 visits · 42 min total
          </div>
        </div>
        <span
          className="font-mono uppercase inline-flex items-center gap-1.5"
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "var(--sage)",
            background: "color-mix(in srgb, var(--sage) 14%, transparent)",
            padding: "3px 7px",
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: "var(--sage)",
            }}
          />
          Live
        </span>
      </div>

      {/* Activity timeline */}
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 9,
          letterSpacing: "0.18em",
          fontWeight: 700,
          color: "var(--ink-mute)",
          marginBottom: 6,
        }}
      >
        Recent activity
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {[
          {
            label: "Viewed",
            detail: "Cobalt Pilot microsite",
            time: "5m ago",
            color: WHATS_INSIDE_INDIGO,
            icon: (
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
            ),
          },
          {
            label: "Clicked",
            detail: "View pricing → /pricing",
            time: "5m ago",
            color: "var(--sage)",
            icon: <path d="M5 12l5 5L20 7" />,
          },
          {
            label: "Forwarded",
            detail: "→ David Park, CFO",
            time: "yesterday",
            color: "#8967D0",
            icon: <path d="M4 12h12M11 7l5 5-5 5" />,
          },
        ].map((a) => (
          <div
            key={a.detail}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "8px 10px",
              background: "var(--cream-2)",
              border: "1px solid var(--hairline)",
              borderRadius: 8,
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: `color-mix(in srgb, ${a.color} 14%, transparent)`,
                color: a.color,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {a.icon}
              </svg>
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 11.5,
                color: "var(--ink-2)",
                fontWeight: 500,
              }}
            >
              <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                {a.label}
              </strong>
              <span style={{ color: "var(--ink-mute)" }}> {a.detail}</span>
            </span>
            <span
              className="font-mono uppercase"
              style={{
                fontSize: 9,
                letterSpacing: "0.14em",
                fontWeight: 700,
                color: "var(--ink-mute)",
                flexShrink: 0,
              }}
            >
              {a.time}
            </span>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 7,
        }}
      >
        <div
          style={{
            flex: 1,
            padding: "9px 12px",
            background: WHATS_INSIDE_INDIGO,
            borderRadius: 8,
            color: "#fff",
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: "-0.005em",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            boxShadow: "0 6px 14px -6px rgba(75,71,229,0.45)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19l9 2-3-9 3-9-21 7 9 3 3 6z" />
          </svg>
          Draft outreach
        </div>
        <div
          style={{
            padding: "9px 12px",
            background: "var(--paper)",
            border: "1px solid var(--hairline-strong)",
            borderRadius: 8,
            color: "var(--ink-2)",
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: "-0.005em",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          New microsite
        </div>
      </div>
    </VisualCard>
  );
}

function CompareVisual() {
  // 3 ratings: "full" ●, "partial" ◐, "none" ○. LP column is always
  // full — the table reads as the "where we win" cut, not the
  // exhaustive matrix (that's on /compare).
  type Cell = "full" | "partial" | "none";
  const rows: { label: string; vals: [Cell, Cell, Cell, Cell] }[] = [
    { label: "Brand import (site → tokens)", vals: ["full", "none", "none", "none"] },
    { label: "Per-recipient identity", vals: ["full", "none", "none", "none"] },
    { label: "Per-account microsites", vals: ["full", "partial", "none", "full"] },
    { label: "AI page generation", vals: ["full", "partial", "partial", "full"] },
    { label: "Native Salesforce sync", vals: ["full", "none", "partial", "partial"] },
  ];
  const cols: { short: string; long: string; mark: React.ReactNode }[] = [
    {
      short: "LP",
      long: "LP Studio",
      mark: (
        <span
          className="font-display"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.02em",
          }}
        >
          LP
        </span>
      ),
    },
    {
      short: "Wf",
      long: "Webflow",
      mark: (
        <span
          className="font-display"
          style={{ fontSize: 13, fontWeight: 700, color: "#146EF5" }}
        >
          W
        </span>
      ),
    },
    {
      short: "Ub",
      long: "Unbounce",
      mark: (
        <span
          className="font-display"
          style={{ fontSize: 13, fontWeight: 700, color: "#FF6B5C" }}
        >
          U
        </span>
      ),
    },
    {
      short: "Mu",
      long: "Mutiny",
      mark: (
        <span
          className="font-display"
          style={{ fontSize: 13, fontWeight: 700, color: "#FF4D2E" }}
        >
          M
        </span>
      ),
    },
  ];

  const cellIcon = (v: Cell, isLp: boolean) => {
    if (v === "full") {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" aria-label="Yes">
          <circle
            cx="12"
            cy="12"
            r="9"
            fill={isLp ? WHATS_INSIDE_INDIGO : "var(--sage)"}
          />
          <path
            d="M7.5 12L11 15.5L17 9"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    }
    if (v === "partial") {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" aria-label="Partial">
          <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(26,24,21,0.30)" strokeWidth="1.5" />
          <path
            d="M12 3a9 9 0 0 0 0 18z"
            fill="rgba(26,24,21,0.30)"
          />
        </svg>
      );
    }
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-label="No">
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="rgba(26,24,21,0.18)"
          strokeWidth="1.5"
          strokeDasharray="2.5 3"
        />
      </svg>
    );
  };

  return (
    <VisualCard
      url="app.lpstudio.ai/compare"
      status={{ label: "Updated · Jun 2026", color: "var(--ink-mute)", pulse: false }}
    >
      <style>{`
        @media (max-width: 767px) {
          .cmp-inner { min-width: 0 !important; }
          .cmp-row {
            grid-template-columns: 1fr 38px 30px 30px 30px !important;
            gap: 2px !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
          .cmp-lp { right: 108px !important; width: 38px !important; }
        }
      `}</style>
      {/* Table — fits all four vendor columns on mobile (no horizontal scroll) */}
      <div className="cmp-scroll" style={{ overflowX: "auto" }}>
      <div className="cmp-inner" style={{ minWidth: 420 }}>
      {/* Column header row */}
      <div
        className="cmp-row"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 56px 44px 44px 44px",
          alignItems: "center",
          gap: 4,
          padding: "0 0 10px",
        }}
      >
        <span
          className="font-mono uppercase"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.18em",
            fontWeight: 700,
            color: "var(--ink-mute)",
          }}
        >
          Capability
        </span>
        {cols.map((c, i) => {
          const isLp = i === 0;
          return (
            <div
              key={c.short}
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: isLp
                    ? `linear-gradient(135deg, ${WHATS_INSIDE_INDIGO} 0%, #6C68F0 100%)`
                    : "var(--paper)",
                  border: isLp ? "none" : "1px solid var(--hairline-strong)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: isLp
                    ? `0 6px 14px -6px color-mix(in srgb, ${WHATS_INSIDE_INDIGO} 60%, transparent)`
                    : undefined,
                }}
              >
                {c.mark}
              </div>
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: 8.5,
                  letterSpacing: "0.16em",
                  fontWeight: 700,
                  color: isLp ? WHATS_INSIDE_INDIGO : "var(--ink-mute)",
                }}
              >
                {c.short}
              </span>
            </div>
          );
        })}
      </div>

      {/* Data rows */}
      <div
        style={{
          background: "var(--cream-2)",
          border: "1px solid var(--hairline)",
          borderRadius: 10,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* LP column highlight */}
        <div
          aria-hidden="true"
          className="cmp-lp"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: "calc(44px * 3 + 4px * 3 + 12px)",
            width: 56,
            background: "rgba(75,71,229,0.06)",
            borderLeft: "1px solid rgba(75,71,229,0.16)",
            borderRight: "1px solid rgba(75,71,229,0.16)",
            pointerEvents: "none",
          }}
        />
        {rows.map((r, i) => (
          <div
            key={r.label}
            className="cmp-row"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 56px 44px 44px 44px",
              alignItems: "center",
              gap: 4,
              padding: "10px 12px",
              borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
              position: "relative",
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "var(--ink-2)",
                fontWeight: 500,
                letterSpacing: "-0.003em",
              }}
            >
              {r.label}
            </span>
            {r.vals.map((v, j) => (
              <span
                key={j}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {cellIcon(v, j === 0)}
              </span>
            ))}
          </div>
        ))}
      </div>
      </div>
      </div>

      {/* Where we win footer */}
      <div
        style={{
          marginTop: 10,
          padding: "9px 12px",
          background: "rgba(75,71,229,0.06)",
          border: "1px solid rgba(75,71,229,0.18)",
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={WHATS_INSIDE_INDIGO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2L15 8.5L22 9.5L17 14L18.5 21L12 17.5L5.5 21L7 14L2 9.5L9 8.5L12 2Z" />
        </svg>
        <span style={{ fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.4, flex: 1 }}>
          <strong style={{ color: WHATS_INSIDE_INDIGO, fontWeight: 700 }}>
            LP Studio
          </strong>{" "}
          is the only one with deterministic per-recipient identity.
        </span>
      </div>
      <div
        className="mt-2 text-[11px]"
        style={{ color: "var(--ink-faint)", lineHeight: 1.5 }}
      >
        Showing 5 of 24 rows · full matrix on /compare
      </div>
    </VisualCard>
  );
}
