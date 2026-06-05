import Navbar from "../components/Navbar";
import PersonaHero from "../components/PersonaHero";
import FeatureRow from "../components/FeatureRow";
import BrandSettingsEmbed from "../components/BrandSettingsEmbed";
import BuilderEmbed from "../components/BuilderEmbed";
import TemplatesEmbed from "../components/TemplatesEmbed";
import SalesConsoleEmbed from "../components/SalesConsoleEmbed";
import { AnalyticsMock } from "../components/IdentityWedge";
import Integrations from "../components/Integrations";
import FinalCta from "../components/FinalCta";
import Footer from "../components/Footer";
import { usePageMeta } from "../hooks/usePageMeta";

// /features — the depth page. Visitors who want "what does this actually do"
// land here and find every product surface in browser chrome, plus a deeper
// integrations narrative. Pairs with the leaner / homepage (where the
// product story is told via UseCases + TwoMotions + IdentityWedge); the
// FeatureRow embeds intentionally live here instead so the homepage stays
// scannable.
//
// 8-section IA:
//   1  PersonaHero (neutral)        — "Everything LP Studio does."
//   2  FeatureRow / Brand & Content — BrandSettingsEmbed
//   3  FeatureRow / Builder         — BuilderEmbed
//   4  FeatureRow / Templates       — TemplatesEmbed (live previews)
//   5  FeatureRow / Sales Console   — SalesConsoleEmbed (AI Briefing)
//   6  FeatureRow / Analytics       — AnalyticsMock (visits table + identity)
//   7  Integrations                 — Logo bar + Salesforce sync narrative
//   8  FinalCta + Footer
export default function Features() {
  usePageMeta({
    title: "Features — LP Studio",
    description:
      "Everything LP Studio does — brand-locked AI page generation, the visual builder, 100+ templates, the Sales Console with per-recipient identity, and the integrations that wire it into your existing stack.",
    canonical: "https://lpstudio.ai/features",
    ogImage: "https://lpstudio.ai/opengraph.jpg",
    ogImageWidth: 1280,
    ogImageHeight: 720,
    ogImageType: "image/jpeg",
    ogImageAlt: "LP Studio features",
    siteName: "LP Studio",
  });

  return (
    <div
      style={{ background: "var(--cream)", color: "var(--ink)", minHeight: "100vh" }}
    >
      <Navbar />
      <main>
        {/* 1 — Neutral hero (not persona-tinted) */}
        <PersonaHero
          eyebrow="Features"
          accent="var(--ink)"
          title="Everything LP Studio does."
          sub="One workspace for marketing-built campaigns and sales-built microsites — brand-locked AI page generation, a visual builder, 100+ templates, deterministic per-recipient identity, and the integrations that wire it into your stack."
          secondaryLabel="Talk to sales"
        />

        {/* 2 — Brand & Content */}
        <FeatureRow
          id="brand"
          num="01"
          label="Brand & Content"
          title="On-brand in twenty seconds."
          body={
            <>
              Paste your site. LP Studio extracts your logos, colors, type,
              voice and content — then proposes every brand token for you to
              review and apply.{" "}
              <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                Everything you ship after is on-brand by default.
              </strong>
            </>
          }
          bullets={[
            "Scrapes your homepage + sub-pages",
            "Logos, colors, type, voice, photography",
            "Approved-facts library powers AI copy",
            "Strict AI facts mode",
          ]}
          url="app.lpstudio.ai/brand"
          bodyHeight={680}
          frame={<BrandSettingsEmbed />}
        />

        {/* 3 — Builder */}
        <FeatureRow
          id="builder"
          num="02"
          label="Builder"
          title="Describe a page. Watch it build."
          body={
            <>
              Drag blocks onto the canvas, edit copy inline, and tune brand,
              fonts and colors from the properties panel —{" "}
              <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                no code, no design ticket.
              </strong>
            </>
          }
          bullets={[
            "Prompt, URL, or screenshot → page",
            "Visual block builder",
            "Inline copy editing",
            "Live segment-aware previews",
          ]}
          url="app.lpstudio.ai/builder/northwind-summit"
          bodyHeight={620}
          variant="cream-2"
          frame={<BuilderEmbed />}
        />

        {/* 4 — Templates */}
        <FeatureRow
          id="templates"
          num="03"
          label="Templates"
          title="Never start from a blank page."
          body={
            <>
              Browse on-brand templates as live previews — by type and industry
              — then clone one into the builder and make it yours.
            </>
          }
          bullets={[
            "100+ templates",
            "Filter by industry & motion",
            "Live preview thumbnails",
            "Inherit your brand on clone",
          ]}
          url="app.lpstudio.ai/templates"
          bodyHeight={620}
          frame={<TemplatesEmbed />}
        />

        {/* 5 — Sales Console */}
        <FeatureRow
          id="sales-console"
          num="04"
          label="Sales Console"
          title="An ABM command center for reps."
          body={
            <>
              Hot accounts, live visitor signals, per-account microsites, and
              AI-drafted outreach —{" "}
              <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                the whole book of business in one warm, scannable view.
              </strong>
            </>
          }
          bullets={[
            "Hot accounts surface themselves",
            "AI brief in one click",
            "Per-contact engagement",
            "Native draft email + microsite",
          ]}
          url="app.lpstudio.ai/sales"
          bodyHeight={640}
          variant="cream-2"
          frame={<SalesConsoleEmbed />}
        />

        {/* 6 — Analytics & Identity (lifts the AnalyticsMock from
            IdentityWedge with product-focused framing, less wedge-y). */}
        <FeatureRow
          id="analytics"
          num="05"
          label="Analytics & Identity"
          title="Per-page analytics, with the person attached."
          body={
            <>
              Every published page gets visits, leads, scroll depth, and CTA
              clicks — paired with{" "}
              <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                deterministic per-recipient identity
              </strong>{" "}
              on every tokenized link, so the visit row says "Sarah Chen,
              read the pricing section, didn't click Book Demo," not "someone
              from Acme."
            </>
          }
          bullets={[
            "Visits, leads, CVR, scroll, clicks per page",
            "Per-recipient identity baked into URLs at send",
            "Heatmaps + element-level click tracking",
            "Known + Anonymous visits in one table",
          ]}
          url="app.lpstudio.ai/analytics/pages/cobalt-pilot"
          bodyHeight={720}
          frame={<AnalyticsMock />}
        />

        {/* 7 — Integrations & API */}
        <Integrations />

        {/* 8 — Final CTA + Footer */}
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
